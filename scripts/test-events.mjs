// Teste do endpoint /api/events (centro de alertas)
const BASE = 'http://localhost:3000'

async function j(url, opts) {
  const res = await fetch(BASE + url, opts)
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data }
}

async function main() {
  // 1. login admin
  const admin = await j('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin@gotareal.ao', password: 'admin123' }),
  })
  console.log('login admin:', admin.status, admin.data.user?.role)
  const token = admin.data.token

  // 2. eventos como staff
  const ev1 = await j('/api/events', { headers: { Authorization: `Bearer ${token}` } })
  console.log('events staff:', ev1.status, 'scope=', ev1.data.scope, 'orders=', ev1.data.orders?.length, 'feedbacks=', ev1.data.feedbacks?.length)

  // 3. login motoboy
  const mb = await j('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'motoboy@gotareal.ao', password: 'motoboy123' }),
  })
  console.log('login motoboy:', mb.status, mb.data.user?.role, 'courierId=', mb.data.user?.courier?.id)
  const evMb = await j('/api/events', { headers: { Authorization: `Bearer ${mb.data.token}` } })
  console.log('events courier:', evMb.status, 'scope=', evMb.data.scope, 'orders=', evMb.data.orders?.length)

  // 4. cliente de teste (cria ou actualiza pelo telefone)
  const cli = await j('/api/customers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Ana Teste Alertas',
      phone: '+244940000001',
      address: 'Rua Teste, Luanda',
      latitude: -8.838,
      longitude: 13.234,
    }),
  })
  const ana = cli.data.customer
  console.log('cliente teste:', ana?.name, ana?.id)
  const evCli = await j(`/api/events?customerId=${ana.id}`)
  console.log('events customer:', evCli.status, 'scope=', evCli.data.scope, 'orders=', evCli.data.orders?.length, 'feedbacks=', evCli.data.feedbacks?.length)

  // 5. cria um pedido NOVO como o cliente
  const prods = await j('/api/products')
  const p = prods.data.products.find((x) => x.active && x.stock > 5)
  const order = await j('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerId: ana.id,
      items: [{ productId: p.id, quantity: 2 }],
      paymentMethod: 'CASH',
      address: ana.address,
    }),
  })
  console.log('pedido criado:', order.status, 'nº', order.data.order?.number, 'status=', order.data.order?.status)

  // 6. eventos staff DE NOVO — o pedido pendente deve aparecer
  const ev2 = await j('/api/events', { headers: { Authorization: `Bearer ${token}` } })
  const novo = ev2.data.orders.find((o) => o.id === order.data.order.id)
  console.log('staff vê o pedido novo?', Boolean(novo), '→', novo ? `#${novo.number} ${novo.status} ${novo.customer?.name}` : 'NÃO')
  console.log('campos do pedido:', novo ? Object.keys(novo).join(',') : '-')

  // 7. confirma o pedido e atribui ao motoboy
  const conf = await j(`/api/orders/${order.data.order.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action: 'confirm' }),
  })
  const assign = await j(`/api/orders/${order.data.order.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action: 'assign', courierId: mb.data.user.courier.id }),
  })
  console.log('confirmado:', conf.status, '| atribuído:', assign.status, 'status=', assign.data.order?.status)

  // 8. o motoboy deve ver a atribuição
  const evMb2 = await j('/api/events', { headers: { Authorization: `Bearer ${mb.data.token}` } })
  const minha = evMb2.data.orders.find((o) => o.id === order.data.order.id)
  console.log('motoboy vê a entrega?', Boolean(minha), '→', minha ? `#${minha.number} ${minha.status}` : 'NÃO')

  // 9. despacha — o cliente deve ver "em_transito"
  const disp = await j(`/api/orders/${order.data.order.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mb.data.token}` },
    body: JSON.stringify({ action: 'dispatch' }),
  })
  console.log('despachado:', disp.status, 'status=', disp.data.order?.status)
  const evCli2 = await j(`/api/events?customerId=${ana.id}`)
  const meu = evCli2.data.orders.find((o) => o.id === order.data.order.id)
  console.log('cliente vê o pedido?', Boolean(meu), '→', meu ? `#${meu.number} ${meu.status}` : 'NÃO')

  console.log('\nID DO PEDIDO DE TESTE (para limpeza):', order.data.order.id)
}

main().catch((e) => {
  console.error('FALHA:', e)
  process.exit(1)
})
