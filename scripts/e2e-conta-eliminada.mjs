#!/usr/bin/env node
/**
 * E2E — CONTA ELIMINADA DEIXA DE SER OPERACIONAL (anti-fantasma)
 *
 * Valores esperados após a correcção:
 *   1. Registo novo devolve SESSÃO (auto-entrada) e o pedido funciona
 *   2. Pedido SEM token → 401 (antes era aceite!)
 *   3. Admin elimina a conta →
 *        · login da cliente falha (404)
 *        · /api/auth/me com o token antigo → 401
 *        · pedidos, perfil, eventos, recepção e mensagens → 401/403
 *        · registo Customer com histórico fica (faturação)
 *   4. Cliente SEM pedidos → registo Customer também é apagado
 *   5. Re-registo pelo mesmo telefone → conta NOVA com sessão (histórico mantido)
 *   6. Registo com telefone de conta existente + senha errada → 409
 *   7. Anti-burla (confirmação de recepção) continua a funcionar com sessão
 *
 * Uso: node scripts/e2e-conta-eliminada.mjs [base-url]
 */
const BASE = process.argv[2] ?? 'http://127.0.0.1:3100'

const results = []
function check(name, ok, extra = '') {
  results.push({ name, ok })
  console.log(`${ok ? '✅' : '❌'} ${name}${extra ? ` — ${extra}` : ''}`)
}

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data }
}

const PHONE_A = '923 888 777' // cliente COM pedido (histórico)
const PHONE_B = '923 888 778' // cliente SEM pedido
const PASS = 'teste123'

