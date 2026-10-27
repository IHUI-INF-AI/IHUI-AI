// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 家长端首页(mobile-rn 端)。
 * 端点(与 web edu/parent/page.tsx 同源):
 *  - GET /api/edu-ai-management/parent/children ⇒ { children: ChildInfo[] }
 *
 * 两个 Tab(G-26 ③ 补齐"家长视角"):
 *  - 孩子:已绑定孩子列表(昵称/关系/状态徽章),点行选择要看的孩子子页;
 *  - 孩子账单:EduParentBillsView 的聚合视图 —— 一孩子一卡,直接回答
 *    "我几个孩子各欠多少、哪个最近到期"(单孩子明细仍走 EduChildBills)。
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native'
import { useNavigation, type NavigationProp } from '@react-navigation/native'
import { appAlert } from '../components/BottomPops'
import { fetchApi } from '@ihui/api-client'
import { BackChevron, getTokens } from '@ihui/rn-app'
import { Tabs } from '@ihui/ui-native'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { EduParentBillsView } from './EduParentBillsView'
import { EduParentStateView, createParentStyles } from './EduParentUi'

interface ChildInfo {
  bindingId: string
  studentId: string
  relationship: string
  status: string
  student: { id: string; username: string; nickname: string } | null
}

type ParentTab = 'children' | 'bills'

function EduParentScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp<RootStackParamList>>()
  const tk = getTokens(resolvedTheme)
  const styles = createParentStyles(tk)
  const [tab, setTab] = useState<ParentTab>('children')
  const [children, setChildren] = useState<ChildInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const statusLabel = useCallback(
    (s: string) => {
      const v = t(`eduParent.status.${s}`)
      return v === `eduParent.status.${s}` ? s : v
    },
    [t],
  )

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await fetchApi<{ children: ChildInfo[] }>(
        '/api/edu-ai-management/parent/children',
      )
      if (!res.success) throw new Error(res.error || 'load failed')
      setChildren(res.data?.children ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'load failed')
    }
  }, [])

  const retry = useCallback(() => {
    setLoading(true)
    void load().finally(() => setLoading(false))
  }, [load])

  useEffect(() => {
    setLoading(true)
    void load().finally(() => setLoading(false))
  }, [load])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    void load().finally(() => setRefreshing(false))
  }, [load])

  /** 聚合视图只认 studentId 与展示名 —— 与孩子列表同口径(昵称优先,空则落 ID) */
  const childRefs = useMemo(
    () =>
      children.map((c) => ({
        studentId: c.studentId,
        name: c.student?.nickname || c.studentId,
      })),
    [children],
  )

  const openChildBills = useCallback(
    (studentId: string) => navigation.navigate('EduChildBills', { childId: studentId }),
    [navigation],
  )

  const onRowPress = useCallback(
    (child: ChildInfo) => {
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
    [navigation, t],
  )

  const tabs = useMemo(
    () => [
      { value: 'children', label: t('eduParent.child') },
      { value: 'bills', label: t('eduChildBills.title') },
    ],
    [t],
  )

  const renderChildren = () => {
    if (loading && children.length === 0) {
      return (
        <View style={styles.center}>
          <ActivityIndicator color={tk.brand.cta} />
        </View>
      )
    }
    if (children.length === 0) {
      return (
        <EduParentStateView t={t} colorScheme={resolvedTheme} message={t('common.empty')} />
      )
    }
    return (
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {children.map((child) => (
          <Pressable
            key={child.bindingId}
            onPress={() => onRowPress(child)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          >
            <View style={styles.row}>
              <Text style={styles.strong} numberOfLines={1}>
                {child.student?.nickname ?? child.studentId}
              </Text>
              <Text
                style={[
                  styles.strongValue,
                  {
                    color:
                      child.status === 'active' || child.status === 'confirmed'
                        ? tk.success.DEFAULT
                        : tk.text.tertiary,
                  },
                ]}
              >
                {statusLabel(child.status)}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>{t('eduParent.relationship')}</Text>
              <Text style={styles.rowValue}>{child.relationship}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron
          onPress={() => navigation.goBack()}
          label={t('common.back')}
          colorScheme={resolvedTheme}
        />
        <Text style={styles.title}>{t('eduParent.title')}</Text>
      </View>
      <View style={styles.tabBar}>
        <Tabs
          tabs={tabs}
          value={tab}
          onChange={(v: string) => setTab(v === 'bills' ? 'bills' : 'children')}
        />
      </View>
      <View style={styles.flex}>
        {error ? (
          <EduParentStateView
            t={t}
            colorScheme={resolvedTheme}
            message={error}
            onRetry={retry}
            tone="danger"
          />
        ) : tab === 'bills' ? (
          <EduParentBillsView
            colorScheme={resolvedTheme}
            childRefs={childRefs}
            onOpenChild={openChildBills}
          />
        ) : (
          renderChildren()
        )}
      </View>
    </View>
  )
}

export default EduParentScreen
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
