// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 主动巡逻 Agent 页面(/patrol)。
 * 与 RN `apps/mobile-rn/src/screens/PatrolScreen.tsx` 共用同一份渲染
 * (`@ihui/rn-app/features/patrol/PatrolScreen`,react-native-web 承载)。
 * 本页只保留 web 侧数据编排与平台件:toast、useConfirm、router 深链、页头。
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import {
  createPatrolTask,
  deletePatrolTask,
  listPatrolRuns,
  listPatrolTasks,
  runPatrolTaskNow,
  updatePatrolTask,
  type PatrolTask,
} from '@ihui/api-client'
import type { TFunction } from '@ihui/types'
import {
  PatrolScreen as SharedPatrolScreen,
  type PatrolFormValues,
  type PatrolStatus,
} from '@ihui/rn-app/features/patrol/PatrolScreen'
import { useToast } from '@/hooks/use-toast'
import { useConfirm } from '@/hooks/use-confirm'

export default function PatrolPage() {
  const t = useTranslations()
  const toast = useToast()
  const router = useRouter()
  const { confirm, ConfirmDialogRenderer } = useConfirm()

  const [items, setItems] = React.useState<PatrolTask[]>([])
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoadError(null)
    try {
      const res = await listPatrolTasks({ limit: 100 })
      setItems(res.items)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : t('patrol.toast.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  React.useEffect(() => {
    void load()
  }, [load])

  const handleSave = async (values: PatrolFormValues, id?: string) => {
    if (id) {
      await updatePatrolTask(id, {
        name: values.name,
        patrolType: values.patrolType,
        target: values.target || null,
        prompt: values.prompt || null,
        rrule: values.rrule,
      })
      toast.success(t('patrol.toast.updated'))
    } else {
      await createPatrolTask({
        name: values.name,
        patrolType: values.patrolType,
        rrule: values.rrule,
        ...(values.target ? { target: values.target } : {}),
        ...(values.prompt ? { prompt: values.prompt } : {}),
      })
      toast.success(t('patrol.toast.created'))
    }
    await load()
  }

  const handleRunNow = async (taskId: string) => {
    try {
      const res = await runPatrolTaskNow(taskId)
      if (res.status === 'issue' && res.conversationId) {
        toast.success(t('patrol.toast.runDone'), t('patrol.toast.runIssueFound'))
      } else {
        toast.success(t('patrol.toast.runDone'), res.summary.slice(0, 120))
      }
      await load()
    } catch (err) {
      toast.error(t('patrol.toast.runFailed'), err instanceof Error ? err.message : undefined)
    }
  }

  const handleToggleStatus = async (taskId: string, next: PatrolStatus) => {
    try {
      await updatePatrolTask(taskId, { status: next })
      toast.success(next === 'active' ? t('patrol.toast.resumed') : t('patrol.toast.paused'))
      await load()
    } catch (err) {
      toast.error(t('patrol.toast.updateFailed'), err instanceof Error ? err.message : undefined)
    }
  }

  const handleDelete = async (taskId: string) => {
    try {
      await deletePatrolTask(taskId)
      toast.success(t('patrol.toast.deleted'))
      await load()
    } catch (err) {
      toast.error(t('patrol.toast.deleteFailed'), err instanceof Error ? err.message : undefined)
    }
  }

  const handleLoadRuns = async (taskId: string) => {
    const res = await listPatrolRuns(taskId, { limit: 30 })
    return res.items
  }

  return (
    <div className="px-4 py-4 mx-auto w-full max-w-5xl space-y-4">
      <div>
        <h1 className="text-heading font-semibold">{t('patrol.title')}</h1>
        <p className="mt-1 text-body text-muted-foreground">{t('patrol.subtitle')}</p>
      </div>

      <SharedPatrolScreen
        t={t as unknown as TFunction}
        colorScheme="light"
        tasks={items}
        loading={loading}
        error={loadError}
        onRefresh={load}
        onSave={handleSave}
        onRunNow={handleRunNow}
        onToggleStatus={handleToggleStatus}
        onDelete={handleDelete}
        onLoadRuns={handleLoadRuns}
        onOpenConversation={(conversationId) =>
          router.push(`/chat?conversationId=${encodeURIComponent(conversationId)}`)
        }
        onConfirm={(options) =>
          confirm({
            title: options.title,
            description: options.message,
            variant: options.destructive ? 'destructive' : 'default',
          })
        }
      />

      <ConfirmDialogRenderer />
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
