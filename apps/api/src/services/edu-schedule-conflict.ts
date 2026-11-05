// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 排课冲突检测(纯函数,2026-09-29 从路由内联逻辑抽出)。
 *
 * 为什么要抽出来:这段判断此前直接写在 `POST /scheduling/check-conflicts` 的 handler 里,
 * 于是**没有任何测试能碰到它** —— 而它恰好藏着一个静默失效型缺陷:
 * 区间重叠用的是 `a.startTime < b.endTime` 的**字符串比较**,而字符串序等于时间序
 * 只在补零的 `HH:MM` 下成立。一旦有记录存成 `9:00`(字典序里 `9:00` > `10:00`),
 * 冲突就会被判成"不冲突" —— 排课页一路报绿,老师被安排到同一时刻的两节课上。
 * 这里把规范化与判定分离:非法格式**显式计数并跳过**,不猜、也不静默漏检。
 */

export interface SchedItem {
  weekday: number
  startTime: string
  endTime: string
  teacher?: string | null
  classroom?: string | null
  courseName: string
}

const WD = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日']

/**
 * '9:00'→'09:00'、'18:30:00'→'18:30'(PG `time` 列回读形态);不合规(缺分钟、
 * 时分秒越界、非数字)返回 null,不猜。
 *
 * 为什么必须吃下 `HH:MM:SS`:`edu_attendance_rule` 的 `late_after` / `early_before` /
 * `absent_after` 是 PostgreSQL `time` 列,驱动回读给 JS 的值**恒为 `HH:MM:SS`**。
 * 旧的 `^(\d{1,2}):(\d{2})$` 只认 `HH:MM`,于是把库里真值全判成非法 ⇒ 下游
 * `isPastHm` 恒 false、`judgeStatus` 恒 `unjudged:` —— 生产上表现为"任务在跑、
 * 日志没错、就是没有缺勤/迟到记录"的静默失效。
 *
 * 秒的处理 = **截断到分钟**(不是四舍五入):本仓所有比较语义都是"当日分钟数"
 * (`isPastHm` 拿 Intl 的 hour+minute,`hmOfLocalDate` 同样只到分钟),
 * 对侧根本没有秒,进位只会凭空造出一个对不上的档位。截断的最大误差 <60s,
 * 且绝不让阈值比库里存的值"更晚生效"。秒段仍要求两数字且 ≤59,非法照旧判 null。
 */
export function normalizeHm(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(raw.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  const sec = m[3] === undefined ? 0 : Number(m[3])
  if (!Number.isFinite(h) || !Number.isFinite(min) || !Number.isFinite(sec)) return null
  if (h > 23 || min > 59 || sec > 59) return null
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

export interface ConflictResult {
  conflicts: string[]
  /** 时间格式非法而被排除出检测的行数(不静默:调用方要把它显示出来) */
  malformedTimes: number
}

/**
 * 找出同一星期几上时间重叠、且共用教师或共用教室的排课对。
 * 边界相接不算冲突(10:00-11:00 与 11:00-12:00),与抽出前一致。
 */
export function findScheduleConflicts(rows: SchedItem[]): ConflictResult {
  const conflicts: string[] = []
  let malformedTimes = 0
  const items = rows.map((r) => {
    const start = normalizeHm(r.startTime)
    const end = normalizeHm(r.endTime)
    if (!start || !end) malformedTimes += 1
    return { ...r, s: start, e: end, day: Number(r.weekday) }
  })
  for (let x = 0; x < items.length; x++) {
    for (let y = x + 1; y < items.length; y++) {
      const a = items[x]!
      const b = items[y]!
      if (!a.s || !a.e || !b.s || !b.e) continue // 非法行不参与配对,但已计数
      if (a.day !== b.day) continue
      if (!(a.s < b.e && b.s < a.e)) continue
      const when = `${WD[a.day] ?? String(a.day)} ${a.s}-${a.e}`
      if (a.teacher && a.teacher === b.teacher) {
        conflicts.push(
          `教师时间冲突:${when}「${a.courseName}」与「${b.courseName}」(教师 ${a.teacher})`,
        )
      }
      if (a.classroom && a.classroom === b.classroom) {
        conflicts.push(
          `教室占用冲突:${when}「${a.courseName}」与「${b.courseName}」(教室 ${a.classroom})`,
        )
      }
    }
  }
  return { conflicts, malformedTimes }
}

export const __test__ = { normalizeHm, findScheduleConflicts }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
