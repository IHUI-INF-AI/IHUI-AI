// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 本工具是运维记账器,机器行必须走 stdout */
/**
 * user-feedback-intake — user_feedback 源 → 事故事实信号 的单源入口(2026-10-28 立)。
 *
 * 为什么还需要这一格(现场实测,不是推测):
 *   `scripts/monitor-signal-intake.mjs` 的 `SOURCE_PLAN.user_feedback` 已经把映射做完了,但
 *   全仓 **零调用点** —— 没有 guardian 派发、没有 npm script、没有 CI 步骤(§0.9「造好没装车 = 没有」)。
 *   而 user_feedback 的取数面是**本地导出件**(零网络、零 DB),与 api_logs / grafana 两源
 *   绑在同一个入口里跑是次优:任何一源的发现在同一轮里混着走,单源坏掉时谁都看不出是哪一段停摆。
 *   本器只补「可被单独调度的入口」这一格,不搬任何判据、不改任何既有语义。
 *
 * 严格不造第二份判据(§0.6 单一真相源):
 *  - 身份 / 契约:`scripts/lib/incident-cluster.mjs` 的 `identityOf` / `loadContract`
 *    (与 deploy-outcome-intake 是**同一个函数对象**,测试用例 lockIdentitySingleSource 钉住);
 *  - 映射 / 去重 / 落账:`scripts/monitor-signal-intake.mjs` 的
 *    `recordToSignal` / `SOURCE_PLAN` / `planIntake` / `parseExistingSignals` / `appendSignals`;
 *  - 取数:`scripts/auto-triage.mjs` 的 `readUserFeedback`(与 auto-triage、导出器同一份配置的同一路径)。
 *  本器自己**只多一条判据**:导出件新鲜度 `judgeFreshness`(立因见该函数头注)。
 *
 * 三态(§0.3):
 *  0 = 已判定(含 0 条信号)/ 2 = 未判定(导出件缺失或陈旧 / 契约坏 / 坏行 / 参数错)/ 3 = 写盘失败。
 *  未判定的一律打 `judged=0 undetermined=…`,绝不把"没判成"印成"signals=0 无异常"。
 *
 * 默认 dry-run:`--apply` 才落账(与 monitor-signal-intake 同档纪律,写盘是显式动作)。
 *
 * 用法:
 *   node scripts/user-feedback-intake.mjs                      # dry-run,不写盘
 *   node scripts/user-feedback-intake.mjs --apply              # 落账到 incident-signals.jsonl
 *   node scripts/user-feedback-intake.mjs --json --minutes 1440 --stale-hours 24
 *   node scripts/user-feedback-intake.mjs --self-test
 */
