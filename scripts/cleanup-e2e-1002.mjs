// Limpa o pedido de teste E2E #1002 (criado pela demo cliente Ana em produção)
// e repõe o stock decrementado (2× Bidão Gota REAL 5L → stock volta a 193).
// Não toca no pedido demo #1001.
const URL = 'postgresql://neondb_owner:npg_TFUJYg64NeLP@ep-dawn-sun-b5v51mj7-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require'

async function main() {
  const { Client } = await import('pg')
  const client = new Client({ connectionString: URL, ssl: { rejectUnauthorized: false } })
  await client.connect()

  // 1. apagar itens do pedido #1002
  const delItems = await client.query(
    `DELETE FROM "OrderItem" WHERE "orderId" IN (SELECT id FROM "Order" WHERE number = 1002) RETURNING "productId", quantity`
  )
  console.log('itens removidos:', JSON.stringify(delItems.rows))

  // 2. repor stock (só se algo foi removido)
  for (const it of delItems.rows) {
    const up = await client.query(
      `UPDATE "Product" SET stock = stock + $1 WHERE id = $2 RETURNING name, stock`,
      [it.quantity, it.productId]
    )
    console.log('stock reposto:', JSON.stringify(up.rows))
  }

  // 3. apagar o pedido #1002
  const del = await client.query(`DELETE FROM "Order" WHERE number = 1002 RETURNING number, status, "totalKz"`)
  console.log('pedido removido:', JSON.stringify(del.rows))

  // 4. estado final
  const fin = await client.query(`
    SELECT o.number, o.status, o."totalKz", c.name FROM "Order" o
    LEFT JOIN "Customer" c ON c.id = o."customerId" ORDER BY o.number
  `)
  console.log('encomendas restantes:', JSON.stringify(fin.rows))
  await client.end()
}

main().catch((e) => { console.error('ERRO:', e.message); process.exit(1) })
