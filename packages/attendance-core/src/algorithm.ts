// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { normalizeHm } from './normalize.js'

/**
 * 缺勤补录纯算法(主体无关,2026-11 从 edu-attendance-absent-job.ts 抽出)。
 *
 * 立因:原实现把"迟到/早退/缺勤判定"与"学生/班级在册、排课"耦合在同一文件,
 * 人事考勤要复用同一套算法却被迫复制。抽出后:
 *   · 判定口径(judgeStatus)在 @ihui/attendance-core 单源,教育/人事共用;
 *   · 本文件的纯算法只认 `subjectId / scopeId`(被考勤主体 / 其所属范围),
 *     不认识 student/class/employee/department —— 在册集合与排课集合由调用方注入;
 *   · 日界算术(bizDayKey/shiftBizDayKey)不在此复制(守门 246 拦第二份),
 *     由调用方把 `shiftBizDayKey` 注入 `buildBizDayWindow`;`dayFloorOf` 仅把 Date
 *     折成 Shanghai 的 YYYY-MM-DD,内部用 `shanghaiYmd`(不叫 bizDayKey,不触发门 246)。
 *
 * 全文件零 IO、零 logger,便于把"该不该补"这一格钉死(§22c:判据只此一份)。
 */

/** 业务时区:与 patrol/automation 调度器同源,不受宿主 TZ 漂移 */
export const BIZ_TIMEZONE = 'Asia/Shanghai'

/**
 * 回溯天数(**不含当日**):默认 3 ⇒ 一轮判定 4 个业务日。
 * 取 3 的依据(现读 cron = 北京 18:30 每日一跑):
 *   · 1 天 = 覆盖"absent_after 晚于跑批时刻"这一型;
 *   · 2 天 = 作业整体漏跑一自然日(服务停一天)后仍能接上,不留空洞;
 *   · 3 天 = 再吃一个跨日/周末缝并留一天余量;
 *   再往上就是拿"从未被判定过的历史"批量造缺勤行,风险大于收益 ⇒ 封顶见 MAX_BACKFILL_DAYS。
 */
export const DEFAULT_BACKFILL_DAYS = 3

/** 窗口上限(含当日 ⇒ 最多 31 个业务日一起判)。单批 insert 行数 = 在册人数 × 待补日期数。 */
export const MAX_BACKFILL_DAYS = 30

/** 跑批可选入参;不新开环境变量族,默认值一律落上面的常量。 */
export interface AbsentRunOptions {
  /** 回溯天数(不含当日)。非法/越界 ⇒ 经 onWarn 点名后回落默认或封顶,不静默。 */
  backfillDays?: number
  /** 越界/非法时的告警注入(调用方传 logger.warn);不传则静默回落。 */
  onWarn?: (msg: string, ctx?: Record<string, unknown>) => void
}

/** 待补缺勤对(主体无关) */
export interface AbsentCandidate {
  subjectId: string
  scopeId: string
  date: string
}

/**
 * 判定"当前时刻是否已过 wallClock(HH:MM) 的墙钟阈值"。
 * 归一化拿不到 ⇒ 返回 false(不猜"已过");比较两侧必须是补零 HH:MM(§22c 单源)。
 */
export function isPastHm(
  wallClock: string,
  now: Date = new Date(),
  timezone: string = BIZ_TIMEZONE,
): boolean {
  const threshold = normalizeHm(wallClock)
  if (!threshold) return false
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const hh = parts.find((p) => p.type === 'hour')?.value ?? ''
  const mm = parts.find((p) => p.type === 'minute')?.value ?? ''
  const nowHm = `${hh}:${mm}`
  if (nowHm.length !== 5) return false // 量不到 ⇒ 不猜"已过"
  return nowHm >= threshold
}

/**
 * 窗口长度取值:未给 ⇒ 默认常量;非法(非整数/负数)⇒ 经 onWarn 点名后回落默认;
 * 越界 ⇒ 封顶 MAX_BACKFILL_DAYS 并 onWarn。0 是合法值(= 只判当日)。
 * 纯函数:告警责任交给调用方,本文件不引入 logger 依赖。
 */
export function resolveBackfillDays(
  raw: unknown,
  onWarn?: (msg: string, ctx?: Record<string, unknown>) => void,
): number {
  if (raw === undefined || raw === null) return DEFAULT_BACKFILL_DAYS
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 0) {
    onWarn?.('attendance absent job: 非法 backfillDays,回落默认窗口', {
      raw: String(raw),
      fallback: DEFAULT_BACKFILL_DAYS,
    })
    return DEFAULT_BACKFILL_DAYS
  }
  if (n > MAX_BACKFILL_DAYS) {
    onWarn?.('attendance absent job: backfillDays 越界,按上限封顶', {
      raw: String(raw),
      capped: MAX_BACKFILL_DAYS,
    })
    return MAX_BACKFILL_DAYS
  }
  return n
}

