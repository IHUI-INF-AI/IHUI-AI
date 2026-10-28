// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 业务日界唯一出口(2026-10-25 立)。
 *
 * —— 为什么必须只有一份 ——
 * "哪一天算一天"此前在 apps/api 里有 **七种**互不相同的实现:同一份 `shanghaiDayStartUtc`
 * 逐字复制在 5 个文件(db/mobile-stats-queries、routes/admin/mobile-stats、routes/admin/relay-stats、
 * routes/admin-ops-wallboard、services/relay-ops-snapshot),另有 `Date.now()+8h 再 slice`
 * 变体 2 份(services/edu-ledger、services/edu-arrear-remind-service),再加上把日界钉成 UTC 的
 * `utils/checkin-helpers.todayString`(扇出 6 个签到/积分调用点)与 `db/visit-tracking-queries`
 * 的访客日。违反 AGENTS §0.6(同类取值实现全仓只许一份,第二份必然漂移),而漂移的表现是安静的:
 * 运营大屏 BusinessSnapshot 同一屏把「今日新增用户(上海日)」与「今日签到人数(UTC 日)」并排,
 * 每天上海 00:00–08:00 之间签到格读成 0 而新增照常跳 —— 代码注释里还写着"与写入口同源(UTC)",
 * 也就是这个分叉是**被当作正确口径登记下来的**。
 *
 * —— 为什么以 Asia/Shanghai 为准 ——
 * 用户、教务账单、支付对账、以及 `packages/shared/src/utils/date-utils.ts` 的展示格式化全是上海;
 * UTC 是少数派,且它的唯一后果是"早八点前错一天"。存量历史行(已按 UTC 写入的 sign_in_date /
 * visit_date)**不做回算**:改写用户历史数据不可逆,且会让已成立的连续天数事后变化。
 * 本模块只管**从此以后**的日键与区间下界,是纯前向切换。
 *
 * 用法:`bizDayStartUtc(daysAgo)` 给 SQL 的 `>= ` 区间下界(返回 UTC 时刻);
 * `bizDayKey()` 给"日期列"的 YYYY-MM-DD 键;`shiftBizDayKey(key, n)` 给窗口回溯。
 * 不要再在端内写第四份时区算术 —— 守门 246(check-biz-day-single-source.mjs)按名字拦。
 */

/** 上海 = UTC+8(无夏令时,常量安全)。 */
const SHANGHAI_OFFSET_MS = 8 * 3600 * 1000

/** Shanghai 当天(或 daysAgo 前那当天)00:00 对应的 UTC 时刻,供 `gte(createdAt, …)` 使用。 */
export function bizDayStartUtc(daysAgo = 0): Date {
  const shanghaiNow = new Date(Date.now() + SHANGHAI_OFFSET_MS)
  return new Date(
    Date.UTC(
      shanghaiNow.getUTCFullYear(),
      shanghaiNow.getUTCMonth(),
      shanghaiNow.getUTCDate() - daysAgo,
    ) - SHANGHAI_OFFSET_MS,
  )
}

/** 把任意时刻折成 Shanghai 的 YYYY-MM-DD(趋势补洞、日期列写入键都用它)。 */
export function bizDayKey(at: Date = new Date()): string {
  const local = new Date(at.getTime() + SHANGHAI_OFFSET_MS)
  const y = local.getUTCFullYear()
  const m = String(local.getUTCMonth() + 1).padStart(2, '0')
  const d = String(local.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** 日期键偏移:days 正向后、负向前(与 bizDayKey 同一口径,不引入第三种日历算法)。 */
export function shiftBizDayKey(key: string, days: number): string {
  const base = new Date(`${key}T00:00:00Z`)
  base.setUTCDate(base.getUTCDate() + days)
  return bizDayKey(base)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
