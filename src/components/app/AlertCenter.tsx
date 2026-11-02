'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useAppStore } from '@/store/app-store'
import { fetchEvents, type EventFeedback, type EventOrder } from '@/lib/api'
import {
  alarmPriority,
  installAudioUnlock,
  isAlarmEnabled,
  playTestSound,
  setAlarmEnabled,
  startAlarm,
  stopAlarm,
  unlockAudio,
  type AlarmKind,
} from '@/lib/alarm-sound'
import { ORDER_MANAGER_ROLES, DELIVERY_ROLES } from '@/lib/types'
import { formatKz, formatLiters } from '@/store/app-store'
import { cn } from '@/lib/utils'
import {
  Bell,
  BellRing,
  Bike,
  ClipboardCheck,
  Eye,
  MessageSquareHeart,
  Package,
  ShieldAlert,
  Smartphone,
  Truck,
  Volume2,
  VolumeX,
  X,
  XCircle,
} from 'lucide-react'

/**
 * CENTRO DE ALERTAS DA GOTA REAL
 *
 * Todos — administrador, vendas/atendente, motoboy e cliente — recebem
 * avisos com SOM FORTE que toca em loop e SÓ PÁRA quando o aviso é
 * visualizado ou recebe uma interacção (botão VER / FECHAR):
 *
 *   ADMIN + ATENDENTE → pedido novo (pendente) e mensagem nova do cliente
 *                     + RECLAMAÇÃO: cliente diz que NÃO recebeu (anti-burla)
 *   MOTOBOY/MOTORISTA → entrega atribuída a ele e entregas canceladas
 *   CLIENTE           → cada mudança de estado do pedido e resposta à mensagem
 *                     + CONFIRMAR RECEPÇÃO da entrega ( Recebi / Não recebi )
 *
 * Como a produção corre na Vercel sem WebSockets, a detecção é feita por
 * um polling leve (5 s) ao /api/events, que devolve apenas o que precisa
 * de atenção. Em segundo plano o navegador abranda o relógio, mas o som
 * continua a tocar até o utilizador ver o aviso.
 */

// ---------------------------------------------------------------- tipos

interface AppAlert {
  /** chave única de reconhecimento (ack) */
  key: string
  kind: AlarmKind
  title: string
  body: string
  orderId?: string
  /** para onde levar o utilizador quando tocar em VER */
  tab?: 'pedidos' | 'feedback'
  /** estado actual no servidor (auto-resolve quando o estado muda) */
  stateful: boolean
  at: string
}

type NotifyPermission = 'granted' | 'denied' | 'default' | 'unsupported'

interface AlertsApi {
  /** avisos por visualizar (som a tocar) */
  alerts: AppAlert[]
  /** contagens para os badges (pedidos, mensagens, entregas, reclamações) */
  counts: { orders: number; messages: number; assigns: number; disputes: number }
  ack: (key: string) => void
  ackAll: () => void
  /** vê o aviso: reconhece, pára o som e navega até ao local certo */
  view: (alert: AppAlert) => void
  soundEnabled: boolean
  toggleSound: () => void
  testSound: (kind?: AlarmKind) => void
  notifyPermission: NotifyPermission
  requestNotifications: () => void
}

const AlertCtx = createContext<AlertsApi | null>(null)

export function useAlerts(): AlertsApi {
  const ctx = useContext(AlertCtx)
  if (!ctx) throw new Error('useAlerts precisa do <AlertCenter>')
  return ctx
}

// estado persistido por identidade (sobrevive a recarregamentos:
// o aviso não disparado continua a tocar depois de reabrir a app)
interface AlertStore {
  acked: string[]
  orderStatus: Record<string, string>
  fbStatus: Record<string, string>
  /** avisos de uma só vez, ainda não visualizados */
  pending: AppAlert[]
  initialized: boolean
}

const SOUND_KEY = 'gota-real-sound-enabled'

