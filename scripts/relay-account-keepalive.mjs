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
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolveTsxCli } from './lib/tsx-cli.mjs'
// 产物陈旧自检(2026-11-09):本脚本经 tsx 消费 @ihui/api-client 的新导出,先提示 dist 陈旧
import { assertDistFresh } from './lib/dist-freshness.mjs'
// 进程探测单源在两条回灌腿里(§0.6):这里复用同两把,不在本文件重抄 tasklist 判据
import { probeClientActive as probeTraeClientActive } from './sync-trae-client-session.mjs'
import { probeMinimaxClientActive } from './sync-minimax-client-session.mjs'
import { __test__ as qoderSessionSync } from './sync-qoder-client-session.mjs'

const probeQoderClientActive = qoderSessionSync.probeQoderClientActive

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
assertDistFresh(path.join(ROOT, 'packages', 'api-client'))
const API_DIR = path.join(ROOT, 'apps', 'api')
const KEEPALIVE_TS = path.join(API_DIR, 'scripts', 'relay-account-keepalive.ts')
const MAIL_SCRIPT = path.join(API_DIR, 'scripts', 'notify-deploy-failure.ts')
const TMP_DIR = path.join(ROOT, '.ihui-agent', 'tmp', 'relay-account-keepalive')
// 发信台账的唯一出口(notify-deploy-failure.ts)落点;与它同读 IHUI_MAIL_SEND_LEDGER 覆盖。
// 本层只读这本来判「这枚判死号是否已一次性通知过」,不另建第二本状态账(§5e-3)。
const MAIL_LEDGER_FILE =
  String(process.env.IHUI_MAIL_SEND_LEDGER || '').trim() ||
  path.join(ROOT, '.ihui-agent', 'state', 'mail-send-ledger.jsonl')

const USAGE =
  '用法: node scripts/relay-account-keepalive.mjs --status|--mark <uid> [--provider trae] [--off]|--once|--explain <uid> [--json]\n' +
  '  --once/--explain 会先当场探测各平台客户端三态再派发(C 档 2026-11-10,探测单源在回灌腿)\n'

