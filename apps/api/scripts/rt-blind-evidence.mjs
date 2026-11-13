import 'dotenv/config'
import { sql } from 'drizzle-orm'
import { dbRead } from '../src/db/index.js'

// 只读取证:rt 盲点账号按 provider 分组,判断「读不到 rt 终点」是固有还是采集腿没跑到
const q = await dbRead.execute(sql`
  select provider_code,
    count(*)::int as rt_blind,
    count(*) filter (where (coalesce(extra_metadata,'{}'::jsonb)->>'keepAliveForever')='true')::int as forever,
    count(*) filter (where token_expires_at is not null)::int as has_token_expiry,
    count(*) filter (where last_refresh_at is not null)::int as ever_refreshed
  from ai_relay_account_pool
  where refresh_token_enc is not null and refresh_expires_at is null
  group by provider_code order by rt_blind desc`)

console.log('provider | rt盲点 | 永久保活 | 有token终点 | 曾刷新过')
for (const r of q.rows) {
  console.log(
    String(r.provider_code).padEnd(10),
    String(r.rt_blind).padStart(4),
    String(r.forever).padStart(8),
    String(r.has_token_expiry).padStart(10),
    String(r.ever_refreshed).padStart(8),
  )
}
process.exit(0)