function loadStore(identity: string): AlertStore {
  const empty: AlertStore = { acked: [], orderStatus: {}, fbStatus: {}, pending: [], initialized: false }
  if (typeof window === 'undefined') return empty
  try {
    const raw = window.localStorage.getItem(`gota-real-alerts2-${identity}`)
    if (!raw) return empty
    const parsed = JSON.parse(raw) as Partial<AlertStore>
    return {
      acked: Array.isArray(parsed.acked) ? parsed.acked.slice(-400) : [],
      orderStatus: parsed.orderStatus ?? {},
      fbStatus: parsed.fbStatus ?? {},
      pending: Array.isArray(parsed.pending) ? parsed.pending.slice(-20) : [],
      initialized: Boolean(parsed.initialized),
    }
  } catch {
    return empty
  }
}

function saveStore(identity: string, store: AlertStore) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      `gota-real-alerts2-${identity}`,
      JSON.stringify({
        acked: [...store.acked].slice(-400),
        orderStatus: store.orderStatus,
        fbStatus: store.fbStatus,
        pending: store.pending.slice(-20),
        initialized: store.initialized,
      })
    )
  } catch {
    // armazenamento cheio / modo privado — ignora
  }
}

// ---------------------------------------------------------------- meta dos tipos de aviso

const KIND_STYLE: Record<AlarmKind, { gradient: string; icon: typeof Package; label: string }> = {
  order: { gradient: 'from-red-600 via-red-500 to-rose-700', icon: Package, label: 'Pedido' },
  assign: { gradient: 'from-amber-500 via-orange-500 to-orange-600', icon: Bike, label: 'Entrega' },
  message: { gradient: 'from-blue-600 via-blue-500 to-indigo-700', icon: MessageSquareHeart, label: 'Mensagem' },
  status: { gradient: 'from-emerald-600 via-teal-500 to-teal-700', icon: Truck, label: 'Estado' },
  cancel: { gradient: 'from-red-700 via-rose-800 to-red-900', icon: XCircle, label: 'Cancelado' },
  receipt: { gradient: 'from-emerald-500 via-lime-500 to-emerald-700', icon: ClipboardCheck, label: 'Recepção' },
  dispute: { gradient: 'from-red-800 via-red-700 to-orange-900', icon: ShieldAlert, label: 'Reclamação' },
}

function orderAlert(o: EventOrder): AppAlert {
  return {
    key: `order-${o.id}`,
    kind: 'order',
    title: `Pedido nº ${o.number} pendente!`,
    body: `${o.customer?.name ?? 'Cliente'} · ${formatLiters(o.totalLiters ?? 0)} · ${formatKz(o.totalKz ?? 0)}${o.customer?.phone ? ` · ${o.customer.phone}` : ''}`,
    orderId: o.id,
    tab: 'pedidos',
    stateful: true,
    at: o.requestedAt,
  }
}

function messageAlert(f: EventFeedback): AppAlert {
  return {
    key: `msg-${f.id}`,
    kind: 'message',
    title: f.type === 'reclamacao' ? 'Reclamação nova!' : 'Mensagem nova do cliente!',
    body: `${f.customer?.name ?? 'Cliente'} · ${f.subject}`,
    tab: 'feedback',
    stateful: true,
    at: f.createdAt,
  }
}

// ---------------------------------------------------------------- componente principal

