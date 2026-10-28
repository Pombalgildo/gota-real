'use client'

import { useSyncExternalStore } from 'react'
import { useAppStore, cartTotals } from '@/store/app-store'
import { OnboardingView } from '@/components/app/OnboardingView'
import { HomeView } from '@/components/app/HomeView'
import { ShopView } from '@/components/app/ShopView'
import { OrdersView } from '@/components/app/OrdersView'
import { FeedbackView } from '@/components/app/FeedbackView'
import { ProfileView } from '@/components/app/ProfileView'
import { CentralView } from '@/components/app/CentralView'
import { MotoboyView } from '@/components/app/MotoboyView'
import { CheckoutSheet } from '@/components/app/CheckoutSheet'
import { BrandLogo } from '@/components/app/Brand'
import { cn } from '@/lib/utils'
import type { CustomerTab } from '@/store/app-store'
import {
  Droplets,
  Home,
  MessageSquareHeart,
  ReceiptText,
  ShoppingBasket,
  User,
} from 'lucide-react'

const NAV: { key: CustomerTab; label: string; icon: typeof Home }[] = [
  { key: 'inicio', label: 'Início', icon: Home },
  { key: 'produtos', label: 'Produtos', icon: Droplets },
  { key: 'pedidos', label: 'Pedidos', icon: ReceiptText },
  { key: 'feedback', label: 'Opinião', icon: MessageSquareHeart },
  { key: 'perfil', label: 'Perfil', icon: User },
]

export function GotaRealApp() {
  const { customer, mode } = useAppStore()
  // evita mismatch de hidratação (persistência em localStorage):
  // no servidor não há localStorage; no cliente, depois de montar, passa a true
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )

  if (!mounted) {
    return (
      <div className="flex min-h-dvh items-center justify-center gota-gradient">
        <div className="animate-gota-float text-center">
          <BrandLogo size={84} className="ring-4 ring-white/40 mx-auto" />
          <p className="mt-4 font-script text-4xl text-[#8FD4F8]">Gota</p>
          <p className="text-lg font-black tracking-[0.32em] text-white">REAL</p>
        </div>
      </div>
    )
  }

  if (!customer) return <OnboardingView />
  if (mode === 'central') return <CentralView />
  if (mode === 'motoboy') return <MotoboyView />

  return <CustomerApp />
}

function CustomerApp() {
  const { customer, tab, setTab, cart, setCheckoutOpen } = useAppStore()
  const totals = cartTotals(cart)
  const firstName = customer?.name?.split(' ')[0] ?? 'cliente'

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* cabeçalho */}
      <header className="gota-gradient px-4 pb-4 pt-4 text-white shadow-md">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3">
          <BrandLogo size={40} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold text-[#BDE3F5]">
              Olá, {firstName}! 💧
            </p>
            <p className="font-script text-xl leading-none text-white">
              Gota <span className="font-sans text-xs font-black tracking-[0.28em]">REAL</span>
            </p>
          </div>
          <button
            onClick={() => setCheckoutOpen(true)}
            className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 transition-all hover:bg-white/25 active:scale-95"
            aria-label={`Ver pedido (${totals.count} itens)`}
          >
            <ShoppingBasket className="h-5 w-5" />
            {totals.count > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-black text-[#3A2A05] shadow">
                {totals.count}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* conteúdo */}
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-28 pt-4">
        {tab === 'inicio' && <HomeView />}
        {tab === 'produtos' && <ShopView />}
        {tab === 'pedidos' && <OrdersView />}
        {tab === 'feedback' && <FeedbackView />}
        {tab === 'perfil' && <ProfileView />}
      </main>

      {/* navegação inferior */}
      <nav
        className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 backdrop-blur-md"
        aria-label="Navegação principal"
      >
        <div className="mx-auto grid max-w-3xl grid-cols-5">
          {NAV.map(({ key, label, icon: Icon }) => {
            const active = tab === key
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-2 transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
                aria-current={active ? 'page' : undefined}
              >
                <span
                  className={cn(
                    'flex h-7 w-12 items-center justify-center rounded-full transition-all',
                    active && 'bg-secondary'
                  )}
                >
                  <Icon className="h-4.5 w-4.5" />
                </span>
                <span className="text-[10px] font-bold leading-none">{label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      <CheckoutSheet />
    </div>
  )
}
