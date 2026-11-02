// Limpa os pedidos de teste E2E #1004/#1005/#1006 (notificações) e repõe o stock.
const URL = 'postgresql://neondb_owner:npg_TFUJYg64NeLP@ep-dawn-sun-b5v51mj7-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require'

async function main() {
  const { Client } = await import('pg')
  const client = new Client({ connectionString: URL, ssl: { rejectUnauthorized: false } })
  await client.connect()

  const delItems = await client.query(
    `DELETE FROM "OrderItem" WHERE "orderId" IN (SELECT id FROM "Order" WHERE number IN (1004,1005,1006)) RETURNING "productId", quantity`
  )
  console.log('itens removidos:', JSON.stringify(delItems.rows))

  for (const it of delItems.rows) {
    const up = await client.query(
      `UPDATE "Product" SET stock = stock + $1 WHERE id = $2 RETURNING name, stock`,
      [it.quantity, it.productId]
    )
    console.log('stock reposto:', JSON.stringify(up.rows))
  }

  const del = await client.query(`DELETE FROM "Order" WHERE number IN (1004,1005,1006) RETURNING number, status`)
  console.log('pedidos removidos:', JSON.stringify(del.rows))

  // repor o courier como disponível (a atribuição marcou available=false)
  const cur = await client.query(`UPDATE "Courier" SET available = true WHERE id = 'cmvrx1c1x000ao1y5xxxtcbvj' RETURNING name, available`)
  console.log('courier reposto:', JSON.stringify(cur.rows))

  const fin = await client.query(`SELECT number, status FROM "Order" ORDER BY number`)
  console.log('encomendas restantes:', JSON.stringify(fin.rows))
  await client.end()
}

main().catch((e) => { console.error('ERRO:', e.message); process.exit(1) })
