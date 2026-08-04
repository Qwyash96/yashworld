"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Menu, ShieldAlert } from "lucide-react"
import { AdminSidebar, AdminSidebarContent, getPermissionForPath } from "@/components/admin/admin-sidebar"
import { AdminAuthContext, type AdminProfile } from "@/components/admin/admin-auth-context"
import { onAuthChange } from "@/services/auth.service"
import { getUserProfile } from "@/services/user.service"
import { hasPermission, isAdminRole, type AdminPermission } from "@/lib/admin-roles"
import { DEV_SHOW_ADMIN_MENU_TO_ALL } from "@/lib/dev-flags"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

/**
 * Delegates to components/admin/admin-sidebar.tsx's getPermissionForPath —
 * the SAME data the sidebar uses to decide what to show — instead of a
 * separately hand-maintained list. That second list (now removed) was the
 * actual bug behind "sidebar shows a section but the page denies access":
 * it only covered /admin/staff, /admin/products, /admin/sellers and
 * /admin/support, so every other real page (campaigns, coupons, banners,
 * settings/*) silently fell back to requiring "admin_management"
 * (super_admin-only) no matter what the sidebar — correctly — said a role
 * could reach.
 */
function getRequiredPermission(pathname: string): AdminPermission | null {
  const permission = getPermissionForPath(pathname)
  if (permission === null) return null // dashboard root — any admin role may land here
  // undefined = not registered in adminSections at all: secure default,
  // same as the old fallback, for any future page that forgets to add
  // itself to the sidebar config.
  return permission ?? "admin_management"
}

// Routes that render outside the authenticated admin shell — the layout
// must not gate these, or a signed-out/denied visitor could never reach them.
const PUBLIC_ADMIN_ROUTES = ["/admin/login", "/admin/access-denied"]

