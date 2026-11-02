'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { useAppStore, cartTotals } from '@/store/app-store'
import { useProducts } from '@/components/app/hooks'
import { fetchCustomer, fetchMe, ApiError } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { OnboardingView } from '@/components/app/OnboardingView'
import { HomeView } from '@/components/app/HomeView'
import { ShopView } from '@/components/app/ShopView'
import { OrdersView } from '@/components/app/OrdersView'
import { FeedbackView } from '@/components/app/FeedbackView'
import { ProfileView } from '@/components/app/ProfileView'
import { CentralView } from '@/components/app/CentralView'
import { MotoboyView } from '@/components/app/MotoboyView'
import { CheckoutSheet } from '@/components/app/CheckoutSheet'
import { InstallPrompt, InstallPromptSpacer } from '@/components/app/InstallPrompt'
import { LogoutButton } from '@/components/app/LoginDialog'
import { BrandLogo } from '@/components/app/Brand'
import { Avatar } from '@/components/app/Avatar'
import { AlertCenter, AlertCountBadge, useAlerts } from '@/components/app/AlertCenter'
import { getRealtimeSocket } from '@/lib/realtime-client'
import { cn } from '@/lib/utils'
import type { CustomerTab } from '@/store/app-store'
import { CENTRAL_ROLES, DELIVERY_ROLES, ROLE_LABEL } from '@/lib/types'
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
  const { customer, auth, logout } = useAppStore()
  const { toast } = useToast()
  // evita mismatch de hidratação (persistência em localStorage):
  // no servidor não há localStorage; no cliente, depois de montar, passa a true
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )

  // GUARDA DE SESSÃO (anti “conta eliminada mas operacional”): valida o
  // token guardado no aparelho sempre que a app arranca ou a sessão muda.
  // Se a conta foi eliminada/desactivada (ou a sessão expirou), sai para o
  // ecrã de boas-vindas em vez de continuar a funcionar com dados em cache.
  useEffect(() => {
    const token = auth?.token
    if (!token) return
    let alive = true
    fetchMe(token)
      .then((res) => {
        if (!alive) return
        // dados frescos do cliente (ex.: banimento aplicado entretanto)
        if (res.customer) {
          const current = useAppStore.getState().customer
          if (
            current &&
            (res.customer.banned !== current.banned ||
              res.customer.banReason !== current.banReason)
          ) {
            useAppStore.getState().setCustomer({ ...current, banned: res.customer.banned, banReason: res.customer.banReason ?? null })
          }
        }
      })
      .catch((err) => {
        if (!alive) return
        // sem rede não faz nada (mantém o estado actual); sessão inválida → sai
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          logout()
          toast({
            title: 'Sessão terminada',
            description:
              'A conta foi encerrada ou a sua entrada expirou. Se a conta continuar activa, entre novamente com o seu telefone e senha.',
            variant: 'destructive',
          })
        }
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.token])

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
  // ADMIN/ATENDENTE/EDITOR entram na Central (com abas conforme o perfil),
  // MOTOBOY/MOTORISTA entram nas entregas
  // O AlertCenter envolve tudo: vigia pedidos/mensagens/entregas e toca
  // o alarme sonoro até o aviso ser visualizado
  const role = auth?.user.role
  if ((CENTRAL_ROLES as string[]).includes(role ?? ''))
    return (
      <AlertCenter>
        <CentralView />
      </AlertCenter>
    )
  if ((DELIVERY_ROLES as string[]).includes(role ?? ''))
    return (
      <AlertCenter>
        <MotoboyView />
      </AlertCenter>
    )

  if (!customer) return <OnboardingView />

  return (
    <AlertCenter>
      <CustomerApp />
    </AlertCenter>
  )
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
  const { customer, auth, tab, setTab, cart, setCheckoutOpen, syncCartProducts, setCustomer, logout } = useAppStore()
  const { products } = useProducts()
  // avisos do cliente: mudanças de estado dos pedidos + respostas às mensagens
  const { alerts } = useAlerts()
  const orderAlertCount = alerts.filter((a) => a.kind === 'status' || a.kind === 'cancel').length
  const messageAlertCount = alerts.filter((a) => a.kind === 'message').length
  const totals = cartTotals(cart)
  const firstName = customer?.name?.split(' ')[0] ?? 'cliente'
  const token = auth?.token ?? null

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
      if (!customer || !data || data.customerId !== customer.id) return
      setCustomer({
        ...customer,
        banned: Boolean(data.banned),
        banReason: data.banReason ?? null,
      } as typeof customer)
    }
    socket.on('auth:banned', onBan)
    return () => {
      socket.off('auth:banned', onBan)
    }
  }, [customer, setCustomer])

  // reserva (sem WebSockets, ex. produção na Vercel): confirma o estado
  // da conta junto à base de dados a cada 30s — o banimento aplica-se
  // mesmo que o cliente mantenha a app aberta sem recarregar.
  // Se a conta tiver sido ELIMINADA (401/403/404), a app sai na hora —
  // é a segunda barreira contra “conta eliminada mas operacional”.
  useEffect(() => {
    if (!customer) return
    const check = async () => {
      try {
        const { customer: fresh } = await fetchCustomer(customer.id, token)
        if (fresh && (fresh.banned !== customer.banned || fresh.banReason !== customer.banReason)) {
          setCustomer({
            ...customer,
            banned: fresh.banned,
            banReason: fresh.banReason,
          } as typeof customer)
        }
      } catch (err) {
        // sem rede: mantém o estado actual; sessão inválida → sai da conta
        if (err instanceof ApiError && [401, 403, 404].includes(err.status)) {
          logout()
        }
      }
    }
    check()
    const id = setInterval(check, 30_000)
    return () => clearInterval(id)
  }, [customer, token, setCustomer, logout])

  // conta eliminada enquanto a app estava aberta (sockets, quando
  // disponíveis): o servidor avisa e a app sai de imediato
  useEffect(() => {
    if (!customer) return
    const socket = getRealtimeSocket()
    const onAccountClosed = (data: { customerId?: string }) => {
      if (!data || data.customerId !== customer.id) return
      logout()
    }
    socket.on('auth:logout', onAccountClosed)
    return () => {
      socket.off('auth:logout', onAccountClosed)
    }
  }, [customer, logout])

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
          {/* foto de perfil do cliente (aparece depois de a enviar no Perfil) */}
          {customer?.photo && (
            <Avatar
              photo={customer.photo}
              name={firstName}
              className="h-10 w-10 rounded-2xl ring-2 ring-white/40"
            />
          )}
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
        {/* reserva a altura do banner de instalação para que o último
            cartão nunca fique tapado por ele (encolhe se for fechado) */}
        <InstallPromptSpacer className="h-28" />
      </main>

      {/* navegação inferior — botões grandes */}
      <nav
        className="safe-bottom app-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t-2 border-border bg-white/95 backdrop-blur-md"
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
                  {/* sino nos pedidos: o estado do pedido mudou (som a tocar) */}
                  {key === 'pedidos' && <AlertCountBadge count={orderAlertCount} />}
                  {/* sino na opinião: a Gota REAL respondeu à mensagem */}
                  {key === 'feedback' && <AlertCountBadge count={messageAlertCount} />}
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

      {/* aviso para instalar a app (Android/iPhone) — por cima do menu */}
      <InstallPrompt placement="above-nav" />
    </div>
  )
}
