// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 账号池导出 CLI(2026-11-10 立,与 scripts/relay-account-import.ts 反向配套)。
 *
 * 用途:把本机开发库的号池行按**各平台原生导入形状**导成 JSON,供生产库经
 * Web 导入端点(POST /admin/relay/accounts/import,强制落登录管理员个人池)原样重导,
 * 机主口径「号必须跟着账号走」—— 导出载荷的每一个键位都按 relay-account-format
 * 的槽位表 / mapXxxImport 的取值键逆向映射,不猜、不发明第二份键位。
 *
 * 判据复用(§0.6 单源,不抄第二份;纯逻辑内核在 relay-account-pool-service.ts,
 * 与导入侧 mapXxxImport 同文件互镜,零 DB 可单测):
 * - 解密:decryptAccountCredentials
 * - 逆向映射:buildExportPayload(库列 → 各平台原生导入载荷)
 * - 硬校验:validateExportRoundTrip(路由结构镜像闸门 + uid 复现 + 统一名复现)
 *   任一条不过 ⇒ 该行**拒出**并点名原因,绝不静默产出"导不回去"的载荷。
 *
 * ⚠️ 安全:导出 JSON 含**明文凭据**(token/refreshToken/cookies/secrets 逆向回填),
 * 只写 --out 目录(缺省 = OS 临时目录下 ihui-pool-export),**用毕即删**,
 * 严禁复制进仓库。stdout/stderr 只报平台、条数、uid、文件名,绝不回显任何凭据值。
 *
 * 用法:
 *   cd apps/api && pnpm exec tsx scripts/relay-account-export.ts
 *     [--provider <code>]   只导该平台(缺省导全池)
 *     [--out <dir>]         输出目录(缺省 <OS 临时目录>/ihui-pool-export)
 *   每平台一个文件: <out>/<providerCode>.json,形如 { "providerCode": "...", "accounts": [...] },
 *   与 importBodySchema(routes/admin/relay-account-pool.ts)直接兼容。
 *
 * 退出码:0 全部导出成功 / 1 有行被硬校验拒出 / 2 参数/读取/环境错误。
 */
