// Diagnóstico rápido: estado dos clientes na BD local
const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  const target = await p.customer.findUnique({
    where: { id: 'cmwi07hip000rtwxrze2y6qwk' },
    select: {
      name: true,
      phone: true,
      status: true,
      rejectReason: true,
      photo: true,
      createdAt: true,
    },
  })
  console.log('CLIENTE DA SESSÃO ACTIVA:', JSON.stringify(target, null, 1)?.slice(0, 500))

  const all = await p.customer.findMany({
    select: { name: true, status: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 8,
  })
  console.log('\nÚLTIMOS CLIENTES:')
  for (const c of all) console.log(` - ${c.name} | ${c.status} | ${c.createdAt?.toISOString()}`)
}

main()
  .catch((e) => console.error(e))
  .finally(() => p.$disconnect())
