// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Linking } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  getJimengVideoTask,
  getJimengVideoTasks,
  type JimengVideoTask,
} from '@ihui/api-client'
import {
  VideoTasksScreen as SharedVideoTasksScreen,
  type VideoTaskRowView,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const NS = 'videoTasksPage'
/** 与后端分页默认同值(pageSize 默认 20 / 上限 100,proxy-tools.ts:64-67) */
const PAGE_SIZE = 20
/** 生成中任务 5 秒轮询(web page.tsx:76-79 同值) */
const POLL_MS = 5000

/** 状态 → 本页文案键(键名取自 web status-badge.tsx:18-23,取值逐字抄 aiGeneration 同键) */
const STATUS_LABEL_KEY: Record<string, string> = {
  accepted: 'statusAccepted',
  running: 'statusGenerating',
  success: 'statusSucceeded',
  failed: 'statusFailed',
}

/** result.video_urls[0] 提取(web video-task-row.tsx:21-33 同口径) */
function extractVideoUrl(result: string | null): string | null {
  if (!result) return null
  try {
    const parsed = JSON.parse(result) as { video_urls?: string[] }
    if (Array.isArray(parsed.video_urls) && parsed.video_urls.length > 0) {
      return parsed.video_urls[0] ?? null
    }
  } catch {
    if (/^https?:\/\//i.test(result)) return result
  }
  return null
}

/**
 * RN 端「即梦视频任务」薄壳 —— 承载 web /ai-generation/video-tasks。渲染委托共享屏,本文件只管:
 * 列表 GET /api/ai/jimeng4/video/tasks(proxy-tools.ts:720-738)、
 * 展开详情 GET /api/ai/jimeng4/video/tasks/:taskId(同文件 741-811,含主动同步与 warning)、
 * 生成中 5 秒轮询(accepted/running,web page.tsx:76-79 同判据)、
 * 时间 Intl 格式化、状态取词(aiGeneration.status*,未知回退协议字面值)、视频地址外部打开。
 * 登录门:任务列表是当前用户私有数据,未登录不发注定 401 的查询(web useAuthGate 同口径)。
 */
export function VideoTasksScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const { user } = useAuth()

  const [tasks, setTasks] = useState<JimengVideoTask[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<JimengVideoTask | null>(null)
  const [detailWarning, setDetailWarning] = useState<string | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [locale],
  )

  const fmtDate = useCallback(
    (value: string): string => {
      const d = new Date(value)
      return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d)
    },
    [dateFmt],
  )

  const statusLabel = useCallback(
    (status: string): string => {
      const key = STATUS_LABEL_KEY[status]
      return key ? t(`${NS}.${key}`) : status
    },
    [t],
  )

  const loadList = useCallback(
    async (mode: 'first' | 'refresh') => {
      if (!user) return
      if (mode === 'first') setLoading(true)
      else setRefreshing(true)
      try {
        const res = await getJimengVideoTasks({ page: 1, pageSize: PAGE_SIZE })
        if (!res.success || !res.data) {
          setError(res.error ?? t('common.loadFailed'))
          return
        }
        setError(null)
        setTasks(res.data.list ?? [])
      } catch {
        setError(t('common.loadFailed'))
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [user, t],
  )

  useEffect(() => {
    void loadList('first')
  }, [loadList])

  /** 生成中(accepted/running)才轮询,同 web refetchInterval 判据 */
  const hasActive = tasks.some((x) => x.status === 'accepted' || x.status === 'running')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (!user || !hasActive) return
    pollRef.current = setInterval(() => {
      void loadList('refresh')
    }, POLL_MS)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [user, hasActive, loadList])

  const loadDetail = useCallback(
    async (id: number) => {
      setDetailLoading(true)
      setDetailError(null)
      try {
        const res = await getJimengVideoTask(id)
        if (!res.success || !res.data) {
          setDetailError(res.error ?? t('common.loadFailed'))
          return
        }
        setDetail(res.data.task)
        setDetailWarning(res.data.warning ?? null)
      } catch {
        setDetailError(t('common.loadFailed'))
      } finally {
        setDetailLoading(false)
      }
    },
    [t],
  )

  const toggleExpand = useCallback(
    (id: number) => {
      if (expandedId === id) {
        setExpandedId(null)
        setDetail(null)
        setDetailWarning(null)
        setDetailError(null)
        return
      }
      setExpandedId(id)
      setDetail(null)
      setDetailWarning(null)
      setDetailError(null)
      void loadDetail(id)
    },
    [expandedId, loadDetail],
  )

  const rows: VideoTaskRowView[] = useMemo(
    () =>
      tasks.map((task) => {
        /** 展开行优先用详情接口的新数据(详情可能刚被同步过),否则回落到列表行 */
        const source = expandedId === task.id && detail ? detail : task
        const videoUrl = source.status === 'success' ? extractVideoUrl(source.result) : null
        return {
          id: task.id,
          status: source.status,
          statusLabel: statusLabel(source.status),
          promptSummary: task.message || '-',
          createdAtText: fmtDate(task.createdAt),
          detail: {
            volcanoTaskId: source.taskId,
            updatedAtText: fmtDate(source.updatedAt),
            statusLabel: statusLabel(source.status),
            messageText: source.message || '-',
            warning: expandedId === task.id ? detailWarning : null,
            videoUrl,
            showNoVideoUrl: source.status === 'success' && !videoUrl,
          },
        }
      }),
    [tasks, expandedId, detail, detailWarning, statusLabel, fmtDate],
  )

  return (
    <SharedVideoTasksScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      loginRequiredText={user ? '' : t(`${NS}.loginRequired`)}
      loading={loading}
      error={error}
      rows={rows}
      refreshing={refreshing}
      onRefresh={() => {
        void loadList('refresh')
        if (expandedId !== null) void loadDetail(expandedId)
      }}
      expandedId={expandedId}
      onToggleExpand={toggleExpand}
      detailLoading={detailLoading}
      detailError={detailError}
      onOpenVideo={(url) => {
        if (url) void Linking.openURL(url).catch(() => undefined)
      }}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
