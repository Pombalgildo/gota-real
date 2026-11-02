'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartItem, Customer, Product, User } from '@/lib/types'

export type AppMode = 'cliente' | 'central' | 'motoboy'
export type CustomerTab = 'inicio' | 'produtos' | 'pedidos' | 'feedback' | 'perfil'
/** Abas da Central (pedidos/mensagens/relatórios/loja/perfis/ajustes) — controladas
 *  para que o alarme possa levar a equipa directo ao aviso. */
export type CentralTab = 'pedidos' | 'feedback' | 'relatorios' | 'produtos' | 'perfis' | 'ajustes'

export interface AuthSession {
  token: string
  user: User
}

interface AppState {
  // sessão de entrada (login por perfil)
  auth: AuthSession | null
  customer: Customer | null
  mode: AppMode
  courierId: string | null

  // navegação
  tab: CustomerTab
  centralTab: CentralTab
  checkoutOpen: boolean
  trackingOrderId: string | null

  // carrinho
  cart: CartItem[]

  // acções
  setAuth: (a: AuthSession | null) => void
  setCustomer: (c: Customer | null) => void
  setMode: (m: AppMode) => void
  setCourierId: (id: string | null) => void
  setTab: (t: CustomerTab) => void
  setCentralTab: (t: CentralTab) => void
  setCheckoutOpen: (open: boolean) => void
  openTracking: (orderId: string | null) => void
  // termina a sessão e limpa o estado deste dispositivo
  logout: () => void

  addToCart: (product: Product, qty?: number) => void
  removeFromCart: (productId: string) => void
  setCartQuantity: (productId: string, qty: number) => void
  clearCart: () => void
  // actualiza os dados do carrinho quando o administrador muda
  // preços, fotos ou disponibilidade dos artigos na loja
  syncCartProducts: (products: Product[]) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      auth: null,
      customer: null,
      mode: 'cliente',
      courierId: null,
      tab: 'inicio',
      centralTab: 'pedidos',
      checkoutOpen: false,
      trackingOrderId: null,
      cart: [],

      setAuth: (auth) => set({ auth }),
      setCustomer: (customer) => set({ customer }),
      setMode: (mode) => set({ mode }),
      setCourierId: (courierId) => set({ courierId }),
      setTab: (tab) => set({ tab }),
      setCentralTab: (centralTab) => set({ centralTab }),
      setCheckoutOpen: (checkoutOpen) => set({ checkoutOpen }),
      openTracking: (trackingOrderId) =>
        set({ trackingOrderId, tab: trackingOrderId ? 'pedidos' : 'inicio' }),
      logout: () =>
        set({
          auth: null,
          customer: null,
          mode: 'cliente',
          courierId: null,
          tab: 'inicio',
          centralTab: 'pedidos',
          checkoutOpen: false,
          trackingOrderId: null,
          cart: [],
        }),

      addToCart: (product, qty = 1) =>
        set((state) => {
          const existing = state.cart.find((i) => i.product.id === product.id)
          if (existing) {
            return {
              cart: state.cart.map((i) =>
                i.product.id === product.id
                  ? { ...i, quantity: Math.min(99, i.quantity + qty) }
                  : i
              ),
            }
          }
          return { cart: [...state.cart, { product, quantity: qty }] }
        }),

      removeFromCart: (productId) =>
        set((state) => ({
          cart: state.cart.filter((i) => i.product.id !== productId),
        })),

      setCartQuantity: (productId, qty) =>
        set((state) => ({
          cart:
            qty <= 0
              ? state.cart.filter((i) => i.product.id !== productId)
              : state.cart.map((i) =>
                  i.product.id === productId ? { ...i, quantity: Math.min(99, qty) } : i
                ),
        })),

      clearCart: () => set({ cart: [] }),

      syncCartProducts: (products) =>
        set((state) => ({
          cart: state.cart
            .map((item) => {
              const fresh = products.find((p) => p.id === item.product.id)
              return fresh ? { ...item, product: fresh } : item
            })
            // artigos desactivados pelo administrador saem do pedido
            .filter((item) => item.product.active !== false && item.product.stock > 0),
        })),
    }),
    {
      name: 'gota-real-store',
      partialize: (state) => ({
        auth: state.auth,
        customer: state.customer,
        mode: state.mode,
        courierId: state.courierId,
        centralTab: state.centralTab,
        cart: state.cart,
      }),
    }
  )
)

export function cartTotals(cart: CartItem[]): { totalKz: number; totalLiters: number; count: number } {
  let totalKz = 0
  let totalLiters = 0
  let count = 0
  for (const item of cart) {
    totalKz += item.product.priceKz * item.quantity
    totalLiters += (item.product.volumeL ?? 0) * item.quantity
    count += item.quantity
  }
  return { totalKz, totalLiters, count }
}

export function formatKz(value: number): string {
  return `${Math.round(value).toLocaleString('pt-AO')} Kz`
}

export function formatLiters(liters: number): string {
  const rounded = Math.round(liters * 10) / 10
  return `${rounded.toLocaleString('pt-AO')} L`
}

export function formatTime(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function durationMinutes(fromIso?: string | null, toIso?: string | null): string {
  if (!fromIso || !toIso) return '—'
  const mins = Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 60000)
  if (mins < 1) return '< 1 min'
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h} h ${m} min` : `${h} h`
}
