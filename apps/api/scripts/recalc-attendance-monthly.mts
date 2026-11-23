// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 考勤月表精度回填(2026-11-23 立)。
 *
 * 背景:月结曾用 `toFixed(1)` 写 scheduled_days / actual_days / absent_days,
 * 21.75 被截成 21.8(标准月均计薪天数 21.75 是算日工资的分母,差 0.05 天会在
 * 大团队月薪上放大成元级偏差)。列已在迁移 445 改 numeric(5,2),写入侧同日
 * 改 `toFixed(2)`;存量行仍带着旧值,由本器物按月重跑月结回填。
 *
 * 纪律:
 *   · 一律复用月结服务 buildMonthlyAttendance(单一口径),脚本内不重算一套;
 *   · 已签字(signed)月份**不动**(overwriteSigned=false),只报 skippedSigned —— 签过的账不后台改;
 *   · 默认预演,`--apply` 才落盘;每月打印 before/after 的一-位小数计数。
 *
 * 用法(生产机):
 *   node --experimental-strip-types apps/api/scripts/recalc-attendance-monthly.mts
 *   node --experimental-strip-types apps/api/scripts/recalc-attendance-monthly.mts --apply
 *   ... --from 2025-01 --to 2026-10
 */
import 'dotenv/config'
import postgres from 'postgres'
import { buildMonthlyAttendance } from '../src/services/hr-attendance-settle.js'
import { AppError } from '../src/errors/AppError.js'

const APPLY = process.argv.includes('--apply')

function argValue(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

interface MonthStat {
  periodMonth: string
  rows: number
  oneDecScheduled: number
  oneDecActual: number
  oneDecAbsent: number
}

/** 一位小数的字面值 = 旧 toFixed(1) 留下的痕迹(21.8 而非 21.75/21.80) */
const STAT_SQL = `
  SELECT period_month AS "periodMonth",
         count(*)::int AS "rows",
         count(*) FILTER (WHERE scheduled_days::text ~ '\\.[0-9]$')::int AS "oneDecScheduled",
         count(*) FILTER (WHERE actual_days::text    ~ '\\.[0-9]$')::int AS "oneDecActual",
         count(*) FILTER (WHERE absent_days::text    ~ '\\.[0-9]$')::int AS "oneDecAbsent"
  FROM hr_attendance_monthly
  GROUP BY period_month
  ORDER BY period_month
`

async function run(): Promise<void> {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) throw new Error('DATABASE_URL 未设置,拒绝回填(不猜默认值)。')
  const sql = postgres(url, { max: 2 })

  const from = argValue('from')
  const to = argValue('to')
  if (from && !MONTH_RE.test(from)) throw new Error(`--from 必须是 YYYY-MM,收到 ${from}`)
  if (to && !MONTH_RE.test(to)) throw new Error(`--to 必须是 YYYY-MM,收到 ${to}`)

  try {
    const all = await sql.unsafe<MonthStat[]>(STAT_SQL)
    const months = all.filter(
      (m) => (!from || m.periodMonth >= from) && (!to || m.periodMonth <= to),
    )
    if (months.length === 0) {
      console.log('没有落在范围内的月表行,无需回填。')
      return
    }

    const before = months.reduce(
      (s, m) => s + m.oneDecScheduled + m.oneDecActual + m.oneDecAbsent,
      0,
    )
    console.log(
      `${APPLY ? 'APPLY' : 'DRY-RUN'} 月份=${months.length} 行=${all.reduce((s, m) => s + m.rows, 0)} ` +
        `一位小数字段=${before}`,
    )

    if (!APPLY) {
      for (const m of months) {
        if (m.oneDecScheduled + m.oneDecActual + m.oneDecAbsent === 0) continue
        console.log(
          `  ${m.periodMonth} rows=${m.rows} scheduled=${m.oneDecScheduled} ` +
            `actual=${m.oneDecActual} absent=${m.oneDecAbsent}`,
        )
      }
      console.log('预演结束;加 --apply 落盘。')
      return
    }

    let rebuilt = 0
    let skippedNoDaily = 0
    let skippedSigned = 0
    for (const m of months) {
      try {
        const r = await buildMonthlyAttendance({
          periodMonth: m.periodMonth,
          overwriteSigned: false,
        })
        rebuilt++
        skippedSigned += r.skippedSigned
        console.log(
          `  ${m.periodMonth} employees=${r.employees} updated=${r.updated} ` +
            `inserted=${r.inserted} skippedSigned=${r.skippedSigned}`,
        )
      } catch (err) {
        // 该月没有日结数据(历史只导了月表) → 无法按日粒度重算,记未判定并原样保留
        if (err instanceof AppError && err.errorCode === 'ATT_NO_DAILY_DATA') {
          skippedNoDaily++
          console.log(`  ${m.periodMonth} SKIP 无日结数据,保留原值(未判定)`)
          continue
        }
        throw err
      }
    }

    const after = await sql.unsafe<MonthStat[]>(STAT_SQL)
    const remaining = after
      .filter((m) => (!from || m.periodMonth >= from) && (!to || m.periodMonth <= to))
      .reduce((s, m) => s + m.oneDecScheduled + m.oneDecActual + m.oneDecAbsent, 0)
    console.log(
      `完成 重建月=${rebuilt} 无日结跳过=${skippedNoDaily} 已签字跳过=${skippedSigned} ` +
        `一位小数字段 前=${before} 后=${remaining}`,
    )
    if (remaining > 0) {
      console.log('仍有残留:多半是已签字月份或无日结数据月份,需人工决定是否回退。')
    }
  } finally {
    await sql.end({ timeout: 5 })
  }
}

void run().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exitCode = 1
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