/** Shanghai 墙钟 Date → YYYY-MM-DD(内部用,不与 biz-day 的 bizDayKey 重名,守门 246 只看标识符)。 */
function shanghaiYmd(d: Date): string {
  const local = new Date(d.getTime() + 8 * 3600 * 1000)
  const y = local.getUTCFullYear()
  const m = String(local.getUTCMonth() + 1).padStart(2, '0')
  const day = String(local.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * 含当日在内的业务日窗口,**由旧到新**返回(插入批次里旧日期先落,便于日志对眼)。
 * 日界算术一律由调用方注入的 `shift`(来自 utils/biz-day 的 shiftBizDayKey),
 * 本文件不得有第二份日界实现(守门 246)。
 */
export function buildBizDayWindow(
  todayKey: string,
  backfillDays: number,
  shift: (key: string, days: number) => string,
): string[] {
  const keys: string[] = []
  for (let i = backfillDays; i >= 0; i -= 1) keys.push(shift(todayKey, -i))
  return keys
}

/**
 * 把"下界列"折成 YYYY-MM-DD:Date(带时区时间戳列)/ 'YYYY-MM-DD'(date 列)/
 * 可解析的日期串都吃;量不到 ⇒ null(= 这一侧不设下界,由调用方计数并留日志)。
 */
export function dayFloorOf(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : shanghaiYmd(value)
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
    const parsed = new Date(trimmed)
    return Number.isNaN(parsed.getTime()) ? null : shanghaiYmd(parsed)
  }
  return null
}

/** (主体, 日期) 对的指纹:与唯一索引列同键(范围已由外层循环锁定)。 */
const pairKey = (subjectId: string, date: string): string => `${subjectId}|${date}`

/** 两个日键取较晚者(ISO `YYYY-MM-DD` 字典序即日序);任一侧量不到 ⇒ 返回另一侧。 */
function laterDayFloor(a: string | null, b: string | null): string | null {
  if (!a) return b
  if (!b) return a
  return a > b ? a : b
}

/**
 * 一个范围(scope)一轮的**待写对**(幂等的第一道实现:已有未软删行的对根本不进候选)。
 * 纯函数、零 IO,便于把"该不该补"这一格钉死(§22c:判据只此一份)。
 *
 * @param dueDates   窗口内"到期可判"的日期(由调用方按 absentAfter 折出)
 * @param subjects   去重后的在册主体 + 各自的下界(floor 折出的日键,null = 量不到)
 * @param ruleFloor  规则落库日折出的日键(null = 量不到,不设该侧界)
 * @param existing   库里该范围窗口内已有的未软删行
 */
export function absentCandidatePairsForRule(args: {
  scopeId: string
  dueDates: string[]
  subjects: Array<{ subjectId: string; floor: string | null }>
  ruleFloor: string | null
  existing: Array<{ subjectId: string; date: unknown }>
}): { candidates: AbsentCandidate[]; existingHits: number; unplacedExisting: number } {
  const existingSet = new Set<string>()
  let unplacedExisting = 0
  for (const row of args.existing) {
    const date = typeof row.date === 'string' ? row.date : null
    if (!date) {
      unplacedExisting += 1 // 量不到日期 ⇒ 不能据此排除,但必须留数(§0.3 不静默)
      continue
    }
    existingSet.add(pairKey(String(row.subjectId), date))
  }

  const candidates: AbsentCandidate[] = []
  let existingHits = 0
  for (const subject of args.subjects) {
    // 下界 = 规则落库日 与 该主体登记日 里较晚的一侧(任一侧量不到 ⇒ 只按另一侧设界)
    const floor = laterDayFloor(args.ruleFloor, subject.floor)
    for (const date of args.dueDates) {
      if (floor && date < floor) continue // 早于规则落库日/登记日 ⇒ 不造历史
      if (existingSet.has(pairKey(subject.subjectId, date))) {
        existingHits += 1
        continue
      }
      candidates.push({ subjectId: subject.subjectId, scopeId: args.scopeId, date })
    }
  }
  return { candidates, existingHits, unplacedExisting }
}

/** 排课门控三态(语义与失效方向见下)。 */
export type ScheduleGateState = 'gated' | 'no-schedule' | 'unjudged'

/** 单个范围的门控判定结果;`state !== 'gated'` 时 `weekdays` 为空集(照旧判,不据此排除)。 */
export interface ScheduleScopeGate {
  readonly state: ScheduleGateState
  /** `gated` 时 = 该范围有效排课覆盖的星期几(1=周一…7=周日) */
  readonly weekdays: ReadonlySet<number>
  /** 该范围被读进来却折不出合法星期几的行数(不静默:调用方要把它带进日志) */
  readonly malformedWeekdays: number
}

const NO_WEEKDAYS: ReadonlySet<number> = new Set<number>()

/** `state` 之外的两档都是"照旧判",只是点名口径不同 ⇒ 统一的放行判定由 gateDueDates 实现。 */
function gateOf(
  state: ScheduleGateState,
  weekdays: ReadonlySet<number>,
  malformed: number,
): ScheduleScopeGate {
  return { state, weekdays, malformedWeekdays: malformed }
}

/**
 * 把业务日键(YYYY-MM-DD)折成星期几,**1=周一 … 7=周日**。
 * 为什么不直接复用仓内其他 getDay()/getUTCDay() 实现:
 *   · utils/calendar-boundary.ts 的 dayBoundary().weekday 是 0=周一 档;
 *   · services/agent-automation-scheduler.ts 的 weekdayOfZoneDate 是 0=周日 的 cron 档;
 *   直接复用任一档都会**错一天**(1..7 与 0..6 相差 1)。本函数不做任何日界算术:
 *   输入已是折好的日历键,这里只取该日历日的星期属性。量不到 ⇒ null(不猜星期几)。
 */
export function weekdayOfBizDayKey(key: string): number | null {
  if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key.trim())) return null
  const day = new Date(`${key.trim()}T00:00:00Z`)
  if (Number.isNaN(day.getTime())) return null
  const dow = day.getUTCDay() // 0=周日 … 6=周六
  return dow === 0 ? 7 : dow
}

