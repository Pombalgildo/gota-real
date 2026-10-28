'use client'

import { useState } from 'react'
import { useAppStore, formatKz, formatLiters, cartTotals } from '@/store/app-store'
import { useProducts } from '@/components/app/hooks'
import { ProductArt } from '@/components/app/ProductArt'
import { QuantityStepper } from '@/components/app/Badges'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import type { Product } from '@/lib/types'
import { Droplets, Package, ShoppingBasket } from 'lucide-react'

export function ShopView() {
  const { products, loading } = useProducts()
  const [category, setCategory] = useState<'agua' | 'acessorio'>('agua')
  const { cart, addToCart, setCheckoutOpen } = useAppStore()

  const filtered = products.filter((p) => p.category === category)
  const totals = cartTotals(cart)

  return (
    <div className="space-y-4 pb-4">
      <Tabs value={category} onValueChange={(v) => setCategory(v as 'agua' | 'acessorio')}>
        <TabsList className="grid w-full grid-cols-2 rounded-xl bg-secondary">
          <TabsTrigger value="agua" className="rounded-lg font-bold data-[state=active]:bg-white">
            <Droplets className="mr-1.5 h-4 w-4" /> Água
          </TabsTrigger>
          <TabsTrigger value="acessorio" className="rounded-lg font-bold data-[state=active]:bg-white">
            <Package className="mr-1.5 h-4 w-4" /> Acessórios
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {loading
          ? Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="space-y-2 rounded-2xl border border-border bg-white p-4">
                <div className="flex gap-3">
                  <Skeleton className="h-24 w-24 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-4/5" />
                    <Skeleton className="h-3 w-3/5" />
                    <Skeleton className="h-3 w-2/5" />
                  </div>
                </div>
              </div>
            ))
          : filtered.map((p) => (
              <ShopCard key={p.id} product={p} />
            ))}
      </div>

      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-input bg-white/60 py-12 text-muted-foreground">
          <Package className="h-8 w-8 opacity-40" />
          <p className="mt-2 text-sm font-medium">Sem produtos nesta categoria</p>
        </div>
      )}

      {/* barra flutuante do carrinho */}
      {totals.count > 0 && (
        <div className="sticky bottom-2 z-20 pt-2">
          <button
            onClick={() => setCheckoutOpen(true)}
            className="flex w-full items-center justify-between rounded-2xl gota-gradient px-4 py-3.5 text-white shadow-xl ring-1 ring-white/20 transition-transform active:scale-[0.99]"
            aria-label="Ver o meu pedido"
          >
            <span className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
                <ShoppingBasket className="h-4.5 w-4.5" />
              </span>
              <span className="text-left">
                <span className="block text-sm font-black leading-tight">
                  {totals.count} {totals.count === 1 ? 'item' : 'itens'} · {formatKz(totals.totalKz)}
                </span>
                <span className="block text-[11px] text-[#BDE3F5]">
                  {formatLiters(totals.totalLiters)} de água
                </span>
              </span>
            </span>
            <span className="btn-gold rounded-full px-4 py-2 text-sm">Ver pedido</span>
          </button>
        </div>
      )}
    </div>
  )
}

function ShopCard({ product }: { product: Product }) {
  const { cart, addToCart, setCartQuantity } = useAppStore()
  const inCart = cart.find((i) => i.product.id === product.id)

  return (
    <div className="flex gap-3 rounded-2xl border border-border bg-white p-3.5 shadow-sm">
      <div className="h-24 w-24 shrink-0">
        <ProductArt kind={product.kind} volumeL={product.volumeL} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-black leading-tight text-navy">{product.name}</h3>
          {product.volumeL > 0 && (
            <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-black text-secondary-foreground">
              {formatLiters(product.volumeL)}
            </span>
          )}
        </div>
        <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
          {product.description}
        </p>
        <div className="mt-auto flex items-center justify-between pt-2">
          <div>
            <p className="text-base font-black leading-none text-primary">
              {formatKz(product.priceKz)}
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              por {product.unitLabel}
              {product.stock <= 10 && (
                <span className="ml-1 font-bold text-amber-600">· últimos {product.stock}!</span>
              )}
            </p>
          </div>
          {inCart ? (
            <QuantityStepper
              size="sm"
              value={inCart.quantity}
              max={product.stock}
              onChange={(v) => setCartQuantity(product.id, v)}
            />
          ) : (
            <Button
              size="sm"
              className="h-9 rounded-full px-4 font-bold"
              disabled={product.stock <= 0}
              onClick={() => addToCart(product)}
            >
              <ShoppingBasket className="h-4 w-4" /> Adicionar
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
