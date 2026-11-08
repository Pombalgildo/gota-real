'use client'

import { useState } from 'react'
import { useAppStore, formatKz, formatLiters, formatDateTime, durationMinutes } from '@/store/app-store'
import { useCustomerOrders, useCourierPosition, useDrivingRoute, useProducts, useStoreConfig } from '@/components/app/hooks'
import { OrderTimeline } from '@/components/app/OrderTimeline'
import { StatusBadge, PaymentBadge } from '@/components/app/Badges'
import { MiniMap } from '@/components/app/MiniMap'
import { ProductArt } from '@/components/app/ProductArt'
import { confirmReceipt, disputeReceipt } from '@/lib/api'
import { googleMapsNavUrl, CENTRAL_BASE } from '@/lib/geo'
import { cn } from '@/lib/utils'
import type { Order } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import {
  ArrowLeft,
  BadgeCheck,
  Bike,
  ChevronRight,
  Clock,
  Droplets,
  Loader2,
  MapPin,
  Navigation,
  PackageX,
  Phone,
  ReceiptText,
  RotateCcw,
  ShieldAlert,
  XCircle,
} from 'lucide-react'

export function OrdersView() {
  const { customer, trackingOrderId, openTracking } = useAppStore()
  const { orders, loading, reload } = useCustomerOrders(customer?.id)

  const tracked = trackingOrderId ? orders.find((o) => o.id === trackingOrderId) : null

  if (tracked) {
    return <TrackingDetail order={tracked} onBack={() => openTracking(null)} onUpdated={reload} />
  }

  return (
    <div className="space-y-3 pb-4">
      <h2 className="text-base font-black text-navy">Os meus pedidos</h2>

      {loading ? (
        Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-2xl" />
        ))
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-input bg-white/60 py-14 text-muted-foreground">
          <ReceiptText className="h-9 w-9 opacity-40" />
          <p className="mt-2 text-sm font-semibold">Ainda sem pedidos</p>
          <p className="mt-0.5 text-xs">Peça o seu primeiro bidão de água purificada!</p>
        </div>
      ) : (
        orders.map((order) => <OrderCard key={order.id} order={order} />)
      )}
    </div>
  )
}

function OrderCard({ order }: { order: Order }) {
  const { openTracking } = useAppStore()
  const itemCount = order.items.reduce((s, i) => s + i.quantity, 0)
  const active = order.status !== 'entregue' && order.status !== 'cancelado'
  // entrega marcada pelo motoboy mas ainda sem a confirmação do cliente
  const awaitingReceipt = order.status === 'entregue' && order.receiptStatus === 'pendente'
  const disputed = order.receiptStatus === 'disputado' && !order.disputeResolvedAt

  return (
    <button
      onClick={() => openTracking(order.id)}
      className="w-full text-left"
      aria-label={`Detalhes do pedido nº ${order.number}`}
    >
      <div className="rounded-2xl border border-border bg-white p-4 shadow-sm transition-all hover:shadow-md">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-black text-navy">
              Pedido nº {order.number}
              {active && <span className="live-dot ml-2 align-middle" />}
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3 shrink-0" /> {formatDateTime(order.requestedAt)}
            </p>
          </div>
          <StatusBadge status={order.status} className="shrink-0" />
        </div>

        {(awaitingReceipt || disputed) && (
          <p
            className={cn(
              'mt-2 flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] font-black',
              disputed ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'
            )}
          >
            {disputed ? (
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <BadgeCheck className="h-3.5 w-3.5 shrink-0" />
            )}
            {disputed ? 'Reclamação enviada à administração' : 'Confirme que recebeu esta entrega'}
          </p>
        )}

        <div className="mt-3 flex items-center gap-2">
          {order.items.slice(0, 3).map((item) => (
            <div key={item.id} className="h-11 w-11 shrink-0">
              <ProductArt
                kind={order.items.length > 0 ? kindOf(item.productName) : 'bidon'}
                volumeL={item.volumeL / Math.max(1, item.quantity)}
              />
            </div>
          ))}
          {order.items.length > 3 && (
            <span className="text-xs font-bold text-muted-foreground">
              +{order.items.length - 3}
            </span>
          )}
          <div className="ml-auto text-right">
            <p className="text-sm font-black text-primary">{formatKz(order.totalKz)}</p>
            <p className="text-[11px] text-muted-foreground">
              {itemCount} itens · {formatLiters(order.totalLiters)}
            </p>
          </div>
        </div>

        <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border pt-2.5">
          <PaymentBadge method={order.paymentMethod} className="shrink-0" />
          <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-bold text-primary">
            {active ? 'acompanhar' : 'ver detalhes'}
            <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </button>
  )
}

