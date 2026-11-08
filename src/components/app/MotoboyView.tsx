'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore, formatKz, formatDateTime } from '@/store/app-store'
import { useCouriers, useAllOrders, useStoreConfig, useDrivingRoute } from '@/components/app/hooks'
import { MiniMap } from '@/components/app/MiniMap'
import { PaymentBadge } from '@/components/app/Badges'
import { Avatar } from '@/components/app/Avatar'
import { LogoutButton } from '@/components/app/LoginDialog'
import { InstallPrompt } from '@/components/app/InstallPrompt'
import { AlertBell } from '@/components/app/AlertCenter'
import { orderAction, updateCourier } from '@/lib/api'
import { emitCourierMove, getRealtimeSocket } from '@/lib/realtime-client'
import {
  haversineKm,
  formatDistance,
  googleMapsNavUrl,
  watchPosition,
  clearWatchSafe,
  CENTRAL_BASE,
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

  return (
    <>
      <MotoboyPanel courierName={auth?.user.name} isDriver={isDriver} />
    </>
  )
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
    <div className="min-h-dvh gota-gradient px-5 py-8 pb-36">
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
          {/* sino dos avisos: entrega atribuída toca a sirene até visualizar */}
          <AlertBell light />
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ring-1 ring-white/25">
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

        {/* aviso de instalação no fluxo da página (não flutua):
            nunca tapa as entregas nem os botões do painel */}
        <InstallPrompt placement="inline" />
      </div>
    </div>
  )
}

