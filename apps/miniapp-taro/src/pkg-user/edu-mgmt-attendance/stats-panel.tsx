// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 教师考勤页的**统计区 + 趋势区**(只在 edu-mgmt-attendance 内消费;算术一律在 ./stats.ts)。
//
// 对齐目标(RN 共享屏):无 —— 本区与 web 端
// apps/web/app/(main)/edu/edu-management/attendance/AttendanceTrendChart.tsx 同一份数据源
// (GET /attendance/stats 的 statusBreakdown / periodBreakdown)、同一档口径
// (出勤率 = present ÷ 该时段有记录的人次)。
//
// 为什么不用图表库:web 端那台是 recharts(DOM/SVG,组件头注自述「平台特有:依赖 DOM/SVG」),
// 本端既没有该依赖也不该为一张趋势图新引依赖。堆叠横条 + 逐时段读数把同一份 series 表达完整,
// 零依赖、可被纯函数测试钉住(算术全在 stats.ts,视图层一个数字都不重算)。
//
// 视觉档纪律(照本端在册用词,不新开档):
//  - 卡片:`rounded-lg border border-border bg-card`(结构性边框,描边取中性档,不取墨档)
//  - 色块/条填充:`TONE_BG_CLASS`(contract 的 tone 表第二列,四档)
//  - 条高 `h-2`(与 ProgressBar 的 md 档同名同值)、色块 `w-2 h-2`、圆角 `rounded-xs`(2px 角色档)
//  - 一格一读数:读数一律 `whitespace-nowrap tabular-nums`,放不下只能减列(AGENTS「读数不得断行」)
import { useMemo, type ReactNode } from 'react'
import { View, Text } from '@tarojs/components'
import { useI18n } from '@/i18n'
import LineIcon from '@/components/LineIcon'
import { TONE_BG_CLASS, statusLabelOf } from './contract'
import {
  OTHER_SEGMENT,
  TREND_WINDOW_DAYS,
  buildTrendSeries,
  readStats,
  type AttendanceStatsPayload,
  type TrendSegmentKey,
} from './stats'

/** 卡片外壳:与同页 ChildRecordsView 的行卡同一档(rounded-lg + 中性描边 + bg-card)。 */
const CARD = 'rounded-lg border border-border bg-card p-4 space-y-2'
/** 读数文字:单行、等宽数字(断行即违规,见 AGENTS「读数不得断行」)。 */
const READOUT = 'text-xs text-foreground whitespace-nowrap tabular-nums'
const READOUT_DIM = 'text-xs text-muted-foreground whitespace-nowrap tabular-nums'
/** 段名文字(与色块同一行,整行可换行,但一格里只有一个读数)。 */
const SEGMENT_LABEL = 'text-xs text-muted-foreground whitespace-nowrap'
/** 堆叠/占比条的轨道:h-2 与 ProgressBar md 同档,细于 16px ⇒ 不是胶囊形态。 */
const TRACK = 'h-2 w-full overflow-hidden rounded-xs bg-muted'
/** 条内一段:只交宽度,颜色走 tone 表。 */
const FILL = 'h-full shrink-0 rounded-xs'

export interface AttendanceStatsPanelProps {
  /** stats 端点原样响应;null = 还没有到货(首帧/失败) */
  payload: AttendanceStatsPayload | null
  /** 取数中:给一条 muted 载入行,不给假读数 */
  loading: boolean
  /** 取数失败的常驻回显(已由传输层或调用方取过词);空串 = 无 */
  error: string
}

