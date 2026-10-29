'use client'

import { io, type Socket } from 'socket.io-client'

let socket: Socket | null = null

/**
 * URL do serviço em tempo real:
 * - NEXT_PUBLIC_REALTIME_URL definido → usa esse endereço (ex.: serviço
 *   dedicado em Railway/Render, se um dia quiser WebSockets na produção)
 * - NEXT_PUBLIC_REALTIME_URL=disabled → desliga os sockets por completo
 * - produção na Vercel (detectada automaticamente no build) → null:
 *   sem serviço de sockets, a app usa POLLING de reserva (hooks.ts)
 * - localhost → liga directo ao serviço de desenvolvimento
 * - preview do sandbox → liga através do gateway (XTransformPort)
 */
function realtimeUrl(): string | null {
  const explicit = process.env.NEXT_PUBLIC_REALTIME_URL
  if (explicit === 'disabled') return null
  if (explicit) return explicit
  // na Vercel, o build define NEXT_PUBLIC_VERCEL_URL automaticamente
  if (process.env.NEXT_PUBLIC_VERCEL_URL) return null
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') {
      return 'http://localhost:3003'
    }
  }
  return '/?XTransformPort=3003'
}

/**
 * Socket falso para quando não há serviço em tempo real (produção
 * na Vercel serverless). Aceita on/off/emit sem fazer nada — assim
 * o resto da app não precisa de saber a diferença, e o polling
 * de reserva mantém tudo actualizado.
 */
function nullSocket(): Socket {
  const stub = {
    connected: false,
    active: false,
    on: () => stub,
    off: () => stub,
    once: () => stub,
    emit: () => stub,
    connect: () => stub,
    disconnect: () => stub,
    close: () => stub,
  }
  return stub as unknown as Socket
}

/**
 * Socket em tempo real (pedidos, GPS do motoboy, feedback).
 * Na Vercel devolve o socket falso — sem erros na consola.
 */
export function getRealtimeSocket(): Socket {
  const url = realtimeUrl()
  if (!url) return nullSocket()

  if (socket && socket.connected) return socket
  if (socket) {
    try {
      socket.disconnect()
    } catch {
      // ignora
    }
  }
  socket = io(url, {
    transports: ['websocket', 'polling'],
    forceNew: true,
    reconnection: true,
    reconnectionAttempts: 30,
    reconnectionDelay: 1000,
    timeout: 10000,
  })
  return socket
}

/** Os sockets estão ligados e a funcionar? (false → hooks usam polling) */
export function isRealtimeConnected(): boolean {
  return Boolean(socket && socket.connected)
}

export function disconnectRealtime() {
  if (socket) {
    try {
      socket.disconnect()
    } catch {
      // ignora
    }
    socket = null
  }
}

/** Envia a posição GPS do motoboy para todos os clientes ligados */
export function emitCourierMove(courierId: string, lat: number, lng: number) {
  const s = getRealtimeSocket()
  s.emit('courier:move', { courierId, lat, lng })
}
