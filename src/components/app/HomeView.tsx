'use client'

import { useAppStore, formatKz, formatTime } from '@/store/app-store'
import { useProducts, useCustomerOrders } from '@/components/app/hooks'
import { ProductArt } from '@/components/app/ProductArt'
import { DropCrownIcon } from '@/components/app/Brand'
import { StatusBadge, PaymentBadge } from '@/components/app/Badges'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { Product } from '@/lib/types'
import {
  Bike,
  ChevronRight,
  CreditCard,
  Droplets,
  MapPin,
  Package,
  Plus,
  ShoppingBasket,
  Banknote,
  Clock,
} from 'lucide-react'

export function HomeView() {
  const { customer, addToCart, setTab, openTracking, setCheckoutOpen, cart } = useAppStore()
  const { products, loading } = useProducts()
  const { orders } = useCustomerOrders(customer?.id)

  const activeOrder = orders.find(
    (o) => o.status !== 'entregue' && o.status !== 'cancelado'
  )
  const waters = products.filter((p) => p.category === 'agua').slice(0, 4)
  const bidon = products.find((p) => p.kind === 'bidon')
  const firstName = customer?.name?.split(' ')[0] ?? 'cliente'

  return (
    <div className="space-y-5 pb-4">
      {/* pedido activo */}
      {activeOrder && (
        <button
          onClick={() => openTracking(activeOrder.id)}
          className="w-full text-left"
          aria-label={`Acompanhar pedido #${activeOrder.number}`}
        >
          <div className="relative overflow-hidden rounded-2xl gota-gradient p-4 text-white shadow-lg">
            <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#BDE3F5]">
                  <span className="live-dot" />
                  pedido nº {activeOrder.number} · {formatTime(activeOrder.requestedAt)}
                </p>
                <p className="mt-1 truncate text-base font-black">
                  {activeOrder.status === 'em_transito'
                    ? 'O seu motoboy está a caminho! 🛵'
                    : activeOrder.status === 'confirmado'
                      ? 'Pedido confirmado pela central ✅'
                      : 'Recebemos o seu pedido 💧'}
                </p>
                <p className="mt-0.5 text-xs text-[#cfe7f8]">
                  {activeOrder.items.reduce((s, i) => s + i.quantity, 0)} itens ·{' '}
                  {formatKz(activeOrder.totalKz)}
                </p>
              </div>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/30">
                <Bike className="h-5 w-5" />
              </span>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11px] font-bold">
              <StatusBadge status={activeOrder.status} className="!border-white/25 !bg-white/15 !text-white" />
              <PaymentBadge
                method={activeOrder.paymentMethod}
                className="!border-white/25 !bg-white/15 !text-white"
              />
              <span className="ml-auto inline-flex items-center gap-0.5 text-[#BDE3F5]">
                acompanhar <ChevronRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </div>
        </button>
      )}

      {/* pedido rápido do bidão 5L */}
      {bidon && (
        <Card className="overflow-hidden border-0 shadow-md ring-1 ring-border">
          <div className="gota-gradient-sky">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="h-24 w-24 shrink-0 drop-shadow-md">
                <ProductArt kind="bidon" volumeL={5} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-gold">
                  pedido rápido
                </p>
                <h3 className="text-lg font-black leading-tight text-navy">
                  {bidon.name}
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatKz(bidon.priceKz)} · entrega ao domicílio
                </p>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    className="h-9 flex-1 rounded-full font-bold"
                    onClick={() => {
                      addToCart(bidon)
                      setCheckoutOpen(true)
                    }}
                  >
                    <Plus className="h-4 w-4" /> Pedir agora
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-9 flex-1 rounded-full font-semibold"
                    onClick={() => {
                      addToCart(bidon)
                      setTab('produtos')
                    }}
                  >
                    <ShoppingBasket className="h-4 w-4" /> Ver loja
                  </Button>
                </div>
              </div>
            </CardContent>
          </div>
        </Card>
      )}

      {/* formas de pagamento */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-white p-3.5 shadow-sm">
          <CreditCard className="h-5 w-5 text-primary" />
          <p className="mt-2 text-sm font-black text-navy">TPA</p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            Pague com cartão / Multicaixa na entrega, sem trocos
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-white p-3.5 shadow-sm">
          <Banknote className="h-5 w-5 text-emerald-600" />
          <p className="mt-2 text-sm font-black text-navy">Dinheiro (cash)</p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            Pague em kwanzas ao motoboy na porta
          </p>
        </div>
      </div>

      {/* produtos em destaque */}
      <section aria-labelledby="home-waters">
        <div className="flex items-center justify-between">
          <h2 id="home-waters" className="flex items-center gap-2 text-base font-black text-navy">
            <Droplets className="h-4.5 w-4.5 text-primary" /> Água para beber
          </h2>
          <button
            onClick={() => setTab('produtos')}
            className="text-xs font-bold text-primary hover:underline"
          >
            ver tudo
          </button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {loading
            ? Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="space-y-2 rounded-2xl border border-border bg-white p-3">
                  <Skeleton className="h-20 w-full rounded-xl" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))
            : waters.map((p) => <WaterCard key={p.id} product={p} />)}
        </div>
      </section>

      {/* como funciona */}
      <section aria-labelledby="home-how" className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-border">
        <h2 id="home-how" className="flex items-center gap-2 text-base font-black text-navy">
          <DropCrownIcon size={22} /> Como funciona
        </h2>
        <ol className="mt-3 space-y-3">
          {[
            { icon: ShoppingBasket, t: 'Escolha os produtos', d: 'Bidões de 5L, garrafões, garrafas e acessórios — a quantidade que precisar.' },
            { icon: MapPin, t: 'Confirme a localização', d: 'Usamos o seu local exacto de entrega gravado no cadastro (pode actualizar quando quiser).' },
            { icon: CreditCard, t: 'Escolha o pagamento', d: 'TPA (cartão na entrega) ou dinheiro (cash) — o motoboy leva a máquina TPA.' },
            { icon: Bike, t: 'Acompanhe por GPS', d: 'A central envia o motoboy e vê-lo-á no mapa, ao vivo, até à sua porta.' },
            { icon: Clock, t: 'Registo de tempos', d: 'Fica gravado o momento em que pediu e o momento em que recebeu.' },
          ].map(({ icon: Icon, t, d }, i) => (
            <li key={i} className="flex gap-3">
              <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary font-black text-primary">
                <Icon className="h-4.5 w-4.5" />
              </span>
              <div>
                <p className="text-sm font-bold text-foreground">{t}</p>
                <p className="text-xs leading-snug text-muted-foreground">{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}

function WaterCard({ product }: { product: Product }) {
  const { addToCart, setCheckoutOpen } = useAppStore()
  return (
    <div className="group flex flex-col rounded-2xl border border-border bg-white p-3 shadow-sm transition-shadow hover:shadow-md">
      <div className="mx-auto h-24 w-24 transition-transform group-hover:scale-105">
        <ProductArt kind={product.kind} volumeL={product.volumeL} />
      </div>
      <p className="mt-2 line-clamp-2 min-h-9 text-[13px] font-bold leading-tight text-navy">
        {product.name}
      </p>
      <div className="mt-1 flex items-center justify-between">
        <span className="text-sm font-black text-primary">{formatKz(product.priceKz)}</span>
        <button
          onClick={() => {
            addToCart(product)
            setCheckoutOpen(true)
          }}
          aria-label={`Adicionar ${product.name} ao pedido`}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white shadow-sm transition-all hover:bg-primary/90 active:scale-90"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
        <Package className="h-3 w-3" /> stock: {product.stock}
      </p>
    </div>
  )
}
