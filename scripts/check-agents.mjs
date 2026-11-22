// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 依赖解析:根 `scripts/` 不在 `apps/api` 的依赖解析链上(pnpm 隔离),
 * 原来两行裸 import('dotenv/config' / 'postgres')在本仓**启动即** ERR_MODULE_NOT_FOUND
 * —— 2026-09-24 实测:两包在根 node_modules 均不可解析。于是这份 agents 表列诊断
 * 长期"存在但一跑就崩",而它的 13 例镜像测试全是源码正则断言,持续假绿把这件事盖住。
 * 现按 apps/api 的依赖根解析;环境变量不再拉 dotenv,改为手读 .env
 * (同款先例:scripts/fetch-wechat-platform-cert.mjs:51)。
 */
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const requireFromApi = createRequire(join(ROOT, 'apps/api/package.json'))
let postgres
try {
  const mod = requireFromApi('postgres')
  postgres = mod.default ?? mod
} catch (e) {
  console.error(`❌ 无法从 apps/api 解析 postgres(${e.message});请跑一次全量 pnpm install(AGENTS §12e,禁用 --filter)`)
  process.exit(1)
}

// DATABASE_URL 只认进程环境变量:不再从 .env 旁路读取、也不内置明文兜底 DSN
// (BUG-98:三处 postgres:postgres 明文兜底同源缺陷 + .env 旁路)。缺失即 fail-closed 退出。
const url = process.env.DATABASE_URL
if (!url) {
  console.error('[FATAL] DATABASE_URL 未设置(拒绝使用内置默认连接串)')
  process.exit(2)
}
const sql = postgres(url, { max: 1 })
try {
  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'agents' AND column_name IN ('collect_count', 'publish_status', 'suggested_questions')
    ORDER BY column_name
  `
  console.log('agents table new columns:', cols.map(c => c.column_name))
  const tables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_name IN ('zhs_agent_thumbs', 'zhs_agent_collect', 'zhs_agent_useDetail')
    ORDER BY table_name
  `
  console.log('agent interaction tables:', tables.map(t => t.table_name))
} catch (e) {
  console.error('error:', e.message)
} finally {
  await sql.end({ timeout: 5 })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
