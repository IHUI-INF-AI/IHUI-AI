// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { ActivityScreen as SharedActivityScreen, type ActivityItem } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { formatDateTime } from '../lib/format-date'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** 后端 GET /activities 原始行(activityFields:startAt/endAt/slug,status 是发布生命周期值 published/…) */
interface ActivityApiRow {
  id: string
  slug: string
  title: string
  description?: string | null
  startAt: string
  endAt: string
  status: string
  /** 后端 activityFields 的子查询计数(无参与者时为 0) */
  participants?: number
  /** 后端 GET /activities 按当前用户回填(未登录恒 false) */
  joined?: boolean
}

/**
 * 后端行 → 共享屏契约。
 *
 * 共享屏要的是 `startTime` / `endTime`(已格式化的展示文案)与 `upcoming|ongoing|ended` 三态,
 * 而后端给的是 `startAt` / `endAt` 原始时间戳和 `status: 'published'` 这一**发布态**。
 * 此前宿主把整个信封直接塞进 items ⇒ 三个可见后果:时间行显示 undefined、
 * 状态徽章永远走 statusColor 的兜底(灰色 ended)、「参与人数」恒为 undefined。
 */
function toActivityItem(row: ActivityApiRow, now: number): ActivityItem {
  const start = new Date(row.startAt).getTime()
  const end = new Date(row.endAt).getTime()
  const invalid = Number.isNaN(start) || Number.isNaN(end)
  const status: ActivityItem['status'] = invalid
    ? 'ended'
    : now < start
      ? 'upcoming'
      : now > end
        ? 'ended'
        : 'ongoing'
  return {
    id: row.id,
    // 详情路由是 GET /activities/:slug,传 id 会 404 —— 必须把 slug 带过去。
    slug: row.slug,
    title: row.title,
    description: row.description ?? '',
    startTime: formatDateTime(row.startAt),
    endTime: formatDateTime(row.endAt),
    status,
    participants: row.participants,
    // 后端已按当前用户回填;没有该字段(未登录)时按未报名处理。
    joined: row.joined === true,
  }
}

export function ActivityScreen() {
  const { resolvedTheme } = useTheme()
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [rows, setRows] = useState<ActivityApiRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [joiningId, setJoiningId] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      // 后端 GET /activities 回 success({ list })(promotions.ts)，web 侧读的正是 d.list；
      // 这里曾把整个信封当数组 ⇒ 列表永远空，不抛错。
      const res = await fetchApi<{ list: ActivityApiRow[] }>('/activities')
      if (!res.success) {
        // 透出后端 message:原先 `throw new Error('http')` 被 catch 压成一句通用「加载失败」⇒
        // 用户看不到"未登录/服务异常"这类可行动的原因,只会反复下拉重试。
        setError(res.error || t('activity.loadFailed'))
        return
      }
      setRows(res.data?.list ?? [])
    } catch {
      setError(t('activity.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  // 展示态在数据落地这一刻定格(下拉刷新重算)。刻意不在 render 里读 Date.now():
  // 那会让每次重渲染都产出新对象,把 FlatList 的 renderItem 全部打穿。
  const items = useMemo(() => {
    const now = Date.now()
    return rows.map((row) => toActivityItem(row, now))
  }, [rows])

  const onRefresh = () => {
    setRefreshing(true)
    void load()
  }

  /**
   * 报名 / 取消报名。后端两条对称端点(promotions.ts):
   *   POST   /activities/:id/join —— 201 新建 / 409 已参与 / 400 不在可参与状态
   *   DELETE /activities/:id/join —— 取消参与
   * 成功后重拉列表:participants 是后端实时计数,本地自增会与真实值漂移。
   */
  const onJoin = useCallback(
    async (item: ActivityItem) => {
      if (joiningId) return
      setJoiningId(item.id)
      setError('')
      try {
        const res = await fetchApi(`/activities/${item.id}/join`, {
          method: item.joined ? 'DELETE' : 'POST',
        })
        if (!res.success) {
          setError(res.error || t('activity.loadFailed'))
          return
        }
        await load()
      } catch {
        setError(t('activity.loadFailed'))
      } finally {
        setJoiningId('')
      }
    },
    [joiningId, load, t],
  )

  return (
    <SharedActivityScreen
      t={t}
      items={items}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={onRefresh}
      onBack={() => navigation.goBack()}
      // 详情页请求的是 GET /activities/:slug,所以 id 之外还要把 slug 带过去。
      onItemPress={(item) =>
        navigation.navigate('ActivityDetail', { id: item.id, slug: item.slug })
      }
      onJoin={(item) => {
        void onJoin(item)
      }}
      joiningId={joiningId}
      onRetry={() => {
        void load()
      }}
      colorScheme={resolvedTheme}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
