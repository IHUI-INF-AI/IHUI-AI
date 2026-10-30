// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Linking } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  cancelAllMediaTasks,
  cancelMediaTask,
  clearMediaTasks,
  deleteMediaTask,
  getMediaTaskStats,
  listMediaTasks,
  type MediaTaskItem,
  type MediaTaskStats,
} from '@ihui/api-client'
import {
  MediaTasksScreen as SharedMediaTasksScreen,
  type MediaTaskRowView,
  type MediaTaskStatsView,
  type MediaTaskTone,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const NS = 'mediaTasksPage'

/** web 同值(apps/web/src/components/media/task-parts.tsx:62 PAGE_SIZE = 10) */
const PAGE_SIZE = 10

/** web 在途集合(task-parts.tsx:64-69),轮询与取消按钮共用 */
const STATUS_IN_FLIGHT = ['processing', 'accepted', 'submitted', 'pending']

const KIND_KEYS: Record<string, string> = {
  video: 'kindVideo',
  music: 'kindMusic',
  tts: 'kindTts',
  image: 'kindImage',
}

const STATUS_KEYS: Record<string, string> = {
  processing: 'statusBadgeProcessing',
  accepted: 'statusBadgeProcessing',
  submitted: 'statusBadgeProcessing',
  pending: 'statusBadgeProcessing',
  succeeded: 'statusBadgeSucceeded',
  failed: 'statusBadgeFailed',
  cancelled: 'statusBadgeCancelled',
}

const STATUS_TONE: Record<string, MediaTaskTone> = {
  processing: 'running',
  accepted: 'running',
  submitted: 'running',
  pending: 'running',
  succeeded: 'ok',
  failed: 'failed',
  cancelled: 'neutral',
}

/** web resultUrl 同序:video → audio → image(task-parts.tsx resultUrl) */
function pickResultUrl(task: MediaTaskItem): string | null {
  const r = task.result
  if (!r) return null
  return r.video_url || r.audio_url || r.image_url || null
}

/**
 * RN 端「媒体任务」薄壳 —— 承载 web /media-tasks。渲染委托共享屏,本文件只管:
 * 取数(GET /api/media/tasks 与 /stats,契约 apps/ai-service/app/routers/media_tasks.py:184-223)、
 * 状态/类型过滤与分页(web page.tsx:73-85,213-231)、在途 5s 轮询(web refetchInterval)、
 * 取消/删除/清理/批量取消四类动作与二次确认(web useConfirm 同文案)、时间 Intl、外链打开、登录门。
 *
 * ⚠ 注意:apps/api 未注册 /api/media/* 代理(web 靠 next.config.mjs:704-708 直连 8803),
 * RN base 为 apps/api(8802,apps/mobile-rn/src/lib/config.ts:42-49)。代理落地前本屏请求会 404,
 * 故 manifest 记 gap(notLanded),不注册进 RootNavigator。
 */
export function MediaTasksScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const { user } = useAuth()

  const [items, setItems] = useState<MediaTaskItem[]>([])
  const [stats, setStats] = useState<MediaTaskStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [kindFilter, setKindFilter] = useState('')
  const [page, setPage] = useState(1)
  const [cancellingTaskId, setCancellingTaskId] = useState<string | null>(null)
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null)
  const [cancelAllBusy, setCancelAllBusy] = useState(false)
  const [clearBusy, setClearBusy] = useState(false)

  const timeFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [locale],
  )

  const fmtTime = useCallback(
    (value: string): string => {
      const d = new Date(value)
      return Number.isNaN(d.getTime()) ? '-' : timeFmt.format(d)
    },
    [timeFmt],
  )

  const load = useCallback(
    async (mode: 'initial' | 'refresh' | 'silent') => {
      if (!user) return
      if (mode === 'initial') setLoading(true)
      if (mode === 'refresh') setRefreshing(true)
      try {
        const [listRes, statsRes] = await Promise.all([
          listMediaTasks({
            limit: PAGE_SIZE,
            offset: (page - 1) * PAGE_SIZE,
            status: statusFilter || undefined,
            kind: kindFilter || undefined,
          }),
          getMediaTaskStats(),
        ])
        if (!listRes.success || !listRes.data) {
          setError(listRes.error || t('common.loadFailed'))
          return
        }
        setError(null)
        setItems(listRes.data.items ?? [])
        setStats(statsRes.success && statsRes.data ? statsRes.data : null)
      } catch {
        setError(t('common.loadFailed'))
      } finally {
        if (mode !== 'silent') {
          setLoading(false)
          setRefreshing(false)
        }
      }
    },
    [user, page, statusFilter, kindFilter, t],
  )

  useEffect(() => {
    void load('initial')
  }, [load])

  /** web 同口径:有在途任务时 5s 轮询一次(page.tsx:80-83) */
  const hasInflight = (stats?.inflight ?? 0) > 0
  useEffect(() => {
    if (!hasInflight) return undefined
    const timer = setInterval(() => {
      void load('silent')
    }, 5000)
    return () => clearInterval(timer)
  }, [hasInflight, load])

  const rows = useMemo<MediaTaskRowView[]>(
    () =>
      items.map((task) => {
        const url = pickResultUrl(task)
        return {
          key: task.task_id || String(task.id),
          kindText: KIND_KEYS[task.kind] ? t(`${NS}.${KIND_KEYS[task.kind]}`) : task.kind,
          statusText: STATUS_KEYS[task.status]
            ? t(`${NS}.${STATUS_KEYS[task.status]}`)
            : task.status,
          statusTone: STATUS_TONE[task.status] ?? 'neutral',
          tool: task.tool,
          createdAtText: fmtTime(task.created_at),
          message: task.message ? task.message : null,
          taskId: task.task_id || '',
          resultUrl: url,
          inFlight: STATUS_IN_FLIGHT.includes(task.status),
        }
      }),
    [items, t, fmtTime],
  )

  const statsView = useMemo<MediaTaskStatsView | null>(
    () =>
      stats
        ? {
            total: stats.total ?? 0,
            inflight: stats.inflight ?? 0,
            succeeded: stats.succeeded ?? 0,
            failed: stats.failed ?? 0,
            cancelled: stats.cancelled ?? 0,
          }
        : null,
    [stats],
  )

  const total = statsView?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const onCancel = useCallback(
    (taskId: string) => {
      Alert.alert(t(`${NS}.cancel`), taskId, [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          onPress: () => {
            setCancellingTaskId(taskId)
            setNotice(null)
            void (async () => {
              try {
                const res = await cancelMediaTask(taskId)
                if (!res.success) {
                  setNotice(res.error || t('common.failed'))
                  return
                }
                if (res.data?.error) setNotice(`${t(`${NS}.cancel`)}: ${res.data.error}`)
                await load('silent')
              } catch {
                setNotice(t('common.failed'))
              } finally {
                setCancellingTaskId(null)
              }
            })()
          },
        },
      ])
    },
    [t, load],
  )

  const onDelete = useCallback(
    (taskId: string) => {
      Alert.alert(t(`${NS}.deleteConfirm`), undefined, [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          style: 'destructive',
          onPress: () => {
            setDeletingTaskId(taskId)
            setNotice(null)
            void (async () => {
              try {
                const res = await deleteMediaTask(taskId)
                if (!res.success) {
                  setNotice(res.error || t('common.failed'))
                  return
                }
                await load('silent')
              } catch {
                setNotice(t('common.failed'))
              } finally {
                setDeletingTaskId(null)
              }
            })()
          },
        },
      ])
    },
    [t, load],
  )

  const onClear = useCallback(() => {
    Alert.alert(t(`${NS}.clearConfirm`), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        style: 'destructive',
        onPress: () => {
          setClearBusy(true)
          setNotice(null)
          void (async () => {
            try {
              const res = await clearMediaTasks({ status: 'succeeded,failed,cancelled' })
              if (!res.success || !res.data) {
                setNotice(res.error || t('common.failed'))
                return
              }
              setNotice(
                t(`${NS}.clearResult`, {
                  deleted: res.data.deleted ?? 0,
                  kept: res.data.kept_in_flight ?? 0,
                }),
              )
              await load('silent')
            } catch {
              setNotice(t('common.failed'))
            } finally {
              setClearBusy(false)
            }
          })()
        },
      },
    ])
  }, [t, load])

  const onCancelAll = useCallback(() => {
    Alert.alert(t(`${NS}.cancelAllConfirm`), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        onPress: () => {
          setCancelAllBusy(true)
          setNotice(null)
          void (async () => {
            try {
              const res = await cancelAllMediaTasks({})
              if (!res.success || !res.data) {
                setNotice(res.error || t('common.failed'))
                return
              }
              const cancelled = res.data.cancelled ?? 0
              const remoteFailed = res.data.remote_failed ?? []
              let message =
                cancelled > 0
                  ? t(`${NS}.cancelAllResult`, { count: cancelled })
                  : t(`${NS}.cancelAllNone`)
              if (remoteFailed.length > 0) {
                message += ` ${t(`${NS}.cancelAllRemoteFailed`, { count: remoteFailed.length })}`
              }
              setNotice(message)
              await load('silent')
            } catch {
              setNotice(t('common.failed'))
            } finally {
              setCancelAllBusy(false)
            }
          })()
        },
      },
    ])
  }, [t, load])

  return (
    <SharedMediaTasksScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      loginRequiredText={user ? '' : t('common.login')}
      loading={loading}
      refreshing={refreshing}
      error={error}
      notice={notice}
      stats={statsView}
      rows={user ? rows : []}
      statusFilter={statusFilter}
      kindFilter={kindFilter}
      onStatusFilter={(value) => {
        setStatusFilter(value)
        setPage(1)
      }}
      onKindFilter={(value) => {
        setKindFilter(value)
        setPage(1)
      }}
      page={page}
      pages={pages}
      total={total}
      onPrev={() => setPage((p) => Math.max(1, p - 1))}
      onNext={() => setPage((p) => Math.min(pages, p + 1))}
      onRefresh={() => void load('refresh')}
      cancellingTaskId={cancellingTaskId}
      deletingTaskId={deletingTaskId}
      onCancel={onCancel}
      onDelete={onDelete}
      cancelAllBusy={cancelAllBusy}
      onCancelAll={onCancelAll}
      canCancelAll={(statsView?.inflight ?? 0) > 0}
      clearBusy={clearBusy}
      onClear={onClear}
      canClear={total > 0}
      onOpenUrl={(url) => {
        if (url) void Linking.openURL(url)
      }}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
