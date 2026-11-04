// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { createHmac } from 'node:crypto'
import type { FastifyReply } from 'fastify'

import { eq, and, desc, isNull } from 'drizzle-orm'

import { db } from '../db/index.js'
// 导出行的行类型靠 `paginate` 的返回类型派生(与拆分件同一份实现,不在本文件重写一遍分页形状)
import type { paginate } from './edu-ai-management-schemas-extended.js'

// =============================================================================
// 2026-11-08 考勤四缺口补齐(ATT-API 票)新增依赖 —— 三处都是"复用仓内单源,不再造第二份":
//   · judgeStatus  = 考勤状态判定(present/late/early/absent)的唯一实现,归 ATT-JOB 席;
//                    本文件禁止内联第二份判据(AGENTS §0.6 单一真相源)。
//   · secretsEqual = 全仓唯一定长时间比较出口(plugins/internal-service-token.ts:130,
//                    定长 SHA-256 后 timingSafeEqual);扫码签到 HMAC 校验只走它,不自拼比较。
//   · bizDayKey    = 上海墙钟日期键单源(utils/biz-day.ts),与缺勤补录 job 同一口径,
//                    不引入第三种日历算法(现读 check-in 里那句 toISOString() 是 UTC 口径,
//                    新端点一律按 bizDayKey,不与跨日边界再打架)。
// 契约依赖现读(本票收尾时复测):`eduAttendanceRule`(ATT-DB 席)与
// `apps/api/src/services/edu-attendance-rule.ts`(ATT-JOB 席)**已在盘上落定**
// (packages/database/src/schema/edu-ai-management.ts 的 eduAttendanceRule / 服务文件均实测存在),
// 故本文件的 import 不需要替身、也不得内联第二份判据;两席改动未落盘的窗口期里,
// 本文件按登记名先行 import,红项只在缺失符号那一处(§0.3:没判的绝不写成判过)。
// =============================================================================
import { judgeStatus } from '../services/edu-attendance-rule.js'
import { secretsEqual } from '../plugins/internal-service-token.js'
import { bizDayKey, shiftBizDayKey } from '../utils/biz-day.js'
import { sanitizeCsvCell } from '../utils/csv-utils.js'
import { eduAttendanceRecord, eduAttendanceRule, eduEnrollment } from '@ihui/database'
// 2026-08-30 教师角色 RBAC 接入:教务管理端点由 requireAdmin 改为 requirePermission('edu:manage')
// admin(users.roleId >= 1)在 requirePermission 内自动豁免,行为不变;
// 持有 teacher 角色的普通用户(roleId=0)经 RBAC 表校验后可访问教务管理端点

import { error } from '../utils/response.js'

// 8b. 考勤补齐的模块级出口(2026-11-08,ATT-API 票)
// =============================================================================

/** 扫码 token 有效期:60 秒。教学现场"教师投码 → 学生扫码"在一分钟内完成;
 *  取短 TTL 是因为载荷里没有一次性 nonce —— 同班同窗口内 token 对全班等价,长 TTL 等于把
 *  可重放窗口交给走廊里举着手机的人。 */
export const ATT_QR_TOKEN_TTL_MS = 60_000

/**
 * 把 [startDate, endDate] 折成逐日日期键数组(含两端)。
 * 走 `shiftBizDayKey`(与 `bizDayKey` 同一口径),不引入第二套日历算法。
 * 上界 366 天:请假单跨年是异常数据,而"异常时无界循环"正是补录类写操作最坏的形态,
 * 故超限直接抛错让调用方回 400,而不是默默写几千行。
 */
export function enumerateAttendanceDates(startDate: string, endDate: string): string[] {
  const out: string[] = []
  let cursor = startDate
  // 字符串 YYYY-MM-DD 的字典序 == 时间序,无需再解一次 Date
  while (cursor <= endDate) {
    out.push(cursor)
    if (out.length > 366) throw new Error('LEAVE_RANGE_TOO_WIDE')
    cursor = shiftBizDayKey(cursor, 1)
  }
  return out
}

/** 班级考勤规则(enabled 且未软删);无规则 ⇒ null,由调用方按"无阈值"退化,不自造默认阈值。
 *  只读单例 db(不接 tx):本函数读的是**配置**不是被写的那行,把它塞进事务只会让 tx 类型在
 *  drizzle 的 db/tx 两态之间反复妥协;判据本身仍由 judgeStatus 单源承担。 */
