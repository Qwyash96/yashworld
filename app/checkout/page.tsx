"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useStore } from "@/components/store-provider"
import {
  fetchCheckoutConfig,
  placeCodOrder,
  createPaymentOrder,
  verifyPayment,
  previewOrderPricing,
  type CheckoutAddressInput,
  type CheckoutItemInput,
  type OrderPricingPreview,
  type PaymentInstrument,
} from "@/lib/checkout-client"
import { launchGateway } from "@/lib/payment-gateway-client"
import { SHIPPING_OPTIONS } from "@/lib/shipping"
import { formatPrice } from "@/lib/products"
import { sanitizeIndianMobile, sanitizeDigits } from "@/lib/numeric-input"
import { cn } from "@/lib/utils"
import { getUserProfile, updateUserAddresses } from "@/services/user.service"
import type { PaymentGatewayId, ShippingMethod } from "@/types/order"
import type { PublicCheckoutConfig } from "@/types/checkout-config"
import type { Address } from "@/types/user"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

// Persisted across the full-page redirect that Stripe/PayPal/PhonePe/PayU/
// Cashfree all use to collect payment on their own hosted page — restored
// on return (see the ?gatewayReturn=1 effect below) since this is a fresh
// page load, not a continuation of the same JS session. Razorpay never
// needs this; its modal resolves without leaving the page.
const PENDING_PAYMENT_KEY = "yashworld.pendingGatewayPayment"

interface PendingGatewayPayment {
  gatewayId: PaymentGatewayId
  gatewayOrderId: string
  items: CheckoutItemInput[]
  contactEmail: string
  shippingMethod: ShippingMethod
  shippingAddress: CheckoutAddressInput
  couponCode?: string
}

type CheckoutForm = {
  email: string
  phone: string
  fullName: string
  line1: string
  line2: string
  landmark: string
  city: string
  state: string
  postalCode: string
  country: string
  shippingMethod: ShippingMethod
  paymentMethod: PaymentInstrument
}

type FormErrors = Partial<Record<keyof CheckoutForm, string>>

const SHIPPING_METHODS = SHIPPING_OPTIONS

const METHOD_INFO: Record<PaymentInstrument, { label: string; description: string }> = {
  cod: { label: "Cash on Delivery", description: "Pay in cash when your order arrives." },
  upi: { label: "UPI", description: "Google Pay, PhonePe, Paytm and other UPI apps." },
  cards: { label: "Cards", description: "Credit and debit cards." },
  netbanking: { label: "Net Banking", description: "Direct bank transfer via net banking." },
  wallet: { label: "Wallet", description: "Paytm Wallet, Amazon Pay and similar." },
  emi: { label: "EMI", description: "Card and cardless EMI options." },
}
const METHOD_ORDER: PaymentInstrument[] = ["upi", "cards", "netbanking", "wallet", "emi", "cod"]

/** Derives the checkout page's method list from admin-controlled settings —
 * this is the only place that decides what a buyer can pick, so "no code
 * changes to change payment methods" holds: toggling settings in
 * /admin/settings/payment-methods is enough. Never shows a gateway name —
 * the router (lib/payment-router.ts) decides which one actually processes
 * an online instrument, entirely server-side. */
function buildAvailableMethods(
  config: PublicCheckoutConfig,
): { id: PaymentInstrument; label: string; description: string }[] {
  return METHOD_ORDER.filter((id) => {
    if (id === "cod") return config.methods.cod
    return config.methods[id] && config.checkout.anyGatewayAvailable
  }).map((id) => ({ id, ...METHOD_INFO[id] }))
}

