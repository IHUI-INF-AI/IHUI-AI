// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 校园考勤页(mobile-rn 端)—— 教师管理端(与「我的考勤」「孩子考勤」两屏并列的那一个),
 * 薄壳复用通用控制台列表屏 ConsoleTableScreen(edu-management 全原生裁决的流水线首例)。
 * 端点(与 web edu/edu-management/attendance/PageClient、小程序 edu-mgmt-attendance 同源):
 *  - GET /api/edu-ai-management/attendance?date=YYYY-MM-DD[&status=] ⇒ { list: AttendanceRecord[] }
 *  - GET /api/edu-ai-management/attendance/stats?period=&startDate=&endDate[&classId=]
 *    ⇒ { total, attendanceRate, statusBreakdown, periodBreakdown }(统计区 + 趋势区的数据源)
 * 列表只收单日、无区间参数且分页上限 100,趋势按天逐次请求即 N+1 ⇒ 统计与趋势一律走 stats,
 * 端上只做二次聚合(算术单源 ../components/edu-attendance-stats.ts,后端一行不改)。
 *
 * 写接口契约(2026-11 收口,本端按此对齐):
 *  - POST check-in / batch-check-in **不再接受 status**,状态由服务端按该班 edu_attendance_rule
 *    + judgeStatus 现算;zod 会把端上硬塞的 status 静默 strip ⇒ 端上再传只是噪声,已删。
 *  - date 与 checkInTime 必须落**同一个上海业务日**:不带 checkInTime 时只允许当日(服务端取 now),
 *    跨日回填必须显式给该日内时刻 ⇒ 本屏没有时刻输入控件(交互形态只有 action sheet),
 *    故代签**限定当日**,非当日行当场拒发(不发出一条注定 400 的请求,§0.10)。
 *  - PUT check-out 的 date 是「记录定位键」(服务端写 checkOutTime=now 后重判状态,
 *    leave/absent 保留)⇒ 端上原样回发行自己的 date,不猜、不改写。
 * 三屏(教师/本人/孩子)共用的 attendanceBizDay / attendanceStatusTone / attendanceStatusLabel
 * 单源在 ../components/attendance-status(本文件 re-export 保持既有 import 路径不变)。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { QrCode } from 'lucide-react-native'
import { useNavigation, type NavigationProp } from '@react-navigation/native'
import { fetchApi } from '@ihui/api-client'
import { ConsoleTableScreen, type ConsoleColumn, type ConsoleRowView } from '@ihui/rn-app'
import { getTokens } from '@ihui/rn-app'
import { Tappable } from '@ihui/ui-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { appAlert } from '../components/BottomPops'
import { AttendanceStatsPanel } from '../components/AttendanceStatsPanel'
import {
  attendanceBizDay,
  attendanceStatusLabel,
  attendanceStatusTone,
} from '../components/attendance-status'
import {
  attendanceStatsUrl,
  firstAttendanceClassId,
  type AttendanceStatsPayload,
} from '../components/edu-attendance-stats'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

// 状态档三枚出口已提到端内单源(屏与统计面板共用,互相 import 会成环)——
// 三屏(本人/孩子)仍从本文件取,实现只有一份,这里只 re-export。
export { attendanceBizDay, attendanceStatusLabel, attendanceStatusTone }
export type { AttendanceBadgeTone } from '../components/attendance-status'

interface AttendanceRecord {
  id: string
  studentId: string
  /** 后端考勤行携带的班级归属;代签/签退/整班点名端点都以它为必填入参 */
  classId?: string | null
  date: string
  checkInTime: string | null
  checkOutTime: string | null
  /** 服务端按该班规则现算的只读投影(present/late/early/absent/leave);端上一律不自报 */
  status: string
  remark: string | null
}

/** 整班点名响应(契约字段逐字:created/skipped/missedIds) */
interface BatchCheckInResult {
  created: number
  skipped: number
  missedIds: string[]
}

function EduAttendanceScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp<RootStackParamList>>()
  const [rows, setRows] = useState<ConsoleRowView[]>([])
  /** 原始记录:写操作发起时按 id 取 studentId/classId/date,不复算、不本地造 */
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  /** 写操作在途标记:按钮/行操作在请求期间一律拒绝再触发(不本地乐观改状态) */
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  /**
   * 统计区 + 趋势区的那一次 stats 取数(端点与参数单源在 ../components/edu-attendance-stats.ts)。
   * 刻意挂在列表回读之后、而不是另起一个独立 effect:两处各自取数必然出现两个不同时刻的分母,
   * 同批触发才能保证「清单是新的、统计也是新的」(与小程序侧 edu-mgmt-attendance/index.tsx 同做法)。
   */
  const [stats, setStats] = useState<AttendanceStatsPayload | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsError, setStatsError] = useState('')
  /** seq 吃掉跨业务日/重入的竞态:回来的不是最新那一批 ⇒ 整批丢弃,不把旧日读数挂到新页面上 */
  const statsSeq = useRef(0)

  const loadStats = useCallback(
    async (list: AttendanceRecord[]): Promise<void> => {
      const seq = ++statsSeq.current
      const settle = (next: AttendanceStatsPayload | null, err: string): void => {
        if (statsSeq.current !== seq) return
        setStats(next)
        setStatsError(err)
        setStatsLoading(false)
      }
      setStatsLoading(true)
      setStatsError('')
      // 窗口起点算不出来(日键形状不合契约)⇒ 连请求都不发,只落一条常驻回显(§0.10)
      const url = attendanceStatsUrl({ date: attendanceBizDay(), classId: firstAttendanceClassId(list) })
      if (!url) {
        settle(null, t('eduAttendance.loadStatsFailed'))
        return
      }
      try {
        const res = await fetchApi<AttendanceStatsPayload>(url)
        if (!res.success) {
          settle(null, `${t('eduAttendance.loadStatsFailed')}:${res.error ?? '-'}`)
          return
        }
        settle(res.data ?? null, '')
      } catch (e) {
        settle(
          null,
          `${t('eduAttendance.loadStatsFailed')}:${e instanceof Error ? e.message : '-'}`,
        )
      }
    },
    [t],
  )

  const tk = getTokens(resolvedTheme)
  const styles = createScreenStyles(tk)

  const statusLabel = useCallback((s: string) => attendanceStatusLabel(t, s), [t])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchApi<{ list: AttendanceRecord[] }>(
        `/api/edu-ai-management/attendance?date=${attendanceBizDay()}`,
      )
      if (!res.success) throw new Error(res.error || 'load failed')
      const list = res.data?.list ?? []
      setRecords(list)
      setRows(
        list.map((r) => ({
          id: r.id,
          cells: {
            student: r.studentId,
            status: statusLabel(r.status),
            checkIn: r.checkInTime?.slice(11, 16) ?? '—',
            checkOut: r.checkOutTime?.slice(11, 16) ?? '—',
            remark: r.remark ?? '',
          },
          badgeTone: attendanceStatusTone(r.status),
        })),
      )
      // 统计/趋势与列表同批触发,但**不 await**:列表先上屏,统计到货再补两张卡片;
      // 统计失败只由面板常驻回显,不把整页拖成错误态(与小程序侧同一条纪律)。
      void loadStats(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'load failed')
    } finally {
      setLoading(false)
    }
  }, [loadStats, statusLabel])

  useEffect(() => {
    void load()
  }, [load])

  /** 行 id → 原始记录(发起写操作时取 studentId/classId/date,不复算、不本地造) */
  const recordById = new Map(records.map((r) => [r.id, r]))

  /** 整班点名候选班级 = 当日列表里去重后的 classId(不新增取数端点) */
  const classIds = [...new Set(records.map((r) => r.classId).filter((c): c is string => !!c))]

  /**
   * 教师代签/签退:成功后重新 GET 列表,以服务端回读为准(不做本地乐观更新)。
   * 契约(2026-11 收口):POST check-in {studentId,classId,date}、PUT check-out 同三键;
   * **没有 status**(状态服务端现算),check-in 的 date 只能是当前上海业务日(不带 checkInTime
   * 时服务端取 now;跨日回填须显式给该日内时刻,本屏无时刻输入控件 ⇒ 当场拒发并点名)。
   */
  const runRowAction = useCallback(
    async (record: AttendanceRecord, kind: 'check-in' | 'check-out') => {
      if (busy) return
      if (!record.classId) {
        appAlert(t('eduAttendance.title'), t('eduAttendance.needClassId'))
        return
      }
      const rowDay = record.date?.slice(0, 10) ?? ''
      const bizDay = attendanceBizDay()
      if (kind === 'check-in' && rowDay !== bizDay) {
        // 非当日行(取数与点击之间跨了业务日,或列表被换成历史日)⇒ 不发注定 400 的请求
        appAlert(t('eduAttendance.title'), t('eduAttendance.onlyTodayCheckIn'))
        return
      }
      setBusy(true)
      try {
        const res = await fetchApi(
          `/api/edu-ai-management/attendance/${kind}`,
          kind === 'check-in'
            ? {
                method: 'POST',
                body: JSON.stringify({
                  studentId: record.studentId,
                  classId: record.classId,
                  date: bizDay,
                }),
              }
            : {
                method: 'PUT',
                body: JSON.stringify({
                  studentId: record.studentId,
                  classId: record.classId,
                  // 签退的 date 是记录定位键(服务端写 checkOutTime=now 后按规则重判状态)
                  // ⇒ 原样回发行自己的业务日,不改写成"今天"
                  date: rowDay,
                }),
              },
        )
        appAlert(
          t('eduAttendance.title'),
          res.success
            ? t('eduAttendance.actionDone')
            : `${t('eduAttendance.actionFailed')}:${res.error ?? '-'}`,
        )
        if (res.success) await load()
      } catch (e) {
        appAlert(
          t('eduAttendance.title'),
          `${t('eduAttendance.actionFailed')}:${e instanceof Error ? e.message : '-'}`,
        )
      } finally {
        setBusy(false)
      }
    },
    [busy, load, t],
  )

  const onRowPress = useCallback(
    (row: ConsoleRowView) => {
      const record = recordById.get(row.id)
      if (!record) return
      void appAlert(record.studentId, t('eduAttendance.chooseAction'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('eduAttendance.checkIn'), onPress: () => void runRowAction(record, 'check-in') },
        {
          text: t('eduAttendance.checkOut'),
          onPress: () => void runRowAction(record, 'check-out'),
        },
      ])
    },

    [recordById, runRowAction, t],
  )

  /** 整班点名:POST .../batch-check-in {classId,date} ⇒ {created,skipped,missedIds}(无 status,状态服务端现算) */
  const runBatch = useCallback(
    async (classId: string) => {
      if (busy) return
      setBusy(true)
      try {
        const res = await fetchApi<BatchCheckInResult>(
          '/api/edu-ai-management/attendance/batch-check-in',
          { method: 'POST', body: JSON.stringify({ classId, date: attendanceBizDay() }) },
        )
        if (res.success && res.data) {
          appAlert(
            t('eduAttendance.batchTitle'),
            t('eduAttendance.batchResult', {
              created: res.data.created,
              skipped: res.data.skipped,
              missed: res.data.missedIds?.length ?? 0,
            }),
          )
          await load()
        } else {
          appAlert(
            t('eduAttendance.batchTitle'),
            `${t('eduAttendance.actionFailed')}:${res.error ?? '-'}`,
          )
        }
      } catch (e) {
        appAlert(
          t('eduAttendance.batchTitle'),
          `${t('eduAttendance.actionFailed')}:${e instanceof Error ? e.message : '-'}`,
        )
      } finally {
        setBusy(false)
      }
    },
    [busy, load, t],
  )

  const openBatch = useCallback(() => {
    if (classIds.length === 0) {
      appAlert(t('eduAttendance.batchTitle'), t('eduAttendance.noClass'))
      return
    }
    void appAlert(t('eduAttendance.batchTitle'), t('eduAttendance.chooseClass'), [
      { text: t('common.cancel'), style: 'cancel' },
      ...classIds.map((classId) => ({ text: classId, onPress: () => void runBatch(classId) })),
    ])
  }, [classIds, runBatch, t])

  const columns: ConsoleColumn[] = [
    { key: 'student', title: t('eduAttendance.student'), render: 'mono', flex: 2 },
    { key: 'status', title: t('eduAttendance.statusTitle'), render: 'badge' },
    { key: 'checkIn', title: t('eduAttendance.checkIn') },
    { key: 'checkOut', title: t('eduAttendance.checkOut') },
    { key: 'remark', title: t('eduAttendance.remark'), flex: 2 },
  ]

  return (
    <View style={styles.shell}>
      <Tappable
        onPress={openBatch}
        pressedStyle={styles.pressed}
        accessibilityRole="button"
        style={styles.batchBtn}
      >
        <Text style={styles.batchBtnText}>{t('eduAttendance.batchTitle')}</Text>
      </Tappable>
      {/* 扫码签到「出码」入口:教师选班 → 展示 60s TTL 载荷二维码(屏实现见 EduAttendanceQrScreen) */}
      <Tappable
        onPress={() => navigation.navigate('EduAttendanceQr')}
        pressedStyle={styles.pressed}
        accessibilityRole="button"
        style={styles.qrBtn}
      >
        <QrCode size={15} color={tk.text.primary} />
        <Text style={styles.qrBtnText}>{t('eduAttendance.qrEntry')}</Text>
      </Tappable>
      {/* 统计区 + 趋势区:与 web 统计 Tab / 小程序面板同一份数据源、同一档形态。
          RN 侧 ConsoleTableScreen 自带滚动且无可插槽位 ⇒ 本端用限高滚动区承载同一份内容
          (平台独占形态差异,内容/取数/档位三样都对齐)。 */}
      <ScrollView style={styles.statsArea} showsVerticalScrollIndicator={false}>
        <AttendanceStatsPanel
          payload={stats}
          loading={statsLoading}
          error={statsError}
          t={t}
          colorScheme={resolvedTheme}
        />
      </ScrollView>
      <ConsoleTableScreen
        t={t}
        colorScheme={resolvedTheme}
        onBack={() => navigation.goBack()}
        title={t('eduAttendance.title')}
        columns={columns}
        rows={rows}
        loading={loading}
        error={error}
        onRetry={() => void load()}
        onRefresh={() => void load()}
        onRowPress={onRowPress}
      />
    </View>
  )
}

