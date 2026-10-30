/**
 * SEED DA PRODUÇÃO (PostgreSQL) — cria a loja inicial na Vercel.
 *
 * Corre automaticamente durante o build e é SEGURO re correr:
 * só cria registos quando a tabela correspondente está vazia —
 * nunca sobrescreve alterações feitas depois do lançamento
 * (preços, fotos, novos perfis, etc.).
 *
 * Opcional: SEED_DEMO=true repõe a conta demo do cliente se faltar.
 */
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()
const file = new URL('./seed-data.json', import.meta.url)
const data = JSON.parse(readFileSync(file, 'utf8'))

async function main() {
  // ---------- clientes ----------
  if ((await db.customer.count()) === 0 && data.customers.length > 0) {
    for (const c of data.customers) {
      await db.customer.create({
        data: {
          id: c.id,
          name: c.name,
          phone: c.phone,
          email: c.email,
          address: c.address,
          latitude: c.latitude,
          longitude: c.longitude,
          locationSource: c.locationSource,
          locationNote: c.locationNote,
          photo: c.photo,
          banned: c.banned,
          banReason: c.banReason,
          createdAt: c.createdAt,
        },
      })
    }
    console.log(`[seed] ${data.customers.length} cliente(s) criado(s)`)
  }

  // ---------- utilizadores (senhas já em hash scrypt) ----------
  if ((await db.user.count()) === 0 && data.users.length > 0) {
    for (const u of data.users) {
      await db.user.create({
        data: {
          id: u.id,
          name: u.name,
          email: u.email,
          phone: u.phone,
          password: u.password,
          role: u.role,
          photo: u.photo,
          active: u.active,
          banned: u.banned,
          banReason: u.banReason,
          customerId: u.customerId,
          createdAt: u.createdAt,
        },
      })
    }
    console.log(`[seed] ${data.users.length} utilizador(es) criado(s) (admin, motoboy, cliente demo)`)
  }

  // ---------- contas demo da equipa por perfil ----------
  // Cria cada conta se ainda não existir NENHUM utilizador com aquele perfil
  // (idempotente: nunca sobrescreve, e se o administrador criar os seus
  // próprios perfis os demos não voltam a aparecer).
  const DEMO_BY_ROLE = ['ADMIN', 'MOTOBOY', 'ATENDENTE', 'EDITOR', 'MOTORISTA']
  for (const role of DEMO_BY_ROLE) {
    const demo = data.users.find((u) => u.role === role)
    if (!demo) continue
    const hasRole = await db.user.findFirst({ where: { role } })
    if (hasRole) continue
    const emailTaken = await db.user.findUnique({ where: { email: demo.email } })
    if (emailTaken) continue
    const created = await db.user.create({
      data: {
        name: demo.name,
        email: demo.email,
        phone: demo.phone,
        password: demo.password,
        role,
        active: true,
      },
    })
    // perfil de entrega sem entregador ligado → cria o veículo e liga
    if (role === 'MOTOBOY' || role === 'MOTORISTA') {
      const courier = await db.courier.create({
        data: {
          name: demo.name,
          phone: demo.phone || '—',
          vehicle: role === 'MOTORISTA' ? 'Carro ligeiro' : 'Mota',
          plate: '—',
          latitude: -8.847,
          longitude: 13.241,
          available: true,
          userId: created.id,
        },
      })
      console.log(`[seed] demo ${role}: ${demo.email} + veículo criados`)
      void courier
    } else {
      console.log(`[seed] demo ${role}: ${demo.email} criado`)
    }
  }

  // ---------- motoboys ----------
  if ((await db.courier.count()) === 0 && data.couriers.length > 0) {
    for (const c of data.couriers) {
      await db.courier.create({
        data: {
          id: c.id,
          name: c.name,
          phone: c.phone,
          vehicle: c.vehicle,
          plate: c.plate,
          available: c.available,
          userId: c.userId,
          createdAt: c.createdAt,
        },
      })
    }
    console.log(`[seed] ${data.couriers.length} motoboy(s) criado(s)`)
  }

  // ---------- produtos (com fotos reais) ----------
  if ((await db.product.count()) === 0 && data.products.length > 0) {
    for (const p of data.products) {
      await db.product.create({
        data: {
          id: p.id,
          name: p.name,
          description: p.description,
          category: p.category,
          kind: p.kind,
          volumeL: p.volumeL,
          priceKz: p.priceKz,
          unitLabel: p.unitLabel,
          stock: p.stock,
          active: p.active,
          sortOrder: p.sortOrder,
          image: p.image,
          createdAt: p.createdAt,
        },
      })
    }
    console.log(`[seed] ${data.products.length} produto(s) criado(s)`)
  }

  // ---------- configuração da loja ----------
  if ((await db.storeConfig.count()) === 0 && data.store.length > 0) {
    const s = data.store[0]
    await db.storeConfig.create({
      data: {
        id: 'main',
        name: s.name,
        tagline: s.tagline,
        phone: s.phone,
        whatsapp: s.whatsapp,
        address: s.address,
        hours: s.hours,
        deliveryFeeKz: s.deliveryFeeKz,
        minOrderKz: s.minOrderKz,
        note: s.note,
      },
    })
    console.log('[seed] configuração da loja criada')
  }

  const [u, c, k, p] = await Promise.all([
    db.user.count(),
    db.customer.count(),
    db.courier.count(),
    db.product.count(),
  ])
  console.log(`[seed] estado final: ${u} utilizadores · ${c} clientes · ${k} entregadores · ${p} produtos`)
}

main()
  .catch((e) => {
    console.error('[seed] erro:', e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
