'use client'

import { useAppStore, formatKz, formatLiters, formatDateTime, durationMinutes } from '@/store/app-store'
import { useCustomerOrders, useCourierPosition } from '@/components/app/hooks'
import { OrderTimeline } from '@/components/app/OrderTimeline'
import { StatusBadge, PaymentBadge } from '@/components/app/Badges'
import { MiniMap } from '@/components/app/MiniMap'
import { ProductArt } from '@/components/app/ProductArt'
import { googleMapsNavUrl } from '@/lib/geo'
import type { Order } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft,
  Bike,
  ChevronRight,
  Clock,
  Droplets,
  MapPin,
  Navigation,
  Phone,
  ReceiptText,
  XCircle,
} from 'lucide-react'

export function OrdersView() {
  const { customer, trackingOrderId, openTracking } = useAppStore()
  const { orders, loading } = useCustomerOrders(customer?.id)

  const tracked = trackingOrderId ? orders.find((o) => o.id === trackingOrderId) : null

  if (tracked) {
    return <TrackingDetail order={tracked} onBack={() => openTracking(null)} />
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

  return (
    <button
      onClick={() => openTracking(order.id)}
      className="w-full text-left"
      aria-label={`Detalhes do pedido nº ${order.number}`}
    >
      <div className="rounded-2xl border border-border bg-white p-4 shadow-sm transition-all hover:shadow-md">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-black text-navy">
              Pedido nº {order.number}
              {active && <span className="live-dot ml-2 align-middle" />}
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" /> {formatDateTime(order.requestedAt)}
            </p>
          </div>
          <StatusBadge status={order.status} />
        </div>

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

        <div className="mt-2.5 flex items-center justify-between border-t border-border pt-2.5">
          <PaymentBadge method={order.paymentMethod} />
          <span className="inline-flex items-center gap-0.5 text-xs font-bold text-primary">
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

function TrackingDetail({ order, onBack }: { order: Order; onBack: () => void }) {
  const courierPos = useCourierPosition(order.courierId)
  const inTransit = order.status === 'em_transito'
  const customerPoint =
    order.latitude != null && order.longitude != null
      ? { lat: order.latitude, lng: order.longitude }
      : null

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
      {inTransit && customerPoint ? (
        <div className="space-y-2">
          <MiniMap
            customer={customerPoint}
            courier={courierPos}
            live={inTransit}
            courierLabel={order.courier?.name?.split(' ')[0] ?? 'Motoboy'}
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="h-10 flex-1 rounded-xl font-bold"
              onClick={() => window.open(googleMapsNavUrl(customerPoint), '_blank')}
            >
              <Navigation className="h-4 w-4 text-primary" /> Ver no Google Maps
            </Button>
            {order.courier?.phone && (
              <Button
                variant="outline"
                className="h-10 flex-1 rounded-xl font-bold"
                onClick={() => (window.location.href = `tel:${order.courier!.phone.replace(/\s/g, '')}`)}
              >
                <Phone className="h-4 w-4 text-emerald-600" /> Ligar ao motoboy
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
    </div>
  )
}
