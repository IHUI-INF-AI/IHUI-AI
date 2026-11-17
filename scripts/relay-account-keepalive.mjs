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
 *  - 喊人是双向的(2026-11-16):掉线/摘除 ⇒ warning 告警(relay-keepalive-*);
 *    「巡检前还在告警集合、巡检后退出」⇒ info 复活通知(relay-keepalive-revival-*)。
 *    两把身份前缀不同,互不顶掉去重窗;复活判据复用同一个 alertTargetsOf,零第二份口径。
 *  - 喊人的身份 = provider + uid 前缀,不含计数/时刻/异常原文(守门 224:抖动进身份 = 每轮一封信)。
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolveTsxCli } from './lib/tsx-cli.mjs'
// 产物陈旧自检(2026-11-09):本脚本经 tsx 消费 @ihui/api-client 的新导出,先提示 dist 陈旧
import { assertDistFresh } from './lib/dist-freshness.mjs'
// 进程探测单源在两条回灌腿里(§0.6):这里复用同两把,不在本文件重抄 tasklist 判据
import { probeClientActive as probeTraeClientActive } from './sync-trae-client-session.mjs'
import { probeMinimaxClientActive } from './sync-minimax-client-session.mjs'
import { __test__ as qoderSessionSync } from './sync-qoder-client-session.mjs'
// 商店号清单判据单源(§0.6):与容量哨兵共用同一装载器(读 store-platforms.ts 源文件求值),
// 不在本文件写死 provider code。这些运营池/应用上架号被设计性 temp_unschedulable 摘除,
// 保活续期照常,但不该被喊成「调度掉线」。
import { loadStoreProviderCodes } from './check-relay-capacity-zero.mjs'

const probeQoderClientActive = qoderSessionSync.probeQoderClientActive

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
assertDistFresh(path.join(ROOT, 'packages', 'api-client'))
const API_DIR = path.join(ROOT, 'apps', 'api')
const KEEPALIVE_TS = path.join(API_DIR, 'scripts', 'relay-account-keepalive.ts')
const MAIL_SCRIPT = path.join(API_DIR, 'scripts', 'notify-deploy-failure.ts')
const TMP_DIR = path.join(ROOT, '.ihui-agent', 'tmp', 'relay-account-keepalive')

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
 *
 * `excludeProviders`(商店号清单,与生产 `loadRelayPoolRows` 同源)里的 provider 被排除:
 * 它们是运营池/应用上架账号,`seedStoreAccounts` 刻意写 `temp_unschedulable=true` +
 * `healthStatus='unknown'`,续期保活照常,但**设计上不参与 AI 调度** ⇒ 摘除是正确态,
 * 不是掉线。省略该参数 = 不过滤(向后兼容测试与旧调用者)。
 */
export function alertTargetsOf(keepAlive, excludeProviders = []) {
  const rows = Array.isArray(keepAlive) ? keepAlive : []
  const ex = new Set(Array.isArray(excludeProviders) ? excludeProviders : [])
  return rows.filter(
    (r) =>
      r &&
      !ex.has(r.providerCode) &&
      (r.tempUnschedulable === true || r.healthStatus === 'down'),
  )
}

/** 去重身份:provider + uid 前 8 位(稳定形态,不含会抖的量) */
export function alertIdOf(row) {
  return `relay-keepalive-${row.providerCode}-${String(row.uid).slice(0, 8)}`
}

/**
 * 复活判据(2026-11-16 补「喊人」的对称半格):机主此前只收到"死了"的通知、从没收到"活了",
 * 状态跃迁静默 ⇒ "为什么又死了"只能靠翻面板。这里把「巡检前快照还在喊人集合、巡现读已退出」
 * 的行如实报出来。
 *  - 判据单源:两侧"在不在喊人集合"一律复用 alertTargetsOf,不另起一套复活定义(§0.6);
 *  - 只在两侧快照出现同一行(id 相等)时才算复活;行消失(取消登记/出池)不算 —— 取消登记不是起死回生;
 *  - 任一侧取不到 ⇒ null(未判定):不发信,更不得把"没有 before"写成"本轮无复活"(§0.3,
 *    旧版 ts 产物不带 before 快照的混跑期就走这一档)。
 */
