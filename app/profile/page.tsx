"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import {
  Package,
  Heart,
  MapPin,
  User,
  ShoppingBag,
  Eye,
  Plus,
  Trash2,
  Pencil,
  Leaf,
  CheckCircle2,
  Clock,
  XCircle,
  Wallet,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"

import { useStore } from "@/components/store-provider"
import { formatPrice } from "@/lib/products"
import { getSellerApplication } from "@/services/seller.service"
import { getOrdersByBuyer } from "@/services/order.service"
import { getUserProfile, updateUserProfile, updateUserAddresses } from "@/services/user.service"
import { updateAuthPhoto } from "@/services/auth.service"
import { uploadProfilePhoto } from "@/services/storage.service"
import { sanitizeIndianMobile, sanitizeDigits } from "@/lib/numeric-input"
import type { Order, OrderStatus } from "@/types/order"
import type { Address, UserProfile } from "@/types/user"
import { OrderStatusBadge } from "@/components/orders/order-status-badge"
import { ProductImage } from "@/components/product-image"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diffMs / 86400000)
  if (days <= 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 30) return `${days} days ago`
  return formatDate(iso)
}

const emptyAddressForm = { fullName: "", phone: "", line1: "", city: "", state: "", postalCode: "" }

export default function ProfilePage() {
  const { user, wishlist, logout, getProductById, addToCart, toggleWishlist } = useStore()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [isApprovedSeller, setIsApprovedSeller] = useState(false)
  const [sellerCreatedAt, setSellerCreatedAt] = useState<string | null>(null)
  const [sellerStatus, setSellerStatus] = useState<string | null>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [editMobile, setEditMobile] = useState("")
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  const [addressSheetOpen, setAddressSheetOpen] = useState(false)
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null)
  const [addressForm, setAddressForm] = useState(emptyAddressForm)

  function refresh() {
    if (!user) return
    getUserProfile(user.uid).then(setProfile)
    getOrdersByBuyer(user.uid).then(setOrders)
    getSellerApplication(user.uid).then((application) => {
      setIsApprovedSeller(application?.status === "approved")
      setSellerStatus(application?.status ?? null)
      setSellerCreatedAt(application?.createdAt ?? null)
    })
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const savedItems = useMemo(
    () =>
      wishlist
        .map((id) => getProductById(id))
        .filter((p): p is NonNullable<typeof p> => p !== undefined)
        .slice(0, 4),
    [wishlist, getProductById]
  )

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-50 via-white to-green-100 px-4">
        <div className="w-full max-w-md rounded-3xl bg-white p-10 text-center shadow-2xl">
          <Avatar className="mx-auto h-24 w-24 border-4 border-green-500">
            <AvatarFallback className="bg-green-600 text-3xl text-white">
              <User className="h-10 w-10" />
            </AvatarFallback>
          </Avatar>
          <h1 className="mt-6 text-3xl font-bold text-black">Welcome to IXOFLORA</h1>
          <p className="mt-3 text-[#444444]">
            Login to view your profile, wishlist, orders and saved addresses.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Button className="h-11" render={<Link href="/login" />}>
              Sign In
            </Button>
            <Button variant="outline" className="h-11" render={<Link href="/signup" />}>
              Create Account
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!profile) return null

  const displayName = user.name
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  const addresses = profile.addresses ?? []
  const totalSpent = orders.reduce((sum, o) => sum + o.totals.total, 0)
  const pendingStatuses = new Set<OrderStatus>([
    "Pending",
    "Accepted",
    "Ready To Pack",
    "Packed",
    "Pickup Requested",
    "Picked Up",
    "In Transit",
    "Out For Delivery",
  ])
  const pendingOrders = orders.filter((o) => pendingStatuses.has(o.status)).length
  const deliveredOrders = orders.filter((o) => o.status === "Delivered").length

  const overviewStats: { label: string; value: string; icon: LucideIcon; color: string }[] = [
    { label: "Total Orders", value: String(orders.length), icon: ShoppingBag, color: "text-green-700" },
    { label: "Wishlist Items", value: String(wishlist.length), icon: Heart, color: "text-red-500" },
    { label: "Saved Addresses", value: String(addresses.length), icon: MapPin, color: "text-orange-500" },
    { label: "Pending Orders", value: String(pendingOrders), icon: Clock, color: "text-yellow-600" },
    { label: "Delivered Orders", value: String(deliveredOrders), icon: Package, color: "text-blue-600" },
    { label: "Total Spent", value: formatPrice(totalSpent), icon: Wallet, color: "text-green-700" },
  ]

  const activityFeed = [
    ...orders.map((o) => ({
      id: `order-${o.id}`,
      message: `Order #${o.id.slice(0, 8)} placed`,
      createdAt: o.createdAt,
    })),
    ...(sellerCreatedAt
      ? [
          {
            id: "seller-app",
            message: sellerStatus === "approved" ? "Seller Application Approved" : "Seller Application Submitted",
            createdAt: sellerCreatedAt,
          },
        ]
      : []),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6)

  function openEdit() {
    setEditMobile(profile!.mobile ?? "")
    setEditOpen(true)
  }

  async function saveEdit() {
    await updateUserProfile(user!.uid, { mobile: editMobile.trim() })
    setEditOpen(false)
    toast.success("Profile updated")
    refresh()
  }

  async function handlePhotoChange(file: File | undefined) {
    if (!file || !user) return
    setUploadingPhoto(true)
    try {
      const photoUrl = await uploadProfilePhoto(user.uid, file)
      await Promise.all([updateUserProfile(user.uid, { photoUrl }), updateAuthPhoto(photoUrl)])
      toast.success("Profile photo updated")
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.")
    } finally {
      setUploadingPhoto(false)
    }
  }

  function openAddAddress() {
    setEditingAddressId(null)
    setAddressForm(emptyAddressForm)
    setAddressSheetOpen(true)
  }

  function openEditAddress(a: Address) {
    setEditingAddressId(a.id)
    setAddressForm({
      fullName: a.fullName,
      phone: a.phone,
      line1: a.line1,
      city: a.city,
      state: a.state,
      postalCode: a.postalCode,
    })
    setAddressSheetOpen(true)
  }

  async function saveAddress() {
    if (!addressForm.fullName.trim() || !addressForm.line1.trim() || !addressForm.city.trim()) {
      toast.error("Please fill in all required fields.")
      return
    }
    const next = editingAddressId
      ? addresses.map((a) =>
          a.id === editingAddressId
            ? {
                ...a,
                fullName: addressForm.fullName.trim(),
                phone: addressForm.phone.trim(),
                line1: addressForm.line1.trim(),
                city: addressForm.city.trim(),
                state: addressForm.state.trim(),
                postalCode: addressForm.postalCode.trim(),
              }
            : a
        )
      : [
          ...addresses,
          {
            id: crypto.randomUUID(),
            fullName: addressForm.fullName.trim(),
            phone: addressForm.phone.trim(),
            line1: addressForm.line1.trim(),
            city: addressForm.city.trim(),
            state: addressForm.state.trim(),
            postalCode: addressForm.postalCode.trim(),
            country: "India",
            isDefault: addresses.length === 0,
          },
        ]
    await updateUserAddresses(user!.uid, next)
    toast.success(editingAddressId ? "Address updated" : "Address added")
    setAddressSheetOpen(false)
    refresh()
  }

  async function removeAddress(id: string) {
    if (!window.confirm("Delete this address?")) return
    await updateUserAddresses(
      user!.uid,
      addresses.filter((a) => a.id !== id)
    )
    refresh()
  }

  return (
    <div className="min-h-screen bg-[#f3f5f2]">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        {/* TOP PROFILE SECTION */}
        <div className="rounded-2xl border border-border bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
              <Avatar className="h-[70px] w-[70px] shrink-0 border-2 border-green-500 shadow-sm">
                {profile.photoUrl && <AvatarImage src={profile.photoUrl} alt={displayName} />}
                <AvatarFallback className="bg-green-600 text-xl font-bold text-white">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-lg font-bold text-black sm:text-xl">{displayName}</h1>
                <p className="text-xs text-[#444444]">{user.email}</p>
                <p className="text-xs text-[#444444]">{profile.mobile || "No mobile number added"}</p>
                <p className="text-[11px] text-[#888888]">
                  Member since {formatDate(profile.createdAt)}
                </p>
              </div>
            </div>
            <Button size="sm" className="h-9" onClick={openEdit}>
              <Pencil className="size-3.5" />
              Edit Profile
            </Button>
          </div>
        </div>

        {/* ACCOUNT OVERVIEW */}
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          {overviewStats.map((stat) => {
            const Icon = stat.icon
            return (
              <div
                key={stat.label}
                className="flex h-[92px] items-center gap-2.5 rounded-xl border border-border bg-white px-3 shadow-sm transition hover:shadow-md"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#f3f5f2]">
                  <Icon className={`size-[18px] ${stat.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-bold leading-tight text-black">{stat.value}</p>
                  <p className="truncate text-[11px] leading-tight text-[#666666]">{stat.label}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* RECENT ORDERS */}
        <SectionHeader title="Recent Orders" />
        {orders.length === 0 ? (
          <EmptyNote text="No orders yet." />
        ) : (
          <div className="flex flex-col gap-2">
            {orders.slice(0, 5).map((order) => {
              const itemCount = order.sellerOrders.reduce(
                (sum, so) => sum + so.items.reduce((s, i) => s + i.quantity, 0),
                0
              )
              return (
                <div
                  key={order.id}
                  className="flex flex-col gap-2 rounded-xl border border-border bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-black">Order #{order.id.slice(0, 8)}</p>
                      <OrderStatusBadge status={order.status} />
                    </div>
                    <p className="text-[11px] text-[#888888]">
                      {formatDate(order.createdAt)} · {itemCount} item{itemCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-black sm:w-24 sm:text-right">
                    {formatPrice(order.totals.total)}
                  </p>
                  <Button size="sm" variant="outline" className="h-7 shrink-0 px-2.5 text-xs" render={<Link href={`/orders/${order.id}`} />}>
                    <Eye className="size-3.5" />
                    View
                  </Button>
                </div>
              )
            })}
          </div>
        )}

        {/* MY ADDRESSES */}
        <SectionHeader title="My Addresses" action={<AddButton label="Add New Address" onClick={openAddAddress} />} />
        {addresses.length === 0 ? (
          <EmptyNote text="No addresses added." />
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {addresses.map((a) => (
              <div key={a.id} className="rounded-xl border border-border bg-white p-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-bold text-black">{a.fullName}</p>
                  {a.isDefault && (
                    <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-800">
                      Default
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#444444]">{a.phone}</p>
                <p className="mt-1 text-xs text-black">
                  {a.line1}, {a.city}, {a.state} - {a.postalCode}
                </p>
                <div className="mt-2.5 flex gap-1.5">
                  <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" onClick={() => openEditAddress(a)}>
                    <Pencil className="size-3" />
                    Edit
                  </Button>
                  <Button size="sm" variant="destructive" className="h-7 px-2.5 text-xs" onClick={() => removeAddress(a.id)}>
                    <Trash2 className="size-3" />
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* WISHLIST PREVIEW */}
        <SectionHeader title="Wishlist" action={<Link href="/wishlist" className="text-xs font-semibold text-green-700 hover:underline">View All</Link>} />
        {savedItems.length === 0 ? (
          <EmptyNote text="No wishlist items." />
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {savedItems.map((p) => (
              <div key={p.id} className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
                <div className="relative h-28">
                  <ProductImage src={p.image} alt={p.name} className="absolute inset-0" padding="sm" />
                </div>
                <div className="p-2.5">
                  <p className="line-clamp-1 text-xs font-bold text-black">{p.name}</p>
                  <p className="text-xs font-semibold text-green-700">{formatPrice(p.price)}</p>
                  <div className="mt-2 flex gap-1.5">
                    <Button
                      size="sm"
                      className="h-7 flex-1 px-2 text-xs"
                      onClick={() => addToCart(p, p.sizes[0], p.colors[0])}
                    >
                      Add to Cart
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => toggleWishlist(p)}>
                      Remove
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* SELLER */}
        <SectionHeader title="Sell on IXOFLORA" />
        <Link
          href={isApprovedSeller ? "/seller/products" : "/sell"}
          className="flex items-center justify-between rounded-xl border border-green-600 bg-green-50 p-3.5 shadow-sm transition hover:shadow-md"
        >
          <div className="flex items-center gap-2.5">
            <Leaf className="size-5 text-green-700" />
            <div>
              <p className="text-sm font-bold text-black">
                {isApprovedSeller ? "Go to Seller Dashboard" : "Become a Seller"}
              </p>
              <p className="text-xs text-[#444444]">
                {isApprovedSeller
                  ? "Manage your products, orders and earnings."
                  : "Start selling plants and gardening essentials on IXOFLORA."}
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-lg bg-green-600 px-3.5 py-1.5 text-sm font-semibold text-white">
            {isApprovedSeller ? "Open" : "Start"}
          </span>
        </Link>

        {/* ACCOUNT SETTINGS */}
        <SectionHeader title="Account Settings" />
        <button
          onClick={openEdit}
          className="flex items-center gap-2.5 rounded-xl border border-border bg-white p-3.5 text-left shadow-sm transition hover:border-green-600"
        >
          <User className="size-4 text-green-700" />
          <div>
            <p className="text-sm font-bold text-black">Edit Profile</p>
            <p className="text-[11px] text-[#444444]">Update your mobile number</p>
          </div>
        </button>

        {/* ACTIVITY TIMELINE */}
        <SectionHeader title="Recent Activity" />
        {activityFeed.length === 0 ? (
          <EmptyNote text="No recent activity." />
        ) : (
          <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3">
              {activityFeed.map((event, i) => (
                <div key={event.id} className="flex items-start gap-2.5">
                  <div className="flex flex-col items-center">
                    <div className="flex size-6 items-center justify-center rounded-full bg-green-100">
                      <CheckCircle2 className="size-3.5 text-green-700" />
                    </div>
                    {i < activityFeed.length - 1 && <div className="mt-1 h-full w-px flex-1 bg-border" />}
                  </div>
                  <div className="pb-2.5">
                    <p className="text-xs font-semibold text-black">{event.message}</p>
                    <p className="text-[11px] text-[#444444]">{timeAgo(event.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5">
          <button
            onClick={logout}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-300 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50"
          >
            <XCircle className="size-3.5" />
            Log Out
          </button>
        </div>
      </div>

      {/* Edit Profile Sheet */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="right" className="w-full max-w-md overflow-y-auto p-0 sm:max-w-lg">
          <SheetHeader className="border-b border-border">
            <SheetTitle>Edit Profile</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-4 p-5">
            <div className="flex flex-col items-center gap-3">
              <Avatar className="h-20 w-20 border-2 border-green-500">
                {profile.photoUrl && <AvatarImage src={profile.photoUrl} alt={displayName} />}
                <AvatarFallback className="bg-green-600 text-xl text-white">{initials}</AvatarFallback>
              </Avatar>
              <label className="cursor-pointer text-xs font-medium text-green-700 hover:underline">
                {uploadingPhoto ? "Uploading..." : "Change Photo"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  disabled={uploadingPhoto}
                  onChange={(e) => {
                    handlePhotoChange(e.target.files?.[0])
                    e.target.value = ""
                  }}
                />
              </label>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-mobile">Mobile Number</Label>
              <Input
                id="edit-mobile"
                type="tel"
                inputMode="numeric"
                value={editMobile}
                onChange={(e) => setEditMobile(sanitizeIndianMobile(e.target.value))}
                className="h-11"
              />
            </div>
            <Button className="mt-2 h-11" onClick={saveEdit}>
              Save Changes
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Address Sheet */}
      <Sheet open={addressSheetOpen} onOpenChange={setAddressSheetOpen}>
        <SheetContent side="right" className="w-full max-w-md overflow-y-auto p-0 sm:max-w-lg">
          <SheetHeader className="border-b border-border">
            <SheetTitle>{editingAddressId ? "Edit Address" : "Add New Address"}</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-4 p-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="addr-name">Name</Label>
              <Input
                id="addr-name"
                value={addressForm.fullName}
                onChange={(e) => setAddressForm((f) => ({ ...f, fullName: e.target.value }))}
                className="h-11"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="addr-mobile">Mobile</Label>
              <Input
                id="addr-mobile"
                type="tel"
                inputMode="numeric"
                value={addressForm.phone}
                onChange={(e) => setAddressForm((f) => ({ ...f, phone: sanitizeIndianMobile(e.target.value) }))}
                className="h-11"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="addr-address">Address</Label>
              <Input
                id="addr-address"
                value={addressForm.line1}
                onChange={(e) => setAddressForm((f) => ({ ...f, line1: e.target.value }))}
                className="h-11"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="addr-city">City</Label>
                <Input
                  id="addr-city"
                  value={addressForm.city}
                  onChange={(e) => setAddressForm((f) => ({ ...f, city: e.target.value }))}
                  className="h-11"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="addr-state">State</Label>
                <Input
                  id="addr-state"
                  value={addressForm.state}
                  onChange={(e) => setAddressForm((f) => ({ ...f, state: e.target.value }))}
                  className="h-11"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="addr-pincode">Pincode</Label>
                <Input
                  id="addr-pincode"
                  inputMode="numeric"
                  value={addressForm.postalCode}
                  onChange={(e) => setAddressForm((f) => ({ ...f, postalCode: sanitizeDigits(e.target.value, 6) }))}
                  className="h-11"
                />
              </div>
            </div>
            <Button className="mt-2 h-11" onClick={saveAddress}>
              Save Address
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-2.5 mt-5 flex items-center justify-between">
      <h2 className="text-base font-bold text-black">{title}</h2>
      {action}
    </div>
  )
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-green-700"
    >
      <Plus className="size-3.5" />
      {label}
    </button>
  )
}

function EmptyNote({ text }: { text: string }) {
  return (
    <div className="col-span-full rounded-xl border border-dashed border-border bg-white p-5 text-center text-xs text-[#444444]">
      {text}
    </div>
  )
}
