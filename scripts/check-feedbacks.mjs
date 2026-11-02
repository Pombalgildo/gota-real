import pg from 'pg'
const c = new pg.Client({ connectionString: 'postgresql://neondb_owner:npg_TFUJYg64NeLP@ep-dawn-sun-b5v51mj7-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require' })
await c.connect()
const r = await c.query(`SELECT status, count(*)::int AS n FROM "Feedback" GROUP BY status`)
console.table(r.rows)
const abertos = await c.query(`SELECT id, subject, status, "createdAt" FROM "Feedback" WHERE status='aberto' ORDER BY "createdAt" DESC LIMIT 10`)
console.table(abertos.rows.map(f => ({ ...f, createdAt: f.createdAt.toISOString().slice(0, 16) })))
await c.end()
