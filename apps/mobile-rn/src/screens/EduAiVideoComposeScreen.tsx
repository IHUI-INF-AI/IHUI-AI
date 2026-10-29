// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  createVideoComposeTask,
  getVideoComposeTask,
  regenerateVideoComposeTask,
  type VideoComposeTask,
} from '@ihui/api-client'
import {
  EduAiVideoComposeScreen as SharedEduAiVideoComposeScreen,
  type EduAiVideoStepName,
  type EduAiVideoTaskRow,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

/** 本票五条 Wave2 路由由 manifest 交集成方统一注册(禁改 RootNavigator),本地交叉类型补齐。 */
type ShellParams = RootStackParamList & {
  EduAiVideoCompose: undefined
}
type NavigationProp = NativeStackNavigationProp<ShellParams>

/** 轮询周期:与 web video-compose/page.tsx:245 同值(3s,仅存在 pending/running 任务时生效)。 */
const POLL_MS = 3000

function toRow(task: VideoComposeTask): EduAiVideoTaskRow {
  return {
    id: task.id,
    prompt: task.prompt,
    model: task.model,
    status: task.status,
    steps: task.steps,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  }
}

/**
 * RN 端「AI 视频编排」薄壳 —— 承载 web /edu-ai/video-compose。
 * 渲染全部委托共享屏 `packages/app/src/features/edu-ai/EduAiVideoComposeScreen.tsx`,
 * 本文件只管平台侧:创建/轮询(3s)/重生成与任务列表内存态。
 * 后端无 GET 列表路由,任务列表随会话存活,与 web video-compose/page.tsx:208 同口径。
 */
export function EduAiVideoComposeScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()

  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [tasks, setTasks] = useState<EduAiVideoTaskRow[]>([])
  const [viewingTaskId, setViewingTaskId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [regenerating, setRegenerating] = useState<{
    taskId: string
    step: EduAiVideoStepName
  } | null>(null)
  const [regenerateError, setRegenerateError] = useState<string | null>(null)

  const activeTask =
    tasks.find((task) => task.status === 'pending' || task.status === 'running') ?? null
  const activeTaskId = activeTask?.id ?? null
  const inFlight = useRef(false)

  useEffect(() => {
    if (!activeTaskId) return
    let disposed = false
    const refresh = async (): Promise<void> => {
      if (inFlight.current || disposed) return
      inFlight.current = true
      try {
        const res = await getVideoComposeTask(activeTaskId)
        if (disposed || !res.success || !res.data) return
        const latest = toRow(res.data)
        setTasks((prev) => prev.map((task) => (task.id === latest.id ? latest : task)))
      } catch {
        // 轮询失败静默跳过,下一周期重试(与 web 同口径)
      } finally {
        inFlight.current = false
      }
    }
    void refresh()
    const timer = setInterval(() => {
      void refresh()
    }, POLL_MS)
    return () => {
      disposed = true
      clearInterval(timer)
    }
  }, [activeTaskId])

  const handleCreate = useCallback(() => {
    const content = prompt.trim()
    if (!content || creating) return
    setCreating(true)
    setCreateError(null)
    void (async () => {
      try {
        const res = await createVideoComposeTask({
          prompt: content,
          model: model.trim() || undefined,
        })
        if (!res.success || !res.data) throw new Error('create failed')
        const row = toRow(res.data)
        setTasks((prev) => [row, ...prev])
        setViewingTaskId(row.id)
        setPrompt('')
      } catch (e) {
        setCreateError((e as Error).message || t('eduAiPage.videoError'))
      } finally {
        setCreating(false)
      }
    })()
  }, [prompt, model, creating, t])

  const handleRegenerate = useCallback(
    (taskId: string, step: EduAiVideoStepName) => {
      if (regenerating) return
      setRegenerating({ taskId, step })
      setRegenerateError(null)
      void (async () => {
        try {
          const res = await regenerateVideoComposeTask(taskId, step)
          if (!res.success || !res.data) throw new Error('regenerate failed')
          const row = toRow(res.data)
          setTasks((prev) => prev.map((task) => (task.id === row.id ? row : task)))
          setViewingTaskId(row.id)
        } catch (e) {
          setRegenerateError((e as Error).message || t('eduAiPage.videoError'))
        } finally {
          setRegenerating(null)
        }
      })()
    },
    [regenerating, t],
  )

  const toggleStep = useCallback((taskId: string, step: EduAiVideoStepName) => {
    const key = `${taskId}:${step}`
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  return (
    <SharedEduAiVideoComposeScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      prompt={prompt}
      model={model}
      onPromptChange={setPrompt}
      onModelChange={setModel}
      creating={creating}
      createError={createError}
      onCreate={handleCreate}
      tasks={tasks}
      viewingTaskId={viewingTaskId}
      onViewTask={setViewingTaskId}
      expanded={expanded}
      onToggleStep={toggleStep}
      regenerating={regenerating}
      onRegenerate={handleRegenerate}
      regenerateError={regenerateError}
    />
  )
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