export async function loadEnabledAttendanceRule(classId: string): Promise<{
  lateAfter: string | null
  earlyBefore: string | null
  qrSecret: string | null
} | null> {
  const [rule] = await db
    .select()
    .from(eduAttendanceRule)
    .where(
      and(
        eq(eduAttendanceRule.classId, classId),
        eq(eduAttendanceRule.enabled, true),
        isNull(eduAttendanceRule.deletedAt),
      ),
    )
    .limit(1)
  if (!rule) return null
  return {
    lateAfter: rule.lateAfter ?? null,
    earlyBefore: rule.earlyBefore ?? null,
    qrSecret: rule.qrSecret ?? null,
  }
}

/**
 * 教师侧签到两入口(单人代签 / 批量点名)的统一前置(2026-11 本票立,推广 checkInByStudent
 * 已定档的正确口径,不新造判据):
 *   ① checkInTime 与记录 date 必须落在同一个上海业务日(bizDayKey 单源口径,守门 246):
 *        未显式给时刻 ⇒ 只有当日业务日才取服务器 now,回填历史日一律拒收;
 *        显式给时刻 ⇒ 解析失败或跨业务日同样拒收(§0.3,不静默回落成 now);
 *   ② status 一律由 judgeStatus + 该班 edu_attendance_rule 现算,入参 schema 已删 status,
 *        客户端自报值被 zod strip 后结构上进不了库。
 * 本函数体内不出现任何阈值比较 —— 迟到的那把尺始终在 judgeStatus(§0.6 单一真相源)。
 */
export async function resolveTeacherCheckIn(params: {
  classId: string
  date: string
  checkInTimeRaw?: string | undefined
  now: Date
}): Promise<{ ok: true; checkInTime: Date; status: string } | { ok: false; message: string }> {
  const { classId, date, checkInTimeRaw, now } = params
  let checkInTime: Date
  if (checkInTimeRaw === undefined) {
    if (bizDayKey(now) !== date)
      return { ok: false, message: '回填非当日的考勤必须显式提供该日内的签到时刻 checkInTime' }
    checkInTime = now
  } else {
    const d = new Date(checkInTimeRaw)
    if (Number.isNaN(d.getTime())) return { ok: false, message: 'checkInTime 不是合法时刻' }
    if (bizDayKey(d) !== date) return { ok: false, message: 'checkInTime 必须与考勤日期 date 同日' }
    checkInTime = d
  }
  const rule = await loadEnabledAttendanceRule(classId)
  const status = judgeStatus({
    lateAfter: rule?.lateAfter ?? null,
    earlyBefore: rule?.earlyBefore ?? null,
    checkInTime,
    checkOutTime: null,
  })
  return { ok: true, checkInTime, status }
}

/**
 * 签退重判的优先级保护(2026-11 本票②):leave(请假审批联动写入)与 absent(日终补录/
 * 判定写入)都比 present/late/early 三档的"当日在场结论"优先级高,
 * 签退重判绝不把这两态洗回去;其余状态才交 judgeStatus 现判(早退维自此真能落库)。
 * 本函数只答"原态是否保留",不答"该判成什么"——判定阈值仍单源在 judgeStatus。
 */
export function statusPreservedOnCheckOut(status: string): boolean {
  return status === 'leave' || status === 'absent'
}

/** edu_attendance_rule 的行形态(随表定义走,不在端点里各抄一份字段清单)。 */
export type AttendanceRuleRow = typeof eduAttendanceRule.$inferSelect

/**
 * 规则行对外的唯一投影出口(本票①契约):响应**绝不含 qrSecret 原文**,
 * 只回 qrSecretConfigured 布尔 —— 密钥只作为 HMAC 的 key 参与签名,不落任何出参。
 */
