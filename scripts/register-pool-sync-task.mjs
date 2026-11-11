#!/usr/bin/env node
/**
 * 「号池跨环境自动同步」Windows 计划任务的注册/查询/注销(2026-11-11 立)。
 *
 * 为什么落到计划任务而不是进程内 cron:同步要跨两台机器(开发机 Postgres ⇄ 生产 Postgres),
 * 它的驱动方必须是**同时能连本地库、又能免密 SSH 生产**的那一端 = 开发机。api 进程内的
 * BullMQ/node-cron 只在服务运行时有效,服务一停同步就断;计划任务是 OS 级调度,重启仍在。
 *
 * 任务形态:
 *   名称 IHUI-Pool-Sync,每 N 分钟(默认 2)执行
 *   cmd /c cd /d <repo> && node scripts\relay-account-pool-sync.mjs --if-dirty --apply --quiet
 *   —— `--if-dirty` = 没有变更标记就 0 开销退出(不启 tsx、不建 SSH);有标记才做全量对账。
 *   变更标记由 apps/api 每次 importAccounts 落库后写(见 relay-account-pool-service.ts)。
 *
 * 用法:
 *   node scripts/register-pool-sync-task.mjs --register [--interval 2]
 *   node scripts/register-pool-sync-task.mjs --query
 *   node scripts/register-pool-sync-task.mjs --unregister
 *   node scripts/register-pool-sync-task.mjs --run-now
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TASK_NAME = 'IHUI-Pool-Sync'
const SYNC_SCRIPT = path.join(ROOT, 'scripts', 'relay-account-pool-sync.mjs')
const LOG_DIR = path.join(ROOT, '.tmp')
const LOG_FILE = path.join(LOG_DIR, 'pool-sync.log')

const HELP = `号池跨环境自动同步 · Windows 计划任务管理

用法:
  node scripts/register-pool-sync-task.mjs --register [--interval 2] [--dry-run-task]
  node scripts/register-pool-sync-task.mjs --query
  node scripts/register-pool-sync-task.mjs --unregister
  node scripts/register-pool-sync-task.mjs --run-now

说明:
  · 任务每 <interval> 分钟跑一次 sync --if-dirty --apply --quiet;
  · 没有变更标记时立即退出(零开销),有标记才做两端全量对账;
  · 日志追加到 .tmp/pool-sync.log(仅在真有同步动作时写行)。`

function parseArgs(argv) {
  const options = { action: 'query', interval: 2, dryRunTask: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') options.action = 'help'
    else if (arg === '--register') options.action = 'register'
    else if (arg === '--unregister') options.action = 'unregister'
    else if (arg === '--query') options.action = 'query'
    else if (arg === '--run-now') options.action = 'run-now'
    else if (arg === '--dry-run-task') options.dryRunTask = true
    else if (arg === '--interval') {
      const v = Number((argv[++i] ?? '').trim())
      if (!Number.isFinite(v) || v < 1) return { options: null, error: '--interval 需要 >= 1 的分钟数' }
      options.interval = Math.floor(v)
    } else return { options: null, error: `未知参数: ${arg}` }
  }
  return { options, error: null }
}

/** schtasks 在中文系统上输出 GBK:只匹配 ASCII 关键字段,故用 latin1 逐字节读取。 */
function schtasks(args) {
  try {
    const buf = execFileSync('schtasks.exe', args, {
      windowsHide: true,
      timeout: 30_000,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'buffer',
    })
    return { ok: true, text: Buffer.from(buf).toString('latin1') }
  } catch (e) {
    const stderr = e?.stderr ? Buffer.from(e.stderr).toString('latin1') : ''
    return { ok: false, text: `${stderr}${e instanceof Error ? ` ${e.message}` : ''}`.trim(), code: e?.status }
  }
}

function buildTaskCommand() {
  return (
    `cmd /c cd /d "${ROOT}" && node "${SYNC_SCRIPT}" --if-dirty --apply --quiet ` +
    `>> "${LOG_FILE}" 2>&1`
  )
}

function doRegister(options) {
  if (!fs.existsSync(SYNC_SCRIPT)) {
    process.stderr.write(`❌ 同步脚本不存在: ${SYNC_SCRIPT}\n`)
    return 2
  }
  fs.mkdirSync(LOG_DIR, { recursive: true })
  const tr = buildTaskCommand()
  // schtasks /TR 上限 261 字符,超了会被截断成半条命令(比失败更危险)
  if (tr.length > 261) {
    process.stderr.write(`❌ 任务命令 ${tr.length} 字符,超过 schtasks 上限 261,请缩短仓库路径\n`)
    return 2
  }
  if (options.dryRunTask) {
    process.stdout.write(`[dry-run] schtasks /Create /TN "${TASK_NAME}" /TR "${tr}" /SC MINUTE /MO ${options.interval} /F\n`)
    return 0
  }
  const r = schtasks([
    '/Create',
    '/TN',
    TASK_NAME,
    '/TR',
    tr,
    '/SC',
    'MINUTE',
    '/MO',
    String(options.interval),
    '/F',
  ])
  if (!r.ok) {
    process.stderr.write(`❌ 注册失败: ${r.text}\n`)
    return 1
  }
  process.stdout.write(`✅ 已注册计划任务 ${TASK_NAME}(每 ${options.interval} 分钟)\n`)
  process.stdout.write(`   命令: ${tr}\n`)
  return 0
}

function doQuery() {
  const r = schtasks(['/Query', '/TN', TASK_NAME, '/FO', 'LIST', '/V'])
  if (!r.ok) {
    process.stdout.write(`未安装:计划任务 ${TASK_NAME} 不存在\n`)
    return 0
  }
  // 只回显 ASCII 可判读的关键行(任务名/状态/下次运行/上次结果),中文标签乱码不影响
  const keep = r.text
    .split(/\r?\n/)
    .filter((line) => /IHUI-Pool-Sync|Ready|Running|Disabled|N\/A|[0-9]{1,2}:[0-9]{2}:[0-9]{2}|0x[0-9a-fA-F]+/i.test(line))
  process.stdout.write(`任务 ${TASK_NAME} 存在\n`)
  for (const line of keep.slice(0, 12)) process.stdout.write(`  ${line.trim()}\n`)
  return 0
}

function doUnregister() {
  const r = schtasks(['/Delete', '/TN', TASK_NAME, '/F'])
  if (!r.ok) {
    process.stdout.write(`未删除(可能本就不存在): ${r.text}\n`)
    return 0
  }
  process.stdout.write(`✅ 已注销计划任务 ${TASK_NAME}\n`)
  return 0
}

function doRunNow() {
  const r = schtasks(['/Run', '/TN', TASK_NAME])
  if (!r.ok) {
    process.stderr.write(`❌ 触发失败(任务未注册?): ${r.text}\n`)
    return 1
  }
  process.stdout.write(`✅ 已触发 ${TASK_NAME}(结果看 ${LOG_FILE})\n`)
  return 0
}

function main(argv) {
  const parsed = parseArgs(argv)
  if (parsed.error) {
    process.stderr.write(`❌ ${parsed.error}\n\n${HELP}\n`)
    return 2
  }
  const options = parsed.options
  switch (options.action) {
    case 'help':
      process.stdout.write(`${HELP}\n`)
      return 0
    case 'register':
      return doRegister(options)
    case 'unregister':
      return doUnregister()
    case 'run-now':
      return doRunNow()
    default:
      return doQuery()
  }
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
if (isDirectRun) {
  process.exit(main(process.argv.slice(2)))
}