function validate(form: CheckoutForm, availableMethodIds: PaymentInstrument[]): FormErrors {
  const errors: FormErrors = {}

  if (!form.email.trim()) errors.email = "Email is required."
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
    errors.email = "Enter a valid email address."

  const digits = form.phone.replace(/\D/g, "")
  if (!form.phone.trim()) errors.phone = "Phone number is required."
  else if (digits.length !== 10) errors.phone = "Enter a valid 10-digit phone number."

  if (!form.fullName.trim()) errors.fullName = "Full name is required."
  if (!form.line1.trim()) errors.line1 = "Address is required."
  if (!form.city.trim()) errors.city = "City is required."
  if (!form.state.trim()) errors.state = "State is required."

  if (!form.postalCode.trim()) errors.postalCode = "Postal code is required."
  else if (!/^\d{6}$/.test(form.postalCode.trim()))
    errors.postalCode = "Enter a valid 6-digit postal code."

  if (!form.country.trim()) errors.country = "Country is required."

  if (!availableMethodIds.includes(form.paymentMethod)) {
    errors.paymentMethod = "This payment method isn't available right now."
  }

  return errors
}

const emptyForm = (email: string): CheckoutForm => ({
  email,
  phone: "",
  fullName: "",
  line1: "",
  line2: "",
  landmark: "",
  city: "",
  state: "",
  postalCode: "",
  country: "India",
  shippingMethod: "standard",
  paymentMethod: "cod",
})