export function toAttendanceRuleDto(row: AttendanceRuleRow | null): {
  id: string
  classId: string
  lateAfter: string | null
  earlyBefore: string | null
  absentAfter: string | null
  enabled: boolean
  qrSecretConfigured: boolean
  createdAt: Date
  updatedAt: Date
} | null {
  if (!row) return null
  return {
    id: row.id,
    classId: row.classId,
    lateAfter: row.lateAfter ?? null,
    earlyBefore: row.earlyBefore ?? null,
    absentAfter: row.absentAfter ?? null,
    enabled: row.enabled,
    qrSecretConfigured: Boolean(row.qrSecret),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

/**
 * 自签班级归属的服务端现取(本票②),顺序固定两步,没有第三步兜底:
 *   ① 该生当日已有未软删考勤行所属班级(同日再次签退/补签仍落同一个班);
 *   ② 否则 eduEnrollment 中该生 status='enrolled' ∧ 未软删、按 createdAt 倒序最近一条的 classId
 *      (在册口径与批量点名、缺勤补录 job 同源,不另定义);
 *   两步都取不到 ⇒ null,由调用方回 409 给可读 reason —— 禁止回落成"随便挑一个班"。
 */
export async function resolveSelfCheckInClassId(
  studentId: string,
  date: string,
): Promise<string | null> {
  const [todayRow] = await db
    .select({ classId: eduAttendanceRecord.classId })
    .from(eduAttendanceRecord)
    .where(
      and(
        eq(eduAttendanceRecord.studentId, studentId),
        eq(eduAttendanceRecord.date, date),
        isNull(eduAttendanceRecord.deletedAt),
      ),
    )
    .limit(1)
  if (todayRow?.classId) return todayRow.classId

  const [enrollment] = await db
    .select({ classId: eduEnrollment.classId })
    .from(eduEnrollment)
    .where(
      and(
        eq(eduEnrollment.studentId, studentId),
        eq(eduEnrollment.status, 'enrolled'),
        isNull(eduEnrollment.deletedAt),
      ),
    )
    .orderBy(desc(eduEnrollment.createdAt))
    .limit(1)
  return enrollment?.classId ?? null
}

/** 扫码 token 的载荷形态(decode 单点:出码校验与解班两处共用,不各写一份 JSON.parse)。 */
export type AttendanceQrDecoded = { classId: string; exp: number; sig: string }

/** 解析 base64url token 载荷;形态不合 ⇒ null(调用方按 TOKEN_MALFORMED 处理)。 */
export function decodeAttendanceQrToken(rawToken: string): AttendanceQrDecoded | null {
  let decoded: unknown
  try {
    decoded = JSON.parse(Buffer.from(rawToken, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  const t = decoded as { classId?: unknown; exp?: unknown; sig?: unknown }
  if (
    !t ||
    typeof t.classId !== 'string' ||
    typeof t.exp !== 'number' ||
    typeof t.sig !== 'string' ||
    t.sig.length === 0
  )
    return null
  return { classId: t.classId, exp: t.exp, sig: t.sig }
}

/**
 * 生成签到二维码载荷的 token 部分:classId + 到期时刻经 qrSecret 做 HMAC-SHA256。
 * 载荷里**绝不含密钥原文**(qrSecret 只作为 HMAC 的 key 参与签名,不入 token、不入响应)。
 */
export function buildAttendanceQrToken(
  classId: string,
  qrSecret: string,
  nowMs: number,
  ttlMs: number,
): { token: string; expiresAtMs: number } {
  const expiresAtMs = nowMs + ttlMs
  const signature = createHmac('sha256', qrSecret).update(`${classId}|${expiresAtMs}`).digest('hex')
  const token = Buffer.from(
    JSON.stringify({ v: 1, classId, exp: expiresAtMs, sig: signature }),
    'utf8',
  ).toString('base64url')
  return { token, expiresAtMs }
}

/** token 校验的四类失败码(逐类点名,不并成一句"校验失败" —— 现场排障要能分清是过期还是签错) */
export type AttendanceQrVerifyFailure =
  'TOKEN_MALFORMED' | 'TOKEN_CLASS_MISMATCH' | 'TOKEN_EXPIRED' | 'TOKEN_SIGNATURE_INVALID'

/**
 * 校验扫码 token。返回 null 表示通过,否则给出失败码。
 * 签名比较必须走 `secretsEqual`(全仓唯一定长时间出口):直接 `a === b` 会按公共前缀长度早退,
 * 等于把 HMAC 的每一位花一次请求慢慢试出来。
 */
export function verifyAttendanceQrToken(
  rawToken: string,
  classId: string,
  qrSecret: string,
  nowMs: number,
): AttendanceQrVerifyFailure | null {
  const t = decodeAttendanceQrToken(rawToken)
  if (!t) return 'TOKEN_MALFORMED'
  if (t.classId !== classId) return 'TOKEN_CLASS_MISMATCH'
  if (nowMs > t.exp) return 'TOKEN_EXPIRED'
  const expected = createHmac('sha256', qrSecret).update(`${t.classId}|${t.exp}`).digest('hex')
  if (!secretsEqual(expected, t.sig)) return 'TOKEN_SIGNATURE_INVALID'
  return null
}

/** CSV 单元格转义:先用仓内单源的公式注入防护(sanitizeCsvCell),再处理逗号/引号/换行。 */
export function toCsvCell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value)
  const safe = sanitizeCsvCell(raw)
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** edu_attendance_record 的行形态(随表定义走,不在端点里各抄一份字段清单)。 */
export type AttendanceRow = typeof eduAttendanceRecord.$inferSelect

/** 导出行的形态 = 共享出口 paginate 的返回元素类型;本票不另抄一份列清单,也不为此改 paginate 签名。 */
export type AttendanceExportRow = Awaited<ReturnType<typeof paginate>>['list'][number]

/** 时间列 → ISO 8601:paginate 的行类型到 unknown 为止,故这里按运行时形态判,不做断言。 */
export function toIsoCell(value: unknown): string {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string' && value.length > 0) return new Date(value).toISOString()
  return ''
}

/** 扫码 token 四类失败的措辞单点表(状态码在端点、措辞在这里,两条端点不再各写一份)。 */
export const ATT_QR_FAILURE_MESSAGES: Record<AttendanceQrVerifyFailure, string> = {
  TOKEN_MALFORMED: '二维码内容不合法',
  TOKEN_CLASS_MISMATCH: '二维码与所选班级不匹配',
  TOKEN_EXPIRED: '二维码已过期,请让老师重新出示',
  TOKEN_SIGNATURE_INVALID: '二维码签名校验失败',
}

/** 学生侧签到的三类失败(与 HTTP 码解耦:同一 reason 在自签与扫码两条端点上落同一状态码)。 */
export type StudentCheckInFailure = 'not_enrolled' | 'duplicate' | 'failed'

/**
 * 学生侧签到的共用落库出口(自签 / 扫码同一条链,动作只有一份实现):
 *   ① 在册校验:与批量点名、缺勤补录 job **同一口径**(eduEnrollment.status='enrolled' ∧ 未软删),
 *      退学/毕业的人不能自签进本班名册 ⇒ 不在册即失败(承载层回 403);
 *   ② 当日已有未软删记录 ⇒ 失败(duplicate),**不静默覆盖**已存在的行;
 *   ③ status 由 `judgeStatus` + 该班 `edu_attendance_rule` 现算,不接受客户端传 status,
 *      本函数也不复算阈值(§0.6:判据单源,第二份必然漂移)。
 */
export async function checkInByStudent(params: {
  studentId: string
  classId: string
  date: string
  checkInMethod: 'self' | 'qrcode'
  operatedBy: string
  remark?: string | undefined
}): Promise<{ ok: true; record: AttendanceRow } | { ok: false; reason: StudentCheckInFailure }> {
  const { studentId, classId, date, checkInMethod, operatedBy, remark } = params

  const [enrollment] = await db
    .select({ id: eduEnrollment.id })
    .from(eduEnrollment)
    .where(
      and(
        eq(eduEnrollment.studentId, studentId),
        eq(eduEnrollment.classId, classId),
        eq(eduEnrollment.status, 'enrolled'),
        isNull(eduEnrollment.deletedAt),
      ),
    )
    .limit(1)
  if (!enrollment) return { ok: false, reason: 'not_enrolled' }

  const rule = await loadEnabledAttendanceRule(classId)
  const now = new Date()
  const status = judgeStatus({
    lateAfter: rule?.lateAfter ?? null,
    earlyBefore: rule?.earlyBefore ?? null,
    checkInTime: now,
    checkOutTime: null,
  })

  try {
    const txResult = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(eduAttendanceRecord)
        .where(
          and(
            eq(eduAttendanceRecord.studentId, studentId),
            eq(eduAttendanceRecord.classId, classId),
            eq(eduAttendanceRecord.date, date),
            isNull(eduAttendanceRecord.deletedAt),
          ),
        )
        .limit(1)
      if (existing) return { state: 'duplicate' as const }
      const inserted = await tx
        .insert(eduAttendanceRecord)
        .values({
          studentId,
          classId,
          date,
          checkInTime: now,
          status,
          checkInMethod,
          // operatedBy 显式写登录态本人:归属由承载层入参给(AGENTS §5),
          // 与教师代签(operatedBy=教师)落在同一列上,事后追责读这一列即可。
          operatedBy,
          remark,
        })
        .onConflictDoNothing()
        .returning()
      return { state: 'inserted' as const, rows: inserted }
    })
    if (txResult.state === 'duplicate') return { ok: false, reason: 'duplicate' }
    const record = txResult.rows[0]
    if (!record) return { ok: false, reason: 'failed' }
    return { ok: true, record }
  } catch (_err) {
    return { ok: false, reason: 'failed' }
  }
}

/** 学生侧签到失败 → HTTP 三态(403 不在册 / 409 已存在 / 500 落库失败)。 */
export function studentCheckInFailureReply(
  reply: FastifyReply,
  reason: StudentCheckInFailure,
): FastifyReply {
  if (reason === 'not_enrolled') return reply.status(403).send(error(403, '该账号不是本班在册学生'))
  if (reason === 'duplicate') return reply.status(409).send(error(409, '今日已有考勤记录'))
  return reply.status(500).send(error(500, '签到失败'))
}
