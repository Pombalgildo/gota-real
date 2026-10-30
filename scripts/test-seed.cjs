/**
 * Teste do seed: cria uma base SQLite NOVA, aplica o esquema local,
 * corre prisma/seed.mjs DUAS VEZES (idempotência) e verifica os dados.
 * Isto valida a mesma lógica que correrá no PostgreSQL da Vercel.
 */
const { execSync } = require('node:child_process')
const { PrismaClient } = require('@prisma/client')

const TEST_DB = '/home/z/my-project/db/seed-test.db'

function run(cmd, env = {}) {
  console.log(`▶ ${cmd}`)
  execSync(cmd, { stdio: 'inherit', env: { ...process.env, ...env } })
}

async function main() {
  // base nova
  try {
    require('node:fs').rmSync(TEST_DB, { force: true })
  } catch {}

  // aplica o esquema local à base de teste
  run(`npx prisma db push --schema prisma/schema.local.prisma --accept-data-loss`, {
    DATABASE_URL: `file:${TEST_DB}`,
  })

  // seed 1ª vez (deve criar tudo)
  console.log('\n=== SEED 1ª execução (base vazia) ===')
  run('node prisma/seed.mjs', { DATABASE_URL: `file:${TEST_DB}` })

  // seed 2ª vez (NÃO deve duplicar nada)
  console.log('\n=== SEED 2ª execução (idempotência) ===')
  run('node prisma/seed.mjs', { DATABASE_URL: `file:${TEST_DB}` })

  // verificação final
  const db = new PrismaClient({ datasources: { db: { url: `file:${TEST_DB}` } } })
  const [users, customers, couriers, products, store] = await Promise.all([
    db.user.count(),
    db.customer.count(),
    db.courier.count(),
    db.product.count(),
    db.storeConfig.count(),
  ])
  const admin = await db.user.findUnique({ where: { email: 'admin@gotareal.ao' } })
  const photos = await db.product.count({ where: { NOT: { image: null } } })

  console.log('\n=== RESULTADO ===')
  console.log(`utilizadores: ${users} | clientes: ${customers} | motoboys: ${couriers} | produtos: ${products} | loja: ${store}`)
  console.log(`admin presente: ${admin ? 'SIM (hash: ' + admin.password.slice(0, 12) + '…)' : 'NÃO'}`)
  console.log(`produtos com foto: ${photos}`)

  const ok =
    users === 4 && customers === 1 && couriers === 3 && products === 11 && store === 1 && admin
  console.log(ok ? '\n✅ SEED VÁLIDO E IDEMPOTENTE' : '\n❌ SEED COM PROBLEMA')

  await db.$disconnect()
  process.exit(ok ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
