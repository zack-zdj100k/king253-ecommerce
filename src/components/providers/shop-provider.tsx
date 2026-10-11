"use client"

import * as React from "react"

import {
  addToCartAction,
  getCartAction,
  removeFromCartAction,
  setCartQuantityAction,
  setWishlistItemAction,
  syncWishlistAction,
  type CartState,
} from "@/app/actions/shop"

type Result = { ok: true } | { ok: false; error: string }

type ShopContextValue = {
  cart: CartState
  cartReady: boolean
  pending: boolean
  addToCart: (variantId: string, quantity?: number) => Promise<Result>
  setQuantity: (variantId: string, quantity: number) => Promise<Result>
  removeFromCart: (variantId: string) => Promise<Result>
  refreshCart: () => Promise<void>
  cartOpen: boolean
  setCartOpen: (open: boolean) => void
  wishlist: string[]
  toggleWishlist: (productId: string) => void
  /** Product slug shown in the quick-view dialog. */
  quickView: string | null
  setQuickView: (slug: string | null) => void
  recentlyViewed: string[]
  pushRecentlyViewed: (slug: string) => void
  notice: { text: string; tone: "ok" | "error" } | null
  notify: (text: string, tone?: "ok" | "error") => void
}

const ShopContext = React.createContext<ShopContextValue | null>(null)

const WISHLIST_KEY = "king253.wishlist.v2"
const RECENT_KEY = "king253.recent"
const MAX_RECENT = 12
const UUID = /^[0-9a-f-]{36}$/i

const EMPTY_CART: CartState = { lines: [], count: 0, subtotal: 0, hasIssues: false }

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage blocked — keep state in memory.
  }
}

export function ShopProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = React.useState<CartState>(EMPTY_CART)
  const [cartReady, setCartReady] = React.useState(false)
  const [pending, startTransition] = React.useTransition()
  const [cartOpen, setCartOpen] = React.useState(false)
  const [wishlist, setWishlist] = React.useState<string[]>([])
  const [signedIn, setSignedIn] = React.useState(false)
  const [quickView, setQuickView] = React.useState<string | null>(null)
  const [recentlyViewed, setRecentlyViewed] = React.useState<string[]>([])
  const [notice, setNotice] = React.useState<ShopContextValue["notice"]>(null)
  const noticeTimer = React.useRef<number | null>(null)

  const notify = React.useCallback((text: string, tone: "ok" | "error" = "ok") => {
    setNotice({ text, tone })
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current)
    noticeTimer.current = window.setTimeout(() => setNotice(null), 4000)
  }, [])

  // Load the server-side bag and local wishlist after mount.
  React.useEffect(() => {
    let alive = true
    getCartAction()
      .then((state) => alive && setCart(state))
      .finally(() => alive && setCartReady(true))

    const local = read<string[]>(WISHLIST_KEY, []).filter((id) => UUID.test(id))
    /* eslint-disable react-hooks/set-state-in-effect -- one-time sync from localStorage */
    setWishlist(local)
    setRecentlyViewed(read<string[]>(RECENT_KEY, []).slice(0, MAX_RECENT))
    /* eslint-enable react-hooks/set-state-in-effect */
    syncWishlistAction(local).then((serverIds) => {
      if (!alive || !serverIds) return
      setSignedIn(true)
      setWishlist(serverIds)
      write(WISHLIST_KEY, serverIds)
    })
    return () => {
      alive = false
    }
  }, [])

  const run = React.useCallback(
    async (action: () => Promise<{ ok: true; data: CartState } | { ok: false; error: string }>, success?: string): Promise<Result> => {
      const result = await action()
      if (result.ok) {
        startTransition(() => setCart(result.data))
        if (success) notify(success)
        return { ok: true }
      }
      notify(result.error, "error")
      // Re-sync in case availability changed underneath us.
      getCartAction().then(setCart)
      return { ok: false, error: result.error }
    },
    [notify]
  )

  const addToCart = React.useCallback(
    async (variantId: string, quantity = 1) => {
      const result = await run(() => addToCartAction(variantId, quantity), "Added to your bag")
      if (result.ok) setCartOpen(true)
      return result
    },
    [run]
  )
  const setQuantity = React.useCallback((variantId: string, quantity: number) => run(() => setCartQuantityAction(variantId, quantity)), [run])
  const removeFromCart = React.useCallback((variantId: string) => run(() => removeFromCartAction(variantId)), [run])

  const refreshCart = React.useCallback(async () => {
    setCart(await getCartAction())
  }, [])

  const toggleWishlist = React.useCallback(
    (productId: string) => {
      const saved = !wishlist.includes(productId)
      const next = saved ? [productId, ...wishlist] : wishlist.filter((id) => id !== productId)
      setWishlist(next)
      write(WISHLIST_KEY, next)
      if (signedIn) setWishlistItemAction(productId, saved).catch(() => {})
      notify(saved ? "Saved to your wishlist" : "Removed from your wishlist")
    },
    [wishlist, signedIn, notify]
  )

  const pushRecentlyViewed = React.useCallback((slug: string) => {
    setRecentlyViewed((prev) => {
      const next = [slug, ...prev.filter((s) => s !== slug)].slice(0, MAX_RECENT)
      write(RECENT_KEY, next)
      return next
    })
  }, [])

  const value = React.useMemo<ShopContextValue>(
    () => ({
      cart,
      cartReady,
      pending,
      addToCart,
      setQuantity,
      removeFromCart,
      refreshCart,
      cartOpen,
      setCartOpen,
      wishlist,
      toggleWishlist,
      quickView,
      setQuickView,
      recentlyViewed,
      pushRecentlyViewed,
      notice,
      notify,
    }),
    [cart, cartReady, pending, addToCart, setQuantity, removeFromCart, refreshCart, cartOpen, wishlist, toggleWishlist, quickView, recentlyViewed, pushRecentlyViewed, notice, notify]
  )

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>
}

export function useShop() {
  const ctx = React.useContext(ShopContext)
  if (!ctx) throw new Error("useShop must be used inside <ShopProvider>")
  return ctx
}
