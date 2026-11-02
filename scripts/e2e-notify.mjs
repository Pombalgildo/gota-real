const BASE = 'https://gota-real.vercel.app'
const PRODUCT_ID = 'cmvrx1c1v0000o1y5tz6xfgsm'

async function login(identifier, password) {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  })
  const d = await r.json()
  if (!r.ok) throw new Error(`login ${identifier}: ${JSON.stringify(d)}`)
  return d
}

const cliente = await login('cliente@gotareal.ao', 'cliente123')
const r = await fetch(`${BASE}/api/orders`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    customerId: cliente.customer.id,
    items: [{ productId: PRODUCT_ID, quantity: 2 }],
    paymentMethod: 'CASH',
    notes: 'TESTE E2E notificacoes',
    address: 'Rua Teste E2E, Luanda',
  }),
})
const d = await r.json()
if (!r.ok) throw new Error(JSON.stringify(d))
console.log('PEDIDO CRIADO id=' + d.order.id + ' numero=' + d.order.number + ' status=' + d.order.status)
