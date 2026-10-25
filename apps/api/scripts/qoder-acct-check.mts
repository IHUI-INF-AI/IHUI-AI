import fs from 'node:fs'
import path from 'node:path'
const envPath = path.resolve('.env')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && process.env[m[1]] === undefined) {
      let v = m[2]
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      process.env[m[1]] = v
    }
  }
}
const { db } = await import('../src/db/index.js')
const { sql } = await import('drizzle-orm')
const mc = (await db.execute(sql`SELECT provider_code,model_id,is_enabled FROM ai_model_config WHERE provider_code='qoder' LIMIT 10`)) as unknown
const mcs = Array.isArray(mc) ? mc : (mc as { rows?: unknown[] }).rows ?? []
console.log('MODEL_CONFIG qoder:', JSON.stringify(mcs, null, 2))
// 启用态：relay provider 表
const rp = (await db.execute(sql`SELECT provider_code,is_enabled FROM ai_relay_providers WHERE provider_code='qoder' LIMIT 5`)) as unknown
const rps = Array.isArray(rp) ? rp : (rp as { rows?: unknown[] }).rows ?? []
console.log('RELAY_PROVIDERS qoder:', JSON.stringify(rps, null, 2))
// 号池是否有 qoder 的可调度账号
const cnt = (await db.execute(sql`SELECT provider_code,count(*) AS n FROM ai_relay_account_pool WHERE provider_code='qoder' AND is_enabled=true AND temp_unschedulable=false GROUP BY provider_code`)) as unknown
const cnts = Array.isArray(cnt) ? cnt : (cnt as { rows?: unknown[] }).rows ?? []
console.log('ACCOUNT_POOL qoder schedulable count:', JSON.stringify(cnts, null, 2))
process.exit(0)
