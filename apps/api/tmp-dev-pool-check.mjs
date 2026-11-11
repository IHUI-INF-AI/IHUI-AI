import { config } from 'dotenv'
import { readFileSync } from 'node:fs'
import postgres from 'postgres'

config({ path: new URL('./.env', import.meta.url).pathname.slice(1) })
try {
  console.log('pool-owner file:', readFileSync('C:/Users/Administrator/.wb-switch/pool-owner', 'utf8').trim())
} catch (e) {
  console.log('pool-owner file: ABSENT (' + e.code + ')')
}
const sql = postgres(process.env.DATABASE_URL, { max: 1 })
const aid = '30763d9f-a4c4-4f0c-84c3-16d6b8a67c35'
const u = await sql`select id, email from users where id = ${aid}`
console.log('admin user:', JSON.stringify(u))
const mine = await sql`select provider_code, count(*)::int as n from ai_relay_account_pool where owner_user_id = ${aid} group by provider_code order by provider_code`
console.log('dev personal pool:', JSON.stringify(mine), 'total=', mine.reduce((a, r) => a + r.n, 0))
const ops = await sql`select count(*)::int as n from ai_relay_account_pool where owner_user_id is null`
console.log('dev ops pool rows:', ops[0].n)
const shared = await sql`select count(*)::int as n from ai_relay_account_pool where owner_user_id = ${aid} and shared_to_ops = true`
console.log('dev personal+shared rows:', shared[0].n)
const forever = await sql`select count(*)::int as n from ai_relay_account_pool where owner_user_id = ${aid} and extra_metadata->>'keepAliveForever'='true'`
console.log('dev keepAliveForever rows:', forever[0].n)
const uids = await sql`select provider_code, uid from ai_relay_account_pool where owner_user_id = ${aid} order by provider_code, uid`
console.log('dev uids:', JSON.stringify(uids.map((r) => r.provider_code + '|' + r.uid)))
await sql.end()
