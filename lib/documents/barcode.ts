import JsBarcode from "jsbarcode"

/** A Code128 barcode of the AWB (or the order id when no AWB is assigned
 * yet) — for warehouse scanning. Browser-only (builds an off-screen canvas). */
export function generateBarcodeDataUrl(value: string): string {
  const canvas = document.createElement("canvas")
  JsBarcode(canvas, value, { format: "CODE128", displayValue: true, width: 2, height: 60, margin: 10 })
  return canvas.toDataURL("image/png")
}
