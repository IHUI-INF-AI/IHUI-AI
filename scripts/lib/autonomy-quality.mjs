// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 把 `pairwise_eval` 这把尺子接进自主环的**编排层** —— 本层**不持有任何判分判据**。
 *
 * 判分口径的唯一真相源在 Python:
 *   apps/ai-service/app/services/pairwise_eval.py 的 `detect_regression`
 *   (四态 win/loss/tie/unjudged、胜率分母只含 win+loss、历史/样本不足落 unjudged)。
 * 本层只做三件事,且每一件都可被镜像测试单独钉住:
 *   ① 取当次机器事实:venv 的 python 与尺子入口脚本的**真实路径**(§0 盘符不写死);
 *   ② 把尺子的退出码映射成三态裁决(0 ok / 1 regression / 2 undetermined),
 *      **其它一律 undetermined** —— 未知退码默认成 ok 就是 §0.10 禁的"多放一次";
 *   ③ 按档位决定是否挂"停派牌"(只有 enforce × regression 才挂;undetermined 永不挂,
 *      否则题库还没建就把整环锁死 = §12e 恒红门的另一种形状:逼人跳门或永久空转)。
 *
 * 为什么默认 `off` 而 `humanValveMode` 默认 `observe`:
 *   人工阀的语料已在仓,记账必然有读数;尺子的**题库刻意不在仓**(保密轴 —— 见
 *   private_eval_store.py 的仓外候选根),题库没放时跑尺子必然恒返回 undetermined,
 *   每轮记一行"判不了"就是把台账灌成噪声、还让下一次真降级看起来没变坏。
 *   所以缺字段 = 完全不跑;放量属人改 gates 的 `ruler.mode`,与本器无关。
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { spawnSync } from 'node:child_process'

export const QUALITY_MODES = Object.freeze(['off', 'observe', 'enforce'])
export const DEFAULT_QUALITY_MODE = 'off'
export const DEFAULT_QUALITY_HOLD_HOURS = 24
export const MAX_QUALITY_HOLD_HOURS = 72

/** 尺子 CLI 的退出码契约(唯一出处 = apps/ai-service/scripts/private_eval_run.py 的 EXIT_*)。 */
export const RULER_EXIT = Object.freeze({ OK: 0, REGRESSION: 1, UNDETERMINED: 2 })

/** 裁决取值;`skipped` = 档位 off,连进程都没起。 */
export const VERDICTS = Object.freeze(['ok', 'regression', 'undetermined', 'skipped'])
/** 终局/发信用的质量动作名(守门 328 按字面命中,改名要同批改判据)。 */
export const QUALITY_LEDGER_ACTION_BY_VERDICT = Object.freeze({
  ok: 'quality-ok',
  regression: 'quality-regression',
  undetermined: 'quality-undetermined',
})
export const QUALITY_HOLD_ACTION = 'quality-hold-skip'

/** 读 gates 里的尺子档(形状坏抛错,由 loadGates 当场落 exit 2;不给默认值兜开放行为)。 */
export function resolveQualityConfig(gates = {}) {
  const r = gates && typeof gates.ruler === 'object' && gates.ruler !== null ? gates.ruler : {}
  const mode = r.mode === undefined || r.mode === null ? DEFAULT_QUALITY_MODE : String(r.mode)
  if (!QUALITY_MODES.includes(mode)) {
    throw new Error(`ruler.mode 只能是 ${QUALITY_MODES.join('|')} 之一(现值 ${JSON.stringify(r.mode)})`)
  }
  let holdHours = DEFAULT_QUALITY_HOLD_HOURS
  if (r.holdHours !== undefined && r.holdHours !== null) {
    holdHours = Number(r.holdHours)
    if (!Number.isInteger(holdHours) || holdHours < 1 || holdHours > MAX_QUALITY_HOLD_HOURS) {
      throw new Error(`ruler.holdHours 必须是 1..${MAX_QUALITY_HOLD_HOURS} 的正整数(现值 ${String(r.holdHours)})`)
    }
  }
  return { mode, holdHours }
}

/**
 * 取当次机器事实:尺子入口 + 解释器。缺任何一件 ⇒ ok:false 并点名缺哪件,
 * 调用方据此落 `undetermined`(而非跳过/而非 ok)——「尺子不在位」与「尺子判不了」都要响。
 */
export function resolveRulerPlan(root, env = process.env, platform = process.platform) {
  if (!root) throw new Error('resolveRulerPlan 需要仓根(缺省由调用方按自身位置推导,§15)')
  const py = platform === 'win32' ? 'python.exe' : 'python3'
  // 换机/重装后 venv 可能不在仓内原位(§5f 同类纪律):允许显式指解释器,取不到再回落默认位。
  const override = typeof env?.IHUI_AI_SERVICE_PYTHON === 'string' ? env.IHUI_AI_SERVICE_PYTHON.trim() : ''
  const defaultPy = root + `/apps/ai-service/.venv/Scripts/${py}`
  const interpreter = override || defaultPy
  const script = root + '/apps/ai-service/scripts/private_eval_run.py'
  const interpreterPresent = existsSync(interpreter)
  return {
    interpreter,
    script,
    fromOverride: Boolean(override),
    ok: interpreterPresent && existsSync(script),
    missing: [
      !interpreterPresent ? (override ? `IHUI_AI_SERVICE_PYTHON 指向的解释器不在位:${interpreter}` : 'ai-service venv 解释器不在位') : null,
      !existsSync(script) ? '尺子入口脚本不在位' : null,
    ].filter(Boolean),
  }
}

