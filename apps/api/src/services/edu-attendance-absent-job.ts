// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 缺勤补录 job(2026-11-01 立,ATT-JOB 票;2026-11-05 加回溯窗,ATT-BACKFILL 票)。
 *
 * 立因:`edu_attendance_record` 的 status 支持 absent,但**全仓无任何定时任务
 * 为"当天没签到的学生"补一条缺勤记录**(实测:`eduAttendanceRecord` 只在
 * `routes/edu-ai-management.ts` 与 schema 出现)。后果是 `GET /attendance/stats`
 * 的分母 = "表里已有的行",没来的人压根不进统计 ⇒ 报表缺勤恒 0、出勤率虚高。
 *
 * 本票补上这一格:每条 enabled 且 absentAfter 非空的规则 ⇒ 对该班在册学生,把窗口内
 * 每个"到期可判且无未软删记录"的 (学生, 日期) 补一条
 * `{status:'absent', checkInMethod:'manual', operatedBy:null}`。
 * 幂等的**实现**是写前的 (学生,日期) 对预筛(见下面"幂等"一节);
 * `edu_attendance_record` 上 `(student_id, class_id, date)` 的部分唯一索引 +
 * `onConflictDoNothing`(本仓铁律:幂等用它)只是并发兜底,不是幂等的依据。
 *
 * 在册口径(§22c 单源,不另定义):
 *   grep `apps/api/src/routes/edu-ai-management.ts` 得
 *     · L3011:`where(and(eq(eduEnrollment.studentId, childId), isNull(eduEnrollment.deletedAt)))`
 *     · L3994–3997:`conds = [isNull(eduEnrollment.deletedAt)]; if (parsed.data.status) conds.push(eq(eduEnrollment.status, parsed.data.status))`
 *     · schema L620 注释:`status: enrolled/withdrawn/graduate`
 *   ⇒ 本 job 的"在册" = `eduEnrollment.status='enrolled' ∧ isNull(deletedAt)`;
 *     withdrawn / graduate 不算在册(退学与毕业的人不该被补判缺勤)。
 *
 * 计数诚实性(blocking 门 134):
 *   created / missedIds 只认 `.returning()` 回库确认的集合(禁止把请求侧 `.length` 当
 *   affected);rules / students / skipped 是本轮**判定面**的实测计数(逐班去重后相加),
 *   不拿"打算写多少"冒充"写进了多少"。
 *
 * 契约依赖(2026-11-01 现读):S1 席已把 `eduAttendanceRule` 落到
 *   `packages/database/src/schema/edu-ai-management.ts:267`(classId/lateAfter/
 *   earlyBefore/absentAfter/enabled/deletedAt 六列齐备)。
 *
 * 时区:`absentAfter` 语义是**北京时间(Asia/Shanghai)的墙钟 HH:MM**
 *   (与 `agent-automation-scheduler.ts:22` 头注同一条纪律,不受宿主时区影响)。
 *   阈值到期判定走 Intl 显式时区,不读 `Date#setHours`。
 *
 * ── 回溯窗(2026-11-05 立,ATT-BACKFILL 票)──────────────────────────────
 * 立因:旧实现**只判跑批那一天**(`dateKey = bizDayKey(at)`),于是"班级 absent_after
 * 晚于作业实际跑批时刻"的那一日**永远不会被判定**:cron 是 UTC 10:30 = 北京 18:30
 * (`plugins/scheduler.ts` 的 `edu-attendance-absent-daily`),而 `absent_after` 按班可配,
 * 配成 19:00 / 20:00 的班级每天在 `isPastHm` 那一格被判成"未到",次日也不回头补 ⇒
 * 学生实际没来、库里一条缺勤都没有。考勤记录要落到免责链条上,**漏判 = 记录缺失**,
 * 这是考勤最要命的一类失效(而且是安静的)。
 *
 * 现口径:一轮跑批判定**含当日在内的最近 (1 + DEFAULT_BACKFILL_DAYS) 个上海业务日**。
 * 某日 D 是否"到期可判"——
 *   · D 早于当日 ⇒ 该上海日历日已经过完(24:00 晚于任何 HH:MM),阈值必然已过 ⇒ 可判;
 *   · D 就是当日 ⇒ 仍按 `isPastHm(absentAfter, at)` 现读,判据基准一字未改。
 * 判据实现只扩窗口,不引入第二份日界算术:窗口日期一律走 `utils/biz-day.ts` 的
 * `bizDayKey` / `shiftBizDayKey` 唯一出口(守门 246 按实现定罪,本文件不得自算 +8h)。
 *
 * 幂等(不靠撞唯一索引):每个 (学生, 班级, 日期) 对在写前先读"该班窗口内未软删记录"
 * 一次(一条 SQL 覆盖整窗,不按日轮询 ⇒ 读放大与旧实现同量级),命中已有行的对**根本不进
 * values**;`uq_edu_att_student_class_date` + `onConflictDoNothing` 只是并发兜底,
 * 不是幂等的实现。已有行(含 present / late / leave)一律不改写、不删除。
 *
 * 回溯下界(防"凭空造历史"):某日 D 只对 **D ≥ max(规则落库日, 该生报名日 enrollDate)**
 * 才补判 —— 规则还没建、学生还没进班的日子里不存在"缺勤"这一说,写了就是假记录。
 * 量不到界(列缺失/非法形)⇒ 不设该侧下界并在日志计数,不静默、也不误判成"不可判"。
 *
 * 窗口长度配置:走**函数入参** `options.backfillDays`(默认常量单源,封顶
 * MAX_BACKFILL_DAYS);本票不开新环境变量族 —— 这个 job 已有的开关档位是
 * `EDU_ATTENDANCE_ABSENT_DISABLED`(在 `scheduled-tasks-service.ts` 消费,本票文件外)。
 */

