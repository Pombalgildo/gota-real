'use client'

import { useAppStore, formatKz, formatTime } from '@/store/app-store'
import { useProducts, useCustomerOrders } from '@/components/app/hooks'
import { ProductPhoto } from '@/components/app/ProductPhoto'
import { DropCrownIcon } from '@/components/app/Brand'
import { StatusBadge, PaymentBadge } from '@/components/app/Badges'
import type { Product } from '@/lib/types'
import {
  Banknote,
  Bike,
  ChevronRight,
  CreditCard,
  Droplets,
  MapPin,
  MessageSquareHeart,
  Package,
  Plus,
  ReceiptText,
  ShoppingBasket,
  Store,
  User,
} from 'lucide-react'

/* ============================================================
   ECRÃ INICIAL — MENÚ PRINCIPAL COM BOTÕES GRANDES
   ============================================================ */
export function HomeView() {
  const { customer, addToCart, setTab, openTracking, setCheckoutOpen } = useAppStore()
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
      {/* ---------- pedido activo (se houver) ---------- */}
      {activeOrder && (
        <button
          onClick={() => openTracking(activeOrder.id)}
          className="w-full text-left"
          aria-label={`Acompanhar pedido nº ${activeOrder.number}`}
        >
          <div className="relative overflow-hidden rounded-3xl gota-gradient p-5 text-white shadow-xl">
            <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#BDE3F5]">
                  <span className="live-dot" />
                  pedido nº {activeOrder.number} · {formatTime(activeOrder.requestedAt)}
                </p>
                <p className="mt-1 truncate text-lg font-black">
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
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/30">
                <Bike className="h-7 w-7" />
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

      {/* ---------- BOTÃO GIGANTE: PEDIR ÁGUA AGORA ---------- */}
      {bidon && (
        <button
          onClick={() => {
            addToCart(bidon)
            setCheckoutOpen(true)
          }}
          className="group relative block w-full overflow-hidden rounded-3xl gota-gradient p-5 text-left text-white shadow-xl ring-1 ring-white/20 transition-all duration-200 hover:shadow-2xl hover:brightness-110 active:scale-[0.98]"
          aria-label={`Pedir agora ${bidon.name} por ${formatKz(bidon.priceKz)}`}
        >
          <div className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="flex items-center gap-4">
            <div className="h-24 w-24 shrink-0 drop-shadow-lg transition-transform duration-200 group-hover:scale-105 sm:h-28 sm:w-28">
              <ProductPhoto product={bidon} className="h-24 w-24 sm:h-28 sm:w-28" rounded="rounded-3xl" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gold">
                pedido rápido · 1 toque
              </p>
              <h2 className="mt-1 text-2xl font-black leading-tight">
                PEDIR ÁGUA<br />AGORA
              </h2>
              <p className="mt-1 text-xs font-semibold text-[#BDE3F5]">
                Bidão de 5L · {formatKz(bidon.priceKz)} · entregamos onde estiver
              </p>
            </div>
            <span className="btn-gold flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-lg">
              <Plus className="h-8 w-8" />
            </span>
          </div>
        </button>
      )}

      {/* ---------- MENÚ PRINCIPAL: BOTÕES GRANDES ---------- */}
      <nav aria-label="Menú principal">
        <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-navy">
          <DropCrownIcon size={20} /> Menú
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3.5">
          <MenuTile
            icon={Store}
            title="LOJA"
            subtitle={
              loading
                ? 'a carregar…'
                : `${products.filter((p) => p.active).length} produtos · toque para ver`
            }
            tone="primary"
            badge={loading ? undefined : `${products.length}`}
            onClick={() => setTab('produtos')}
          />
          <MenuTile
            icon={ReceiptText}
            title="PEDIDOS"
            subtitle={
              orders.length === 0
                ? 'histórico e GPS ao vivo'
                : `${orders.length} ${orders.length === 1 ? 'pedido' : 'pedidos'} · acompanhe por GPS`
            }
            tone="sky"
            badge={activeOrder ? '1' : undefined}
            onClick={() => setTab('pedidos')}
          />
          <MenuTile
            icon={MessageSquareHeart}
            title="OPINIÃO"
            subtitle="sugestões e reclamações"
            tone="gold"
            onClick={() => setTab('feedback')}
          />
          <MenuTile
            icon={User}
            title="PERFIL"
            subtitle="dados e localização de entrega"
            tone="emerald"
            onClick={() => setTab('perfil')}
          />
        </div>
      </nav>

      {/* ---------- produtos em destaque (base de dados real) ---------- */}
      <section aria-labelledby="home-waters">
        <div className="flex items-center justify-between">
          <h2 id="home-waters" className="flex items-center gap-2 text-base font-black text-navy">
            <Droplets className="h-4.5 w-4.5 text-primary" /> Água para beber
          </h2>
          <button
            onClick={() => setTab('produtos')}
            className="rounded-full bg-secondary px-3.5 py-1.5 text-xs font-black text-primary transition-all hover:bg-primary hover:text-white active:scale-95"
          >
            VER LOJA →
          </button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {loading
            ? Array.from({ length: 4 }, (_, i) => (
                <MenuSkeleton key={i} />
              ))
            : waters.map((p) => <WaterCard key={p.id} product={p} />)}
        </div>
      </section>

      {/* ---------- formas de pagamento ---------- */}
      <section aria-labelledby="home-pay" className="grid grid-cols-2 gap-3.5">
        <h2 id="home-pay" className="sr-only">
          Formas de pagamento
        </h2>
        <div className="flex min-h-24 flex-col justify-between rounded-2xl border-2 border-border bg-white p-4 shadow-sm transition-all hover:border-primary/40 hover:shadow-md">
          <CreditCard className="h-7 w-7 text-primary" />
          <div>
            <p className="text-base font-black text-navy">TPA</p>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
              Cartão / Multicaixa na entrega, sem trocos
            </p>
          </div>
        </div>
        <div className="flex min-h-24 flex-col justify-between rounded-2xl border-2 border-border bg-white p-4 shadow-sm transition-all hover:border-emerald-400/60 hover:shadow-md">
          <Banknote className="h-7 w-7 text-emerald-600" />
          <div>
            <p className="text-base font-black text-navy">Dinheiro</p>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
              Pague em kwanzas ao motoboy na porta
            </p>
          </div>
        </div>
      </section>

      {/* ---------- como funciona ---------- */}
      <section aria-labelledby="home-how" className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-border">
        <h2 id="home-how" className="flex items-center gap-2 text-base font-black text-navy">
          <DropCrownIcon size={22} /> Como funciona
        </h2>
        <ol className="mt-4 space-y-3.5">
          {[
            { icon: ShoppingBasket, t: 'Escolha os produtos', d: 'Bidões de 5L, garrafões, garrafas e acessórios — a quantidade que precisar.' },
            { icon: MapPin, t: 'Confirme a localização', d: 'Usamos o seu local exacto de entrega gravado no cadastro (pode actualizar quando quiser).' },
            { icon: CreditCard, t: 'Escolha o pagamento', d: 'TPA (cartão na entrega) ou dinheiro (cash) — o motoboy leva a máquina TPA.' },
            { icon: Bike, t: 'Acompanhe por GPS', d: 'A central envia o motoboy e vê-lo-á no mapa, ao vivo, até à sua porta.' },
          ].map(({ icon: Icon, t, d }, i) => (
            <li key={i} className="flex gap-3">
              <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary font-black text-primary">
                <Icon className="h-5 w-5" />
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

/* ============================================================
   TILE DO MENÚ — BOTÃO GRANDE E INTERACTIVO
   ============================================================ */
function MenuTile({
  icon: Icon,
  title,
  subtitle,
  onClick,
  tone,
  badge,
}: {
  icon: typeof Store
  title: string
  subtitle: string
  onClick: () => void
  tone: 'primary' | 'sky' | 'gold' | 'emerald'
  badge?: string
}) {
  const tones: Record<string, string> = {
    primary: 'bg-primary/10 text-primary',
    sky: 'bg-sky-100 text-sky-600',
    gold: 'bg-amber-100 text-amber-600',
    emerald: 'bg-emerald-100 text-emerald-600',
  }
  return (
    <button
      onClick={onClick}
      className="group relative flex min-h-32 flex-col items-start justify-between rounded-3xl border-2 border-border bg-white p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg active:scale-[0.97]"
    >
      {badge && (
        <span className="absolute right-3 top-3 flex h-6 min-w-6 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-black text-white shadow">
          {badge}
        </span>
      )}
      <span
        className={`flex h-13 w-13 items-center justify-center rounded-2xl transition-transform duration-200 group-hover:scale-110 ${tones[tone]}`}
        style={{ height: 52, width: 52 }}
      >
        <Icon className="h-7 w-7" />
      </span>
      <span className="w-full pr-6">
        <span className="block text-base font-black tracking-wide text-navy">{title}</span>
        <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{subtitle}</span>
      </span>
      <ChevronRight className="absolute bottom-4 right-3.5 h-4 w-4 text-muted-foreground/50 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary" />
    </button>
  )
}

function MenuSkeleton() {
  return (
    <div className="flex min-h-32 flex-col justify-between rounded-3xl border-2 border-border bg-white p-4">
      <div className="h-13 w-13 animate-pulse rounded-2xl bg-muted" style={{ height: 52, width: 52 }} />
      <div className="space-y-1.5">
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-3 w-full animate-pulse rounded bg-muted" />
      </div>
    </div>
  )
}

/* ============================================================
   CARTÃO DE PRODUTO EM DESTAQUE
   ============================================================ */
function WaterCard({ product }: { product: Product }) {
  const { addToCart, setCheckoutOpen } = useAppStore()
  return (
    <div className="group flex flex-col rounded-3xl border-2 border-border bg-white p-3.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg">
      <ProductPhoto
        product={product}
        className="mx-auto h-24 w-24 transition-transform duration-200 group-hover:scale-105"
        rounded="rounded-2xl"
      />
      <p className="mt-2 line-clamp-2 min-h-9 text-[13px] font-bold leading-tight text-navy">
        {product.name}
      </p>
      <div className="mt-1.5 flex items-center justify-between gap-1">
        <span className="text-sm font-black text-primary">{formatKz(product.priceKz)}</span>
        <button
          onClick={() => {
            addToCart(product)
            setCheckoutOpen(true)
          }}
          aria-label={`Adicionar ${product.name} ao pedido`}
          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-white shadow-md transition-all duration-150 hover:bg-primary/90 active:scale-90"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>
      <p className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
        <Package className="h-3 w-3" /> stock real: {product.stock}
      </p>
    </div>
  )
}
