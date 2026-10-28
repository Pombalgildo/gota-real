'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Courier, Feedback, Order, Product } from '@/lib/types'
import {
  fetchAllOrders,
  fetchCouriers,
  fetchCustomerOrders,
  fetchFeedback,
  fetchProducts,
} from '@/lib/api'
import { getRealtimeSocket } from '@/lib/realtime-client'

/**
 * Hooks de dados com actualização em tempo real via WebSocket.
 */

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

  return { products, loading, reload }
}

export function useCustomerOrders(customerId: string | null | undefined) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!customerId) {
      setOrders([])
      setLoading(false)
      return
    }
    try {
      const { orders } = await fetchCustomerOrders(customerId)
      setOrders(orders)
    } catch {
      // silencioso
    } finally {
      setLoading(false)
    }
  }, [customerId])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    const socket = getRealtimeSocket()
    const onUpdate = (data: { order?: Order }) => {
      if (!data?.order) return
      setOrders((prev) => {
        const idx = prev.findIndex((o) => o.id === data.order!.id)
        if (idx === -1) {
          // pedido novo deste cliente (outra aba/dispositivo)
          if (data.order.customerId === customerId) return [data.order, ...prev]
          return prev
        }
        const next = [...prev]
        next[idx] = data.order
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

  return { orders, loading, reload }
}

export function useAllOrders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    try {
      const { orders } = await fetchAllOrders()
      setOrders(orders)
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
    const onNew = (data: { order?: Order }) => {
      if (!data?.order) return
      setOrders((prev) => {
        const idx = prev.findIndex((o) => o.id === data.order!.id)
        if (idx === -1) return [data.order, ...prev]
        const next = [...prev]
        next[idx] = data.order
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

  return { orders, loading, reload }
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

  return { couriers, loading, reload }
}

export function useFeedback(customerId?: string | null) {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    try {
      const { feedbacks } = await fetchFeedback(customerId ?? undefined)
      setFeedbacks(feedbacks)
    } catch {
      // silencioso
    } finally {
      setLoading(false)
    }
  }, [customerId])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    const socket = getRealtimeSocket()
    const onNew = (data: { feedback?: Feedback }) => {
      if (!data?.feedback) return
      setFeedbacks((prev) => {
        // se for lista de um cliente, apenas adiciona os dele
        if (customerId && data.feedback!.customerId !== customerId) return prev
        const idx = prev.findIndex((f) => f.id === data.feedback!.id)
        if (idx === -1) return [data.feedback, ...prev]
        const next = [...prev]
        next[idx] = data.feedback
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

  return { feedbacks, loading, reload }
}

/** Posição GPS ao vivo de um motoboy (via WebSocket + polling leve) */
export function useCourierPosition(courierId?: string | null) {
  const [state, setState] = useState<{
    id: string | null
    pos: { lat: number; lng: number } | null
  }>({ id: null, pos: null })

  // sincroniza com estado actual do motoboy quando o id muda (async)
  useEffect(() => {
    if (!courierId) return
    let cancelled = false
    fetchCouriers()
      .then(({ couriers }) => {
        if (cancelled) return
        const c = couriers.find((x) => x.id === courierId)
        if (c?.latitude != null && c?.longitude != null) {
          setState((prev) =>
            prev.id === courierId ? prev : { id: courierId, pos: { lat: c.latitude!, lng: c.longitude! } }
          )
        }
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [courierId])

  useEffect(() => {
    const socket = getRealtimeSocket()
    const onMove = (data: { courierId: string; lat: number; lng: number }) => {
      if (!data || data.courierId !== courierId) return
      setState({ id: courierId, pos: { lat: data.lat, lng: data.lng } })
    }
    socket.on('courier:position', onMove)
    return () => {
      socket.off('courier:position', onMove)
    }
  }, [courierId])

  return state.id === courierId ? state.pos : null
}
