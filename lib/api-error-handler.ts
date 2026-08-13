import "server-only"
import { NextResponse, type NextRequest } from "next/server"

/**
 * Wraps a route handler so an uncaught exception (a Firestore hiccup, a
 * malformed document, a transient network error — none of it validation,
 * which every route already returns as its own clean 400/403/404) becomes
 * a real `{ error }` JSON response instead of propagating out of the
 * handler. An unhandled throw from a Route Handler doesn't crash the
 * server, but Next's own fallback response isn't guaranteed JSON — a
 * client doing `const body = await response.json()` then throws a second,
 * more confusing error instead of surfacing the real one via
 * `toast.error(result.error)`.
 *
 * Logged server-side either way, since a 500 here means something
 * genuinely unexpected happened, not a user input mistake.
 */
export function withApiErrorHandling<Args extends unknown[]>(
  routeName: string,
  handler: (request: NextRequest, ...args: Args) => Promise<NextResponse>,
) {
  return async (request: NextRequest, ...args: Args): Promise<NextResponse> => {
    try {
      return await handler(request, ...args)
    } catch (error) {
      console.error(`[api:${routeName}]`, error)
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Something went wrong. Please try again." },
        { status: 500 },
      )
    }
  }
}
