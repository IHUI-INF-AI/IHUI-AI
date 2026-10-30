// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { PlanDocument, PlanPriority, PlanStepStatus } from '@ihui/shared/plan'
import {
  PlanDetailScreen as SharedPlanDetailScreen,
  appendVersion,
  computePlanStats,
  generateId,
  isValidVersionSnapshot,
  planVersionStorageKey,
  shouldRecordVersion,
  snapshotPlan,
  type PlanFormValues,
  type PlanVersionSnapshot,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { rnPlanStorage, rnPlanStore } from './PlanScreen'

/** 本票三条 Wave2 路由由 manifest 交集成方统一注册(禁改 RootNavigator),本地交叉类型补齐。 */
type ShellParams = RootStackParamList & {
  Plan: undefined
  PlanDetail: { id: string }
  PlanNew: undefined
}
type NavigationProp = NativeStackNavigationProp<ShellParams>

/**
 * RN 端「计划详情」薄壳 —— 渲染全部委托共享屏
 * `packages/app/src/features/plan/PlanDetailScreen.tsx`,本文件只管平台侧:
 * store 订阅取 plan、版本历史(AsyncStorage 读写,记录/去重/首轮基线语义对齐
 * web PageClient.tsx:83-94)、状态/步骤增删改排序与删除导航。
 *
 * 与 web 差异(有意):web localStorage 同步读,这里 AsyncStorage 异步,
 * 故记录 effect 加 versionsLoaded 门控 —— 历史未读回前不记版,
 * 避免冷启动把 versions=[] 当基线误记 v1;plan 编辑落在读回窗口内的会被并入基线(可接受)。
 */
export function PlanDetailScreen() {
  const navigation = useNavigation<NavigationProp>()
  const route = useRoute<RouteProp<ShellParams, 'PlanDetail'>>()
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const planId = route.params.id

  const plans = useSyncExternalStore(
    rnPlanStore.subscribe,
    rnPlanStore.getSnapshot,
    rnPlanStore.getSnapshot,
  )
  const plan = useMemo(() => plans.find((p) => p.id === planId) ?? null, [plans, planId])
  const stats = useMemo(() => (plan ? computePlanStats(plan.steps) : null), [plan])

  const [ready, setReady] = useState(false)
  const [versions, setVersions] = useState<PlanVersionSnapshot[]>([])
  const [versionsLoaded, setVersionsLoaded] = useState(false)
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null)
  const firstRecordRef = useRef(true)

  useEffect(() => {
    let cancelled = false
    void rnPlanStore.hydrate().finally(() => {
      if (!cancelled) setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // planId 变化:读回版本历史,重置选择与首轮基线标记(对齐 web PageClient:75-80)
  useEffect(() => {
    let cancelled = false
    setVersionsLoaded(false)
    setVersions([])
    setSelectedVersion(null)
    firstRecordRef.current = true
    rnPlanStorage
      .getItem(planVersionStorageKey(planId))
      .then((raw) => {
        if (cancelled) return
        if (raw !== null) {
          try {
            const parsed: unknown = JSON.parse(raw)
            if (Array.isArray(parsed)) setVersions(parsed.filter(isValidVersionSnapshot))
          } catch {
            /* 解析失败视为无历史(与 web loadPlanVersions 容错同口径) */
          }
        }
        setVersionsLoaded(true)
      })
      .catch(() => {
        if (!cancelled) setVersionsLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [planId])

  // plan 结构每变化一轮记一版;首轮挂载只建基线不记版(新计划自然呈现空态)
  useEffect(() => {
    if (!plan || !versionsLoaded) return
    if (firstRecordRef.current) {
      firstRecordRef.current = false
      return
    }
    const last = versions.at(-1) ?? null
    if (!shouldRecordVersion(last, plan)) return
    const next = appendVersion(versions, snapshotPlan(plan, (last?.version ?? 0) + 1))
    void rnPlanStorage
      .setItem(planVersionStorageKey(planId), JSON.stringify(next))
      .catch(() => undefined)
    setVersions(next)
  }, [plan, planId, versions, versionsLoaded])

  const handlePlanStatusChange = useCallback(
    (status: PlanDocument['status']) => {
      rnPlanStore.update(planId, {
        status,
        completedAt: status === 'completed' ? new Date().toISOString() : undefined,
      })
    },
    [planId],
  )

  const handleStepStatusChange = useCallback(
    (stepId: string, status: PlanStepStatus) => {
      rnPlanStore.updateStep(planId, stepId, {
        status,
        completedAt: status === 'completed' ? new Date().toISOString() : undefined,
      })
    },
    [planId],
  )

  const handleStepPriorityChange = useCallback(
    (stepId: string, priority: PlanPriority) => {
      rnPlanStore.updateStep(planId, stepId, { priority })
    },
    [planId],
  )

  // 上下移 = 相邻 id 交换后整体重排(与 web swap + reorderSteps 同算法)
  const handleMoveStep = useCallback(
    (stepId: string, dir: -1 | 1) => {
      if (!plan) return
      const ids = plan.steps.map((s) => s.id)
      const idx = ids.indexOf(stepId)
      const target = idx + dir
      if (idx < 0 || target < 0 || target >= ids.length) return
      const next = [...ids]
      const a = next[target]
      const b = next[idx]
      if (a === undefined || b === undefined) return
      next[target] = b
      next[idx] = a
      rnPlanStore.reorderSteps(planId, next)
    },
    [plan, planId],
  )

  const handleRemoveStep = useCallback(
    (stepId: string) => {
      rnPlanStore.removeStep(planId, stepId)
    },
    [planId],
  )

  const handleAddStep = useCallback(() => {
    rnPlanStore.addStep(planId, {
      title: t('planPage.newStepTitle'),
      description: '',
      status: 'pending',
      priority: 'medium',
    })
  }, [planId, t])

  // 编辑提交:步骤 id 全量重生成(与 web handleEditSubmit 同语义,签名变化会触发记版)
  const handleEditSubmit = useCallback(
    (values: PlanFormValues) => {
      rnPlanStore.update(planId, {
        title: values.title,
        goal: values.goal,
        scope: values.scope,
        constraints: values.constraints,
        tags: values.tags,
        steps: values.steps.map((s, i) => ({
          id: generateId(),
          title: s.title,
          description: s.description,
          status: s.status,
          priority: s.priority,
          order: i,
          estimatedMinutes: s.estimatedMinutes,
        })),
      })
    },
    [planId],
  )

  const handleDelete = useCallback(() => {
    rnPlanStore.remove(planId)
    navigation.goBack()
  }, [planId, navigation])

  return (
    <SharedPlanDetailScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      loading={!ready}
      plan={plan}
      stats={stats}
      versions={versions}
      selectedVersion={selectedVersion}
      onSelectVersion={setSelectedVersion}
      onPlanStatusChange={handlePlanStatusChange}
      onStepStatusChange={handleStepStatusChange}
      onStepPriorityChange={handleStepPriorityChange}
      onMoveStep={handleMoveStep}
      onRemoveStep={handleRemoveStep}
      onAddStep={handleAddStep}
      onEditSubmit={handleEditSubmit}
      onDelete={handleDelete}
    />
  )
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
