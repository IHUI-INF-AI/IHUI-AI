#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 无刷新协议平台的「本机重新提取」兜底(2026-11-12 立)。
 *
 * 背景:号池里有 8 个平台没有可用的 refresh 协议(codex/opencode/lingma/grokbot 无实现,
 * doubao/loomy/raccoon/zcode 的 refreshToken 是恒 null 空壳)。这些号临期/过期时,
 * 调度器按 isRefreshableProviderCode 让位,不会去猜协议刷新 —— 正确,但也没有出路。
 *
 * 本脚本补的就是这条出路,且只走**已实证的单源通道**:
 *   1) 读本机号池快照(与双向同步同一导出器 --export-all,含每平台 refreshable 能力位);
 *   2) 只挑「已知到期时间已进入窗口」且 refreshable=false 的平台;
 *   3) 逐平台调用现成的 `relay-account-pool.mjs --from <provider>`(本机客户端/登录态提取),
 *      导入成功即按 provider+uid 覆盖旧凭证,并默认推生产;
 *   4) 取不到本机会话 ⇒ 该平台如实报「未判定」并点名原因(§0.3 不猜、不伪造 refresh)。
 *
 * 不做的事:不自行拼上游刷新请求、不打印令牌、不在无会话时冒绿。
 *
 * 用法:
 *   node scripts/relay-account-local-reextract.mjs [--apply]
 *     [--window-days <n>]     到期窗口(缺省 3 天;0 = 只处理已过期)
 *     [--provider <code>]     只处理该平台(可重复给)
 *     [--dry-run]             只预检,不写库(等价缺省;--apply 才落库)
 *     [--no-sync-prod]        本机写入后不推生产(默认推)
 *     [--json]                机器可读摘要
 *     [--log]                 摘要追加写入 <root>/.tmp/reextract.log(计划任务留痕)
 *
 * 退出码:0 无需处理或全部处理成功 / 1 有平台处理失败 / 2 参数或环境未判定。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runProcess } from './relay-account-pool.mjs'
import {
  __extractExport as extractExport,
  __flattenProviders as flattenProviders,
} from './relay-account-pool-sync.mjs'
import { RELAY_PROVIDER_CODES } from './lib/pool-providers.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const API_DIR = path.join(ROOT, 'apps', 'api')
const IMPORTER = path.join(API_DIR, 'scripts', 'relay-account-import.ts')
const POOL_CLI = path.join(ROOT, 'scripts', 'relay-account-pool.mjs')
const DAY_MS = 24 * 60 * 60 * 1000
// 计划任务经 node.exe 直接执行、不经 shell 重定向,脚本 stdout 不会落盘;
// --log 把摘要追加写到这里(与 pool-sync 的 .tmp/pool-sync.log 同风格)。
const DEFAULT_LOG_FILE = path.join(ROOT, '.tmp', 'reextract.log')

const HELP = `无刷新协议平台的「本机重新提取」兜底

用法:
  node scripts/relay-account-local-reextract.mjs [--apply]
    [--window-days <n>]     到期窗口(缺省 3 天;0 = 只处理已过期)
    [--provider <code>]     只处理该平台(可重复给;缺省全部)
    [--dry-run]             只预检不写库(缺省即 dry-run)
    [--no-sync-prod]        本机写入后不推生产(默认推)
    [--json]                机器可读摘要
    [--log]                 把摘要追加写入 .tmp/reextract.log(计划任务自动留痕用)

判据:
  · 平台 refreshable=false(适配器 isRefreshableProviderCode 单一真相源,随 --export-all 导出);
  · 行上 tokenExpiresAt 已知,且 <= now + window-days;
  · 到期时间未知的行不猜「快过期」,只计数并在摘要里点名(未判定)。

退出码:0 无需处理或全部成功 / 1 有平台失败 / 2 参数或环境未判定。`

