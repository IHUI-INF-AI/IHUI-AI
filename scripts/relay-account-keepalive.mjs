// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 永久保活腿入口(2026-10-31 立)—— 让「掉线就登不回来」的号有一条不依赖 api 常驻的续期路。
 *
 *   node scripts/relay-account-keepalive.mjs --status [--json]      # 现读永久保活登记面
 *   node scripts/relay-account-keepalive.mjs --mark <uid> [--off]   # 登记/取消(默认 provider=trae)
 *   node scripts/relay-account-keepalive.mjs --once [--json]        # 跑一轮巡检 + 需要时喊人
 *
 * 分工(§0.6 判据单源):续期/摘除/解摘/退避的全部口径住在
 * apps/api/src/services/relay-account-pool-scheduler.ts,登记与执行落地住在
 * apps/api/scripts/relay-account-keepalive.ts(它直接调 sweepAccountPool,不写第二份)。
 * 本文件只做编排 + 到人通知:
 *  - 为什么需要这条腿:sweep 由 apps/api 的 BullMQ worker 驱动,而本机 api 是 tsx dev 进程
 *    (2026-10-31 实测 sc 里只有 PostgreSQL16IHUI,没有 api 服务)⇒ 进程一停保活即停。
 *    git-guardian 计划任务每 2 分钟常驻,由它派发本脚本才谈得上「永久」。
 *  - 发信一律经 apps/api/scripts/notify-deploy-failure.ts 唯一出口(§5e / 守门 81),
 *    收件人不在此解析(交出口自读 ALERT_EMAIL_TO),不传 --env-file。
 *  - 喊人的身份 = provider + uid 前缀,不含计数/时刻/异常原文(守门 224:抖动进身份 = 每轮一封信)。
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolveTsxCli } from './lib/tsx-cli.mjs'
// 进程探测单源在回灌腿里(§0.6):这里复用同一把,不在本文件重抄 tasklist 判据
import { probeClientActive } from './sync-trae-client-session.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const API_DIR = path.join(ROOT, 'apps', 'api')
const KEEPALIVE_TS = path.join(API_DIR, 'scripts', 'relay-account-keepalive.ts')
const MAIL_SCRIPT = path.join(API_DIR, 'scripts', 'notify-deploy-failure.ts')
const TMP_DIR = path.join(ROOT, '.ihui-agent', 'tmp', 'relay-account-keepalive')

const USAGE =
  '用法: node scripts/relay-account-keepalive.mjs --status|--mark <uid> [--provider trae] [--off]|--once|--takeover <uid>|--explain <uid> [--force] [--json]\n' +
  '  --takeover 显式让池接管续一次票(客户端在跑/探测未知 ⇒ 先落心跳再判闸,需 --force 才顶号)\n'

/** 透传参数面:只认这几组动词,其余原样交给 ts 侧判(未知参数由它报「未判定」) */
export function parseArgs(argv) {
  const options = { help: false, once: false, takeover: false }
  for (const a of argv) {
    if (a === '--help' || a === '-h') options.help = true
    else if (a === '--once') options.once = true
    else if (a === '--takeover') options.takeover = true
    else if (a === '--') continue // pnpm 透传的裸分隔符,不是参数
  }
  return options
}

/**
 * 哪些号需要喊人:已被摘除,或巡检判成 down。
 * 刻意不看 refreshFailureCount 与阈值比大小 —— 摘除阈值单源在 scheduler
 * (REFRESH_FAILURE_LIMIT),这里再抄一份数字,两边一旦漂移就会漏喊/多喊。
 */
export function alertTargetsOf(keepAlive) {
  const rows = Array.isArray(keepAlive) ? keepAlive : []
  return rows.filter((r) => r && (r.tempUnschedulable === true || r.healthStatus === 'down'))
}

/**
 * 去重身份:provider + uid 前 8 位(+ 类别)。
 * 默认类别 `fault` 保持历史形态逐字不变 —— 身份一旦改写法,已登记的抑制窗口会当成
 * 全新事件重发一遍(§5e-3 立的就是这条:量不许进身份,但身份也不能漂)。
 */
export function alertIdOf(row, category = 'fault') {
  const base = `relay-keepalive-${row.providerCode}-${String(row.uid).slice(0, 8)}`
  return category === 'fault' ? base : `${base};${category}`
}

/** 落件名要文件系统安全(`;` 在 Windows 合法但编辑器/脚本易看漏),只用于临时正文件 */
export function mailSlugOf(id) {
  return String(id).replace(/[^A-Za-z0-9._-]/g, '_')
}

/**
 * rt 死线预警名单:自然终点已进入守护窗(含已过点)的登记号。
 *
 * `guardHours` 必须由 ts 侧从调度层取(阈值单源在 scheduler.rtExpiryGuardHours);
 * 传不到 ⇒ 返回空集(未判定)—— 在这里抄一个 72,下个月两边就漂开,而症状是"该喊的没喊"。
 * `refreshExpiresAt` 读不到 ⇒ 不进射程:喊"号要死了"得有日期为证;"有 rt 却无终点"是
 * 另一件事(证据缺口),由号池隔离性体检尺按自己的身份点名,不与此折叠。
 */
