// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { apiFailureToText } from '@ihui/shared/utils'
import {
  LecturerProfileScreen as SharedLecturerProfileScreen,
  type LiveLecturerChannelItem,
  type LiveLecturerListItem,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Route = RouteProp<RootStackParamList, 'LecturerProfile'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** `live_lecturers` 裸行(同列表屏,见 apps/api/src/db/live-queries.ts:288-291) */
interface LiveLecturerRow {
  id?: string | number
  name?: string | null
  avatar?: string | null
  title?: string | null
  intro?: string | null
  sort?: number | null
  status?: number | null
}

/** `live_channels` 裸行(本屏只取渲染所需;pushUrl/playUrl 等不取数,防直播流地址外泄) */
interface LiveChannelRow {
  id?: string | number
  title?: string | null
  coverImage?: string | null
  lecturerName?: string | null
  isLive?: boolean | null
  viewCount?: number | null
  intro?: string | null
}

/** `GET /api/live/lecturers/:id` → `success({ lecturer })`;查不到是 404 + error(live.ts:261-271) */
interface LecturerPayload {
  lecturer?: LiveLecturerRow | null
}

/** `GET /api/live/channels?lecturerId=` → `success({ list, total, page, pageSize })` */
interface ChannelsPayload {
  list?: LiveChannelRow[] | null
}

function toLecturer(raw: LiveLecturerRow): LiveLecturerListItem {
  return {
    id: String(raw.id ?? ''),
    name: raw.name ?? '',
    avatar: raw.avatar ?? null,
    title: raw.title ?? null,
    intro: raw.intro ?? null,
    sort: typeof raw.sort === 'number' ? raw.sort : undefined,
    status: typeof raw.status === 'number' ? raw.status : undefined,
  }
}

function toChannel(raw: LiveChannelRow): LiveLecturerChannelItem {
  return {
    id: String(raw.id ?? ''),
    title: raw.title ?? '',
    coverImage: raw.coverImage ?? null,
    // 表列可空:没有名字就是 null,屏上用「未知讲师」兜底,不拿 lecturerId 冒充
    lecturerName: raw.lecturerName ?? null,
    isLive: raw.isLive === true,
    viewCount: typeof raw.viewCount === 'number' ? raw.viewCount : 0,
    intro: raw.intro ?? null,
  }
}

/** 防御性归一:`{ list }` / 裸数组都收 */
function toChannels(
  data: ChannelsPayload | LiveChannelRow[] | null | undefined,
): LiveLecturerChannelItem[] {
  const rows = Array.isArray(data) ? data : Array.isArray(data?.list) ? data.list : []
  return rows.map(toChannel).filter((item) => item.id.length > 0)
}

/**
 * 直播讲师详情 —— RN 宿主壳,对齐 web `/lecturers/[id]`。
 *
 * 两段取数(与 web `PageClient.tsx:51-62` 的两个 query 同构):
 *  - 讲师本体 `/api/live/lecturers/:id`
 *  - 讲师课程 `/api/live/channels?lecturerId=<id>`
 * 各自独立 loading / error,课程慢不拖白讲师卡。
 *
 * 404 归一:后端查不到讲师回 `404 + error('讲师不存在')`,**不是** `{ lecturer: null }`。
 * 这里把 404 转成「讲师不存在」(lecturer=null, error=''),只有真失败才落 error ——
 * 否则用户会对着一个不存在的讲师点重试。
 */
export function LecturerProfileScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { id } = route.params

  const [lecturer, setLecturer] = useState<LiveLecturerListItem | null>(null)
  const [channels, setChannels] = useState<LiveLecturerChannelItem[]>([])
  const [loading, setLoading] = useState(true)
  const [channelsLoading, setChannelsLoading] = useState(true)
  const [error, setError] = useState('')
  const [channelsError, setChannelsError] = useState('')

  const loadLecturer = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchApi<LecturerPayload>(`/api/live/lecturers/${encodeURIComponent(id)}`)
      if (!res.success) {
        setLecturer(null)
        // 404 = 讲师不存在(见头注);其余才是加载失败,可重试
        setError(res.status === 404 ? '' : apiFailureToText(res, t('common.loadFailed')))
        return
      }
      const raw = res.data?.lecturer ?? null
      setLecturer(raw ? toLecturer(raw) : null)
    } catch {
      setLecturer(null)
      setError(t('common.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [id, t])

  const loadChannels = useCallback(async () => {
    setChannelsLoading(true)
    setChannelsError('')
    try {
      const res = await fetchApi<ChannelsPayload>(
        `/api/live/channels?lecturerId=${encodeURIComponent(id)}`,
      )
      if (!res.success) {
        setChannels([])
        setChannelsError(apiFailureToText(res, t('common.loadFailed')))
        return
      }
      setChannels(toChannels(res.data))
    } catch {
      setChannels([])
      setChannelsError(t('common.loadFailed'))
    } finally {
      setChannelsLoading(false)
    }
  }, [id, t])

  useEffect(() => {
    void loadLecturer()
    void loadChannels()
  }, [loadLecturer, loadChannels])

  return (
    <SharedLecturerProfileScreen
      t={t}
      lecturer={lecturer}
      channels={channels}
      loading={loading}
      channelsLoading={channelsLoading}
      error={error}
      channelsError={channelsError}
      onBack={() => navigation.goBack()}
      onRetry={() => void loadLecturer()}
      onRetryChannels={() => void loadChannels()}
      // web 频道卡跳 /live/[id];RN 侧对应 LiveDetail
      onOpenChannel={(channel) => navigation.navigate('LiveDetail', { id: channel.id })}
      colorScheme={resolvedTheme}
    />
  )
}