/** 透传参数面:只认这三组动词,其余原样交给 ts 侧判(未知参数由它报「未判定」) */
export function parseArgs(argv) {
  const options = { help: false, once: false }
  for (const a of argv) {
    if (a === '--help' || a === '-h') options.help = true
    else if (a === '--once') options.once = true
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

/** 去重身份:provider + uid 前 8 位(稳定形态,不含会抖的量) */
export function alertIdOf(row) {
  return `relay-keepalive-${row.providerCode}-${String(row.uid).slice(0, 8)}`
}

// ── 缺陷③:上游「不可逆判死码」单一真相源(2026-11-15 立) ────────────────────────────
// 本文件内一处定义/导出,供本链与后续复用(§0.6:判据不许两处各抄一份)。命中即「上游已
// 明确判死」,不是「本轮抖动」—— 残票不该再每 6h 撞一次上游鉴权、也不该每 24h 再喊一封。
// 只认上游当场写进 lastErrorMessage 的硬拒收信号;5xx / 网络超时 / 普通 down / 裸 401
// 一律不算判死(反向牙:别一刀切把所有失败都静默掉)。
// §0.6 判据单源(2026-11-15 下沉):清单搬到 config/relay-irreversible-verdicts.json,
// 本文件与 ts 侧(scheduler)都从这份语言无关数据编译 RegExp —— 正则字面量全仓只此一份。
// Object.freeze(数组 + 每个元素) 与 pattern instanceof RegExp 的既有形态一字不动。
// 清单现为 3 条(2026-11-15 移除 doubao-712012001):doubao-adapter.ts:220-225 有代码级硬
// 反例 —— `712012001 登录校验不合法` 可能只是 ttwid 票被错套成 sessionid 键名,同一枚票
// 改键名后 status_code=0 判活通过,根本不是账号死亡;且 doubao 的 isRefreshableProviderCode
// 恒 false(空壳),移除后不会退回「拿死票空撞刷新」的循环。理由只写在两侧消费端注释与
// 提交信息里,不进 config JSON(它是纯数据)。加载逻辑 / alertPlanFor 三分支 / 去重常量不动。
const IRREVERSIBLE_VERDICTS_JSON = new URL(
  '../config/relay-irreversible-verdicts.json',
  import.meta.url,
)
export const IRREVERSIBLE_VERDICTS = Object.freeze(
  JSON.parse(fs.readFileSync(IRREVERSIBLE_VERDICTS_JSON, 'utf8')).map((v) =>
    Object.freeze({ id: v.id, provider: v.provider, pattern: new RegExp(v.pattern, v.flags ?? '') }),
  ),
)

/** 命中的判死码 id;未命中(可逆失败/无错误信息)返回 null。同时兼容 snake/camel 两种字段名。 */
export function irreversibleVerdictOf(row) {
  const msg = String(row?.lastErrorMessage ?? row?.last_error_message ?? '')
  if (!msg) return null
  for (const v of IRREVERSIBLE_VERDICTS) {
    if (v.pattern.test(msg)) return v.id
  }
  return null
}

export function isTerminalFailure(row) {
  return irreversibleVerdictOf(row) !== null
}

// 既有语义常量(不容散落第二份):
//  - 可逆失败:24h 告警去重 + 6h 解摘再试(scheduler.reviveKeepAliveForeverAccounts 的既有节拍);
//  - 判死:降级为「一次性通知/静默」—— 首封走超长去重窗(寄一次后窗口内恒 suppressed),
//    已通知过则本轮直接跳过(不再撞上游、不再重喊)。
export const ALERT_DEDUPE_HOURS = 24
export const REVIVE_BACKOFF_HOURS = 6
export const TERMINAL_ONCE_DEDUPE_HOURS = 24 * 365 * 10

/**
 * 一枚待喊人的号的「本轮计划」(纯函数,单测直接 import 生产实现)。
 * 关键是区分【可逆失败】与【上游已判死】,别把所有失败一刀切静默:
 *  - reversible:retry 照旧 —— dedupeHours=24、keepRevive=true、reviveBackoffHours=6
 *    (6h 后自动解摘再试的既有语义对可逆失败完全保留,一字未动);
 *  - terminal 且从未通知过:mode='once',发一次性通知(超长窗,首封即最后一封);
 *  - terminal 且已通知过:mode='silent',skipThisRound=true —— 跳过本轮保活重试与喊人。
 */
export function alertPlanFor(row, { alreadyNotified = false } = {}) {
  const verdictId = irreversibleVerdictOf(row)
  if (verdictId === null) {
    return {
      verdict: 'reversible',
      verdictId: null,
      skipThisRound: false,
      keepRevive: true,
      reviveBackoffHours: REVIVE_BACKOFF_HOURS,
      dedupeHours: ALERT_DEDUPE_HOURS,
      mode: 'recurring',
    }
  }
  if (alreadyNotified) {
    return {
      verdict: 'terminal',
      verdictId,
      skipThisRound: true,
      keepRevive: false,
      reviveBackoffHours: null,
      dedupeHours: null,
      mode: 'silent',
    }
  }
  return {
    verdict: 'terminal',
    verdictId,
    skipThisRound: false,
    keepRevive: false,
    reviveBackoffHours: null,
    dedupeHours: TERMINAL_ONCE_DEDUPE_HOURS,
    mode: 'once',
  }
}

/** 台账里该 alertId 是否曾真实 delivered(供判死号「已通知过 → 静默」判定)。坏行跳过。 */
export function hasDeliveredNotice(ledgerText, alertId) {
  for (const line of String(ledgerText ?? '').split(/\r?\n/)) {
    if (!line || !line.includes(alertId)) continue
    try {
      const row = JSON.parse(line)
      if (row.alertId === alertId && row.disposition === 'delivered') return true
    } catch {
      /* 半行 / 坏行:不冒充没判过,继续找 */
    }
  }
  return false
}

// ── 缺陷②:Windows 临时正文文件名净化(2026-11-15 立) ──────────────────────────────
// uid 形如 `auto:f15` 时 alertId 含半角冒号,`alert-${id}.md` 在 NTFS 上被读成备用数据流,
// 留下 0 字节主名文件。净化只作用于**文件名**;--alert-id 逻辑身份保持原样(改它 = 去重漂移)。
const WIN_ILLEGAL = /[<>:"/\\|?*\x00-\x1f]/g

/** 把 Windows 文件名非法字符(含冒号)换成下划线;合法字符原样保留,幂等。 */
export function sanitizeFileStem(s) {
  return String(s ?? '').replace(WIN_ILLEGAL, '_')
}

/**
 * 安全且可去重的临时正文文件名:净化后的 stem + 原始 alertId 的 sha256 前缀。
 * 哈希基于**原始** id ⇒ 即便两个不同告警净化后 stem 相同(如 `auto:f15`/`auto?f15` 都成
 * `auto_f15`),文件名也必不相同(不撞名);同一 id 恒得同一名(幂等);哈希本身即去重键。
 */
export function safeAlertFileName(alertId) {
  const id = String(alertId ?? '')
  const stem = sanitizeFileStem(id)
  const digest = createHash('sha256').update(id, 'utf8').digest('hex').slice(0, 12)
  return `alert-${stem}-${digest}.md`
}

// ── 缺陷①:投递口径与台账一致(2026-11-15 立) ─────────────────────────────────────
// 出口对「已按标识去重压住」与「真投递」的退出码同为 0,仅 stdout 的机器可读标记能区分。
// 旧版只认 status===0 ⇒ 把 8 条 suppressed 全记成 mailed=8(违反「没判不写成判过」铁律)。
/** 从出口 stdout 解析真实处置:delivered / suppressed / undetermined(取不到标记绝不冒充送达)。 */
export function dispositionOf(stdout) {
  const m = String(stdout ?? '').match(/__DISPOSITION__=(delivered|suppressed)\b/)
  return m ? m[1] : 'undetermined'
}

/** 分别统计 delivered / suppressed / failed / undetermined / skipped,不得并桶。 */
export function tallyMailOutcomes(dispositions) {
  const t = { delivered: 0, suppressed: 0, failed: 0, undetermined: 0, skipped: 0 }
  for (const d of dispositions) {
    if (d === 'delivered') t.delivered++
    else if (d === 'suppressed') t.suppressed++
    else if (d === 'failed') t.failed++
    else if (d === 'skipped') t.skipped++
    else t.undetermined++
  }
  return t
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
    // 临期窗口必须 ≥ 本腿节拍(git-guardian 每 1 小时派发):默认 15 分钟窗口只服务
    // 「api 常驻 + 5 分钟一轮」,搬到 1 小时节拍上会让到期点落在两轮之间。90 分钟 = 节拍 + 余量;
    // 判据仍只有调度层一份(RELAY_ACCOUNT_REFRESH_AHEAD_MS),本层只给值不复算。
    env: { ...process.env, RELAY_ACCOUNT_REFRESH_AHEAD_MS: String(90 * 60 * 1000) },
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
function sendAlertMail(targets, { ledgerText = '' } = {}) {
  const empty = () => tallyMailOutcomes([])
  if (targets.length === 0) return empty()
  if (!fs.existsSync(MAIL_SCRIPT)) {
    process.stderr.write('⚠️ 保活邮件未判定:唯一出口不在位(notify-deploy-failure.ts)\n')
    return empty()
  }
  const tsx = resolveTsxCli(ROOT)
  if (!tsx) {
    process.stderr.write('⚠️ 保活邮件未判定:未找到 tsx,出口无法执行\n')
    return empty()
  }
  fs.mkdirSync(TMP_DIR, { recursive: true })
  const dispositions = []
  for (const row of targets) {
    const id = alertIdOf(row)
    const plan = alertPlanFor(row, { alreadyNotified: hasDeliveredNotice(ledgerText, id) })
    // 缺陷③:上游已判死且已一次性通知过 ⇒ 跳过本轮保活重试与喊人(不再撞鉴权点、不再每 24h 重喊)。
    // 可逆失败 skipThisRound 恒 false ⇒ 6h 解摘再试的既有语义一字未动。
    if (plan.skipThisRound) {
      dispositions.push('skipped')
      process.stderr.write(`保活告警: ${id} 上游已判死(${plan.verdictId})且已通知 ⇒ 本轮静默跳过\n`)
      continue
    }
    // 缺陷②:文件名净化(冒号 → 下划线)+ 原文哈希去重;--alert-id 逻辑身份保持原样。
    const msgFile = path.join(TMP_DIR, safeAlertFileName(id))
    // 无 BOM UTF-8 正文(§5e:多行中文一律走 --message-file)
    fs.writeFileSync(
      msgFile,
      [
        `号池永久保活告警:${row.providerCode}/${row.uid}(${row.name ?? '-'})`,
        '',
        `健康状态: ${row.healthStatus}`,
        `自动摘除: ${row.tempUnschedulable ? '是' : '否'}`,
        `token 到期: ${row.tokenExpiresAt ?? '-'}`,
        `refreshToken 到期: ${row.refreshExpiresAt ?? '-'}`,
        `最近刷新: ${row.lastRefreshAt ?? '-'}`,
        `最近错误: ${row.lastErrorMessage ?? '-'}`,
        '',
        '这枚号已登记永久保活(掉线无法靠验证码重登,只能靠号池 + 一键切号)。',
        '摘除态会在退避窗口后被自动解摘并重试;若持续失败,请人工核对上游凭据是否已被回收。',
        '复核出口: node scripts/relay-account-keepalive.mjs --status',
      ].join('\n'),
      'utf8',
    )
    const r = spawnSync(
      process.execPath,
      [
        tsx,
        MAIL_SCRIPT,
        '--title',
        `号池永久保活告警 ${row.providerCode}/${String(row.uid).slice(0, 8)}`,
        '--severity',
        'warning',
        '--source',
        'relay-account-keepalive',
        '--alert-id',
        id,
        // 可逆失败:持续态每 6h 重报,默认 4h 窗压不住 ⇒ 24h(每账号每天最多 1 封),既有值不动;
        // 判死首封:超长窗 ⇒ 寄一次后窗口内恒 suppressed(一次性通知),不再每 24h 放行。
        '--dedupe-hours',
        String(plan.dedupeHours),
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
    // 缺陷①:以出口 stdout 的处置标记为准。suppressed 与 delivered 退出码同为 0,
    // 只认 status===0 就会把「已抑制未寄」写成「已送达」(违反 §0.3「没判不写成判过」)。
    const disposition = dispositionOf(r.stdout)
    if (disposition === 'undetermined') {
      // 取不到标记 ⇒ 非 0 记 failed;0 也只记 undetermined,绝不冒充送达。
      dispositions.push(r.status === 0 ? 'undetermined' : 'failed')
    } else {
      dispositions.push(disposition)
    }
    if (disposition !== 'delivered' && r.status !== 0)
      process.stderr.write(`⚠️ 保活邮件未送达(${id}):${String(r.stderr ?? '').slice(-200)}\n`)
  }
  return tallyMailOutcomes(dispositions)
}

async function main(argv) {
  const parsed = parseArgs(argv)
  if (parsed.help) {
    process.stdout.write(USAGE)
    return 0
  }
  const childArgv = [...argv]
  // C 档(2026-11-10):接管前当场再探测一次 —— --once 的 sweep 与 --explain 的"为什么没刷"
  // 都要吃这份三态。探测器单源在两条回灌腿里(§0.6),本层只搬运、不复算;一次探测两处用,
  // 绝不同轮探两次(两次读数不一致 = 判据面自己打架)。
  const probing = parsed.once || argv.includes('--explain')
  if (probing) {
    const probed = [
      ['trae', probeTraeClientActive()],
      ['qoder', probeQoderClientActive()],
      // minimax(2026-11-10 补):探测器早就导出在回灌腿里,却没接进来 ⇒ 该平台永久判「未判定」
      // ⇒ 永久让位 ⇒ 永不续期。现读:池内 minimax forever 号 access token 今天 22:11 到期,
      // 而它的探针一旦缺席就等于「登记了永久保活却没人续」。
      ['minimax', probeMinimaxClientActive()],
    ]
    for (const [provider, active] of probed) {
      const word = active === null ? 'unknown' : active ? 'running' : 'stopped'
      childArgv.push('--client-probe', `${provider}=${word}`)
    }
    process.stderr.write(
      `客户端探测: ${probed
        .map(
          ([p, a]) => `${p}=${a === null ? '未知(按在跑处理,不让池接管)' : a ? '在跑' : '未运行'}`,
        )
        .join(' ')}\n`,
    )
    if (parsed.once) {
      // 心跳在同一份探测结果上折算(不交给池里那条旧心跳):这条腿的存在前提是「api 不在也能
      // 保活」,api 一挂池内旧心跳必然陈旧。未知(null)与在跑(true)同向送心跳 —— 误判「在跑」
      // 只是本轮少刷一次,误判「静默」是不可逆的掉线,代价不对称。
      const at = new Date().toISOString()
      for (const [provider, active] of probed) {
        if (active !== false) childArgv.push('--client-active', `${provider}=${at}`)
      }
    }
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
  let mail = tallyMailOutcomes([])
  if (targets.length > 0) {
    let ledgerText = ''
    try {
      ledgerText = fs.readFileSync(MAIL_LEDGER_FILE, 'utf8')
    } catch {
      /* 台账不在位 = 按「没通知过」处理:判死号仍发一次性通知,绝不静默吞掉首封 */
    }
    mail = sendAlertMail(targets, { ledgerText })
    process.stderr.write(
      `保活告警:需喊人 ${targets.length} 枚,已送达 ${mail.delivered} 封,已抑制 ${mail.suppressed} 封,` +
        `判死跳过 ${mail.skipped} 枚\n`,
    )
  }
  const terminalCount = targets.filter(isTerminalFailure).length
  // 结论行(ASCII 单行,供 git-guardian 判读):state 三态绝不并桶 ——
  // 汇总取不到 ⇒ undetermined,不得写成 ok(§0.3「没判」不写成「判过」)。
  // mailed 只计 delivered(与台账口径一致),suppressed/failed/undetermined/terminal 各自单列,
  // 不再把「已抑制未寄」并进 mailed(缺陷①)。
  const sweep = run.json?.sweep ?? null
  const state = !run.json || !sweep ? 'undetermined' : targets.length > 0 ? 'alert' : 'ok'
  process.stdout.write(
    `KEEPALIVE-RESULT state=${state}` +
      ` registered=${Array.isArray(run.json?.keepAlive) ? run.json.keepAlive.length : '?'}` +
      ` refreshed=${sweep?.refreshed ?? '?'} refreshFailed=${sweep?.refreshFailed ?? '?'}` +
      ` keepalive=${sweep?.keepalive ?? '?'} heartbeat=${run.json?.heartbeated ?? '?'}` +
      ` foreverDeferred=${sweep?.foreverDeferred ?? '?'}` +
      ` alerts=${targets.length} mailed=${mail.delivered}` +
      ` delivered=${mail.delivered} suppressed=${mail.suppressed}` +
      ` failed=${mail.failed} undetermined=${mail.undetermined} terminal=${terminalCount}\n`,
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
  // 缺陷①:投递口径
  dispositionOf,
  tallyMailOutcomes,
  // 缺陷②:文件名净化
  sanitizeFileStem,
  safeAlertFileName,
  // 缺陷③:判死码单一真相源与告警计划
  IRREVERSIBLE_VERDICTS,
  irreversibleVerdictOf,
  isTerminalFailure,
  alertPlanFor,
  hasDeliveredNotice,
  ALERT_DEDUPE_HOURS,
  REVIVE_BACKOFF_HOURS,
  TERMINAL_ONCE_DEDUPE_HOURS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
