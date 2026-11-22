// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import {
  ActivityDetailScreen as SharedActivityDetailScreen,
  type ActivityDetailItem,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { formatDateTime } from '../lib/format-date'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** 后端 GET /activities/:slug 的原始行(activityFields + joined) */
interface ActivityDetailApi {
  id: string
  slug: string
  title: string
  description?: string | null
  startAt: string
  endAt: string
  joined?: boolean
}

/**
 * 后端行 → 共享屏契约。
 * 契约里的 `content` 对应后端的 `description`;`rules`(jsonb)结构由业务定义,
 * 不硬塞进正文。activities 表没有 location 列 ⇒ 不伪造地点,共享屏按缺省不渲染该行。
 */
function toDetailItem(row: ActivityDetailApi): ActivityDetailItem {
  return {
    id: row.id,
    title: row.title,
    content: row.description ?? '',
    startAt: formatDateTime(row.startAt),
    endAt: formatDateTime(row.endAt),
    joined: row.joined === true,
  }
}

export function ActivityDetailScreen() {
  const { resolvedTheme } = useTheme()
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const route = useRoute<{
    key: string
    name: 'ActivityDetail'
    params: RootStackParamList['ActivityDetail']
  }>()
  // 后端按 slug 查(GET /activities/:slug)。列表页新路径会带 slug;
  // 老调用方只传 id 时退回 id —— 至少还试一次,而不是必然 404。
  const slug = route.params?.slug ?? route.params?.id ?? ''
  const [row, setRow] = useState<ActivityDetailItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [joining, setJoining] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      // 后端 GET /activities/:slug 回 success({ activity })(promotions.ts),web 侧读 d.activity。
      const res = await fetchApi<{ activity: ActivityDetailApi }>(`/activities/${slug}`)
      if (!res.success) {
        // 透出后端 message:原实现 throw 一个 'http'、再由 catch 换成通用文案 ⇒
        // 用户只知道"加载失败",看不到"活动不存在/未登录"这类可行动的原因。
        setError(res.error || t('activity.loadFailed'))
        return
      }
      const activity = res.data?.activity
      setRow(activity ? toDetailItem(activity) : null)
    } catch {
      setError(t('activity.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [slug, t])

  useEffect(() => {
    void load()
  }, [load])

  /**
   * 报名 / 取消报名。joined 由后端回填(未登录恒 false);
   * 成功后重拉详情 —— 让 joined 与按钮文案都以后端为准,不在本地猜状态。
   */
  const submitJoin = useCallback(
    async (nextJoined: boolean) => {
      if (joining || !row) return
      setJoining(true)
      setError('')
      try {
        const res = await fetchApi(`/activities/${row.id}/join`, {
          method: nextJoined ? 'POST' : 'DELETE',
        })
        if (!res.success) {
          setError(res.error || t('activity.loadFailed'))
          return
        }
        await load()
      } catch {
        setError(t('activity.loadFailed'))
      } finally {
        setJoining(false)
      }
    },
    [joining, row, load, t],
  )

  return (
    <SharedActivityDetailScreen
      t={t}
      item={row}
      loading={loading}
      error={error}
      onBack={() => navigation.goBack()}
      onJoin={() => {
        void submitJoin(true)
      }}
      onLeave={() => {
        void submitJoin(false)
      }}
      joining={joining}
      onRetry={() => {
        void load()
      }}
      colorScheme={resolvedTheme}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