function kindOf(productName: string): string {
  const n = productName.toLowerCase()
  if (n.includes('bidão') || n.includes('bidon')) return 'bidon'
  if (n.includes('garrafão') || n.includes('garrafao')) return 'garrafao'
  if (n.includes('pack')) return 'pack'
  if (n.includes('garrafa')) return 'garrafa'
  return 'acessorio'
}

function TrackingDetail({ order, onBack, onUpdated }: { order: Order; onBack: () => void; onUpdated?: () => void }) {
  const courierPos = useCourierPosition(order.courierId)
  const { store } = useStoreConfig()
  const inTransit = order.status === 'em_transito'
  const customerPoint =
    order.latitude != null && order.longitude != null
      ? { lat: order.latitude, lng: order.longitude }
      : null

  // rota REAL pelas ruas (OSRM): desenha-se no mapa e dá a distância/
  // tempo que faltam de verdade — não em linha recta
  const { route } = useDrivingRoute(inTransit ? courierPos : null, customerPoint)
  const remainingKm = inTransit && route ? route.distanceKm : null
  const almostThere = inTransit && remainingKm != null && remainingKm < 0.25

  // base da empresa: localização GPS configurada pelo administrador
  // (fallback: centro de demonstração de Luanda)
  const originPoint =
    store?.latitude != null && store?.longitude != null
      ? { lat: store.latitude, lng: store.longitude }
      : CENTRAL_BASE
  const originConfigured = store?.latitude != null && store?.longitude != null

  // o mapa mostra-se sempre que há destino: antes da partida o cliente vê
  // de onde a mercadoria sai; em trânsito vê o motoboy a aproximar-se
  const showMap =
    customerPoint != null &&
    (inTransit || order.status === 'pendente' || order.status === 'confirmado')

  return (
    <div className="space-y-4 pb-4">
      {/* cabeçalho */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Voltar aos pedidos">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-base font-black leading-tight text-navy">
            Pedido nº {order.number}
          </h2>
          <p className="text-xs text-muted-foreground">
            solicitado {formatDateTime(order.requestedAt)}
          </p>
        </div>
        <StatusBadge status={order.status} className="ml-auto" />
      </div>

      {/* mapa ao vivo */}
      {showMap ? (
        <div className="space-y-2">
          <MiniMap
            customer={customerPoint}
            courier={inTransit ? courierPos : null}
            origin={originPoint}
            route={inTransit ? route?.points ?? null : null}
            remainingKm={remainingKm}
            etaMin={inTransit && route ? route.durationMin : null}
            live={inTransit}
            courierLabel={order.courier?.name?.split(' ')[0] ?? 'Motoboy'}
            originLabel={store?.name || 'Gota REAL'}
          />
          {almostThere ? (
            <p className="rounded-xl bg-emerald-100 px-3 py-2.5 text-center text-xs font-black text-emerald-800">
              🎉 O seu motoboy está a chegar — prepare a garrafa de água!
            </p>
          ) : inTransit && courierPos == null ? (
            <p className="rounded-xl bg-secondary/60 px-3 py-2 text-[11px] font-semibold leading-snug text-secondary-foreground">
              🛵 O motoboy já partiu — assim que o GPS do telemóvel dele der
              sinal, o trajecto aparece aqui a mexer-se.
            </p>
          ) : null}
          {!inTransit && (
            <p className="rounded-xl bg-secondary/60 px-3 py-2 text-[11px] font-semibold leading-snug text-secondary-foreground">
              👑 A sua água sai da base {store?.name || 'Gota REAL'}
              {!originConfigured && ' (local de demonstração — a central ainda não configurou o GPS da empresa)'}
              . Quando o motoboy partir, acompanhe o trajecto aqui em tempo real.
            </p>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="h-12 flex-1 rounded-2xl text-sm font-black"
              onClick={() => window.open(googleMapsNavUrl(customerPoint), '_blank')}
            >
              <Navigation className="h-5 w-5 text-primary" /> Google Maps
            </Button>
            {order.courier?.phone && (
              <Button
                variant="outline"
                className="h-12 flex-1 rounded-2xl text-sm font-black"
                onClick={() => (window.location.href = `tel:${order.courier!.phone.replace(/\s/g, '')}`)}
              >
                <Phone className="h-5 w-5 text-emerald-600" /> Ligar ao motoboy
              </Button>
            )}
          </div>
        </div>
      ) : order.status === 'entregue' ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center">
          <p className="text-sm font-black text-emerald-800">✅ Entregue com sucesso</p>
          <p className="mt-1 text-xs text-emerald-700">
            Recebeu às {new Date(order.deliveredAt!).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })} ·{' '}
            tempo total {durationMinutes(order.requestedAt, order.deliveredAt)}
          </p>
        </div>
      ) : order.status === 'cancelado' ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center">
          <p className="flex items-center justify-center gap-1.5 text-sm font-black text-red-700">
            <XCircle className="h-4 w-4" /> Pedido cancelado
          </p>
          <p className="mt-1 text-xs text-red-600">
            cancelado {formatDateTime(order.cancelledAt)}
          </p>
        </div>
      ) : null}

      {/* linha do tempo (gestão de tempo) */}
      <section aria-labelledby="tl-title" className="rounded-2xl border border-border bg-white p-4 shadow-sm">
        <h3 id="tl-title" className="mb-3 flex items-center gap-1.5 text-sm font-black text-navy">
          <Clock className="h-4 w-4 text-primary" /> Histórico de tempos
        </h3>
        <OrderTimeline order={order} />
      </section>

      {/* ANTI-BURLA: confirmação de recepção pelo cliente */}
      {order.status === 'entregue' && (
        <ReceiptCard order={order} onUpdated={onUpdated} />
      )}

      {/* motoboy */}
      {order.courier && order.status !== 'entregue' && order.status !== 'cancelado' && (
        <section aria-labelledby="mb-title" className="rounded-2xl border border-gold/40 bg-gold/10 p-4 shadow-sm">
          <h3 id="mb-title" className="flex items-center gap-1.5 text-sm font-black text-navy">
            <Bike className="h-4 w-4 text-gold" /> O seu entregador
          </h3>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-foreground">{order.courier.name}</p>
              <p className="text-xs text-muted-foreground">
                {order.courier.vehicle} · {order.courier.plate}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{order.courier.phone}</p>
            </div>
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm">
              <Bike className="h-6 w-6 text-navy" />
            </span>
          </div>
        </section>
      )}

      {/* itens */}
      <section aria-labelledby="it-title" className="rounded-2xl border border-border bg-white p-4 shadow-sm">
        <h3 id="it-title" className="text-sm font-black text-navy">Itens solicitados</h3>
        <ul className="mt-2 space-y-2">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center gap-2.5">
              <div className="h-11 w-11 shrink-0">
                <ProductArt
                  kind={kindOf(item.productName)}
                  volumeL={item.volumeL / Math.max(1, item.quantity)}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{item.productName}</p>
                <p className="text-xs text-muted-foreground">
                  {item.quantity} × {formatKz(item.unitPriceKz)}
                </p>
              </div>
              <span className="text-sm font-black text-navy">
                {formatKz(item.unitPriceKz * item.quantity)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Droplets className="h-4 w-4 text-primary" /> Água total
            </span>
            <b className="text-navy">{formatLiters(order.totalLiters)}</b>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Total a pagar</span>
            <b className="text-base text-primary">{formatKz(order.totalKz)}</b>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Pagamento</span>
            <PaymentBadge method={order.paymentMethod} />
          </div>
        </div>
        {order.notes && (
          <p className="mt-2.5 rounded-xl bg-secondary/70 p-2.5 text-xs italic text-secondary-foreground">
            “{order.notes}”
          </p>
        )}
      </section>

      {/* endereço */}
      <div className="flex items-start gap-2 rounded-2xl border border-border bg-white p-3.5 text-xs shadow-sm">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
        <div>
          <p className="font-bold text-foreground">Local de entrega</p>
          <p className="mt-0.5 text-muted-foreground">
            {order.address || 'Localização GPS'} ·{' '}
            {order.latitude != null
              ? `${order.latitude.toFixed(5)}, ${order.longitude?.toFixed(5)}`
              : 'GPS não disponível'}
          </p>
        </div>
      </div>

      {/* pedir novamente — repete o pedido com um toque */}
      {(order.status === 'entregue' || order.status === 'cancelado') && (
        <ReorderButton order={order} />
      )}
    </div>
  )
}