import { readFileSync, statSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { requireFlagValue } from './lib/flag-value.mjs'
import { identityOf, loadContract } from './lib/incident-cluster.mjs'
import { loadConfig, readUserFeedback } from './auto-triage.mjs'
import {
  DEFAULT_MINUTES,
  DEFAULT_OUT,
  SOURCE_PLAN,
  appendSignals,
  parseExistingSignals,
  planIntake,
  recordToSignal,
} from './monitor-signal-intake.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/** 本器只负责这一源;`deploy_outcome` 归 deploy-outcome-intake,其余监控源归 monitor-signal-intake。 */
export const SOURCE = 'user_feedback'
export const RESULT_PREFIX = 'USER-FEEDBACK-INTAKE'
/**
 * 导出件新鲜度阈值(小时)。默认 24h 与去重窗口同档:guardian 每 20 分钟派发导出器,
 * 超过一整天没刷新只可能是导出腿停摆 —— 那时的 0 字节不是"本库零条反馈"。
 */
export const DEFAULT_STALE_HOURS = 24

export { DEFAULT_MINUTES, DEFAULT_OUT, SOURCE_PLAN, identityOf, recordToSignal }

/** 契约 / 记录 / 参数形状坏 —— 调用方必须落「未判定」,不得当空集处理(§0.3)。 */
export class FeedbackIntakeShapeError extends Error {
  constructor(message) {
    super(message)
    this.name = 'FeedbackIntakeShapeError'
  }
}

/**
 * 导出件新鲜度判据(本器**唯一**自带的判据,v1 立因):
 *
 * `auto-triage.readUserFeedback` 的文件通道对「导出件 0 字节」只有一个语义:查询成功、0 条未结。
 * 这个读法在导出器**正在跑**时是对的(`export-user-feedback.mjs` 明确把 0 行判成 ok/rc 0)。
 * 但它结构上分不出另一种现场:**导出器停摆很久、盘上留着上一轮的空件**。两种现场都读成
 * "已判定且无反馈",而后者其实是"取数面死了没人知道"(本仓 §16c 有过 guardian 停摆两天
 * 无人察觉的先例)。所以本器在**取数之前**先问文件本身:存在但 mtime 超期 ⇒ 未判定并点名。
 *
 * 边界:文件不存在 ⇒ `missing`(由调用方落未判定,不在这里判"没反馈");
 * 元信息读不到 ⇒ `undetermined`(不猜);`staleHours <= 0` ⇒ 关闭该维(显式关掉,不是默认)。
 */
export function judgeFreshness(
  filePath,
  { now = Date.now(), staleHours = DEFAULT_STALE_HOURS, stat = (p) => statSync(p) } = {},
) {
  if (!Number.isFinite(staleHours) || staleHours < 0) {
    throw new FeedbackIntakeShapeError(`staleHours 必须是非负数(实得 ${staleHours})`)
  }
  let st
  try {
    st = stat(filePath)
  } catch (e) {
    if (e?.code === 'ENOENT') {
      return { status: 'missing', why: `导出件不存在(${filePath})—— 取数面未判定,不拿不存在当空集` }
    }
    return { status: 'undetermined', why: `导出件元信息读不到(${filePath}):${e?.code ?? e?.message ?? e}` }
  }
  const mtimeMs = Number(st?.mtimeMs)
  if (!Number.isFinite(mtimeMs)) {
    return { status: 'undetermined', why: `导出件 mtime 取不到(${filePath})` }
  }
  const ageHours = (now - mtimeMs) / 3_600_000
  if (staleHours > 0 && ageHours > staleHours) {
    return {
      status: 'stale',
      ageHours,
      why:
        `导出件已陈旧 ${ageHours.toFixed(1)}h > ${staleHours}h(mtime=${new Date(mtimeMs).toISOString()})` +
        ' —— 0 字节既可能是「判过 0 行」也可能是「导出器停摆」,陈旧件不猜',
    }
  }
  return { status: 'fresh', ageHours, bytes: Number(st?.size ?? 0), mtime: new Date(mtimeMs).toISOString() }
}

/**
 * 单源判定:把已取到的记录交给 `monitor-signal-intake.planIntake` 的同一条判据
 * (它只遍历 `SOURCES`,传单源对象即只跑这一源,行为与三源合一入口逐字一致)。
 */
export function planForFeedback({ records, contract, minutes = DEFAULT_MINUTES, existing = [] } = {}) {
  if (!Array.isArray(records)) throw new FeedbackIntakeShapeError('records 必须是数组')
  return planIntake({ bySource: { [SOURCE]: records }, contract, minutes, existing })
}

const KNOWN_FLAGS = new Set(['--in', '--out', '--minutes', '--stale-hours', '--apply', '--json', '--self-test'])

/** 带值旗标一律走 `requireFlagValue`(G-322):给了旗标却吞掉值 ⇒ 用法错,绝不回落默认。 */
function pathFlag(argv, flag, errors) {
  const r = requireFlagValue(argv, flag, { noun: '路径' })
  if (r.error) {
    errors.push(r.error)
    return null
  }
  return r.value
}

function intFlag(argv, flag, noun, fallback, errors, { allowZero = false } = {}) {
  const r = requireFlagValue(argv, flag, { noun })
  if (r.error) {
    errors.push(r.error)
    return fallback
  }
  if (!r.present) return fallback
  if (!/^\d+$/.test(r.value)) {
    errors.push(`${flag} 需要${allowZero ? '非负' : '正'}整数,实得 ${JSON.stringify(r.value)}`)
    return fallback
  }
  const n = Number(r.value)
  if (!allowZero && n < 1) {
    errors.push(`${flag} 需要正整数,实得 ${JSON.stringify(r.value)}`)
    return fallback
  }
  return n
}

/** 解析 CLI 参数:未知旗标、吞值、非正整数一律记 usage 错(调用方据此 exit 2)。 */
export function parseArgs(argv = []) {
  const errors = []
  for (const t of argv) {
    if (typeof t === 'string' && t.startsWith('-') && !KNOWN_FLAGS.has(t)) errors.push(`未知旗标 ${t}`)
  }
  return {
    input: pathFlag(argv, '--in', errors),
    out: pathFlag(argv, '--out', errors),
    minutes: intFlag(argv, '--minutes', '窗口分钟数', DEFAULT_MINUTES, errors),
    staleHours: intFlag(argv, '--stale-hours', '新鲜度阈值小时', DEFAULT_STALE_HOURS, errors, { allowZero: true }),
    apply: argv.includes('--apply'),
    json: argv.includes('--json'),
    selfTest: argv.includes('--self-test'),
    errors,
  }
}

/** 取数面路径:显式 `--in` 优先,否则与 auto-triage 同一份配置的同一路径(§0.6)。 */
export function resolveInputPath(args, cfg) {
  if (args?.input) return resolve(args.input)
  const raw = String(cfg?.userFeedback?.jsonl ?? '').trim()
  if (!raw) return ''
  return isAbsolute(raw) ? raw : resolve(ROOT, raw)
}

/** 自检:契约 / 映射 / 身份同源 / 新鲜度 / 去重 —— 全部走生产判据(零网络、零真库)。 */
export function runSelfTest() {
  const checks = []
  const ok = (name, cond, why = '') => checks.push({ name, ok: Boolean(cond), why })
  let contract
  try {
    contract = loadContract()
    ok('契约可读且 source 含 user_feedback', contract.fields.source.enum.includes(SOURCE))
  } catch (e) {
    ok(`契约可读(${e?.message ?? e})`, false)
    return { ok: false, checks }
  }

  const rec = {
    at: '2026-10-28T10:00:00.000Z',
    label: 'bug:导出失败',
    objectText: 'bug|导出失败|点导出没反应',
    evidence: 'type=bug status=pending title=导出失败',
  }
  const one = recordToSignal(SOURCE, rec, contract)
  ok('映射:user_feedback → user_report/warn', one.produce && one.signal.kind === 'user_report' && one.signal.severity === 'warn')
  ok('映射:route 留空(退 msg 归一身份)', one.signal.route === undefined)

  const p1 = planForFeedback({ records: [rec, { ...rec, at: '2026-10-28T11:00:00.000Z' }], contract })
  ok('同身份 24h 内只产一次', p1.signals.length === 1 && p1.skipped === 1, JSON.stringify(p1))
  const p2 = planForFeedback({ records: [{ ...rec, at: '2026-10-29T12:00:00.000Z' }], contract })
  ok('超 24h 同身份可再产', p2.signals.length === 1, JSON.stringify(p2))
  const p3 = planForFeedback({ records: [], contract })
  ok('空输入 ⇒ 0 条仍已判定', p3.signals.length === 0 && p3.undetermined === 0)

  const bad = planForFeedback({ records: [{ ...rec, at: 'no-tz' }], contract })
  ok('缺时区的记录 ⇒ 单列坏行(不猜)', bad.undetermined === 1 && bad.signals.length === 0)

  const NOW = Date.parse('2026-10-28T12:00:00.000Z')
  const statOf = (mtimeMs, size = 0) => () => ({ mtimeMs, size })
  ok('新鲜度:刚写 ⇒ fresh', judgeFreshness('x', { now: NOW, stat: statOf(NOW - 60_000) }).status === 'fresh')
  ok('新鲜度:超 24h ⇒ stale', judgeFreshness('x', { now: NOW, stat: statOf(NOW - 25 * 3_600_000) }).status === 'stale')
  ok('新鲜度:缺件 ⇒ missing', judgeFreshness('x', { now: NOW, stat: () => { const e = new Error('nope'); e.code = 'ENOENT'; throw e } }).status === 'missing')
  ok('新鲜度:staleHours=0 关闭该维', judgeFreshness('x', { now: NOW, staleHours: 0, stat: statOf(NOW - 999 * 3_600_000) }).status === 'fresh')

  const failed = checks.filter((c) => !c.ok)
  for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.ok ? '' : ` — ${c.why}`}`)
  console.log(`# user-feedback-intake self-test ${checks.length - failed.length}/${checks.length}`)
  return failed.length === 0 ? 0 : 1
}

