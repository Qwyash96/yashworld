import { PolicyPageLayout, PolicySection } from "@/components/marketplace/policy-page-layout"

export const metadata = { title: "Refund Policy | IXOFLORA" }

export default function RefundPolicyPage() {
  return (
    <PolicyPageLayout title="Refund &amp; Returns Policy" updated="3 August 2026">
      <PolicySection heading="7-Day Return Window">
        <p>
          Most items on IXOFLORA — including live plants, pots, tools and accessories — can be returned within{" "}
          <strong>7 days of delivery</strong>. The return request must be raised from your Orders page within this
          window; requests raised after 7 days from delivery cannot be accepted.
        </p>
      </PolicySection>

      <PolicySection heading="Eligibility">
        <ul className="list-inside list-disc space-y-1">
          <li>The plant or product must be unused and in its original condition.</li>
          <li>Live plants must show no sign of damage caused after delivery.</li>
          <li>Seeds and fertilizers can only be returned if the seal is unopened.</li>
        </ul>
      </PolicySection>

      <PolicySection heading="Damaged or Wrong Item">
        <p>
          If your order arrives damaged, defective, or different from what you ordered, report it with photos from
          your Orders page as soon as possible — these cases are prioritized and typically resolved with a
          replacement or full refund after the seller confirms the issue.
        </p>
      </PolicySection>

      <PolicySection heading="How Refunds Are Processed">
        <p>
          Once a return is picked up and inspected, approved refunds are issued to your original payment method
          (Razorpay) within a few business days, or adjusted against the amount collected if the order was placed
          Cash on Delivery. You can track the status of every return and refund from your Orders page.
        </p>
      </PolicySection>

      <PolicySection heading="Non-Returnable Cases">
        <p>
          Live plants cannot be returned once repotted or planted, and no warranty is offered on live plants beyond
          the 7-day healthy-arrival guarantee. Custom or made-to-order items are also non-returnable unless
          received damaged.
        </p>
      </PolicySection>

      <PolicySection heading="Need Help?">
        <p>
          Reach us at support@yashworld.shop or via our{" "}
          <a href="/contact" className="text-green-700 underline">
            Contact page
          </a>{" "}
          for anything not covered here.
        </p>
      </PolicySection>
    </PolicyPageLayout>
  )
}
