import { Leaf, ShieldCheck, Truck, Users } from "lucide-react"

export const metadata = { title: "About Us | YashWorld" }

const values = [
  {
    icon: Leaf,
    title: "Curated Plants",
    text: "Every plant listed on YashWorld comes from verified sellers who care for their stock the way we'd want it cared for.",
  },
  {
    icon: ShieldCheck,
    title: "Buyer Protection",
    text: "7-day returns on eligible orders, order tracking at every stage, and support that actually responds.",
  },
  {
    icon: Truck,
    title: "Reliable Delivery",
    text: "Live courier tracking from pickup to your doorstep, with careful packaging built for live plants.",
  },
  {
    icon: Users,
    title: "Seller-First Marketplace",
    text: "Nurseries and independent growers can list, manage orders, and get paid — without building their own storefront.",
  },
]

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-black sm:text-3xl">About YashWorld</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#444444]">
          YashWorld is a plant-first marketplace connecting buyers with verified nurseries and independent sellers
          across India. From indoor plants and pots to seeds, fertilizers and gardening tools, we bring everything
          a plant lover needs into one dependable place — with real order tracking, secure payments and a genuine
          returns process.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {values.map((v) => (
            <div key={v.title} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <v.icon className="size-5 text-green-700" />
              <h3 className="mt-2 text-sm font-semibold text-black">{v.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-[#666666]">{v.text}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-xl border border-gray-200 bg-[#f7faf7] p-4">
          <h2 className="text-sm font-semibold text-black">Reach Us</h2>
          <p className="mt-1 text-xs leading-relaxed text-[#666666]">
            Samastipur, Bihar – 848125, India
            <br />
            support@yashworld.shop · +91 7209308900
          </p>
        </div>
      </div>
    </main>
  )
}
