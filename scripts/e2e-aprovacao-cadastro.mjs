#!/usr/bin/env node
/**
 * E2E — APROVAÇÃO DE CADASTRO DE CLIENTES (anti-malfeitor)
 *
 * Fluxo exigido pelo cliente:
 *   1. Cadastro novo (com FOTO) entra "pendente" — não fica activo na hora
 *   2. Cliente pendente NÃO faz pedidos nem envia mensagens (403)
 *   3. Admin vê o cadastro pendente na lista de perfis e nos eventos
 *   4. Recusa exige MENSAGEM (mínimo 5 caracteres) — sem ela → 400
 *   5. Recusado: cliente vê o motivo (rejectReason) e continua bloqueado
 *   6. Aprovação ACTIVA o cliente → pedido passa (201)
 *   7. Apenas o ADMINISTRADOR PRINCIPAL decide (outro ADMIN → 403)
 *   8. Reversão: recusado pode voltar a aprovado ("Aprovar agora")
 *
 * Uso: node scripts/e2e-aprovacao-cadastro.mjs [base-url]
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

// fotografia mínima válida (data URL base64 — pixel vermelho 1x1 JPEG)
const FOTO = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AmAA//9k='

const PHONE = '923 777 123'
const PASS = 'teste123'

async function main() {
  console.log(`\n🧪 E2E aprovação de cadastro contra ${BASE}\n`)

  // ---------- entrada do administrador principal ----------
  const admin = (await api('/api/auth/login', { method: 'POST', body: { identifier: 'admin@gotareal.ao', password: 'admin123' } })).data
  check('login do administrador principal', Boolean(admin?.token))
  const adminToken = admin?.token

  const products = (await api('/api/products')).data.products ?? []
  const product = products.find((p) => p.stock > 0)
  check('produto com stock', Boolean(product), product?.name)

  // ---------- 1. cadastro novo entra PENDENTE (com foto) ----------
  const reg = await api('/api/customers', {
    method: 'POST',
    body: {
      name: 'Teste Aprovação Silva',
      phone: PHONE,
      password: PASS,
      address: 'Rua do Teste, Luanda',
      latitude: -8.81,
      longitude: 13.23,
      locationSource: 'exata',
      photo: FOTO,
    },
  })
  check('registo devolve sessão + cliente', Boolean(reg.data?.token && reg.data?.customer))
  check('cadastro NOVO fica PENDENTE', reg.data?.customer?.status === 'pendente', `status=${reg.data?.customer?.status}`)
  check('aviso de pendência na resposta', reg.data?.pendingApproval === true)
  check('FOTO guardada no cadastro', typeof reg.data?.customer?.photo === 'string' && reg.data.customer.photo.startsWith('data:image/'))
  const customer = reg.data?.customer
  const customerToken = reg.data?.token

  // ---------- 2. pendente não pede nem envia mensagens ----------
  const orderPendente = await api('/api/orders', {
    method: 'POST',
    token: customerToken,
    body: {
      customerId: customer.id,
      items: [{ productId: product.id, quantity: 1 }],
      paymentMethod: 'CASH',
    },
  })
  check('pedido de cliente PENDENTE bloqueado (403)', orderPendente.status === 403, orderPendente.data?.error?.slice(0, 60))

  const msgPendente = await api('/api/feedback', {
    method: 'POST',
    token: customerToken,
    body: { customerId: customer.id, type: 'sugestao', subject: 'olá', message: 'mensagem de teste' },
  })
  check('mensagem de cliente PENDENTE bloqueada (403)', msgPendente.status === 403)

  // login continua a funcionar (o cliente vê o ecrã de aguardo)
  const loginPendente = await api('/api/auth/login', { method: 'POST', body: { identifier: PHONE, password: PASS } })
  check('cliente pendente consegue ENTRAR (vê o ecrã de aguardo)', loginPendente.status === 200 && loginPendente.data?.customer?.status === 'pendente')

  // ---------- 3. admin vê o pendente na lista e nos eventos ----------
  const users = (await api('/api/users', { token: adminToken })).data.users ?? []
  const pendenteRow = users.find((u) => u.role === 'CLIENTE' && u.customer?.id === customer.id)
  check('pendente visível na lista de perfis', Boolean(pendenteRow))
  check('lista devolve status do cadastro', pendenteRow?.customer?.status === 'pendente')

  const events = (await api('/api/events', { token: adminToken })).data
  const signupEvento = (events?.signups ?? []).find((s) => s.id === customer.id)
  check('pendente no feed de eventos (alarme do admin)', Boolean(signupEvento), `${events?.signups?.length ?? 0} signup(s)`)

  // o perfil de USER ligado ao cadastro (para aprovar via users/[id])
  const userRow = pendenteRow

  // ---------- 4. recusa exige mensagem ----------
  const recusaSemMsg = await api(`/api/users/${userRow.id}`, {
    method: 'PATCH',
    token: adminToken,
    body: { approval: 'rejeitado' },
  })
  check('recusa SEM mensagem → 400', recusaSemMsg.status === 400, recusaSemMsg.data?.error?.slice(0, 60))

  // ---------- 5. recusa com mensagem ----------
  const MOTIVO = 'Não conseguimos confirmar os seus dados. Contacte-nos pelo WhatsApp.'
  const recusa = await api(`/api/users/${userRow.id}`, {
    method: 'PATCH',
    token: adminToken,
    body: { approval: 'rejeitado', rejectReason: MOTIVO },
  })
  check('recusa com mensagem registada', recusa.status === 200 && recusa.data?.customer?.status === 'rejeitado')
  check('mensagem da recusa guardada', recusa.data?.customer?.rejectReason === MOTIVO)

  const orderRecusado = await api('/api/orders', {
    method: 'POST',
    token: customerToken,
    body: {
      customerId: customer.id,
      items: [{ productId: product.id, quantity: 1 }],
      paymentMethod: 'CASH',
    },
  })
  check('pedido de cliente RECUSADO bloqueado (403)', orderRecusado.status === 403 && /não foi aceite/i.test(orderRecusado.data?.error ?? ''))

  // o perfil do cliente mostra a mensagem (ecrã de recusa)
  const perfilRecusado = await api(`/api/customers/${customer.id}`, { token: customerToken })
  check('cliente vê o MOTIVO da recusa no perfil', perfilRecusado.data?.customer?.rejectReason === MOTIVO)

  // ---------- 7. apenas o administrador principal decide ----------
  const outroAdmin = await api('/api/users', {
    method: 'POST',
    token: adminToken,
    body: {
      name: 'Admin Secundário Teste',
      email: 'admin-secundario-teste@gotareal.ao',
      password: 'senha123',
      role: 'ADMIN',
    },
  })
  check('criação de outro ADMIN (para o teste)', outroAdmin.status === 200, outroAdmin.data?.error ?? '')

  const loginSec = await api('/api/auth/login', { method: 'POST', body: { identifier: 'admin-secundario-teste@gotareal.ao', password: 'senha123' } })
  const secToken = loginSec.data?.token

  const decisaoSec = await api(`/api/users/${userRow.id}`, {
    method: 'PATCH',
    token: secToken,
    body: { approval: 'aprovado' },
  })
  check('outro ADMIN não decide → 403', decisaoSec.status === 403, decisaoSec.data?.error?.slice(0, 70))

  // ---------- 8. aprovação (e reversão da recusa) ----------
  const aprovacao = await api(`/api/users/${userRow.id}`, {
    method: 'PATCH',
    token: adminToken,
    body: { approval: 'aprovado' },
  })
  check('administrador principal APROVA o cadastro', aprovacao.status === 200 && aprovacao.data?.customer?.status === 'aprovado')
  check('motivo da recusa limpo após aprovação', !aprovacao.data?.customer?.rejectReason)

  const orderAprovado = await api('/api/orders', {
    method: 'POST',
    token: customerToken,
    body: {
      customerId: customer.id,
      items: [{ productId: product.id, quantity: 1 }],
      paymentMethod: 'CASH',
    },
  })
  check('pedido de cliente APROVADO aceite (201)', orderAprovado.status === 201 || orderAprovado.status === 200, `status=${orderAprovado.status}`)

  const msgAprovado = await api('/api/feedback', {
    method: 'POST',
    token: customerToken,
    body: { customerId: customer.id, type: 'sugestao', subject: 'teste', message: 'mensagem após aprovação' },
  })
  check('mensagem de cliente APROVADO aceite', msgAprovado.status === 200 || msgAprovado.status === 201)

  // ---------- limpeza ----------
  const delCliente = await api(`/api/users/${userRow.id}`, { method: 'DELETE', token: adminToken })
  check('limpeza: perfil de teste eliminado', delCliente.status === 200)
  const delSec = await api(`/api/users/${outroAdmin.data?.user?.id ?? ''}`, { method: 'DELETE', token: adminToken })
  check('limpeza: admin secundário eliminado', delSec.status === 200)

  // ---------- resumo ----------
  const failed = results.filter((r) => !r.ok)
  console.log(`\n${failed.length === 0 ? '🎉 TODOS OS TESTES PASSARAM' : '⚠️ FALHAS: ' + failed.length}/${results.length}\n`)
  process.exit(failed.length === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('💥 erro fatal:', err)
  process.exit(1)
})
