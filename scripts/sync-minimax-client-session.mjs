// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * MiniMax Code(mcode)客户端会话定期回灌(2026-10-31 立)—— 第四条客户端会话回灌腿的取数端。
 *
 * 链路:本机 mcode 登录态(scripts/lib/minimax-auth-extract.mjs,明文 auth.json)→ stdin JSON →
 * apps/api/scripts/relay-minimax-session-sync.ts(tsx,判据 + 只写凭证列 + 证据上恢复健康态)。
 * 由 apps/api/src/workers/relay-account-pool-worker.ts 的 `minimax-session-sync` 定时任务
 * 每 10 分钟派发;也可人工跑:
 *
 *   node scripts/sync-minimax-client-session.mjs [--dry-run] [--json]
 *
 * 为什么需要它:mcode 会轮换 accessToken/refreshToken,池里那枚票是导入时的快照;而
 * minimax 适配器刻意不实现 refreshToken(刷新端点无公开文档)⇒ 不回灌就永久 down。
 *
 * 身份:mcode 记录没有 uid 字段,池内 uid 是导入期按 `recordKey+token` 哈希出来的(随票旋转
 * 而变)⇒ 本文件只把 recordKey 随载荷带上,由 ts 侧按 recordKey 找行;规则一份都不在这里写
 * (§0.6 判据单源)。退出码:0 全部处理完(含 skip)/ 1 落库失败 / 2 未判定
 * (本机无 mcode 会话 / 会话文件解析失败 / tsx 缺失)。
 *
 * 安全:令牌只在两个进程的管道里流动,任何输出都不含凭据明文(只报 recordKey 尾、区域、到期)。
 */
import { resolveTsxCli } from './lib/tsx-cli.mjs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const API_DIR = path.join(ROOT, 'apps', 'api')
const SYNC_TS = path.join(API_DIR, 'scripts', 'relay-minimax-session-sync.ts')
const EXTRACTOR = path.join(ROOT, 'scripts', 'lib', 'minimax-auth-extract.mjs')

export function parseArgs(argv) {
  const options = { dryRun: false, json: false, help: false, error: null }
  for (const a of argv) {
    if (a === '--dry-run') options.dryRun = true
    else if (a === '--json') options.json = true
    else if (a === '--help' || a === '-h') options.help = true
    else if (a === '--')
      continue // pnpm 透传的裸分隔符,不是参数
    else options.error = `未知参数: ${a}`
  }
  return options
}

const str = (v) => (typeof v === 'string' ? v.trim() : '')

/** 记录键的人读短名(leveldb 键分隔符后的账号哈希尾 8 位;非凭据) */
export function recordKeyLabel(recordKey) {
  const key = str(recordKey)
  if (!key) return '(无 recordKey)'
  const tail = key.split('\u0000').pop() ?? key
  return `rk:…${tail.slice(-8)}`
}

/**
 * 提取结果 → 同步脚本的 stdin 载荷(纯函数,测试锁形状)。
 * 只搬「凭据 + 身份 + 溯源」三族键:记录原样明文直通会把无关键一路带进 extraMetadata,
 * 而本腿只需要能落 token 面与认出是哪枚号。expiresAt 由 expiresAtMs 折成 ISO(ts 侧首选它)。
 */
export function buildPayload(extracted) {
  const accounts = (Array.isArray(extracted?.accounts) ? extracted.accounts : [])
    .map((a) => {
      const accessToken = str(a?.accessToken)
      if (!accessToken) return null
      const refreshToken = str(a?.refreshToken)
      const expiresAtMs =
        typeof a?.expiresAtMs === 'number' && Number.isFinite(a.expiresAtMs) ? a.expiresAtMs : null
      const expiresAt = expiresAtMs === null ? '' : new Date(expiresAtMs).toISOString()
      const region = str(a?.region)
      const recordKey = str(a?.recordKey)
      const clientId = str(a?.clientId)
      const audience = str(a?.audience)
      const tokenType = str(a?.tokenType)
      const loginEpoch = str(a?.loginEpoch)
      const sourcePath = str(a?.sourcePath)
      const scopes = Array.isArray(a?.scopes)
        ? a.scopes.filter((s) => typeof s === 'string' && s !== '')
        : []
      return {
        accessToken,
        ...(refreshToken ? { refreshToken } : {}),
        ...(expiresAtMs === null ? {} : { expiresAtMs, expiresAt }),
        ...(region ? { region } : {}),
        ...(recordKey ? { recordKey } : {}),
        ...(clientId ? { clientId } : {}),
        ...(audience ? { audience } : {}),
        ...(tokenType ? { tokenType } : {}),
        ...(loginEpoch ? { loginEpoch } : {}),
        ...(sourcePath ? { sourcePath } : {}),
        ...(scopes.length > 0 ? { scopes } : {}),
      }
    })
    .filter(Boolean)
  const meta = extracted?.meta ?? {}
  return {
    providerCode: 'minimax',
    accounts,
    meta: {
      count: accounts.length,
      skipped: typeof meta.skipped === 'number' ? meta.skipped : 0,
      roots: Array.isArray(meta.roots) ? meta.roots.map((r) => str(r?.root)).filter(Boolean) : [],
    },
  }
}

