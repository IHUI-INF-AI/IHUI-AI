#!/usr/bin/env node
/**
 * 号池跨环境双向同步编排器(2026-11-11 立,李总明令「必须从代码层面做到自动同步、互通」)。
 *
 * 定位:这不是"再补一个手动命令",而是把「本地库 ⇄ 生产库」的收敛做成**默认自动行为**:
 *   · 手动:node scripts/relay-account-pool-sync.mjs --apply
 *   · 定时:Windows 计划任务每 2 分钟跑一次 --if-dirty --apply(见 register-pool-sync-task.mjs)
 *   · 触发:apps/api 每次 importAccounts 落库后写脏标记(见 relay-account-pool-service.ts),
 *           定时器发现标记立刻同步 ⇒ Web 加号 / 管理员导入 / 会话回灌都能在 2 分钟内进另一端。
 *
 * 通道设计(刻意零新增 DB 代码路径,全部复用已验证的现成件):
 *   本地快照 = tsx 跑 relay-account-import.ts --export-all(只读,含明文+updatedAt)
 *   生产快照 = 一次 SSH 跑同一个 --export-all(12 平台只付一次握手)
 *   本地落库 = tsx 跑导入器(按 owner 分组批量 --file)
 *   生产落库 = base64 走 stdin 一次 SSH 写入生产临时目录 + 批量导入 + 双端删净
 *
 * 明文安全:凭证只在内存与 SSH stdin 通道内流动;本地临时目录 mkdtemp 后 finally 删净,
 * 生产临时目录在命令末尾 rmdir,失败时补一次清理。任何日志都不打印 token。
 *
 * 用法:
 *   node scripts/relay-account-pool-sync.mjs [--apply|--dry-run]
 *     [--provider <code>]        只同步该平台(可重复给;缺省全平台)
 *     [--push-only|--pull-only]  只推 / 只拉
 *     [--pull-window-days <n>]   「仅生产有」视为新增的时效窗口(缺省 7 天;更老的缺失
 *                                当作本地已删除,只报告不复活,避免删号被另一端拉回)
 *     [--if-dirty]               仅当脏标记存在才跑(计划任务用;--force 可忽略标记)
 *     [--dirty-file <path>]      脏标记路径(缺省 ~/.wb-switch/pool-sync-dirty)
 *     [--prod-host <alias>]      SSH 别名(默认 ssh.aizhs.top)
 *     [--prod-checkout <path>]   生产 checkout 根(默认 D:\DevEnv\ihui-prod)
 *     [--json] [--quiet]
 *
 * 退出码:0 无失败(含"无变更"与"未到脏") / 1 有失败 / 2 参数或环境未判定。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { runProcess } from './relay-account-pool.mjs'
import { groupForImport, planPoolSync } from './lib/pool-sync-plan.mjs'
import { maskPoolOwner } from './lib/pool-owner.mjs'
import { RELAY_PROVIDER_CODES } from './lib/pool-providers.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const API_DIR = path.join(ROOT, 'apps', 'api')
const IMPORTER = path.join(API_DIR, 'scripts', 'relay-account-import.ts')
const PROD_TEMP = 'D:\\DevEnv\\Temp'
const DEFAULT_DIRTY_FILE = path.join(os.homedir(), '.wb-switch', 'pool-sync-dirty')
const BEGIN = '__POOL_EXPORT_BEGIN__'
const END = '__POOL_EXPORT_END__'
const SSH_OPTS = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20']

const HELP = `号池跨环境双向同步(本地库 ⇄ 生产库)

用法:
  node scripts/relay-account-pool-sync.mjs [--apply|--dry-run]
    [--provider <code>]        只同步该平台(可重复给;缺省全平台)
    [--push-only|--pull-only]  只推 / 只拉
    [--pull-window-days <n>]   「仅生产有」视为新增的时效窗口(缺省 7 天)
    [--if-dirty]               仅当脏标记存在才跑(计划任务用)
    [--dirty-file <path>]      脏标记路径(缺省 ~/.wb-switch/pool-sync-dirty)
    [--prod-host <alias>]      SSH 别名(默认 ssh.aizhs.top)
    [--prod-checkout <path>]   生产 checkout 根(默认 D:\\DevEnv\\ihui-prod)
    [--json] [--quiet]

规则:仅一侧有 → 补缺;两侧都有 → 凭证指纹相同则跳过、不同则 updatedAt 新者胜;
      删除不传播(跨环境删号必须人工显式执行)。
退出码:0 无失败 / 1 有失败 / 2 参数或环境未判定。`

function parseArgs(argv) {
  const options = {
    apply: false,
    dryRun: true,
    providers: [],
    pushOnly: false,
    pullOnly: false,
    pullWindowDays: 7,
    ifDirty: false,
    force: false,
    dirtyFile: DEFAULT_DIRTY_FILE,
    prodHost: 'ssh.aizhs.top',
    prodCheckout: 'D:\\DevEnv\\ihui-prod',
    json: false,
    quiet: false,
    help: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') options.help = true
    else if (arg === '--apply') {
      options.apply = true
      options.dryRun = false
    } else if (arg === '--dry-run') {
      options.dryRun = true
      options.apply = false
    } else if (arg === '--provider') {
      const v = (argv[++i] ?? '').trim()
      if (!RELAY_PROVIDER_CODES.includes(v)) {
        return { options: null, error: `不支持的平台: ${v}(可选 ${RELAY_PROVIDER_CODES.join('|')})` }
      }
      if (!options.providers.includes(v)) options.providers.push(v)
    } else if (arg === '--push-only') options.pushOnly = true
    else if (arg === '--pull-only') options.pullOnly = true
    else if (arg === '--pull-window-days') {
      const v = Number((argv[++i] ?? '').trim())
      if (!Number.isFinite(v) || v < 0) {
        return { options: null, error: '--pull-window-days 需要 >= 0 的数字(天)' }
      }
      options.pullWindowDays = v
    } else if (arg === '--if-dirty') options.ifDirty = true
    else if (arg === '--force') options.force = true
    else if (arg === '--dirty-file') options.dirtyFile = (argv[++i] ?? '').trim()
    else if (arg === '--prod-host') options.prodHost = (argv[++i] ?? '').trim()
    else if (arg === '--prod-checkout') options.prodCheckout = (argv[++i] ?? '').trim()
    else if (arg === '--json') options.json = true
    else if (arg === '--quiet') options.quiet = true
    else return { options: null, error: `未知参数: ${arg}` }
  }
  if (options.help) return { options, error: null }
  if (options.pushOnly && options.pullOnly) {
    return { options: null, error: '--push-only 与 --pull-only 互斥(要双向就别带任何一个)' }
  }
  if (!options.dirtyFile) return { options: null, error: '--dirty-file 需要路径' }
  if (!options.prodHost) return { options: null, error: '--prod-host 需要 SSH 别名' }
  if (!options.prodCheckout) return { options: null, error: '--prod-checkout 需要路径' }
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

/** 从可能被 dotenv/[db] 诊断污染的 stdout 里只截边界标记之间的 JSON 段。 */
function extractExport(stdout) {
  const text = String(stdout ?? '')
  const b = text.indexOf(BEGIN)
  const e = text.indexOf(END)
  if (b < 0 || e <= b) {
    throw new Error('未找到导出边界标记(对端 checkout 可能是旧版导入器,缺 --export-all)')
  }
  return JSON.parse(text.slice(b + BEGIN.length, e).trim())
}