export function revivalTransitionsOf(before, after, excludeProviders = []) {
  if (!Array.isArray(before) || !Array.isArray(after)) return null
  const afterById = new Map(after.map((r) => [String(r.id), r]))
  const out = []
  for (const b of alertTargetsOf(before, excludeProviders)) {
    const a = afterById.get(String(b.id))
    if (!a) continue
    if (alertTargetsOf([a], excludeProviders).length === 0) out.push({ before: b, after: a })
  }
  return out
}

/** 复活去重身份:与告警前缀不同(两件事两种修法);provider + uid 前 8 位,零抖动量(守门 224) */
export function revivalAlertIdOf(row) {
  return `relay-keepalive-revival-${row.providerCode}-${String(row.uid).slice(0, 8)}`
}

/** 跑 ts 侧脚本;stdout 只取最后一枚可解析 JSON 行(db 连接等噪音不进结论) */
function runKeepaliveTs(argv) {
  const tsx = resolveTsxCli(ROOT)
  if (!tsx)
    return { code: 2, json: null, stderr: '', error: '未找到 tsx(apps/api/node_modules/tsx)' }
  // 临期窗口必须 ≥ 本腿节拍。90 分钟是按「1 小时成功节拍」算的(节拍 + 余量);
  // 2026-11-13 起**尊重外部显式值** —— git-guardian 的 alert 档节流是 6 小时,它会把
  // 本轮真实窗口传下来(否则两轮之间必然跨过到期点,短寿命号漏刷约 2 小时)。
  // 缺省仍 90 分钟(手工 --once / 非 guardian 派发)。判据仍只有调度层一份。
  const aheadRaw = String(process.env.RELAY_ACCOUNT_REFRESH_AHEAD_MS ?? '').trim()
  const aheadNum = Number(aheadRaw)
  const aheadMs =
    aheadRaw !== '' && Number.isFinite(aheadNum) && aheadNum > 0 ? aheadNum : 90 * 60 * 1000
  const r = spawnSync(process.execPath, [tsx, KEEPALIVE_TS, ...argv], {
    cwd: API_DIR,
    windowsHide: true,
    // §12g:派生进程必须显式 stdio(不给 = 本机稳定 EBUSY)
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    timeout: 300_000,
    env: { ...process.env, RELAY_ACCOUNT_REFRESH_AHEAD_MS: String(aheadMs) },
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
function sendAlertMail(targets) {
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
    const msgFile = path.join(TMP_DIR, `alert-${alertIdOf(row)}.md`)
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
        alertIdOf(row),
        // 持续保活失败的账号每 6h 重报同一持续态(身份固定 = providerCode+uid),默认 4h 窗
        // 压不住 ⇒ 24h:每账号每天最多 1 封。正文仍逐条给健康/token/refresh/错误;
        // 账号恢复后本去重自然不再触发。仅治重报节奏,severity/判据一字未动。
        '--dedupe-hours',
        '24',
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

/**
 * 复活通知发信。severity=info,同走唯一出口 notify-deploy-failure.ts(§5e/守门 81);
 * 去重身份 = relay-keepalive-revival-*,24h 窗(号反复好坏翻转也不刷屏;真恢复必有一封)。
 * 出口/tsx 不在位 ⇒ 报「未判定」,不冒充已发(§0.3)。返回投递枚数。
 */
function sendRevivalMail(transitions) {
  if (transitions.length === 0) return 0
  if (!fs.existsSync(MAIL_SCRIPT)) {
    process.stderr.write('⚠️ 复活邮件未判定:唯一出口不在位(notify-deploy-failure.ts)\n')
    return 0
  }
  const tsx = resolveTsxCli(ROOT)
  if (!tsx) {
    process.stderr.write('⚠️ 复活邮件未判定:未找到 tsx,出口无法执行\n')
    return 0
  }
  fs.mkdirSync(TMP_DIR, { recursive: true })
  let sent = 0
  for (const t of transitions) {
    const row = t.after
    const msgFile = path.join(TMP_DIR, `revival-${revivalAlertIdOf(row)}.md`)
    // 无 BOM UTF-8 正文(§5e:多行中文一律走 --message-file)
    fs.writeFileSync(
      msgFile,
      [
        `号池永久保活复活:${row.providerCode}/${row.uid}(${row.name ?? '-'})`,
        '',
        `本轮跃迁:健康 ${t.before.healthStatus} → ${row.healthStatus};摘除 ${t.before.tempUnschedulable ? '是' : '否'} → ${row.tempUnschedulable ? '是' : '否'}`,
        `token 到期: ${row.tokenExpiresAt ?? '-'};最近刷新: ${row.lastRefreshAt ?? '-'}`,
        `凭证代次 credVersion: ${t.before.credVersion ?? '?'} → ${row.credVersion ?? '?'}`,
        `此前告警期间的错误: ${String(t.before.lastErrorMessage ?? '-').slice(0, 200)}`,
        '',
        '这枚号已退出「需要喊人」集合,重新纳入续期调度;无需人工动作。',
        '若它再次掉线,会另收到「号池永久保活告警」(身份不同,不混发)。',
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
        `号池永久保活复活 ${row.providerCode}/${String(row.uid).slice(0, 8)}`,
        '--severity',
        'info',
        '--source',
        'relay-account-keepalive',
        '--alert-id',
        revivalAlertIdOf(row),
        '--dedupe-hours',
        '24',
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
        `⚠️ 复活邮件未送达(${revivalAlertIdOf(row)}):${String(r.stderr ?? '').slice(-200)}\n`,
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
  // 商店号清单失败方向 = 不过滤(多喊一次,§0.10):宁可误报也不静默漏掉真掉线。
  const storeCodes = await loadStoreProviderCodes()
  if (!storeCodes.ok) {
    process.stderr.write(`⚠️ 商店号清单未装载(${storeCodes.why})⇒ 本轮不排除,告警维持旧口径(多喊一次)\n`)
  }
  const exclude = storeCodes.ok ? storeCodes.codes : []
  const targets = alertTargetsOf(run.json?.keepAlive, exclude)
  let sent = 0
  if (targets.length > 0) {
    sent = sendAlertMail(targets)
    process.stderr.write(`保活告警:需喊人 ${targets.length} 枚,已投递 ${sent} 封\n`)
  }
  // 复活通知(2026-11-16):两侧读数都由 ts 侧同一把 listKeepAliveForever 现读(前=巡检前,
  // 后=巡检后);判据 = 上面同一个 alertTargetsOf。before 缺失 ⇒ null = 未判定,不冒充"无复活"。
  // state 词汇表刻意不动(guardian 按 ok/alert/undetermined 节流);复活只进附加键。
  const transitions = revivalTransitionsOf(
    Array.isArray(run.json?.keepAliveBefore) ? run.json.keepAliveBefore : null,
    Array.isArray(run.json?.keepAlive) ? run.json.keepAlive : null,
    exclude,
  )
  let recoveryMailed = 0
  if (transitions === null) {
    process.stderr.write('ℹ️ 复活通知未判定:汇总缺巡检前快照(keepAliveBefore),不冒充"无复活"\n')
  } else if (transitions.length > 0) {
    recoveryMailed = sendRevivalMail(transitions)
    process.stderr.write(
      `复活通知:退出喊人集合 ${transitions.length} 枚,已投递 ${recoveryMailed} 封\n`,
    )
  }
  // 结论行(ASCII 单行,供 git-guardian 判读):state 三态绝不并桶 ——
  // 汇总取不到 ⇒ undetermined,不得写成 ok(§0.3「没判」不写成「判过」)。
  const sweep = run.json?.sweep ?? null
  const state = !run.json || !sweep ? 'undetermined' : targets.length > 0 ? 'alert' : 'ok'
  process.stdout.write(
    `KEEPALIVE-RESULT state=${state}` +
      ` registered=${Array.isArray(run.json?.keepAlive) ? run.json.keepAlive.length : '?'}` +
      ` refreshed=${sweep?.refreshed ?? '?'} refreshFailed=${sweep?.refreshFailed ?? '?'}` +
      ` keepalive=${sweep?.keepalive ?? '?'} heartbeat=${run.json?.heartbeated ?? '?'}` +
      ` foreverDeferred=${sweep?.foreverDeferred ?? '?'}` +
      ` alerts=${targets.length} mailed=${sent}` +
      ` recovered=${transitions === null ? '?' : transitions.length} recoveryMailed=${transitions === null ? '?' : recoveryMailed}\n`,
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
  revivalTransitionsOf,
  revivalAlertIdOf,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