/** 三态映射:唯一一处把退出码翻译成裁决的地方(R7 棘轮拦第二份同形映射)。 */
export function mapRulerExit({ status = null, signal = null, error = null } = {}) {
  if (error) return 'undetermined'
  if (signal !== null && signal !== undefined) return 'undetermined'
  if (status === RULER_EXIT.OK) return 'ok'
  if (status === RULER_EXIT.REGRESSION) return 'regression'
  if (status === RULER_EXIT.UNDETERMINED) return 'undetermined'
  return 'undetermined'
}

export function qualityHoldPath(root) {
  return root + '/.ihui-agent/state/auto-evolve-quality-hold.json'
}

/** 起尺子进程。所有失败路径都收进返回值,绝不抛(调用方在主链上,抛了就会打断落账)。 */
export function runRuler({ mode, root, version, spawnFn = spawnSync, timeoutMs = 180_000, env = process.env, platform = process.platform } = {}) {
  if (mode === 'off') return { verdict: 'skipped', rc: null, tail: '', why: '档位 off,未起进程' }
  const plan = resolveRulerPlan(root, env, platform)
  if (!plan.ok) {
    return { verdict: 'undetermined', rc: null, tail: '', why: `尺子不在位:${plan.missing.join(' / ')}` }
  }
  let r
  try {
    r = spawnFn(plan.interpreter, [plan.script, '--version', String(version || 'unknown')], {
      encoding: 'utf8',
      timeout: timeoutMs,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 8 << 20,
      cwd: dirname(plan.script),
    })
  } catch (e) {
    return { verdict: 'undetermined', rc: null, tail: '', why: `尺子调用抛错:${String(e?.message ?? e).slice(0, 160)}` }
  }
  const tail = pickVerdictLine(r)
  if (r?.error) {
    return { verdict: 'undetermined', rc: null, tail, why: `spawn error ${r.error}(${String(r?.stderr ?? '').slice(0, 120)})` }
  }
  return { verdict: mapRulerExit({ status: r?.status, signal: r?.signal }), rc: r?.status, tail, why: '' }
}

function pickVerdictLine(spawned) {
  const stdout = String(spawned?.stdout ?? '').split(/\r?\n/).filter((l) => l.trim())
  if (stdout.length === 0) return ''
  return stdout.filter((l) => /regression|unjudged|未判定|哨兵/.test(l)).slice(-1)[0] ?? ''
}

/** enforce × regression 才挂停派牌;undetermined/ok 一律不挂(§12e)。 */
export function shouldHold({ mode, verdict }) {
  return mode === 'enforce' && verdict === 'regression'
}

/** 台账行构造:形状锁钉住「无题面字段」+ 原因串限长。 */
export function buildQualityLedgerRow({ verdict, rc = null, tail = '', why = '', version = '', holdUntil = null }) {
  if (!VERDICTS.includes(verdict)) throw new Error(`未知裁决 ${JSON.stringify(verdict)}(不得写进台账)`);
  if (verdict === 'skipped') return null
  return {
    mode: 'quality',
    action: QUALITY_LEDGER_ACTION_BY_VERDICT[verdict],
    verdict,
    rc,
    rulerVersion: String(version || '').slice(0, 40),
    why: String(why || tail || '').replace(/[\r\n]+/g, ' | ').slice(0, 300),
    ...(holdUntil ? { holdUntil } : {}),
  }
}

/** 停派牌:形状坏 ⇒ 未判定不续牌;只有未过期且 verdict=regression 才拦。 */
export function readQualityHold(file = '', now = Date.now()) {
  if (!file || !existsSync(file)) return { held: false, reason: '无牌' }
  let h
  try {
    h = JSON.parse(readFileSync(file, 'utf8'))
  } catch (e) {
    return { held: false, undetermined: true, reason: `牌文件形状坏(${String(e?.message ?? e).slice(0, 80)})⇒ 未判定,不据此停派也不报绿` }
  }
  const until = Date.parse(String(h?.until ?? ''))
  if (!Number.isFinite(until)) return { held: false, undetermined: true, reason: '牌缺 until 字段或不可解析 ⇒ 未判定' }
  if (until <= now) return { held: false, expired: true, reason: '牌已到期', until: new Date(until).toISOString() }
  return { held: true, reason: 'enforce × regression', until: new Date(until).toISOString(), version: String(h?.version ?? '') }
}

export function writeQualityHold(file, { hours, version, verdict, tail = '' } = {}) {
  const until = new Date(Date.now() + hours * 3600_000).toISOString()
  mkdirSync(dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  writeFileSync(
    tmp,
    JSON.stringify({ setAt: new Date().toISOString(), until, hours, version, verdict, tail: String(tail).slice(0, 300) }, null, 2),
    'utf8',
  )
  renameSync(tmp, file)
  return until
}

export const __test__ = Object.freeze({
  QUALITY_MODES,
  DEFAULT_QUALITY_MODE,
  DEFAULT_QUALITY_HOLD_HOURS,
  MAX_QUALITY_HOLD_HOURS,
  RULER_EXIT,
  VERDICTS,
  QUALITY_LEDGER_ACTION_BY_VERDICT,
  QUALITY_HOLD_ACTION,
  runRuler,
  resolveQualityConfig,
  resolveRulerPlan,
  mapRulerExit,
  shouldHold,
  buildQualityLedgerRow,
  readQualityHold,
  writeQualityHold,
  qualityHoldPath,
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
