// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  cancelWorkflowInstance,
  deleteWorkflow,
  getWorkflow,
  listWorkflowInstances,
  retryWorkflowInstance,
  triggerWorkflow,
  updateWorkflow,
} from '@ihui/api-client'
import type { WorkflowInstanceRow, WorkflowRow } from '@ihui/api-client'
import { WorkflowDetailScreen as SharedWorkflowDetailScreen } from '@ihui/rn-app'
import type { WorkflowInfoInput } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

/** 本票三条 Wave1 路由由 manifest 交集成方统一注册(禁改 RootNavigator);本地交叉类型见 WorkflowListScreen 同注释。 */
type ShellParams = RootStackParamList & {
  WorkflowList: undefined
  WorkflowDetail: { id: string }
  WorkflowInstanceDetail: { id: string }
}
type NavigationProp = NativeStackNavigationProp<ShellParams>

const INST_PAGE_SIZE = 10

/**
 * RN 端「工作流详情」薄壳 —— 渲染全部委托共享屏
 * `packages/app/src/features/workflows/WorkflowDetailScreen.tsx`,本文件只管平台侧:
 * GET /workflows/:id + GET /workflows/instances 取数,触发/启停/删除/编辑(PATCH/DELETE)
 * 与实例取消/重试(POST),成功后回传 null 并局部刷新。
 */
export function WorkflowDetailScreen() {
  const navigation = useNavigation<NavigationProp>()
  const route = useRoute<RouteProp<ShellParams, 'WorkflowDetail'>>()
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const id = route.params.id

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [workflow, setWorkflow] = useState<WorkflowRow | null>(null)
  const [instances, setInstances] = useState<WorkflowInstanceRow[]>([])
  const [instTotal, setInstTotal] = useState(0)
  const [instPage, setInstPage] = useState(1)

  const loadWorkflow = useCallback(async () => {
    try {
      const res = await getWorkflow(id)
      if (res.success) {
        setWorkflow(res.data.workflow)
        setError(null)
      } else {
        setError(res.error || t('workflowsPage.notFound'))
      }
    } catch {
      setError(t('workflowsPage.notFound'))
    }
  }, [id, t])

  const loadInstances = useCallback(
    async (page: number) => {
      try {
        const res = await listWorkflowInstances({
          workflowId: id,
          page,
          pageSize: INST_PAGE_SIZE,
        })
        if (res.success) {
          setInstances(res.data.list ?? [])
          setInstTotal(res.data.total ?? 0)
        }
      } catch {
        /* 实例列表失败保持空列表,与 web 端 react-query 失败口径一致 */
      }
    },
    [id],
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void Promise.all([loadWorkflow(), loadInstances(1)]).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [loadWorkflow, loadInstances])

  const fail = useCallback((message?: string) => message || t('workflowsPage.saveFailed'), [t])

  const handleTrigger = useCallback(async (): Promise<string | null> => {
    try {
      const res = await triggerWorkflow(id)
      if (!res.success) return fail(res.error)
      await loadInstances(instPage)
      return null
    } catch (e) {
      return fail(e instanceof Error ? e.message : undefined)
    }
  }, [id, instPage, loadInstances, fail])

  const handleToggleActive = useCallback(
    async (next: boolean): Promise<string | null> => {
      try {
        const res = await updateWorkflow(id, { isActive: next })
        if (!res.success) return fail(res.error)
        await loadWorkflow()
        return null
      } catch (e) {
        return fail(e instanceof Error ? e.message : undefined)
      }
    },
    [id, loadWorkflow, fail],
  )

  const handleSaveInfo = useCallback(
    async (input: WorkflowInfoInput): Promise<string | null> => {
      try {
        const res = await updateWorkflow(id, input)
        if (!res.success) return fail(res.error)
        await loadWorkflow()
        return null
      } catch (e) {
        return fail(e instanceof Error ? e.message : undefined)
      }
    },
    [id, loadWorkflow, fail],
  )

  const handleSaveSteps = useCallback(
    async (steps: unknown[]): Promise<string | null> => {
      try {
        const res = await updateWorkflow(id, { steps })
        if (!res.success) return fail(res.error)
        await loadWorkflow()
        return null
      } catch (e) {
        return fail(e instanceof Error ? e.message : undefined)
      }
    },
    [id, loadWorkflow, fail],
  )

  const handleDelete = useCallback(async (): Promise<string | null> => {
    try {
      const res = await deleteWorkflow(id)
      if (!res.success) return fail(res.error)
      navigation.goBack()
      return null
    } catch (e) {
      return fail(e instanceof Error ? e.message : undefined)
    }
  }, [id, navigation, fail])

  const handleCancelInstance = useCallback(
    async (instanceId: string): Promise<string | null> => {
      try {
        const res = await cancelWorkflowInstance(instanceId)
        if (!res.success) return fail(res.error)
        await loadInstances(instPage)
        return null
      } catch (e) {
        return fail(e instanceof Error ? e.message : undefined)
      }
    },
    [instPage, loadInstances, fail],
  )

  const handleRetryInstance = useCallback(
    async (instanceId: string): Promise<string | null> => {
      try {
        const res = await retryWorkflowInstance(instanceId)
        if (!res.success) return fail(res.error)
        await loadInstances(instPage)
        return null
      } catch (e) {
        return fail(e instanceof Error ? e.message : undefined)
      }
    },
    [instPage, loadInstances, fail],
  )

  const handlePage = useCallback(
    (page: number) => {
      setInstPage(page)
      void loadInstances(page)
    },
    [loadInstances],
  )

  return (
    <SharedWorkflowDetailScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      loading={loading}
      error={error}
      workflow={workflow ?? undefined}
      instances={instances}
      instTotal={instTotal}
      instPage={instPage}
      instPageSize={INST_PAGE_SIZE}
      onRefresh={() => {
        setLoading(true)
        void Promise.all([loadWorkflow(), loadInstances(instPage)]).finally(() => setLoading(false))
      }}
      onPage={handlePage}
      onOpenInstance={(instanceId) =>
        navigation.navigate('WorkflowInstanceDetail', { id: instanceId })
      }
      onTrigger={handleTrigger}
      onToggleActive={handleToggleActive}
      onDelete={handleDelete}
      onSaveInfo={handleSaveInfo}
      onSaveSteps={handleSaveSteps}
      onCancelInstance={handleCancelInstance}
      onRetryInstance={handleRetryInstance}
    />
  )
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