export function rtDeadlineTargetsOf(keepAlive, nowMs = Date.now(), guardHours = null) {
  const rows = Array.isArray(keepAlive) ? keepAlive : []
  if (typeof guardHours !== 'number' || !Number.isFinite(guardHours) || guardHours <= 0) return []
  const windowMs = guardHours * 3600_000
  return rows.filter((r) => {
    if (!r) return false
    const raw = r.refreshExpiresAt
    if (typeof raw !== 'string' && !(raw instanceof Date)) return false
    const t = new Date(raw).getTime()
    return Number.isFinite(t) && t - nowMs < windowMs
  })
}

/** 跑 ts 侧脚本;stdout 只取最后一枚可解析 JSON 行(db 连接等噪音不进结论) */
function runKeepaliveTs(argv) {
  const tsx = resolveTsxCli(ROOT)
  if (!tsx)
    return { code: 2, json: null, stderr: '', error: '未找到 tsx(apps/api/node_modules/tsx)' }
  const r = spawnSync(process.execPath, [tsx, KEEPALIVE_TS, ...argv], {
    cwd: API_DIR,
    windowsHide: true,
    // §12g:派生进程必须显式 stdio(不给 = 本机稳定 EBUSY)
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    timeout: 300_000,
  })
  const stdout = String(r.stdout ?? '')
  let json = null
  for (const line of stdout.split(/\r?\n/)) {
    const t = line.trim()
    if (!t.startsWith('{')) continue
    try {
      json = JSON.parse(t)
    } catch {
      /* 不是汇总行 */
    }
  }
  return {
    code: r.signal ? 2 : (r.status ?? 2),
    json,
    stdout,
    stderr: String(r.stderr ?? ''),
    error: r.error ? r.error.message : null,
  }
}

/**
 * 到人通知。出口不在位/投递失败 ⇒ 只报「未判定/未送达」,不冒充已发(§0.3)。
 * 返回投递枚数;真正的发信判据与版式都在出口里,本函数只组正文。
 */
/** 两类告警的正文(身份不同 ⇒ 内容也不同,不许互相冒充) */
export function alertBodyOf(row, category = 'fault') {
  const head = `号池永久保活:${row.providerCode}/${row.uid}(${row.name ?? '-'})`
  const common = [
    `健康状态: ${row.healthStatus}`,
    `自动摘除: ${row.tempUnschedulable ? '是' : '否'}`,
    `token 到期: ${row.tokenExpiresAt ?? '-'}`,
    `refreshToken 到期: ${row.refreshExpiresAt ?? '-'}`,
    `最近刷新: ${row.lastRefreshAt ?? '-'}`,
    `最近错误: ${row.lastErrorMessage ?? '-'}`,
  ]
  if (category === 'rt-deadline') {
    return [
      head,
      '',
      ...common,
      `末次池侧接管: ${row.takeoverAt ?? '(从未发生)'}`,
      '',
      '这枚号的 refreshToken 已进入死线守护窗。rt 一到自然终点,号池就再也刷不出新票,',
      '而它不能靠验证码重登 —— 所以保活档会优先保住号,不再让位本机客户端。',
      '后果:你下次打开 Trae 可能是登出状态。这不是丢号,用一键切号把池里现役的票取回即可:',
      `  node scripts/switch-trae-client-account.mjs --to ${row.uid}`,
      '(客户端在跑时该命令会先要求退出;号池这一侧的票不会因此失效。)',
      '复核出口: node scripts/relay-account-keepalive.mjs --status',
    ].join('\n')
  }
  return [
    head,
    '',
    ...common,
    '',
    '这枚号已登记永久保活(掉线无法靠验证码重登,只能靠号池 + 一键切号)。',
    '摘除态会在退避窗口后被自动解摘并重试;若持续失败,请人工核对上游凭据是否已被回收。',
    '复核出口: node scripts/relay-account-keepalive.mjs --status',
  ].join('\n')
}

