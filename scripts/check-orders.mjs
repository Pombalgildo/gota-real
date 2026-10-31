// Verifica encomendas na base de dados indicada por DB_CHECK_URL (prod Neon ou local SQLite)
// Uso: DB_CHECK_URL="postgresql://..." bun scripts/check-orders.mjs
const url = process.env.DB_CHECK_URL;

async function main() {
  if (!url) {
    console.error('Falta DB_CHECK_URL');
    process.exit(1);
  }
  const isPostgres = url.startsWith('postgresql');
  if (isPostgres) {
    const { Client } = await import('pg');
    const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
    await client.connect();
    const orders = await client.query(`
      SELECT o.id, o.number, o.status, o."totalKz" AS total, o."createdAt", o."updatedAt",
             c.name AS customer_name, c.phone AS customer_phone,
             (SELECT count(*) FROM "OrderItem" oi WHERE oi."orderId" = o.id) AS items
      FROM "Order" o
      LEFT JOIN "Customer" c ON c.id = o."customerId"
      ORDER BY o."createdAt" DESC
      LIMIT 25
    `);
    console.log('=== ÚLTIMAS ENCOMENDAS (prod) ===');
    for (const r of orders.rows) {
      console.log(`#${r.number} | ${r.status} | ${r.total} Kz | ${r.customer_name} (${r.customer_phone}) | itens:${r.items} | criada:${new Date(r.createdAt).toISOString()} | actualizada:${new Date(r.updatedAt).toISOString()}`);
    }
    const counts = await client.query(`
      SELECT o.status, count(*)::int AS n, max(o."createdAt") AS ultima
      FROM "Order" o GROUP BY o.status
    `);
    console.log('\n=== CONTAGEM POR ESTADO ===');
    for (const r of counts.rows) {
      console.log(`${r.status}: ${r.n} (última: ${r.ultima ? new Date(r.ultima).toISOString() : '-'})`);
    }
    const users = await client.query(`SELECT email, role, active, banned FROM "User" ORDER BY role`);
    console.log('\n=== UTILIZADORES ===');
    for (const r of users.rows) {
      console.log(`${r.email} | ${r.role} | active:${r.active} | banned:${r.banned}`);
    }
    const custs = await client.query(`SELECT name, phone, banned FROM "Customer" ORDER BY "createdAt" DESC LIMIT 10`);
    console.log('\n=== CLIENTES (últimos 10) ===');
    for (const r of custs.rows) {
      console.log(`${r.name} | ${r.phone} | banned:${r.banned}`);
    }
    await client.end();
  } else {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 25,
      include: { customer: true, _count: { select: { items: true } } },
    });
    console.log('=== ÚLTIMAS ENCOMENDAS (local) ===');
    for (const o of orders) {
      console.log(`#${o.number} | ${o.status} | ${o.totalKz} Kz | ${o.customer?.name} (${o.customer?.phone}) | itens:${o._count.items} | criada:${o.createdAt.toISOString()}`);
    }
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });
