const BASE = 'https://gota-real.vercel.app'

async function login(identifier, password) {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  })
  if (!r.ok) throw new Error(`login ${identifier}: ${r.status} ${await r.text()}`)
  const d = await r.json()
  return d
}

async function events(token, extra = '') {
  const r = await fetch(`${BASE}/api/events${extra}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const text = await r.text()
  try {
    const d = JSON.parse(text)
    return { status: r.status, scope: d.scope, orders: (d.orders ?? []).map(o => ({ n: o.number, st: o.status })), feedbacks: (d.feedbacks ?? []).map(f => ({ s: f.subject, st: f.status })) }
  } catch {
    return { status: r.status, body: text.slice(0, 300) }
  }
}

// MOTOBOY
const mb = await login('motoboy@gotareal.ao', 'motoboy123')
console.log('== MOTOBOY == user.courier:', JSON.stringify(mb.user?.courier ?? null))
console.log('events:', JSON.stringify(await events(mb.token), null, 1))

// ATENDENTE
const at = await login('atendente@gotareal.ao', 'atendente123')
console.log('== ATENDENTE == role:', at.user?.role)
console.log('events:', JSON.stringify(await events(at.token), null, 1))

// ADMIN (referência)
const ad = await login('admin@gotareal.ao', 'admin123')
console.log('== ADMIN == role:', ad.user?.role)
console.log('events:', JSON.stringify(await events(ad.token), null, 1))
