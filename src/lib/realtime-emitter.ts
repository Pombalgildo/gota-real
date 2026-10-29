import { io, type Socket } from 'socket.io-client'

const REALTIME_URL = 'http://localhost:3003'

const globalForRealtime = globalThis as unknown as {
  __gotaRealtimeEmitter?: Socket
}

function getEmitter(): Socket {
  if (
    globalForRealtime.__gotaRealtimeEmitter &&
    globalForRealtime.__gotaRealtimeEmitter.connected
  ) {
    return globalForRealtime.__gotaRealtimeEmitter
  }
  if (globalForRealtime.__gotaRealtimeEmitter) {
    try {
      globalForRealtime.__gotaRealtimeEmitter.close()
    } catch {
      // ignora
    }
  }
  const socket = io(REALTIME_URL, {
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 20,
    reconnectionDelay: 500,
    timeout: 5000,
  })
  globalForRealtime.__gotaRealtimeEmitter = socket
  return socket
}

/**
 * Envia um evento em tempo real a todos os clientes ligados
 * (app do cliente, painel da central e painel do motoboy).
 * Deve ser usado apenas no servidor (API routes).
 */
export async function emitRealtime(event: string, payload: unknown): Promise<void> {
  try {
    const socket = getEmitter()
    const send = () => socket.emit('relay', { event, payload })
    if (socket.connected) {
      send()
    } else {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => resolve(), 2000)
        socket.once('connect', () => {
          clearTimeout(timer)
          send()
          resolve()
        })
        if (socket.active) socket.connect()
      })
    }
  } catch (error) {
    console.error('[realtime-emitter] falha ao enviar evento:', error)
  }
}
