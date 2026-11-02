// Limpa o pedido de teste E2E #1003 (alarme sonoro em produção) e o cliente
// de teste, repõendo o stock decrementado (2× Bidão Gota REAL 5L).
const URL = 'postgresql://neondb_owner:npg_TFUJYg64NeLP@ep-dawn-sun-b5v51mj7-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require'

async function main() {
  const { Client } = await import('pg')
  const client = new Client({ connectionString: URL, ssl: { rejectUnauthorized: false } })
  await client.connect()

  // 1. apagar itens do pedido de teste nº 1003
  const delItems = await client.query(
    `DELETE FROM "OrderItem" WHERE "orderId" IN (SELECT id FROM "Order" WHERE number = 1003) RETURNING "productId", quantity`
  )
  console.log('itens removidos:', JSON.stringify(delItems.rows))

  // 2. repor stock
  for (const it of delItems.rows) {
    const up = await client.query(
      `UPDATE "Product" SET stock = stock + $1 WHERE id = $2 RETURNING name, stock`,
      [it.quantity, it.productId]
    )
    console.log('stock reposto:', JSON.stringify(up.rows))
  }

  // 3. apagar o pedido nº 1003
  const del = await client.query(
    `DELETE FROM "Order" WHERE number = 1003 RETURNING number, status, "totalKz"`
  )
  console.log('pedido removido:', JSON.stringify(del.rows))

  // 4. apagar o cliente de teste (e o utilizador ligado, se existir)
  const delCustomer = await client.query(
    `DELETE FROM "Customer" WHERE phone = '+244949000111' RETURNING name, phone`
  )
  console.log('cliente removido:', JSON.stringify(delCustomer.rows))
  const delUser = await client.query(
    `DELETE FROM "User" WHERE email LIKE '%949000111%' RETURNING email`
  )
  console.log('utilizador removido:', JSON.stringify(delUser.rows))

  // 5. estado final
  const count = await client.query(`SELECT COUNT(*)::int AS n FROM "Order"`)
  console.log('pedidos na base:', count.rows[0].n)
  await client.end()
}

main().catch((e) => {
  console.error('FALHA:', e.message)
  process.exit(1)
})
