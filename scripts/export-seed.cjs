/**
 * Exporta os dados reais da base SQLite local para prisma/seed-data.json.
 * O seed na Vercel (Postgres) usa este ficheiro para criar a loja
 * exactamente como está agora: produtos com fotos, contas da equipa
 * (senhas já em hash scrypt) e configuração da loja.
 *
 * Pedidos, sessões e feedback NÃO são exportados — a produção começa limpa.
 */
const { writeFileSync } = require('node:fs')
const { execSync } = require('node:child_process')

// usa o esquema local (sqlite) para ler a base actual
execSync('npx prisma generate --schema prisma/schema.local.prisma', { stdio: 'inherit' })
const { PrismaClient } = require('@prisma/client')
const client = new PrismaClient()

async function main() {
  const [users, customers, couriers, products, store] = await Promise.all([
    client.user.findMany({
      // senhas já estão em hash (salt:hash) — seguras para transportar
      select: {
        id: true, name: true, email: true, phone: true, password: true,
        role: true, photo: true, active: true, banned: true, banReason: true,
        customerId: true, createdAt: true,
      },
    }),
    client.customer.findMany(),
    client.courier.findMany(),
    client.product.findMany(),
    client.storeConfig.findMany(),
  ])

  const data = {
    exportedAt: new Date().toISOString(),
    users,
    customers,
    couriers,
    products,
    store,
  }

  writeFileSync('prisma/seed-data.json', JSON.stringify(data, null, 2))
  console.log(
    `✅ exportado: ${users.length} utilizadores · ${customers.length} clientes · ` +
    `${couriers.length} motoboys · ${products.length} produtos · loja: ${store.length === 1 ? 'sim' : 'não'}`
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => client.$disconnect())