export function AlertCenter({ children }: { children: ReactNode }) {
  const auth = useAppStore((s) => s.auth)
  const customer = useAppStore((s) => s.customer)
  const courierId = useAppStore((s) => s.courierId)

  const [alerts, setAlerts] = useState<AppAlert[]>([])
  // som activo por omissão; o utilizador pode desligar nas definições
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try {
      return window.localStorage.getItem(SOUND_KEY) !== '0'
    } catch {
      return true
    }
  })
  const [notifyPermission, setNotifyPermission] = useState<NotifyPermission>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission as NotifyPermission
    }
    return 'unsupported'
  })

  const storeRef = useRef<AlertStore | null>(null)
  const notifiedRef = useRef<Set<string>>(new Set())

  // desbloqueio do áudio no primeiro toque em qualquer ponto da app
  useEffect(() => {
    installAudioUnlock()
    try {
      setAlarmEnabled(window.localStorage.getItem(SOUND_KEY) !== '0')
    } catch {
      // ignora
    }
  }, [])

  // papel desta sessão: equipa da central, entregador ou cliente
  const scope = useMemo(() => {
    const role = auth?.user.role
    if (role && (ORDER_MANAGER_ROLES as string[]).includes(role)) {
      return { type: 'staff' as const, token: auth.token, identity: `staff-${auth.user.id}` }
    }
    if (role && (DELIVERY_ROLES as string[]).includes(role)) {
      return {
        type: 'courier' as const,
        token: auth.token,
        // o courier ligado ao perfil (vem do login) ou o registo escolhido
        courierId: courierId ?? auth.user.courier?.id ?? null,
        identity: `courier-${auth.user.id}`,
      }
    }
    if (customer) {
      return {
        type: 'customer' as const,
        token: auth?.token ?? null,
        customerId: customer.id,
        identity: `customer-${customer.id}`,
      }
    }
    return null
  }, [auth, courierId, customer])

  // carrega o estado persistido quando o papel muda (login/logout):
  // sincronização intencional com o localStorage (sistema externo)
  useEffect(() => {
    if (!scope) {
      storeRef.current = null
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAlerts([])
      stopAlarm()
      return
    }
    const store = loadStore(scope.identity)
    storeRef.current = store
    // avisos ainda não visualizados de antes voltam a tocar
    setAlerts(store.pending)
    // o registo de notificações do sistema também é por identidade
    notifiedRef.current = new Set()
  }, [scope?.identity])

  // -------------------------------------------------------------------------
  // sondagem: detecta eventos novos e mantém a lista de avisos viva
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!scope) return

    let alive = true

    const notifySystem = (alert: AppAlert) => {
      if (notifiedRef.current.has(alert.key)) return
      notifiedRef.current.add(alert.key)
      try {
        if (
          typeof window !== 'undefined' &&
          'Notification' in window &&
          Notification.permission === 'granted' &&
          document.hidden
        ) {
          const n = new Notification(`💧 Gota REAL — ${alert.title}`, {
            body: alert.body,
            icon: '/icon-192.png',
            tag: alert.key,
          })
          n.onclick = () => {
            window.focus()
            n.close()
          }
        }
      } catch {
        // alguns navegadores (WebView do APK) não suportam — ignora
      }
    }

    const poll = async () => {
      const store = storeRef.current
      if (!store || !alive) return
      try {
        const data = await fetchEvents({
          // o token é exigido também no âmbito do cliente (conta eliminada
          // deixa de receber alertas)
          token: scope.token,
          courierId: scope.type === 'courier' ? scope.courierId : null,
          customerId: scope.type === 'customer' ? scope.customerId : null,
        })

        const stateful: AppAlert[] = []
        const fresh: AppAlert[] = []

        // primeira sondagem de sempre: fotografa o estado actual apenas
        // para detectar MUDANÇAS a partir daqui — mas NÃO silencia nada do
        // que precisa de acção: pedidos pendentes (central/vendas),
        // entregas atribuídas (motoboy), mensagens abertas e estados
        // activos do cliente (confirmado / em trânsito) continuam a
        // alarmar até serem visualizados, MESMO que tenham chegado antes
        // de abrir a app ou de entrar na sessão
        if (!store.initialized) {
          store.initialized = true
          for (const o of data.orders) {
            // estados terminais antigos não voltam a avisar; os activos sim
            if (o.status === 'entregue' || o.status === 'cancelado') {
              store.acked.push(`st-${o.id}-${o.status}`)
            }
            store.orderStatus[o.id] = o.status
          }
          for (const f of data.feedbacks) {
            store.fbStatus[f.id] = f.status
          }
          store.acked = [...new Set(store.acked)]
          saveStore(scope.identity, store)
        }

        if (scope.type === 'staff') {
          // pedidos pendentes + mensagens abertas + RECLAMAÇÕES de não
          // recepção (anti-burla) = precisam de acção agora
          for (const o of data.orders) {
            if (o.status === 'pendente' && !store.acked.includes(`order-${o.id}`)) {
              stateful.push(orderAlert(o))
            }
            // o cliente diz que NÃO recebeu a mercadoria — o alarme mais
            // grave da app toca até a administração responder ao caso
            if (
              o.receiptStatus === 'disputado' &&
              !store.acked.includes(`dispute-${o.id}`)
            ) {
              stateful.push({
                key: `dispute-${o.id}`,
                kind: 'dispute',
                title: `BURLA? Cliente diz que NÃO recebeu o nº ${o.number}!`,
                body: `${o.customer?.name ?? 'Cliente'} · ${o.customer?.phone ?? ''}${o.courier?.name ? ` · motoboy: ${o.courier.name}` : ''} — ${o.disputeReason ?? 'sem detalhes'}`,
                orderId: o.id,
                tab: 'pedidos',
                stateful: true,
                at: o.updatedAt,
              })
            }
          }
          for (const f of data.feedbacks) {
            if (f.status !== 'aberto') continue
            if (!store.acked.includes(`msg-${f.id}`)) stateful.push(messageAlert(f))
          }
        } else if (scope.type === 'courier') {
          for (const o of data.orders) {
            // entrega atribuída e ainda não iniciada → alarme até despachar
            if (o.status === 'confirmado' && !store.acked.includes(`assign-${o.id}`)) {
              stateful.push({
                key: `assign-${o.id}`,
                kind: 'assign',
                title: 'Nova entrega atribuída a você!',
                body: `Pedido nº ${o.number} · ${o.customer?.name ?? ''} · ${formatLiters(o.totalLiters ?? 0)}${o.address ? ` · ${o.address}` : ''}`,
                orderId: o.id,
                tab: 'pedidos',
                stateful: true,
                at: o.updatedAt,
              })
            }
            // entrega que estava consigo e foi cancelada → aviso único
            // (também apanha o caso atribuído+cancelado entre duas sondagens)
            const prev = store.orderStatus[o.id]
            if (o.status === 'cancelado' && prev !== 'cancelado' && prev !== 'entregue') {
              if (!store.acked.includes(`cancel-${o.id}`)) {
                fresh.push({
                  key: `cancel-${o.id}`,
                  kind: 'cancel',
                  title: `Entrega nº ${o.number} cancelada`,
                  body: 'A central cancelou este pedido que estava consigo. Já não precisa de o entregar.',
                  orderId: o.id,
                  stateful: false,
                  at: o.updatedAt,
                })
              }
            }
            if (o.status === 'confirmado' || o.status === 'em_transito' || o.status === 'cancelado') {
              store.orderStatus[o.id] = o.status
            }
          }
        } else {
          // cliente: cada mudança de estado do SEU pedido + resposta à mensagem
          for (const o of data.orders) {
            const prev = store.orderStatus[o.id]

            // ANTI-BURLA: o motoboy marcou a entrega como feita — o cliente
            // tem de CONFIRMAR que recebeu (ou reclamar que não recebeu);
            // o sino toca em loop até ele responder no ecrã de recepção
            if (o.status === 'entregue' && o.receiptStatus === 'pendente') {
              if (!store.acked.includes(`receipt-${o.id}`)) {
                stateful.push({
                  key: `receipt-${o.id}`,
                  kind: 'receipt',
                  title: `Recebeu o seu pedido nº ${o.number}?`,
                  body: 'O entregador marcou a entrega como concluída. Confirme que recebeu a sua água 💧 — ou reclame se não recebeu nada.',
                  orderId: o.id,
                  tab: 'pedidos',
                  stateful: true,
                  at: o.updatedAt,
                })
              }
              store.orderStatus[o.id] = o.status
              continue
            }

            // estados activos (confirmado / em trânsito) alarmam até serem
            // visualizados — mesmo que tenham chegado com a app fechada;
            // entregue / cancelado avisam uma vez, no momento da mudança
            const active = o.status === 'confirmado' || o.status === 'em_transito'
            const changed = prev === undefined || prev !== o.status
            if (
              (active || (o.status !== 'pendente' && changed)) &&
              !store.acked.includes(`st-${o.id}-${o.status}`)
            ) {
              const meta =
                o.status === 'confirmado'
                  ? { title: `Pedido nº ${o.number} confirmado!`, body: 'A Gota REAL confirmou o seu pedido. Em breve sai para entrega.' }
                  : o.status === 'em_transito'
                    ? { title: `Pedido nº ${o.number} a caminho!`, body: 'A sua água saiu da base e já vem a caminho. Acompanhe o motoboy no mapa.' }
                    : o.status === 'entregue'
                      ? { title: `Pedido nº ${o.number} entregue!`, body: 'A sua água foi entregue. Obrigado por preferir a Gota REAL 💧' }
                      : { title: `Pedido nº ${o.number} cancelado`, body: 'Este pedido foi cancelado pela central. Contacte-nos para mais detalhes.' }
              ;(active ? stateful : fresh).push({
                key: `st-${o.id}-${o.status}`,
                kind: o.status === 'cancelado' ? 'cancel' : 'status',
                ...meta,
                orderId: o.id,
                tab: 'pedidos',
                stateful: active,
                at: o.updatedAt,
              })
            }
            store.orderStatus[o.id] = o.status
          }
          for (const f of data.feedbacks) {
            const prev = store.fbStatus[f.id]
            // resposta nova: estado mudou para "respondido" — ou chegou há
            // menos de 48 h (respondeu enquanto a app estava fechada)
            const respondeuHaPouco = f.respondedAt
              ? Date.now() - new Date(f.respondedAt).getTime() < 48 * 60 * 60 * 1000
              : false
            if (
              f.status === 'respondido' &&
              ((prev === undefined || prev !== 'respondido') || respondeuHaPouco) &&
              !store.acked.includes(`reply-${f.id}`)
            ) {
              fresh.push({
                key: `reply-${f.id}`,
                kind: 'message',
                title: 'A Gota REAL respondeu você!',
                body: `Resposta à sua mensagem: “${f.subject}”. Toque para ler.`,
                tab: 'feedback',
                stateful: false,
                at: f.respondedAt ?? f.createdAt,
              })
            }
            store.fbStatus[f.id] = f.status
          }
        }

        // avisos novos (uma só vez) entram na lista persistida
        if (fresh.length > 0) {
          const known = new Set(store.pending.map((p) => p.key))
          store.pending = [...store.pending, ...fresh.filter((f) => !known.has(f.key))].slice(-20)
        }
        // notificação do sistema (app em segundo plano) — para todos os
        // avisos ainda não anunciados, sejam de uma vez ou persistentes
        for (const a of [...fresh, ...stateful]) notifySystem(a)

        // avisos com estado que já se resolveu saem da lista sozinhos
        // (ex.: outro administrador confirmou o pedido pendente)
        const statefulKeys = new Set(stateful.map((a) => a.key))
        store.pending = store.pending.filter((p) => !p.stateful || statefulKeys.has(p.key))
        saveStore(scope.identity, store)

        const merged = [...stateful, ...store.pending.filter((p) => !statefulKeys.has(p.key))]
        const seen = new Set<string>()
        const unique = merged.filter((a) => (seen.has(a.key) ? false : (seen.add(a.key), true)))
        unique.sort((a, b) => alarmPriority(b.kind) - alarmPriority(a.kind) || b.at.localeCompare(a.at))
        setAlerts(unique)
      } catch {
        // sem rede — tenta outra vez no próximo ciclo
      }
    }

    poll()
    const id = setInterval(poll, 5_000)

    // ao voltar à app (aba em segundo plano), verifica de imediato
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        unlockAudio()
        poll()
      }
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      alive = false
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [scope?.identity, scope?.type, scope?.token, scope?.courierId, scope?.customerId])

  // -------------------------------------------------------------------------
  // o som: toca enquanto houver avisos por visualizar — pára só com o botão
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (alerts.length > 0 && soundEnabled && isAlarmEnabled()) {
      const top = alerts.reduce((best, a) => (alarmPriority(a.kind) > alarmPriority(best.kind) ? a : best))
      startAlarm(top.kind, true)
    } else {
      stopAlarm()
    }
  }, [alerts, soundEnabled])

  const ack = useCallback(
    (key: string) => {
      const store = storeRef.current
      if (store) {
        store.acked.push(key)
        store.pending = store.pending.filter((p) => p.key !== key)
        if (scope) saveStore(scope.identity, store)
      }
      setAlerts((prev) => prev.filter((a) => a.key !== key))
    },
    [scope]
  )

  const view = useCallback(
    (alert: AppAlert) => {
      unlockAudio()
      ack(alert.key)
      // leva o utilizador directo ao local do aviso
      const role = useAppStore.getState().auth?.user.role
      if (role && (ORDER_MANAGER_ROLES as string[]).includes(role)) {
        useAppStore.getState().setCentralTab(alert.tab === 'feedback' ? 'feedback' : 'pedidos')
      } else if (!role || role === 'CLIENTE') {
        if (alert.tab === 'feedback') {
          useAppStore.getState().setTab('feedback')
        } else if (alert.orderId) {
          useAppStore.getState().openTracking(alert.orderId)
        } else {
          useAppStore.getState().setTab('pedidos')
        }
      }
    },
    [ack]
  )

  const ackAll = useCallback(() => {
    const store = storeRef.current
    if (store && scope) {
      for (const a of alerts) store.acked.push(a.key)
      store.pending = []
      saveStore(scope.identity, store)
    }
    setAlerts([])
    stopAlarm()
  }, [alerts, scope])

  const toggleSound = useCallback(() => {
    const next = !isAlarmEnabled()
    setAlarmEnabled(next)
    setSoundEnabled(next)
    try {
      window.localStorage.setItem(SOUND_KEY, next ? '1' : '0')
    } catch {
      // ignora
    }
  }, [])

  const testSound = useCallback((kind: AlarmKind = 'order') => {
    unlockAudio()
    playTestSound(kind)
  }, [])

  const requestNotifications = useCallback(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotifyPermission('unsupported')
      return
    }
    Notification.requestPermission()
      .then((p) => setNotifyPermission(p as NotifyPermission))
      .catch(() => undefined)
  }, [])

  const counts = useMemo(
    () => ({
      orders: alerts.filter((a) => a.kind === 'order').length,
      messages: alerts.filter((a) => a.kind === 'message').length,
      assigns: alerts.filter((a) => a.kind === 'assign').length,
      disputes: alerts.filter((a) => a.kind === 'dispute').length,
    }),
    [alerts]
  )

  const api: AlertsApi = {
    alerts,
    counts,
    ack,
    ackAll,
    view,
    soundEnabled,
    toggleSound,
    testSound,
    notifyPermission,
    requestNotifications,
  }

  return (
    <AlertCtx.Provider value={api}>
      {children}
      <AlarmOverlay />
    </AlertCtx.Provider>
  )
}

