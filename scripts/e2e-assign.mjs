const BASE = 'https://gota-real.vercel.app'
const ORDER_ID = process.argv[2]
const COURIER_ID = 'cmvrx1c1x000ao1y5xxxtcbvj' // João Motoboy

const r = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identifier: 'admin@gotareal.ao', password: 'admin123' }),
})
const admin = await r.json()

const res = await fetch(`${BASE}/api/orders/${ORDER_ID}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.token}` },
  body: JSON.stringify({ action: 'assign', courierId: COURIER_ID }),
})
const d = await res.json()
console.log('assign ->', res.status, JSON.stringify(d).slice(0, 200))
