// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * lint-staged-pin-audit.mjs — 「lint-staged stdio 三针」盯针的**常驻派发实现**(2026-10-27 立)。
 *
 * 票面:`lint-staged stdio 三针补丁打在 node_modules 内,重装依赖即失效且无人盯`(PROJECT_PLAN,归 pre-commit
 * 钩子持有人)。三针由 `scripts/lib/patch-lint-staged-stdio.mjs` 写进 node_modules 里,postinstall 不重打、
 * 也没有任何调度器盯 ⇒ 一次 `pnpm install` 就把 G-53/G-63 刚消解的 lint-staged 死法放回原状,而**失效方向是安静的**
 * (钩子照跑,只在下次提交时以 errno 面目复现)。
 *
 * 分工(§0.6 单一真相源,本文件**不含任何判据**):
 *   · 判"针在不在"  = `scripts/check-lint-staged-stdio-pin.mjs`(--check 三档,0 齐 / 1 缺口 / 2 未判定);
 *   · 节流 / 分档 / 到人 = 本文件;
 *   · 调度 = `scripts/git-guardian.mjs` 的 `auditLintStagedPins()`,挂点与 `auditOpsPatrol` 同一处
 *     (main() 单轮 + daemon tick)。判的是**机器状态**⇒ 按 §12e 绝不进提交链:重装依赖后、有人重打前,
 *     挂 blocking 会把与本次提交无关的红天天推给提交者 = 恒红门 = 逼人 `--no-verify`。
 *
 * 三档(§0.3:没判不许写成判过,也不许冒红):
 *   · green      ⇒ 一行健康日志(节流已限频),不喊人;
 *   · gap        ⇒ 逐条点名缺哪一针 + `notifyGuardRed`(身份是常量、不带计数,§5e-1);
 *   · undetermined ⇒ 只写日志并点名原因,**不喊人**(与 auditOpsPatrol 的未判定同规矩)。
 * 尺子脚本不在位 ⇒ `{ ran: false }` 并写一行「跳过,不记为已巡检」(失效方向 = 多要一次定向说明,§0.10)。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** 尺子落点(相对本文件所在的 `scripts/lib/` 的上一级)。 */
export const PIN_CHECK_SCRIPT = 'check-lint-staged-stdio-pin.mjs'
/** 告警身份 = 常量:计数一变就换身份 ⇒ 去重永不命中(§5e-1/§5e-3)。 */
export const PIN_ALERT_NAME = 'lint-staged stdio 三针缺口'
export const PIN_ALERT_DEDUP_KEY = 'lint-staged-stdio-pin-gap'
/** 节流:45 分钟一轮(常量,opts 可覆盖便于测试)。重装依赖不是每分钟发生的事,盯得太勤只是白派生。 */
export const PIN_INTERVAL_MS = Number(process.env.IHUI_LINT_STAGED_PIN_INTERVAL_MS || 45 * 60 * 1000)
/** 守门 80:热路径派生一律带上限(尺子只读两个文件,120s 是宽松上界)。 */
export const PIN_TIMEOUT_MS = Number(process.env.IHUI_LINT_STAGED_PIN_TIMEOUT_MS || 120_000)

/**
 * 解析尺子的收尾行(纯函数):
 *   `PIN-CHECK-RESULT state=green pins=3 script=…`
 *   `PIN-CHECK-RESULT state=gap missing=execGit.js:replace-nodeOptions,… script=…`
 *   `PIN-CHECK-RESULT state=undetermined reason=… script=…`
 * 尺子只打一条;万一多打,以**末条**为准(与"末行现读"同一口径)。读数行丢了返回 null。
 */
export function parsePinCheckLine(stdout) {
  let hit = null
  for (const raw of String(stdout ?? '').split(/\r?\n/)) {
    const m = /^PIN-CHECK-RESULT state=(\S+)(.*)$/.exec(raw.trim())
    if (!m) continue
    const rest = m[2] || ''
    const pins = /\bpins=(\d+)/.exec(rest)
    const missing = /\bmissing=(\S*)/.exec(rest)
    const reason = /\breason=(.*?)(?:\s+script=.*)?$/.exec(rest)
    hit = {
      state: m[1],
      pins: pins ? Number(pins[1]) : null,
      missing: missing && missing[1] ? missing[1].split(',').filter(Boolean) : [],
      reason: reason ? reason[1].trim() : '',
    }
  }
  return hit
}

/**
 * 三档裁决(纯函数)。**矛盾态一律落未判定**:读数说齐而 rc≠0、读数说缺口而 rc=0、读数说未判定 ——
 * 三种都不得被读成"通过"。收尾行丢了但 rc=1 例外:那是尺子明说缺口(不是"没判"),必须报缺口,
 * 只是点名清单退化为"手工跑一次尺子看逐针"。
 */
export function verdictOf({ rc, parsed }) {
  if (parsed && parsed.state === 'green') return rc === 0 ? 'green' : 'undetermined'
  if (parsed && parsed.state === 'gap') return rc === 0 ? 'undetermined' : 'gap'
  if (parsed && parsed.state === 'undetermined') return 'undetermined'
  return rc === 1 ? 'gap' : 'undetermined'
}