import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { eduAttendanceRecord, eduAttendanceRule, eduEnrollment } from '@ihui/database'
import { db } from '../db/index.js'
import { logger } from '../utils/logger.js'
import { bizDayKey, shiftBizDayKey } from '../utils/biz-day.js'
import { normalizeHm } from './edu-schedule-conflict.js'

/** 业务时区:与 patrol/automation 调度器同源,不受宿主 TZ 漂移 */
const BIZ_TIMEZONE = 'Asia/Shanghai'

/**
 * 回溯天数(**不含当日**):默认 3 ⇒ 一轮判定 4 个业务日。
 * 取 3 的依据(现读 cron = 北京 18:30 每日一跑):
 *   · 1 天 = 覆盖"absent_after 晚于跑批时刻"这一型(本票主案:今日 18:30 跑,补昨日 19:00 的班);
 *   · 2 天 = 作业整体漏跑一自然日(服务停一天)后仍能接上,不留空洞;
 *   · 3 天 = 再吃一个跨日/周末缝(周六周日两天没跑,周一那轮仍把周五~周日都判掉)并留一天余量;
 *   再往上就是拿"从未被判定过的历史"批量造缺勤行,风险大于收益 ⇒ 封顶见 MAX_BACKFILL_DAYS。
 */
export const DEFAULT_BACKFILL_DAYS = 3

/**
 * 窗口上限(含当日 ⇒ 最多 31 个业务日一起判)。单批 insert 行数 = 在册人数 × 待补日期数,
 * 再往下开就要按班/按日分批(另开票),否则一次跑批变成整表回写。
 */
export const MAX_BACKFILL_DAYS = 30

/** 跑批可选入参;不新开环境变量族,默认值一律落上面的常量。 */
export interface AbsentRunOptions {
  /** 回溯天数(不含当日)。非法/越界 ⇒ 回落默认值或封顶,并在日志点名,不静默。 */
  backfillDays?: number
}

