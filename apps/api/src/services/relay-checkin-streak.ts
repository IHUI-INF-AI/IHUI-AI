// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 签到连续天数判据(2026-11-17 立,对标 qoder2api-hub 的「签到连续天数 / streak」)。
 *
 * 本仓此前只留最近一条签到记录(`pool_status.lastRecord`),没有历史序列 ⇒ 连续天数无从算起。
 * 2026-11-17 起 `ai_relay_checkin_history` 按天落一条;本层只负责**把日期集合算成 streak**。
 *
 * 三条纪律:
 * - **纯判据**:只吃日期字符串数组 + "今天",零 IO、零时区依赖(日期按 UTC 零点做算术,
 *   归属日的换算在写入侧完成,不在这里猜时区)。
 * - **今天没签不算断**:当前连续段优先从 today 起算;today 缺失但 yesterday 在 ⇒ 从 yesterday
 *   起算(用户今天还没点,不等于断了)。today 与 yesterday 都无 ⇒ current = 0。
 * - **无历史不是 0 天**:`available:false` + 原因,绝不把"没记录"说成"一天都没签过"。
 */

export interface CheckinStreakResult {
  /** 是否有任何历史记录;false 时 current/longest 均为 0 且带 reason */
  available: boolean
  /** 当前连续天数(含今天,或今天未签时截至昨天) */
  current: number
  /** 历史最长连续天数 */
  longest: number
  /** 最近一条归属日(YYYY-MM-DD) */
  last_day: string | null
  /** 计入 current 的那段日期(升序) */
  counted_days: string[]
  reason?: string
}

const DAY_MS = 86_400_000
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

/** 'YYYY-MM-DD' → UTC 零点毫秒;非法返回 null。 */
function dayToMs(day: string): number | null {
  if (typeof day !== 'string' || !DAY_RE.test(day)) return null
  const ms = Date.parse(`${day}T00:00:00Z`)
  return Number.isFinite(ms) ? ms : null
}

/** 毫秒 → 'YYYY-MM-DD'(UTC);用 toISOString 的前 10 位,零时区歧义。 */
function msToDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

/** 日期加减天。 */
export function shiftDay(day: string, deltaDays: number): string | null {
  const ms = dayToMs(day)
  if (ms === null) return null
  return msToDay(ms + deltaDays * DAY_MS)
}

/**
 * 计算连续天数(纯函数)。
 *
 * `days` 可以含重复、乱序、非法串 —— 本函数自行去重并丢弃非法值,调用方不必预清洗。
 */
export function computeCheckinStreak(days: string[], today: string): CheckinStreakResult {
  const valid: string[] = []
  const seen = new Set<string>()
  for (const raw of days) {
    const ms = dayToMs(raw)
    if (ms === null || seen.has(raw)) continue
    seen.add(raw)
    valid.push(raw)
  }
  valid.sort()

  if (valid.length === 0) {
    return {
      available: false,
      current: 0,
      longest: 0,
      last_day: null,
      counted_days: [],
      reason: '尚无签到历史(本表自 2026-11-17 起记录)',
    }
  }

  const set = new Set(valid)

  // 当前连续段:优先 today;today 未签则允许从 yesterday 起(今天没点 ≠ 断了)
  let cursor: string | null = null
  if (set.has(today)) cursor = today
  else {
    const yesterday = shiftDay(today, -1)
    if (yesterday && set.has(yesterday)) cursor = yesterday
  }
  const counted: string[] = []
  while (cursor && set.has(cursor)) {
    counted.push(cursor)
    cursor = shiftDay(cursor, -1)
    if (counted.length > valid.length + 1) break // 防御:数据异常时不无限循环
  }
  counted.reverse()

  // 历史最长段:升序遍历,比较相邻两天是否相差 1 天
  let longest = 1
  let run = 1
  for (let i = 1; i < valid.length; i += 1) {
    const prev = dayToMs(valid[i - 1] ?? '')
    const cur = dayToMs(valid[i] ?? '')
    if (prev === null || cur === null) continue
    if (cur - prev === DAY_MS) {
      run += 1
      if (run > longest) longest = run
    } else {
      run = 1
    }
  }

  return {
    available: true,
    current: counted.length,
    longest,
    last_day: valid[valid.length - 1] ?? null,
    counted_days: counted,
  }
}

/**
 * 把"今天"按 UTC+8 求出来 —— 签到归属日口径与调度器一致(全部中国时间)。
 *
 * 这是本文件里**唯一**碰时区的函数,且只在"取今天"这一处用;判据本身仍是纯日期算术。
 */
export function todayInUtc8(now: Date = new Date()): string {
  return new Date(now.getTime() + 8 * 3_600_000).toISOString().slice(0, 10)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
