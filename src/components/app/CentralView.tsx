'use client'

import { useMemo, useState } from 'react'
import { useAppStore, formatKz, formatLiters, formatTime, formatDateTime, durationMinutes } from '@/store/app-store'
import { useAllOrders, useFeedback, useCouriers, useProducts } from '@/components/app/hooks'
import { StatusBadge, PaymentBadge } from '@/components/app/Badges'
import { OrderTimeline } from '@/components/app/OrderTimeline'
import { ProductArt } from '@/components/app/ProductArt'
import { orderAction, respondFeedback, updateProduct, createProduct, createCourier } from '@/lib/api'
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
import type { Order, Product } from '@/lib/types'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  Bike,
  Check,
  ClipboardList,
  Loader2,
  MessageSquareWarning,
  Package,
  Phone,
  Plus,
  Reply,
  Send,
  Timer,
  TrendingUp,
  Truck,
  User,
  Warehouse,
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
  return (
    <div className="min-h-dvh bg-background pb-24">
      {/* cabeçalho */}
      <header className="gota-gradient px-4 pb-16 pt-5 text-white shadow-lg">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <BackToCustomerButton light />
          <div className="flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#BDE3F5]">
              painel operativo
            </p>
            <h1 className="text-lg font-black leading-tight">Central Gota REAL 👑</h1>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ring-1 ring-white/25">
            <span className="live-dot" /> ao vivo
          </span>
        </div>
      </header>

      <div className="mx-auto -mt-11 max-w-5xl space-y-5 px-4">
        <CentralStats />
        <CentralTabs />
      </div>
    </div>
  )
}

function BackToCustomerButton({ light = false }: { light?: boolean }) {
  const { setMode } = useAppStore()
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setMode('cliente')}
      className={cn(light ? 'text-white hover:bg-white/15 hover:text-white' : '')}
      aria-label="Voltar ao app do cliente"
    >
      <ArrowLeft className="h-5 w-5" />
    </Button>
  )
}

function CentralStats() {
  const { orders } = useAllOrders()
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

  const items = [
    { icon: ClipboardList, label: 'pedidos hoje', value: stats.todayCount, accent: 'text-primary bg-secondary' },
    { icon: Timer, label: 'solicitados', value: stats.pending, accent: 'text-amber-600 bg-amber-100' },
    { icon: Truck, label: 'em trânsito', value: stats.inTransit, accent: 'text-blue-600 bg-blue-100' },
    { icon: Check, label: 'entregues hoje', value: stats.deliveredToday, accent: 'text-emerald-600 bg-emerald-100' },
    { icon: TrendingUp, label: 'faturação hoje', value: formatKz(stats.revenueToday), accent: 'text-gold bg-gold/15' },
    { icon: Bike, label: 'tempo médio', value: stats.avgMin != null ? `${stats.avgMin} min` : '—', accent: 'text-navy bg-secondary' },
  ]

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      {items.map(({ icon: Icon, label, value, accent }) => (
        <div key={label} className="rounded-2xl border border-border bg-white p-3 shadow-md">
          <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', accent)}>
            <Icon className="h-4 w-4" />
          </span>
          <p className="mt-2 truncate text-lg font-black leading-none text-navy">{value}</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
        </div>
      ))}
    </div>
  )
}

function CentralTabs() {
  return (
    <Tabs defaultValue="pedidos">
      <TabsList className="grid w-full grid-cols-4 rounded-xl bg-secondary p-1">
        <TabsTrigger value="pedidos" className="rounded-lg text-xs font-bold data-[state=active]:bg-white">
          <ClipboardList className="mr-1 h-3.5 w-3.5" /> Pedidos
        </TabsTrigger>
        <TabsTrigger value="feedback" className="rounded-lg text-xs font-bold data-[state=active]:bg-white">
          <MessageSquareWarning className="mr-1 h-3.5 w-3.5" /> Mensagens
        </TabsTrigger>
        <TabsTrigger value="produtos" className="rounded-lg text-xs font-bold data-[state=active]:bg-white">
          <Package className="mr-1 h-3.5 w-3.5" /> Produtos
        </TabsTrigger>
        <TabsTrigger value="equipa" className="rounded-lg text-xs font-bold data-[state=active]:bg-white">
          <Bike className="mr-1 h-3.5 w-3.5" /> Equipa
        </TabsTrigger>
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
      <TabsContent value="equipa" className="mt-4">
        <TeamPanel />
      </TabsContent>
    </Tabs>
  )
}

