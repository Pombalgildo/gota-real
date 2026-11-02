'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore, formatKz, formatLiters, formatTime, formatDateTime, durationMinutes } from '@/store/app-store'
import { useAllOrders, useFeedback, useCouriers, useProducts, useUsers, useStoreConfig } from '@/components/app/hooks'
import { StatusBadge, PaymentBadge } from '@/components/app/Badges'
import { OrderTimeline } from '@/components/app/OrderTimeline'
import { ProductPhoto } from '@/components/app/ProductPhoto'
import { Avatar, PhotoPicker } from '@/components/app/Avatar'
import { LocationPicker, type PickedLocation } from '@/components/app/LocationPicker'
import { resizeImageToDataUrl } from '@/lib/image'
import { fetchReports, type ReportData } from '@/lib/api'
import { LogoutButton } from '@/components/app/LoginDialog'
import { InstallPrompt } from '@/components/app/InstallPrompt'
import { AlertBell, AlertsSettingsCard } from '@/components/app/AlertCenter'
import {
  orderAction,
  respondFeedback,
  resolveDispute,
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
  BarChart3,
  Bike,
  Building2,
  Camera,
  Car,
  Check,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Droplets,
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
  Printer,
  Reply,
  Save,
  Send,
  ShieldAlert,
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
  // anti-burla: entregas que o cliente diz NÃO ter recebido
  { key: 'reclamacao', label: '⚠️ Reclamações' },
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
          {/* sino dos avisos: pedido novo e mensagem nova tocam
              o alarme sonoro até a equipa visualizar */}
          <AlertBell light />
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
  // aba activa guardada na loja global: o alarme sonoro consegue levar
  // a equipa directo ao pedido/mensagem que originou o aviso
  const centralTab = useAppStore((s) => s.centralTab)
  const setCentralTab = useAppStore((s) => s.setCentralTab)
  // abas conforme o perfil: só o ADMIN vê Perfis e Ajustes
  const canManageOrders = ORDER_MANAGER_ROLES.includes(role)
  const canManageCatalog = CATALOG_ROLES.includes(role)
  const isAdmin = role === 'ADMIN'
  const tabs = [
    ...(canManageOrders ? [{ value: 'pedidos', label: 'Pedidos', icon: ClipboardList }] : []),
    ...(canManageOrders ? [{ value: 'feedback', label: 'Mensagens', icon: MessageSquareWarning }] : []),
    ...(canManageOrders ? [{ value: 'relatorios', label: 'Relatórios', icon: BarChart3 }] : []),
    ...(canManageCatalog ? [{ value: 'produtos', label: 'Loja', icon: Store }] : []),
    ...(isAdmin ? [{ value: 'perfis', label: 'Perfis', icon: Users }] : []),
    ...(isAdmin ? [{ value: 'ajustes', label: 'Ajustes', icon: Building2 }] : []),
  ]
  const defaultTab = tabs[0]?.value ?? 'pedidos'
  const activeTab = tabs.some((t) => t.value === centralTab) ? centralTab : defaultTab

  return (
    <Tabs value={activeTab} onValueChange={(v) => setCentralTab(v as typeof centralTab)}>
      <TabsList
        className={cn(
          'grid h-auto w-full gap-1.5 rounded-xl bg-secondary p-1.5',
          tabs.length === 1 && 'grid-cols-1',
          tabs.length === 2 && 'grid-cols-2',
          tabs.length === 3 && 'grid-cols-3',
          tabs.length === 4 && 'grid-cols-3 sm:grid-cols-4',
          tabs.length >= 5 && 'grid-cols-3 sm:grid-cols-6'
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
      <TabsContent value="relatorios" className="mt-4">
        <ReportsPanel />
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

  // "reclamacao" = cliente disse que NÃO recebeu e a central ainda não respondeu
  const filtered =
    filter === 'todos'
      ? orders
      : filter === 'reclamacao'
        ? orders.filter((o) => o.receiptStatus === 'disputado' && !o.disputeResolvedAt)
        : orders.filter((o) => o.status === filter)
  const openDisputes = orders.filter((o) => o.receiptStatus === 'disputado' && !o.disputeResolvedAt).length
  const detailLive = detail ? orders.find((o) => o.id === detail.id) ?? detail : null

  if (detailLive) {
    return <CentralOrderDetail order={detailLive} onBack={() => setDetail(null)} onUpdated={reload} />
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
                : 'border-border bg-white text-muted-foreground hover:border-input',
              f.key === 'reclamacao' && openDisputes > 0 && filter !== f.key
                ? 'border-red-300 bg-red-50 text-red-700'
                : ''
            )}
          >
            {f.label}
            {f.key === 'reclamacao' && openDisputes > 0 && (
              <span className="ml-1.5 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-black text-white">
                {openDisputes}
              </span>
            )}
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
        {order.receiptStatus === 'disputado' && !order.disputeResolvedAt && (
          <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-red-100 px-2 py-1.5 text-[11px] font-black text-red-700">
            <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 truncate">
              CLIENTE DIZ QUE NÃO RECEBEU — responder
            </span>
          </p>
        )}
        {order.status === 'entregue' && order.receiptStatus === 'pendente' && (
          <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-100 px-2 py-1.5 text-[11px] font-bold text-amber-800">
            <ClipboardCheck className="h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 truncate">à espera da confirmação do cliente</span>
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

function CentralOrderDetail({ order, onBack, onUpdated }: { order: Order; onBack: () => void; onUpdated?: () => void }) {
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

      {/* ANTI-BURLA: confirmação de recepção do cliente e reclamações */}
      {order.status === 'entregue' && <CentralReceiptSection order={order} onUpdated={onUpdated} />}
    </div>
  )
}

/* -------- Confirmação de recepção (anti-burla) na Central -------- */
function CentralReceiptSection({ order, onUpdated }: { order: Order; onUpdated?: () => void }) {
  const { toast } = useToast()
  const { auth } = useAppStore()
  const [busy, setBusy] = useState(false)
  const [resolveOpen, setResolveOpen] = useState(false)
  const [resolution, setResolution] = useState('')

  async function resolve() {
    setBusy(true)
    try {
      await resolveDispute(auth?.token ?? '', order.id, resolution.trim())
      setResolveOpen(false)
      setResolution('')
      toast({ title: 'Reclamação respondida ✅', description: 'A resposta ficou registada e o cliente foi notificado.' })
      onUpdated?.()
    } catch (err) {
      toast({
        title: 'Erro ao responder',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setBusy(false)
    }
  }

  const disputed = order.receiptStatus === 'disputado'
  const resolved = disputed && order.disputeResolvedAt != null

  return (
    <section
      aria-labelledby="cr-title"
      className={cn(
        'rounded-2xl border-2 p-4 shadow-sm',
        disputed ? 'border-red-300 bg-red-50' : 'border-emerald-300 bg-emerald-50'
      )}
    >
      <h3 id="cr-title" className="flex items-center gap-1.5 text-sm font-black text-navy">
        {disputed ? (
          <ShieldAlert className="h-4 w-4 text-red-600" />
        ) : (
          <ClipboardCheck className="h-4 w-4 text-emerald-600" />
        )}
        Confirmação de recepção (anti-burla)
      </h3>

      {!order.receiptStatus && (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Pedido entregue antes do sistema de confirmação — sem registo de recepção.
        </p>
      )}

      {order.receiptStatus === 'pendente' && (
        <p className="mt-2 text-xs leading-relaxed text-amber-800">
          ⏳ O cliente ainda não confirmou. O alarme dele continua a tocar até responder
          <b> Recebi </b> ou <b> Não recebi</b>.
        </p>
      )}

      {order.receiptStatus === 'confirmado' && (
        <p className="mt-2 text-xs leading-relaxed text-emerald-800">
          ✅ O cliente confirmou que recebeu
          {order.receiptConfirmedAt ? ` em ${formatDateTime(order.receiptConfirmedAt)}` : ''}. Entrega validada.
        </p>
      )}

      {disputed && (
        <>
          <p className="mt-2 text-xs font-black text-red-700">
            ❌ O cliente diz que NÃO recebeu esta entrega!
          </p>
          <p className="mt-1.5 rounded-xl bg-white/80 p-2.5 text-xs italic leading-relaxed text-red-800">
            “{order.disputeReason ?? 'sem detalhes'}”
          </p>
          <p className="mt-1.5 text-[11px] text-red-600">
            reclamação {formatDateTime(order.receiptDisputedAt)}
            {order.courier ? ` · entregador: ${order.courier.name}` : ''}
          </p>

          {resolved ? (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-white p-3">
              <p className="text-xs font-black text-emerald-700">Caso respondido pela administração</p>
              <p className="mt-1 text-xs italic leading-relaxed text-foreground/80">
                “{order.disputeResolution ?? 'Caso analisado pela administração.'}”
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                respondido {formatDateTime(order.disputeResolvedAt)}
              </p>
            </div>
          ) : (
            <Button
              className="mt-3 h-11 w-full rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 font-black"
              disabled={busy}
              onClick={() => setResolveOpen(true)}
            >
              <ShieldCheck className="h-5 w-5" /> Responder e fechar o caso
            </Button>
          )}

          <Dialog open={resolveOpen} onOpenChange={setResolveOpen}>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Responder à reclamação do nº {order.number}</DialogTitle>
                <DialogDescription>
                  Descreva a resolução (contacto com o cliente, reentrega, esclarecimento…). A
                  resposta fica visível ao cliente no pedido dele.
                </DialogDescription>
              </DialogHeader>
              <Textarea
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                placeholder="Ex.: contactámos o cliente e reagendámos a entrega para hoje."
                maxLength={500}
                className="min-h-24"
              />
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setResolveOpen(false)} disabled={busy}>
                  Voltar
                </Button>
                <Button
                  className="bg-gradient-to-r from-red-600 to-rose-600 font-black"
                  disabled={busy}
                  onClick={resolve}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  Enviar resposta
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </section>
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

      {/* alarmes sonoros da central: pedido novo, mensagem nova… */}
      <AlertsSettingsCard />
    </div>
  )
}

/* ==================================================================== */
/* RELATÓRIOS DE ACTIVIDADE — diário / semanal / mensal                 */
/* Ferramenta do administrador e dos gestores (atendente) para seguir   */
/* a actividade da empresa: pedidos, faturação, entregadores, produtos  */
/* e alertas de não recepção. Impressão/PDF com um toque.               */
/* ==================================================================== */
type ReportPeriod = 'daily' | 'weekly' | 'monthly'

const REPORT_PERIODS: { key: ReportPeriod; label: string }[] = [
  { key: 'daily', label: 'Diário' },
  { key: 'weekly', label: 'Semanal' },
  { key: 'monthly', label: 'Mensal' },
]

function ReportsPanel() {
  const { auth } = useAppStore()
  const [period, setPeriod] = useState<ReportPeriod>('daily')
  const [ref, setRef] = useState(() => new Date().toISOString().slice(0, 10))
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load(p: ReportPeriod, r: string) {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchReports(auth?.token ?? '', p, r)
      setReport(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sem ligação ao servidor.')
    } finally {
      setLoading(false)
    }
  }

  // carrega na montagem e sempre que o período ou a data mudam
  useEffect(() => {
    load(period, ref)
  }, [period, ref])

  function shift(days: number, months = 0) {
    const d = new Date(`${ref}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() + days)
    d.setUTCMonth(d.getUTCMonth() + months)
    setRef(d.toISOString().slice(0, 10))
  }

  function shiftPeriod(dir: 1 | -1) {
    if (period === 'daily') shift(dir)
    else if (period === 'weekly') shift(7 * dir)
    else shift(0, dir)
  }

  const isToday = ref === new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-4">
      {/* selector de período */}
      <div className="rounded-2xl border border-border bg-white p-3 shadow-sm print:border-0 print:shadow-none">
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <div className="flex rounded-xl bg-secondary p-1">
            {REPORT_PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={cn(
                  'rounded-lg px-3.5 py-2 text-xs font-black transition-all',
                  period === p.key ? 'bg-white text-navy shadow' : 'text-muted-foreground'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <Button size="icon" variant="outline" className="h-9 w-9 rounded-xl" aria-label="Período anterior" onClick={() => shiftPeriod(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            {!isToday && (
              <Button size="sm" variant="secondary" className="h-9 rounded-xl text-xs font-bold" onClick={() => setRef(new Date().toISOString().slice(0, 10))}>
                Hoje
              </Button>
            )}
            <Button size="icon" variant="outline" className="h-9 w-9 rounded-xl" aria-label="Período seguinte" disabled={isToday} onClick={() => shiftPeriod(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" className="h-9 rounded-xl text-xs font-bold" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Imprimir / PDF
            </Button>
          </div>
        </div>
        {report && (
          <p className="mt-2 text-center text-sm font-black capitalize text-navy">
            {report.label}
          </p>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center rounded-2xl border border-border bg-white py-14 text-muted-foreground">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
          <p className="mt-2 text-sm font-semibold">a preparar o relatório…</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-red-300 bg-red-50/70 py-10 text-center">
          <WifiOff className="h-8 w-8 text-red-400" />
          <p className="mt-2 text-sm font-black text-red-700">{error}</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => load(period, ref)}>
            <RefreshCw className="h-4 w-4" /> Tentar novamente
          </Button>
        </div>
      ) : report ? (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <ReportKpi icon={ClipboardList} label="pedidos" value={String(report.kpis.ordersTotal)} accent="text-primary bg-secondary" />
            <ReportKpi icon={Check} label="entregues" value={String(report.kpis.delivered)} accent="text-emerald-600 bg-emerald-100" />
            <ReportKpi icon={TrendingUp} label="faturação entregue" value={formatKz(report.kpis.revenueKz)} accent="text-gold bg-gold/15" />
            <ReportKpi icon={Droplets} label="água entregue" value={formatLiters(report.kpis.liters)} accent="text-primary bg-secondary" />
            <ReportKpi icon={Timer} label="tempo médio" value={report.kpis.avgDeliveryMin != null ? `${report.kpis.avgDeliveryMin} min` : '—'} accent="text-navy bg-secondary" />
            <ReportKpi icon={XCircle} label="cancelados" value={String(report.kpis.cancelled)} accent="text-red-600 bg-red-100" />
            <ReportKpi icon={Users} label="novos clientes" value={String(report.kpis.newCustomers)} accent="text-emerald-600 bg-emerald-100" />
            <ReportKpi icon={MessageSquareWarning} label="mensagens" value={String(report.kpis.messages)} accent="text-amber-600 bg-amber-100" />
            <ReportKpi
              icon={ShieldAlert}
              label="reclamações de entrega"
              value={`${report.kpis.disputesOpen} aberta${report.kpis.disputesOpen === 1 ? '' : 's'}`}
              accent={report.kpis.disputesOpen > 0 ? 'text-red-600 bg-red-100' : 'text-emerald-600 bg-emerald-100'}
            />
          </div>

          {/* recepções confirmadas (anti-burla) */}
          <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
            <h4 className="flex items-center gap-1.5 text-sm font-black text-navy">
              <ShieldCheck className="h-4 w-4 text-emerald-600" /> Confirmações de recepção (anti-burla)
            </h4>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-emerald-50 p-2.5">
                <p className="text-lg font-black text-emerald-700">{report.kpis.receiptsConfirmed}</p>
                <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">confirmadas</p>
              </div>
              <div className="rounded-xl bg-amber-50 p-2.5">
                <p className="text-lg font-black text-amber-700">{report.kpis.receiptsPending}</p>
                <p className="text-[10px] font-bold uppercase tracking-wide text-amber-600">pendentes</p>
              </div>
              <div className="rounded-xl bg-red-50 p-2.5">
                <p className="text-lg font-black text-red-700">{report.kpis.disputesOpen + report.kpis.disputesResolved}</p>
                <p className="text-[10px] font-bold uppercase tracking-wide text-red-600">
                  disputas ({report.kpis.disputesResolved} respondidas)
                </p>
              </div>
            </div>
          </div>

          {/* gráfico de actividade */}
          <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
            <h4 className="flex items-center gap-1.5 text-sm font-black text-navy">
              <BarChart3 className="h-4 w-4 text-primary" /> Actividade {period === 'daily' ? 'do dia (por hora)' : period === 'weekly' ? 'da semana' : 'do mês'}
            </h4>
            <ReportChart series={report.series} />
          </div>

          {/* topo de produtos */}
          <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
            <h4 className="flex items-center gap-1.5 text-sm font-black text-navy">
              <Package className="h-4 w-4 text-primary" /> Produtos mais pedidos
            </h4>
            {report.topProducts.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">Sem vendas neste período.</p>
            ) : (
              <ul className="mt-2.5 space-y-1.5">
                {report.topProducts.map((p, i) => (
                  <li key={p.name} className="flex items-center gap-2.5 text-xs">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-secondary font-black text-primary">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-bold text-foreground">{p.name}</span>
                    <span className="shrink-0 text-muted-foreground">{p.quantity} un.</span>
                    <b className="shrink-0 text-navy">{formatKz(p.revenueKz)}</b>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* entregadores */}
          <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
            <h4 className="flex items-center gap-1.5 text-sm font-black text-navy">
              <Bike className="h-4 w-4 text-gold" /> Desempenho dos entregadores
            </h4>
            {report.couriers.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">Sem entregas concluídas neste período.</p>
            ) : (
              <ul className="mt-2.5 space-y-1.5">
                {report.couriers.map((c, i) => (
                  <li key={c.name} className="flex items-center gap-2.5 text-xs">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gold/20 font-black text-[#6B5410]">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-bold text-foreground">{c.name}</span>
                    <span className="shrink-0 text-muted-foreground">{c.deliveries} entregas</span>
                    <b className="shrink-0 text-navy">{c.avgMin != null ? `~${c.avgMin} min` : '—'}</b>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* pagamentos */}
          <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
            <h4 className="flex items-center gap-1.5 text-sm font-black text-navy">
              <ClipboardCheck className="h-4 w-4 text-primary" /> Pagamentos recebidos
            </h4>
            {report.payments.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">Sem entregas pagas neste período.</p>
            ) : (
              <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                {report.payments.map((p) => (
                  <div key={p.method} className="flex items-center justify-between rounded-xl bg-secondary/60 px-3 py-2.5 text-xs">
                    <span className="font-bold text-foreground">
                      {p.method === 'TPA' ? 'TPA (cartão)' : 'Dinheiro (cash)'}
                    </span>
                    <span className="text-muted-foreground">{p.count}× · <b className="text-navy">{formatKz(p.revenueKz)}</b></span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="pb-2 text-center text-[10px] text-muted-foreground print:hidden">
            gerado {formatDateTime(report.generatedAt)} · Gota REAL 👑
          </p>
        </>
      ) : null}
    </div>
  )
}

/** KPI individual do relatório. */
function ReportKpi({ icon: Icon, label, value, accent }: { icon: typeof Package; label: string; value: string; accent: string }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-3 shadow-md">
      <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', accent)}>
        <Icon className="h-4 w-4" />
      </span>
      <p className="mt-2 truncate text-lg font-black leading-none text-navy">{value}</p>
      <p className="mt-1 truncate text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  )
}

/** Gráfico de barras leve (CSS puro — sem bibliotecas, imprime bem). */
function ReportChart({ series }: { series: ReportData['series'] }) {
  const max = Math.max(1, ...series.map((s) => s.orders))
  const any = series.some((s) => s.orders > 0)
  if (!any) {
    return <p className="mt-2 text-xs text-muted-foreground">Sem pedidos neste período.</p>
  }
  return (
    <div className="mt-3 overflow-x-auto custom-scrollbar">
      <div className="flex min-w-full items-end gap-1" style={{ height: 120 }}>
        {series.map((s) => (
          <div key={s.key} className="flex min-w-4 flex-1 flex-col items-center justify-end gap-1" title={`${s.label}: ${s.orders} pedidos (${s.delivered} entregues)`}>
            <span className="text-[9px] font-bold text-muted-foreground">{s.orders > 0 ? s.orders : ''}</span>
            <div
              className={cn(
                'w-full rounded-t-sm',
                s.orders > 0 ? 'bg-gradient-to-t from-primary to-teal-400' : 'bg-secondary'
              )}
              style={{ height: `${Math.max(3, (s.orders / max) * 88)}%` }}
            />
            <span className="text-[8px] font-bold text-muted-foreground">{s.label}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] font-semibold text-muted-foreground">
        barras = pedidos recebidos · passe o dedo/rato para ver os valores
      </p>
    </div>
  )
}

