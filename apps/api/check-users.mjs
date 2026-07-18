import postgres from 'postgres'
const url = process.env.DATABASE_URL ?? 'postgresql://ihui:ihui_dev_d6412937d5e397bc@127.0.0.1:5432/ihui'
const sql = postgres(url, { max: 1, onnotice: () => {} })
const r = await sql`SELECT id, username, email, phone, role_id, is_system_admin, status FROM users WHERE email = '502319984@qq.com' OR email = 'admin@ihui.ai' OR username = 'admin' ORDER BY id`
console.log(r)
await sql.end({ timeout: 1 })
