'use client'

import { useState } from 'react'
import { useAppStore, formatKz, formatLiters, cartTotals } from '@/store/app-store'
import { ProductPhoto } from '@/components/app/ProductPhoto'
import { QuantityStepper } from '@/components/app/Badges'
import { LocationPicker, type PickedLocation } from '@/components/app/LocationPicker'
import { createOrder, updateCustomer } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { CreditCard, Banknote, Loader2, MapPin, ShoppingBasket, Trash2, Droplets, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function CheckoutSheet() {
  const {
    customer,
    cart,
    checkoutOpen,
    setCheckoutOpen,
    setCartQuantity,
    clearCart,
    openTracking,
    setCustomer,
    auth,
  } = useAppStore()
  const { toast } = useToast()
  const token = auth?.token ?? null

  const [payment, setPayment] = useState<'TPA' | 'CASH'>('TPA')
  const [notes, setNotes] = useState('')
  const [recapture, setRecapture] = useState<PickedLocation | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<{ number: number; id: string } | null>(null)

  const totals = cartTotals(cart)
  const deliveryLoc = recapture ?? (customer?.latitude != null && customer?.longitude != null
    ? { lat: customer.latitude, lng: customer.longitude, source: 'gps' as const, accuracy: null, address: customer.address }
    : null)

  async function submitOrder() {
    if (!customer || cart.length === 0) return
    setSubmitting(true)
    try {
      // se recapturou a localização, actualiza o perfil
      let lat = customer.latitude
      let lng = customer.longitude
      if (recapture) {
        lat = recapture.lat
        lng = recapture.lng
        try {
          const { customer: updated } = await updateCustomer(customer.id, {
            latitude: recapture.lat,
            longitude: recapture.lng,
            address: recapture.address ?? customer.address,
            locationSource: 'atualizada',
          }, token)
          setCustomer(updated)
        } catch {
          // não bloqueia o pedido
        }
      }

      const { order } = await createOrder({
        customerId: customer.id,
        items: cart.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
        paymentMethod: payment,
        notes: notes.trim() || undefined,
        latitude: lat,
        longitude: lng,
        address: deliveryLoc?.address ?? customer.address,
      }, token)

      clearCart()
      setNotes('')
      setRecapture(null)
      setSuccess({ number: order.number, id: order.id })
      toast({
        title: `Pedido nº ${order.number} enviado! 💧`,
        description: 'A central vai confirmar e enviar o seu motoboy.',
      })
    } catch (err) {
      // erro de rede (sem internet / servidor acordando): mensagem clara
      // e o carrinho mantém-se — basta tentar novamente
      const isNetwork =
        err instanceof TypeError ||
        /fetch|network|networkerror|failed to/i.test(err instanceof Error ? err.message : '')
      toast({
        title: 'Não foi possível enviar o pedido',
        description: isNetwork
          ? 'Sem ligação ao servidor. Verifique a internet e toque novamente — o seu pedido fica guardado no carrinho.'
          : err instanceof Error
            ? err.message
            : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  function close() {
    setCheckoutOpen(false)
    if (success) {
      setSuccess(null)
      openTracking(null)
    }
  }

  return (
    <Sheet open={checkoutOpen} onOpenChange={(open) => (open ? setCheckoutOpen(true) : close())}>
      <SheetContent side="bottom" className="safe-bottom max-h-[94dvh] overflow-y-auto custom-scrollbar rounded-t-3xl px-0">
        <SheetHeader className="px-5 pb-0 pt-2">
          <SheetTitle className="flex items-center gap-2 text-navy">
            <ShoppingBasket className="h-5 w-5 text-primary" />
            {success ? 'Pedido confirmado!' : 'O meu pedido'}
          </SheetTitle>
          <SheetDescription>
            {success
              ? 'Recebemos a sua solicitação. Acompanhe a entrega em tempo real.'
              : 'Revise os itens, escolha o modo de pagamento e confirme a localização de entrega.'}
          </SheetDescription>
        </SheetHeader>

        {success ? (
          <div className="space-y-5 px-5 pb-8 pt-5">
            <div className="flex flex-col items-center rounded-2xl gota-gradient p-6 text-center text-white shadow-lg">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-400/25 ring-4 ring-emerald-300/40">
                <CheckCircle2 className="h-8 w-8 text-emerald-300" />
              </span>
              <h3 className="mt-4 text-xl font-black">Pedido nº {success.number}</h3>
              <p className="mt-1 text-sm text-[#cfe7f8]">
                Registámos o momento do pedido. Vai receber actualizações ao vivo.
              </p>
              <p className="mt-3 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold ring-1 ring-white/25">
                Pagamento: {payment === 'TPA' ? '💳 TPA (cartão na entrega)' : '💵 Dinheiro (cash)'}
              </p>
            </div>
            <Button
              onClick={() => {
                const target = success
                setSuccess(null)
                setCheckoutOpen(false)
                if (target) openTracking(target.id)
              }}
              className="btn-gold h-12 w-full rounded-2xl text-base"
            >
              <MapPin className="h-5 w-5" /> Acompanhar o meu pedido
            </Button>
          </div>
        ) : (
          <div className="space-y-5 px-5 pb-8 pt-4">
            {/* itens */}
            <section aria-label="Itens do pedido" className="space-y-2.5">
              {cart.length === 0 && (
                <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-input bg-white/60 py-10 text-muted-foreground">
                  <Droplets className="h-8 w-8 opacity-40" />
                  <p className="mt-2 text-sm font-medium">O seu pedido está vazio</p>
                  <p className="text-xs">Escolha produtos na loja para continuar.</p>
                </div>
              )}
              {cart.map(({ product, quantity }) => (
                <div key={product.id} className="flex items-center gap-3 rounded-2xl border border-border bg-white p-2.5 shadow-sm">
                  <ProductPhoto product={product} className="h-16 w-16 shrink-0" rounded="rounded-xl" />
                  <div className="min-w-0 flex-1">
                    {/* o nome quebra em até 2 linhas — nunca fica cortado a meio */}
                    <p className="line-clamp-2 text-sm font-bold leading-snug text-navy">{product.name}</p>
                    <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                      {formatKz(product.priceKz)} × {quantity} ={' '}
                      <b className="text-foreground">{formatKz(product.priceKz * quantity)}</b>
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <QuantityStepper
                      size="sm"
                      value={quantity}
                      max={product.stock}
                      onChange={(v) => setCartQuantity(product.id, v)}
                    />
                    <button
                      onClick={() => setCartQuantity(product.id, 0)}
                      className="text-[10px] font-semibold text-red-500 hover:underline"
                      aria-label={`Remover ${product.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> remover
                    </button>
                  </div>
                </div>
              ))}
            </section>

            {cart.length > 0 && (
              <>
                {/* resumo */}
                <div className="rounded-2xl bg-secondary/70 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-secondary-foreground">Total de água</span>
                    <span className="flex items-center gap-1 font-black text-navy">
                      <Droplets className="h-4 w-4 text-primary" /> {formatLiters(totals.totalLiters)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between border-t border-border pt-2">
                    <span className="text-sm font-semibold text-secondary-foreground">
                      Total a pagar ({payment === 'TPA' ? 'TPA' : 'cash'})
                    </span>
                    <span className="text-lg font-black text-primary">{formatKz(totals.totalKz)}</span>
                  </div>
                </div>

                {/* pagamento */}
                <section aria-labelledby="pay-title" className="space-y-2.5">
                  <h3 id="pay-title" className="text-sm font-black text-navy">
                    Modo de pagamento
                  </h3>
                  <RadioGroup value={payment} onValueChange={(v) => setPayment(v as 'TPA' | 'CASH')} className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <Label
                      htmlFor="pay-tpa"
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-3.5 transition-all',
                        payment === 'TPA' ? 'border-primary bg-secondary/60 shadow-sm' : 'border-border bg-white hover:border-input'
                      )}
                    >
                      <RadioGroupItem value="TPA" id="pay-tpa" className="mt-0.5" />
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <CreditCard className="h-5 w-5" />
                      </span>
                      <span>
                        <span className="block text-sm font-black text-navy">TPA</span>
                        <span className="block text-[11px] leading-snug text-muted-foreground">
                          Pagamento com cartão / Multicaixa na entrega
                        </span>
                      </span>
                    </Label>
                    <Label
                      htmlFor="pay-cash"
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-3.5 transition-all',
                        payment === 'CASH' ? 'border-emerald-500 bg-emerald-50 shadow-sm' : 'border-border bg-white hover:border-input'
                      )}
                    >
                      <RadioGroupItem value="CASH" id="pay-cash" className="mt-0.5" />
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                        <Banknote className="h-5 w-5" />
                      </span>
                      <span>
                        <span className="block text-sm font-black text-navy">Cash (dinheiro)</span>
                        <span className="block text-[11px] leading-snug text-muted-foreground">
                          Pagamento em kwanzas ao motoboy
                        </span>
                      </span>
                    </Label>
                  </RadioGroup>
                </section>

                {/* local de entrega */}
                <section aria-labelledby="loc-title" className="space-y-2.5">
                  <h3 id="loc-title" className="text-sm font-black text-navy">
                    Local de entrega
                  </h3>
                  <div className="rounded-2xl border border-border bg-white p-3.5 shadow-sm">
                    <p className="flex items-start gap-2 text-xs leading-relaxed text-foreground">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                      {deliveryLoc
                        ? deliveryLoc.address || 'Localização GPS gravada no cadastro'
                        : 'Sem localização gravada — capture o GPS abaixo.'}
                    </p>
                    {deliveryLoc && (
                      <p className="mt-1 pl-6 font-mono text-[10px] text-muted-foreground">
                        {deliveryLoc.lat.toFixed(5)}, {deliveryLoc.lng.toFixed(5)}
                        {recapture ? ' · actualizada agora' : customer?.locationSource === 'exata' ? ' · local exacto do cadastro' : ' · provisória'}
                      </p>
                    )}
                    <details className="group mt-2">
                      <summary className="cursor-pointer list-none text-xs font-bold text-primary hover:underline">
                        Actualizar localização de entrega
                      </summary>
                      <div className="mt-3">
                        <LocationPicker
                          value={recapture}
                          onChange={setRecapture}
                          compact
                          hint="Só se mudou de sítio: recapture o GPS no novo ponto de entrega."
                        />
                      </div>
                    </details>
                  </div>
                </section>

                {/* notas */}
                <div className="space-y-1.5">
                  <Label htmlFor="order-notes" className="text-sm font-black text-navy">
                    Observações (opcional)
                  </Label>
                  <Textarea
                    id="order-notes"
                    placeholder="Ex.: entregar pela manhã; o portão é azul; ligar ao chegar…"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="min-h-20 bg-white"
                  />
                </div>

                <Button
                  onClick={submitOrder}
                  disabled={submitting || !deliveryLoc}
                  className="btn-gold h-13 w-full rounded-2xl text-base"
                >
                  {submitting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <ShoppingBasket className="h-5 w-5" />
                  )}
                  Confirmar pedido · {formatKz(totals.totalKz)}
                </Button>
                <Input type="hidden" aria-hidden tabIndex={-1} />
              </>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