function DeliveryCard({ order, mode }: { order: Order; mode: 'assigned' | 'in_transit' }) {
  const { toast } = useToast()
  const { auth } = useAppStore()
  const { store } = useStoreConfig()
  const [busy, setBusy] = useState(false)

  // GPS ao vivo
  const [myPos, setMyPos] = useState<GeoPoint | null>(
    order.courier?.latitude != null && order.courier?.longitude != null
      ? { lat: order.courier.latitude, lng: order.courier.longitude }
      : null
  )
  const [simulating, setSimulating] = useState(false)
  const [realGps, setRealGps] = useState(false)
  const [gpsDenied, setGpsDenied] = useState(false)
  const watchIdRef = useRef<number | null>(null)
  const simRef = useRef<{ stop: boolean }>({ stop: false })
  // último envio ao servidor (throttle: no máx 1 a cada 3s e só se andou >15m)
  const lastSentRef = useRef<{ at: number; p: GeoPoint | null }>({ at: 0, p: null })

  const dest: GeoPoint | null =
    order.latitude != null && order.longitude != null
      ? { lat: order.latitude, lng: order.longitude }
      : null

  // rota REAL pelas ruas de Luanda (OSRM) — para navegação e desenho no mapa
  const { route } = useDrivingRoute(mode === 'in_transit' ? myPos : null, dest)

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
      const now = Date.now()
      const last = lastSentRef.current
      const movedKm = last.p ? haversineKm(last.p, p) : Infinity
      // no máximo um envio a cada 3s E só se andou mais de 15m — evita
      // martelar o servidor quando o GPS dispara leituras por segundo
      if (now - last.at < 3000 && movedKm < 0.015) return
      lastSentRef.current = { at: now, p }
      setMyPos(p)
      if (order.courierId) emitCourierMove(order.courierId, p.lat, p.lng)
      if (auth?.token && order.courierId) {
        updateCourier(auth.token, order.courierId, { latitude: p.lat, longitude: p.lng }).catch(
          () => undefined
        )
      }
    },
    [order.courierId, auth?.token]
  )

  // ⭐ GPS REAL liga sozinho quando a entrega está em curso — o motoboy
  // não precisa de tocar em nada e o cliente passa a ver o trajecto
  // verdadeiro a mexer-se no mapa (antes dependia de um botão manual
  // que ninguém ligava, e o mapa ficava parado).
  useEffect(() => {
    if (mode !== 'in_transit') return
    if (realGps || simulating) return
    let cancelled = false
    const id = watchPosition(
      (pos) => {
        if (!cancelled) sendPos({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      () => {
        // permissão negada ou GPS indisponível — o motoboy é avisado
        // no painel e pode ligar manualmente (ou usar a simulação de demo)
        if (!cancelled) setGpsDenied(true)
      }
    )
    if (id != null) {
      watchIdRef.current = id
      setRealGps(true)
      setGpsDenied(false)
      toast({
        title: 'GPS real activado 📍',
        description: 'O cliente vê-no a chegar no mapa, em tempo real.',
      })
    } else {
      setGpsDenied(true)
    }
    return () => {
      cancelled = true
    }
  }, [mode])

  // mantém o ecrã aceso enquanto entrega — sem isto o telemóvel dorme,
  // o GPS pára de emitir e o cliente vê o marcador “congelado”
  useEffect(() => {
    if (mode !== 'in_transit') return
    type Sentinel = { release: () => Promise<void> }
    let sentinel: Sentinel | null = null
    let cancelled = false
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<Sentinel> }
    }
    const acquire = () => {
      nav.wakeLock
        ?.request('screen')
        .then((s) => {
          if (cancelled) s.release().catch(() => undefined)
          else sentinel = s
        })
        .catch(() => undefined)
    }
    acquire()
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !sentinel) acquire()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      sentinel?.release().catch(() => undefined)
    }
  }, [mode])

  /** simula o trajecto do motoboy até ao cliente (sai da base da empresa) */
  const simulateRide = useCallback(async () => {
    if (!dest || !order.courierId) return
    const companyBase: GeoPoint =
      store?.latitude != null && store?.longitude != null
        ? { lat: store.latitude, lng: store.longitude }
        : CENTRAL_BASE
    const start: GeoPoint = myPos ?? companyBase
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
  }, [dest, myPos, order.courierId, sendPos, store, toast])

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
        // o GPS real arranca sozinho ao entrar em trânsito (efeito acima);
        // aqui ficava antes uma simulação de 28 segundos que “teleportava”
        // o marcador para a casa do cliente e depois o mapa congelava —
        // era isto que fazia o rastreio parecer morto na prática
        toast({
          title: 'Entrega iniciada 🛵',
          description: 'GPS real activado — o cliente vê-no a chegar no mapa em tempo real.',
        })
      } else {
        simRef.current.stop = true
        toast({
          title: 'Entrega concluída! ✅',
          description: 'O cliente vai confirmar que recebeu — a central só fecha o caso depois da confirmação dele.',
        })
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
        <PaymentBadge method={order.paymentMethod} className="shrink-0" />
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

      {/* mapa — com a rota REAL pelas ruas quando disponível */}
      {dest && (
        <MiniMap
          customer={dest}
          courier={myPos}
          origin={
            store?.latitude != null && store?.longitude != null
              ? { lat: store.latitude, lng: store.longitude }
              : CENTRAL_BASE
          }
          route={mode === 'in_transit' ? route?.points ?? null : null}
          remainingKm={mode === 'in_transit' ? route?.distanceKm ?? null : null}
          etaMin={mode === 'in_transit' ? route?.durationMin ?? null : null}
          live={mode === 'in_transit' && (simulating || realGps)}
          courierLabel="Você"
          customerLabel={order.customer?.name?.split(' ')[0] || 'Cliente'}
          originLabel={store?.name || 'Gota REAL'}
          compact
        />
      )}

      {/* 🧭 NAVEGAÇÃO: estado do GPS + próxima indicação + botão de voz */}
      {mode === 'in_transit' && (
        <div className="space-y-2 rounded-xl border border-sky-200 bg-sky-50/80 p-3">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                realGps ? 'bg-emerald-100 text-emerald-700' : gpsDenied ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'
              )}
            >
              <Satellite className="h-4 w-4" />
            </span>
            <p className="text-xs font-black leading-snug text-navy">
              {realGps
                ? 'GPS real activo — o cliente vê-no a mover-se no mapa'
                : gpsDenied
                  ? 'GPS desligado! Active a localização do telemóvel para o cliente o ver a chegar'
                  : 'a ligar o GPS do telemóvel…'}
            </p>
            {realGps && <span className="live-dot ml-auto shrink-0" />}
          </div>

          {dest && route && route.steps.length > 0 ? (
            <div className="rounded-lg bg-white p-2.5 shadow-sm">
              <p className="text-[9px] font-black uppercase tracking-wider text-sky-600">
                próxima indicação
              </p>
              <p className="mt-0.5 text-sm font-black leading-snug text-navy">
                {route.steps[0].instruction}
                {route.steps[0].distanceKm > 0.02 && (
                  <span className="font-bold text-sky-700"> · {formatDistance(route.steps[0].distanceKm)}</span>
                )}
              </p>
              <p className="mt-1 text-[11px] font-bold text-muted-foreground">
                faltam {formatDistance(route.distanceKm)} · cerca de{' '}
                {Math.max(1, Math.round(route.durationMin))} min pelas ruas
              </p>
            </div>
          ) : dest && myPos ? (
            <p className="rounded-lg bg-white/70 px-2.5 py-1.5 text-[11px] font-semibold text-sky-700">
              a calcular a melhor rota pelas ruas… (se não aparecer, use o botão abaixo)
            </p>
          ) : null}

          {dest && (
            <Button
              className="btn-gold h-12 w-full rounded-xl text-sm font-black"
              onClick={() => window.open(googleMapsNavUrl(dest), '_blank')}
            >
              <Navigation className="h-5 w-5" /> Navegar com voz (Google Maps)
            </Button>
          )}
        </div>
      )}

      {/* simulação (demonstração) — em uso real prefere-se o GPS do telemóvel */}
      {mode === 'in_transit' && (
        <div className="flex flex-wrap items-center gap-2">
          {distanceKm != null && !route && (
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
              title="Demonstração: move o marcador até ao cliente sem GPS"
            >
              <Sparkles className="h-3.5 w-3.5 text-gold" /> Simular trajecto (demo)
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
            <Satellite className="h-3.5 w-3.5" /> {realGps ? 'GPS real activo' : 'Ligar GPS real'}
          </Button>
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
