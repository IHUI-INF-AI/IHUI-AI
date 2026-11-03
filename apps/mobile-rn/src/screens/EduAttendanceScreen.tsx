// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 校园考勤页(mobile-rn 端)—— 薄壳,复用通用控制台列表屏 ConsoleTableScreen
 * (edu-management 全原生裁决的流水线首例)。
 * 端点(与 web edu/edu-management/attendance/PageClient 同源):
 *  - GET /api/edu-ai-management/attendance?date=YYYY-MM-DD[&status=] ⇒ { list: AttendanceRecord[] }
 * 首版承载「按日考勤列表」(学生/状态徽章/签到/签退);stats 与请假管理排后续轮。
 *
 * 写接口契约(2026-11 收口,本端按此对齐):
 *  - POST check-in / batch-check-in **不再接受 status**,状态由服务端按该班 edu_attendance_rule
 *    + judgeStatus 现算;zod 会把端上硬塞的 status 静默 strip ⇒ 端上再传只是噪声,已删。
 *  - date 与 checkInTime 必须落**同一个上海业务日**:不带 checkInTime 时只允许当日(服务端取 now),
 *    跨日回填必须显式给该日内时刻 ⇒ 本屏没有时刻输入控件(交互形态只有 action sheet),
 *    故代签**限定当日**,非当日行当场拒发(不发出一条注定 400 的请求,§0.10)。
 *  - PUT check-out 的 date 是「记录定位键」(服务端写 checkOutTime=now 后重判状态,
 *    leave/absent 保留)⇒ 端上原样回发行自己的 date,不猜、不改写。
 * 三屏(教师/本人/孩子)共用本文件导出的 attendanceBizDay / attendanceStatusTone /
 * attendanceStatusLabel(§0.6 单一真相源:第二份映射必然与新契约漂移)。
 */
import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { QrCode } from 'lucide-react-native'
import { useNavigation, type NavigationProp } from '@react-navigation/native'
import { fetchApi } from '@ihui/api-client'
import {
  ConsoleTableScreen,
  type ConsoleBadgeTone,
  type ConsoleColumn,
  type ConsoleRowView,
} from '@ihui/rn-app'
import { getTokens } from '@ihui/rn-app'
import { Tappable } from '@ihui/ui-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { appAlert } from '../components/BottomPops'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

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

/**
 * 上海业务日(考勤写接口与取数 query 共用的那一把尺)。
 * 原实现用 toISOString()(UTC)⇒ 北京时间 00:00–07:59 打开本页查到的是"昨天"那一天的考勤。
 * 后端库会话时区实测 Asia/Shanghai(now() 带 +08),各聚合 SQL 也按它截日 ⇒ 前端必须同口径
 * (与 server 侧 bizDayKey 同一形态;中国无夏令时,UTC+8 可直接加偏移后取 UTC 日)。
 */
export const attendanceBizDay = (): string =>
  new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10)

/**
 * 考勤状态 → 徽章档位(三屏唯一实现)。
 * judgeStatus 产出 present/late/early/absent 四档,leave 由请假审批流写入 ⇒ 五档都得有归宿。
 * early(早退)自 2026-11「签退后重判」落地起**真会进库**,此前它落到默认档、与未知状态同色。
 * ConsoleBadgeTone 只有 ok/warn/danger/muted 四档(源在 packages/app,端内不可扩档),
 * 故 early 与 late 同用 warn,靠取词文案区分;要落 web 的五档色(early 橙/late 黄/leave 蓝)
 * 必须先扩 tone —— 已在交付报告登记为跨端同步点,不在本端自立色档。
 */
export const attendanceStatusTone = (s: string): ConsoleBadgeTone =>
  s === 'present'
    ? 'ok'
    : s === 'late' || s === 'early'
      ? 'warn'
      : s === 'absent'
        ? 'danger'
        : 'muted'

/** 状态取词:词表未命中(后端新增协议码)原样回显,不吞数据。 */
export const attendanceStatusLabel = (
  t: (key: string, params?: Record<string, string | number>) => string,
  s: string,
): string => {
  const key = `eduAttendance.status.${s}`
  const v = t(key)
  return v === key ? s : v
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
      setRecords(res.data?.list ?? [])
      setRows(
        (res.data?.list ?? []).map((r) => ({
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'load failed')
    } finally {
      setLoading(false)
    }
  }, [statusLabel])

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
  })
}

export default EduAttendanceScreen
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