/* Botão grande para repetir um pedido anterior (dados reais da base de dados) */
function ReorderButton({ order }: { order: Order }) {
  const { addToCart, setCheckoutOpen } = useAppStore()
  const { products } = useProducts()
  const [added, setAdded] = useState(false)

  function reorder() {
    let matched = 0
    for (const item of order.items) {
      const product = products.find((p) => p.id === item.productId || p.name === item.productName)
      if (product) {
        addToCart(product, item.quantity)
        matched++
      }
    }
    if (matched > 0) {
      setAdded(true)
      setCheckoutOpen(true)
    }
  }

  if (products.length === 0) return null

  return (
    <button
      onClick={reorder}
      className="btn-gold flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-black transition-all duration-150 hover:brightness-105 active:scale-[0.98]"
    >
      <RotateCcw className="h-5 w-5" />
      {added ? 'Pedido no carrinho!' : 'PEDIR NOVAMENTE'}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* CONFIRMAÇÃO DE RECEPÇÃO (anti-burla)                               */
/* O motoboy marcou a entrega? O cliente confirma que recebeu —       */
/* ou reclama à administração que não recebeu, com aviso imediato.     */
/* ------------------------------------------------------------------ */
function ReceiptCard({ order, onUpdated }: { order: Order; onUpdated?: () => void }) {
  const { customer, auth } = useAppStore()
  const { toast } = useToast()
  const token = auth?.token ?? null
  const [busy, setBusy] = useState(false)
  const [disputeOpen, setDisputeOpen] = useState(false)
  const [reason, setReason] = useState('')

  async function confirm() {
    if (!customer) return
    setBusy(true)
    try {
      await confirmReceipt(order.id, token)
      toast({ title: 'Recepção confirmada ✅', description: 'Obrigado! A central foi avisada.' })
      onUpdated?.()
    } catch (err) {
      toast({
        title: 'Não foi possível confirmar',
        description: err instanceof Error ? err.message : 'Verifique a internet e tente de novo.',
        variant: 'destructive',
      })
    } finally {
      setBusy(false)
    }
  }

  async function dispute() {
    if (!customer) return
    setBusy(true)
    try {
      await disputeReceipt(order.id, token, reason.trim() || undefined)
      setDisputeOpen(false)
      setReason('')
      toast({
        title: 'Reclamação enviada à administração ⚠️',
        description: 'A central foi alertada agora mesmo e vai contactá-lo em breve.',
      })
      onUpdated?.()
    } catch (err) {
      toast({
        title: 'Não foi possível enviar a reclamação',
        description: err instanceof Error ? err.message : 'Verifique a internet e tente de novo.',
        variant: 'destructive',
      })
    } finally {
      setBusy(false)
    }
  }

  // já confirmado — selo verde com a hora
  if (order.receiptStatus === 'confirmado') {
    return (
      <section
        aria-labelledby="rc-title"
        className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-4 text-center shadow-sm"
      >
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow">
          <BadgeCheck className="h-6 w-6" />
        </span>
        <h3 id="rc-title" className="mt-2 text-sm font-black text-emerald-800">
          Recepção confirmada por você
        </h3>
        <p className="mt-1 text-xs text-emerald-700">
          {order.receiptConfirmedAt
            ? `Confirmado ${formatDateTime(order.receiptConfirmedAt)} · a central ficou registada`
            : 'A central ficou registada — obrigado!'}
        </p>
      </section>
    )
  }

  // reclamado e já respondido pela administração
  if (order.receiptStatus === 'disputado' && order.disputeResolvedAt) {
    return (
      <section
        aria-labelledby="rd-title"
        className="rounded-2xl border-2 border-emerald-300 bg-white p-4 shadow-sm"
      >
        <h3 id="rd-title" className="flex items-center gap-1.5 text-sm font-black text-navy">
          <BadgeCheck className="h-4 w-4 text-emerald-600" /> Reclamação respondida pela administração
        </h3>
        <p className="mt-2 rounded-xl bg-secondary/70 p-2.5 text-xs italic leading-relaxed text-secondary-foreground">
          “{order.disputeResolution ?? 'Caso analisado pela administração.'}”
        </p>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          respondido {formatDateTime(order.disputeResolvedAt)}
        </p>
      </section>
    )
  }

  // reclamado, à espera de resposta da administração
  if (order.receiptStatus === 'disputado') {
    return (
      <section
        aria-labelledby="rw-title"
        className="rounded-2xl border-2 border-red-300 bg-red-50 p-4 text-center shadow-sm"
      >
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-600 text-white shadow">
          <PackageX className="h-6 w-6" />
        </span>
        <h3 id="rw-title" className="mt-2 text-sm font-black text-red-800">
          Reclamação registada: não recebeu
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-red-700">
          A administração foi alertada com alarme sonoro {order.receiptDisputedAt ? `às ${formatDateTime(order.receiptDisputedAt)}` : ''} e vai
          contactá-lo para resolver o caso.
        </p>
        {order.disputeReason && (
          <p className="mt-2 rounded-xl bg-white/80 p-2.5 text-xs italic text-red-800">
            “{order.disputeReason}”
          </p>
        )}
      </section>
    )
  }

  // à espera da resposta do cliente (receiptStatus === 'pendente')
  return (
    <section
      aria-labelledby="rp-title"
      className="rounded-2xl border-2 border-amber-300 bg-gradient-to-b from-amber-50 to-white p-4 shadow-md"
    >
      <div className="text-center">
        <span className="mx-auto flex h-12 w-12 animate-pulse items-center justify-center rounded-2xl bg-amber-500 text-white shadow">
          <BadgeCheck className="h-6 w-6" />
        </span>
        <h3 id="rp-title" className="mt-2 text-base font-black text-navy">
          Recebeu a sua água?
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          O entregador marcou este pedido como entregue
          {order.deliveredAt ? ` às ${new Date(order.deliveredAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}` : ''}.
          Confirme a recepção para proteger a sua encomenda — se não recebeu, a administração é
          alertada de imediato.
        </p>
      </div>

      <div className="mt-4 grid gap-2.5">
        <Button
          className="h-14 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-base font-black uppercase tracking-wide hover:brightness-110"
          disabled={busy}
          onClick={confirm}
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <BadgeCheck className="h-6 w-6" />}
          Sim, recebi
        </Button>
        <Button
          variant="outline"
          className="h-12 rounded-2xl border-2 border-red-300 text-sm font-black text-red-700 hover:bg-red-50"
          disabled={busy}
          onClick={() => setDisputeOpen(true)}
        >
          <PackageX className="h-5 w-5" /> Não recebi — reclamar
        </Button>
      </div>

      {/* dialog da reclamação: o cliente explica o que aconteceu */}
      <Dialog open={disputeOpen} onOpenChange={setDisputeOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <ShieldAlert className="h-5 w-5" /> Não recebi a minha água
            </DialogTitle>
            <DialogDescription>
              A sua reclamação chega à administração com alarme sonoro imediato. Descreva
              (opcionalmente) o que aconteceu — ajuda a resolver mais depressa.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex.: o motoboy passou mas não entregou nada…"
            maxLength={500}
            className="min-h-24"
          />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDisputeOpen(false)} disabled={busy}>
              Voltar
            </Button>
            <Button
              className="bg-gradient-to-r from-red-600 to-rose-600 font-black"
              disabled={busy}
              onClick={dispute}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
              Enviar reclamação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
