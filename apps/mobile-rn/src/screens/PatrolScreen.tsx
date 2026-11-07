// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  createPatrolTask,
  deletePatrolTask,
  listPatrolRuns,
  listPatrolTasks,
  runPatrolTaskNow,
  updatePatrolTask,
  type PatrolTask,
} from '@ihui/api-client'
import { PatrolScreen as SharedPatrolScreen } from '@ihui/rn-app/features/patrol/PatrolScreen'
import type { PatrolFormValues, PatrolStatus } from '@ihui/rn-app/features/patrol/PatrolScreen'
import { NavBar } from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { appAlert } from '../components/BottomPops'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/**
 * 对齐 web `/patrol`。
 *
 * 壳只保留数据层与平台件(NavBar / appAlert / Chat 深链 / 加载错误);
 * 列表、内联新建/编辑、历史展开、动作触发全部由 @ihui/rn-app 共享屏渲染。
 */
export function PatrolScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()

  const [items, setItems] = useState<PatrolTask[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      const res = await listPatrolTasks({ limit: 100 })
      setItems(res.items)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : t('patrol.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
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
    } else {
      await createPatrolTask({
        name: values.name,
        patrolType: values.patrolType,
        rrule: values.rrule,
        ...(values.target ? { target: values.target } : {}),
        ...(values.prompt ? { prompt: values.prompt } : {}),
      })
    }
    await load()
  }

  const handleRunNow = async (id: string) => {
    try {
      const res = await runPatrolTaskNow(id)
      const doneTitle = t('patrol.runNowDone')
      appAlert(
        doneTitle,
        res.status === 'issue' && res.conversationId
          ? t('patrol.runNowIssue')
          : res.summary.slice(0, 120),
      )
      await load()
    } catch (e) {
      appAlert(t('common.error'), (e instanceof Error ? e.message : '') || t('patrol.runNowFailed'))
    }
  }

  const handleToggleStatus = async (id: string, next: PatrolStatus) => {
    try {
      await updatePatrolTask(id, { status: next })
      const doneText = next === 'active' ? t('patrol.resumeDone') : t('patrol.pauseDone')
      appAlert(doneText)
      await load()
    } catch (e) {
      appAlert(t('common.error'), (e instanceof Error ? e.message : '') || t('patrol.updateFailed'))
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deletePatrolTask(id)
      appAlert(t('patrol.deleteDone'))
      await load()
    } catch (e) {
      appAlert(t('common.error'), (e instanceof Error ? e.message : '') || t('patrol.deleteFailed'))
    }
  }

  const handleLoadRuns = async (id: string) => {
    const res = await listPatrolRuns(id, { limit: 30 })
    return res.items
  }

  const handleConfirm = (options: { title: string; message: string; destructive?: boolean }) =>
    new Promise<boolean>((resolve) => {
      appAlert(options.title, options.message, [
        { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
        {
          text: t('patrol.delete'),
          style: options.destructive ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ])
    })

  return (
    <>
      <NavChrome>
        <NavBar title={t('patrol.title')} subtitle={t('patrol.subtitle')} />
      </NavChrome>
      <SharedPatrolScreen
        t={t}
        colorScheme={resolvedTheme}
        tasks={items}
        loading={loading}
        error={loadError}
        onRefresh={load}
        onSave={handleSave}
        onRunNow={handleRunNow}
        onToggleStatus={handleToggleStatus}
        onDelete={handleDelete}
        onLoadRuns={handleLoadRuns}
        onOpenConversation={(conversationId) => navigation.navigate('Chat', { conversationId })}
        onConfirm={handleConfirm}
      />
    </>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