/** 单次运行汇总;写入侧的数(created / missedIds)只认 .returning() 回库结果 */
export interface AbsentRunResult {
  /** 本轮扫到的启用规则数(仅计"至少有一个到期可判日期"的;口径随回溯窗扩,见头注) */
  rules: number
  /** 本轮纳入判定的在册学生总数(按班去重后的候选人数之和;跨窗口日期不重复计数) */
  students: number
  /** 实际写入的缺勤条数(一个学生-日期一条) */
  created: number
  /**
   * 跳过数(口径照现状,未随窗口改写):
   *   · 某班整轮无任何待写对(窗口里每个到期日的每个学生都已有未软删行)⇒ 按**在册学生数**计;
   *   · 有待写对但撞唯一索引没落库 ⇒ 按**没落库的对数**计。
   * 两档相加,既不是"学生数"也不是"行数"的单一单位 —— 沿用旧口径是为了不改
   * `scheduler-worker` 那边读到的既有语义(它只对 missedIds 问责)。
   */
  skipped: number
  /** 未落库的学生 id 集合(供二次核对/告警;门 134 要求"响应带 missedIds";按学生去重) */
  missedIds: string[]
}

/** 只暴露判据与主入口给测试;`judgeStatus` 在 edu-attendance-rule.ts,本文件不复制 */
export const __test__ = {
  isPastHm,
  normalizeHm,
  resolveBackfillDays,
  buildBizDayWindow,
  dayFloorOf,
  absentCandidatePairsForRule,
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
 * 窗口长度取值:未给 ⇒ 默认常量;非法(非整数/负数)⇒ 回落默认并 warn(不静默、不猜大值);
 * 越界 ⇒ 封顶 MAX_BACKFILL_DAYS 并 warn。0 是合法值(= 只判当日,回旧行为,测试与应急都靠它)。
 */
export function resolveBackfillDays(raw: unknown): number {
  if (raw === undefined || raw === null) return DEFAULT_BACKFILL_DAYS
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 0) {
    logger.warn('edu attendance absent job: 非法 backfillDays,回落默认窗口', {
      raw: String(raw),
      fallback: DEFAULT_BACKFILL_DAYS,
    })
    return DEFAULT_BACKFILL_DAYS
  }
  if (n > MAX_BACKFILL_DAYS) {
    logger.warn('edu attendance absent job: backfillDays 越界,按上限封顶', {
      raw: String(raw),
      capped: MAX_BACKFILL_DAYS,
    })
    return MAX_BACKFILL_DAYS
  }
  return n
}

/**
 * 含当日在内的业务日窗口,**由旧到新**返回(插入批次里旧日期先落,便于日志对眼)。
 * 日界算术一律走 utils/biz-day.ts 的 `shiftBizDayKey`(守门 246:本文件不得有第二份)。
 */
export function buildBizDayWindow(todayKey: string, backfillDays: number): string[] {
  const keys: string[] = []
  for (let i = backfillDays; i >= 0; i -= 1) keys.push(shiftBizDayKey(todayKey, -i))
  return keys
}

/**
 * 把"下界列"折成 YYYY-MM-DD:Date(带时区时间戳列)/ 'YYYY-MM-DD'(date 列)/
 * 可解析的日期串都吃;量不到 ⇒ null(= 这一侧不设下界,由调用方计数并留日志)。
 */
export function dayFloorOf(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : bizDayKey(value)
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
    const parsed = new Date(trimmed)
    return Number.isNaN(parsed.getTime()) ? null : bizDayKey(parsed)
  }
  return null
}

/** (学生, 日期) 对的指纹:与 uq_edu_att_student_class_date 的索引列同键(班级已由外层循环锁定)。 */
const pairKey = (studentId: string, date: string): string => `${studentId}|${date}`

/** 两个日键取较晚者(ISO `YYYY-MM-DD` 字典序即日序);任一侧量不到 ⇒ 返回另一侧。 */
function laterDayFloor(a: string | null, b: string | null): string | null {
  if (!a) return b
  if (!b) return a
  return a > b ? a : b
}

export interface AbsentCandidate {
  studentId: string
  classId: string
  date: string
}

/**
 * 一个班一轮的**待写对**(幂等的第一道实现:已有未软删行的对根本不进候选)。
 * 纯函数、零 IO,便于把"该不该补"这一格钉死(§22c:判据只此一份)。
 *
 * @param dueDates   窗口内"到期可判"的日期(由调用方按 absentAfter 折出)
 * @param students   去重后的在册学生 + 各自的下界(enrollDate 折出的日键,null = 量不到)
 * @param ruleFloor  规则落库日折出的日键(null = 量不到,不设该侧界)
 * @param existing   库里该班窗口内已有的未软删行
 */
