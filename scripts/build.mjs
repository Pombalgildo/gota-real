/**
 * BUILD — funciona tanto no sandbox (SQLite) como na Vercel (Postgres):
 *
 *  - SQLite local: apenas `next build` (com o fluxo standalone do sandbox)
 *  - Postgres (produção/Vercel):
 *      1. prisma generate
 *      2. prisma migrate deploy  (aplica prisma/migrations)
 *      3. node prisma/seed.mjs   (só cria dados se a base estiver vazia)
 *      4. next build
 */
import { readFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { delimiter } from 'node:path'

// garante que next/prisma do node_modules/.bin estão no PATH
const env = {
  ...process.env,
  PATH: `node_modules/.bin${delimiter}${process.env.PATH ?? ''}`,
}

function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  if (existsSync('.env')) {
    const m = readFileSync('.env', 'utf8').match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/m)
    if (m) return m[1].trim().replace(/^["']|["']$/g, '')
  }
  return ''
}

function run(cmd) {
  console.log(`\n▶ ${cmd}`)
  execSync(cmd, { stdio: 'inherit', env })
}

const url = resolveDatabaseUrl()
const isLocalSqlite = url.startsWith('file:')

if (isLocalSqlite) {
  console.log('[build] ambiente local (SQLite) — build directo do Next.js')
  run('next build')
  // fluxo standalone do sandbox de pré-visualização
  run('cp -r .next/static .next/standalone/.next/')
  run('cp -r public .next/standalone/')
} else {
  console.log('[build] produção (PostgreSQL) — migração + seed + build')
  run('npx prisma generate --schema prisma/schema.prisma')
  run('npx prisma migrate deploy --schema prisma/schema.prisma')
  run('node prisma/seed.mjs')
  run('next build')
}
