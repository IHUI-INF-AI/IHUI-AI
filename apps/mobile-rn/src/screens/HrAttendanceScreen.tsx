// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import {
  HrAttendanceScreen as SharedHrAttendanceScreen,
  type HrAttendanceRecord,
} from '@ihui/rn-app'
import { attendanceBizDay } from '../components/attendance-status'
import { appAlert } from '../components/BottomPops'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** 后端 GET /hr-attendance/attendance/records 的 list 项(比共享屏多 employeeId,端内用不上) */
interface HrRecordResponse extends HrAttendanceRecord {
  employeeId?: string
}

/**
 * 人事部 · 考勤(移动端员工自助,2026-11-09 立;2026-11-13 改为屏级共享薄壳)。
 *
 * UI 已整体下沉到 @ihui/rn-app 的 HrAttendanceScreen。注意小程序端 pkg-hr/hr-attendance
 * 目前走的是 edu-child 的 ChildRecordsView 只读列表,**不含**签到表单 —— 两端形态不同,
 * 本屏暂只被 RN 端使用;要真正三端同源需小程序端补签到入口(归功能拍板,不在迁移射程)。
 * 本壳只保留平台专属的四处:导航返回、fetchApi 取数、登录态提示通道 appAlert、
 * 以及**业务日口径** —— `attendanceBizDay()` 取上海日,与后端 `bizDayKey` 同尺。
 *
 * 签到所需的 employeeId / departmentId 仍由本地输入提供(正式接入时改为取登录态对应的
 * 在职员工上下文,operatedBy 已由后端取 userId)。
 */
export default function HrAttendanceScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [records, setRecords] = useState<HrAttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [employeeId, setEmployeeId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [focusField, setFocusField] = useState<'employeeId' | 'departmentId' | null>(null)
  // XUI-069:列表按 departmentId 重拉,旧响应后到会把新部门的记录盖掉 ⇒ 请求序号守卫。
  const reqSeqRef = useRef(0)
  // XUI-070:`busy` 是 state,同 tick 连点两次都读到 false ⇒ 用 ref 入口锁。
  const checkingInRef = useRef(false)
  // 请求回调可能在卸载后到达 ⇒ 拦掉跨屏状态污染。
  const mountedRef = useRef(true)

  useEffect(
    () => () => {
      mountedRef.current = false
    },
    [],
  )

  const load = useCallback(
    async (refresh = false) => {
      const seq = (reqSeqRef.current += 1)
      if (refresh) setRefreshing(true)
      else setLoading(true)
      try {
        const q = departmentId.trim()
          ? `?departmentId=${encodeURIComponent(departmentId.trim())}`
          : ''
        const res = await fetchApi<{ list: HrRecordResponse[] }>(
          `/api/hr-attendance/attendance/records${q}`,
        )
        if (seq !== reqSeqRef.current || !mountedRef.current) return
        if (res.success) setRecords(res.data?.list ?? [])
      } catch {
        if (seq !== reqSeqRef.current || !mountedRef.current) return
        appAlert(t('hrAttendance.title'), t('common.loadFailed'))
      } finally {
        if (seq === reqSeqRef.current && mountedRef.current) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    },
    [departmentId, t],
  )

  useEffect(() => {
    void load()
  }, [load])

  const checkIn = async () => {
    if (!employeeId.trim() || !departmentId.trim() || checkingInRef.current) return
    checkingInRef.current = true
    setBusy(true)
    try {
      const res = await fetchApi('/api/hr-attendance/attendance/check-in', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: employeeId.trim(),
          departmentId: departmentId.trim(),
          // 必须取上海业务日:后端 hrCheckIn 用 bizDayKey(`Asia/Shanghai`)判 bad_date。
          // 裸 `toISOString()` 是 UTC ⇒ 北京时间 00:00–07:59 会把"昨天"当签到日送上去,
          // 后端拒、前端只弹一句"日期必须是当日或合法的历史业务日" —— 看着当天钟点却签不上。
          date: attendanceBizDay(),
          checkInMethod: 'self',
        }),
      })
      if (!mountedRef.current) return
      if (!res.success) appAlert(t('hrAttendance.title'), res.error)
      else {
        appAlert(t('hrAttendance.title'), t('hrAttendance.createSuccess'))
        void load(true)
      }
    } catch {
      if (mountedRef.current) appAlert(t('hrAttendance.title'), t('common.loadFailed'))
    } finally {
      checkingInRef.current = false
      if (mountedRef.current) setBusy(false)
    }
  }

  return (
    <SharedHrAttendanceScreen
      t={t}
      records={records}
      loading={loading}
      refreshing={refreshing}
      busy={busy}
      employeeId={employeeId}
      departmentId={departmentId}
      focusField={focusField}
      onEmployeeIdChange={setEmployeeId}
      onDepartmentIdChange={setDepartmentId}
      onFocusField={setFocusField}
      onCheckIn={() => void checkIn()}
      onRefresh={() => void load(true)}
      onBack={() => navigation.goBack()}
    />
  )
}