function parseArgs(argv) {
  const options = {
    apply: false,
    windowDays: 3,
    providers: [],
    syncProd: true,
    json: false,
    log: false,
    help: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') options.help = true
    else if (arg === '--apply') options.apply = true
    else if (arg === '--dry-run') options.apply = false
    else if (arg === '--no-sync-prod') options.syncProd = false
    else if (arg === '--json') options.json = true
    else if (arg === '--log') options.log = true
    else if (arg === '--window-days') {
      const v = Number((argv[++i] ?? '').trim())
      if (!Number.isFinite(v) || v < 0) {
        return { options: null, error: '--window-days 需要 >= 0 的数字(天)' }
      }
      options.windowDays = v
    } else if (arg === '--provider') {
      const v = (argv[++i] ?? '').trim()
      if (!RELAY_PROVIDER_CODES.includes(v)) {
        return { options: null, error: `不支持的平台: ${v}(可选 ${RELAY_PROVIDER_CODES.join('|')})` }
      }
      if (!options.providers.includes(v)) options.providers.push(v)
    } else {
      return { options: null, error: `未知参数: ${arg}` }
    }
  }
  return { options, error: null }
}

function resolveTsx() {
  for (const candidate of [
    path.join(API_DIR, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
  ]) {
    if (fs.existsSync(candidate)) return candidate
  }
  return null
}

async function snapshotLocal(tsxCli) {
  const r = await runProcess(process.execPath, [tsxCli, IMPORTER, '--export-all'], {})
  if (r.code !== 0) {
    throw new Error(`本机号池快照导出失败(退出码 ${r.code}): ${r.error || ''}`.trim())
  }
  const payload = extractExport(r.stdout)
  return { payload, rows: flattenProviders(payload) }
}

/**
 * 计算待兜底平台:refreshable=false + 已知到期进入窗口。
 * 返回 { dueByProvider: Map<code, {count, oldest}>, unknownExpiry: Map<code, count> }
 */
function planReextract(payload, rows, options, nowMs = Date.now()) {
  const threshold = nowMs + options.windowDays * DAY_MS
  const dueByProvider = new Map()
  const unknownExpiry = new Map()
  const allowed = options.providers.length > 0 ? new Set(options.providers) : null
  for (const row of rows) {
    const code = String(row?.__sync?.providerCode ?? '')
    if (!code) continue
    if (allowed && !allowed.has(code)) continue
    const bucket = payload?.providers?.[code]
    // 能力位缺省 = 未判定:不把它当成「无刷新协议」去触发本机提取(避免误动作)。
    if (!bucket || bucket.refreshable !== false) continue
    const raw = row?.__sync?.core?.tokenExpiresAt
    const expiresAt = raw ? Date.parse(String(raw)) : Number.NaN
    if (!Number.isFinite(expiresAt)) {
      unknownExpiry.set(code, (unknownExpiry.get(code) ?? 0) + 1)
      continue
    }
    if (expiresAt > threshold) continue
    const entry = dueByProvider.get(code) ?? { count: 0, oldest: expiresAt }
    entry.count += 1
    if (expiresAt < entry.oldest) entry.oldest = expiresAt
    dueByProvider.set(code, entry)
  }
  return { dueByProvider, unknownExpiry }
}

function renderHuman(summary) {
  const lines = []
  const mode = summary.apply ? '落库' : '预检(dry-run)'
  lines.push(`本机重新提取 · ${mode} · 窗口 ${summary.windowDays} 天`)
  if (summary.planned.length === 0) {
    lines.push('无需处理:没有 refreshable=false 且已知到期进入窗口的行。')
  }
  for (const p of summary.planned) {
    const oldest = p.oldest ? new Date(p.oldest).toISOString() : '未知'
    lines.push(`  · ${p.providerCode}: ${p.due} 行到期(最早 ${oldest})`)
  }
  if (summary.unknownExpiry.length > 0) {
    const parts = summary.unknownExpiry.map((u) => `${u.providerCode}=${u.count}`).join(', ')
    lines.push(`  未判定(到期时间未知,未触发提取): ${parts}`)
  }
  for (const r of summary.results) {
    const mark = r.ok ? 'OK' : 'FAIL'
    lines.push(`  [${mark}] ${r.providerCode} 退出码=${r.code}${r.detail ? ` · ${r.detail}` : ''}`)
  }
  return `${lines.join('\n')}\n`
}

/**
 * 日志摘要的人类可读正文(纯函数,便于测试):一行一事实,不含任何令牌/凭据。
 * `--log` 时整段以 ISO 时间戳前缀追加写入日志文件,stdout 输出仍按 --json/人类可读各自走。
 */
function formatLogSummary(summary, exitCode) {
  const mode = summary.apply ? '落库' : '预检(dry-run)'
  const lines = [`reextract ${mode} 窗口=${summary.windowDays}天`]
  if (summary.planned.length === 0) {
    lines.push('planned=0 无需处理')
  } else {
    lines.push(
      `planned=${summary.planned.length}平台 ` +
        summary.planned.map((p) => `${p.providerCode}:${p.due}行`).join(' '),
    )
  }
  if (summary.unknownExpiry.length > 0) {
    lines.push(
      `未判定(到期未知,未触发): ${summary.unknownExpiry.map((u) => `${u.providerCode}=${u.count}`).join(' ')}`,
    )
  } else {
    lines.push('未判定(到期未知)=0')
  }
  if (summary.results.length === 0) {
    lines.push('results=0(dry-run 不逐平台提取)')
  } else {
    for (const r of summary.results) {
      lines.push(
        `[${r.ok ? 'OK' : 'FAIL'}] ${r.providerCode} 退出码=${r.code}${r.detail ? ` · ${r.detail}` : ''}`,
      )
    }
  }
  lines.push(`退出码=${exitCode}`)
  return `${lines.join('\n')}\n`
}

/** 计划任务用的轻量日志:追加写 + ISO 时间戳前缀;目录不存在则创建;写失败不影响主流程。 */
function appendLog(logFile, text) {
  if (!logFile) return false
  try {
    fs.mkdirSync(path.dirname(logFile), { recursive: true })
    const stamped = text
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => `[${new Date().toISOString()}] ${line}`)
      .join('\n')
    fs.appendFileSync(logFile, `${stamped}\n`, 'utf8')
    return true
  } catch {
    /* 日志写失败不影响提取 */
    return false
  }
}

