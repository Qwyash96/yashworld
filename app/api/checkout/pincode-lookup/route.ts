import { NextResponse, type NextRequest } from "next/server"

const PINCODE_API_BASE = "https://api.postalpincode.in/pincode/"
const FETCH_TIMEOUT_MS = 6000

interface PostOffice {
  Name: string
  District: string
  State: string
}
interface PincodeApiResponse {
  Status: string
  PostOffice: PostOffice[] | null
}

/**
 * Public, unauthenticated — the checkout address form's PIN-code auto-fill
 * (India Post's free public pincode API, no key required). Proxied
 * server-side rather than called directly from the browser so the checkout
 * page doesn't depend on that third party's CORS headers, and so there's
 * one place to swap providers or add a key later without a frontend change.
 *
 * Always resolves to a 200 with an `ok` flag — a bad/unknown PIN code or an
 * upstream failure is a normal "not found" outcome here, never a 5xx, so the
 * checkout page never has to special-case HTTP errors to stay non-blocking.
 */
export async function GET(request: NextRequest) {
  const pincode = new URL(request.url).searchParams.get("pincode")?.trim() ?? ""
  if (!/^\d{6}$/.test(pincode)) {
    return NextResponse.json({ ok: false, error: "Enter a valid 6-digit PIN code." })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(`${PINCODE_API_BASE}${pincode}`, { signal: controller.signal })
    if (!response.ok) {
      return NextResponse.json({ ok: false, error: "PIN code lookup is temporarily unavailable." })
    }

    const data = (await response.json()) as PincodeApiResponse[]
    const result = data[0]
    if (!result || result.Status !== "Success" || !result.PostOffice || result.PostOffice.length === 0) {
      return NextResponse.json({ ok: false, error: "We couldn't find that PIN code — please enter your address manually." })
    }

    const first = result.PostOffice[0]!
    const areas = Array.from(new Set(result.PostOffice.map((po) => po.Name).filter(Boolean)))
    return NextResponse.json({ ok: true, city: first.District, state: first.State, areas })
  } catch {
    return NextResponse.json({ ok: false, error: "PIN code lookup is temporarily unavailable." })
  } finally {
    clearTimeout(timeout)
  }
}
