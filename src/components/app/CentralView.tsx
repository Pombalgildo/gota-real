'use client'

import { useMemo, useState } from 'react'
import { useAppStore, formatKz, formatLiters, formatTime, formatDateTime, durationMinutes } from '@/store/app-store'
import { useAllOrders, useFeedback, useCouriers, useProducts, useUsers, useStoreConfig } from '@/components/app/hooks'
import { StatusBadge, PaymentBadge } from '@/components/app/Badges'
import { OrderTimeline } from '@/components/app/OrderTimeline'
import { ProductPhoto } from '@/components/app/ProductPhoto'
import { Avatar, PhotoPicker } from '@/components/app/Avatar'
import { LocationPicker, type PickedLocation } from '@/components/app/LocationPicker'
import { resizeImageToDataUrl } from '@/lib/image'
import { LogoutButton } from '@/components/app/LoginDialog'
import { InstallPrompt } from '@/components/app/InstallPrompt'
import {
  orderAction,
  respondFeedback,
  updateProduct,
  createProduct,
  createUser as apiCreateUser,
  updateUser as apiUpdateUser,
  deleteUser as apiDeleteUser,
  updateStore as apiUpdateStore,
} from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import type { Order, Product, User as UserDTO } from '@/lib/types'
import { ROLE_LABEL, ROLE_DESCRIPTION, WORKER_ROLES, ORDER_MANAGER_ROLES, CATALOG_ROLES } from '@/lib/types'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  Ban,
  Bike,
  Building2,
  Camera,
  Car,
  Check,
  ClipboardList,
  Clock,
  Headset,
  ImagePlus,
  KeyRound,
  Loader2,
  MapPin,
  MessageSquareWarning,
  Package,
  Pencil,
  PenLine,
  Phone,
  Plus,
  Reply,
  Save,
  Send,
  ShieldCheck,
  Store,
  Timer,
  TrendingUp,
  Truck,
  Trash2,
  User,
  UserCog,
  Users,
  Warehouse,
  WifiOff,
  RefreshCw,
  XCircle,
} from 'lucide-react'

const FILTERS = [
  { key: 'todos', label: 'Todos' },
  { key: 'pendente', label: 'Solicitados' },
  { key: 'confirmado', label: 'Confirmados' },
  { key: 'em_transito', label: 'Em trânsito' },
  { key: 'entregue', label: 'Entregues' },
  { key: 'cancelado', label: 'Cancelados' },
]

export function CentralView() {
  const { auth } = useAppStore()
  const staffName = auth?.user.name ?? 'Equipa'
  const role = auth?.user.role ?? 'ADMIN'
  const isEditor = role === 'EDITOR'
  // evita "Administrador · Administrador Geral" — se o nome já contém o cargo, mostra só o nome
  const roleLabel = ROLE_LABEL[role] ?? 'equipa'
  const headerLine = staffName.toLowerCase().startsWith(roleLabel.toLowerCase())
    ? staffName
    : `${roleLabel} · ${staffName}`

  return (
    <div className="min-h-dvh bg-background pb-44">
      {/* cabeçalho */}
      <header className="gota-gradient px-4 pb-16 pt-5 text-white shadow-lg">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <Avatar
            photo={auth?.user.photo ?? null}
            name={staffName}
            className="h-11 w-11 rounded-2xl ring-2 ring-white/40"
            icon={
              isEditor ? (
                <Store className="h-5 w-5" />
              ) : role === 'ATENDENTE' ? (
                <Headset className="h-5 w-5" />
              ) : (
                <Warehouse className="h-5 w-5" />
              )
            }
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] font-black uppercase tracking-wider sm:tracking-[0.2em] text-[#BDE3F5]">
              {headerLine}
            </p>
            <h1 className="text-lg font-black leading-tight">Central Gota REAL 👑</h1>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ring-1 ring-white/25">
            <span className="live-dot" /> ao vivo
          </span>
          <LogoutButton light label="Sair" />
        </div>
      </header>

      <div className="mx-auto -mt-11 max-w-5xl space-y-5 px-4">
        <CentralStats role={role} />
        <CentralTabs role={role} />
        {/* aviso de instalação no fluxo da página (não flutua): nunca
            tapa os pedidos, filtros nem botões da central */}
        <InstallPrompt placement="inline" />
      </div>
    </div>
  )
}

function CentralStats({ role }: { role: string }) {
  const { orders } = useAllOrders()
  const { products } = useProducts()
  const today = new Date().toDateString()

  const stats = useMemo(() => {
    const todayOrders = orders.filter((o) => new Date(o.requestedAt).toDateString() === today)
    const pending = orders.filter((o) => o.status === 'pendente')
    const inTransit = orders.filter((o) => o.status === 'em_transito')
    const deliveredToday = todayOrders.filter((o) => o.status === 'entregue')
    const revenueToday = deliveredToday.reduce((s, o) => s + o.totalKz, 0)
    const durations = deliveredToday
      .filter((o) => o.deliveredAt)
      .map((o) => new Date(o.deliveredAt!).getTime() - new Date(o.requestedAt).getTime())
    const avgMin = durations.length
      ? Math.round((durations.reduce((s, d) => s + d, 0) / durations.length) / 60000)
      : null
    return { todayCount: todayOrders.length, pending: pending.length, inTransit: inTransit.length, deliveredToday: deliveredToday.length, revenueToday, avgMin }
  }, [orders, today])

  // O EDITOR só gere a loja — vê estatísticas do catálogo em vez dos pedidos
  const items =
    role === 'EDITOR'
      ? [
          { icon: Package, label: 'artigos na loja', value: products.length, accent: 'text-primary bg-secondary' },
          { icon: Check, label: 'activos à venda', value: products.filter((p) => p.active).length, accent: 'text-emerald-600 bg-emerald-100' },
          { icon: XCircle, label: 'sem foto', value: products.filter((p) => !p.image).length, accent: 'text-amber-600 bg-amber-100' },
          { icon: TrendingUp, label: 'preço médio', value: products.length ? formatKz(Math.round(products.reduce((s, p) => s + p.priceKz, 0) / products.length)) : '—', accent: 'text-gold bg-gold/15' },
        ]
      : [
          { icon: ClipboardList, label: 'pedidos hoje', value: stats.todayCount, accent: 'text-primary bg-secondary' },
          { icon: Timer, label: 'solicitados', value: stats.pending, accent: 'text-amber-600 bg-amber-100' },
          { icon: Truck, label: 'em trânsito', value: stats.inTransit, accent: 'text-blue-600 bg-blue-100' },
          { icon: Check, label: 'entregues hoje', value: stats.deliveredToday, accent: 'text-emerald-600 bg-emerald-100' },
          { icon: TrendingUp, label: 'faturação hoje', value: formatKz(stats.revenueToday), accent: 'text-gold bg-gold/15' },
          { icon: Bike, label: 'tempo médio', value: stats.avgMin != null ? `${stats.avgMin} min` : '—', accent: 'text-navy bg-secondary' },
        ]

  return (
    <div className={cn('grid grid-cols-2 gap-2.5', role === 'EDITOR' ? 'sm:grid-cols-4' : 'sm:grid-cols-3')}>
      {items.map(({ icon: Icon, label, value, accent }) => (
        <div key={label} className="rounded-2xl border border-border bg-white p-3 shadow-md">
          <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', accent)}>
            <Icon className="h-4 w-4" />
          </span>
          <p className="mt-2 truncate text-lg font-black leading-none text-navy">{value}</p>
          <p className="mt-1 truncate text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
        </div>
      ))}
    </div>
  )
}

