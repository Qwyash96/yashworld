import QRCode from "qrcode"

/** A QR code encoding a link back to this order — for a courier or the
 * seller's own warehouse app to scan straight through to the order record. */
export async function generateOrderQrCodeDataUrl(orderId: string): Promise<string> {
  const origin = typeof window !== "undefined" ? window.location.origin : ""
  const trackingText = `${origin}/orders/${orderId}`
  return QRCode.toDataURL(trackingText, { width: 300, margin: 1 })
}
