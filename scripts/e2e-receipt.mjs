#!/usr/bin/env node
/**
 * E2E — CONFIRMAÇÃO DE RECEPÇÃO (anti-burla) + RELATÓRIOS
 *
 * Simula o ciclo completo contra a base indicada:
 *   1. cliente pede → admin confirma + atribui → motoboy entrega
 *   2. cliente CONFIRMA a recepção ✅
 *   3. segundo pedido → cliente RECLAMA que não recebeu ❌
 *   4. admin vê a reclamação nos eventos e RESPONDE
 *   5. relatório diário traz os KPIs (incl. disputas)
 *
 * Uso: node scripts/e2e-receipt.mjs [base-url]
 *      (por omissão http://localhost:3000)
 */
const BASE = process.argv[2] ?? 'http://localhost:3000'

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

async function main() {
  console.log(`\n🧪 E2E anti-burla contra ${BASE}\n`)

  // ---------- entradas ----------
  const admin = (await api('/api/auth/login', { method: 'POST', body: { identifier: 'admin@gotareal.ao', password: 'admin123' } })).data
  const motoboy = (await api('/api/auth/login', { method: 'POST', body: { identifier: 'motoboy@gotareal.ao', password: 'motoboy123' } })).data
  const cliente = (await api('/api/auth/login', { method: 'POST', body: { identifier: 'cliente@gotareal.ao', password: 'cliente123' } })).data
  check('login dos três papéis', Boolean(admin?.token && motoboy?.token && cliente?.token))

  const customerId = cliente.customer?.id ?? cliente.user?.customerId
  const courierId = motoboy.courier?.id ?? motoboy.user?.courier?.id
  check('identidades (cliente + motoboy)', Boolean(customerId && courierId), `courier=${courierId}`)

  const products = (await api('/api/products')).data.products ?? []
  const product = products.find((p) => p.stock > 0)
  check('produto com stock', Boolean(product), product?.name)

  // ---------- CENÁRIO A: entrega confirmada ----------
  const orderA = (await api('/api/orders', {
    method: 'POST',
    body: { customerId, items: [{ productId: product.id, quantity: 1 }], paymentMethod: 'CASH' },
  })).data.order
  check('pedido A criado', Boolean(orderA?.id), `#${orderA?.number}`)

  await api(`/api/orders/${orderA.id}`, { method: 'PATCH', token: admin.token, body: { action: 'confirm' } })
  await api(`/api/orders/${orderA.id}`, { method: 'PATCH', token: admin.token, body: { action: 'assign', courierId } })
  await api(`/api/orders/${orderA.id}`, { method: 'PATCH', token: motoboy.token, body: { action: 'dispatch' } })
  const delivered = (await api(`/api/orders/${orderA.id}`, { method: 'PATCH', token: motoboy.token, body: { action: 'deliver' } })).data.order
  check('entrega A concluída pelo motoboy', delivered?.status === 'entregue')
  check('entrega A ficou À ESPERA da confirmação do cliente', delivered?.receiptStatus === 'pendente')

  // o cliente vê o pedido nos eventos com receiptStatus pendente → alarme
  const evCliente1 = (await api(`/api/events?customerId=${customerId}`)).data
  const evA = evCliente1.orders.find((o) => o.id === orderA.id)
  check('evento do cliente traz receiptStatus=pendente', evA?.receiptStatus === 'pendente')

  const confirmed = (await api(`/api/orders/${orderA.id}/receipt`, {
    method: 'POST',
    body: { action: 'confirm', customerId },
  })).data.order
  check('cliente CONFIRMOU a recepção A', confirmed?.receiptStatus === 'confirmado', `em ${confirmed?.receiptConfirmedAt}`)

  const evCliente2 = (await api(`/api/events?customerId=${customerId}`)).data
  const evA2 = evCliente2.orders.find((o) => o.id === orderA.id)
  check('alerta de recepção A resolvido nos eventos', evA2?.receiptStatus === 'confirmado')

  // ---------- CENÁRIO B: reclamação de não recepção ----------
  const orderB = (await api('/api/orders', {
    method: 'POST',
    body: { customerId, items: [{ productId: product.id, quantity: 2 }], paymentMethod: 'TPA' },
  })).data.order
  await api(`/api/orders/${orderB.id}`, { method: 'PATCH', token: admin.token, body: { action: 'confirm' } })
  await api(`/api/orders/${orderB.id}`, { method: 'PATCH', token: admin.token, body: { action: 'assign', courierId } })
  await api(`/api/orders/${orderB.id}`, { method: 'PATCH', token: motoboy.token, body: { action: 'dispatch' } })
  const deliveredB = (await api(`/api/orders/${orderB.id}`, { method: 'PATCH', token: motoboy.token, body: { action: 'deliver' } })).data.order
  check('entrega B concluída', deliveredB?.status === 'entregue' && deliveredB?.receiptStatus === 'pendente')

  const disputed = (await api(`/api/orders/${orderB.id}/receipt`, {
    method: 'POST',
    body: { action: 'dispute', customerId, reason: 'E2E: o motoboy passou sem entregar' },
  })).data.order
  check('cliente RECLAMOU (não recebeu B)', disputed?.receiptStatus === 'disputado', `"${disputed?.disputeReason}"`)

  // a CENTRAL vê a reclamação nos eventos → alarme dispute
  const evStaff1 = (await api('/api/events', { token: admin.token })).data
  const evB = evStaff1.orders.find((o) => o.id === orderB.id)
  check('central vê a reclamação nos eventos', evB?.receiptStatus === 'disputado' && evB?.status === 'entregue', `motoboy: ${evB?.courier?.name}`)

  // estranho não pode resolver
  const forbidden = await api(`/api/orders/${orderB.id}/receipt`, {
    method: 'PATCH',
    body: { action: 'resolve', resolution: 'hack' },
  })
  check('sem permissão: anónimo não resolve reclamação', forbidden.status === 403)

  const resolved = (await api(`/api/orders/${orderB.id}/receipt`, {
    method: 'PATCH',
    token: admin.token,
    body: { action: 'resolve', resolution: 'E2E: caso analisado e encerrado' },
  })).data.order
  check('admin respondeu e fechou o caso', resolved?.disputeResolvedAt != null, `"${resolved?.disputeResolution}"`)

  const evStaff2 = (await api('/api/events', { token: admin.token })).data
  const stillThere = evStaff2.orders.find((o) => o.id === orderB.id && o.receiptStatus === 'disputado')
  check('alerta da central resolvido (sai dos eventos)', !stillThere)

  // cliente não pode re-disputar caso fechado
  const reDispute = await api(`/api/orders/${orderB.id}/receipt`, {
    method: 'POST',
    body: { action: 'dispute', customerId, reason: 'de novo' },
  })
  check('caso fechado não re-abre por repetition', reDispute.status === 400)

  // ---------- RELATÓRIOS ----------
  const today = new Date().toISOString().slice(0, 10)
  const report = (await api(`/api/reports?period=daily&ref=${today}`, { token: admin.token })).data
  check('relatório diário carrega', Boolean(report?.kpis), report?.label)
  check('relatório conta as disputas', report.kpis.disputesOpen + report.kpis.disputesResolved >= 1, `abertas=${report.kpis.disputesOpen} respondidas=${report.kpis.disputesResolved}`)
  check('relatório conta recepções confirmadas', report.kpis.receiptsConfirmed >= 1, `${report.kpis.receiptsConfirmed}`)
  check('relatório traz série temporal', Array.isArray(report.series) && report.series.length === 24)
  check('relatório traz ranking de entregadores', Array.isArray(report.couriers) && report.couriers.length >= 1, report.couriers?.[0]?.name)

  const weekly = (await api(`/api/reports?period=weekly&ref=${today}`, { token: admin.token })).data
  check('relatório semanal (7 dias)', Array.isArray(weekly.series) && weekly.series.length === 7)
  const monthly = (await api(`/api/reports?period=monthly&ref=${today}`, { token: admin.token })).data
  check('relatório mensal carrega', Boolean(monthly?.label))

  // sem permissão: cliente não vê relatórios
  const noPerm = await api(`/api/reports?period=daily`, { token: cliente.token })
  check('sem permissão: cliente não vê relatórios', noPerm.status === 403)

  // ---------- resumo ----------
  const failed = results.filter((r) => !r.ok)
  console.log(`\n${failed.length === 0 ? '🎉' : '⚠️'} ${results.length - failed.length}/${results.length} verificações passaram\n`)
  if (failed.length > 0) process.exit(1)
}

main().catch((err) => {
  console.error('💥 erro inesperado:', err)
  process.exit(1)
})
