// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Loomy 客户端会话定期回灌(2026-11-12 立)—— 第五条第客户端会话回灌腿的取数端。
 *
 * 链路:本机 Loomy 登录态(scripts/lib/loomy-auth-extract.mjs,只读 localStorage)→ stdin JSON →
 * apps/api/scripts/relay-client-session-sync.ts --provider loomy(tsx,判据 + 只写凭证列 +
 * credVersion+1)。由 apps/api/src/workers/relay-account-pool-worker.ts 的 `loomy-session-sync`
 * 定时任务每 10 分钟派发;也可人工跑:
 *
 *   node scripts/sync-loomy-client-session.mjs [--dry-run] [--json]
 *
 * 为什么需要它:Loomy 适配器 refreshTokenSupported:false(空壳),池侧无刷新能力;不回灌就
 * 永远停在导入时的快照。客户端为主策略:每 10 分钟把本机 localStorage 的会话重捞回池。
 * 退出码:0 全部处理完(含 skip)/ 1 落库失败 / 2 未判定(本机无 Loomy 登录态 / tsx 缺失)。
 * 安全:令牌只在两个进程的管道里流动,任何输出都不含凭据明文(只报会话计数与心跳时刻)。
 */
import { resolveTsxCli } from './lib/tsx-cli.mjs'
// 落库段窗口与失败身份判据单源(§0.6):同型腿不各写一份
import { DB_WRITE_TIMEOUT_MS, stageFailureText } from './lib/sync-stage-timeouts.mjs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const API_DIR = path.join(ROOT, 'apps', 'api')
const SYNC_TS = path.join(API_DIR, 'scripts', 'relay-client-session-sync.ts')

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

function runSyncTs(payloadText, dryRun) {
  const tsx = resolveTsxCli(ROOT)
  if (!tsx) {
    return Promise.resolve({
      code: 2,
      json: null,
      error: '未找到 tsx(apps/api/node_modules/tsx);先在仓根 pnpm install',
    })
  }
  const args = [tsx, SYNC_TS, '--provider=loomy', '--stdin', '--json']
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
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill()
    }, DB_WRITE_TIMEOUT_MS)
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
          : stageFailureText({
              timedOut,
              signal,
              code,
              stderr,
              limitMs: DB_WRITE_TIMEOUT_MS,
            }).slice(0, 300),
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
      '用法: node scripts/sync-loomy-client-session.mjs [--dry-run] [--json]\n' +
        '读取本机 Loomy 登录态并回灌号池(客户端为主策略的取数端;判据在 apps/api/scripts/relay-client-session-sync.ts)。\n',
    )
    return 0
  }

  const { extractLoomyAccounts } = await import(
    pathToFileURL(path.join(ROOT, 'scripts', 'lib', 'loomy-auth-extract.mjs')).href
  )
  let extracted
  try {
    extracted = await extractLoomyAccounts()
  } catch (e) {
    process.stderr.write(
      `❌ 提取失败(未判定): [${e?.code ?? 'extract-failed'}] ${e instanceof Error ? e.message : String(e)}\n`,
    )
    return 2
  }
  const accounts = Array.isArray(extracted?.accounts) ? extracted.accounts : []
  if (accounts.length === 0) {
    process.stderr.write('❌ 没有可回灌的 Loomy 会话(未判定)\n')
    return 2
  }
  // 提取成功 = 本机有登录态 ⇒ 带心跳(取不到时刻就不带;不带 ≠ false,§0.3)
  const clientActiveAt = new Date().toISOString()
  const payload = { providerCode: 'loomy', accounts, clientActiveAt }
  process.stderr.write(`提取: Loomy 会话=${accounts.length} 心跳=${clientActiveAt}\n`)

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
        `imported=${s.imported ?? 0} 心跳=${s.heartbeat ?? 0} failed=${s.failed}` +
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

export const __test__ = { parseArgs }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