export function absentCandidatePairsForRule(args: {
  classId: string
  dueDates: string[]
  students: Array<{ studentId: string; floor: string | null }>
  ruleFloor: string | null
  existing: Array<{ studentId: string; date: unknown }>
}): { candidates: AbsentCandidate[]; existingHits: number; unplacedExisting: number } {
  const existingSet = new Set<string>()
  let unplacedExisting = 0
  for (const row of args.existing) {
    const date = typeof row.date === 'string' ? row.date : null
    if (!date) {
      unplacedExisting += 1 // 量不到日期 ⇒ 不能据此排除,但必须留数(§0.3 不静默)
      continue
    }
    existingSet.add(pairKey(String(row.studentId), date))
  }

  const candidates: AbsentCandidate[] = []
  let existingHits = 0
  for (const student of args.students) {
    // 下界 = 规则落库日 与 该生报名日 里较晚的一侧(任一侧量不到 ⇒ 只按另一侧设界)
    const floor = laterDayFloor(args.ruleFloor, student.floor)
    for (const date of args.dueDates) {
      if (floor && date < floor) continue // 早于规则落库日/报名日 ⇒ 不造历史
      if (existingSet.has(pairKey(student.studentId, date))) {
        existingHits += 1
        continue
      }
      candidates.push({ studentId: student.studentId, classId: args.classId, date })
    }
  }
  return { candidates, existingHits, unplacedExisting }
}

/**
 * 主入口:缺勤补录一轮(含回溯窗)。
 * 由 `scheduled-tasks-service.recordAbsentDaily()` 包装,再由 scheduler-worker 的
 * switch case 调用;本文件不做 setInterval(§"造好没装车"= 没有)。
 *
 * 调用方**不需要**为回溯窗改任何东西:`recordAbsentDaily()` 无参调用即按默认窗口跑;
 * `options.backfillDays` 只给测试与"应急回旧行为(=0)"用,不构成新的环境变量族。
 */
