// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WorkBuddy 会话模板定期回灌(2026-10-29 装车)—— 与 trae/qoder 两条腿同族的第三条。
 *
 * 立因:`relay-workbuddy-session-sync.ts` 与 `relay-account-pool-service.ts` 的账面都写着
 * "worker cron 每 10 分钟经本脚本回灌",而 worker 只注册了 trae/qoder 两个 job,也没有任何
 * 编排件 —— 判据早就造好,只是没装车(§0.9:造好没装车 = 没有)。本文件补上那条缺失的调度腿。
 *
 * 链路:落库判据自取数(动态 import scripts/lib/workbuddy-auth-extract.mjs,密钥从运行中的
 * WorkBuddy 主进程 inspector 现取)→ 本文件只负责"起 tsx + 把结论归一成 worker 认的形状",
 * 不复制第二份规则(§0.6)。
 *
 *   node scripts/sync-workbuddy-client-session.mjs [--dry-run] [--json]
 *
 * 退出码透传落库脚本:0 写了(或 dry-run 判可写)/ 1 落库失败 / 2 未判定(客户端没在跑、
 * 取不到模板、池内没有该 uid)。stdout 恒为一行 JSON,stderr 原样带出;任何输出零凭据。
 */
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { resolveTsxCli } from './lib/tsx-cli.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const SYNC_TS = path.join(ROOT, 'apps', 'api', 'scripts', 'relay-workbuddy-session-sync.ts')

export function parseArgs(argv) {
  const options = { dryRun: false, json: false, help: false, error: null }
  for (const a of argv) {
    if (a === '--dry-run') options.dryRun = true
    else if (a === '--json') options.json = true
    else if (a === '--help' || a === '-h') options.help = true
    else if (a === '--') continue // pnpm 透传的裸分隔符,不是参数
    else options.error = `未知参数: ${a}`
  }
  return options
}

/**
 * 落库脚本的 summary 用布尔 applied,而 worker 的日志面读的是计数
 * (applied/skipped 两个 number)⇒ 在这一处归一,不在 worker 里再加一个特判分支。
 */
export function normalizeSummary(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.applied !== 'boolean') return null
  return {
    ok: raw.ok === true,
    providerCode: 'workbuddy',
    total: 1,
    applied: raw.applied ? 1 : 0,
    skipped: raw.applied ? 0 : 1,
    failed: raw.ok === true ? 0 : 1,
    dryRun: raw.dryRun === true,
    uid: raw.uid ?? '',
    edition: raw.edition ?? '',
    templateKeys: raw.templateKeys ?? 0,
    sealedPaths: raw.sealedPaths ?? 0,
    error: raw.error ?? null,
  }
}

function runJudge(dryRun) {
  const tsx = resolveTsxCli(ROOT)
  if (!tsx) {
    return Promise.resolve({
      code: 2,
      summary: null,
      error: '未找到 tsx(apps/api/node_modules/tsx 或仓根);先在仓根 pnpm install',
    })
  }
  const args = [tsx, SYNC_TS, '--json']
  if (dryRun) args.push('--dry-run')
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: ROOT,
      windowsHide: true,
      // §12g:派生进程必须显式接管 stdio;本腿不需要 stdin(判据自取数)
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 180_000,
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => (stdout += d))
    child.stderr.on('data', (d) => (stderr += d))
    child.on('error', (e) => resolve({ code: 2, summary: null, error: e.message }))
    child.on('exit', (code, signal) => {
      let parsed = null
      for (const line of stdout.split(/\r?\n/)) {
        const t = line.trim()
        if (!t.startsWith('{')) continue
        try {
          parsed = JSON.parse(t)
        } catch {
          /* 噪音行,继续找汇总行 */
        }
      }
      const summary = normalizeSummary(parsed)
      resolve({
        code: signal ? 2 : (code ?? 2),
        summary,
        error: summary ? null : (stderr.trim() || `退出码 ${code ?? '?'}`).slice(0, 400),
      })
    })
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
      '用法: node scripts/sync-workbuddy-client-session.mjs [--dry-run] [--json]\n' +
        '把本机 WorkBuddy 当前登录号的会话模板回灌进号池(判据在 apps/api/scripts/relay-workbuddy-session-sync.ts)。\n',
    )
    return 0
  }
  const result = await runJudge(parsed.dryRun)
  if (result.error && !result.summary) {
    process.stderr.write(`❌ 回灌未判定: ${result.error}\n`)
    return 2
  }
  const text = JSON.stringify(result.summary)
  if (parsed.json) process.stdout.write(`${text}\n`)
  else process.stderr.write(`回灌结论: ${text}\n`)
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

export const __test__ = { parseArgs, normalizeSummary }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