export function AttendanceStatsPanel(options: AttendanceStatsPanelProps): ReactNode {
  const { t } = useI18n()
  const readout = useMemo(() => readStats(options.payload), [options.payload])
  const series = useMemo(
    () => buildTrendSeries(options.payload?.periodBreakdown ?? []),
    [options.payload],
  )

  /** 段键 → 文案:五枚协议码走 contract 的取词出口,other 走独立键(词表不扩档)。 */
  const labelOf = (key: TrendSegmentKey): string =>
    key === OTHER_SEGMENT ? t('eduAttendance.statusOther') : statusLabelOf(key, t)

  const windowLabel = t('eduAttendance.trendWindow', { days: TREND_WINDOW_DAYS })
  const scopeLabel = t('eduAttendance.trendChartScope', { scope: windowLabel })

  if (!options.payload && !options.loading && options.error === '') return null

  return (
    <View className="w-full space-y-2">
      {options.loading ? <Text className={READOUT_DIM}>{t('common.loading')}</Text> : null}
      {options.error ? <Text className={READOUT_DIM}>{options.error}</Text> : null}

      {/* ── 统计区:状态构成(数据源 = statusBreakdown + 服务端 total / attendanceRate)── */}
      <View className={CARD}>
        <View className="flex items-center justify-between gap-2">
          <View className="flex items-center gap-1">
            <LineIcon name="bar-chart-3" size={28} />
            <Text className="text-sm font-bold text-foreground">
              {t('eduAttendance.statusDistribution')}
            </Text>
          </View>
          <Text className={READOUT_DIM}>{scopeLabel}</Text>
        </View>

        <View className="flex items-center justify-between gap-2">
          <Text className={SEGMENT_LABEL}>{t('eduAttendance.statsTotalLabel')}</Text>
          <Text className={READOUT}>{`${readout.total}`}</Text>
        </View>
        <View className="flex items-center justify-between gap-2">
          <Text className={SEGMENT_LABEL}>{t('eduAttendance.statsAttendanceRate')}</Text>
          <Text className={READOUT}>
            {readout.attendanceRate === null ? '—' : `${readout.attendanceRate}%`}
          </Text>
        </View>

        {readout.rows.length === 0 ? (
          <Text className={READOUT_DIM}>{t('eduAttendance.emptyTrend')}</Text>
        ) : (
          readout.rows.map((seg) => (
            <View key={seg.key} className="space-y-1">
              <View className="flex items-center justify-between gap-2">
                <View className="flex items-center gap-1">
                  <View className={`w-2 h-2 shrink-0 rounded-xs ${TONE_BG_CLASS[seg.tone]}`} />
                  <Text className={SEGMENT_LABEL}>{labelOf(seg.key)}</Text>
                </View>
                <Text className={READOUT}>{`${seg.count} · ${seg.pct}%`}</Text>
              </View>
              <View className={TRACK}>
                <View
                  className={`${FILL} ${TONE_BG_CLASS[seg.tone]}`}
                  style={{ width: `${seg.share}%` }}
                />
              </View>
            </View>
          ))
        )}
      </View>

      {/* ── 趋势区:逐时段堆叠构成 + 出勤率(数据源 = periodBreakdown 聚合)── */}
      <View className={CARD}>
        <View className="flex items-center gap-1">
          <LineIcon name="bar-chart-3" size={28} />
          <Text className="text-sm font-bold text-foreground">
            {t('eduAttendance.trendChartTitle')}
          </Text>
        </View>
        <Text className="text-xs text-muted-foreground">{t('eduAttendance.trendChartHint')}</Text>

        {series.length === 0 ? (
          <Text className={READOUT_DIM}>{t('eduAttendance.emptyTrend')}</Text>
        ) : (
          series.map((point) => (
            <View key={point.period} className="space-y-1">
              <View className="flex items-center justify-between gap-2">
                <Text className={SEGMENT_LABEL}>{point.period}</Text>
                <Text className={READOUT}>{`${point.attendanceRate}%`}</Text>
              </View>
              <View className={TRACK}>
                {point.segments.map((seg) => (
                  <View
                    key={seg.key}
                    className={`${FILL} ${TONE_BG_CLASS[seg.tone]}`}
                    style={{ width: `${seg.share}%` }}
                  />
                ))}
              </View>
              <View className="flex flex-wrap items-center gap-2">
                {point.segments.map((seg) => (
                  <View key={seg.key} className="flex items-center gap-1">
                    <View className={`w-2 h-2 shrink-0 rounded-xs ${TONE_BG_CLASS[seg.tone]}`} />
                    <Text className={READOUT_DIM}>{`${labelOf(seg.key)} ${seg.count}`}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))
        )}
      </View>
    </View>
  )
}

export default AttendanceStatsPanel
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
