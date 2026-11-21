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
 *  - 喊人的双向(2026-11-16):掉线/摘除 ⇒ warning 告警(relay-keepalive-*);
 *    「巡检前还在告警集合、巡检后退出」⇒ info 复活通知(relay-keepalive-revival-*)。
 *    两把身份前缀不同,互不顶掉去重窗;复活判据复用同一个 alertTargetsOf,零第二份口径。
 *  - 喊人的身份 = provider + uid 前缀,不含计数/时刻/异常原文(守门 224:抖动进身份 = 每轮一封信)。
 *  - **重复节奏按「收信人还能做什么」分层(2026-11-21 立,机主第三次报"一直轰炸")**:
 *    判死留痕(extraMetadata.terminalVerdict)存在 ⇒ 上游已判不可逆、判死闸门让它永不重试,
 *    人只有两条路(换凭据 / 摘号) ⇒ `TERMINAL_REPEAT_HOURS`(30 天)低频体检式提醒,不再按天重播;
 *    没有判死留痕 ⇒ 6h 后会被自动解摘重试,机器自治 ⇒ `SELFHEAL_REPEAT_HOURS`(7 天)知会一次。
 *    身份与射程一字未动:静音靠"同一身份 + 更长窗口",不是靠"把号移出告警集合"(§0.10 不跳门)。
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
 * 判死态的重复播报窗口(小时,30 天)。判死 = 上游已明确判不可逆
 * (config/relay-irreversible-verdicts.json),判死闸门让这号**永不重试**,人只有两条路:
 * 换凭据(credVersion 前进才放行解摘)或从池里摘掉。同一件事 30 天内不必重播 ——
 * 收信人第一次收到时信息已经完整,按天重播只是噪声(§5e-1 可整改性准入)。
 */
export const TERMINAL_REPEAT_HOURS = 720
/**
 * 非判死态的重复播报窗口(小时,7 天)。这类号被连续失败摘除后,6h 退避窗一到会被自动解摘
 * 重试(KEEPALIVE_FOREVER_REVIVE_BACKOFF_HOURS),属机器自治范围;人只需要低频知会,
 * 因此不进"每轮一封信"的节奏,也不移出告警集合(§0.10:失效方向不许是跳门)。
 *
 * 旧口径 24h 是 2026-11 上一版为"持续失败每 6h 重报"打的补丁;实测仍每天 5 封以上
 * (判死号 × 24h 窗 × 6h 节拍),故按上面两层重定。
 */
export const SELFHEAL_REPEAT_HOURS = 168

/**
 * 这条告警该用多长的重复窗口。判据只看"有没有判死留痕",不看计数/时刻:
 *  - 有留痕(且形状完整)⇒ 终态 ⇒ TERMINAL_REPEAT_HOURS;
 *  - 无留痕 / 留痕坏 / 旧 ts 产物不带此字段 ⇒ 自救态 ⇒ SELFHEAL_REPEAT_HOURS
 *    (失效方向 = 多提醒一次,不是跳门)。
 */
