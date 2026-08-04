import { PolicyPageLayout, PolicySection } from "@/components/marketplace/policy-page-layout"

export const metadata = { title: "Shipping Policy | YashWorld" }

export default function ShippingPolicyPage() {
  return (
    <PolicyPageLayout title="Shipping Policy" updated="3 August 2026">
      <PolicySection heading="Delivery Coverage">
        <p>
          YashWorld sellers ship across India through partnered courier services. Delivery timelines depend on the
          seller's location and your delivery address, and are shown at checkout before you place an order.
        </p>
      </PolicySection>

      <PolicySection heading="Shipping Charges">
        <p>
          Orders above ₹250 ship free. Orders below this amount may include a small shipping charge, shown clearly
          in your cart before checkout.
        </p>
      </PolicySection>

      <PolicySection heading="Order Tracking">
        <p>
          Once a seller ships your order, you'll get courier and tracking details on your Orders page, with live
          status updates as the package moves — Packed, Picked Up, In Transit, Out For Delivery and Delivered.
        </p>
      </PolicySection>

      <PolicySection heading="Live Plant Packaging">
        <p>
          Plants are packed by sellers using breathable, moisture-safe packaging designed to keep them healthy in
          transit. If a plant arrives visibly damaged, report it from your Orders page within 48 hours of delivery
          for a replacement or refund.
        </p>
      </PolicySection>

      <PolicySection heading="Delays">
        <p>
          Occasional delays can happen due to weather, courier disruptions or remote delivery locations. You can
          always check the latest status from your Orders page, or contact us if a shipment seems stuck.
        </p>
      </PolicySection>

      <PolicySection heading="Contact">
        <p>
          For shipping questions, reach us at support@yashworld.shop or through our{" "}
          <a href="/contact" className="text-green-700 underline">
            Contact page
          </a>
          .
        </p>
      </PolicySection>
    </PolicyPageLayout>
  )
}