function runSyncTs(payloadText, dryRun) {
  const tsx = resolveTsxCli(ROOT)
  if (!tsx) {
    return Promise.resolve({
      code: 2,
      json: null,
      error: '未找到 tsx(apps/api/node_modules/tsx);先在仓根 pnpm install',
    })
  }
  const args = [tsx, SYNC_TS, '--stdin', '--json']
  if (dryRun) args.push('--dry-run')
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: API_DIR,
      windowsHide: true,
      // 带输入必须三段全接管(AGENTS §12g)
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => child.kill(), 120_000)
    child.stdout.on('data', (d) => (stdout += d))
    child.stderr.on('data', (d) => (stderr += d))
    child.on('error', (e) => {
      clearTimeout(timer)
      resolve({ code: 2, json: null, error: e.message })
    })
    child.on('exit', (code, signal) => {
      clearTimeout(timer)
      // stdout 可能混有 db 连接等噪音行 ⇒ 逐行找可解析的 JSON 汇总
      let json = null
      for (const line of stdout.split(/\r?\n/)) {
        const t = line.trim()
        if (!t.startsWith('{')) continue
        try {
          json = JSON.parse(t)
        } catch {
          /* 不是汇总行,继续找 */
        }
      }
      resolve({
        code: signal ? 2 : (code ?? 2),
        json,
        error: json
          ? null
          : (stderr || `退出码 ${code ?? '?'}${signal ? ` 信号 ${signal}` : ''}`).slice(0, 300),
      })
    })
    child.stdin.write(payloadText)
    child.stdin.end()
  })
}

async function main(argv) {
  const parsed = parseArgs(argv)
  if (parsed.error) {
    process.stderr.write(`❌ ${parsed.error}\n`)
    return 2
  }
  if (parsed.help) {
    process.stdout.write(
      '用法: node scripts/sync-minimax-client-session.mjs [--dry-run] [--json]\n' +
        '读取本机 MiniMax Code(mcode)登录态并回灌号池(客户端为主策略的取数端;' +
        '判据在 apps/api/scripts/relay-minimax-session-sync.ts)。\n',
    )
    return 0
  }

  const { extractMinimaxAccounts } = await import(pathToFileURL(EXTRACTOR).href)
  let extracted
  try {
    extracted = await extractMinimaxAccounts()
  } catch (e) {
    process.stderr.write(
      `❌ 提取失败(未判定): [${e?.code ?? 'extract-failed'}] ${e instanceof Error ? e.message : String(e)}\n`,
    )
    return 2
  }

  const payload = buildPayload(extracted)
  // 指纹按 recordKey 取(不按数组下标 —— 丢弃过记录时下标会错位,报出别人的指纹比不报更坏)
  const fingerprintByKey = new Map(
    (Array.isArray(extracted?.meta?.sessions) ? extracted.meta.sessions : []).map((s) => [
      str(s?.recordKey),
      str(s?.tokenFingerprint),
    ]),
  )
  const lines = payload.accounts.map(
    (a) =>
      `${recordKeyLabel(a.recordKey)} 区域=${a.region ?? '-'} 到期=${a.expiresAt ?? '-'} ` +
      `指纹=${fingerprintByKey.get(str(a.recordKey)) || '-'}(access ${a.accessToken.length}B / ` +
      `refresh ${a.refreshToken ? `${a.refreshToken.length}B` : '缺'})`,
  )
  process.stderr.write(
    `提取: ${payload.accounts.length} 条可用会话` +
      `${payload.meta.skipped > 0 ? `(跳过 ${payload.meta.skipped} 条双缺记录)` : ''}\n`,
  )
  for (const line of lines) process.stderr.write(`  ${line}\n`)
  if (payload.accounts.length === 0) {
    process.stderr.write('❌ 没有可回灌的会话(缺 accessToken)⇒ 未判定\n')
    return 2
  }

  const result = await runSyncTs(JSON.stringify(payload), parsed.dryRun)
  if (result.error) {
    process.stderr.write(`❌ 同步失败(未判定): ${result.error}\n`)
    return 2
  }
  if (parsed.json && result.json) {
    process.stdout.write(`${JSON.stringify(result.json)}\n`)
  } else if (result.json) {
    const s = result.json
    process.stderr.write(
      `回灌完成: applied=${s.applied} skipped=${s.skipped} missing=${s.missing} ` +
        `imported=${s.imported ?? 0} revived=${s.revived ?? 0} failed=${s.failed}` +
        `${s.dryRun ? '(dry-run 未写)' : ''}\n`,
    )
    for (const r of s.rows ?? []) {
      process.stderr.write(
        `  ${r.uid} ${r.decision}${r.applied ? ' ✓已写' : ''}${r.error ? ` (${r.error})` : ''}\n`,
      )
    }
  }
  return result.code
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((e) => {
      process.stderr.write(`❌ ${e instanceof Error ? e.message : String(e)}\n`)
      process.exit(2)
    })
}

export const __test__ = { parseArgs, buildPayload, recordKeyLabel }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
