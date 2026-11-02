// Testa a API de produção: login admin + listagem de pedidos
const BASE = process.env.BASE_URL ?? 'https://gota-real.vercel.app'

async function main() {
  console.log(`--- Teste da API: ${BASE} ---`)
  // 1. login admin
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin@gotareal.ao', password: 'admin123' }),
  })
  const loginData = await loginRes.json().catch(() => ({}))
  console.log(`\n[1] POST /api/auth/login → ${loginRes.status}`)
  if (!loginRes.ok) {
    console.log('    ERRO:', JSON.stringify(loginData))
    return
  }
  console.log(`    user: ${loginData.user?.email} (${loginData.user?.role})`)
  const token = loginData.token

  // 2. listar todos os pedidos como admin
  const ordersRes = await fetch(`${BASE}/api/orders?all=1`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const ordersData = await ordersRes.json().catch(() => ({}))
  console.log(`\n[2] GET /api/orders?all=1 → ${ordersRes.status}`)
  if (!ordersRes.ok) {
    console.log('    ERRO:', JSON.stringify(ordersData))
  } else {
    console.log(`    pedidos devolvidos: ${ordersData.orders?.length ?? 0}`)
    for (const o of ordersData.orders ?? []) {
      console.log(`    #${o.number} | ${o.status} | ${o.totalKz} Kz | ${o.customer?.name} | ${o.requestedAt}`)
    }
  }

  // 3. estado da loja (store config) para confirmar que a API responde
  const storeRes = await fetch(`${BASE}/api/store`)
  const storeData = await storeRes.json().catch(() => ({}))
  console.log(`\n[3] GET /api/store → ${storeRes.status}`)
  console.log(`    loja: ${storeData.store?.name} | taxa: ${storeData.store?.deliveryFeeKz} Kz`)

  // 4. produtos activos (para simular um pedido depois)
  const prodRes = await fetch(`${BASE}/api/products`)
  const prodData = await prodRes.json().catch(() => ({}))
  console.log(`\n[4] GET /api/products → ${prodRes.status}`)
  for (const p of (prodData.products ?? []).slice(0, 5)) {
    console.log(`    ${p.name} | ${p.priceKz} Kz | stock:${p.stock} | activo:${p.active} | id:${p.id}`)
  }
}

main().catch((e) => { console.error('FALHA:', e.message); process.exit(1) })
