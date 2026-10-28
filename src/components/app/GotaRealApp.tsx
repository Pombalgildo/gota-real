'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { useAppStore, cartTotals } from '@/store/app-store'
import { useProducts } from '@/components/app/hooks'
import { OnboardingView } from '@/components/app/OnboardingView'
import { HomeView } from '@/components/app/HomeView'
import { ShopView } from '@/components/app/ShopView'
import { OrdersView } from '@/components/app/OrdersView'
import { FeedbackView } from '@/components/app/FeedbackView'
import { ProfileView } from '@/components/app/ProfileView'
import { CentralView } from '@/components/app/CentralView'
import { MotoboyView } from '@/components/app/MotoboyView'
import { CheckoutSheet } from '@/components/app/CheckoutSheet'
import { LogoutButton } from '@/components/app/LoginDialog'
import { BrandLogo } from '@/components/app/Brand'
import { getRealtimeSocket } from '@/lib/realtime-client'
import { cn } from '@/lib/utils'
import type { CustomerTab } from '@/store/app-store'
import {
  Home,
  MessageSquareHeart,
  ReceiptText,
  ShieldAlert,
  ShoppingBasket,
  Store,
  User,
} from 'lucide-react'

const NAV: { key: CustomerTab; label: string; icon: typeof Home }[] = [
  { key: 'inicio', label: 'Início', icon: Home },
  { key: 'produtos', label: 'Loja', icon: Store },
  { key: 'pedidos', label: 'Pedidos', icon: ReceiptText },
  { key: 'feedback', label: 'Opinião', icon: MessageSquareHeart },
  { key: 'perfil', label: 'Perfil', icon: User },
]

export function GotaRealApp() {
  const { customer, auth } = useAppStore()
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

  // PAINÉIS DA EQUIPA — abertos com o login do próprio perfil:
  // o ADMINISTRADOR entra na Central, o MOTOBOY entra nas entregas
  if (auth?.user.role === 'ADMIN') return <CentralView />
  if (auth?.user.role === 'MOTOBOY') return <MotoboyView />

  if (!customer) return <OnboardingView />

  return <CustomerApp />
}

/** Ecrã mostrado ao cliente banido por má conduta. */
function BannedScreen() {
  const { customer, logout } = useAppStore()
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-red-50 px-6 text-center">
      <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-red-100 text-red-600 shadow-inner">
        <ShieldAlert className="h-10 w-10" />
      </span>
      <h1 className="mt-5 text-xl font-black text-red-700">Conta suspensa</h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-red-900/80">
        A sua conta foi suspensa pela administração da Gota REAL
        {customer?.banReason ? (
          <>
            {' '}pelo seguinte motivo: <b>“{customer.banReason}”</b>.
          </>
        ) : (
          '.'
        )}{' '}
        Neste momento não é possível fazer pedidos. Contacte-nos para regularizar a situação.
      </p>
      <LogoutButton label="Sair da conta" />
    </div>
  )
}

function CustomerApp() {
  const { customer, tab, setTab, cart, setCheckoutOpen, syncCartProducts, setCustomer } = useAppStore()
  const { products } = useProducts()
  const totals = cartTotals(cart)
  const firstName = customer?.name?.split(' ')[0] ?? 'cliente'

  // mantém o carrinho sempre actualizado com a base de dados real:
  // se o administrador mudar preços, fotos ou desactivar artigos,
  // o pedido do cliente reflecte as alterações na hora
  useEffect(() => {
    if (products.length > 0) syncCartProducts(products)
  }, [products, syncCartProducts])

  // se o administrador banir este cliente, o bloqueio aparece na hora
  useEffect(() => {
    const socket = getRealtimeSocket()
    const onBan = (data: { customerId?: string; banned?: boolean; banReason?: string | null }) => {
      if (!data || data.customerId !== customer?.id) return
      setCustomer({
        ...customer,
        banned: Boolean(data.banned),
        banReason: data.banReason ?? null,
      })
    }
    socket.on('auth:banned', onBan)
    return () => {
      socket.off('auth:banned', onBan)
    }
  }, [customer, setCustomer])

  if (customer?.banned) return <BannedScreen />

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

      {/* navegação inferior — botões grandes */}
      <nav
        className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t-2 border-border bg-white/95 backdrop-blur-md"
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
                  'group flex min-h-16 flex-col items-center justify-center gap-1 px-1 py-2 transition-all duration-150 active:scale-95',
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
                aria-current={active ? 'page' : undefined}
              >
                <span
                  className={cn(
                    'relative flex h-9 w-14 items-center justify-center rounded-2xl transition-all duration-200',
                    active ? 'bg-primary text-white shadow-md' : 'group-hover:bg-secondary'
                  )}
                >
                  <Icon className="h-5.5 w-5.5" />
                  {key === 'produtos' && cart.length > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-black text-white shadow">
                      {cart.reduce((s, i) => s + i.quantity, 0)}
                    </span>
                  )}
                </span>
                <span className={cn('text-[11px] font-black leading-none', active && 'text-primary')}>
                  {label}
                </span>
              </button>
            )
          })}
        </div>
      </nav>

      <CheckoutSheet />
    </div>
  )
}
