import { io, type Socket } from 'socket.io-client'

// Endereço do serviço de tempo real.
// - No sandbox/dev: http://localhost:3003 (mini-service de sockets)
// - Na Vercel (serverless) não há serviço: VERCEL está definido e o
//   emissor desliga-se sozinho para não atrasar as respostas da API.
// - REALTIME_URL (env) permite apontar a um serviço dedicado no futuro.
const REALTIME_URL = process.env.REALTIME_URL || 'http://localhost:3003'
const REALTIME_ENABLED = !process.env.VERCEL || Boolean(process.env.REALTIME_URL)

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
  // produção na Vercel sem serviço de sockets: sai de imediato
  // (a app cliente actualiza por polling — ver hooks.ts)
  if (!REALTIME_ENABLED) return
  try {
    const socket = getEmitter()
    const send = () => socket.emit('relay', { event, payload })
    if (socket.connected) {
      send()
    } else {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => resolve(), 800)
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
