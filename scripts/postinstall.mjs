/**
 * POSTINSTALL — escolhe o esquema Prisma certo para o ambiente:
 *
 *  - DATABASE_URL começa por "file:" → SQLite local (sandbox/dev)
 *      → usa prisma/schema.local.prisma
 *  - caso contrário (Postgres na Vercel, Neon, Supabase…)
 *      → usa prisma/schema.prisma (produção)
 *
 * Lê a variável de ambiente ou o ficheiro .env (se existir).
 */
import { readFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'

function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  if (existsSync('.env')) {
    const m = readFileSync('.env', 'utf8').match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/m)
    if (m) return m[1].trim().replace(/^["']|["']$/g, '')
  }
  return ''
}

const url = resolveDatabaseUrl()
const schema = url.startsWith('file:') ? 'prisma/schema.local.prisma' : 'prisma/schema.prisma'

console.log(`[postinstall] prisma generate --schema ${schema}`)
execSync(`npx prisma generate --schema ${schema}`, { stdio: 'inherit' })
