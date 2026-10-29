'use client'

import { useState } from 'react'
import { useAppStore, formatKz, formatLiters, cartTotals } from '@/store/app-store'
import { useProducts } from '@/components/app/hooks'
import { ProductPhoto } from '@/components/app/ProductPhoto'
import { QuantityStepper } from '@/components/app/Badges'
import type { Product } from '@/lib/types'
import {
  Droplets,
  Package,
  Plus,
  ShoppingBasket,
  Store,
} from 'lucide-react'

type Cat = 'todos' | 'agua' | 'acessorio'

const CATS: { key: Cat; label: string; icon: typeof Droplets }[] = [
  { key: 'todos', label: 'Todos', icon: Store },
  { key: 'agua', label: 'Água', icon: Droplets },
  { key: 'acessorio', label: 'Acessórios', icon: Package },
]

export function ShopView() {
  const { products, loading } = useProducts()
  const [category, setCategory] = useState<Cat>('todos')
  const { cart, addToCart, setCheckoutOpen } = useAppStore()

  const filtered =
    category === 'todos' ? products : products.filter((p) => p.category === category)
  const totals = cartTotals(cart)
  const activeProducts = products.filter((p) => p.active)

  return (
    <div className="space-y-4 pb-4">
      {/* ---------- CABEÇALHO DA LOJA (grande e visível) ---------- */}
      <header className="relative overflow-hidden rounded-3xl gota-gradient p-5 text-white shadow-xl">
        <div className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-14 -left-10 h-36 w-36 rounded-full bg-white/5 blur-2xl" />
        <div className="relative flex items-center gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-white/15 ring-1 ring-white/30">
            <Store className="h-9 w-9" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-black leading-tight">LOJA</h1>
            <p className="mt-0.5 text-xs font-semibold text-[#BDE3F5]">
              {loading
                ? 'a carregar artigos da base de dados…'
                : `${activeProducts.length} artigos disponíveis · preços em kwanzas`}
            </p>
          </div>
        </div>
      </header>

      {/* ---------- PILLS DE CATEGORIA (grandes, sem texto cortado) ---------- */}
      <div role="tablist" aria-label="Categorias da loja" className="grid grid-cols-3 gap-2.5">
        {CATS.map(({ key, label, icon: Icon }) => {
          const active = category === key
          const count =
            key === 'todos'
              ? products.length
              : products.filter((p) => p.category === key).length
          return (
            <button
              key={key}
              role="tab"
              aria-selected={active}
              onClick={() => setCategory(key)}
              className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 px-1.5 py-2.5 transition-all duration-150 active:scale-[0.97] ${
                active
                  ? 'border-primary bg-primary text-white shadow-md'
                  : 'border-border bg-white text-muted-foreground hover:border-primary/40 hover:text-foreground'
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="flex max-w-full items-baseline justify-center gap-1 text-xs font-black leading-none">
                <span className="min-w-0">{label}</span>
                <span className={active ? 'text-white/70' : 'text-muted-foreground/70'}>{count}</span>
              </span>
            </button>
          )
        })}
      </div>

      {/* ---------- GRELHA DE PRODUTOS (cartões grandes) ---------- */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        {loading
          ? Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="space-y-2.5 rounded-3xl border-2 border-border bg-white p-3.5">
                <div className="flex gap-3.5">
                  <div className="h-24 w-24 shrink-0 animate-pulse rounded-2xl bg-muted" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-3/5 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-2/5 animate-pulse rounded bg-muted" />
                  </div>
                </div>
                <div className="h-11 w-full animate-pulse rounded-2xl bg-muted" />
              </div>
            ))
          : filtered.map((p) => <ShopCard key={p.id} product={p} />)}
      </div>

      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-input bg-white/60 py-14 text-muted-foreground">
          <Package className="h-10 w-10 opacity-40" />
          <p className="mt-2 text-sm font-bold">Sem produtos nesta categoria</p>
          <p className="text-xs">volte ao atalho “Todos” para ver tudo</p>
        </div>
      )}

      {/* ---------- BARRA FLUTUANTE DO PEDIDO (grande) ---------- */}
      {totals.count > 0 && (
        <div className="sticky bottom-2 z-20 pt-2">
          <button
            onClick={() => setCheckoutOpen(true)}
            className="flex w-full items-center justify-between rounded-3xl gota-gradient px-5 py-4 text-white shadow-2xl ring-1 ring-white/20 transition-all duration-150 hover:brightness-110 active:scale-[0.99]"
            aria-label="Ver o meu pedido"
          >
            <span className="flex items-center gap-3">
              <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20">
                <ShoppingBasket className="h-5.5 w-5.5" />
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white shadow">
                  {totals.count}
                </span>
              </span>
              <span className="text-left">
                <span className="block text-base font-black leading-tight">
                  {formatKz(totals.totalKz)}
                </span>
                <span className="block text-[11px] font-semibold text-[#BDE3F5]">
                  {totals.count} {totals.count === 1 ? 'item' : 'itens'} ·{' '}
                  {formatLiters(totals.totalLiters)} de água
                </span>
              </span>
            </span>
            <span className="btn-gold rounded-2xl px-5 py-2.5 text-sm font-black">
              VER PEDIDO →
            </span>
          </button>
        </div>
      )}
    </div>
  )
}

