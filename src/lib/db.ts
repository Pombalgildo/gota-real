import { PrismaClient } from '@prisma/client'

/* ============================================================
   BASE DE DADOS — cliente Prisma com repetição automática

   O Neon (plano gratuito) suspende a base de dados após alguns
   minutos sem actividade. O primeiro pedido que chega "acorda"
   o servidor, mas enquanto ele arranca as ligações falham com:
     - P1001: Can't reach database server
     - P1002: The database server is starting up
     - erros de ligação: reset, timeout, "connection terminated"
   Sem repetição, o pedido de um cliente perde-se com um erro 500
   ("o perfil do administrador não registrou nada").

   Estratégia:
   1) Extensão Prisma: TODAS as operações de leitura/escrita
      simples repetem automaticamente (são idempotentes à falha:
      se falharam, não chegaram a executar).
   2) withDbRetry(fn): para envolver transações inteiras e blocos
      lógicos nas rotas (POST /api/orders, etc.).
   ============================================================ */

/** Atrasos entre tentativas (ms) — o arranque a frio do Neon
 *  completa normalmente em 1–3 segundos. */
const DB_RETRY_DELAYS_MS = [900, 1800, 3600]

/** Erros transitórios (arranque a frio / rede) que vale a pena repetir. */
function isTransientDbError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { code?: string; message?: string }
  // P1001 = servidor inacessível · P1002 = servidor a arrancar (cold start)
  if (e.code === 'P1001' || e.code === 'P1002') return true
  const msg = String(e.message ?? '')
  return (
    msg.includes('Connection terminated') ||
    msg.includes('Connection reset') ||
    msg.includes('Connection ended') ||
    msg.includes('Connection closed') ||
    msg.includes('connection timeout') ||
    msg.includes('Connection timed out') ||
    msg.includes('Timed out') ||
    msg.includes('socket hang up') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('ECONNRESET') ||
    msg.includes("Can't reach database server") ||
    msg.includes('database server is starting up') ||
    msg.includes('terminating connection') ||
    msg.includes('Connection refused') ||
    msg.includes('the database system is starting up') ||
    msg.includes('the database system is in recovery')
  )
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Executa `fn` e repete automaticamente quando a base de dados
 * está a acordar (Neon cold start) ou a ligação falhou de forma
 * transitória. Erros de validação/negócio nunca são repetidos.
 */
export async function withDbRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= DB_RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt === DB_RETRY_DELAYS_MS.length || !isTransientDbError(err)) {
        throw err
      }
      // regista no log da função para diagnóstico posterior
      console.warn(
        `[db] tentativa ${attempt + 1} falhou (erro transitório), a repetir em ${DB_RETRY_DELAYS_MS[attempt]}ms…`
      )
      await sleep(DB_RETRY_DELAYS_MS[attempt])
    }
  }
  throw lastError
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createDb> | undefined
}

function createDb() {
  return new PrismaClient({
    // em produção só erros (o log de queries enchia os logs e atrasava)
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
  }).$extends({
    query: {
      // todas as operações em todos os modelos repetem em erros transitórios
      $allModels: {
        async $allOperations({ args, query }) {
          return withDbRetry(() => query(args))
        },
      },
    },
  })
}

export const db = globalForPrisma.prisma ?? createDb()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