async function main() {
  console.log(`\n🧪 E2E conta eliminada contra ${BASE}\n`)

  // ---------- entradas ----------
  const admin = (await api('/api/auth/login', { method: 'POST', body: { identifier: 'admin@gotareal.ao', password: 'admin123' } })).data
  check('login do administrador', Boolean(admin?.token))
  const adminToken = admin?.token

  const products = (await api('/api/products')).data.products ?? []
  const product = products.find((p) => p.stock > 0)
  check('produto com stock', Boolean(product), product?.name)
  const stockBefore = product?.stock ?? 0

  // ---------- 1. registo novo = sessão aberta ----------
  const regA = await api('/api/customers', {
    method: 'POST',
    body: {
      name: 'Teste Conta Eliminada A',
      phone: PHONE_A,
      password: PASS,
      address: 'Rua de Teste, Luanda',
      latitude: -8.81,
      longitude: 13.23,
      locationSource: 'exata',
    },
  })
  check('registo devolve sessão (token + user + customer)', Boolean(regA.data?.token && regA.data?.user && regA.data?.customer), `user=${regA.data?.user?.email}`)
  const tokenA = regA.data?.token
  const customerA = regA.data?.customer

  // ---------- 2. pedido COM sessão funciona; SEM sessão é recusado ----------
  const orderOk = await api('/api/orders', {
    method: 'POST',
    token: tokenA,
    body: { customerId: customerA.id, items: [{ productId: product.id, quantity: 1 }], paymentMethod: 'CASH' },
  })
  check('pedido COM sessão é aceite', orderOk.status === 200 && Boolean(orderOk.data?.order?.id), `#${orderOk.data?.order?.number}`)
  const orderA = orderOk.data?.order

  const orderNoToken = await api('/api/orders', {
    method: 'POST',
    body: { customerId: customerA.id, items: [{ productId: product.id, quantity: 1 }], paymentMethod: 'CASH' },
  })
  check('pedido SEM token é recusado (401)', orderNoToken.status === 401, `status=${orderNoToken.status}`)

  const orderWrongCustomer = await api('/api/orders', {
    method: 'POST',
    token: tokenA,
    body: { customerId: 'cmvxxxxxxxxxxxxxxxxxxxxx', items: [{ productId: product.id, quantity: 1 }], paymentMethod: 'CASH' },
  })
  check('pedido com customerId de outrem é recusado (401/403/404)', [401, 403, 404].includes(orderWrongCustomer.status), `status=${orderWrongCustomer.status}`)

  // ---------- 3. ADMIN ELIMINA a conta ----------
  const del = await api(`/api/users/${regA.data.user.id}`, { method: 'DELETE', token: adminToken })
  check('administrador elimina o perfil', del.status === 200, `status=${del.status}`)

  const loginDepois = await api('/api/auth/login', { method: 'POST', body: { identifier: PHONE_A, password: PASS } })
  check('login da conta eliminada falha (404)', loginDepois.status === 404, `status=${loginDepois.status}`)

  const meDepois = await api('/api/auth/me', { token: tokenA })
  check('/api/auth/me com token antigo → 401', meDepois.status === 401, `status=${meDepois.status}`)

  const pedidoDepois = await api('/api/orders', {
    method: 'POST',
    token: tokenA,
    body: { customerId: customerA.id, items: [{ productId: product.id, quantity: 1 }], paymentMethod: 'CASH' },
  })
  check('pedido com token antigo → 401', pedidoDepois.status === 401, `status=${pedidoDepois.status}`)

  const listaDepois = await api(`/api/orders?customerId=${customerA.id}`, { token: tokenA })
  check('lista de pedidos com token antigo → 401', listaDepois.status === 401, `status=${listaDepois.status}`)

  const perfilDepois = await api(`/api/customers/${customerA.id}`, { token: tokenA })
  check('perfil do cliente com token antigo → 401/404', [401, 404].includes(perfilDepois.status), `status=${perfilDepois.status}`)

  const eventosDepois = await api(`/api/events?customerId=${customerA.id}`, { token: tokenA })
  check('eventos do cliente com token antigo → scope none', eventosDepois.data?.scope === 'none', `scope=${eventosDepois.data?.scope}`)

  const recepcaoDepois = await api(`/api/orders/${orderA.id}/receipt`, { method: 'POST', token: tokenA, body: { action: 'confirm' } })
  check('confirmação de recepção com token antigo → 401', recepcaoDepois.status === 401, `status=${recepcaoDepois.status}`)

  const msgDepois = await api('/api/feedback', { method: 'POST', token: tokenA, body: { customerId: customerA.id, type: 'sugestao', subject: 'teste', message: 'teste' } })
  check('mensagem em nome da conta eliminada → 401/403', [401, 403].includes(msgDepois.status), `status=${msgDepois.status}`)

  // cliente com histórico: registo Customer TEM de ficar (faturação)
  const verificaA = await fetch(`${BASE}/api/customers/${customerA.id}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  }).then((r) => r.json()).catch(() => ({}))
  check('registo Customer COM pedido fica para a faturação', Boolean(verificaA?.customer), `orders=${verificaA?.ordersCount}`)

  // ---------- 4. cliente SEM pedidos → Customer também desaparece ----------
  const regB = await api('/api/customers', {
    method: 'POST',
    body: { name: 'Teste Conta Eliminada B', phone: PHONE_B, password: PASS, latitude: -8.81, longitude: 13.23, locationSource: 'exata' },
  })
  check('segundo registo devolve sessão', Boolean(regB.data?.token && regB.data?.customer))
  const customerB = regB.data?.customer

  const delB = await api(`/api/users/${regB.data.user.id}`, { method: 'DELETE', token: adminToken })
  check('administrador elimina o segundo perfil', delB.status === 200)

  const verificaB = await api(`/api/customers/${customerB.id}`, { token: adminToken })
  check('registo Customer SEM pedidos é removido (404)', verificaB.status === 404, `status=${verificaB.status}`)

  // ---------- 5. re-registo pelo mesmo telefone = conta NOVA ----------
  const regA2 = await api('/api/customers', {
    method: 'POST',
    body: { name: 'Teste Conta Eliminada A', phone: PHONE_A, password: PASS, latitude: -8.81, longitude: 13.23, locationSource: 'exata' },
  })
  check('re-registo pelo mesmo telefone cria conta nova com sessão', Boolean(regA2.data?.token && regA2.data?.customer))
  check('re-registo mantém o histórico do cliente', regA2.data?.customer?.id === customerA.id)
  const tokenA2 = regA2.data?.token

  const listaA2 = await api(`/api/orders?customerId=${customerA.id}`, { token: tokenA2 })
  check('histórico de pedidos visível com a nova sessão', Array.isArray(listaA2.data?.orders) && listaA2.data.orders.length >= 1, `${listaA2.data?.orders?.length} pedidos`)

  // ---------- 6. registo com senha errada → 409 (anti-usurpação) ----------
  const regA3 = await api('/api/customers', {
    method: 'POST',
    body: { name: 'Impostor', phone: PHONE_A, password: 'senha-errada', latitude: -8.81, longitude: 13.23, locationSource: 'exata' },
  })
  check('registo com senha errada é recusado (409)', regA3.status === 409, `status=${regA3.status}`)

  const regA4 = await api('/api/customers', {
    method: 'POST',
    body: { name: 'Teste Conta Eliminada A', phone: PHONE_A, password: PASS, latitude: -8.81, longitude: 13.23, locationSource: 'exata' },
  })
  check('registo com senha certa reabre a sessão (200)', regA4.status === 200 && Boolean(regA4.data?.token))

  // ---------- 7. anti-burla continua a funcionar (com sessão) ----------
  const orderR = await api('/api/orders', {
    method: 'POST',
    token: tokenA2,
    body: { customerId: customerA.id, items: [{ productId: product.id, quantity: 1 }], paymentMethod: 'TPA' },
  })
  check('pedido de teste do anti-burla criado', orderR.status === 200 && Boolean(orderR.data?.order?.id), `#${orderR.data?.order?.number}`)
  const orderAnti = orderR.data?.order

  const motoboy = (await api('/api/auth/login', { method: 'POST', body: { identifier: 'motoboy@gotareal.ao', password: 'motoboy123' } })).data
  const courierId = motoboy?.courier?.id
  await api(`/api/orders/${orderAnti.id}`, { method: 'PATCH', token: adminToken, body: { action: 'confirm' } })
  await api(`/api/orders/${orderAnti.id}`, { method: 'PATCH', token: adminToken, body: { action: 'assign', courierId } })
  await api(`/api/orders/${orderAnti.id}`, { method: 'PATCH', token: motoboy.token, body: { action: 'dispatch' } })
  const delivered = await api(`/api/orders/${orderAnti.id}`, { method: 'PATCH', token: motoboy.token, body: { action: 'deliver' } })
  check('motoboy conclui a entrega', delivered.status === 200 && delivered.data?.order?.status === 'entregue')

  const receiptSemSessao = await api(`/api/orders/${orderAnti.id}/receipt`, { method: 'POST', body: { action: 'confirm', customerId: customerA.id } })
  check('recepção SEM sessão (customerId no corpo) é recusada (401)', receiptSemSessao.status === 401, `status=${receiptSemSessao.status}`)

  const receiptOk = await api(`/api/orders/${orderAnti.id}/receipt`, { method: 'POST', token: tokenA2, body: { action: 'confirm' } })
  check('cliente confirma recepção COM sessão', receiptOk.status === 200 && receiptOk.data?.order?.receiptStatus === 'confirmado')

  // eventos da central mostram confirmação? (regressão de relatórios)
  const relatorio = await api('/api/reports?period=daily&ref=hoje', { token: adminToken })
  check('relatório diário responde', relatorio.status === 200 && typeof relatorio.data?.kpis?.ordersTotal === 'number', `pedidos=${relatorio.data?.kpis?.ordersTotal}`)

  // GET antigo por telefone → 405 (removido)
  const getTelefone = await api(`/api/customers?phone=${encodeURIComponent(PHONE_A)}`)
  check('GET /api/customers?phone removido (405)', getTelefone.status === 405, `status=${getTelefone.status}`)

  // ---------- resumo ----------
  const failed = results.filter((r) => !r.ok)
  console.log(`\n${failed.length === 0 ? '🎉' : '💥'} ${results.length - failed.length}/${results.length} verificações passaram`)
  if (failed.length > 0) {
    console.log('\nFalhas:')
    for (const f of failed) console.log(`  ❌ ${f.name}`)
    process.exitCode = 1
  }
}

main().catch((err) => {
  console.error('Erro no E2E:', err)
  process.exitCode = 1
})
