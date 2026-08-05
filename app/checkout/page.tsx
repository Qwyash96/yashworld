"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useStore } from "@/components/store-provider"
import {
  fetchCheckoutConfig,
  placeCodOrder,
  createRazorpayOrder,
  verifyRazorpayPayment,
  loadRazorpayCheckoutScript,
  previewOrderPricing,
  type CheckoutItemInput,
  type OrderPricingPreview,
} from "@/lib/checkout-client"
import { SHIPPING_OPTIONS } from "@/lib/shipping"
import { formatPrice } from "@/lib/products"
import { sanitizeIndianMobile, sanitizeDigits } from "@/lib/numeric-input"
import type { PaymentMethod, ShippingMethod } from "@/types/order"
import type { PublicCheckoutConfig } from "@/types/checkout-config"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

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
  paymentMethod: PaymentMethod
}

type FormErrors = Partial<Record<keyof CheckoutForm, string>>

const SHIPPING_METHODS = SHIPPING_OPTIONS

/** Derives the checkout page's method list from admin-controlled settings —
 * this is the only place that decides what a buyer can pick, so "no code
 * changes to change payment methods" holds: toggling settings in
 * /admin/settings/payments is enough. */
function buildAvailableMethods(
  config: PublicCheckoutConfig,
): { id: PaymentMethod; label: string; description: string }[] {
  const list: { id: PaymentMethod; label: string; description: string }[] = []
  if (config.checkout.codEnabled && config.methods.cod) {
    list.push({ id: "cod", label: "Cash on Delivery", description: "Pay in cash when your order arrives." })
  }
  const anyRazorpayInstrument =
    config.methods.upi || config.methods.cards || config.methods.netbanking || config.methods.wallet || config.methods.emi
  if (config.checkout.razorpayEnabled && anyRazorpayInstrument) {
    list.push({ id: "razorpay", label: "Pay Online (Razorpay)", description: "UPI, Cards, Net Banking & more." })
  }
  return list
}

function validate(form: CheckoutForm, availableMethodIds: PaymentMethod[]): FormErrors {
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
  const { user, cart, cartSubtotal, getProductById, clearCart } = useStore()
  const [form, setForm] = useState<CheckoutForm>(() => emptyForm(user?.email ?? ""))
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [config, setConfig] = useState<PublicCheckoutConfig | null>(null)
  const [configError, setConfigError] = useState<string | null>(null)

  const [couponInput, setCouponInput] = useState("")
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null)
  const [couponError, setCouponError] = useState<string | null>(null)
  const [couponLoading, setCouponLoading] = useState(false)
  const [preview, setPreview] = useState<OrderPricingPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

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
    const preferred = availableMethods.find((m) => m.id === config.checkout.defaultMethod) ?? availableMethods[0]
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
      clearCart()
      router.push(`/orders/${result.orderId}?confirmed=1`)
      return
    }

    // Razorpay — never write anything to Firestore until payment is verified.
    const created = await createRazorpayOrder({
      items,
      shippingMethod: form.shippingMethod,
      ...(appliedCoupon ? { couponCode: appliedCoupon } : {}),
    })
    if (!created.ok) {
      setSubmitting(false)
      setSubmitError(created.error)
      return
    }

    try {
      await loadRazorpayCheckoutScript()
    } catch {
      setSubmitting(false)
      setSubmitError("Couldn't load the payment gateway. Please try again.")
      return
    }

    const RazorpayCheckout = (window as any).Razorpay
    const rzp = new RazorpayCheckout({
      key: created.keyId,
      amount: created.amount,
      currency: created.currency,
      order_id: created.razorpayOrderId,
      name: "IXOFLORA",
      description: "Order payment",
      // Driven entirely by admin-controlled settings (Payment Methods in
      // /admin/settings/payments) — toggling those is enough, no code or
      // architecture change needed to enable/disable an instrument.
      method: {
        upi: created.methods.upi,
        card: created.methods.cards,
        netbanking: created.methods.netbanking,
        wallet: created.methods.wallet,
        emi: created.methods.emi,
        paylater: false,
      },
      prefill: { name: form.fullName.trim(), email: contactEmail, contact: form.phone.trim() },
      handler: async (response: {
        razorpay_order_id: string
        razorpay_payment_id: string
        razorpay_signature: string
      }) => {
        const result = await verifyRazorpayPayment({
          ...response,
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
        clearCart()
        router.push(`/orders/${result.orderId}?confirmed=1`)
      },
      modal: {
        ondismiss: () => {
          setSubmitting(false)
          setSubmitError("Payment cancelled.")
        },
      },
    })

    rzp.on("payment.failed", (response: { error: { description: string } }) => {
      setSubmitting(false)
      setSubmitError(`Payment failed: ${response.error.description}`)
    })

    rzp.open()
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