function sendAlertMail(targets, category = 'fault') {
  if (targets.length === 0) return 0
  if (!fs.existsSync(MAIL_SCRIPT)) {
    process.stderr.write('⚠️ 保活邮件未判定:唯一出口不在位(notify-deploy-failure.ts)\n')
    return 0
  }
  const tsx = resolveTsxCli(ROOT)
  if (!tsx) {
    process.stderr.write('⚠️ 保活邮件未判定:未找到 tsx,出口无法执行\n')
    return 0
  }
  fs.mkdirSync(TMP_DIR, { recursive: true })
  let sent = 0
  for (const row of targets) {
    const alertId = alertIdOf(row, category)
    const msgFile = path.join(TMP_DIR, `alert-${mailSlugOf(alertId)}.md`)
    // 无 BOM UTF-8 正文(§5e:多行中文一律走 --message-file)
    fs.writeFileSync(msgFile, alertBodyOf(row, category), 'utf8')
    const r = spawnSync(
      process.execPath,
      [
        tsx,
        MAIL_SCRIPT,
        '--title',
        `号池永久保活${category === 'rt-deadline' ? ' rt 死线' : '告警'} ${row.providerCode}/${String(row.uid).slice(0, 8)}`,
        '--severity',
        'warning',
        '--source',
        'relay-account-keepalive',
        '--alert-id',
        alertId,
        '--message-file',
        msgFile,
      ],
      {
        cwd: ROOT,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        encoding: 'utf8',
        timeout: 60_000,
      },
    )
    try {
      fs.unlinkSync(msgFile)
    } catch {
      /* 用完即删,删不掉不遮蔽主流程 */
    }
    if (r.status === 0) sent++
    else
      process.stderr.write(
        `⚠️ 保活邮件未送达(${alertIdOf(row)}):${String(r.stderr ?? '').slice(-200)}\n`,
      )
  }
  return sent
}

async function main(argv) {
  const parsed = parseArgs(argv)
  if (parsed.help) {
    process.stdout.write(USAGE)
    return 0
  }
  const childArgv = [...argv]
  if (parsed.once || parsed.takeover) {
    // 探测在本机做,不交给池里那条旧心跳:api 一挂旧心跳必然陈旧 ⇒ 池判成静默 ⇒ 接管续期
    // ⇒ 把用户正在用的 Trae 顶下线。未知(null)与在跑(true)同向送心跳 —— 误判「在跑」只是
    // 本轮少刷一次,误判「静默」是不可逆的掉线,代价不对称。
    const active = probeClientActive()
    if (active !== false) childArgv.push('--client-active', new Date().toISOString())
    process.stderr.write(
      `客户端探测: ${active === null ? '未知(按在跑处理,不让池接管)' : active ? '在跑' : '未运行'}\n`,
    )
  }
  const run = runKeepaliveTs(childArgv)
  if (run.error) {
    process.stderr.write(`❌ 派发失败(未判定): ${run.error}\n`)
    return 2
  }
  // ts 侧的人读输出原样透出(stdio 是 pipe,不转 inherit 因为要解析 stdout)
  if (run.stdout) process.stdout.write(run.stdout)
  if (run.stderr) process.stderr.write(run.stderr)
  if (run.code === 2) return 2
  if (!parsed.once) return run.code
  const targets = alertTargetsOf(run.json?.keepAlive)
  // rt 死线预警的阈值从 ts 侧拿(单源在调度层);拿不到 ⇒ 空集 = 这一维本轮未判定,不猜
  const rtTargets = rtDeadlineTargetsOf(
    run.json?.keepAlive,
    Date.now(),
    typeof run.json?.rtGuardHours === 'number' ? run.json.rtGuardHours : null,
  )
  const alertCount = targets.length + rtTargets.length
  let sent = 0
  if (alertCount > 0) {
    // 两类各发各的:身份不同(故障 vs 死线),折叠成一条就会有一类永远喊不出去
    sent = sendAlertMail(targets, 'fault') + sendAlertMail(rtTargets, 'rt-deadline')
    process.stderr.write(
      `保活告警:需喊人 ${alertCount} 枚(故障 ${targets.length} / rt 死线 ${rtTargets.length}),已投递 ${sent} 封\n`,
    )
  }
  // 结论行(ASCII 单行,供 git-guardian 判读):state 三态绝不并桶 ——
  // 汇总取不到 ⇒ undetermined,不得写成 ok(§0.3「没判」不写成「判过」)。
  const sweep = run.json?.sweep ?? null
  const state = !run.json || !sweep ? 'undetermined' : alertCount > 0 ? 'alert' : 'ok'
  process.stdout.write(
    `KEEPALIVE-RESULT state=${state}` +
      ` registered=${Array.isArray(run.json?.keepAlive) ? run.json.keepAlive.length : '?'}` +
      ` refreshed=${sweep?.refreshed ?? '?'} refreshFailed=${sweep?.refreshFailed ?? '?'}` +
      ` keepalive=${sweep?.keepalive ?? '?'} heartbeat=${run.json?.heartbeated ?? '?'}` +
      ` alerts=${alertCount} rtDeadline=${rtTargets.length} mailed=${sent}\n`,
  )
  return run.code
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((e) => {
      process.stderr.write(`❌ ${e instanceof Error ? e.message : String(e)}\n${e?.stack ?? ''}\n`)
      process.exit(2)
    })
}

export const __test__ = {
  parseArgs,
  alertTargetsOf,
  alertIdOf,
  mailSlugOf,
  rtDeadlineTargetsOf,
  alertBodyOf,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