// ---------------------------------------------------------------- overlay do alarme

function AlarmOverlay() {
  const { alerts, view, ack, ackAll } = useAlerts()
  if (alerts.length === 0) return null

  const alert = alerts[0]
  const style = KIND_STYLE[alert.kind]
  const Icon = style.icon

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-4"
      role="alertdialog"
      aria-modal="true"
      aria-label={alert.title}
    >
      {/* fundo pulsante */}
      <div className={cn('animate-alarm-bg absolute inset-0 bg-gradient-to-br opacity-95', style.gradient)} />

      <div className="animate-alarm-pulse relative w-full max-w-md">
        <div className="rounded-3xl bg-white/95 p-6 text-center shadow-2xl ring-4 ring-white/50 backdrop-blur">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-red-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-red-700">
              {alerts.length > 1 ? `${alerts.length} avisos` : '1 aviso'} sem ver
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Gota REAL
            </span>
          </div>

          <div
            className={cn(
              'mx-auto mt-4 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br text-white shadow-xl',
              style.gradient
            )}
          >
            <Icon className="h-12 w-12" strokeWidth={2.2} />
          </div>

          <h2 className="mt-4 text-2xl font-black leading-tight text-navy">{alert.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-foreground/80">{alert.body}</p>

          <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
            <Volume2 className="h-3.5 w-3.5" />
            O som pára quando visualizar o aviso
          </p>

          <div className="mt-5 grid gap-2.5">
            <button
              onClick={() => view(alert)}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 text-base font-black uppercase tracking-wide text-white shadow-lg transition-all hover:brightness-110 active:scale-[0.98]"
            >
              <Eye className="h-5 w-5" />
              Ver agora
            </button>
            <button
              onClick={() => ack(alert.key)}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-border bg-white text-sm font-bold text-muted-foreground transition-all hover:bg-secondary active:scale-[0.98]"
            >
              <X className="h-4 w-4" />
              Fechar este aviso
            </button>
            {alerts.length > 1 && (
              <button
                onClick={ackAll}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-red-200 bg-red-50 text-sm font-bold text-red-700 transition-all hover:bg-red-100 active:scale-[0.98]"
              >
                <VolumeX className="h-4 w-4" />
                Silenciar todos ({alerts.length})
              </button>
            )}
          </div>

          {alerts.length > 1 && (
            <p className="mt-3 text-[11px] font-bold text-muted-foreground">
              1 de {alerts.length} · feche para ver o próximo
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- sino com badge (central e motoboy)

export function AlertBell({ light = false }: { light?: boolean }) {
  const { alerts, counts } = useAlerts()
  const [open, setOpen] = useState(false)
  const total = alerts.length

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`Avisos (${total})`}
        className={cn(
          'relative flex h-11 w-11 items-center justify-center rounded-2xl transition-all active:scale-95',
          light
            ? 'bg-white/15 ring-1 ring-white/25 hover:bg-white/25'
            : 'border border-border bg-white shadow-sm hover:bg-secondary'
        )}
      >
        {total > 0 ? (
          <BellRing className={cn('h-5 w-5 animate-alarm-ring', light ? 'text-gold' : 'text-red-600')} />
        ) : (
          <Bell className={cn('h-5 w-5', light ? 'text-white' : 'text-muted-foreground')} />
        )}
        {total > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white shadow ring-2 ring-white">
            {total}
          </span>
        )}
      </button>

      {open && (
        <>
          <button className="fixed inset-0 z-40 cursor-default" aria-hidden onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-13 z-50 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border bg-white shadow-2xl">
            <div className="border-b border-border bg-secondary/60 px-4 py-3">
              <p className="text-sm font-black text-navy">Avisos de agora</p>
              <p className="text-[11px] text-muted-foreground">
                {counts.orders} pedidos · {counts.messages} mensagens · {counts.assigns} entregas
                {counts.disputes > 0 && (
                  <span className="font-black text-red-700"> · {counts.disputes} reclamações</span>
                )}
              </p>
            </div>
            <div className="max-h-72 overflow-y-auto custom-scrollbar">
              {total === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Tudo tranquilo 💧 sem avisos pendentes.
                </p>
              ) : (
                alerts.slice(0, 8).map((a) => {
                  const style = KIND_STYLE[a.kind]
                  const Icon = style.icon
                  return (
                    <div key={a.key} className="flex items-start gap-3 border-b border-border/60 px-4 py-3 last:border-0">
                      <span className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white', style.gradient)}>
                        <Icon className="h-4.5 w-4.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-navy">{a.title}</p>
                        <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">{a.body}</p>
                      </div>
                      <button
                        onClick={() => {
                          setOpen(false)
                          useAppStore.getState().setCentralTab(a.tab === 'feedback' ? 'feedback' : 'pedidos')
                        }}
                        className="mt-1 shrink-0 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-black text-primary hover:bg-primary/20"
                      >
                        ver
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- definições de som (perfil do cliente e ajustes)

export function AlertsSettingsCard() {
  const { soundEnabled, toggleSound, testSound, notifyPermission, requestNotifications, alerts } = useAlerts()

  return (
    <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2.5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-600">
          <BellRing className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-navy">Alertas com som forte</p>
          <p className="text-[11px] leading-snug text-muted-foreground">
            Avisa quando o seu pedido muda de estado ou chega resposta — toca até você ver.
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {/* ligar/desligar o som */}
        <button
          onClick={toggleSound}
          className={cn(
            'flex w-full items-center justify-between rounded-xl border-2 px-3.5 py-3 text-left transition-all active:scale-[0.99]',
            soundEnabled ? 'border-emerald-200 bg-emerald-50' : 'border-border bg-secondary/40'
          )}
        >
          <span className="flex items-center gap-2.5">
            {soundEnabled ? (
              <Volume2 className="h-5 w-5 text-emerald-600" />
            ) : (
              <VolumeX className="h-5 w-5 text-muted-foreground" />
            )}
            <span>
              <span className="block text-sm font-bold text-navy">{soundEnabled ? 'Sons ligados' : 'Sons desligados'}</span>
              <span className="block text-[11px] text-muted-foreground">
                {soundEnabled ? 'O alarme toca até visualizar o aviso' : 'Avisos silenciosos (só no ecrã)'}
              </span>
            </span>
          </span>
          <span
            className={cn(
              'relative h-6 w-11 rounded-full transition-colors',
              soundEnabled ? 'bg-emerald-500' : 'bg-input'
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
                soundEnabled ? 'left-[1.375rem]' : 'left-0.5'
              )}
            />
          </span>
        </button>

        {/* testar o som */}
        <button
          onClick={() => testSound('status')}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-border bg-white px-3.5 py-3 text-sm font-bold text-navy transition-all hover:bg-secondary active:scale-[0.99]"
        >
          <Volume2 className="h-4 w-4 text-primary" />
          Testar o som do alerta
        </button>

        {/* notificações do sistema (Android/navegador) */}
        {notifyPermission !== 'unsupported' && (
          <button
            onClick={requestNotifications}
            disabled={notifyPermission === 'granted'}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-xl border-2 px-3.5 py-3 text-sm font-bold transition-all active:scale-[0.99]',
              notifyPermission === 'granted'
                ? 'cursor-default border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-border bg-white text-navy hover:bg-secondary'
            )}
          >
            <Smartphone className="h-4 w-4" />
            {notifyPermission === 'granted'
              ? 'Notificações do sistema activas'
              : 'Activar notificações do sistema'}
          </button>
        )}

        {alerts.length > 0 && (
          <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-[11px] font-semibold leading-snug text-amber-800">
            Você tem {alerts.length} aviso{alerts.length > 1 ? 's' : ''} por visualizar — o som continua até abrir.
          </p>
        )}
      </div>
    </div>
  )
}

/** Badge pequeno para tabs e menus (contagem de avisos). */
export function AlertCountBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="absolute -right-1.5 -top-1.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-black text-white shadow ring-2 ring-white">
      {count > 9 ? '9+' : count}
    </span>
  )
}
