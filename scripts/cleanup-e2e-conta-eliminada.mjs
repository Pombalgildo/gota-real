#!/usr/bin/env node
/**
 * LIMPEZA — remove os dados criados pelo E2E "conta eliminada":
 *   · pedidos de teste e respectivos itens (repõe o stock)
 *   · clientes de teste (923 888 777 / 923 888 778)
 *   · perfis de login e sessões desses clientes
 * Deixa a base pronta para a operação oficial.
 */
import pg from 'pg'

const DB_CHECK_URL =
  'postgresql://neondb_owner:npg_TFUJYg64NeLP@ep-dawn-sun-b5v51mj7-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require'

const PHONES = ['923 888 777', '923 888 778', '923 777 555', '923 888 889', '923 888 890']

const client = new pg.Client({ connectionString: DB_CHECK_URL, ssl: { rejectUnauthorized: false } })
await client.connect()

// 1. clientes de teste
const cust = await client.query('SELECT id, name, phone FROM "Customer" WHERE phone = ANY($1)', [PHONES])
console.log(`Clientes de teste encontrados: ${cust.rows.length}`)
const ids = cust.rows.map((r) => r.id)

if (ids.length > 0) {
  // 2. pedidos + reposição de stock (todos os de teste foram criados e
  // decrementaram stock; nenhum foi cancelado, logo repõe-se tudo)
  const orders = await client.query('SELECT id, number, status FROM "Order" WHERE "customerId" = ANY($1)', [ids])
  console.log(`Pedidos de teste: ${orders.rows.map((o) => `#${o.number} (${o.status})`).join(', ') || 'nenhum'}`)

  for (const o of orders.rows) {
    const items = await client.query(
      'SELECT "productId", quantity FROM "OrderItem" WHERE "orderId" = $1',
      [o.id]
    )
    for (const it of items.rows) {
      await client.query('UPDATE "Product" SET stock = stock + $1 WHERE id = $2', [it.quantity, it.productId])
    }
    await client.query('DELETE FROM "OrderItem" WHERE "orderId" = $1', [o.id])
    await client.query('DELETE FROM "Order" WHERE id = $1', [o.id])
    console.log(`  · pedido #${o.number} removido, stock reposto`)
  }

  // 3. sessões e perfis de login
  await client.query('DELETE FROM "Session" WHERE "userId" IN (SELECT id FROM "User" WHERE "customerId" = ANY($1))', [ids])
  const users = await client.query('DELETE FROM "User" WHERE "customerId" = ANY($1) RETURNING email', [ids])
  console.log(`Perfis de login removidos: ${users.rows.map((u) => u.email).join(', ') || 'nenhum'}`)

  // 4. mensagens de teste (se existirem)
  await client.query('DELETE FROM "Feedback" WHERE "customerId" = ANY($1)', [ids])

  // 5. registos dos clientes
  const del = await client.query('DELETE FROM "Customer" WHERE id = ANY($1) RETURNING name, phone', [ids])
  console.log(`Registos de cliente removidos: ${del.rows.map((r) => `${r.name} (${r.phone})`).join(', ')}`)
}

// ---------- estado final ----------
const final = await client.query(`
  SELECT
    (SELECT COUNT(*) FROM "Customer") AS customers,
    (SELECT COUNT(*) FROM "User" WHERE role = 'CLIENTE') AS users_cliente,
    (SELECT COUNT(*) FROM "Order") AS orders,
    (SELECT COALESCE(MAX(number), 0) FROM "Order") AS max_number,
    (SELECT stock FROM "Product" WHERE name = 'Bidão Gota REAL 5L') AS stock_5l
`)
const s = final.rows[0]
console.log('\n=== ESTADO FINAL ===')
console.log(`Clientes: ${s.customers} · Perfis CLIENTE: ${s.users_cliente} · Pedidos: ${s.orders} (nº máx: ${s.max_number}) · Stock Bidão 5L: ${s.stock_5l}`)

await client.end()
console.log('OK — base limpa para a operação oficial.')