export function repeatHoursOf(row) {
  const v = row && row.terminalVerdict
  const ok = v && typeof v === 'object' && typeof v.id === 'string' && v.id !== ''
  return ok ? TERMINAL_REPEAT_HOURS : SELFHEAL_REPEAT_HOURS
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
 * 出口处置标记的判读(2026-11-21 修):出口对「被 --alert-id 窗口压住」也返回 exit 0,
 * 旧实现用 `r.status === 0` 数「已投递」⇒ 每轮把 6 枚被压住的号报成"已投递 6 封"
 * (§0.3:没寄不许写成寄过)。唯一判据是出口自己打的 `__DISPOSITION__=...` 令牌。
 */
function dispositionOf(stdout) {
  const s = String(stdout ?? '')
  if (s.includes('__DISPOSITION__=delivered')) return 'delivered'
  if (s.includes('__DISPOSITION__=suppressed')) return 'suppressed'
  return null
}

/**
 * 到人通知。出口不在位/投递失败 ⇒ 只报「未判定/未送达」,不冒充已发(§0.3)。
 * 返回 { sent: 真投递枚数, suppressed: 被同身份窗口压住的枚数 };两者的判据只在出口的处置标记上。
 */
function sendAlertMail(targets) {
  const tally = { sent: 0, suppressed: 0 }
  if (targets.length === 0) return tally
  if (!fs.existsSync(MAIL_SCRIPT)) {
    process.stderr.write('⚠️ 保活邮件未判定:唯一出口不在位(notify-deploy-failure.ts)\n')
    return tally
  }
  const tsx = resolveTsxCli(ROOT)
  if (!tsx) {
    process.stderr.write('⚠️ 保活邮件未判定:未找到 tsx,出口无法执行\n')
    return tally
  }
  fs.mkdirSync(TMP_DIR, { recursive: true })
  for (const row of targets) {
    const msgFile = path.join(TMP_DIR, `alert-${alertIdOf(row)}.md`)
    const verdict = row.terminalVerdict && row.terminalVerdict.id ? row.terminalVerdict : null
    // 无 BOM UTF-8 正文(§5e:多行中文一律走 --message-file)
    fs.writeFileSync(
      msgFile,
      [
        `号池永久保活告警:${row.providerCode}/${row.uid}(${row.name ?? '-'})`,
        '',
        `健康状态: ${row.healthStatus}`,
        `自动摘除: ${row.tempUnschedulable ? '是' : '否'}`,
        `判死: ${verdict ? `是(码 ${verdict.id},判于 ${verdict.at},当时凭据代次 ${verdict.credVersion})` : '否'}`,
        `token 到期: ${row.tokenExpiresAt ?? '-'}`,
        `refreshToken 到期: ${row.refreshExpiresAt ?? '-'}`,
        `最近刷新: ${row.lastRefreshAt ?? '-'}`,
        `最近错误: ${row.lastErrorMessage ?? '-'}`,
        '',
        '这枚号已登记永久保活(掉线无法靠验证码重登,只能靠号池 + 一键切号)。',
        verdict
          ? `上游已判不可逆(命中判死码 ${verdict.id}),判死闸门不会再拿死票去撞上游 —— 这号不会自己活过来。` +
            '需要你二选一:① 补一张新凭据(导入或客户端重新登录后回灌,凭据代次前进才会自动解摘);' +
            '② 确认已放弃 ⇒ node scripts/relay-account-keepalive.mjs --mark ' +
            row.uid +
            ' --provider ' +
            row.providerCode +
            ' --off(取消永久保活登记,号仍留在池内可审计)。' +
            '本条 30 天内最多再提醒一次。'
          : '本轮是连续失败后的自动摘除,6 小时退避窗一到会解摘重试;若能自愈则无需任何动作。' +
            '持续失败才会升级成判死码。人工核对凭据只能靠上面的错误原文判断,本条 7 天内最多再提醒一次。',
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
        // 重复节奏按终态分层(2026-11-21):判死 ⇒ 30 天;退避自救中 ⇒ 7 天。
        // 旧的 24h 是"每 6h 重报同一持续态"的补丁,实测仍每天 5 封以上 ⇒ 用户报"一直轰炸"。
        // 身份一字未动(守门 224),只拉长窗口 —— 迁移期靠一次性把同身份旧键 winMs 抬到新窗口,
        // 这样下一轮立即静默,而不是 48h 后逐出旧键再补发一轮。
        '--dedupe-hours',
        String(repeatHoursOf(row)),
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
    const disp = dispositionOf(r.stdout)
    if (disp === 'delivered') tally.sent++
    else if (disp === 'suppressed') tally.suppressed++
    else
      process.stderr.write(
        `⚠️ 保活邮件未判定(${alertIdOf(row)}):出口未给出处置标记(status=${r.status}) ${String(r.stderr ?? '').slice(-200)}\n`,
      )
  }
  return tally
}

/**
 * 复活通知发信。severity=info,同走唯一出口 notify-deploy-failure.ts(§5e/守门 81);
 * 去重身份 = relay-keepalive-revival-*,24h 窗(号反复好坏翻转也不刷屏;真恢复必有一封)。
 * 出口/tsx 不在位 ⇒ 报「未判定」,不冒充已发(§0.3)。返回 { sent, suppressed }。
 */
function sendRevivalMail(transitions) {
  const tally = { sent: 0, suppressed: 0 }
  if (transitions.length === 0) return tally
  if (!fs.existsSync(MAIL_SCRIPT)) {
    process.stderr.write('⚠️ 复活邮件未判定:唯一出口不在位(notify-deploy-failure.ts)\n')
    return tally
  }
  const tsx = resolveTsxCli(ROOT)
  if (!tsx) {
    process.stderr.write('⚠️ 复活邮件未判定:未找到 tsx,出口无法执行\n')
    return tally
  }
  fs.mkdirSync(TMP_DIR, { recursive: true })
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
    const disp = dispositionOf(r.stdout)
    if (disp === 'delivered') tally.sent++
    else if (disp === 'suppressed') tally.suppressed++
    else
      process.stderr.write(
        `⚠️ 复活邮件未判定(${revivalAlertIdOf(row)}):出口未给出处置标记(status=${r.status}) ${String(r.stderr ?? '').slice(-200)}\n`,
      )
  }
  return tally
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
  let suppressed = 0
  if (targets.length > 0) {
    const m = sendAlertMail(targets)
    sent = m.sent
    suppressed = m.suppressed
    process.stderr.write(
      `保活告警:需喊人 ${targets.length} 枚,真投递 ${sent} 封,同身份窗口内压住 ${suppressed} 封\n`,
    )
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
  let recoverySuppressed = 0
  if (transitions === null) {
    process.stderr.write('ℹ️ 复活通知未判定:汇总缺巡检前快照(keepAliveBefore),不冒充"无复活"\n')
  } else if (transitions.length > 0) {
    const m = sendRevivalMail(transitions)
    recoveryMailed = m.sent
    recoverySuppressed = m.suppressed
    process.stderr.write(
      `复活通知:退出喊人集合 ${transitions.length} 枚,真投递 ${recoveryMailed} 封,窗口内压住 ${recoverySuppressed} 封\n`,
    )
  }
  // 结论行(ASCII 单行,供 git-guardian 判读):state 三态绝不并桶 ——
  // 汇总取不到 ⇒ undetermined,不得写成 ok(§0.3「没判」不写成「判过」)。
  const sweep = run.json?.sweep ?? null
  const state = !run.json || !sweep ? 'undetermined' : targets.length > 0 ? 'alert' : 'ok'
  // 判死/自救分层计数(2026-11-21):state 词汇表不动(guardian 按 ok/alert/undetermined 节流),
  // 分层只进附加键 —— 让运维在日志里就能看出"还有几枚是终态",不必翻台账。
  const terminalCount = targets.filter((t) => repeatHoursOf(t) === TERMINAL_REPEAT_HOURS).length
  process.stdout.write(
    `KEEPALIVE-RESULT state=${state}` +
      ` registered=${Array.isArray(run.json?.keepAlive) ? run.json.keepAlive.length : '?'}` +
      ` refreshed=${sweep?.refreshed ?? '?'} refreshFailed=${sweep?.refreshFailed ?? '?'}` +
      ` keepalive=${sweep?.keepalive ?? '?'} heartbeat=${run.json?.heartbeated ?? '?'}` +
      ` foreverDeferred=${sweep?.foreverDeferred ?? '?'}` +
      ` alerts=${targets.length} terminal=${terminalCount} mailed=${sent} suppressed=${suppressed}` +
      ` recovered=${transitions === null ? '?' : transitions.length} recoveryMailed=${transitions === null ? '?' : recoveryMailed}` +
      ` recoverySuppressed=${transitions === null ? '?' : recoverySuppressed}\n`,
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
  repeatHoursOf,
  revivalTransitionsOf,
  revivalAlertIdOf,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
