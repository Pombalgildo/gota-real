// Limpa os dados de teste criados na produção durante o diagnóstico
const URL = 'postgresql://neondb_owner:npg_TFUJYg64NeLP@ep-dawn-sun-b5v51mj7-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require'

async function main() {
  const { Client } = await import('pg')
  const client = new Client({ connectionString: URL, ssl: { rejectUnauthorized: false } })
  await client.connect()

  // 1. pedido de teste #1002 (Cliente Teste QA)
  const del = await client.query(
    `DELETE FROM "Order" WHERE number = 1002 AND "customerId" IN (SELECT id FROM "Customer" WHERE phone = '912 345 678') RETURNING number`
  )
  console.log('pedidos de teste removidos:', del.rowCount)

  // 2. utilizador de teste (login do cliente de teste)
  const delUser = await client.query(
    `DELETE FROM "User" WHERE email = '912345678@clientes.gotareal.ao' OR ("customerId" IN (SELECT id FROM "Customer" WHERE phone = '912 345 678')) RETURNING email`
  )
  console.log('utilizadores de teste removidos:', delUser.rowCount)

  // 3. cliente de teste
  const delCust = await client.query(
    `DELETE FROM "Customer" WHERE phone = '912 345 678' RETURNING name`
  )
  console.log('clientes de teste removidos:', delCust.rowCount)

  // estado final
  const orders = await client.query(`SELECT number, status FROM "Order" ORDER BY number`)
  const custs = await client.query(`SELECT name, phone FROM "Customer"`)
  console.log('\nEstado final — pedidos:', JSON.stringify(orders.rows))
  console.log('Estado final — clientes:', JSON.stringify(custs.rows))
  await client.end()
}

main().catch((e) => { console.error('ERRO:', e.message); process.exit(1) })
