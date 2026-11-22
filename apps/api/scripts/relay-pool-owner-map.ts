// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池归属 id→email 对照表(2026-11-12 立,只读,供跨环境同步的 email 身份键翻译)。
 *
 * 立因:两端 users.id 是各自库生成的 UUID(同一 admin 本地/生产 id 不同、email 相同),
 * 同步把源端 owner_user_id 原样透传 ⇒ 目标端悬空归属 + 同步键两端不同反复互推。
 * 编排器(scripts/relay-account-pool-sync.mjs / scripts/relay-account-pool.mjs)在两端各跑
 * 一次本脚本,得到 `<users.id> → <email>` 映射,把归属身份统一到 email、落库时再翻译回
 * 目标环境的 users.id。
 *
 * 输出:`{"<users.id>":"<email>", ...}` —— 只覆盖**池内出现过的** owner 且该用户在库里有 email;
 * 用 `__POOL_EXPORT_BEGIN__ / __POOL_EXPORT_END__` 边界标记包裹(与 --export-all 同规,
 * 隔离 dotenv/[db] 诊断对 stdout 的污染)。不输出任何凭据。
 *
 * DB-35(2026-11-16 迁移 20261116174441)后 users.email 列存 enc:v1: 密文(随机 IV),而本脚本
 * 立于 11-12、当时 email 是明文 ⇒ 早期直接读 u.email 会把密文当身份键导出。跨环境同步用它
 * 做 email 身份键比对(两端 users.id 不同、email 相同),一端密文一端明文必然翻译不出 ⇒
 * 同步器 owner 翻译全跳过(2026-11-21 实证)。读路径必须经 decryptCredential 解密:
 * 密文还原明文、存量明文原样透传(同函数兼容语义),两端因此都拿到明文 email、身份键才可比对。
 */
import { config } from 'dotenv'
import { resolve as resolvePath, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const API_DIR = resolvePath(SCRIPT_DIR, '..')

config({ path: resolvePath(API_DIR, '.env') })

const { sql } = await import('drizzle-orm')
const { dbRead, closeDbPools } = await import('../src/db/index.js')
// DB-35:email 列可能是 enc:v1: 密文;decryptCredential 密文解密、存量明文原样透传(读路径单源同 admin-queries)。
const { decryptCredential } = await import('../src/utils/crypto.js')

function toRows(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw as Record<string, unknown>[]
  if (raw && typeof raw === 'object' && Array.isArray((raw as { rows?: unknown }).rows)) {
    return (raw as { rows: Record<string, unknown>[] }).rows
  }
  return []
}

async function main(): Promise<number> {
  // join 口径:users.id 是 uuid 列、pool.owner_user_id 是 varchar(64) ⇒ u.id::text = owner_user_id
  const raw = await dbRead.execute(sql`
    SELECT DISTINCT p.owner_user_id AS owner_id, u.email AS email
    FROM ai_relay_account_pool p
    JOIN users u ON u.id::text = p.owner_user_id
    WHERE p.owner_user_id IS NOT NULL AND u.email IS NOT NULL
  `)
  const map: Record<string, string> = {}
  for (const r of toRows(raw)) {
    const id = String(r.owner_id ?? '').trim()
    const emailRaw = String(r.email ?? '').trim()
    if (!id || !emailRaw) continue
    // DB-35:解密为明文身份键(密文还原 / 存量明文原样);解密失败 fail-closed 抛错,绝不把密文当身份键导出。
    const email = decryptCredential(emailRaw)
    if (email) map[id] = email
  }
  process.stdout.write(`__POOL_EXPORT_BEGIN__\n${JSON.stringify(map)}\n__POOL_EXPORT_END__\n`)
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
    .then(async (code) => {
      await closeDbPools()
      process.exitCode = code
    })
    .catch(async (e) => {
      process.stderr.write(`❌ ${e instanceof Error ? e.message : String(e)}\n`)
      await closeDbPools()
      process.exitCode = 2
    })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
