// 一次性:开发库号池与生产对齐(共享位 23 枚 + 保活位补全)。用完即删。
import { config } from 'dotenv'
import postgres from 'postgres'

config({ path: new URL('./.env', import.meta.url).pathname.slice(1) })
const sql = postgres(process.env.DATABASE_URL, { max: 1 })
const aid = '30763d9f-a4c4-4f0c-84c3-16d6b8a67c35'

const sharedPairs = [
  ['codearts', 'bb1438ff2b5d4ba8b1a6b58f6e35c1bb'],
  ['doubao', 'auto:4c0bccd78c093e508c2132c764d9f388'],
  ['doubao', 'auto:8bfb7adf603ecf41014171637b9cc900'],
  ['loomy', '261023222726664932'],
  ['loomy', 'auto:f676131e10f31f9446aec3076d6ee503'],
  ['minimax', 'auto:1b079a5210887ce375733e5789b3295d'],
  ['minimax', 'auto:6618fcad5ed6e4800b670394f93349cd'],
  ['opencode', 'auto:d9fbe94af970c4e51aabdf17a3d50e28'],
  ['qoder', '019f17c6-0eca-7510-a4f5-5b22e8305ed4'],
  ['qoder', '019f1c4d-4a1b-786e-a01f-c9810ad77453'],
  ['qoder', '019f47e7-feab-7bba-bcde-f206d32e4407'],
  ['qoder', '019f4a1e-f33c-70e3-97db-0d29aca140e7'],
  ['qoder', '019f4f30-87a8-7dfc-8c05-1d7723dae81d'],
  ['qoder', '01a0c9c8-b0ad-71a4-80d0-eff79f881407'],
  ['qoder', '01a191f4-8dc3-75db-831b-4ef5c2dedd4a'],
  ['trae', '146677888728619'],
  ['trae', '2187400009507360'],
  ['trae', '340221726063980'],
  ['trae', '815164347664028'],
  ['workbuddy', '3cde9010-5502-4020-8102-1ebc70b09b74'],
  ['workbuddy', 'ab65cefd-4b18-49f0-a6e6-e7f33be7b82e'],
  ['zcode', '83881793407924603'],
  ['zcode', 'auto:bc880bce1bf4c0e07b9a2431d47851ba'],
]

await sql.begin(async (tx) => {
  // 23 枚共享位:仅个人池行
  for (const [p, u] of sharedPairs) {
    await tx`update ai_relay_account_pool set shared_to_ops = true, updated_at = now()
              where provider_code = ${p} and uid = ${u} and owner_user_id = ${aid}`
  }
  // 全部个人池行补永久保活位(与机主口径一致)
  await tx`update ai_relay_account_pool
           set extra_metadata = jsonb_set(coalesce(extra_metadata, '{}'::jsonb), '{keepAliveForever}', 'true'::jsonb),
               updated_at = now()
           where owner_user_id = ${aid} and coalesce(extra_metadata->>'keepAliveForever', 'false') <> 'true'`
})

const totals = await sql`select count(*)::int as total,
  count(*) filter (where shared_to_ops)::int as shared,
  count(*) filter (where extra_metadata->>'keepAliveForever'='true')::int as forever,
  count(*) filter (where owner_user_id is null)::int as ops
  from ai_relay_account_pool`
console.log('DEV AFTER ALIGN:', JSON.stringify(totals[0]))
const missing = await sql`select provider_code, uid from ai_relay_account_pool
  where owner_user_id = ${aid} and (provider_code, uid) in ${sql(sharedPairs.map(([p, u]) => sql`(${p},${u})`))}
    and shared_to_ops = false`
console.log('shared not applied:', JSON.stringify(missing))
await sql.end()
