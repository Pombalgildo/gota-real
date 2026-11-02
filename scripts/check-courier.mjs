import pg from 'pg'
const url = 'postgresql://neondb_owner:npg_TFUJYg64NeLP@ep-dawn-sun-b5v51mj7-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require'
const c = new pg.Client({ connectionString: url })
await c.connect()
const users = await c.query(`
  SELECT u.id, u.email, u.role, u.active, cu.id AS courier_id, cu.name AS courier_name
  FROM "User" u LEFT JOIN "Courier" cu ON cu."userId" = u.id
  WHERE u.role IN ('MOTOBOY','MOTORISTA','ATENDENTE','ADMIN')
  ORDER BY u.role, u.email`)
console.table(users.rows)
const couriers = await c.query(`SELECT id, name, "userId", available FROM "Courier" ORDER BY name`)
console.table(couriers.rows)
await c.end()
