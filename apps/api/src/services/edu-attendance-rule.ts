// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 考勤状态判定(纯函数,零 IO,2026-11-01 立)。
 *
 * 立因:`GET /attendance/stats` 的分母只算"表里已有的行",没来的人压根不进统计
 * ⇒ 报表缺勤恒 0、出勤率虚高。要把缺勤补录上,判定口径必须先住进一个能测的地方,
 * 否则路由与日终 job 会各写一份判据必然漂移(AGENTS §22c 单一真相源)。
 *
 * 判据形态:
 *  - 无 checkIn ⇒ absent(本票不依赖 rule 是否存在,没签到就是没签到)
 *  - 有 checkIn + lateAfter ⇒ HH:MM 严格大于 ⇒ late
 *  - 有 checkOut + earlyBefore ⇒ HH:MM 严格小于 ⇒ early
 *  - 阈值给了但归一化失败 ⇒ 未判定,不冒充判过(AGENTS §0.3):
 *      status 落到 'present'(契约四档封闭集),reason 前缀 `unjudged:` 可区分
 *  - 阈值缺失 / 无对应时刻 ⇒ 该维不参与判定,继续下一维
 *
 * 复用 `edu-schedule-conflict.ts` 的 `normalizeHm` 归一化 `9:00` → `09:00`
 * (AGENTS §22c 判据禁复制,`check-test-judge-not-replicated` blocking)。
 * 本文件不写第二把尺子。
 */

import { normalizeHm } from './edu-schedule-conflict.js'

/** 考勤四档封闭集(与 edu_attendance_record.status 词表对齐;leave 属请假流,不在本判据射程) */
export type AttendanceStatus = 'present' | 'late' | 'early' | 'absent'

/** judgeStatus 入参(阈值 = 规则档,时刻 = 记录档) */
export interface AttendanceJudgeInput {
  /** 迟到阈值 HH:MM;晚于此点算迟到。空串/null/undefined ⇒ 该维不判 */
  lateAfter?: string | null
  /** 早退阈值 HH:MM;早于此点算早退。空串/null/undefined ⇒ 该维不判 */
  earlyBefore?: string | null
  /** 签到时刻(带时区的 Date);null/undefined ⇒ 判 absent */
  checkInTime?: Date | null
  /** 签退时刻;null/undefined ⇒ 早退维不判 */
  checkOutTime?: Date | null
}

/** 判定明细;status 是契约封闭集,reason 让调用方区分"真判过"与"判不出" */
export interface AttendanceJudgeResult {
  status: AttendanceStatus
  /** 'ok' | 'no-check-in' | 'late:...' | 'early:...' | 'unjudged:<子因>' */
  reason: string
}

/**
 * Date → 本地墙钟 `HH:MM`(补零);非法 Date 返回 null,不猜。
 * 与 normalizeHm 配对使用:比较前两侧都必须归一化(§0.4 单源)。
 */
export function hmOfLocalDate(d: Date | null | undefined): string | null {
  if (!(d instanceof Date)) return null
  const t = d.getTime()
  if (!Number.isFinite(t)) return null
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

/** 阈值档是否"给了值":null / undefined / 空串 三态一律视为该维不判(列默认即 null) */
function hasThreshold(v: string | null | undefined): v is string {
  return v !== null && v !== undefined && v !== ''
}

/** 明细判定;`judgeStatus` 委托本函数并只回 status 字段(ATT-API 席按契约只拿状态) */
export function judgeStatusDetailed(input: AttendanceJudgeInput): AttendanceJudgeResult {
  const { lateAfter, earlyBefore, checkInTime, checkOutTime } = input

  // ① 无签到 = 缺勤:这一档不需要阈值,和"未判定"无关
  if (!checkInTime) return { status: 'absent', reason: 'no-check-in' }

  // ② 迟到维:阈值给定时才判;归一化任一侧拿不到 ⇒ 未判定(§0.3 不冒充"判过")
  if (hasThreshold(lateAfter)) {
    const threshold = normalizeHm(lateAfter)
    const actual = hmOfLocalDate(checkInTime)
    if (!threshold || !actual) {
      return { status: 'present', reason: 'unjudged:malformed-late-window' }
    }
    if (actual > threshold) {
      return { status: 'late', reason: `late:${actual}>${threshold}` }
    }
  }

  // ③ 早退维:同 ②;缺 checkOutTime 时该维不参与(没签退 ≠ 早退)
  if (hasThreshold(earlyBefore) && checkOutTime) {
    const threshold = normalizeHm(earlyBefore)
    const actual = hmOfLocalDate(checkOutTime)
    if (!threshold || !actual) {
      return { status: 'present', reason: 'unjudged:malformed-early-window' }
    }
    if (actual < threshold) {
      return { status: 'early', reason: `early:${actual}<${threshold}` }
    }
  }

  return { status: 'present', reason: 'ok' }
}

/** ATT-API 席按契约 import 的出口:名字与签名逐字为 `judgeStatus(input): status` */
export function judgeStatus(input: AttendanceJudgeInput): AttendanceStatus {
  return judgeStatusDetailed(input).status
}

// AGENTS §22c:源脚本必须 export `__test__`,镜像测试直接 import 它、不得复制判据。
// 本文件是纯 lib(无 CLI 入口),按 §22d 免 isDirectRun 守卫。
export const __test__ = {
  judgeStatus,
  judgeStatusDetailed,
  hmOfLocalDate,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
