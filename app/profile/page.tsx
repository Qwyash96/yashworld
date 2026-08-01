"use client"

import Link from "next/link"
import Image from "next/image"
import { Package, Heart, MapPin, LogOut } from "lucide-react"
import { useStore } from "@/components/store-provider"
import { getProduct, formatPrice } from "@/lib/products"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const demoOrders = [
  {
    id: "YW-10428",
    date: "Mar 12, 2026",
    status: "Delivered",
    total: 830,
    items: ["wool-overcoat", "cotton-tee"],
  },
  {
    id: "YW-10391",
    date: "Feb 28, 2026",
    status: "Shipped",
    total: 210,
    items: ["leather-sneaker"],
  },
]

export default function ProfilePage() {
  const { user, wishlist, logout } = useStore()

  if (!user) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">You&apos;re signed out</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Sign in to view your profile, orders, and saved items.
        </p>
        <div className="mt-8 flex gap-3">
          <Button size="lg" className="h-11 px-6" render={<Link href="/login" />}>
            Sign In
          </Button>
          <Button size="lg" variant="outline" className="h-11 px-6" render={<Link href="/signup" />}>
            Create Account
          </Button>
        </div>
      </div>
    )
  }

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  const savedItems = wishlist.map((id) => getProduct(id)).filter((p) => p !== undefined)

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <Avatar size="lg">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="font-serif text-2xl font-semibold tracking-tight sm:text-3xl">
              {user.name}
            </h1>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <Button variant="outline" onClick={logout}>
          <LogOut className="size-4" /> Sign Out
        </Button>
      </div>

      <Separator className="my-8" />

      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">
            <Package className="size-4" /> Orders
          </TabsTrigger>
          <TabsTrigger value="wishlist">
            <Heart className="size-4" /> Wishlist
          </TabsTrigger>
          <TabsTrigger value="addresses">
            <MapPin className="size-4" /> Addresses
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="mt-6">
          <div className="space-y-4">
            {demoOrders.map((order) => (
              <div key={order.id} className="rounded-md border border-border p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">Order {order.id}</p>
                    <p className="text-xs text-muted-foreground">Placed {order.date}</p>
                  </div>
                  <Badge variant={order.status === "Delivered" ? "secondary" : "default"}>
                    {order.status}
                  </Badge>
                </div>
                <Separator className="my-4" />
                <div className="flex items-center justify-between">
                  <div className="flex -space-x-3">
                    {order.items.map((id) => {
                      const p = getProduct(id)
                      if (!p) return null
                      return (
                        <div
                          key={id}
                          className="relative size-14 overflow-hidden rounded-md border-2 border-background bg-muted"
                        >
                          <Image
                            src={p.image || "/placeholder.svg"}
                            alt={p.name}
                            fill
                            sizes="56px"
                            className="object-cover"
                          />
                        </div>
                      )
                    })}
                  </div>
                  <p className="text-sm font-semibold">{formatPrice(order.total)}</p>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="wishlist" className="mt-6">
          {savedItems.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No saved items yet.{" "}
              <Link href="/products" className="underline underline-offset-4">
                Browse products
              </Link>
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {savedItems.map((p) => (
                <li key={p.id} className="flex items-center gap-4 p-4">
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-muted">
                    <Image
                      src={p.image || "/placeholder.svg"}
                      alt={p.name}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <Link href={`/products/${p.id}`} className="font-medium hover:underline">
                      {p.name}
                    </Link>
                    <p className="text-sm text-muted-foreground">{formatPrice(p.price)}</p>
                  </div>
                  <Button variant="outline" size="sm" render={<Link href={`/products/${p.id}`} />}>
                    View
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="addresses" className="mt-6">
          <div className="rounded-md border border-border p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">Default Address</p>
                <address className="mt-2 text-sm not-italic leading-relaxed text-muted-foreground">
                  {user.name}
                  <br />
                  221B Monochrome Lane
                  <br />
                  New York, NY 10001
                  <br />
                  United States
                </address>
              </div>
              <Badge variant="secondary">Primary</Badge>
            </div>
            <Button variant="outline" className="mt-5">
              Edit Address
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
