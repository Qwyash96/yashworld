"use client"

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { toast } from "sonner"
import { type Product } from "@/lib/products"
import { logoutUser, onAuthChange } from "@/services/auth.service"
import { getProductCatalog } from "@/services/catalog.service"
import { getUserProfile } from "@/services/user.service"

export type CartItem = {
  id: string
  size: string
  color: string
  quantity: number
}

export type User = {
  uid: string
  name: string
  email: string
  photoUrl?: string
}

type StoreContextValue = {
  cart: CartItem[]
  wishlist: string[]
  compare: string[]
  user: User | null
  cartCount: number
  cartSubtotal: number
  getProductById: (id: string) => Product | undefined
  addToCart: (product: Product, size: string, color: string, quantity?: number) => void
  updateQuantity: (id: string, size: string, color: string, quantity: number) => void
  removeFromCart: (id: string, size: string, color: string) => void
  clearCart: () => void
  toggleWishlist: (product: Product) => void
  isWishlisted: (id: string) => boolean
  toggleCompare: (product: Product) => void
  isCompared: (id: string) => boolean
  clearCompare: () => void
  recentlyViewed: string[]
  recordProductView: (id: string) => void
  logout: () => void
}

const StoreContext = createContext<StoreContextValue | null>(null)

const CART_KEY = "yashworld.cart"
const WISH_KEY = "yashworld.wishlist"
const COMPARE_KEY = "yashworld.compare"
const RECENTLY_VIEWED_KEY = "yashworld.recentlyViewed"
const MAX_COMPARE = 4
const MAX_RECENTLY_VIEWED = 20

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([])
  const [wishlist, setWishlist] = useState<string[]>([])
  const [compare, setCompare] = useState<string[]>([])
  const [recentlyViewed, setRecentlyViewed] = useState<string[]>([])
  const [user, setUser] = useState<User | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [catalog, setCatalog] = useState<Product[]>([])

  useEffect(() => {
    setCart(readStorage<CartItem[]>(CART_KEY, []))
    setWishlist(readStorage<string[]>(WISH_KEY, []))
    setCompare(readStorage<string[]>(COMPARE_KEY, []))
    setRecentlyViewed(readStorage<string[]>(RECENTLY_VIEWED_KEY, []))
    setHydrated(true)
  }, [])

  useEffect(() => {
    // Firestore-first with automatic fallback to lib/products.ts — see
    // services/catalog.service.ts. Fetched once per session so cart/wishlist/
    // profile can resolve an item id to a product regardless of which
    // source it actually came from.
    getProductCatalog().then(setCatalog)
  }, [])

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(CART_KEY, JSON.stringify(cart))
  }, [cart, hydrated])

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(WISH_KEY, JSON.stringify(wishlist))
  }, [wishlist, hydrated])

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(COMPARE_KEY, JSON.stringify(compare))
  }, [compare, hydrated])

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(recentlyViewed))
  }, [recentlyViewed, hydrated])

  useEffect(() => {
    const unsubscribe = onAuthChange((firebaseUser) => {
      setUser(
        firebaseUser
          ? {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "",
              email: firebaseUser.email || "",
              photoUrl: firebaseUser.photoURL || undefined,
            }
          : null,
      )

      // A banned/suspended account's Firebase Auth sign-in is disabled
      // server-side too (see app/api/admin/users/[uid]/{ban,suspend}), but
      // that only takes effect on the next token refresh (up to ~1hr) —
      // check the Firestore flag immediately so an already-open session
      // doesn't keep working in the meantime.
      if (firebaseUser) {
        getUserProfile(firebaseUser.uid)
          .then((profile) => {
            if (profile?.status === "suspended" || profile?.status === "banned") {
              toast.error("Your account has been " + profile.status + ". Contact support if you believe this is a mistake.")
              logoutUser()
            }
          })
          .catch(() => {})
      }
    })
    return unsubscribe
  }, [])

  const value = useMemo<StoreContextValue>(() => {
    const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0)
    const cartSubtotal = cart.reduce((sum, item) => {
      const product = catalog.find((p) => p.id === item.id)
      return sum + (product ? product.price * item.quantity : 0)
    }, 0)

    return {
      cart,
      wishlist,
      compare,
      recentlyViewed,
      user,
      cartCount,
      cartSubtotal,
      getProductById: (id) => catalog.find((p) => p.id === id),
      addToCart: (product, size, color, quantity = 1) => {
        setCart((prev) => {
          const existing = prev.find(
            (i) => i.id === product.id && i.size === size && i.color === color,
          )
          if (existing) {
            return prev.map((i) =>
              i === existing ? { ...i, quantity: i.quantity + quantity } : i,
            )
          }
          return [...prev, { id: product.id, size, color, quantity }]
        })
        toast.success("Added to bag", { description: product.name })
      },
      updateQuantity: (id, size, color, quantity) => {
        setCart((prev) =>
          prev
            .map((i) =>
              i.id === id && i.size === size && i.color === color
                ? { ...i, quantity: Math.max(1, quantity) }
                : i,
            )
            .filter((i) => i.quantity > 0),
        )
      },
      removeFromCart: (id, size, color) => {
        setCart((prev) =>
          prev.filter((i) => !(i.id === id && i.size === size && i.color === color)),
        )
      },
      clearCart: () => setCart([]),
      toggleWishlist: (product) => {
        setWishlist((prev) => {
          if (prev.includes(product.id)) {
            toast("Removed from wishlist", { description: product.name })
            return prev.filter((id) => id !== product.id)
          }
          toast.success("Saved to wishlist", { description: product.name })
          return [...prev, product.id]
        })
      },
      isWishlisted: (id) => wishlist.includes(id),
      toggleCompare: (product) => {
        setCompare((prev) => {
          if (prev.includes(product.id)) {
            return prev.filter((id) => id !== product.id)
          }
          if (prev.length >= MAX_COMPARE) {
            toast.error(`You can compare up to ${MAX_COMPARE} products at a time.`)
            return prev
          }
          toast.success("Added to compare", { description: product.name })
          return [...prev, product.id]
        })
      },
      isCompared: (id) => compare.includes(id),
      clearCompare: () => setCompare([]),
      recordProductView: (id) => {
        setRecentlyViewed((prev) => [id, ...prev.filter((existing) => existing !== id)].slice(0, MAX_RECENTLY_VIEWED))
      },
      logout: async () => {
        await logoutUser()
        toast("Signed out")
      },
    }
  }, [cart, wishlist, compare, recentlyViewed, user, catalog])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error("useStore must be used within StoreProvider")
  return ctx
}
