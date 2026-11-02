#!/usr/bin/env node
/**
 * LIMPEZA PRÉ-LANÇAMENTO — remove TODOS os dados de teste gravados ao
 * longo da construção da app, preparando a base para a operação oficial.
 *
 * O que é apagado:
 *   ✂ OrderItem + Order   (todos os pedidos de teste — a numeração volta a #1001)
 *   ✂ Feedback            (sugestões/reclamações de teste)
 *   ✂ Session             (sessões antigas de equipa)
 *   ✂ GPS dos entregadores (posição/estado de teste → disponível, sem posição)
 *   📦 Stock dos produtos é REPÔSTO (as quantidades dos pedidos de teste voltam)
 *
 * O que é MANTIDO:
 *   ✅ Users (admin, atendente, motoboy, contas de cliente)
 *   ✅ Customers (fichas de clientes)
 *   ✅ Products (catálogo, preços, fotos, stock)
 *   ✅ StoreConfig (contactos, taxa de entrega, GPS da base)
 *
 * Uso:
 *   DB_CHECK_URL="postgresql://..." node scripts/cleanup-pre-launch.mjs          → mostra plano
 *   DB_CHECK_URL="postgresql://..." node scripts/cleanup-pre-launch.mjs --confirm → APAGA de facto
 */
const url = process.env.DB_CHECK_URL
const CONFIRM = process.argv.includes('--confirm')

async function main() {
  if (!url) {
    console.error('Falta DB_CHECK_URL (base de produção Neon).')
    process.exit(1)
  }
  if (!url.startsWith('postgresql')) {
    console.error('Este script destina-se à base PostgreSQL de produção.')
    process.exit(1)
  }

  const { Client } = await import('pg')
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
  await client.connect()

  const count = async (sql) => (await client.query(sql)).rows[0].n

  const orders = await count('SELECT count(*)::int AS n FROM "Order"')
  const items = await count('SELECT count(*)::int AS n FROM "OrderItem"')
  const feedbacks = await count('SELECT count(*)::int AS n FROM "Feedback"')
  const sessions = await count('SELECT count(*)::int AS n FROM "Session"')
  const couriersGps = await count('SELECT count(*)::int AS n FROM "Courier" WHERE "latitude" IS NOT NULL')
  const customers = await count('SELECT count(*)::int AS n FROM "Customer"')
  const products = await count('SELECT count(*)::int AS n FROM "Product"')

  console.log('════════ LIMPEZA PRÉ-LANÇAMENTO — GOTA REAL ════════')
  console.log(`Pedidos a apagar:            ${orders}`)
  console.log(`Itens de pedido a apagar:    ${items}`)
  console.log(`Mensagens a apagar:          ${feedbacks}`)
  console.log(`Sessões antigas a apagar:    ${sessions}`)
  console.log(`GPS de entregadores a limpar:${couriersGps}`)
  console.log('─────────────────────────────────────────────────────')
  console.log(`Clientes mantidos:           ${customers}`)
  console.log(`Produtos mantidos:           ${products}`)

  if (!CONFIRM) {
    console.log('\n(ANO DE ANÁLISE — nada foi apagado.)')
    console.log('Para apagar mesmo: node scripts/cleanup-pre-launch.mjs --confirm')
    await client.end()
    return
  }

  console.log('\nA apagar…')
  // 1) repõe o stock consumido pelos pedidos de teste (igual ao cancelar).
  //    ATENÇÃO: só pedidos NÃO cancelados — os cancelados já devolveram
  //    stock quando foram anulados (restaurar tudo contaria a dobrar)
  const restored = await client.query(`
    UPDATE "Product" p
    SET stock = p.stock + s.qty
    FROM (
      SELECT oi."productId" AS pid, SUM(oi."quantity")::int AS qty
      FROM "OrderItem" oi
      JOIN "Order" o ON o.id = oi."orderId"
      WHERE o.status <> 'cancelado'
      GROUP BY oi."productId"
    ) s
    WHERE p.id = s.pid
  `)
  console.log(`📦 stock reposto em ${restored.rowCount} produto(s) (quantidades dos pedidos de teste devolvidas)`)

  // 2) itens primeiro (FK), depois pedidos; feedback e sessões são independentes
  await client.query('DELETE FROM "OrderItem"')
  const delOrders = await client.query('DELETE FROM "Order"')
  const delFeedback = await client.query('DELETE FROM "Feedback"')
  const delSessions = await client.query('DELETE FROM "Session"')
  const resetCouriers = await client.query(
    'UPDATE "Courier" SET "latitude" = NULL, "longitude" = NULL, "available" = true'
  )

  console.log(`✂ pedidos apagados:        ${delOrders.rowCount}`)
  console.log(`✂ mensagens apagadas:      ${delFeedback.rowCount}`)
  console.log(`✂ sessões apagadas:        ${delSessions.rowCount}`)
  console.log(`✂ entregadores repostos:   ${resetCouriers.rowCount} (livres, sem posição de teste)`)

  const finais = {
    orders: await count('SELECT count(*)::int AS n FROM "Order"'),
    feedbacks: await count('SELECT count(*)::int AS n FROM "Feedback"'),
    customers: await count('SELECT count(*)::int AS n FROM "Customer"'),
    products: await count('SELECT count(*)::int AS n FROM "Product"'),
    users: await count('SELECT count(*)::int AS n FROM "User"'),
  }
  console.log('─────────────────────────────────────────────────────')
  console.log('ESTADO FINAL (operação oficial):')
  console.log(`  pedidos: ${finais.orders} · mensagens: ${finais.feedbacks}`)
  console.log(`  clientes: ${finais.customers} · produtos: ${finais.products} · utilizadores: ${finais.users}`)
  console.log('\n👑 Base pronta para entrar em operação oficial.')

  await client.end()
}

main().catch((err) => {
  console.error('💥 erro:', err.message)
  process.exit(1)
})