/* ============================================================
   CARTÃO DE PRODUTO — GRANDE, COM BOTÃO ADICIONAR MAIOR
   Preço em linha própria + botão ADICIONAR em largura total:
   nada se sobrepõe nem sai do cartão, mesmo em ecrãs estreitos.
   ============================================================ */
function ShopCard({ product }: { product: Product }) {
  const { cart, addToCart, setCartQuantity } = useAppStore()
  const inCart = cart.find((i) => i.product.id === product.id)

  return (
    <div className="flex gap-3.5 rounded-3xl border-2 border-border bg-white p-3.5 shadow-sm transition-all duration-200 hover:border-primary/40 hover:shadow-md">
      <ProductPhoto product={product} className="h-24 w-24 shrink-0 sm:h-28 sm:w-28" rounded="rounded-2xl" />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 flex-1 text-base font-black leading-tight text-navy">{product.name}</h3>
          {product.volumeL > 0 && (
            <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-black text-secondary-foreground">
              {formatLiters(product.volumeL)}
            </span>
          )}
        </div>
        <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">
          {product.description}
        </p>
        <div className="mt-auto pt-2.5">
          <p className="text-lg font-black leading-none text-primary">
            {formatKz(product.priceKz)}
          </p>
          <p className="mt-1 text-[10px] font-semibold leading-snug text-muted-foreground">
            por {product.unitLabel}
            {product.stock <= 10 && product.stock > 0 && (
              <span className="font-black text-amber-600"> · últimos {product.stock}!</span>
            )}
          </p>
        </div>
        {inCart ? (
          <div className="mt-2.5 flex items-center justify-between gap-2 rounded-2xl bg-secondary/70 px-2 py-1">
            <span className="min-w-0 pl-1 text-[11px] font-bold leading-tight text-secondary-foreground">
              no meu pedido
            </span>
            <QuantityStepper
              size="sm"
              value={inCart.quantity}
              max={product.stock}
              onChange={(v) => setCartQuantity(product.id, v)}
            />
          </div>
        ) : (
          <button
            disabled={product.stock <= 0}
            onClick={() => addToCart(product)}
            className="mt-2.5 flex h-11 w-full items-center justify-center gap-1.5 rounded-2xl bg-primary px-4 text-sm font-black text-white shadow-md transition-all duration-150 hover:bg-primary/90 active:scale-[0.98] disabled:opacity-40"
          >
            <Plus className="h-5 w-5 shrink-0" />
            {product.stock <= 0 ? 'ESGOTADO' : 'ADICIONAR'}
          </button>
        )}
      </div>
    </div>
  )
}

