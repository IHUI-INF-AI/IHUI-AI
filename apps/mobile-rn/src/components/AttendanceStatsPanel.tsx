// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 教师考勤屏的「统计区 + 趋势区」(只由 EduAttendanceScreen 消费;算术一律在 ./edu-attendance-stats.ts)。
//
// 对齐目标:
//  - 小程序 apps/miniapp-taro/src/pkg-user/edu-mgmt-attendance/stats-panel.tsx —— 同一份数据源、
//    同一个 14 日窗口、同一档卡片/条/色块形态(AGENTS §4「小程序与 RN 必须长成同一张脸」);
//  - web apps/web/app/(main)/edu/edu-management/attendance/AttendanceTrendChart.tsx —— 同一条口径
//    (出勤率 = 正常出勤人次 ÷ 该时段有考勤记录人次)。
//
// 为什么不用图表库:web 那台是 recharts(组件头注自述「平台特有:依赖 DOM/SVG」),本端没有该依赖,
// 也不该为一张趋势图新引依赖。同端先例 apps/mobile-rn/src/screens/EduGradeTrendScreen.tsx 消费的
// 共享屏画法就是「折线图 → 逐档色条」:堆叠横条 + 逐时段读数把同一份 series 表达完整,
// 零新依赖、算术可被纯函数用例钉住(视图层一个数字都不重算)。
//
// 段色纪律:一律由状态档 tone 得出(单源 ./attendance-status),不为五枚协议码另开一份「码 → 色」表。
// 视觉档纪律:卡片 rounded-lg + 中性描边 border.light + surface.card;条高/色块取 rnSpacing 与
// rnRadius.xs(与小程序侧 rounded-xs 同档);读数单行(AGENTS「读数不得断行」),等分读数格同时给
// flexWrap 与 minWidth(守门 241 V1/V2 两条缺一不可)。
import { useMemo } from 'react'
import { StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native'
import { BarChart3 } from 'lucide-react-native'
import { getTokens, type ConsoleBadgeTone } from '@ihui/rn-app'
import { rnGeometry, rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { attendanceStatusLabel } from './attendance-status'
import {
  OTHER_SEGMENT,
  TREND_WINDOW_DAYS,
  buildAttendanceTrendSeries,
  readAttendanceStats,
  type AttendanceStatsPayload,
  type AttendanceTrendSegment,
  type AttendanceTrendSegmentKey,
} from './edu-attendance-stats'

type Translate = (key: string, params?: Record<string, string | number>) => string

export interface AttendanceStatsPanelProps {
  /** stats 端点原样响应;null = 还没有到货(首帧/失败) */
  payload: AttendanceStatsPayload | null
  /** 取数中:给一条 muted 载入行,不给假读数 */
  loading: boolean
  /** 取数失败的常驻回显(已取过词);空串 = 无 */
  error: string
  /** 取词与配色由屏侧注入(与 ConsoleTableScreen / 共享屏同一形态,面板不自建 hook) */
  t: Translate
  colorScheme: 'light' | 'dark'
}

export function AttendanceStatsPanel({
  payload,
  loading,
  error,
  t,
  colorScheme,
}: AttendanceStatsPanelProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createPanelStyles(tk), [tk])
  const readout = useMemo(() => readAttendanceStats(payload), [payload])
  const series = useMemo(() => buildAttendanceTrendSeries(payload?.periodBreakdown ?? []), [payload])

  /** 段色档:四档 tone 唯一映射(与小程序侧 TONE_BG_CLASS 同族:success/warning/destructive/中性) */
  const fillOf = (tone: ConsoleBadgeTone): string =>
    tone === 'ok'
      ? tk.success.DEFAULT
      : tone === 'danger'
        ? tk.danger.DEFAULT
        : tone === 'warn'
          ? tk.warning.DEFAULT
          : tk.text.tertiary

  /** 段名:五枚协议码走屏侧取词单源,other 走独立键(词表不扩档) */
  const labelOf = (key: AttendanceTrendSegmentKey): string =>
    key === OTHER_SEGMENT ? t('eduAttendance.statusOther') : attendanceStatusLabel(t, key)

  if (payload === null && !loading && error === '') return null

  const scopeLabel = t('eduAttendance.trendChartScope', {
    scope: t('eduAttendance.trendWindow', { days: TREND_WINDOW_DAYS }),
  })

  return (
    <View style={styles.group} testID="attendance-stats-panel">
      {/* ── 统计区:状态构成(数据源 = statusBreakdown + 服务端 total / attendanceRate)── */}
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <BarChart3 size={rnGeometry.controlGlyph} color={tk.text.secondary} strokeWidth={2} />
          <Text style={styles.cardTitle}>{t('eduAttendance.statusDistribution')}</Text>
          <Text style={styles.scopeText}>{scopeLabel}</Text>
        </View>
        {loading ? <Text style={styles.dim}>{t('common.loading')}</Text> : null}
        {error !== '' ? <Text style={styles.dim}>{error}</Text> : null}

        <View style={styles.valueRow}>
          <Text style={styles.dim}>{t('eduAttendance.statsTotalLabel')}</Text>
          <Text style={styles.readoutValue}>{String(readout.total)}</Text>
        </View>
        <View style={styles.valueRow}>
          <Text style={styles.dim}>{t('eduAttendance.statsAttendanceRate')}</Text>
          <Text style={styles.readoutValue}>
            {readout.attendanceRate === null ? '—' : `${readout.attendanceRate}%`}
          </Text>
        </View>

        {readout.segments.length === 0 ? (
          <Text style={styles.dim}>{t('eduAttendance.emptyTrend')}</Text>
        ) : (
          readout.segments.map((seg) => (
            <SegmentBar
              key={seg.key}
              styles={styles}
              seg={seg}
              label={labelOf(seg.key)}
              fill={fillOf(seg.tone)}
            />
          ))
        )}
      </View>

      {/* ── 趋势区:逐时段堆叠构成 + 出勤率(数据源 = periodBreakdown 聚合)── */}
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <BarChart3 size={rnGeometry.controlGlyph} color={tk.text.secondary} strokeWidth={2} />
          <Text style={styles.cardTitle}>{t('eduAttendance.trendChartTitle')}</Text>
        </View>
        <Text style={styles.dim}>{t('eduAttendance.trendChartHint')}</Text>

        {series.length === 0 ? (
          <Text style={styles.dim}>{t('eduAttendance.emptyTrend')}</Text>
        ) : (
          series.map((point) => (
            <View key={point.period} style={styles.pointBlock}>
              <View style={styles.valueRow}>
                <Text style={styles.dim}>{point.period}</Text>
                <Text style={styles.readoutValue}>{`${point.attendanceRate}%`}</Text>
              </View>
              <View style={styles.track}>
                {point.segments.map((seg) => (
                  <View
                    key={seg.key}
                    style={[
                      styles.fill,
                      { width: `${seg.share}%`, backgroundColor: fillOf(seg.tone) },
                    ]}
                  />
                ))}
              </View>
              <View style={styles.legendRow}>
                {point.segments.map((seg) => (
                  <View key={seg.key} style={styles.legendItem}>
                    <View style={[styles.dot, { backgroundColor: fillOf(seg.tone) }]} />
                    <Text style={styles.dim}>{`${labelOf(seg.key)} ${seg.count}`}</Text>
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

function SegmentBar({
  styles,
  seg,
  label,
  fill,
}: {
  styles: PanelStyles
  seg: AttendanceTrendSegment
  label: string
  fill: string
}) {
  return (
    <View style={styles.pointBlock}>
      <View style={styles.valueRow}>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: fill }]} />
          <Text style={styles.dim}>{label}</Text>
        </View>
        <Text style={styles.readoutValue}>{`${seg.count} · ${seg.pct}%`}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${seg.share}%`, backgroundColor: fill }]} />
      </View>
    </View>
  )
}

function createPanelStyles(tk: ReturnType<typeof getTokens>) {
  return StyleSheet.create({
    group: { gap: rnSpacing.sm, paddingHorizontal: rnSpacing.lg },
    card: {
      padding: rnSpacing.md,
      gap: rnSpacing.sm,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.xs },
    cardTitle: { fontSize: rnType.label.size, fontWeight: '600', color: tk.text.primary },
    scopeText: {
      flexShrink: 0,
      fontSize: rnType.caption.size,
      color: tk.text.tertiary,
      marginLeft: 'auto',
    },
    dim: { fontSize: rnType.caption.size, color: tk.text.secondary },
    /* 标签 + 读数一行:space-between 行内的读数必须 flexShrink:0(守门 241 V3) */
    valueRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
    },
    readoutValue: {
      fontSize: rnType.strong.size,
      fontWeight: '600',
      color: tk.text.primary,
      flexShrink: 0,
    },
    pointBlock: { gap: rnSpacing['2xs'] },
    legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing.sm },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing['2xs'] },
    dot: { width: rnSpacing.sm, height: rnSpacing.sm, borderRadius: rnRadius.xs, flexShrink: 0 },
    /* 条与填充:细于 16px 不构成胶囊形态;圆角取 tiny 档(与小程序侧 rounded-xs 同档) */
    track: {
      flexDirection: 'row',
      height: rnSpacing['xs-loose'],
      borderRadius: rnRadius.xs,
      backgroundColor: tk.surface.muted,
      overflow: 'hidden',
    },
    fill: { height: rnSpacing['xs-loose'], borderRadius: rnRadius.xs },
  } satisfies Record<string, ViewStyle | TextStyle>)
}

type PanelStyles = ReturnType<typeof createPanelStyles>

export default AttendanceStatsPanel
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