type GateState = "loading" | "ready"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const isPublicRoute = PUBLIC_ADMIN_ROUTES.includes(pathname)
  const [state, setState] = useState<GateState>("loading")
  const [admin, setAdmin] = useState<AdminProfile | null>(null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    if (isPublicRoute) return

    let cancelled = false
    setState("loading")

    const unsubscribe = onAuthChange(async (firebaseUser) => {
      if (cancelled) return

      if (!firebaseUser) {
        // eslint-disable-next-line no-console
        console.log("[admin-gate] no Firebase Auth user at all — redirecting to /admin/login")
        router.replace("/admin/login")
        return
      }

      const docPath = `users/${firebaseUser.uid}`
      // eslint-disable-next-line no-console
      console.log("[admin-gate] authenticated uid:", firebaseUser.uid, "email:", firebaseUser.email)
      // eslint-disable-next-line no-console
      console.log("[admin-gate] Firestore document path used:", docPath)

      try {
        const profile = await getUserProfile(firebaseUser.uid)
        if (cancelled) return

        // eslint-disable-next-line no-console
        console.log("[admin-gate] loaded profile:", profile ? JSON.stringify(profile) : "null (no document at this path)")
        // eslint-disable-next-line no-console
        console.log("[admin-gate] loaded role:", profile?.role ?? "(none)")

        if (!profile) {
          // eslint-disable-next-line no-console
          console.log(
            `[admin-gate] DENIED — no Firestore document exists at ${docPath} for this authenticated uid. ` +
              "The role shown correct elsewhere (e.g. via an Admin SDK script) belongs to whatever uid that check " +
              "used — if it doesn't match the uid printed above, this browser is signed in as a different account.",
          )
          const params = new URLSearchParams({
            uid: firebaseUser.uid,
            email: firebaseUser.email ?? "",
            docPath,
            role: "none",
            reason: "no_profile_at_this_uid",
          })
          router.replace(`/admin/access-denied?${params.toString()}`)
          return
        }

        if (profile.status === "suspended" || profile.status === "banned") {
          // eslint-disable-next-line no-console
          console.log(`[admin-gate] DENIED — account status "${profile.status}" at ${docPath}.`)
          const params = new URLSearchParams({
            uid: firebaseUser.uid,
            email: firebaseUser.email ?? "",
            docPath,
            role: profile.role,
            reason: "account_" + profile.status,
          })
          router.replace(`/admin/access-denied?${params.toString()}`)
          return
        }

        if (!DEV_SHOW_ADMIN_MENU_TO_ALL && !isAdminRole(profile.role)) {
          // eslint-disable-next-line no-console
          console.log(`[admin-gate] DENIED — role "${profile.role}" at ${docPath} is not an admin role.`)
          const params = new URLSearchParams({
            uid: firebaseUser.uid,
            email: firebaseUser.email ?? "",
            docPath,
            role: profile.role,
            reason: "role_not_admin",
          })
          router.replace(`/admin/access-denied?${params.toString()}`)
          return
        }
        if (DEV_SHOW_ADMIN_MENU_TO_ALL && !isAdminRole(profile.role)) {
          // eslint-disable-next-line no-console
          console.log(
            `[admin-gate] DEV BYPASS — role "${profile.role}" is not an admin role, but ` +
              "DEV_SHOW_ADMIN_MENU_TO_ALL is on, so entry is allowed anyway. Backend API calls will still 403.",
          )
        }

        // eslint-disable-next-line no-console
        console.log(`[admin-gate] ALLOWED — role "${profile.role}" at ${docPath} is an admin role. Sidebar will render.`)

        setAdmin({
          uid: firebaseUser.uid,
          name: profile.name,
          email: profile.email,
          role: profile.role,
        })
        setState("ready")
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("[admin-gate] DENIED — error while loading profile:", error)
        if (!cancelled) {
          const params = new URLSearchParams({
            uid: firebaseUser.uid,
            email: firebaseUser.email ?? "",
            docPath,
            role: "error",
            reason: "profile_lookup_threw",
          })
          router.replace(`/admin/access-denied?${params.toString()}`)
        }
      }
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [isPublicRoute, pathname, router])

  if (isPublicRoute) return <>{children}</>

  if (state === "loading" || !admin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-[#444444]">Checking admin access...</p>
      </div>
    )
  }

  const requiredPermission = getRequiredPermission(pathname)

  // Explicit, not just implied by hasPermission's short-circuit: super_admin
  // always passes this gate, on every route, full stop.
  // DEV_SHOW_ADMIN_MENU_TO_ALL (see lib/dev-flags.ts): frontend-only, temporary —
  // module content renders for anyone; actual mutations still 403 server-side.
  const allowed =
    DEV_SHOW_ADMIN_MENU_TO_ALL ||
    admin.role === "super_admin" ||
    requiredPermission === null ||
    (isAdminRole(admin.role) && hasPermission(admin.role, requiredPermission))

  return (
    <AdminAuthContext.Provider value={admin}>
      {/* Mobile-only hamburger — opens the SAME AdminSidebarContent the desktop
          <aside> uses. This is the only nav trigger inside /admin; there is
          no other component left that could open a different menu. */}
      <div className="flex items-center gap-3 border-b border-border bg-white px-4 py-3 lg:hidden">
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetTrigger
            aria-label="Open admin menu"
            className="rounded-xl border border-border p-2 text-black"
          >
            <Menu className="size-5" />
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Admin Menu</SheetTitle>
            </SheetHeader>
            <AdminSidebarContent onNavigate={() => setMobileNavOpen(false)} />
          </SheetContent>
        </Sheet>
        <span className="text-sm font-bold text-green-700">YashWorld Admin</span>
      </div>

      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:px-8">
        <AdminSidebar />
        <main className="min-w-0 flex-1">{allowed ? children : <ModuleAccessDenied />}</main>
      </div>
    </AdminAuthContext.Provider>
  )
}

function ModuleAccessDenied() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-2xl border border-border bg-white p-10 text-center shadow-sm">
      <div className="flex size-16 items-center justify-center rounded-full bg-red-50">
        <ShieldAlert className="size-8 text-red-600" />
      </div>
      <h1 className="mt-6 text-xl font-bold text-black">You don&apos;t have access to this section.</h1>
      <p className="mt-3 max-w-md text-sm text-[#444444]">
        Your role doesn&apos;t include this module. Use the sidebar to go to a section you have
        access to, or contact a Super Admin if you believe this is a mistake.
      </p>
    </div>
  )
}
