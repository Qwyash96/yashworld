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
import { products, type Product } from "@/lib/products"

export type CartItem = {
  id: string
  size: string
  color: string
  quantity: number
}

export type User = {
  name: string
  email: string
}

type StoreContextValue = {
  cart: CartItem[]
  wishlist: string[]
  user: User | null
  cartCount: number
  cartSubtotal: number
  addToCart: (product: Product, size: string, color: string, quantity?: number) => void
  updateQuantity: (id: string, size: string, color: string, quantity: number) => void
  removeFromCart: (id: string, size: string, color: string) => void
  clearCart: () => void
  toggleWishlist: (product: Product) => void
  isWishlisted: (id: string) => boolean
  login: (email: string, name?: string) => void
  signup: (name: string, email: string) => void
  logout: () => void
}

const StoreContext = createContext<StoreContextValue | null>(null)

const CART_KEY = "yashworld.cart"
const WISH_KEY = "yashworld.wishlist"
const USER_KEY = "yashworld.user"

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
  const [user, setUser] = useState<User | null>(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setCart(readStorage<CartItem[]>(CART_KEY, []))
    setWishlist(readStorage<string[]>(WISH_KEY, []))
    setUser(readStorage<User | null>(USER_KEY, null))
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(CART_KEY, JSON.stringify(cart))
  }, [cart, hydrated])

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(WISH_KEY, JSON.stringify(wishlist))
  }, [wishlist, hydrated])

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(USER_KEY, JSON.stringify(user))
  }, [user, hydrated])

  const value = useMemo<StoreContextValue>(() => {
    const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0)
    const cartSubtotal = cart.reduce((sum, item) => {
      const product = products.find((p) => p.id === item.id)
      return sum + (product ? product.price * item.quantity : 0)
    }, 0)

    return {
      cart,
      wishlist,
      user,
      cartCount,
      cartSubtotal,
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
      login: (email, name) => {
        const displayName = name ?? email.split("@")[0]
        setUser({ name: displayName, email })
        toast.success("Welcome back", { description: email })
      },
      signup: (name, email) => {
        setUser({ name, email })
        toast.success("Account created", { description: `Welcome, ${name}` })
      },
      logout: () => {
        setUser(null)
        toast("Signed out")
      },
    }
  }, [cart, wishlist, user])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error("useStore must be used within StoreProvider")
  return ctx
}
