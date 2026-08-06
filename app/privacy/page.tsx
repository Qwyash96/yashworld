import { PolicyPageLayout, PolicySection } from "@/components/marketplace/policy-page-layout"

export const metadata = { title: "Privacy Policy | IXOFLORA" }

export default function PrivacyPage() {
  return (
    <PolicyPageLayout title="Privacy Policy" updated="3 August 2026">
      <p>
        IXOFLORA ("we", "us") operates the marketplace at yashworld.shop. This policy explains what information we
        collect from buyers and sellers, why we collect it, and how it's used.
      </p>

      <PolicySection heading="Information We Collect">
        <p>
          Account details (name, email, phone number) when you sign up; delivery addresses you save to your
          profile; order and payment history; and product listings, seller documents and payout details submitted
          by sellers during onboarding.
        </p>
      </PolicySection>

      <PolicySection heading="How We Use It">
        <ul className="list-inside list-disc space-y-1">
          <li>To process orders, deliveries, refunds and payouts.</li>
          <li>To verify seller identity and prevent fraud on the marketplace.</li>
          <li>To send order updates, delivery notifications and support responses.</li>
          <li>To improve search, recommendations and the shopping experience.</li>
        </ul>
      </PolicySection>

      <PolicySection heading="Payment Information">
        <p>
          Card, UPI, net banking, wallet and EMI payments are processed by our payment processing partners
          (which may include Razorpay, Cashfree, PhonePe, PayU, Stripe and PayPal); IXOFLORA does not store your
          full card or bank details on its own servers. Cash on Delivery orders are settled at the time of delivery.
        </p>
      </PolicySection>

      <PolicySection heading="Sharing With Sellers &amp; Couriers">
        <p>
          When you place an order, the seller fulfilling it and the courier partner delivering it receive the
          delivery address and contact details needed to complete the shipment — nothing more.
        </p>
      </PolicySection>

      <PolicySection heading="Your Choices">
        <p>
          You can review and update your saved addresses and account details from your Profile at any time, or
          contact us to request deletion of your account data, subject to records we're legally required to keep
          (such as order and tax records).
        </p>
      </PolicySection>

      <PolicySection heading="Contact">
        <p>
          Questions about this policy can be sent to support@yashworld.shop or through our{" "}
          <a href="/contact" className="text-green-700 underline">
            Contact page
          </a>
          .
        </p>
      </PolicySection>
    </PolicyPageLayout>
  )
}
