'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore, formatKz, formatDateTime } from '@/store/app-store'
import { useCouriers, useAllOrders } from '@/components/app/hooks'
import { MiniMap } from '@/components/app/MiniMap'
import { PaymentBadge } from '@/components/app/Badges'
import { Avatar } from '@/components/app/Avatar'
import { LogoutButton } from '@/components/app/LoginDialog'
import { orderAction, updateCourier } from '@/lib/api'
import { emitCourierMove, getRealtimeSocket } from '@/lib/realtime-client'
import {
  haversineKm,
  formatDistance,
  googleMapsNavUrl,
  watchPosition,
  clearWatchSafe,
  type GeoPoint,
} from '@/lib/geo'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { Order } from '@/lib/types'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  Bike,
  CheckCheck,
  Loader2,
  MapPin,
  Navigation,
  PackageCheck,
  Phone,
  Play,
  Satellite,
  Sparkles,
  Square,
  User,
  Car,
} from 'lucide-react'

export function MotoboyView() {
  const { courierId, setCourierId, auth } = useAppStore()
  const { couriers, loading } = useCouriers()
  // MOTORISTA entrega de carro; MOTOBOY de mota — mesmas funções,
  // só mudam o título e o ícone
  const isDriver = auth?.user.role === 'MOTORISTA'

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="w-full max-w-md space-y-4 px-6">
          <Skeleton className="h-14 w-full rounded-2xl" />
          <Skeleton className="h-14 w-full rounded-2xl" />
          <Skeleton className="h-14 w-full rounded-2xl" />
        </div>
      </div>
    )
  }

  // entregador entrou com perfil mas ainda sem veículo ligado — escolhe qual é o dele
  if (!courierId || !couriers.find((c) => c.id === courierId)) {
    return <CourierSelect couriers={couriers} onSelect={setCourierId} isDriver={isDriver} />
  }

  return <MotoboyPanel courierName={auth?.user.name} isDriver={isDriver} />
}

