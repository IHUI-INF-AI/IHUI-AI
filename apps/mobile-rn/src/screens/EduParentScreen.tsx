// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 家长端首页(mobile-rn 端)—— 薄壳,复用通用控制台列表屏 ConsoleTableScreen。
 * 端点(与 web edu/parent/page.tsx 同源):
 *  - GET /api/edu-ai-management/parent/children ⇒ { children: ChildInfo[] }
 * 首版承载「已绑定孩子列表」(昵称/关系/状态徽章);孩子的课表/餐食/账单子页排后续轮。
 */
import { useCallback, useEffect, useState } from 'react'
import { useNavigation, type NavigationProp } from '@react-navigation/native'
import { appAlert } from '../components/BottomPops'
import { fetchApi } from '@ihui/api-client'
import {
  ConsoleTableScreen,
  type ConsoleBadgeTone,
  type ConsoleColumn,
  type ConsoleRowView,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

interface ChildInfo {
  bindingId: string
  studentId: string
  relationship: string
  status: string
  student: { id: string; username: string; nickname: string; avatar: string | null } | null
}

function EduParentScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp<RootStackParamList>>()
  const [rows, setRows] = useState<ConsoleRowView[]>([])
  const [children, setChildren] = useState<ChildInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const statusLabel = useCallback(
    (s: string) => {
      const v = t(`eduParent.status.${s}`)
      return v === `eduParent.status.${s}` ? s : v
    },
    [t],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchApi<{ children: ChildInfo[] }>(
        '/api/edu-ai-management/parent/children',
      )
      if (!res.success) throw new Error(res.error || 'load failed')
      const list = res.data?.children ?? []
      setChildren(list)
      setRows(
        list.map((c) => ({
          id: c.bindingId,
          cells: {
            child: c.student?.nickname ?? c.studentId,
            relationship: c.relationship,
            status: statusLabel(c.status),
          },
          badgeTone: (c.status === 'active' || c.status === 'confirmed'
            ? 'ok'
            : 'muted') as ConsoleBadgeTone,
        })),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'load failed')
    } finally {
      setLoading(false)
    }
  }, [statusLabel])

  const onRowPress = useCallback(
    (row: ConsoleRowView) => {
      const child = children.find((c) => c.bindingId === row.id)
      if (!child) return
      const nav = (
        screen:
          | 'EduChildSchedule'
          | 'EduChildAttendance'
          | 'EduChildGrades'
          | 'EduChildMeals'
          | 'EduChildBills'
          | 'EduChildStudyPlans',
      ) => navigation.navigate(screen, { childId: child.studentId })
      void appAlert(child.student?.nickname ?? child.studentId, t('eduParent.chooseView'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('eduSchedule.title'), onPress: () => nav('EduChildSchedule') },
        { text: t('eduChildAttendance.title'), onPress: () => nav('EduChildAttendance') },
        { text: t('eduChildGrades.title'), onPress: () => nav('EduChildGrades') },
        { text: t('eduChildMeals.title'), onPress: () => nav('EduChildMeals') },
        { text: t('eduChildBills.title'), onPress: () => nav('EduChildBills') },
        { text: t('eduChildStudyPlans.title'), onPress: () => nav('EduChildStudyPlans') },
      ])
    },
    [children, navigation, t],
  )

  useEffect(() => {
    void load()
  }, [load])

  const columns: ConsoleColumn[] = [
    { key: 'child', title: t('eduParent.child'), flex: 2 },
    { key: 'relationship', title: t('eduParent.relationship') },
    { key: 'status', title: t('eduParent.statusTitle'), render: 'badge' },
  ]

  return (
    <ConsoleTableScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      title={t('eduParent.title')}
      columns={columns}
      rows={rows}
      loading={loading}
      error={error}
      onRetry={() => void load()}
      onRefresh={() => void load()}
      onRowPress={onRowPress}
    />
  )
}

export default EduParentScreen
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