/** 缺口的正文:逐条点名 + 后果 + 可执行的下一步(§5e-1:红了收信人必须知道能做什么)。 */
export function gapDetail({ rc, missing }) {
  const list = missing.length
    ? missing.map((m) => `· ${m}`).join('\n')
    : '· (点位清单没取到,以尺子 rc=1 为准;手工跑 node scripts/check-lint-staged-stdio-pin.mjs 看逐针点名)'
  return (
    `lint-staged stdio 三针缺 ${missing.length || '?'} 枚(node_modules 里的补丁被重装依赖洗掉了,rc=${rc ?? 'null'}):\n${list}\n\n` +
    `后果:下一次提交时 lint-staged 派生的 git 会丢 stdio ⇒ 钩子里的 git 错误不可见 / EBUSY 复现(正是 G-53/G-63 刚消解的那型)。\n` +
    `出路(能动手就这一下):node scripts/lib/patch-lint-staged-stdio.mjs —— apply 档幂等,只改 node_modules 里那 3 个文件。\n` +
    `复核:node scripts/check-lint-staged-stdio-pin.mjs(只读;0 齐 / 1 缺口 / 2 未判定)。\n` +
    `节奏:每次 pnpm install 之后都要重跑一次 apply 档 —— 本巡检只报警,不会替你重打。`
  )
}

/**
 * 常驻派发体(节流 → 派生一次尺子 → 三档分包)。默认零派生、零邮件:runner / notify / logger 全可注入,
 * 镜像测试据此用构造输入取证,不碰真尺子、不发真信。
 */
export function auditLintStagedPins(opts = {}) {
  const {
    now = Date.now(),
    intervalMs = PIN_INTERVAL_MS,
    timeoutMs = PIN_TIMEOUT_MS,
    tickFile = join(resolve(dirname(fileURLToPath(import.meta.url)), '..', '..'), '.ihui-agent', 'state', 'lint-staged-pin-tick.json'),
    cwd = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..'),
    scriptPath = null,
    logger = () => {},
    notify = () => {},
    runner = null,
  } = opts
  const script = scriptPath ?? join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), PIN_CHECK_SCRIPT)
  if (!existsSync(script)) {
    logger(`ℹ️ lint-staged 三针盯针:尺子不在位(${script})⇒ 本轮跳过,不记为已巡检`)
    return { ran: false, why: '尺子不在位' }
  }
  let last = NaN
  try {
    last = Date.parse(String(JSON.parse(readFileSync(tickFile, 'utf8')).attemptAt ?? '').trim())
  } catch {
    /* 没跑过 */
  }
  if (Number.isFinite(last) && now - last < intervalMs) return { ran: false, why: '未到节流窗口' }
  try {
    mkdirSync(dirname(tickFile), { recursive: true })
    writeFileSync(tickFile, JSON.stringify({ attemptAt: new Date(now).toISOString() }), 'utf8')
  } catch (e) {
    logger(`⚠️ lint-staged 三针盯针:节流台账写入失败(${String(e?.message ?? e).slice(0, 90)})—— 下轮照旧派发`)
  }
  const run =
    typeof runner === 'function'
      ? runner
      : () => {
          try {
            const out = execFileSync(process.execPath, [script], {
              cwd,
              encoding: 'utf8',
              windowsHide: true, // §5b:漏此参数在计划任务/守护下必弹控制台窗
              timeout: timeoutMs, // 守门 80:热路径派生一律带上限
              maxBuffer: 1 << 22,
              stdio: ['ignore', 'pipe', 'pipe'], // §12g:派生进程必须显式接管 stdio
            })
            return { status: 0, stdout: String(out ?? ''), stderr: '' }
          } catch (e) {
            // rc=1 缺口 / rc=2 未判定都不是"尺子坏了":结论整份在 stdout 的收尾行里。
            return {
              status: typeof e?.status === 'number' ? e.status : null,
              stdout: String(e?.stdout ?? ''),
              stderr: String(e?.stderr ?? e?.message ?? ''),
            }
          }
        }
  let r = null
  try {
    r = run() || {}
  } catch (e) {
    logger(`⚠️ lint-staged 三针盯针:派发异常(忽略,不影响本轮自愈与退出码):${String(e?.message ?? e).slice(0, 160)}`)
    return { ran: true, ok: false, verdict: 'undetermined', why: '派发异常' }
  }
  const rc = typeof r.status === 'number' ? r.status : null
  const parsed = parsePinCheckLine(r.stdout)
  const verdict = verdictOf({ rc, parsed })
  if (verdict === 'green') {
    logger(`✅ lint-staged 三针盯针:三针齐(pins=${parsed?.pins ?? '?'})`)
    return { ran: true, ok: true, verdict, pins: parsed?.pins ?? null }
  }
  if (verdict === 'gap') {
    const missing = parsed?.missing ?? []
    const detail = gapDetail({ rc, missing })
    logger(`❌ lint-staged 三针盯针:判出缺口 ${missing.length || '?'} 枚(rc=${rc ?? 'null'})——\n${missing.map((m) => `   · ${m}`).join('\n') || '   · (点位清单没取到)'}`)
    try {
      notify(PIN_ALERT_NAME, detail, { severity: 'warning', dedupKey: PIN_ALERT_DEDUP_KEY })
    } catch (e) {
      logger(`⚠️ lint-staged 三针盯针:到人通道异常(不影响判定):${String(e?.message ?? e).slice(0, 120)}`)
    }
    return { ran: true, ok: false, verdict, missing: missing.length, pins: parsed?.pins ?? null }
  }
  const why = parsed?.reason || [r.stderr, r.stdout].filter(Boolean).join(' ⊕ ').split(/\r?\n/)[0] || '原因未取到'
  logger(`⚠️ lint-staged 三针盯针:未判定(rc=${rc ?? 'null'})—— ${String(why).slice(0, 160)}｜只写日志不喊人(§0.3:没判不记绿也不冒红)`)
  return { ran: true, ok: false, verdict, why }
}

export const __test__ = { parsePinCheckLine, verdictOf, gapDetail }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
