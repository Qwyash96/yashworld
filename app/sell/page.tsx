"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Truck, Users, Wallet, LayoutDashboard } from "lucide-react"
import { useStore } from "@/components/store-provider"
import { getSellerApplication } from "@/services/seller.service"

const benefits = [
  {
    icon: Users,
    title: "Reach Thousands of Plant Lovers",
    description: "List your products in front of a growing community of home & garden shoppers.",
  },
  {
    icon: Wallet,
    title: "Fast, Reliable Payouts",
    description: "Track your earnings and get paid on a simple, transparent payout schedule.",
  },
  {
    icon: Truck,
    title: "Easy Order Fulfilment",
    description: "Manage orders, shipping and returns from one clean seller dashboard.",
  },
  {
    icon: LayoutDashboard,
    title: "Powerful Seller Dashboard",
    description: "Track products, orders, earnings and performance analytics in one place.",
  },
]

export default function BecomeASellerPage() {
  const { user } = useStore()
  const [hasApplication, setHasApplication] = useState(false)

  useEffect(() => {
    if (user) getSellerApplication(user.uid).then((application) => setHasApplication(!!application))
  }, [user])

  const ctaHref = !user ? "/login" : hasApplication ? "/seller/products" : "/sell/register"
  const ctaLabel = !user
    ? "Log In to Become a Seller"
    : hasApplication
      ? "Go to Seller Dashboard"
      : "Register as a Seller"

  return (
    <div className="bg-white">
      <section className="bg-[#f3f5f2] px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <span className="inline-block rounded-full bg-green-100 px-5 py-2 text-sm font-semibold uppercase tracking-widest text-green-700">
            Sell on YashWorld
          </span>
          <h1 className="mt-6 text-4xl font-bold text-black sm:text-5xl">
            Grow Your Plant Business With Us
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-[#444444]">
            Join YashWorld&apos;s seller community and bring your plants, pots and gardening
            essentials to customers across the country.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              href={ctaHref}
              className="rounded-xl bg-green-600 px-8 py-4 font-semibold text-white shadow-lg transition hover:bg-green-700"
            >
              {ctaLabel}
            </Link>
          </div>
          {!user && (
            <p className="mt-4 text-sm text-[#444444]">
              New to YashWorld?{" "}
              <Link href="/signup" className="font-medium text-green-700 hover:underline">
                Create a buyer account
              </Link>{" "}
              first — every seller starts as a YashWorld buyer.
            </p>
          )}
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-bold text-black">Why Sell on YashWorld?</h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map((benefit) => {
              const Icon = benefit.icon
              return (
                <div
                  key={benefit.title}
                  className="rounded-3xl border border-border bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-green-50">
                    <Icon className="size-6 text-green-700" />
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-black">{benefit.title}</h3>
                  <p className="mt-2 text-sm text-[#444444]">{benefit.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="bg-green-700 px-4 py-16 text-center sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-white">Ready to start selling?</h2>
        <p className="mx-auto mt-3 max-w-xl text-green-50">
          Registration takes just a few minutes. Complete your KYC and our team will review your
          application.
        </p>
        <Link
          href={ctaHref}
          className="mt-8 inline-block rounded-xl bg-white px-8 py-4 font-semibold text-green-700 shadow-lg transition hover:bg-green-50"
        >
          {ctaLabel}
        </Link>
      </section>
    </div>
  )
}
