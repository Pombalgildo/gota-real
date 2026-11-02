// Diagnóstico: contas de clientes eliminadas mas ainda "operacionais"
// Mostra: customers sem User ligado, users CLIENTE, sessões activas e pedidos recentes.
import pg from 'pg'

const DB_CHECK_URL =
  'postgresql://neondb_owner:npg_TFUJYg64NeLP@ep-dawn-sun-b5v51mj7-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require'

const client = new pg.Client({ connectionString: DB_CHECK_URL, ssl: { rejectUnauthorized: false } })

const q = async (label, sql) => {
  const r = await client.query(sql)
  console.log(`\n=== ${label} (${r.rows.length}) ===`)
  for (const row of r.rows) console.log(JSON.stringify(row))
}

await client.connect()

await q('Customers SEM perfil de login (User) — contas eliminadas', `
  SELECT c.id, c.name, c.phone, c.email, c.banned, c."banReason", c."createdAt",
         (SELECT COUNT(*) FROM "Order" o WHERE o."customerId" = c.id) AS orders
  FROM "Customer" c
  LEFT JOIN "User" u ON u."customerId" = c.id
  WHERE u.id IS NULL
  ORDER BY c."createdAt" DESC`)

await q('Users CLIENTE (activos)', `
  SELECT u.id, u.name, u.email, u.phone, u.active, u.banned, u."customerId", u."createdAt"
  FROM "User" u WHERE u.role = 'CLIENTE' ORDER BY u."createdAt" DESC`)

await q('Sessões activas de users CLIENTE', `
  SELECT s.id, s."userId", u.name, u.email, s."createdAt", s."expiresAt"
  FROM "Session" s JOIN "User" u ON u.id = s."userId"
  WHERE u.role = 'CLIENTE' AND s."expiresAt" > now()`)

await q('Pedidos recentes (últimos 10) com estado da conta do cliente', `
  SELECT o.number, o.status, o."requestedAt", c.name AS cliente, c.phone,
         (u.id IS NOT NULL) AS tem_login, c.banned
  FROM "Order" o
  JOIN "Customer" c ON c.id = o."customerId"
  LEFT JOIN "User" u ON u."customerId" = c.id
  ORDER BY o."requestedAt" DESC LIMIT 10`)

await client.end()
console.log('\nOK')
