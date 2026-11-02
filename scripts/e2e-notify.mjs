/**
 * E2E — NOTIFICAÇÕES: cria um pedido de teste para disparar os alertas
 * (central, motoboy e cliente) contra a base indicada.
 *
 * Usa um cliente de teste registado na hora (com sessão — as acções de
 * cliente exigem-na desde a correcção anti “conta eliminada”).
 *
 * Uso: node scripts/e2e-notify.mjs [base-url]
 *      (por omissão http://127.0.0.1:3100 — NÃO aponta à produção)
 * Limpeza: node scripts/cleanup-e2e-conta-eliminada.mjs (remove o cliente
 *      de teste 923 888 890, os pedidos e repõe o stock)
 */
const BASE = process.argv[2] ?? 'http://127.0.0.1:3100'
const PRODUCT_ID = 'cmvrx1c1v0000o1y5tz6xfgsm'
const TEST_PHONE = '923 888 890'

// registo (ou re-registo) do cliente de teste — devolve a sessão aberta
const r0 = await fetch(`${BASE}/api/customers`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'E2E Notificações Temporário',
    phone: TEST_PHONE,
    password: 'e2e12345',
    latitude: -8.81,
    longitude: 13.23,
    locationSource: 'exata',
  }),
})
const cliente = await r0.json()
if (!r0.ok || !cliente.token) throw new Error('registo do cliente de teste falhou: ' + JSON.stringify(cliente))

const r = await fetch(`${BASE}/api/orders`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cliente.token}` },
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