function createScreenStyles(tk: ReturnType<typeof getTokens>) {
  return StyleSheet.create({
    shell: { flex: 1, backgroundColor: tk.surface.bg },
    batchBtn: {
      marginHorizontal: rnSpacing.lg,
      marginTop: rnSpacing.md,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
      paddingVertical: rnSpacing.sm,
      paddingHorizontal: rnSpacing.lg,
      alignItems: 'center',
      opacity: 1,
    },
    batchBtnText: {
      color: tk.brand.ctaForeground,
      fontSize: rnType.body.size,
      fontWeight: '600',
    },
    // 次级入口(非 CTA 实底):中性描边 + 面板底,避免与「整班点名」争唯一主按钮
    qrBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.xs,
      marginHorizontal: rnSpacing.lg,
      marginTop: rnSpacing.sm,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      paddingVertical: rnSpacing.sm,
      paddingHorizontal: rnSpacing.lg,
    },
    qrBtnText: {
      color: tk.text.primary,
      fontSize: rnType.body.size,
    },
    pressed: { opacity: 0.85 },
    // 统计/趋势的限高滚动区:内容再长也不把下面的清单挤出屏幕(上限是真上限,不是偏好值)
    statsArea: { flexGrow: 0, maxHeight: '45%' },
  })
}

export default EduAttendanceScreen
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
