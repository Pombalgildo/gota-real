import { createServer } from 'http'
import { Server } from 'socket.io'

const httpServer = createServer()
const io = new Server(httpServer, {
  // DO NOT change the path, it is used by Caddy to forward the request to the correct port
  path: '/',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

interface RelayMessage {
  event: string
  payload: unknown
}

interface CourierMove {
  courierId: string
  lat: number
  lng: number
}

io.on('connection', (socket) => {
  console.log(`[realtime] cliente ligado: ${socket.id}`)

  // Identificação de papel (apenas para log/telemetria)
  socket.on('identify', (data: { role: string; id?: string }) => {
    console.log(`[realtime] identify: ${data.role} ${data.id ?? ''}`)
  })

  // Retransmissão de eventos vindos do servidor Next.js (API routes)
  socket.on('relay', (data: RelayMessage) => {
    if (data && typeof data.event === 'string') {
      io.emit(data.event, data.payload)
    }
  })

  // Posição GPS do motoboy -> difundida a todos (clientes + central filtram)
  socket.on('courier:move', (data: CourierMove) => {
    if (data && typeof data.courierId === 'string') {
      io.emit('courier:position', {
        courierId: data.courierId,
        lat: data.lat,
        lng: data.lng,
        at: new Date().toISOString(),
      })
    }
  })

  socket.on('disconnect', () => {
    console.log(`[realtime] cliente desligado: ${socket.id}`)
  })

  socket.on('error', (error: unknown) => {
    console.error(`[realtime] erro no socket ${socket.id}:`, error)
  })
})

const PORT = 3003
httpServer.listen(PORT, () => {
  console.log(`[realtime] Servidor WebSocket Gota REAL a correr na porta ${PORT}`)
})

process.on('SIGTERM', () => {
  httpServer.close(() => process.exit(0))
})

process.on('SIGINT', () => {
  httpServer.close(() => process.exit(0))
})