function CourierSelect({
  couriers,
  onSelect,
  isDriver,
}: {
  couriers: { id: string; name: string; vehicle: string; plate: string }[]
  onSelect: (id: string) => void
  isDriver?: boolean
}) {
  return (
    <div className="min-h-dvh gota-gradient px-5 py-8">
      <div className="mx-auto max-w-md">
        <LogoutButton light label="Terminar sessão" />
        <div className="glass-card rounded-3xl p-6 text-white shadow-xl">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/30">
            {isDriver ? <Car className="h-8 w-8" /> : <Bike className="h-8 w-8" />}
          </span>
          <h1 className="mt-4 text-center text-xl font-black">
            {isDriver ? 'Painel do Motorista' : 'Painel do Motoboy'}
          </h1>
          <p className="mt-1 text-center text-sm text-[#cfe7f8]">
            O seu perfil ainda não tem veículo atribuído. Escolha o seu registo:
          </p>
          <div className="mt-6 space-y-2.5">
            {couriers.map((c) => (
              <button
                key={c.id}
                onClick={() => onSelect(c.id)}
                className="flex w-full items-center gap-3 rounded-2xl bg-white/95 p-3.5 text-left shadow-md transition-all hover:shadow-lg active:scale-[0.99]"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl gota-gradient text-white">
                  <User className="h-5 w-5" />
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-black text-navy">{c.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {c.vehicle} · {c.plate}
                  </span>
                </span>
                <Play className="h-4 w-4 text-primary" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function MotoboyPanel({ courierName, isDriver }: { courierName?: string; isDriver?: boolean }) {
  const { courierId, auth } = useAppStore()
  const { couriers } = useCouriers()
  const { orders, loading } = useAllOrders()
  const { toast } = useToast()

  const courier = couriers.find((c) => c.id === courierId)
  const myOrders = orders.filter((o) => o.courierId === courierId)
  const toDeliver = myOrders.filter((o) => o.status === 'confirmado')
  const inTransit = myOrders.filter((o) => o.status === 'em_transito')
  const deliveredToday = myOrders.filter(
    (o) => o.status === 'entregue' && new Date(o.deliveredAt ?? o.requestedAt).toDateString() === new Date().toDateString()
  )

  return (
    <div className="min-h-dvh bg-background pb-10">
      {/* cabeçalho */}
      <header className="gota-gradient px-4 pb-16 pt-5 text-white shadow-lg">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Avatar
            photo={auth?.user.photo ?? null}
            name={courierName ?? courier?.name ?? 'M'}
            className="h-11 w-11 rounded-2xl ring-2 ring-white/40"
            icon={isDriver ? <Car className="h-5 w-5" /> : <Bike className="h-5 w-5" />}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] font-black uppercase tracking-[0.2em] text-[#BDE3F5]">
              {isDriver ? 'motorista' : 'entregador'} · {courier?.vehicle} {courier?.plate}
            </p>
            <h1 className="truncate text-lg font-black leading-tight">
              {courierName ?? courier?.name ?? (isDriver ? 'Motorista' : 'Motoboy')}
            </h1>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ring-1 ring-white/25">
            <span className="live-dot" /> ao vivo
          </span>
          <LogoutButton light label="Sair" />
        </div>
      </header>

      <div className="mx-auto -mt-11 max-w-3xl space-y-5 px-4">
        {/* resumo */}
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { label: 'a entregar', value: toDeliver.length, icon: PackageCheck, cls: 'text-amber-600 bg-amber-100' },
            { label: 'em rota', value: inTransit.length, icon: Bike, cls: 'text-blue-600 bg-blue-100' },
            { label: 'entregues hoje', value: deliveredToday.length, icon: CheckCheck, cls: 'text-emerald-600 bg-emerald-100' },
          ].map(({ label, value, icon: Icon, cls }) => (
            <div key={label} className="rounded-2xl border border-border bg-white p-3 text-center shadow-md">
              <span className={cn('mx-auto flex h-8 w-8 items-center justify-center rounded-lg', cls)}>
                <Icon className="h-4 w-4" />
              </span>
              <p className="mt-1.5 text-xl font-black leading-none text-navy">{value}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">a carregar entregas…</p>
        ) : (
          <>
            {inTransit.map((order) => (
              <DeliveryCard key={order.id} order={order} mode="in_transit" />
            ))}
            {toDeliver.map((order) => (
              <DeliveryCard key={order.id} order={order} mode="assigned" />
            ))}
            {toDeliver.length === 0 && inTransit.length === 0 && (
              <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-input bg-white/60 py-14 text-muted-foreground">
                <Bike className="h-9 w-9 opacity-40" />
                <p className="mt-2 text-sm font-semibold">Sem entregas atribuídas</p>
                <p className="mt-0.5 text-xs">A central envia pedidos aqui, em tempo real.</p>
              </div>
            )}

            {/* histórico de hoje */}
            {deliveredToday.length > 0 && (
              <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
                <h3 className="text-sm font-black text-navy">Concluídas hoje</h3>
                <ul className="mt-2 space-y-1.5">
                  {deliveredToday.map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="min-w-0 break-words text-foreground">
                        #{o.number} · {o.customer?.name} · {formatDateTime(o.deliveredAt)}
                      </span>
                      <b className="shrink-0 text-emerald-600">{formatKz(o.totalKz)}</b>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function DeliveryCard({ order, mode }: { order: Order; mode: 'assigned' | 'in_transit' }) {
  const { toast } = useToast()
  const { auth } = useAppStore()
  const [busy, setBusy] = useState(false)

  // GPS ao vivo
  const [myPos, setMyPos] = useState<GeoPoint | null>(
    order.courier?.latitude != null && order.courier?.longitude != null
      ? { lat: order.courier.latitude, lng: order.courier.longitude }
      : null
  )
  const [simulating, setSimulating] = useState(false)
  const [realGps, setRealGps] = useState(false)
  const watchIdRef = useRef<number | null>(null)
  const simRef = useRef<{ stop: boolean }>({ stop: false })

  const dest: GeoPoint | null =
    order.latitude != null && order.longitude != null
      ? { lat: order.latitude, lng: order.longitude }
      : null

  // recebe a própria posição (ecos do socket) para o mapa
  useEffect(() => {
    const socket = getRealtimeSocket()
    const onMove = (data: { courierId: string; lat: number; lng: number }) => {
      if (data.courierId === order.courierId) setMyPos({ lat: data.lat, lng: data.lng })
    }
    socket.on('courier:position', onMove)
    return () => {
      socket.off('courier:position', onMove)
    }
  }, [order.courierId])

  // limpeza ao desmontar
  useEffect(() => {
    return () => {
      simRef.current.stop = true
      clearWatchSafe(watchIdRef.current)
    }
  }, [])

  const sendPos = useCallback(
    (p: GeoPoint) => {
      setMyPos(p)
      if (order.courierId) emitCourierMove(order.courierId, p.lat, p.lng)
      updateCourier(order.courierId!, { latitude: p.lat, longitude: p.lng }).catch(() => undefined)
    },
    [order.courierId]
  )

  /** simula o trajecto do motoboy até ao cliente */
  const simulateRide = useCallback(async () => {
    if (!dest || !order.courierId) return
    const start: GeoPoint = myPos ?? { lat: -8.847, lng: 13.241 }
    const steps = 26
    simRef.current.stop = false
    setSimulating(true)
    for (let i = 1; i <= steps; i++) {
      if (simRef.current.stop) break
      const t = i / steps
      // ligeiro desvio em arco para parecer um trajecto real de ruas
      const arc = Math.sin(t * Math.PI) * 0.35
      const lat = start.lat + (dest.lat - start.lat) * t + arc * 0.0012 * Math.sign(dest.lng - start.lng || 1)
      const lng = start.lng + (dest.lng - start.lng) * t + arc * 0.0012 * Math.sign(dest.lat - start.lat || 1) * -1
      sendPos({ lat, lng })
      await new Promise((r) => setTimeout(r, 1100))
    }
    if (!simRef.current.stop) {
      sendPos(dest)
      toast({
        title: 'Chegou ao destino! 🎉',
        description: 'Toque em “Concluir entrega” quando entregar a água.',
      })
    }
    setSimulating(false)
  }, [dest, myPos, order.courierId, sendPos, toast])

  function stopSimulation() {
    simRef.current.stop = true
    setSimulating(false)
  }

  function toggleRealGps() {
    if (realGps) {
      clearWatchSafe(watchIdRef.current)
      watchIdRef.current = null
      setRealGps(false)
      return
    }
    setSimulating(false)
    simRef.current.stop = true
    const id = watchPosition(
      (pos) => sendPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        toast({
          title: 'GPS indisponível',
          description: 'Active a localização ou use a simulação de trajecto.',
          variant: 'destructive',
        })
        setRealGps(false)
      }
    )
    watchIdRef.current = id
    setRealGps(true)
    toast({ title: 'GPS real activado 📍', description: 'A sua posição é enviada ao cliente em tempo real.' })
  }

  async function act(action: 'dispatch' | 'deliver') {
    setBusy(true)
    try {
      await orderAction(auth?.token ?? '', order.id, action)
      if (action === 'dispatch') {
        toast({ title: 'Entrega iniciada 🛵', description: 'O cliente já o vê a chegar no mapa.' })
        simulateRide()
      } else {
        simRef.current.stop = true
        toast({ title: 'Entrega concluída! ✅', description: `Registada às ${new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}` })
      }
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

  const distanceKm = myPos && dest ? haversineKm(myPos, dest) : null

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-white p-4 shadow-md">
      {/* topo */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="break-words text-sm font-black text-navy">
            #{order.number} · {order.customer?.name}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <Phone className="h-3 w-3 shrink-0" /> {order.customer?.phone}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" /> <span className="min-w-0 break-words">{order.address || 'localização GPS'}</span>
          </p>
        </div>
        <PaymentBadge method={order.paymentMethod} />
      </div>

      {/* itens + pagamento a receber */}
      <div className="rounded-xl bg-secondary/60 p-2.5 text-xs">
        <p className="text-secondary-foreground">
          {order.items.map((i) => `${i.quantity}× ${i.productName}`).join(' · ')}
        </p>
        <div className="mt-1.5 flex items-center justify-between border-t border-border pt-1.5">
          <span className="text-muted-foreground">
            {order.paymentMethod === 'TPA' ? 'levar máquina TPA 💳' : 'receber em dinheiro 💵'}
          </span>
          <b className="text-navy">{formatKz(order.totalKz)}</b>
        </div>
      </div>

      {/* mapa */}
      {dest && (
        <MiniMap
          customer={dest}
          courier={myPos}
          live={mode === 'in_transit' && (simulating || realGps)}
          courierLabel="Você"
          compact
        />
      )}

      {/* GPS + distância */}
      {mode === 'in_transit' && (
        <div className="flex flex-wrap items-center gap-2">
          {distanceKm != null && (
            <span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-bold text-secondary-foreground">
              📍 falta {formatDistance(distanceKm)}
            </span>
          )}
          {!simulating ? (
            <Button
              size="sm"
              variant="secondary"
              className="h-9 rounded-full font-bold"
              onClick={simulateRide}
              disabled={realGps}
            >
              <Sparkles className="h-3.5 w-3.5 text-gold" /> Simular trajecto até ao cliente
            </Button>
          ) : (
            <Button size="sm" variant="destructive" className="h-9 rounded-full font-bold" onClick={stopSimulation}>
              <Square className="h-3.5 w-3.5" /> Parar simulação
            </Button>
          )}
          <Button
            size="sm"
            variant={realGps ? 'default' : 'outline'}
            className="h-9 rounded-full font-bold"
            onClick={toggleRealGps}
          >
            <Satellite className="h-3.5 w-3.5" /> {realGps ? 'GPS real activo' : 'Usar GPS real do telemóvel'}
          </Button>
          {dest && (
            <Button
              size="sm"
              variant="outline"
              className="h-9 rounded-full font-bold"
              onClick={() => window.open(googleMapsNavUrl(dest), '_blank')}
            >
              <Navigation className="h-3.5 w-3.5 text-primary" /> Navegar
            </Button>
          )}
        </div>
      )}

      {/* acções principais */}
      <div className="flex gap-2">
        {mode === 'assigned' ? (
          <Button className="h-12 flex-1 rounded-xl font-black" disabled={busy} onClick={() => act('dispatch')}>
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Bike className="h-5 w-5" />}
            Iniciar entrega
          </Button>
        ) : (
          <Button className="btn-gold h-12 flex-1 rounded-xl font-black" disabled={busy} onClick={() => act('deliver')}>
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCheck className="h-5 w-5" />}
            Concluir entrega
          </Button>
        )}
        <Button
          variant="outline"
          className="h-12 rounded-xl font-bold"
          onClick={() => (window.location.href = `tel:${(order.customer?.phone ?? '').replace(/\s/g, '')}`)}
          aria-label="Ligar ao cliente"
        >
          <Phone className="h-5 w-5 text-emerald-600" />
        </Button>
      </div>

      {order.notes && (
        <p className="rounded-xl bg-gold/10 p-2.5 text-xs italic text-[#6B5410]">“{order.notes}”</p>
      )}
    </div>
  )
}
