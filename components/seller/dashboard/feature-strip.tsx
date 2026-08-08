import Link from "next/link"
import { Leaf, Boxes, Users, IndianRupee, type LucideIcon } from "lucide-react"

interface FeatureItem {
  icon: LucideIcon
  title: string
  description: string
  href: string
}

// Every link points at a real, existing seller route — "New Customers" goes
// to Orders (the only place buyer info actually shows up for a seller,
// since there is no seller-facing customer list/service in this app) rather
// than a fabricated destination.
const ITEMS: FeatureItem[] = [
  { icon: Leaf, title: "Best Selling Plants", description: "Explore your top performing plants", href: "/seller/products" },
  { icon: Boxes, title: "Inventory Overview", description: "Check stock levels and manage inventory", href: "/seller/products" },
  { icon: Users, title: "New Customers", description: "See your latest customer signups", href: "/seller/orders" },
  { icon: IndianRupee, title: "Earnings Overview", description: "Track your income and payouts", href: "/seller/orders#wallet" },
]

export function FeatureStrip() {
  return (
    <div className="grid grid-cols-1 gap-3 rounded-2xl border border-green-100 bg-green-50/60 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4">
      {ITEMS.map((item) => (
        <Link
          key={item.title}
          href={item.href}
          className="flex items-start gap-3 rounded-xl p-2 transition hover:bg-white/70"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-green-700 shadow-sm">
            <item.icon className="size-4.5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">{item.title}</p>
            <p className="mt-0.5 text-xs text-gray-500">{item.description}</p>
          </div>
        </Link>
      ))}
    </div>
  )
}