export default function CheckoutPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, cart, cartSubtotal, getProductById, clearCart } = useStore()
  const [form, setForm] = useState<CheckoutForm>(() => emptyForm(user?.email ?? ""))
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [config, setConfig] = useState<PublicCheckoutConfig | null>(null)
  const [configError, setConfigError] = useState<string | null>(null)
  // True only right after returning from a redirect-based gateway
  // (Stripe/PayPal/PhonePe/PayU/Cashfree) — Razorpay's modal never leaves
  // the page, so it never sets this.
  const [resumingPayment, setResumingPayment] = useState(false)

  useEffect(() => {
    if (searchParams.get("gatewayReturn") !== "1") return
    const raw = sessionStorage.getItem(PENDING_PAYMENT_KEY)
    sessionStorage.removeItem(PENDING_PAYMENT_KEY)
    if (!raw) {
      setSubmitError("We couldn't confirm your payment. If you were charged, contact support.")
      return
    }
    const pending = JSON.parse(raw) as PendingGatewayPayment
    setResumingPayment(true)
    verifyPayment({ ...pending, payload: {} }).then((result) => {
      setResumingPayment(false)
      if (!result.ok) {
        setSubmitError(result.error)
        return
      }
      clearCart()
      router.push(`/orders/${result.orderId}?confirmed=1`)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [couponInput, setCouponInput] = useState("")
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null)
  const [couponError, setCouponError] = useState<string | null>(null)
  const [couponLoading, setCouponLoading] = useState(false)
  const [preview, setPreview] = useState<OrderPricingPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  // Saved addresses (users/{uid}.addresses) — the permanent source of truth,
  // never touched by placing an order. "new" means the buyer is filling a
  // fresh address rather than reusing a saved one.
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<string | "new">("new")
  const [saveNewAddress, setSaveNewAddress] = useState(true)

  function applyAddressToForm(a: Address) {
    setForm((prev) => ({
      ...prev,
      fullName: a.fullName,
      line1: a.line1,
      line2: a.line2 ?? "",
      landmark: a.landmark ?? "",
      city: a.city,
      state: a.state,
      postalCode: a.postalCode,
      country: a.country,
      phone: a.phone,
    }))
    setErrors({})
  }

  function selectNewAddress() {
    setSelectedAddressId("new")
    setForm((prev) => ({
      ...prev,
      fullName: "",
      line1: "",
      line2: "",
      landmark: "",
      city: "",
      state: "",
      postalCode: "",
      country: "India",
      phone: "",
    }))
    setErrors({})
  }

  useEffect(() => {
    if (!user) return
    getUserProfile(user.uid).then((profile) => {
      const addrs = profile?.addresses ?? []
      setSavedAddresses(addrs)
      const preferred = addrs.find((a) => a.isDefault) ?? addrs[0]
      if (preferred) {
        setSelectedAddressId(preferred.id)
        applyAddressToForm(preferred)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid])

  const previewItems: CheckoutItemInput[] = useMemo(
    () =>
      cart
        .filter((item) => !!getProductById(item.id))
        .map((item) => ({ productId: item.id, quantity: item.quantity })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cart],
  )

  useEffect(() => {
    if (previewItems.length === 0) {
      setPreview(null)
      return
    }
    let cancelled = false
    setPreviewLoading(true)
    previewOrderPricing({
      items: previewItems,
      shippingMethod: form.shippingMethod,
      ...(appliedCoupon ? { couponCode: appliedCoupon } : {}),
    }).then((result) => {
      if (cancelled) return
      setPreviewLoading(false)
      if (!result.ok) {
        setPreview(null)
        if (appliedCoupon) {
          setCouponError(result.error)
          setAppliedCoupon(null)
        }
        return
      }
      setPreview(result.preview)
    })
    return () => {
      cancelled = true
    }
  }, [previewItems, form.shippingMethod, appliedCoupon])

  async function handleApplyCoupon() {
    const code = couponInput.trim()
    if (!code) return
    setCouponError(null)
    setCouponLoading(true)
    const result = await previewOrderPricing({
      items: previewItems,
      shippingMethod: form.shippingMethod,
      couponCode: code,
    })
    setCouponLoading(false)
    if (!result.ok) {
      setCouponError(result.error)
      return
    }
    if (!result.preview.appliedCouponCode) {
      setCouponError("This coupon code isn't valid for your cart.")
      return
    }
    setAppliedCoupon(result.preview.appliedCouponCode)
    setPreview(result.preview)
  }

  function handleRemoveCoupon() {
    setAppliedCoupon(null)
    setCouponInput("")
    setCouponError(null)
  }

  useEffect(() => {
    fetchCheckoutConfig().then((result) => {
      if (!result.ok) {
        setConfigError(result.error)
        return
      }
      setConfig(result.config)
    })
  }, [])

  const availableMethods = useMemo(() => (config ? buildAvailableMethods(config) : []), [config])

  useEffect(() => {
    if (!config) return
    if (availableMethods.some((m) => m.id === form.paymentMethod)) return
    const preferred = availableMethods[0]
    if (preferred) setField("paymentMethod", preferred.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, availableMethods])

  const shippingOption =
    SHIPPING_METHODS.find((m) => m.id === form.shippingMethod) ?? SHIPPING_METHODS[0]
  // Fall back to a naive local estimate only until the trusted server
  // preview (which reflects scheduled offers/campaign/coupon pricing) loads.
  const shipping = preview?.shipping ?? shippingOption.getRate(cartSubtotal)
  const subtotal = preview?.subtotal ?? cartSubtotal
  const discount = preview?.discount ?? 0
  const total = preview?.total ?? cartSubtotal + shipping

  function setField<K extends keyof CheckoutForm>(key: K, value: CheckoutForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  /** Runs only after the order has actually been placed/paid — never before,
   * so an abandoned checkout never touches the buyer's saved addresses. A
   * reused saved address is already in users/{uid}.addresses and is left
   * untouched (this only ever appends); a fresh one typed at checkout gets
   * saved so it's there next time, unless the buyer opted out. Best-effort:
   * the order itself already succeeded, so a failure here must never surface
   * as an order failure. */
  async function persistAddressIfNew() {
    if (!user || selectedAddressId !== "new" || !saveNewAddress) return
    const newAddress: Address = {
      id: crypto.randomUUID(),
      fullName: form.fullName.trim(),
      line1: form.line1.trim(),
      ...(form.line2.trim() ? { line2: form.line2.trim() } : {}),
      ...(form.landmark.trim() ? { landmark: form.landmark.trim() } : {}),
      city: form.city.trim(),
      state: form.state.trim(),
      postalCode: form.postalCode.trim(),
      country: form.country.trim(),
      phone: form.phone.trim(),
      isDefault: savedAddresses.length === 0,
    }
    try {
      await updateUserAddresses(user.uid, [...savedAddresses, newAddress])
    } catch (error) {
      console.error("Failed to save address for future orders:", error)
    }
  }

  async function handlePlaceOrder(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    if (!user) return

    const fieldErrors = validate(
      form,
      availableMethods.map((m) => m.id),
    )
    setErrors(fieldErrors)
    if (Object.keys(fieldErrors).length > 0) return

    const items = previewItems

    if (items.length === 0) {
      setSubmitError("Your bag has no items available to order.")
      return
    }

    const shippingAddress = {
      fullName: form.fullName.trim(),
      line1: form.line1.trim(),
      line2: form.line2.trim() || undefined,
      landmark: form.landmark.trim() || undefined,
      city: form.city.trim(),
      state: form.state.trim(),
      postalCode: form.postalCode.trim(),
      country: form.country.trim(),
      phone: form.phone.trim(),
    }
    const contactEmail = form.email.trim()

    setSubmitting(true)

    if (form.paymentMethod === "cod") {
      const result = await placeCodOrder({
        items,
        contactEmail,
        shippingMethod: form.shippingMethod,
        shippingAddress,
        ...(appliedCoupon ? { couponCode: appliedCoupon } : {}),
      })
      setSubmitting(false)
      if (!result.ok) {
        setSubmitError(result.error)
        return
      }
      await persistAddressIfNew()
      clearCart()
      router.push(`/orders/${result.orderId}?confirmed=1`)
      return
    }

    // Online instrument — the customer only ever picked UPI/Cards/Net
    // Banking/Wallet/EMI; the router (lib/payment-router.ts) decides which
    // enabled+connected gateway actually processes it, server-side, with
    // automatic fallback. Never writes anything to Firestore until payment
    // is verified.
    const created = await createPaymentOrder({
      items,
      shippingMethod: form.shippingMethod,
      method: form.paymentMethod,
      contactEmail,
      buyerName: form.fullName.trim(),
      buyerPhone: form.phone.trim(),
      ...(appliedCoupon ? { couponCode: appliedCoupon } : {}),
    })
    if (!created.ok) {
      setSubmitting(false)
      setSubmitError(created.error)
      return
    }
    const { order } = created

    // Persisted before launching, in case this gateway redirects the browser
    // away entirely (Stripe/PayPal/PhonePe/PayU/Cashfree) — restored by the
    // ?gatewayReturn=1 effect above on a fresh page load. Razorpay's modal
    // never leaves the page, so this is just unused-but-harmless for it.
    sessionStorage.setItem(
      PENDING_PAYMENT_KEY,
      JSON.stringify({
        gatewayId: order.gatewayId,
        gatewayOrderId: order.gatewayOrderId,
        items,
        contactEmail,
        shippingMethod: form.shippingMethod,
        shippingAddress,
        ...(appliedCoupon ? { couponCode: appliedCoupon } : {}),
      } satisfies PendingGatewayPayment),
    )

    const launch = await launchGateway(order, { name: form.fullName.trim(), email: contactEmail, phone: form.phone.trim() })
    if (!launch.ok && !launch.error) {
      // The browser is mid-navigation to a redirect-based gateway's hosted
      // page (or Cashfree's SDK just took over) — nothing more to do here.
      return
    }
    sessionStorage.removeItem(PENDING_PAYMENT_KEY)
    if (!launch.ok) {
      setSubmitting(false)
      setSubmitError(launch.error ?? "Payment cancelled.")
      return
    }

    const result = await verifyPayment({
      gatewayId: order.gatewayId,
      gatewayOrderId: order.gatewayOrderId,
      payload: launch.payload,
      items,
      contactEmail,
      shippingMethod: form.shippingMethod,
      shippingAddress,
      ...(appliedCoupon ? { couponCode: appliedCoupon } : {}),
    })
    setSubmitting(false)
    if (!result.ok) {
      setSubmitError(result.error)
      return
    }
    await persistAddressIfNew()
    clearCart()
    router.push(`/orders/${result.orderId}?confirmed=1`)
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="mb-4">Sign in to check out.</p>
        <Link href="/login" className="underline underline-offset-4">
          Sign in
        </Link>
      </div>
    )
  }

  if (resumingPayment) {
    return <div className="mx-auto max-w-lg px-4 py-16 text-center">Confirming your payment...</div>
  }

  if (cart.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="mb-4">Your bag is empty.</p>
        <Link href="/products" className="underline underline-offset-4">
          Continue shopping
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">Checkout</h1>

      <div className="mt-8 grid gap-10 lg:grid-cols-3">
        <form onSubmit={handlePlaceOrder} className="space-y-8 lg:col-span-2">
          {submitError && <p className="text-sm text-destructive">{submitError}</p>}

          {/* Contact Information */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Contact Information
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                />
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  inputMode="numeric"
                  value={form.phone}
                  onChange={(e) => setField("phone", sanitizeIndianMobile(e.target.value))}
                />
                {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
              </div>
            </div>
          </section>

          {/* Shipping Address */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Shipping Address
            </h2>

            {savedAddresses.length > 0 && (
              <div className="space-y-2">
                <Label>Saved Addresses</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {savedAddresses.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => {
                        setSelectedAddressId(a.id)
                        applyAddressToForm(a)
                      }}
                      className={cn(
                        "rounded-lg border p-3 text-left text-sm transition",
                        selectedAddressId === a.id
                          ? "border-green-600 bg-green-50"
                          : "border-border hover:border-green-300",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-foreground">{a.fullName}</p>
                        {a.isDefault && (
                          <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-800">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {a.line1}, {a.city}, {a.state} - {a.postalCode}
                      </p>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={selectNewAddress}
                    className={cn(
                      "flex items-center justify-center rounded-lg border border-dashed p-3 text-sm font-medium transition",
                      selectedAddressId === "new"
                        ? "border-green-600 bg-green-50 text-green-700"
                        : "border-border text-muted-foreground hover:border-green-300",
                    )}
                  >
                    + Add New Address
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                value={form.fullName}
                onChange={(e) => setField("fullName", e.target.value)}
              />
              {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="line1">Address</Label>
              <Input
                id="line1"
                value={form.line1}
                onChange={(e) => setField("line1", e.target.value)}
              />
              {errors.line1 && <p className="text-xs text-destructive">{errors.line1}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="line2">Apartment, suite, etc. (optional)</Label>
              <Input
                id="line2"
                value={form.line2}
                onChange={(e) => setField("line2", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="landmark">Landmark (optional)</Label>
              <Input
                id="landmark"
                placeholder="e.g. Near City Mall"
                value={form.landmark}
                onChange={(e) => setField("landmark", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={form.city}
                  onChange={(e) => setField("city", e.target.value)}
                />
                {errors.city && <p className="text-xs text-destructive">{errors.city}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={form.state}
                  onChange={(e) => setField("state", e.target.value)}
                />
                {errors.state && <p className="text-xs text-destructive">{errors.state}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="postalCode">Postal Code</Label>
                <Input
                  id="postalCode"
                  inputMode="numeric"
                  value={form.postalCode}
                  onChange={(e) => setField("postalCode", sanitizeDigits(e.target.value, 6))}
                />
                {errors.postalCode && (
                  <p className="text-xs text-destructive">{errors.postalCode}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={form.country}
                onChange={(e) => setField("country", e.target.value)}
              />
              {errors.country && <p className="text-xs text-destructive">{errors.country}</p>}
            </div>

            {selectedAddressId === "new" && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={saveNewAddress}
                  onChange={(e) => setSaveNewAddress(e.target.checked)}
                  className="size-4 rounded border-border"
                />
                Save this address for future orders
              </label>
            )}
          </section>

          {/* Shipping Method */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Shipping Method
            </h2>
            {SHIPPING_METHODS.map((option) => (
              <label
                key={option.id}
                className="flex cursor-pointer items-center justify-between rounded-md border border-border p-4 text-sm has-[:checked]:border-foreground"
              >
                <span className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="shippingMethod"
                    checked={form.shippingMethod === option.id}
                    onChange={() => setField("shippingMethod", option.id)}
                  />
                  <span>
                    <span className="font-medium">{option.label}</span>
                    <span className="ml-2 text-muted-foreground">{option.description}</span>
                  </span>
                </span>
                <span>
                  {option.getRate(cartSubtotal) === 0
                    ? "Free"
                    : formatPrice(option.getRate(cartSubtotal))}
                </span>
              </label>
            ))}
          </section>

          {/* Payment Method */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Payment Method
            </h2>
            {configError && <p className="text-sm text-destructive">{configError}</p>}
            {!config && !configError && (
              <p className="text-sm text-muted-foreground">Loading payment options...</p>
            )}
            {config && availableMethods.length === 0 && !config.paymentLink && (
              <p className="text-sm text-destructive">No payment methods are available right now.</p>
            )}
            {config && availableMethods.length === 0 && config.paymentLink && (
              <p className="text-sm text-muted-foreground">
                Online checkout isn&apos;t available right now — use the payment link below to complete your order.
              </p>
            )}
            {availableMethods.map((option) => (
              <label
                key={option.id}
                className="flex cursor-pointer items-center justify-between rounded-md border border-border p-4 text-sm has-[:checked]:border-foreground"
              >
                <span className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="paymentMethod"
                    checked={form.paymentMethod === option.id}
                    onChange={() => setField("paymentMethod", option.id)}
                  />
                  <span>
                    <span className="font-medium">{option.label}</span>
                    <span className="ml-2 text-muted-foreground">{option.description}</span>
                  </span>
                </span>
              </label>
            ))}
            {errors.paymentMethod && (
              <p className="text-xs text-destructive">{errors.paymentMethod}</p>
            )}
          </section>

          {config && availableMethods.length === 0 && config.paymentLink ? (
            <Button
              type="button"
              size="lg"
              className="h-12 w-full"
              render={<a href={config.paymentLink} target="_blank" rel="noopener noreferrer" />}
            >
              Pay via Payment Link — {formatPrice(total)}
            </Button>
          ) : (
            <Button
              type="submit"
              size="lg"
              className="h-12 w-full"
              disabled={submitting || !config || availableMethods.length === 0}
            >
              {submitting ? "Placing Order..." : `Place Order — ${formatPrice(total)}`}
            </Button>
          )}
        </form>

        <div className="h-fit rounded-md border border-border p-6">
          <h2 className="font-medium">Order Summary</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {cart.map((item) => {
              const product = getProductById(item.id)
              if (!product) return null
              return (
                <li
                  key={`${item.id}-${item.size}-${item.color}`}
                  className="flex justify-between"
                >
                  <span className="text-muted-foreground">
                    {product.name} × {item.quantity}
                  </span>
                  <span>{formatPrice(product.price * item.quantity)}</span>
                </li>
              )
            })}
          </ul>

          <div className="mt-4 space-y-2 border-t border-border pt-4">
            <Label htmlFor="couponCode">Have a coupon code?</Label>
            {appliedCoupon ? (
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <span className="font-medium">{appliedCoupon}</span>
                <button
                  type="button"
                  onClick={handleRemoveCoupon}
                  className="text-xs text-muted-foreground underline underline-offset-4"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  id="couponCode"
                  value={couponInput}
                  onChange={(e) => {
                    setCouponInput(e.target.value.toUpperCase())
                    setCouponError(null)
                  }}
                  placeholder="Enter code"
                />
                <Button type="button" variant="outline" disabled={couponLoading || !couponInput.trim()} onClick={handleApplyCoupon}>
                  {couponLoading ? "Applying..." : "Apply"}
                </Button>
              </div>
            )}
            {couponError && <p className="text-xs text-destructive">{couponError}</p>}
          </div>

          <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-green-700 dark:text-green-500">
                <span>Discount</span>
                <span>-{formatPrice(discount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipping ({shippingOption.label})</span>
              <span>{shipping === 0 ? "Free" : formatPrice(shipping)}</span>
            </div>
            <div className="flex justify-between pt-2 text-base font-semibold">
              <span>Total</span>
              <span>{previewLoading ? "..." : formatPrice(total)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