async function main(argv) {
  const parsed = parseArgs(argv)
  if (parsed.error) {
    process.stderr.write(`❌ ${parsed.error}\n`)
    return 2
  }
  const options = parsed.options
  if (options.help) {
    process.stdout.write(HELP)
    return 0
  }
  const tsxCli = resolveTsx()
  if (!tsxCli) {
    process.stderr.write('❌ 未找到 tsx(先在本仓库安装依赖)\n')
    if (options.log) {
      appendLog(options.logFile || DEFAULT_LOG_FILE, `前置失败: 未找到 tsx,退出码=2\n`)
    }
    return 2
  }

  let snapshot
  try {
    snapshot = await snapshotLocal(tsxCli)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    process.stderr.write(`❌ ${msg}\n`)
    if (options.log) {
      appendLog(options.logFile || DEFAULT_LOG_FILE, `前置失败: 本机号池快照导出失败 · ${msg} · 退出码=2\n`)
    }
    return 2
  }
  const { payload, rows } = snapshot
  const { dueByProvider, unknownExpiry } = planReextract(payload, rows, options)

  const summary = {
    apply: options.apply,
    windowDays: options.windowDays,
    planned: [...dueByProvider.entries()]
      .map(([providerCode, v]) => ({ providerCode, due: v.count, oldest: v.oldest }))
      .sort((a, b) => a.providerCode.localeCompare(b.providerCode)),
    unknownExpiry: [...unknownExpiry.entries()]
      .map(([providerCode, count]) => ({ providerCode, count }))
      .sort((a, b) => a.providerCode.localeCompare(b.providerCode)),
    results: [],
  }

  if (options.apply) {
    for (const item of summary.planned) {
      const args = [POOL_CLI, '--from', item.providerCode, '--no-health']
      if (!options.syncProd) args.push('--no-sync-prod')
      const r = await runProcess(process.execPath, args, {})
      const detail = String(r.error ?? '')
        .split(/\r?\n/)
        .filter(Boolean)
        .slice(-1)[0]
      summary.results.push({
        providerCode: item.providerCode,
        code: r.code,
        ok: r.code === 0,
        detail,
      })
    }
  }

  const exitCode = summary.results.some((r) => !r.ok) ? 1 : 0

  if (options.json) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
  } else {
    process.stdout.write(renderHuman(summary))
  }
  if (options.log) appendLog(options.logFile || DEFAULT_LOG_FILE, formatLogSummary(summary, exitCode))
  return exitCode
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((e) => {
      process.stderr.write(`❌ ${e instanceof Error ? e.message : String(e)}\n`)
      process.exit(2)
    })
}

export {
  main as __reextractMain,
  planReextract as __planReextract,
  parseArgs as __parseArgs,
  formatLogSummary as __formatLogSummary,
  appendLog as __appendLog,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