/** 把 --export-all 的 providers 分桶摊平成数组,逐账号补 providerCode。 */
function flattenProviders(payload) {
  const out = []
  if (payload && payload.providers && typeof payload.providers === 'object') {
    for (const [code, bucket] of Object.entries(payload.providers)) {
      for (const acc of bucket?.accounts ?? []) out.push({ ...acc, providerCode: code })
    }
    return out
  }
  if (payload && Array.isArray(payload.accounts) && payload.providerCode) {
    return payload.accounts.map((a) => ({ ...a, providerCode: String(payload.providerCode) }))
  }
  return out
}

async function snapshotLocal(tsxCli, options) {
  const args = [tsxCli, IMPORTER, '--export-all']
  const r = await runProcess(process.execPath, args, {})
  if (r.code !== 0) {
    throw new Error(`本地快照导出失败(退出码 ${r.code}): ${r.error || ''}`.trim())
  }
  return flattenProviders(extractExport(r.stdout))
}

async function snapshotProd(options) {
  const remoteCmd =
    `cd /d "${options.prodCheckout}" & node ` +
    ['apps\\api\\node_modules\\tsx\\dist\\cli.mjs', 'apps\\api\\scripts\\relay-account-import.ts', '--export-all'].join(
      ' ',
    )
  const r = await runProcess('ssh', [...SSH_OPTS, options.prodHost, remoteCmd], {})
  if (r.code !== 0) {
    throw new Error(`生产快照导出失败(退出码 ${r.code}): ${r.error || ''}`.trim())
  }
  return flattenProviders(extractExport(r.stdout))
}

