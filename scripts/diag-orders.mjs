// Diagnóstico rápido: pedidos restantes e stock na produção
const URL = 'postgresql://neondb_owner:npg_TFUJYg64NeLP@ep-dawn-sun-b5v51mj7-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require'

async function main() {
  const { Client } = await import('pg')
  const c = new Client({ connectionString: URL, ssl: { rejectUnauthorized: false } })
  await c.connect()
  const orders = await c.query('SELECT number, status, "totalKz", "requestedAt" FROM "Order" ORDER BY number')
  console.log('pedidos:', JSON.stringify(orders.rows))
  const items = await c.query(
    'SELECT o.number, i."productName", i.quantity FROM "OrderItem" i JOIN "Order" o ON o.id = i."orderId"'
  )
  console.log('itens:', JSON.stringify(items.rows))
  const stock = await c.query("SELECT name, stock FROM \"Product\" WHERE id = 'cmvrx1c1v0000o1y5tz6xfgsm'")
  console.log('stock bidão 5L:', JSON.stringify(stock.rows))
  await c.end()
}

main().catch((e) => {
  console.error('FALHA:', e.message)
  process.exit(1)
})