import { config } from 'dotenv'
import { resolve as resolvePath, dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { RelayProviderCode } from '../src/services/relay-account-format.js'
import type { AiRelayAccountPool } from '@ihui/database'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const API_DIR = resolvePath(SCRIPT_DIR, '..')

// .env 必须早于任何服务模块导入(它们在建连时读环境);动态导入以保证顺序
config({ path: resolvePath(API_DIR, '.env') })

const { eq } = await import('drizzle-orm')
const { aiRelayAccountPool } = await import('@ihui/database')
const { isRelayProviderCode, RELAY_PROVIDERS } =
  await import('../src/services/relay-account-format.js')
const { decryptAccountCredentials, buildExportPayload, validateExportRoundTrip } =
  await import('../src/services/relay-account-pool-service.js')
const { dbRead, closeDbPools } = await import('../src/db/index.js')

const HELP = `账号池导出(按各平台原生导入形状逆向映射,供 Web 导入端点重导)

用法:
  pnpm exec tsx scripts/relay-account-export.ts [--provider <${RELAY_PROVIDERS.join('|')}>] [--out <dir>]

缺省输出目录 = <OS 临时目录>/ihui-pool-export;每平台一个 JSON 文件。
⚠️ 导出文件含明文凭据:用毕即删,严禁进仓。stdout 只报平台/条数/uid/文件名。
退出码:0 全部导出 / 1 有行被拒出 / 2 参数或环境错误。`

interface CliOptions {
  providerCode: RelayProviderCode | null
  outDir: string
}

function parseArgs(argv: string[]): {
  help: boolean
  options: CliOptions | null
  error: string | null
} {
  const options: CliOptions = {
    providerCode: null,
    outDir: join(tmpdir(), 'ihui-pool-export'),
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') return { help: true, options: null, error: null }
    else if (arg === '--provider') {
      const v = (argv[++i] ?? '').trim()
      if (!isRelayProviderCode(v)) {
        return {
          help: false,
          options: null,
          error: `不支持的平台: ${v}(可选 ${RELAY_PROVIDERS.join('|')})`,
        }
      }
      options.providerCode = v
    } else if (arg === '--out') {
      const v = (argv[++i] ?? '').trim()
      if (!v || v.startsWith('--'))
        return { help: false, options: null, error: '--out 需要目录路径' }
      options.outDir = resolvePath(v)
    } else {
      return { help: false, options: null, error: `未知参数: ${arg}` }
    }
  }
  return { help: false, options, error: null }
}

interface RejectedRow {
  providerCode: string
  uid: string
  reason: string
}

async function main(argv: string[]): Promise<number> {
  const parsed = parseArgs(argv)
  if (parsed.help) {
    process.stdout.write(`${HELP}\n`)
    return 0
  }
  if (parsed.error || !parsed.options) {
    process.stderr.write(`❌ ${parsed.error}\n\n${HELP}\n`)
    return 2
  }
  const opts = parsed.options

  let rows: AiRelayAccountPool[]
  try {
    rows = await dbRead
      .select()
      .from(aiRelayAccountPool)
      .where(opts.providerCode ? eq(aiRelayAccountPool.providerCode, opts.providerCode) : undefined)
      .orderBy(aiRelayAccountPool.providerCode, aiRelayAccountPool.uid)
  } catch (e) {
    process.stderr.write(`❌ 读库失败(未判定): ${e instanceof Error ? e.message : String(e)}\n`)
    return 2
  }

  const byProvider = new Map<RelayProviderCode, Record<string, unknown>[]>()
  const rejected: RejectedRow[] = []
  for (const row of rows) {
    const p = row.providerCode as RelayProviderCode
    let built: Record<string, unknown> | string
    try {
      built = buildExportPayload(row, decryptAccountCredentials(row))
    } catch (e) {
      built = `解密/构造异常: ${e instanceof Error ? e.message.slice(0, 120) : String(e)}`
    }
    if (typeof built === 'string') {
      rejected.push({ providerCode: p, uid: row.uid, reason: built })
      continue
    }
    const issue = validateExportRoundTrip(row, built)
    if (issue) {
      rejected.push({ providerCode: p, uid: row.uid, reason: issue })
      continue
    }
    const list = byProvider.get(p) ?? []
    list.push(built)
    byProvider.set(p, list)
  }

  mkdirSync(opts.outDir, { recursive: true })
  let exported = 0
  for (const [p, accounts] of byProvider) {
    const file = join(opts.outDir, `${p}.json`)
    writeFileSync(file, `${JSON.stringify({ providerCode: p, accounts }, null, 2)}\n`, 'utf8')
    const seen = new Set<string>()
    let dup = 0
    for (const acc of accounts) {
      const uid = String(acc['uid'] ?? '')
      if (seen.has(uid)) dup++
      else seen.add(uid)
    }
    process.stdout.write(
      `✅ ${p}: ${accounts.length} 枚 → ${file}` +
        (dup > 0 ? `(批内重复 uid ${dup} 枚,重导入时后到者按批内去重跳过)` : '') +
        '\n',
    )
    for (const acc of accounts) process.stdout.write(`   uid=${String(acc['uid'] ?? '')}\n`)
    exported += accounts.length
  }
  for (const r of rejected) {
    process.stderr.write(`❌ 拒出 ${r.providerCode} uid=${r.uid}:${r.reason}\n`)
  }
  process.stdout.write(
    `导出完成: 池行=${rows.length} 导出=${exported} 拒出=${rejected.length} 输出目录=${opts.outDir}\n` +
      `⚠️ 文件含明文凭据,用毕即删,严禁进仓。\n`,
  )
  return rejected.length > 0 ? 1 : 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  // 同 relay-account-import.ts:先关连接池再置 exitCode 让事件循环自然排空(Windows/libuv 断句柄崩溃)
  const finish = async (code: number) => {
    await closeDbPools()
    process.exitCode = code
  }
  main(process.argv.slice(2))
    .then(finish)
    .catch(async (e) => {
      process.stderr.write(`❌ ${e instanceof Error ? e.message : String(e)}\n`)
      await finish(2)
    })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