function main(argv) {
  const args = parseArgs(argv)
  if (args.selfTest) return runSelfTest()
  if (args.errors.length > 0) {
    for (const e of args.errors) console.error(`❌ ${e}`)
    console.error('未判定:参数错误,未产生任何信号')
    console.log(`${RESULT_PREFIX} judged=0 undetermined=1`)
    return 2
  }
  let contract
  try {
    contract = loadContract()
  } catch (e) {
    console.error(`未判定:${e?.message ?? e}`)
    console.log(`${RESULT_PREFIX} judged=0 undetermined=1`)
    return 2
  }
  let cfg = {}
  try {
    cfg = loadConfig()
  } catch (e) {
    console.error(`未判定:分诊配置读不到或非法(${e?.message ?? e})`)
    console.log(`${RESULT_PREFIX} judged=0 undetermined=1`)
    return 2
  }

  const inPath = resolveInputPath(args, cfg)
  if (!inPath) {
    console.error('未判定:导出件路径为空(--in 与 auto-triage-config.json 的 userFeedback.jsonl 皆空)')
    console.log(`${RESULT_PREFIX} judged=0 undetermined=1`)
    return 2
  }

  const fresh = judgeFreshness(inPath, { staleHours: args.staleHours })
  if (fresh.status !== 'fresh') {
    console.error(`未判定:${fresh.why}`)
    console.log(`${RESULT_PREFIX} judged=0 undetermined=1`)
    return 2
  }

  const read = readUserFeedback({ jsonlPath: inPath })
  if (read.status !== 'ok') {
    console.error(`未判定:${read.why ?? '导出件取数未判定'}`)
    console.log(`${RESULT_PREFIX} judged=0 undetermined=1`)
    return 2
  }

  const outPath = resolve(args.out ?? DEFAULT_OUT)
  let existingText = ''
  try {
    existingText = readFileSync(outPath, 'utf8')
  } catch (e) {
    if (e?.code !== 'ENOENT') {
      console.error(`未判定:--out 读不到 ${outPath}(${e?.code ?? e?.message ?? e})`)
      console.log(`${RESULT_PREFIX} judged=0 undetermined=1`)
      return 2
    }
  }
  const existing = parseExistingSignals(existingText)
  if (existing.bad.length > 0) {
    for (const b of existing.bad) console.error(`BAD-LINE line=${b.line} ${b.reason}`)
    console.error(`未判定:--out 已有台账有 ${existing.bad.length} 行坏,去重面不可信`)
    console.log(`${RESULT_PREFIX} judged=0 undetermined=1`)
    return 2
  }

  const result = planForFeedback({
    records: read.records,
    contract,
    minutes: args.minutes,
    existing: existing.signals,
  })
  for (const b of result.bad) console.error(`BAD-ROW index=${b.index} ${b.reason}`)
  if (result.bad.length > 0) {
    console.error(`未判定:导出件有 ${result.bad.length} 条记录形状坏,本批一条都不落(不连坐半批)`)
    console.log(`${RESULT_PREFIX} judged=0 undetermined=${result.bad.length}`)
    return 2
  }

  if (args.json) {
    console.log(
      JSON.stringify({
        contract: { version: contract.version, reviewBy: contract.reviewBy },
        params: { minutes: args.minutes, staleHours: args.staleHours, input: inPath, out: outPath, apply: args.apply },
        freshness: fresh,
        judged: true,
        records: read.records.length,
        signals: result.signals.length,
        skipped: result.skipped,
        undetermined: 0,
        rows: result.signals,
      }),
    )
  }

  if (!args.apply) {
    console.log(
      `${RESULT_PREFIX} signals=${result.signals.length} skipped=${result.skipped} undetermined=0 ` +
        `records=${read.records.length} dry-run=1`,
    )
    return 0
  }
  try {
    appendSignals(outPath, result.signals)
  } catch (e) {
    console.error(`${RESULT_PREFIX}-WRITE-FAILED ${outPath}: ${e?.message ?? e}`)
    return 3
  }
  console.log(
    `${RESULT_PREFIX} signals=${result.signals.length} skipped=${result.skipped} undetermined=0 records=${read.records.length}`,
  )
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) process.exitCode = main(process.argv.slice(2))

export const __test__ = {
  DEFAULT_OUT,
  DEFAULT_MINUTES,
  DEFAULT_STALE_HOURS,
  RESULT_PREFIX,
  SOURCE,
  FeedbackIntakeShapeError,
  judgeFreshness,
  parseArgs,
  planForFeedback,
  resolveInputPath,
  runSelfTest,
  identityOf,
  recordToSignal,
  SOURCE_PLAN,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
