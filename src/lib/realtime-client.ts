'use client'

import { io, type Socket } from 'socket.io-client'

let socket: Socket | null = null

/**
 * URL do serviço em tempo real:
 * - Através do gateway (acesso externo/preview): '/?XTransformPort=3003'
 * - Acesso directo ao dev server (localhost sem gateway): liga directo ao serviço
 */
function realtimeUrl(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') {
      return 'http://localhost:3003'
    }
  }
  return '/?XTransformPort=3003'
}

/**
 * Socket em tempo real (pedidos, GPS do motoboy, feedback).
 * Liga através do gateway: io('/?XTransformPort=3003')
 */
export function getRealtimeSocket(): Socket {
  if (socket && socket.connected) return socket
  if (socket) {
    try {
      socket.disconnect()
    } catch {
      // ignora
    }
  }
  socket = io(realtimeUrl(), {
    transports: ['websocket', 'polling'],
    forceNew: true,
    reconnection: true,
    reconnectionAttempts: 30,
    reconnectionDelay: 1000,
    timeout: 10000,
  })
  return socket
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