/** 按 owner 分组(导入器一次只吃一个归属,混批会把归属串台)。 */
function groupByOwner(batches) {
  const map = new Map()
  for (const b of batches) {
    const k = b.ownerUserId ?? 'ops'
    if (!map.has(k)) map.set(k, { ownerUserId: b.ownerUserId, batches: [] })
    map.get(k).batches.push(b)
  }
  return [...map.values()]
}

/** 拉回侧:本机导入器分组批量落库。 */
async function applyPull(batches, tsxCli, options) {
  if (batches.length === 0) return { code: 0, groups: 0, imported: 0, updated: 0, failed: 0 }
  let worst = 0
  let imported = 0
  let updated = 0
  let failed = 0
  let groups = 0
  for (const group of groupByOwner(batches)) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-pool-pull-'))
    try {
      const files = []
      for (const b of group.batches) {
        const file = path.join(dir, `${b.providerCode}__${b.ownerUserId ?? 'ops'}.json`)
        fs.writeFileSync(file, JSON.stringify({ providerCode: b.providerCode, accounts: b.accounts }), 'utf8')
        files.push(file)
      }
      const args = [tsxCli, IMPORTER, ...files.flatMap((f) => ['--file', f]), '--no-health', '--json']
      if (group.ownerUserId) args.push('--owner', group.ownerUserId, '--owner-source', 'explicit-flag')
      else args.push('--owner-source', 'none')
      const r = await runProcess(process.execPath, args, { inherit: false })
      worst = Math.max(worst, r.code ?? 0)
      groups++
      const text = `${r.stdout ?? ''}${r.error ?? ''}`
      for (const line of text.split(/\r?\n/)) {
        const m = /导入完成:平台=(\S+)\s+新增=(\d+)\s+更新=(\d+)\s+跳过=(\d+)\s+失败=(\d+)/.exec(line)
        if (!m) continue
        imported += Number(m[2])
        updated += Number(m[3])
        failed += Number(m[5])
      }
      if (r.code !== 0 && !options.quiet) {
        process.stderr.write(`⚠️ 拉回落库有失败(owner=${maskPoolOwner(group.ownerUserId)} 退出码 ${r.code})\n`)
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  }
  return { code: worst, groups, imported, updated, failed }
}

/** 推送侧:base64 一次 SSH → 生产临时目录 → 按 owner 批量导入 → 删净。 */
async function applyPush(batches, options) {
  if (batches.length === 0) return { code: 0, imported: 0, updated: 0, failed: 0 }
  const stamp = `${Date.now().toString(36)}-${process.pid}`
  const remoteDir = `${PROD_TEMP}\\ihui-pool-sync-${stamp}`
  const bundle = {}
  const byOwner = groupByOwner(batches)
  for (const group of byOwner) {
    for (const b of group.batches) {
      const name = `${b.providerCode}__${b.ownerUserId ?? 'ops'}.json`
      bundle[name] = JSON.stringify({ providerCode: b.providerCode, accounts: b.accounts })
    }
  }
  const payload = Buffer.from(JSON.stringify(bundle), 'utf8').toString('base64')
  const writer =
    `const fs=require('fs'),p=require('path'),d='${remoteDir.replaceAll('\\', '/')}';` +
    `fs.mkdirSync(d,{recursive:true});` +
    `const o=JSON.parse(Buffer.from(fs.readFileSync(0,'utf8'),'base64').toString('utf8'));` +
    `for(const k of Object.keys(o))fs.writeFileSync(p.join(d,k),o[k]);`
  const steps = []
  let imported = 0
  let updated = 0
  let failed = 0
  for (const group of byOwner) {
    const files = group.batches.map((b) => `${remoteDir}\\${b.providerCode}__${b.ownerUserId ?? 'ops'}.json`)
    let cmd =
      'node apps\\api\\node_modules\\tsx\\dist\\cli.mjs apps\\api\\scripts\\relay-account-import.ts ' +
      files.map((f) => `--file "${f}"`).join(' ') +
      ' --no-health'
    if (group.ownerUserId) cmd += ` --owner ${group.ownerUserId} --owner-source explicit-flag`
    else cmd += ' --owner-source none'
    steps.push(cmd)
  }
  const remoteCmd =
    `cd /d "${options.prodCheckout}" & node -e "${writer}" && ` +
    `${steps.join(' & ')} & rmdir /s /q "${remoteDir}"`
  const r = await runProcess('ssh', [...SSH_OPTS, options.prodHost, remoteCmd], {
    inherit: false,
    input: payload,
  })
  const text = `${r.stdout ?? ''}${r.error ?? ''}`
  for (const line of text.split(/\r?\n/)) {
    const m = /导入完成:平台=(\S+)\s+新增=(\d+)\s+更新=(\d+)\s+跳过=(\d+)\s+失败=(\d+)/.exec(line)
    if (!m) continue
    imported += Number(m[2])
    updated += Number(m[3])
    failed += Number(m[5])
  }
  if (r.code !== 0) {
    // 失败时补一次清理,避免明文留在生产盘上
    await runProcess('ssh', [...SSH_OPTS, options.prodHost, `rmdir /s /q "${remoteDir}"`], {})
    if (!options.quiet) process.stderr.write(`⚠️ 推送生产失败(退出码 ${r.code}): ${r.error || ''}\n`)
  }
  return { code: r.code ?? 2, imported, updated, failed }
}

function emitReport(plan, options, extra) {
  const summary = {
    ok: extra.ok,
    dryRun: options.dryRun,
    stats: plan.stats,
    conflicts: plan.conflicts.map((c) => ({
      providerCode: c.providerCode,
      uid: c.uid,
      winner: c.winner,
      deltaMs: c.deltaMs,
    })),
    push: extra.push,
    pull: extra.pull,
    staleMissingLocal: plan.staleMissingLocal.map((s) => ({
      providerCode: s.providerCode,
      uid: s.uid,
      updatedAt: s.updatedAt,
    })),
    providers: options.providers.length ? options.providers : 'all',
  }
  if (options.json) {
    process.stdout.write(`${JSON.stringify(summary)}\n`)
    return
  }
  if (options.quiet && plan.stats.toPush === 0 && plan.stats.toPull === 0 && extra.ok) return
  const head = options.dryRun ? '预检(不落库)' : '同步'
  process.stdout.write(
    `${head}: 本地=${plan.stats.localTotal} 生产=${plan.stats.prodTotal} ` +
      `待推=${plan.stats.toPush} 待拉=${plan.stats.toPull} 一致=${plan.stats.unchanged} 冲突=${plan.stats.conflicts}\n`,
  )
  for (const c of plan.conflicts.slice(0, 10)) {
    process.stdout.write(
      `  · 冲突 ${c.providerCode}/${c.uid.slice(0, 12)}… → ${c.winner === 'local' ? '本地胜' : '生产胜'}` +
        `(差 ${Math.round(c.deltaMs / 1000)}s)\n`,
    )
  }
  if (plan.stats.staleMissingLocal > 0) {
    process.stdout.write(
      `  · 疑似已删(生产有 / 本地无,超拉回窗口): ${plan.stats.staleMissingLocal} 条 —— 不复活,` +
        `确认要清生产请人工处理\n`,
    )
  }
  if (!options.dryRun) {
    process.stdout.write(
      `  推送生产: 新增=${extra.push.imported} 更新=${extra.push.updated} 失败=${extra.push.failed}\n` +
        `  拉回本地: 新增=${extra.pull.imported} 更新=${extra.pull.updated} 失败=${extra.pull.failed}\n`,
    )
  }
}

async function main(argv) {
  const parsed = parseArgs(argv)
  if (parsed.error) {
    process.stderr.write(`❌ ${parsed.error}\n\n${HELP}\n`)
    return 2
  }
  const options = parsed.options
  if (options.help) {
    process.stdout.write(`${HELP}\n`)
    return 0
  }

  // 计划任务快速通道:无脏标记 = 本轮 0 开销(不建 SSH、不启 tsx)
  if (options.ifDirty && !options.force && !fs.existsSync(options.dirtyFile)) {
    if (!options.quiet) process.stdout.write('无变更标记,跳过本轮同步\n')
    return 0
  }

  const tsxCli = resolveTsx()
  if (!tsxCli) {
    process.stderr.write('❌ 未找到 tsx(apps/api/node_modules/tsx);请先在仓根跑 pnpm install\n')
    return 2
  }

  let local
  let prod
  try {
    local = await snapshotLocal(tsxCli, options)
    prod = await snapshotProd(options)
  } catch (e) {
    process.stderr.write(`❌ 快照失败(未判定,本轮不写任何库): ${e instanceof Error ? e.message : String(e)}\n`)
    return 2
  }

  let plan = planPoolSync({
    local,
    prod,
    providers: options.providers,
    pullWindowDays: options.pullWindowDays,
  })

  // 方向开关:只推 / 只拉
  if (options.pushOnly) plan = { ...plan, toPull: [] }
  if (options.pullOnly) plan = { ...plan, toPush: [] }

  const pushBatches = options.dryRun ? [] : groupForImport(plan.toPush)
  const pullBatches = options.dryRun ? [] : groupForImport(plan.toPull)

  let push = { code: 0, imported: 0, updated: 0, failed: 0 }
  let pull = { code: 0, imported: 0, updated: 0, failed: 0 }
  if (!options.dryRun) {
    // 先拉后推:把生产的新凭证先补到本地,再统一往外推,避免同一轮里推了旧值
    pull = await applyPull(pullBatches, tsxCli, options)
    if (!options.pullOnly) push = await applyPush(pushBatches, options)
  }

  const ok = push.code === 0 && push.failed === 0 && pull.code === 0 && pull.failed === 0
  emitReport(plan, options, { ok, push, pull })

  // 脏标记只在真正落库且无失败时清除:失败保留标记,下一轮自动重试
  if (!options.dryRun && ok) {
    try {
      if (fs.existsSync(options.dirtyFile)) fs.rmSync(options.dirtyFile, { force: true })
    } catch {
      /* 标记删不掉不影响同步结果,下轮再跑一次是幂等的 */
    }
  }

  if (!ok) return 1
  return 0
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
if (isDirectRun) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((e) => {
      process.stderr.write(`❌ ${e instanceof Error ? e.message : String(e)}\n`)
      process.exit(2)
    })
}

export { main as __syncMain, flattenProviders as __flattenProviders, extractExport as __extractExport }