export async function runAbsentAttendance(
  at: Date = new Date(),
  options: AbsentRunOptions = {},
): Promise<AbsentRunResult> {
  const todayKey = bizDayKey(at) // YYYY-MM-DD 与 edu_attendance_record.date 对齐
  const backfillDays = resolveBackfillDays(options.backfillDays)
  const windowKeys = buildBizDayWindow(todayKey, backfillDays)

  // ① 取所有 enabled 且 absentAfter 非空的规则(createdAt 用于"规则不存在的日子不补判")
  const rules = await db
    .select({
      id: eduAttendanceRule.id,
      classId: eduAttendanceRule.classId,
      absentAfter: eduAttendanceRule.absentAfter,
      createdAt: eduAttendanceRule.createdAt,
    })
    .from(eduAttendanceRule)
    .where(
      and(
        eq(eduAttendanceRule.enabled, true),
        isNull(eduAttendanceRule.deletedAt),
        sql`${eduAttendanceRule.absentAfter} IS NOT NULL`,
      ),
    )

  // ② 逐规则折"到期可判"的日期集合:窗口里早于今天的日子阈值必然已过;今天仍按墙钟现判。
  //    (判据基准 = isPastHm + Asia/Shanghai,与旧实现逐字同一条,只是不再只有"今天"一档。)
  const actionable = rules
    .map((rule) => ({
      rule,
      dueDates: windowKeys.filter(
        (d) => d !== todayKey || isPastHm(String(rule.absentAfter ?? ''), at),
      ),
    }))
    .filter((entry) => entry.dueDates.length > 0)
  if (actionable.length === 0) {
    return { rules: 0, students: 0, created: 0, skipped: 0, missedIds: [] }
  }

  let studentTotal = 0
  let createdTotal = 0
  let skippedTotal = 0
  let unplacedExistingTotal = 0
  const missedAll: string[] = []

  // ③ 逐规则:取该班在册学生 → 剔掉窗口内已有未软删记录的(学生,日期)对 → 一批 insert
  for (const { rule, dueDates } of actionable) {
    const enrolledStudents = await db
      .select({
        studentId: eduEnrollment.studentId,
        enrollDate: eduEnrollment.enrollDate,
      })
      .from(eduEnrollment)
      .where(
        and(
          eq(eduEnrollment.classId, rule.classId),
          eq(eduEnrollment.status, 'enrolled'),
          isNull(eduEnrollment.deletedAt),
        ),
      )
    // 同人多行报名 ⇒ 去重,下界取**较晚**的一行(最保守:绝不把"还没进班"的日子判成缺勤)
    const floorByStudent = new Map<string, string | null>()
    for (const row of enrolledStudents) {
      const studentId = String(row.studentId)
      const enrollFloor = dayFloorOf(row.enrollDate)
      floorByStudent.set(
        studentId,
        floorByStudent.has(studentId)
          ? laterDayFloor(floorByStudent.get(studentId) ?? null, enrollFloor)
          : enrollFloor,
      )
    }
    const studentIds = Array.from(floorByStudent.keys())
    studentTotal += studentIds.length
    if (studentIds.length === 0) continue

    const ruleFloor = dayFloorOf(rule.createdAt)

    // 已有未软删记录(整窗一条 SQL;本 job 幂等的**主实现**,不是靠撞唯一索引)
    const existing = await db
      .select({ studentId: eduAttendanceRecord.studentId, date: eduAttendanceRecord.date })
      .from(eduAttendanceRecord)
      .where(
        and(
          eq(eduAttendanceRecord.classId, rule.classId),
          inArray(eduAttendanceRecord.date, dueDates),
          inArray(eduAttendanceRecord.studentId, studentIds),
          isNull(eduAttendanceRecord.deletedAt),
        ),
      )

    const studentEntries = studentIds.map((studentId) => ({
      studentId,
      floor: floorByStudent.get(studentId) ?? null,
    }))

    const { candidates, existingHits, unplacedExisting } = absentCandidatePairsForRule({
      classId: rule.classId,
      dueDates,
      students: studentEntries,
      ruleFloor,
      existing,
    })
    unplacedExistingTotal += unplacedExisting

    if (candidates.length === 0) {
      // 口径照现状:该班整轮无待写对 ⇒ 按在册学生数计 skipped
      skippedTotal += studentIds.length
      continue
    }
    if (existingHits > 0) {
      logger.info('edu attendance absent job: 窗口内已有记录者不补', {
        classId: rule.classId,
        existingHits,
      })
    }

    const inserted = await db
      .insert(eduAttendanceRecord)
      .values(
        candidates.map((candidate) => ({
          studentId: candidate.studentId,
          classId: candidate.classId,
          date: candidate.date,
          status: 'absent',
          checkInMethod: 'manual',
          operatedBy: null,
        })),
      )
      .onConflictDoNothing()
      .returning({
        id: eduAttendanceRecord.id,
        studentId: eduAttendanceRecord.studentId,
        date: eduAttendanceRecord.date,
      })

    createdTotal += inserted.length
    const landedSet = new Set(
      inserted.map((row) => pairKey(String(row.studentId), String(row.date))),
    )
    const missed = candidates.filter((c) => !landedSet.has(pairKey(c.studentId, c.date)))
    if (missed.length > 0) {
      skippedTotal += missed.length
      for (const m of missed) if (!missedAll.includes(m.studentId)) missedAll.push(m.studentId)
    }
  }

  logger.info('edu attendance absent job done', {
    dateKey: todayKey,
    window: windowKeys,
    backfillDays,
    rules: actionable.length,
    students: studentTotal,
    created: createdTotal,
    skipped: skippedTotal,
    missedIds: missedAll.length,
    unplacedExisting: unplacedExistingTotal,
  })

  return {
    rules: actionable.length,
    students: studentTotal,
    created: createdTotal,
    skipped: skippedTotal,
    missedIds: missedAll,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
