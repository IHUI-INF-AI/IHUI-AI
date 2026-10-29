// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  PlanListScreen as SharedPlanListScreen,
  computePlanStats,
  createPlanLocalStore,
  type PlanFilterValue,
  type PlanListRow,
  type PlanStorage,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

/** 本票三条 Wave2 路由由 manifest 交集成方统一注册(禁改 RootNavigator),本地交叉类型补齐。 */
type ShellParams = RootStackParamList & {
  Plan: undefined
  PlanDetail: { id: string }
  PlanNew: undefined
}
type NavigationProp = NativeStackNavigationProp<ShellParams>

/** AsyncStorage 适配器(先例:src/stores/storage-adapter.ts;契约 = 共享层 PlanStorage)。 */
export const rnPlanStorage: PlanStorage = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
}

/**
 * 模块级单例 store —— Plan/PlanDetail/PlanNew 三屏共享,
 * 与 web 端 zustand 单例(usePlanStore)同语义;持久化键 'ihui-plans' 与 web 同形。
 * 版本历史读写也走 rnPlanStorage(键 'ihui-plan-versions:<planId>',与 web 同键)。
 */
export const rnPlanStore = createPlanLocalStore({ storage: rnPlanStorage })

/**
 * RN 端「计划列表」薄壳 —— 渲染全部委托共享屏
 * `packages/app/src/features/plan/PlanListScreen.tsx`,本文件只管平台侧:
 * AsyncStorage 水合 + useSyncExternalStore 订阅 + 筛选状态 + 列表/详情/新建导航。
 */
export function PlanScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()

  const [filter, setFilter] = useState<PlanFilterValue>('all')
  const [ready, setReady] = useState(false)

  const plans = useSyncExternalStore(
    rnPlanStore.subscribe,
    rnPlanStore.getSnapshot,
    rnPlanStore.getSnapshot,
  )

  useEffect(() => {
    let cancelled = false
    void rnPlanStore.hydrate().finally(() => {
      if (!cancelled) setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const rows = useMemo<PlanListRow[]>(
    () => plans.map((plan) => ({ plan, stats: computePlanStats(plan.steps) })),
    [plans],
  )

  return (
    <SharedPlanListScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      rows={rows}
      filter={filter}
      onFilterChange={setFilter}
      onOpenPlan={(id) => navigation.navigate('PlanDetail', { id })}
      onCreate={() => navigation.navigate('PlanNew')}
      loading={!ready}
    />
  )
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
