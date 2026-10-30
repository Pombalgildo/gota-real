/**
 * Limpa registos de teste do seed-data.json antes de ir para produção.
 * Mantém: admin, motoboys reais, conta demo do cliente, produtos e loja.
 */
const fs = require('node:fs')

const d = JSON.parse(fs.readFileSync('prisma/seed-data.json', 'utf8'))

const REMOVE_USER_EMAILS = [
  'joao.motoboy@gotareal.ao', // conta de teste
  '244923968588@clientes.gotareal.ao', // registo de teste do cliente real
]
const REMOVE_COURIER_IDS = [] // preenchido abaixo pelo userId removido
const REMOVE_CUSTOMER_IDS = [] // preenchido abaixo

// identifica clientes cujo user será removido
for (const u of d.users) {
  if (REMOVE_USER_EMAILS.includes(u.email) && u.customerId) REMOVE_CUSTOMER_IDS.push(u.customerId)
}
// courier ligado a user removido
for (const u of d.users) {
  if (REMOVE_USER_EMAILS.includes(u.email)) {
    d.couriers.forEach((c) => { if (c.userId === u.id) REMOVE_COURIER_IDS.push(c.id) })
  }
}

// mantém APENAS clientes referenciados por contas que ficam
// (a conta demo cliente@gotareal.ao aponta para um deles)
const keptCustomerIds = new Set(
  d.users
    .filter((u) => !REMOVE_USER_EMAILS.includes(u.email) && u.customerId)
    .map((u) => u.customerId)
)
for (const c of d.customers) {
  if (!keptCustomerIds.has(c.id)) REMOVE_CUSTOMER_IDS.push(c.id)
}

const before = {
  users: d.users.length, customers: d.customers.length,
  couriers: d.couriers.length, products: d.products.length,
}

d.users = d.users.filter((u) => !REMOVE_USER_EMAILS.includes(u.email))
d.customers = d.customers.filter((c) => !REMOVE_CUSTOMER_IDS.includes(c.id))
d.couriers = d.couriers.filter((c) => !REMOVE_COURIER_IDS.includes(c.id))

fs.writeFileSync('prisma/seed-data.json', JSON.stringify(d, null, 2))
console.log(
  `antes: ${before.users}u/${before.customers}c/${before.couriers}k → ` +
  `depois: ${d.users.length}u/${d.customers.length}c/${d.couriers.length}k · ${d.products.length} produtos`
)