function CentralTabs({ role }: { role: string }) {
  // abas conforme o perfil: só o ADMIN vê Perfis e Ajustes
  const canManageOrders = ORDER_MANAGER_ROLES.includes(role)
  const canManageCatalog = CATALOG_ROLES.includes(role)
  const isAdmin = role === 'ADMIN'
  const tabs = [
    ...(canManageOrders ? [{ value: 'pedidos', label: 'Pedidos', icon: ClipboardList }] : []),
    ...(canManageOrders ? [{ value: 'feedback', label: 'Mensagens', icon: MessageSquareWarning }] : []),
    ...(canManageCatalog ? [{ value: 'produtos', label: 'Loja', icon: Store }] : []),
    ...(isAdmin ? [{ value: 'perfis', label: 'Perfis', icon: Users }] : []),
    ...(isAdmin ? [{ value: 'ajustes', label: 'Ajustes', icon: Building2 }] : []),
  ]
  const defaultTab = tabs[0]?.value ?? 'pedidos'

  return (
    <Tabs defaultValue={defaultTab}>
      <TabsList
        className={cn(
          'grid h-auto w-full gap-1.5 rounded-xl bg-secondary p-1.5',
          tabs.length === 1 && 'grid-cols-1',
          tabs.length === 2 && 'grid-cols-2',
          tabs.length >= 3 && 'grid-cols-3 sm:grid-cols-5'
        )}
      >
        {tabs.map((t) => (
          <TabsTrigger
            key={t.value}
            value={t.value}
            className="h-auto min-w-0 rounded-lg px-1 py-2.5 text-[11px] font-bold data-[state=active]:bg-white sm:text-xs"
          >
            <t.icon className="h-4 w-4 shrink-0" />
            <span className="min-w-0 truncate">{t.label}</span>
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="pedidos" className="mt-4">
        <OrdersPanel />
      </TabsContent>
      <TabsContent value="feedback" className="mt-4">
        <FeedbackPanel />
      </TabsContent>
      <TabsContent value="produtos" className="mt-4">
        <ProductsPanel />
      </TabsContent>
      <TabsContent value="perfis" className="mt-4">
        <UsersPanel />
      </TabsContent>
      <TabsContent value="ajustes" className="mt-4">
        <StoreSettingsPanel />
      </TabsContent>
    </Tabs>
  )
}

// ---------------- Pedidos ----------------
function OrdersPanel() {
  const { orders, loading, error, reload } = useAllOrders()
  const [filter, setFilter] = useState('todos')
  const [detail, setDetail] = useState<Order | null>(null)

  const filtered = filter === 'todos' ? orders : orders.filter((o) => o.status === filter)
  const detailLive = detail ? orders.find((o) => o.id === detail.id) ?? detail : null

  if (detailLive) {
    return <CentralOrderDetail order={detailLive} onBack={() => setDetail(null)} />
  }

  return (
    <div className="space-y-3">
      {/* filtros — passam de linha em vez de ficarem cortados no telemóvel */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              'rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all',
              filter === f.key
                ? 'border-primary bg-primary text-white shadow-sm'
                : 'border-border bg-white text-muted-foreground hover:border-input'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">a carregar pedidos…</p>
      ) : error && orders.length === 0 ? (
        /* falha de ligação: antes mostrava “Sem pedidos” em silêncio e
           parecia que os pedidos dos clientes não tinham sido registados */
        <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-red-300 bg-red-50/70 py-10 text-center">
          <WifiOff className="h-8 w-8 text-red-400" />
          <p className="mt-2 text-sm font-black text-red-700">
            Não foi possível carregar os pedidos
          </p>
          <p className="mt-1 max-w-xs break-words px-4 text-xs leading-snug text-red-600">{error}</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => reload()}>
            <RefreshCw className="h-4 w-4" /> Tentar novamente
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-input bg-white/60 py-12 text-muted-foreground">
          <ClipboardList className="h-8 w-8 opacity-40" />
          <p className="mt-2 text-sm font-medium">Sem pedidos neste filtro</p>
        </div>
      ) : (
        filtered.map((order) => <CentralOrderCard key={order.id} order={order} onOpen={() => setDetail(order)} />)
      )}
    </div>
  )
}

function CentralOrderCard({ order, onOpen }: { order: Order; onOpen: () => void }) {
  const { couriers } = useCouriers()
  const { toast } = useToast()
  const { auth } = useAppStore()
  const [busy, setBusy] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)

  async function act(action: 'confirm' | 'assign' | 'cancel', courierId?: string) {
    setBusy(true)
    try {
      await orderAction(auth?.token ?? '', order.id, action, courierId)
      if (action === 'confirm') toast({ title: `Pedido nº ${order.number} confirmado ✅` })
      if (action === 'assign') toast({ title: `Motoboy atribuído ao pedido nº ${order.number} 🛵` })
      if (action === 'cancel') toast({ title: `Pedido nº ${order.number} cancelado`, variant: 'destructive' })
    } catch (err) {
      toast({
        title: 'Acção falhou',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setBusy(false)
      setAssignOpen(false)
    }
  }

  const availableCouriers = couriers

  return (
    <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
      <button onClick={onOpen} className="w-full text-left" aria-label={`Detalhe do pedido nº ${order.number}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-navy">
              #{order.number} · {order.customer?.name}
              {order.status === 'pendente' && <span className="live-dot ml-2 align-middle" />}
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <Phone className="h-3 w-3 shrink-0" />
              <span className="min-w-0 truncate">
                {order.customer?.phone} · {formatTime(order.requestedAt)}
              </span>
            </p>
          </div>
          <StatusBadge status={order.status} className="shrink-0" />
        </div>
        <div className="mt-2.5 flex items-center justify-between gap-2 text-xs">
          <span className="min-w-0 truncate text-muted-foreground">
            {order.items.reduce((s, i) => s + i.quantity, 0)} itens · {formatLiters(order.totalLiters)} ·{' '}
            <b className="text-foreground">{formatKz(order.totalKz)}</b>
          </span>
          <PaymentBadge method={order.paymentMethod} className="shrink-0" />
        </div>
        {order.courier && (
          <p className="mt-2 flex items-center gap-1 rounded-lg bg-gold/15 px-2 py-1 text-[11px] font-bold text-[#6B5410]">
            <Bike className="h-3 w-3 shrink-0" />
            <span className="min-w-0 truncate">
              {order.courier.name} · {order.courier.vehicle}
            </span>
          </p>
        )}
      </button>

      {/* acções rápidas */}
      <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
        {order.status === 'pendente' && (
          <Button size="sm" className="h-8 rounded-full font-bold" disabled={busy} onClick={() => act('confirm')}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Confirmar
          </Button>
        )}
        {(order.status === 'pendente' || order.status === 'confirmado') && (
          <Button size="sm" variant="secondary" className="h-8 rounded-full font-bold" disabled={busy} onClick={() => setAssignOpen(true)}>
            <Bike className="h-3.5 w-3.5" /> {order.courierId ? 'Trocar motoboy' : 'Atribuir motoboy'}
          </Button>
        )}
        {(order.status === 'pendente' || order.status === 'confirmado') && (
          <Button size="sm" variant="ghost" className="h-8 rounded-full text-red-600 hover:bg-red-50" disabled={busy} onClick={() => act('cancel')}>
            <XCircle className="h-3.5 w-3.5" /> Cancelar
          </Button>
        )}
        <Button size="sm" variant="outline" className="ml-auto h-8 rounded-full" onClick={onOpen}>
          Detalhes
        </Button>
      </div>

      {/* dialog de atribuição */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Atribuir motoboy</DialogTitle>
            <DialogDescription>
              Escolha o entregador para o pedido nº {order.number}. O motoboy recebe a entrega no
              painel dele e o cliente passa a vê-lo por GPS.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {availableCouriers.map((c) => (
              <button
                key={c.id}
                onClick={() => act('assign', c.id)}
                disabled={busy}
                className="flex w-full items-center gap-3 rounded-xl border-2 border-border bg-white p-3 text-left transition-all hover:border-primary hover:bg-secondary/40"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl gota-gradient text-white">
                  <Bike className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-black text-navy">{c.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {c.vehicle} · {c.plate}
                  </span>
                </span>
                <span
                  className={cn(
                    'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold',
                    c.available
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-amber-200 bg-amber-50 text-amber-700'
                  )}
                >
                  {c.available ? 'livre' : `ocupado (${c.orders?.length ?? 0})`}
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CentralOrderDetail({ order, onBack }: { order: Order; onBack: () => void }) {
  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="font-bold">
        <ArrowLeft className="h-4 w-4" /> Voltar aos pedidos
      </Button>

      <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-base font-black text-navy">Pedido nº {order.number}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatDateTime(order.requestedAt)} · {order.customer?.phone}
            </p>
          </div>
          <StatusBadge status={order.status} className="shrink-0" />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-xl bg-secondary/60 p-2.5">
            <p className="font-bold text-secondary-foreground">Cliente</p>
            <p className="mt-0.5 text-foreground">{order.customer?.name}</p>
            <p className="text-muted-foreground">{order.customer?.phone}</p>
          </div>
          <div className="rounded-xl bg-secondary/60 p-2.5">
            <p className="font-bold text-secondary-foreground">Entrega</p>
            <p className="mt-0.5 text-foreground">{order.address || 'GPS'}</p>
            {order.latitude != null && (
              <p className="font-mono text-[10px] text-muted-foreground">
                {order.latitude.toFixed(5)}, {order.longitude?.toFixed(5)}
              </p>
            )}
          </div>
        </div>

        {order.courier && (
          <div className="mt-2 flex items-center gap-2 rounded-xl bg-gold/15 p-2.5 text-xs">
            <Bike className="h-4 w-4 shrink-0 text-gold" />
            <p className="min-w-0 break-words font-bold text-[#6B5410]">
              {order.courier.name} · {order.courier.vehicle} · {order.courier.plate} · {order.courier.phone}
            </p>
          </div>
        )}

        <ul className="mt-3 space-y-1.5 border-t border-border pt-3">
          {order.items.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="min-w-0 break-words text-foreground">
                {i.quantity}× {i.productName}
              </span>
              <b className="shrink-0 text-navy">{formatKz(i.unitPriceKz * i.quantity)}</b>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-sm">
          <span className="text-muted-foreground">
            Total ({order.paymentMethod === 'TPA' ? 'TPA' : 'cash'}) · {formatLiters(order.totalLiters)}
          </span>
          <b className="text-primary">{formatKz(order.totalKz)}</b>
        </div>
        {order.notes && (
          <p className="mt-2 rounded-xl bg-secondary/70 p-2.5 text-xs italic text-secondary-foreground">
            “{order.notes}”
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
        <h4 className="mb-3 text-sm font-black text-navy">Histórico de tempos</h4>
        <OrderTimeline order={order} />
        {order.status === 'entregue' && (
          <p className="mt-2 rounded-lg bg-emerald-50 p-2 text-center text-xs font-bold text-emerald-700">
            pedido {formatTime(order.requestedAt)} → entrega {formatTime(order.deliveredAt)} (
            {durationMinutes(order.requestedAt, order.deliveredAt)})
          </p>
        )}
      </div>
    </div>
  )
}

// ---------------- Feedback ----------------
function FeedbackPanel() {
  const { feedbacks, loading } = useFeedback()
  const { toast } = useToast()
  const { auth } = useAppStore()
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)

  async function send(fbid: string) {
    setSending(true)
    try {
      await respondFeedback(auth?.token ?? '', fbid, reply.trim())
      setReplyTo(null)
      setReply('')
      toast({ title: 'Resposta enviada ao cliente ✅' })
    } catch (err) {
      toast({
        title: 'Erro ao responder',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSending(false)
    }
  }

  if (loading) return <p className="py-8 text-center text-sm text-muted-foreground">a carregar…</p>

  if (feedbacks.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-input bg-white/60 py-12 text-muted-foreground">
        <MessageSquareWarning className="h-8 w-8 opacity-40" />
        <p className="mt-2 text-sm font-medium">Sem sugestões ou reclamações</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {feedbacks.map((f) => (
        <div key={f.id} className="rounded-2xl border border-border bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                  f.type === 'sugestao' ? 'bg-secondary text-primary' : 'bg-red-100 text-red-600'
                )}
              >
                {f.type === 'sugestao' ? '💡' : '⚠️'}
              </span>
              <div className="min-w-0">
                <p className="break-words text-sm font-black text-navy">{f.subject}</p>
                <p className="break-words text-[11px] text-muted-foreground">
                  {f.customer?.name ?? 'Anónimo'} · {f.customer?.phone ?? '—'} ·{' '}
                  {formatDateTime(f.createdAt)}
                </p>
              </div>
            </div>
            <Badge
              variant="outline"
              className={cn(
                'shrink-0 text-[10px]',
                f.status === 'respondido'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-amber-200 bg-amber-50 text-amber-700'
              )}
            >
              {f.status === 'respondido' ? 'respondido' : 'em aberto'}
            </Badge>
          </div>
          <p className="mt-2.5 text-xs leading-relaxed text-foreground">{f.message}</p>

          {f.response ? (
            <div className="mt-2.5 rounded-xl bg-secondary/70 p-3">
              <p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-secondary-foreground">
                <Reply className="h-3 w-3" /> resposta da central
              </p>
              <p className="mt-1 text-xs text-foreground">{f.response}</p>
            </div>
          ) : replyTo === f.id ? (
            <div className="mt-2.5 space-y-2">
              <Textarea
                placeholder="Escreva a resposta ao cliente…"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                className="min-h-20"
              />
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => { setReplyTo(null); setReply('') }}>
                  Cancelar
                </Button>
                <Button size="sm" className="font-bold" disabled={!reply.trim() || sending} onClick={() => send(f.id)}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar resposta
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="mt-2.5 h-8 rounded-full font-bold"
              onClick={() => setReplyTo(f.id)}
            >
              <Reply className="h-3.5 w-3.5" /> Responder
            </Button>
          )}
        </div>
      ))}
    </div>
  )
}

// ---------------- Produtos ----------------
function ProductsPanel() {
  const { products, reload } = useProducts()
  const { toast } = useToast()
  const { auth } = useAppStore()
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const token = auth?.token ?? ''

  const withPhoto = products.filter((p) => p.image).length

  return (
    <div className="space-y-3">
      {/* instrução para o administrador */}
      <div className="rounded-2xl border-2 border-dashed border-primary/30 bg-secondary/50 p-3.5">
        <p className="flex items-center gap-2 text-sm font-black text-navy">
          <ImagePlus className="h-4.5 w-4.5 text-primary" /> Gestão da LOJA
        </p>
        <p className="mt-1 text-xs leading-snug text-muted-foreground">
          Coloque a <b>foto real</b> de cada artigo, <b>altere os preços</b> e o stock.
          Assim que guardar, tudo fica <b>visível na loja do cliente</b> na hora.
          ({withPhoto}/{products.length} artigos já têm foto real)
        </p>
      </div>

      <Button className="h-11 w-full rounded-xl font-bold" onClick={() => setAddOpen(true)}>
        <Plus className="h-4 w-4" /> Novo produto à venda
      </Button>

      {products.map((p) => (
        <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-border bg-white p-3 shadow-sm">
          <div className="relative h-16 w-16 shrink-0">
            <ProductPhoto product={p} className="h-16 w-16" rounded="rounded-xl" />
            {!p.image && (
              <span className="absolute -bottom-1 -right-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[8px] font-black text-amber-700 ring-1 ring-amber-300">
                sem foto
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-navy">{p.name}</p>
            <p className="text-sm font-black text-primary">{formatKz(p.priceKz)}</p>
            <p className="text-[11px] text-muted-foreground">
              stock {p.stock} · {p.category === 'agua' ? 'água' : 'acessório'}
              {!p.active && <span className="ml-1 font-black text-red-500">· inactivo</span>}
            </p>
          </div>
          <Switch
            checked={p.active}
            onCheckedChange={async (v) => {
              await updateProduct(token, p.id, { active: v })
              reload()
            }}
            aria-label={`Activar/desactivar ${p.name}`}
          />
          <Button
            variant="outline"
            className="h-10 shrink-0 gap-1.5 rounded-xl px-3 text-xs font-black"
            onClick={() => setEditing(p)}
            aria-label={`Editar ${p.name}`}
          >
            <Pencil className="h-3.5 w-3.5" /> EDITAR
          </Button>
        </div>
      ))}

      <ProductFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSaved={() => { reload(); setAddOpen(false) }}
      />
      {editing && (
        <ProductFormDialog
          open={!!editing}
          product={editing}
          onOpenChange={(o) => !o && setEditing(null)}
          onSaved={() => { reload(); setEditing(null) }}
        />
      )}
    </div>
  )
}

function ProductFormDialog({
  open,
  onOpenChange,
  product,
  onSaved,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  product?: Product
  onSaved: () => void
}) {
  const { toast } = useToast()
  const { auth } = useAppStore()
  const token = auth?.token ?? ''
  const [name, setName] = useState(product?.name ?? '')
  const [price, setPrice] = useState(String(product?.priceKz ?? ''))
  const [stock, setStock] = useState(String(product?.stock ?? '50'))
  const [category, setCategory] = useState(product?.category ?? 'agua')
  const [volume, setVolume] = useState(String(product?.volumeL ?? ''))
  const [description, setDescription] = useState(product?.description ?? '')
  // FOTO REAL do artigo (data URL base64)
  const [image, setImage] = useState<string | null>(product?.image ?? null)
  const [imgBusy, setImgBusy] = useState(false)
  const [saving, setSaving] = useState(false)

  const fileInputId = `pf-photo-${product?.id ?? 'novo'}`
  const cameraInputId = `pf-camera-${product?.id ?? 'novo'}`

  async function onPickPhoto(file: File | undefined) {
    if (!file) return
    setImgBusy(true)
    try {
      const dataUrl = await resizeImageToDataUrl(file, 900, 0.82)
      setImage(dataUrl)
      toast({
        title: 'Foto carregada ✅',
        description: 'Não esqueça de guardar para publicar na loja.',
      })
    } catch (err) {
      toast({
        title: 'Foto inválida',
        description: err instanceof Error ? err.message : 'Escolha outra imagem.',
        variant: 'destructive',
      })
    } finally {
      setImgBusy(false)
    }
  }

  async function save() {
    if (!name.trim() || !price) {
      toast({ title: 'Nome e preço são obrigatórios', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const body = {
        name: name.trim(),
        description: description.trim(),
        priceKz: Number(price),
        stock: Number(stock) || 0,
        category,
        kind: category === 'agua' ? (Number(volume) >= 5 ? 'garrafao' : 'garrafa') : 'acessorio',
        volumeL: Number(volume) || 0,
        unitLabel: category === 'agua' ? `${volume || ''}L`.trim() : 'unidade',
        image, // null remove a foto, data URL guarda a foto real
      }
      if (product) {
        await updateProduct(token, product.id, body)
        toast({ title: 'Produto actualizado ✅', description: 'A loja do cliente já mostra as alterações.' })
      } else {
        await createProduct(token, body)
        toast({ title: 'Produto criado e à venda! ✅', description: 'Já está visível na loja do cliente.' })
      }
      onSaved()
    } catch (err) {
      toast({
        title: 'Erro ao guardar',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{product ? 'Editar artigo da loja' : 'Novo artigo da loja'}</DialogTitle>
          <DialogDescription>
            Artigos activos ficam disponíveis na <b>loja do cliente</b> assim que guardar.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* ---------- FOTO REAL DO ARTIGO ---------- */}
          <div className="space-y-2">
            <Label className="text-sm font-black text-navy">
              <Camera className="mr-1 inline h-4 w-4 text-primary" /> FOTO REAL do artigo
            </Label>
            {image ? (
              <div className="relative overflow-hidden rounded-2xl border-2 border-primary/30 bg-secondary/50">
                <img src={image} alt="Pré-visualização da foto real do artigo" className="mx-auto max-h-44 w-auto object-contain" />
                <button
                  type="button"
                  onClick={() => setImage(null)}
                  className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-red-500 text-white shadow-md transition-all hover:bg-red-600 active:scale-90"
                  aria-label="Remover foto"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <span className="absolute bottom-2 left-2 rounded-full bg-navy/85 px-2.5 py-1 text-[10px] font-black text-white">
                  foto real — visível na loja do cliente
                </span>
              </div>
            ) : (
              <label
                htmlFor={fileInputId}
                className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-primary/40 bg-secondary/40 p-4 text-center transition-all hover:border-primary hover:bg-secondary/70"
              >
                {imgBusy ? (
                  <Loader2 className="h-7 w-7 animate-spin text-primary" />
                ) : (
                  <ImagePlus className="h-7 w-7 text-primary" />
                )}
                <span className="text-sm font-black text-navy">Toque para escolher a foto</span>
                <span className="text-[11px] leading-snug text-muted-foreground">
                  A foto real do artigo fica visível para o cliente na loja
                </span>
              </label>
            )}
            <input
              id={fileInputId}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                onPickPhoto(e.target.files?.[0])
                e.target.value = ''
              }}
            />
            {/* câmara directa (telemóvel) */}
            <input
              id={cameraInputId}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                onPickPhoto(e.target.files?.[0])
                e.target.value = ''
              }}
            />
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-xl text-xs font-black"
                onClick={() => document.getElementById(cameraInputId)?.click()}
              >
                <Camera className="h-4 w-4 text-primary" /> TIRAR FOTO
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-xl text-xs font-black"
                onClick={() => document.getElementById(fileInputId)?.click()}
              >
                <ImagePlus className="h-4 w-4 text-primary" /> GALERIA / PC
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pf-name">Nome</Label>
            <Input id="pf-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Bidão 5L" />
          </div>

          {/* ---------- PREÇO em destaque ---------- */}
          <div className="rounded-xl border-2 border-gold/50 bg-gold/10 p-3">
            <Label htmlFor="pf-price" className="text-sm font-black text-[#6B5410]">
              PREÇO DE VENDA (Kz) — visível na loja
            </Label>
            <Input
              id="pf-price"
              inputMode="numeric"
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="600"
              className="mt-1.5 h-12 border-2 border-gold/60 bg-white text-xl font-black"
            />
            {price && (
              <p className="mt-1 text-xs font-bold text-[#6B5410]">
                O cliente verá: <b>{Number(price).toLocaleString('pt-AO')} Kz</b>
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="pf-stock">Stock</Label>
              <Input id="pf-stock" inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value.replace(/[^0-9]/g, ''))} placeholder="100" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-vol">Volume (L)</Label>
              <Input id="pf-vol" inputMode="decimal" value={volume} onChange={(e) => setVolume(e.target.value)} placeholder="5" disabled={category === 'acessorio'} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="agua">Água</SelectItem>
                <SelectItem value="acessorio">Acessório</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-desc">Descrição (mostrada na loja)</Label>
            <Textarea
              id="pf-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex.: Água purificada em bidão de 5 litros, retornável."
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving} className="h-11 w-full rounded-xl font-black">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            GUARDAR E PUBLICAR NA LOJA
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------- Perfis (gestão do administrador) ----------------
function UsersPanel() {
  const { auth } = useAppStore()
  const token = auth?.token ?? null
  const { users, loading, reload } = useUsers(token)
  const { toast } = useToast()

  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<UserDTO | null>(null)
  const [banning, setBanning] = useState<UserDTO | null>(null)
  const [deleting, setDeleting] = useState<UserDTO | null>(null)

  const workers = users.filter((u) => (WORKER_ROLES as string[]).includes(u.role))
  const clients = users.filter((u) => u.role === 'CLIENTE')

  async function act(promise: Promise<unknown>, okMessage: string) {
    try {
      await promise
      reload()
      toast({ title: okMessage })
    } catch (err) {
      toast({
        title: 'Acção falhou',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      })
    }
  }

  if (loading) {
    return <p className="py-8 text-center text-sm text-muted-foreground">a carregar perfis…</p>
  }

  return (
    <div className="space-y-4">
      {/* instrução */}
      <div className="rounded-2xl border-2 border-dashed border-primary/30 bg-secondary/50 p-3.5">
        <p className="flex items-center gap-2 text-sm font-black text-navy">
          <UserCog className="h-4.5 w-4.5 text-primary" /> Gestão de perfis
        </p>
        <p className="mt-1 text-xs leading-snug text-muted-foreground">
          Crie perfis de <b>trabalhadores</b> — administradores, atendentes (pedidos), editores (loja),
          motoboys e motoristas — com senha própria e foto, <b>elimine qualquer perfil</b> e
          <b> bane clientes por má conduta</b>. Os clientes banidos ficam impedidos de fazer pedidos.
        </p>
      </div>

      {/* ---------- trabalhadores ---------- */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-sm font-black text-navy">
            <Users className="h-4 w-4 text-primary" /> Trabalhadores ({workers.length})
          </h3>
          <Button size="sm" className="h-9 rounded-xl font-bold" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Criar perfil
          </Button>
        </div>

        {workers.map((u) => (
          <UserRow
            key={u.id}
            user={u}
            isSelf={u.id === auth?.user.id}
            onEdit={() => setEditing(u)}
            onBan={u.role === 'CLIENTE' ? () => setBanning(u) : undefined}
            onDelete={() => setDeleting(u)}
          />
        ))}
      </section>

      {/* ---------- clientes ---------- */}
      <section className="space-y-2.5">
        <h3 className="flex items-center gap-1.5 text-sm font-black text-navy">
          <User className="h-4 w-4 text-primary" /> Clientes ({clients.length})
        </h3>
        {clients.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-input bg-white/60 p-4 text-center text-xs text-muted-foreground">
            Ainda sem clientes registados com perfil.
          </p>
        ) : (
          clients.map((u) => (
            <UserRow
              key={u.id}
              user={u}
              isSelf={false}
              onEdit={() => setEditing(u)}
              onBan={() => setBanning(u)}
              onDelete={() => setDeleting(u)}
            />
          ))
        )}
      </section>

      {/* dialog: criar perfil de trabalhador */}
      <CreateUserDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        token={token!}
        onSaved={() => {
          reload()
          setAddOpen(false)
        }}
      />

      {/* dialog: editar perfil */}
      {editing && (
        <EditUserDialog
          user={editing}
          token={token!}
          onOpenChange={(o) => !o && setEditing(null)}
          onSaved={() => {
            reload()
            setEditing(null)
          }}
        />
      )}

      {/* dialog: banir cliente */}
      {banning && (
        <BanUserDialog
          user={banning}
          token={token!}
          onClose={() => setBanning(null)}
          onDone={() => {
            reload()
            setBanning(null)
          }}
        />
      )}

      {/* dialog: eliminar perfil */}
      {deleting && (
        <Dialog open onOpenChange={(o) => !o && setDeleting(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-red-700">Eliminar perfil</DialogTitle>
              <DialogDescription>
                Elimina o perfil de <b>{deleting.name}</b> ({ROLE_LABEL[deleting.role] ?? deleting.role}).
                {deleting.role === 'CLIENTE'
                  ? ' O histórico de pedidos fica guardado para a faturação.'
                  : ''}
                Esta acção não pode ser desfeita.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-row gap-2">
              <Button variant="outline" className="flex-1 font-bold" onClick={() => setDeleting(null)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                className="flex-1 font-bold"
                onClick={() => {
                  act(apiDeleteUser(token!, deleting.id), `Perfil de ${deleting.name} eliminado`)
                  setDeleting(null)
                }}
              >
                <Trash2 className="h-4 w-4" /> Eliminar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

/** Linha de um perfil na lista. */
function UserRow({
  user,
  isSelf,
  onEdit,
  onBan,
  onDelete,
}: {
  user: UserDTO
  isSelf: boolean
  onEdit: () => void
  onBan?: () => void
  onDelete: () => void
}) {
  const { auth } = useAppStore()
  const token = auth?.token ?? null
  const { reload } = useUsers(token)
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)

  async function toggleActive() {
    setBusy(true)
    try {
      await apiUpdateUser(token!, user.id, { active: !user.active })
      reload()
      toast({
        title: user.active
          ? `Perfil de ${user.name} desactivado`
          : `Perfil de ${user.name} reactivado ✅`,
      })
    } catch (err) {
      toast({
        title: 'Acção falhou',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setBusy(false)
    }
  }

  const roleBadge =
    user.role === 'ADMIN'
      ? 'border-gold/50 bg-gold/15 text-[#6B5410]'
      : user.role === 'ATENDENTE'
        ? 'border-violet-200 bg-violet-50 text-violet-700'
        : user.role === 'EDITOR'
          ? 'border-orange-200 bg-orange-50 text-orange-700'
          : user.role === 'MOTORISTA'
            ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
            : user.role === 'MOTOBOY'
              ? 'border-sky-200 bg-sky-50 text-sky-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'

  return (
    <div className="rounded-2xl border border-border bg-white p-3.5 shadow-sm">
      <div className="flex items-center gap-3">
        <Avatar
          photo={user.photo ?? user.customer?.photo ?? null}
          name={user.name}
          className={cn('h-11 w-11', user.banned && 'grayscale ring-2 ring-red-400')}
          icon={
            user.role === 'ADMIN' ? (
              <Warehouse className="h-5 w-5" />
            ) : user.role === 'ATENDENTE' ? (
              <Headset className="h-5 w-5" />
            ) : user.role === 'EDITOR' ? (
              <PenLine className="h-5 w-5" />
            ) : user.role === 'MOTORISTA' ? (
              <Car className="h-5 w-5" />
            ) : user.role === 'MOTOBOY' ? (
              <Bike className="h-5 w-5" />
            ) : (
              <User className="h-5 w-5" />
            )
          }
        />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-black text-navy">
            <span className="min-w-0 truncate">{user.name}</span>
            {isSelf && (
              <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[9px] font-black text-primary">
                eu
              </span>
            )}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">{user.email}</p>
          <p className="text-[11px] text-muted-foreground">
            {user.phone || '—'}
            {user.courier ? ` · ${user.courier.vehicle} (${user.courier.plate})` : ''}
            {user.role === 'CLIENTE' && user.customer
              ? ` · ${user.customer._count?.orders ?? 0} pedidos`
              : ''}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant="outline" className={cn('text-[10px]', roleBadge)}>
            {ROLE_LABEL[user.role] ?? user.role}
          </Badge>
          {user.banned ? (
            <Badge variant="outline" className="border-red-200 bg-red-50 text-[10px] text-red-700">
              banido
            </Badge>
          ) : !user.active ? (
            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-[10px] text-amber-700">
              desactivado
            </Badge>
          ) : null}
        </div>
      </div>

      {user.banned && user.banReason && (
        <p className="mt-2 rounded-lg bg-red-50 p-2 text-[11px] font-semibold text-red-700">
          Motivo do banimento: “{user.banReason}”
        </p>
      )}

      {/* acções do administrador */}
      <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-border pt-2.5">
        <Button size="sm" variant="outline" className="h-8 rounded-full px-3 text-xs font-bold" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" /> Editar
        </Button>
        {onBan &&
          (user.banned ? (
            <Button
              size="sm"
              variant="outline"
              className="h-8 rounded-full border-emerald-200 px-3 text-xs font-bold text-emerald-700 hover:bg-emerald-50"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  await apiUpdateUser(token!, user.id, { banned: false, banReason: '' })
                  reload()
                  toast({ title: `${user.name} desbanido — já pode voltar a pedir ✅` })
                } catch {
                  toast({ title: 'Acção falhou', variant: 'destructive' })
                } finally {
                  setBusy(false)
                }
              }}
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Desbanir
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-8 rounded-full border-red-200 px-3 text-xs font-bold text-red-600 hover:bg-red-50"
              onClick={onBan}
            >
              <Ban className="h-3.5 w-3.5" /> Banir
            </Button>
          ))}
        {user.role !== 'CLIENTE' && !isSelf && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 rounded-full px-3 text-xs font-bold"
            disabled={busy}
            onClick={toggleActive}
          >
            {user.active ? 'Desactivar' : 'Reactivar'}
          </Button>
        )}
        {!isSelf && (
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto h-8 rounded-full px-3 text-xs font-bold text-red-600 hover:bg-red-50"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" /> Eliminar
          </Button>
        )}
      </div>
    </div>
  )
}

/** Dialog: criar perfil de trabalhador (admin, atendente, editor, motoboy ou motorista). */
function CreateUserDialog({
  open,
  onOpenChange,
  token,
  onSaved,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  token: string
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'ADMIN' | 'ATENDENTE' | 'EDITOR' | 'MOTOBOY' | 'MOTORISTA'>('MOTOBOY')
  const [vehicle, setVehicle] = useState('')
  const [plate, setPlate] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const ROLE_ICONS: Record<string, typeof Bike> = {
    ADMIN: Warehouse,
    ATENDENTE: Headset,
    EDITOR: PenLine,
    MOTOBOY: Bike,
    MOTORISTA: Car,
  }
  const isDelivery = role === 'MOTOBOY' || role === 'MOTORISTA'

  async function save() {
    if (!name.trim() || !email.trim() || password.length < 4) {
      toast({
        title: 'Dados incompletos',
        description: 'Preencha nome, e-mail e senha (mínimo 4 caracteres).',
        variant: 'destructive',
      })
      return
    }
    setSaving(true)
    try {
      await apiCreateUser(token, {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
        role,
        vehicle: vehicle.trim(),
        plate: plate.trim(),
        photo,
      })
      setName(''); setEmail(''); setPhone(''); setPassword(''); setVehicle(''); setPlate(''); setPhoto(null)
      onSaved()
      toast({
        title: `Perfil de ${(ROLE_LABEL[role] ?? role).toLowerCase()} criado ✅`,
        description: `${email.trim()} já pode entrar com a senha definida.`,
      })
    } catch (err) {
      toast({
        title: 'Erro ao criar perfil',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Criar perfil de trabalhador</DialogTitle>
          <DialogDescription>
            O novo perfil entra na app com o seu próprio e-mail e senha.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {/* foto de perfil do trabalhador */}
          <PhotoPicker
            value={photo}
            onChange={setPhoto}
            name={name || 'T'}
            label="Foto do trabalhador (opcional)"
            hint="Aparece no painel dele e na lista de perfis. Comprime automaticamente."
          />

          {/* tipo de perfil */}
          <div className="grid grid-cols-2 gap-2">
            {(['MOTOBOY', 'MOTORISTA', 'ATENDENTE', 'EDITOR', 'ADMIN'] as const).map((r) => {
              const Icon = ROLE_ICONS[r]
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`rounded-xl border-2 p-3 text-center transition-all ${
                    role === r ? 'border-primary bg-secondary/60 shadow-sm' : 'border-border bg-white hover:border-input'
                  } ${r === 'ADMIN' ? 'col-span-2' : ''}`}
                >
                  <Icon className="mx-auto h-6 w-6 text-primary" />
                  <p className="mt-1 text-xs font-black text-navy">{ROLE_LABEL[r]}</p>
                  <p className="text-[10px] leading-tight text-muted-foreground">{ROLE_DESCRIPTION[r]}</p>
                </button>
              )
            })}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nu-name">Nome completo *</Label>
            <Input id="nu-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Manuel Neto" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nu-email">E-mail de entrada *</Label>
            <Input id="nu-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Ex.: manuel@gotareal.ao" inputMode="email" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nu-phone">Telefone</Label>
            <Input id="nu-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="923 000 333" inputMode="tel" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nu-password" className="flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5 text-primary" /> Senha de entrada *
            </Label>
            <Input
              id="nu-password"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 4 caracteres"
            />
            <p className="text-[10px] text-muted-foreground">
              Entregue esta senha ao trabalhador para ele entrar na app.
            </p>
          </div>

          {isDelivery && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="nu-vehicle">Veículo</Label>
                <Input
                  id="nu-vehicle"
                  value={vehicle}
                  onChange={(e) => setVehicle(e.target.value)}
                  placeholder={role === 'MOTORISTA' ? 'Carro ligeiro' : 'Mota'}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nu-plate">Matrícula</Label>
                <Input id="nu-plate" value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="LD-0000-AA" />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving} className="h-11 w-full rounded-xl font-black">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            CRIAR PERFIL
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Dialog: editar um perfil (dados, senha, tipo). */
function EditUserDialog({
  user,
  token,
  onOpenChange,
  onSaved,
}: {
  user: UserDTO
  token: string
  onOpenChange: (o: boolean) => void
  onSaved: () => void
}) {
  const { toast } = useToast()
  const { auth, setAuth } = useAppStore()
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [phone, setPhone] = useState(user.phone ?? '')
  const [password, setPassword] = useState('')
  const [vehicle, setVehicle] = useState(user.courier?.vehicle ?? '')
  const [plate, setPlate] = useState(user.courier?.plate ?? '')
  const [photo, setPhoto] = useState<string | null>(user.photo ?? user.customer?.photo ?? null)
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!name.trim() || !email.trim()) {
      toast({ title: 'Nome e e-mail são obrigatórios.', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const { user: updated } = await apiUpdateUser(token, user.id, {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        ...(password.trim() ? { password: password.trim() } : {}),
        ...(user.courier ? { vehicle: vehicle.trim(), plate: plate.trim() } : {}),
        photo,
      })
      // se o administrador editou o PRÓPRIO perfil, actualiza a sessão
      // (o avatar do cabeçalho muda na hora)
      if (auth && auth.user.id === user.id) {
        setAuth({ token: auth.token, user: updated })
      }
      onSaved()
      toast({
        title: 'Perfil actualizado ✅',
        description: password.trim() ? 'A nova senha já está activa.' : undefined,
      })
    } catch (err) {
      toast({
        title: 'Erro ao guardar',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Editar perfil — {ROLE_LABEL[user.role] ?? user.role}</DialogTitle>
          <DialogDescription>
            {user.role === 'CLIENTE'
              ? 'Dados do perfil de cliente.'
              : 'Dados do trabalhador. A senha só muda se preencher uma nova.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {/* foto de perfil — administrador, motoboy ou cliente */}
          <PhotoPicker
            value={photo}
            onChange={setPhoto}
            name={name || user.name}
            label="Foto de perfil"
            hint="Aparece no painel da pessoa e nas listas da Central."
          />
          <div className="space-y-1.5">
            <Label htmlFor="eu-name">Nome</Label>
            <Input id="eu-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eu-email">E-mail de entrada</Label>
            <Input id="eu-email" value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eu-phone">Telefone</Label>
            <Input id="eu-phone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eu-password" className="flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5 text-primary" /> Nova senha (opcional)
            </Label>
            <Input
              id="eu-password"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Deixe vazio para manter a actual"
            />
          </div>
          {user.courier && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="eu-vehicle">Veículo</Label>
                <Input id="eu-vehicle" value={vehicle} onChange={(e) => setVehicle(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="eu-plate">Matrícula</Label>
                <Input id="eu-plate" value={plate} onChange={(e) => setPlate(e.target.value)} />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving} className="h-11 w-full rounded-xl font-black">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            GUARDAR ALTERAÇÕES
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Dialog: banir cliente por má conduta (com motivo). */
function BanUserDialog({
  user,
  token,
  onClose,
  onDone,
}: {
  user: UserDTO
  token: string
  onClose: () => void
  onDone: () => void
}) {
  const { toast } = useToast()
  const [reason, setReason] = useState('Má conduta')
  const [custom, setCustom] = useState('')
  const [saving, setSaving] = useState(false)

  const REASONS = ['Má conduta', 'Não pagou entregas', 'Falsos pedidos', 'Abuso verbal à equipa']

  async function confirmBan() {
    const finalReason = custom.trim() || reason
    setSaving(true)
    try {
      await apiUpdateUser(token, user.id, { banned: true, banReason: finalReason })
      onDone()
      toast({
        title: `${user.name} foi banido 🚫`,
        description: 'Ele deixa de conseguir fazer pedidos e vê o motivo do bloqueio.',
      })
    } catch (err) {
      toast({
        title: 'Erro ao banir',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-red-700">Banir {user.name}?</DialogTitle>
          <DialogDescription>
            O cliente fica impedido de fazer pedidos e passa a ver um aviso de conta suspensa
            com o motivo. Pode desbanir quando quiser.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Motivo do banimento</Label>
          <div className="grid gap-1.5">
            {REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setReason(r)
                  setCustom('')
                }}
                className={`rounded-xl border-2 p-2.5 text-left text-xs font-bold transition-all ${
                  reason === r && !custom ? 'border-red-400 bg-red-50' : 'border-border bg-white hover:border-red-200'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <Input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Ou escreva outro motivo…"
          />
        </div>
        <DialogFooter className="flex-row gap-2">
          <Button variant="outline" className="flex-1 font-bold" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="destructive" className="flex-1 font-bold" disabled={saving} onClick={confirmBan}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
            BANIR
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------- Ajustes: dados da loja ----------------
function StoreSettingsPanel() {
  const { auth } = useAppStore()
  const token = auth?.token ?? null
  const { store, loading } = useStoreConfig()
  const { toast } = useToast()

  const [name, setName] = useState('')
  const [tagline, setTagline] = useState('')
  const [phone, setPhone] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [address, setAddress] = useState('')
  const [hours, setHours] = useState('')
  const [deliveryFee, setDeliveryFee] = useState('0')
  const [minOrder, setMinOrder] = useState('0')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)
  // localização GPS da base da empresa (capturada tal como o cliente faz)
  const [hqLoc, setHqLoc] = useState<PickedLocation | null>(null)

  // carrega os valores actuais assim que a loja chegar
  if (store && !loaded) {
    setName(store.name)
    setTagline(store.tagline)
    setPhone(store.phone)
    setWhatsapp(store.whatsapp)
    setAddress(store.address)
    setHours(store.hours)
    setDeliveryFee(String(store.deliveryFeeKz))
    setMinOrder(String(store.minOrderKz))
    setNote(store.note)
    if (store.latitude != null && store.longitude != null) {
      setHqLoc({
        lat: store.latitude,
        lng: store.longitude,
        accuracy: store.locationAccuracy ?? null,
        source: store.locationSource === 'simulado' ? 'simulado' : 'gps',
        address: store.address,
      })
    }
    setLoaded(true)
  }

  async function save() {
    if (!name.trim()) {
      toast({ title: 'O nome da loja é obrigatório.', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      await apiUpdateStore(token!, {
        name: name.trim(),
        tagline: tagline.trim(),
        phone: phone.trim(),
        whatsapp: whatsapp.trim(),
        address: address.trim(),
        hours: hours.trim(),
        deliveryFeeKz: Number(deliveryFee) || 0,
        minOrderKz: Number(minOrder) || 0,
        note: note.trim(),
        ...(hqLoc
          ? {
              latitude: hqLoc.lat,
              longitude: hqLoc.lng,
              locationAccuracy: hqLoc.accuracy ?? null,
              locationSource: hqLoc.source,
            }
          : store?.latitude != null
            ? { clearLocation: true }
            : {}),
      })
      toast({
        title: 'Dados da loja guardados ✅',
        description: hqLoc
          ? 'A base GPS da empresa está activa — o cliente vê a origem da entrega no mapa.'
          : 'Já estão visíveis para os clientes na app.',
      })
    } catch (err) {
      toast({
        title: 'Erro ao guardar',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading || !store) {
    return <p className="py-8 text-center text-sm text-muted-foreground">a carregar dados da loja…</p>
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border-2 border-dashed border-primary/30 bg-secondary/50 p-3.5">
        <p className="flex items-center gap-2 text-sm font-black text-navy">
          <Building2 className="h-4.5 w-4.5 text-primary" /> Dados da loja
        </p>
        <p className="mt-1 text-xs leading-snug text-muted-foreground">
          Preencha os dados que os clientes vêem na app (perfil e informações de contacto).
          Os Ajustes são exclusivos do administrador — os restantes perfis da equipa não têm acesso.
        </p>
      </div>

      <div className="space-y-3 rounded-2xl border border-border bg-white p-4 shadow-sm">
        <div className="space-y-1.5">
          <Label htmlFor="st-name">Nome da loja</Label>
          <Input id="st-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Gota REAL" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="st-tagline">Slogan</Label>
          <Input id="st-tagline" value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Água purificada entregue onde estiver" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="st-phone">Telefone</Label>
            <Input id="st-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+244 923 000 000" inputMode="tel" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="st-whatsapp">WhatsApp</Label>
            <Input id="st-whatsapp" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+244 923 000 000" inputMode="tel" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="st-address" className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-primary" /> Endereço
          </Label>
          <Input id="st-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rua da Independência, Luanda" />
        </div>

        {/* localização GPS da base da empresa */}
        <div className="space-y-3 rounded-2xl border-2 border-primary/25 bg-secondary/40 p-3.5">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-black text-navy">
              <MapPin className="h-4 w-4 text-primary" /> Localização GPS da base (empresa)
            </p>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
              Capture o ponto exacto de onde sai a mercadoria — igual ao cliente faz no cadastro.
              O cliente passa a ver a base no mapa e acompanhar o trajecto até à sua porta.
            </p>
          </div>
          <LocationPicker
            value={hqLoc}
            onChange={(loc) => {
              setHqLoc(loc)
              // o endereço descritivo acompanha a localização capturada
              if (loc?.address) setAddress(loc.address)
            }}
            compact
          />
          {hqLoc && (
            <button
              type="button"
              onClick={() => setHqLoc(null)}
              className="text-[11px] font-bold text-red-600 underline underline-offset-2"
            >
              Remover localização da base
            </button>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="st-hours" className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-primary" /> Horário de funcionamento
          </Label>
          <Input id="st-hours" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="Seg–Sáb: 7h00–19h00" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="st-fee">Taxa de entrega (Kz)</Label>
            <Input id="st-fee" inputMode="numeric" value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value.replace(/[^0-9]/g, ''))} placeholder="0" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="st-min">Pedido mínimo (Kz)</Label>
            <Input id="st-min" inputMode="numeric" value={minOrder} onChange={(e) => setMinOrder(e.target.value.replace(/[^0-9]/g, ''))} placeholder="0" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="st-note">Nota para os clientes</Label>
          <Textarea id="st-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: Pagamento por TPA ou dinheiro na entrega." />
        </div>

        <Button onClick={save} disabled={saving} className="h-12 w-full rounded-2xl font-black">
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          GUARDAR DADOS DA LOJA
        </Button>
      </div>
    </div>
  )
}