/** 排课表 weekday 列的合法档:整数 1..7;其余 ⇒ null(不猜)。 */
function weekdayColumnOf(raw: unknown): number | null {
  const n = Number(raw)
  return Number.isInteger(n) && n >= 1 && n <= 7 ? n : null
}

export interface ScheduleGateSummary {
  gates: Map<string, ScheduleScopeGate>
  /** 答复里出现了不属于本轮候选范围(班级/部门)的行(表可读、但口径对不上 ⇒ 只报数不猜) */
  foreignRows: number
}

/**
 * 有效排课行 ⇒ 逐范围门控档位。**纯函数、零 IO**(§22c:判据只此一份)。
 *
 * 分档:
 *   · 该范围 ≥1 行合法 weekday ⇒ `gated`(只判这些星期几);
 *   · 该范围 0 行 ⇒ `no-schedule`(从没排过 ⇒ **判不出"无课" ⇒ 照旧判**);
 *   · 该范围有行但全部 weekday 非法 ⇒ `unjudged`(读到了却折不出星期几 ⇒ 照旧判 + 点名)。
 */
export function buildScopeScheduleGates(args: {
  scopeIds: readonly string[]
  rows: ReadonlyArray<{ scopeId: unknown; weekday: unknown }>
}): ScheduleGateSummary {
  const wanted = new Set(args.scopeIds.map(String))
  const weekdays = new Map<string, Set<number>>()
  const malformed = new Map<string, number>()
  let foreignRows = 0

  for (const row of args.rows) {
    const scopeId = String(row.scopeId)
    if (!wanted.has(scopeId)) {
      foreignRows += 1
      continue
    }
    const wd = weekdayColumnOf(row.weekday)
    if (wd === null) {
      malformed.set(scopeId, (malformed.get(scopeId) ?? 0) + 1)
      continue
    }
    const set = weekdays.get(scopeId) ?? new Set<number>()
    set.add(wd)
    weekdays.set(scopeId, set)
  }

  const gates = new Map<string, ScheduleScopeGate>()
  for (const scopeId of args.scopeIds) {
    const key = String(scopeId)
    const set = weekdays.get(key)
    const bad = malformed.get(key) ?? 0
    if (set && set.size > 0) gates.set(key, gateOf('gated', set, bad))
    else if (bad > 0) gates.set(key, gateOf('unjudged', NO_WEEKDAYS, bad))
    else gates.set(key, gateOf('no-schedule', NO_WEEKDAYS, 0))
  }
  return { gates, foreignRows }
}

/** 门控后的到期日;`gatedOut` = 因"当日无课"被剔除的日子(不写记录),`undetermined` = 折不出星期几的日子。 */
export interface GatedDueDates {
  dates: string[]
  gatedOut: string[]
  undetermined: string[]
}

/**
 * 用一个范围的门控档位筛"到期可判"的日期。
 * **失效方向恒为"照旧判"**:`no-schedule` / `unjudged` 两档一律原样放行,
 * 只有 `gated` 才可能把日子剔掉;折不出星期几的日子同样放行(判不出 ≠ 无课)。
 */
export function gateDueDates(
  dueDates: readonly string[],
  gate: ScheduleScopeGate | undefined,
): GatedDueDates {
  if (!gate || gate.state !== 'gated') {
    return { dates: [...dueDates], gatedOut: [], undetermined: [] }
  }
  const dates: string[] = []
  const gatedOut: string[] = []
  const undetermined: string[] = []
  for (const date of dueDates) {
    const weekday = weekdayOfBizDayKey(date)
    if (weekday === null) {
      undetermined.push(date) // 量不到星期几 ⇒ 照旧判,不据此排除(§0.3)
      dates.push(date)
      continue
    }
    if (gate.weekdays.has(weekday)) dates.push(date)
    else gatedOut.push(date)
  }
  return { dates, gatedOut, undetermined }
}

// 只暴露判据与主入口给测试;judgeStatus 在 index.ts,本文件不复制。
export const __test__ = {
  isPastHm,
  normalizeHm,
  resolveBackfillDays,
  buildBizDayWindow,
  dayFloorOf,
  absentCandidatePairsForRule,
  weekdayOfBizDayKey,
  buildScopeScheduleGates,
  gateDueDates,
}
