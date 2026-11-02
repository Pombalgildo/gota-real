import pg from 'pg'
const c = new pg.Client({ connectionString: 'postgresql://neondb_owner:npg_TFUJYg64NeLP@ep-dawn-sun-b5v51mj7-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require' })
await c.connect()
const r = await c.query(`SELECT id, number, status, "courierId", "requestedAt" FROM "Order" ORDER BY "requestedAt" DESC LIMIT 3`)
console.table(r.rows.map(o => ({ ...o, requestedAt: o.requestedAt.toISOString() })))
await c.end()
