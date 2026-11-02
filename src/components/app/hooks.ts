'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Courier, Feedback, Order, Product, StoreConfig, User } from '@/lib/types'
import {
  fetchAllOrders,
  fetchCouriers,
  fetchCustomerOrders,
  fetchFeedback,
  fetchProducts,
  fetchStore,
  fetchUsers,
} from '@/lib/api'
import { getRealtimeSocket, isRealtimeConnected } from '@/lib/realtime-client'
import { useAppStore } from '@/store/app-store'

/**
 * Hooks de dados com actualização em tempo real.
 *
 * WebSockets quando disponíveis (dev/preview) + POLLING DE RESERVA
 * quando não há sockets (produção na Vercel serverless): cada hook
 * recarrega os dados periodicamente enquanto os sockets estiverem
 * desligados — a app fica sempre actualizada em qualquer plataforma.
 */

/**
 * Recarrega `reload` a cada `intervalMs` SÓ quando os WebSockets
 * não estão ligados. Com sockets activos, não faz pedidos extra.
 */
function usePollingFallback(reload: () => void, intervalMs: number) {
  const ref = useRef(reload)
  ref.current = reload
  useEffect(() => {
    const id = setInterval(() => {
      if (!isRealtimeConnected()) ref.current()
    }, intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
}

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    try {
      const { products } = await fetchProducts()
      setProducts(products)
    } catch {
      // silencioso — a loja mostra estado vazio
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  // quando o administrador altera preços, fotos reais ou disponibilidade
  // na Central, a loja de todos os clientes actualiza-se automaticamente
  useEffect(() => {
    const socket = getRealtimeSocket()
    const onProductsUpdate = () => reload()
    socket.on('products:update', onProductsUpdate)
    return () => {
      socket.off('products:update', onProductsUpdate)
    }
  }, [reload])

  // reserva: preços e fotos da loja refrescam a cada 30s sem sockets
  usePollingFallback(reload, 30_000)

  return { products, loading, reload }
}

export function useCustomerOrders(customerId: string | null | undefined) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  // sessão do cliente — os pedidos só são listados para o próprio
  const token = useAppStore((s) => s.auth?.token ?? null)

  const reload = useCallback(async () => {
    if (!customerId) {
      setOrders([])
      setLoading(false)
      return
    }
    try {
      const { orders } = await fetchCustomerOrders(customerId, token)
      setOrders(orders)
    } catch {
      // silencioso (a guarda de sessão em GotaRealApp trata o logout)
    } finally {
      setLoading(false)
    }
  }, [customerId, token])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    const socket = getRealtimeSocket()
    const onUpdate = (data: { order?: Order }) => {
      const order = data?.order
      if (!order) return
      setOrders((prev) => {
        const idx = prev.findIndex((o) => o.id === order.id)
        if (idx === -1) {
          // pedido novo deste cliente (outra aba/dispositivo)
          if (order.customerId === customerId) return [order, ...prev]
          return prev
        }
        const next = [...prev]
        next[idx] = order
        return next
      })
    }
    socket.on('order:update', onUpdate)
    socket.on('order:new', onUpdate)
    return () => {
      socket.off('order:update', onUpdate)
      socket.off('order:new', onUpdate)
    }
  }, [customerId])

  // reserva: o cliente vê confirmação/entrega em até 8s sem sockets
  usePollingFallback(reload, 8_000)

  return { orders, loading, reload }
}

export function useAllOrders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // token da equipa — necessário para ver todos os pedidos
  const token = useAppStore((s) => s.auth?.token ?? null)

  const reload = useCallback(async () => {
    try {
      const { orders } = await fetchAllOrders(token)
      setOrders(orders)
      setError(null)
    } catch (err) {
      // antes o erro era engolido em silêncio e a central ficava “vazia”;
      // agora o painel avisa e oferece tentar novamente
      setError(
        err instanceof Error && err.message
          ? err.message
          : 'Sem ligação ao servidor. Verifique a internet.'
      )
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    const socket = getRealtimeSocket()
    const onNew = (data: { order?: Order }) => {
      const order = data?.order
      if (!order) return
      setOrders((prev) => {
        const idx = prev.findIndex((o) => o.id === order.id)
        if (idx === -1) return [order, ...prev]
        const next = [...prev]
        next[idx] = order
        return next
      })
    }
    socket.on('order:new', onNew)
    socket.on('order:update', onNew)
    return () => {
      socket.off('order:new', onNew)
      socket.off('order:update', onNew)
    }
  }, [])

  // reserva: a CENTRAL recebe pedidos novos em até 6s sem sockets
  usePollingFallback(reload, 6_000)

  return { orders, loading, error, reload }
}

export function useCouriers() {
  const [couriers, setCouriers] = useState<Courier[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    try {
      const { couriers } = await fetchCouriers()
      setCouriers(couriers)
    } catch {
      // silencioso
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  // reserva: estado/posição dos motoboys refresca a cada 15s
  usePollingFallback(reload, 15_000)

  return { couriers, loading, reload }
}

export function useFeedback(customerId?: string | null) {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)
  // token da equipa — necessário para listar todas as mensagens (central)
  const token = useAppStore((s) => s.auth?.token ?? null)

  const reload = useCallback(async () => {
    try {
      const { feedbacks } = await fetchFeedback(customerId ?? undefined, token)
      setFeedbacks(feedbacks)
    } catch {
      // silencioso
    } finally {
      setLoading(false)
    }
  }, [customerId, token])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    const socket = getRealtimeSocket()
    const onNew = (data: { feedback?: Feedback }) => {
      const feedback = data?.feedback
      if (!feedback) return
      setFeedbacks((prev) => {
        // se for lista de um cliente, apenas adiciona os dele
        if (customerId && feedback.customerId !== customerId) return prev
        const idx = prev.findIndex((f) => f.id === feedback.id)
        if (idx === -1) return [feedback, ...prev]
        const next = [...prev]
        next[idx] = feedback
        return next
      })
    }
    socket.on('feedback:new', onNew)
    socket.on('feedback:update', onNew)
    return () => {
      socket.off('feedback:new', onNew)
      socket.off('feedback:update', onNew)
    }
  }, [customerId])

  // reserva: sugestões/reclamações chegam em até 15s sem sockets
  usePollingFallback(reload, 15_000)

  return { feedbacks, loading, reload }
}

/** Perfis de utilizador (apenas administrador) — actualiza em tempo real. */
export function useUsers(token: string | null | undefined) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!token) {
      setUsers([])
      setLoading(false)
      return
    }
    try {
      const { users } = await fetchUsers(token)
      setUsers(users)
    } catch {
      // sem permissão ou erro de rede
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    const socket = getRealtimeSocket()
    const onUsersUpdate = () => reload()
    socket.on('users:update', onUsersUpdate)
    return () => {
      socket.off('users:update', onUsersUpdate)
    }
  }, [reload])

  // reserva: perfis criados/banidos pela central aparecem em até 20s
  usePollingFallback(reload, 20_000)

  return { users, loading, reload }
}

/** Dados da loja (públicos) — actualizam-se quando a equipa os altera. */
export function useStoreConfig() {
  const [store, setStore] = useState<StoreConfig | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    try {
      const { store } = await fetchStore()
      setStore(store)
    } catch {
      // silencioso
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    const socket = getRealtimeSocket()
    const onUpdate = (data: { store?: StoreConfig }) => {
      if (data?.store) setStore(data.store)
    }
    socket.on('store:update', onUpdate)
    return () => {
      socket.off('store:update', onUpdate)
    }
  }, [])

  // reserva: dados da loja (contactos, taxa) refrescam a cada 60s
  usePollingFallback(reload, 60_000)

  return { store, loading, reload }
}

/** Posição GPS ao vivo de um motoboy (WebSocket + polling de reserva) */
export function useCourierPosition(courierId?: string | null) {
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null)

  // posição gravada na base de dados pelo motoboy (última conhecida)
  const reload = useCallback(async () => {
    if (!courierId) return
    try {
      const { couriers } = await fetchCouriers()
      const c = couriers.find((x) => x.id === courierId)
      if (c?.latitude != null && c?.longitude != null) {
        setPos({ lat: c.latitude, lng: c.longitude })
      }
    } catch {
      // silencioso
    }
  }, [courierId])

  useEffect(() => {
    setPos(null)
    reload()
  }, [reload])

  // reserva: sem sockets, a posição do motoboy refresca a cada 5s
  // (o motoboy grava a posição na base a cada movimento)
  usePollingFallback(reload, 5_000)

  // com sockets: actualização instantânea
  useEffect(() => {
    const socket = getRealtimeSocket()
    const onMove = (data: { courierId: string; lat: number; lng: number }) => {
      if (!data || data.courierId !== courierId) return
      setPos({ lat: data.lat, lng: data.lng })
    }
    socket.on('courier:position', onMove)
    return () => {
      socket.off('courier:position', onMove)
    }
  }, [courierId])

  return pos
}