// ---------------- Pedidos ----------------
function OrdersPanel() {
  const { orders, loading } = useAllOrders()
  const [filter, setFilter] = useState('todos')
  const [detail, setDetail] = useState<Order | null>(null)

  const filtered = filter === 'todos' ? orders : orders.filter((o) => o.status === filter)
  const detailLive = detail ? orders.find((o) => o.id === detail.id) ?? detail : null

  if (detailLive) {
    return <CentralOrderDetail order={detailLive} onBack={() => setDetail(null)} />
  }

  return (
    <div className="space-y-3">
      {/* filtros */}
      <div className="custom-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              'shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all',
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
  const [busy, setBusy] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)

  async function act(action: 'confirm' | 'assign' | 'cancel', courierId?: string) {
    setBusy(true)
    try {
      await orderAction(order.id, action, courierId)
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
          <div>
            <p className="text-sm font-black text-navy">
              #{order.number} · {order.customer?.name}
              {order.status === 'pendente' && <span className="live-dot ml-2 align-middle" />}
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <Phone className="h-3 w-3" /> {order.customer?.phone} · {formatTime(order.requestedAt)}
            </p>
          </div>
          <StatusBadge status={order.status} />
        </div>
        <div className="mt-2.5 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {order.items.reduce((s, i) => s + i.quantity, 0)} itens · {formatLiters(order.totalLiters)} ·{' '}
            <b className="text-foreground">{formatKz(order.totalKz)}</b>
          </span>
          <PaymentBadge method={order.paymentMethod} />
        </div>
        {order.courier && (
          <p className="mt-2 flex items-center gap-1 rounded-lg bg-gold/15 px-2 py-1 text-[11px] font-bold text-[#6B5410]">
            <Bike className="h-3 w-3" /> {order.courier.name} · {order.courier.vehicle}
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
                <span className="flex h-10 w-10 items-center justify-center rounded-xl gota-gradient text-white">
                  <Bike className="h-5 w-5" />
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-black text-navy">{c.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {c.vehicle} · {c.plate}
                  </span>
                </span>
                <span
                  className={cn(
                    'rounded-full border px-2 py-0.5 text-[10px] font-bold',
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
          <div>
            <h3 className="text-base font-black text-navy">Pedido nº {order.number}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatDateTime(order.requestedAt)} · {order.customer?.phone}
            </p>
          </div>
          <StatusBadge status={order.status} />
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
            <Bike className="h-4 w-4 text-gold" />
            <p className="font-bold text-[#6B5410]">
              {order.courier.name} · {order.courier.vehicle} · {order.courier.plate} · {order.courier.phone}
            </p>
          </div>
        )}

        <ul className="mt-3 space-y-1.5 border-t border-border pt-3">
          {order.items.map((i) => (
            <li key={i.id} className="flex items-center justify-between text-xs">
              <span className="text-foreground">
                {i.quantity}× {i.productName}
              </span>
              <b className="text-navy">{formatKz(i.unitPriceKz * i.quantity)}</b>
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
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)

  async function send(fbid: string) {
    setSending(true)
    try {
      await respondFeedback(fbid, reply.trim())
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
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-xl',
                  f.type === 'sugestao' ? 'bg-secondary text-primary' : 'bg-red-100 text-red-600'
                )}
              >
                {f.type === 'sugestao' ? '💡' : '⚠️'}
              </span>
              <div>
                <p className="text-sm font-black text-navy">{f.subject}</p>
                <p className="text-[11px] text-muted-foreground">
                  {f.customer?.name ?? 'Anónimo'} · {f.customer?.phone ?? '—'} ·{' '}
                  {formatDateTime(f.createdAt)}
                </p>
              </div>
            </div>
            <Badge
              variant="outline"
              className={cn(
                'text-[10px]',
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
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)

  return (
    <div className="space-y-3">
      <Button className="h-10 w-full rounded-xl font-bold" onClick={() => setAddOpen(true)}>
        <Plus className="h-4 w-4" /> Novo produto à venda
      </Button>

      {products.map((p) => (
        <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-border bg-white p-3 shadow-sm">
          <div className="h-16 w-16 shrink-0">
            <ProductArt kind={p.kind} volumeL={p.volumeL} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-navy">{p.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatKz(p.priceKz)} · stock {p.stock} · {p.category === 'agua' ? 'água' : 'acessório'}
            </p>
          </div>
          <Switch
            checked={p.active}
            onCheckedChange={async (v) => {
              await updateProduct(p.id, { active: v })
              reload()
            }}
            aria-label={`Activar/desactivar ${p.name}`}
          />
          <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => setEditing(p)} aria-label={`Editar ${p.name}`}>
            <Warehouse className="h-4 w-4" />
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
  const [name, setName] = useState(product?.name ?? '')
  const [price, setPrice] = useState(String(product?.priceKz ?? ''))
  const [stock, setStock] = useState(String(product?.stock ?? '50'))
  const [category, setCategory] = useState(product?.category ?? 'agua')
  const [volume, setVolume] = useState(String(product?.volumeL ?? ''))
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!name.trim() || !price) {
      toast({ title: 'Nome e preço são obrigatórios', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const body = {
        name: name.trim(),
        priceKz: Number(price),
        stock: Number(stock) || 0,
        category,
        kind: category === 'agua' ? (Number(volume) >= 5 ? 'garrafao' : 'garrafa') : 'acessorio',
        volumeL: Number(volume) || 0,
        unitLabel: category === 'agua' ? `${volume ?? ''}L` : 'unidade',
      }
      if (product) {
        await updateProduct(product.id, body)
        toast({ title: 'Produto actualizado ✅' })
      } else {
        await createProduct(body)
        toast({ title: 'Produto criado e à venda! ✅' })
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
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{product ? 'Editar produto' : 'Novo produto'}</DialogTitle>
          <DialogDescription>
            Produtos activos ficam disponíveis na loja do cliente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="pf-name">Nome</Label>
            <Input id="pf-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Bidão 5L" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="pf-price">Preço (Kz)</Label>
              <Input id="pf-price" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="600" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-stock">Stock</Label>
              <Input id="pf-stock" inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="100" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
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
              <Label htmlFor="pf-vol">Volume (L)</Label>
              <Input id="pf-vol" inputMode="decimal" value={volume} onChange={(e) => setVolume(e.target.value)} placeholder="5" disabled={category === 'acessorio'} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving} className="w-full font-bold">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Guardar produto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------- Equipa ----------------
function TeamPanel() {
  const { couriers, reload } = useCouriers()
  const { toast } = useToast()
  const [addOpen, setAddOpen] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [vehicle, setVehicle] = useState('')
  const [plate, setPlate] = useState('')
  const [saving, setSaving] = useState(false)

  async function addCourier() {
    if (!name.trim()) return
    setSaving(true)
    try {
      await createCourier({
        name: name.trim(),
        phone: phone.trim(),
        vehicle: vehicle.trim() || 'Mota',
        plate: plate.trim(),
        latitude: -8.847,
        longitude: 13.241,
      })
      setName(''); setPhone(''); setVehicle(''); setPlate('')
      setAddOpen(false)
      reload()
      toast({ title: 'Motoboy adicionado à equipa 🛵' })
    } catch (err) {
      toast({
        title: 'Erro ao adicionar',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <Button className="h-10 w-full rounded-xl font-bold" onClick={() => setAddOpen(true)}>
        <Plus className="h-4 w-4" /> Adicionar motoboy
      </Button>

      {couriers.map((c) => (
        <div key={c.id} className="flex items-center gap-3 rounded-2xl border border-border bg-white p-3.5 shadow-sm">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl gota-gradient text-white shadow-md">
            <User className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-navy">{c.name}</p>
            <p className="text-xs text-muted-foreground">
              {c.phone || '—'} · {c.vehicle} {c.plate && `(${c.plate})`}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {c.latitude != null ? `GPS: ${c.latitude.toFixed(4)}, ${c.longitude?.toFixed(4)}` : 'sem posição'}
            </p>
          </div>
          <span
            className={cn(
              'rounded-full border px-2.5 py-1 text-[10px] font-bold',
              c.available
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-amber-200 bg-amber-50 text-amber-700'
            )}
          >
            {c.available ? 'disponível' : `em entrega (${c.orders?.length ?? 0})`}
          </span>
        </div>
      ))}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Adicionar motoboy</DialogTitle>
            <DialogDescription>O novo motoboy passa a receber entregas no painel dele.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cr-name">Nome</Label>
              <Input id="cr-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Manuel Neto" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cr-phone">Telefone</Label>
              <Input id="cr-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="923 000 333" inputMode="tel" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="cr-vehicle">Veículo</Label>
                <Input id="cr-vehicle" value={vehicle} onChange={(e) => setVehicle(e.target.value)} placeholder="Mota" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cr-plate">Matrícula</Label>
                <Input id="cr-plate" value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="LD-0000-AA" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={addCourier} disabled={saving || !name.trim()} className="w-full font-bold">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Adicionar à equipa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
