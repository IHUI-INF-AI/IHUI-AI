// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 薄壳:渲染全部委托共享屏 packages/app/src/features/live-list/LiveListScreen.tsx
// 端内保留:① GET /live/channels 取数与分页;② 下拉刷新/触底加载;③ 分享钩子;
// ④ 开播/日历/我的订阅三入口(日历为本端独有,web/RN 无对应屏 ⇒ 桶②)。
import { useTt, useI18n } from '@/i18n'
import Taro, {
  usePullDownRefresh,
  useReachBottom,
  useShareAppMessage,
  useShareTimeline,
} from '@tarojs/taro'
import { useState, useEffect, useCallback, useRef } from 'react'
import { get } from '@/api'
import ThemeRoot from '@/components/ThemeRoot'
import { useTheme } from '@/rn-compat/theme'
import { LiveListScreen } from '@ihui/rn-app/features/live-list/LiveListScreen'
import type { LiveListItem, LiveListTab } from '@ihui/types'

/**
 * `GET /live/channels`(apps/api/src/routes/live.ts)的 live_channels 行。
 * 不取 `GET /live/list` 的唯一理由:它的投影只发 id/title/status/anchor/playUrl/watchCount,startTime 被丢掉
 * ⇒ 本页"开始时间"一行永远只能渲染 '—'(键在册而值不产出 = 假绿);两端点行集相同(publishedOnly=true)。
 */
interface LiveChannelRow {
  id: string
  title: string
  lecturerName: string | null
  startTime: string | null
  isLive: boolean
  viewCount: number
}

/** 状态档与后端 deriveLiveStatus 同判据;该端点恒 publishedOnly=true ⇒ upcoming 打不到 ⇒ 本端只给三档 */
const TABS: LiveListTab[] = ['all', 'ongoing', 'ended']

/** 开始时间:与错题本同法(Intl),取不到时刻一律空串(空串再落 '—') */
function formatStart(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(d)
}

export default function LiveList() {
  const { t } = useI18n()
  const tt = useTt()
  const { resolvedTheme } = useTheme()
  const [list, setList] = useState<LiveChannelRow[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [status, setStatus] = useState('')
  const pageRef = useRef(1)
  const hasMoreRef = useRef(true)
  const loadingRef = useRef(false)
  const lenRef = useRef(0)
  const statusRef = useRef('')

  const load = useCallback(async (reset = false) => {
    if (loadingRef.current) return
    if (reset) {
      pageRef.current = 1
      hasMoreRef.current = true
      lenRef.current = 0
      setList([])
    }
    if (!reset && !hasMoreRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      // 全部档不发筛选;'living'/'ended' 走后端真读的 isLive;刻意不发 status=(z.coerce.number().int(),字符串 ⇒ 400 整页报错)
      const tab = statusRef.current
      const res = await get<{ list: LiveChannelRow[]; total: number }>('/live/channels', {
        page: pageRef.current,
        pageSize: 10,
        ...(tab ? { isLive: String(tab === 'living') } : {}),
      })
      const more = res.list || []
      lenRef.current = reset ? more.length : lenRef.current + more.length
      setList((prev) => (reset ? more : [...prev, ...more]))
      hasMoreRef.current = lenRef.current < res.total
      pageRef.current++
      setLoadFailed(false)
    } catch {
      // 对齐 RN:失败但已有内容时保留列表,只在空列表上落错误态(重试取 liveList.retry)
      setLoadFailed(true)
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [])

  const switchStatus = useCallback(
    (s: string) => {
      statusRef.current = s
      setStatus(s)
      load(true)
    },
    [load],
  )

  const activeTab: LiveListTab =
    status === 'living' ? 'ongoing' : status === 'ended' ? 'ended' : 'all'

  const onSelectTab = useCallback(
    (tab: LiveListTab) => {
      if (tab === 'ongoing') switchStatus('living')
      else if (tab === 'ended') switchStatus('ended')
      else switchStatus('')
    },
    [switchStatus],
  )

  usePullDownRefresh(() => {
    setRefreshing(true)
    load(true).finally(() => {
      setRefreshing(false)
      Taro.stopPullDownRefresh()
    })
  })
  useReachBottom(() => {
    void load()
  })

  useEffect(() => {
    void load(true)
  }, [load])

  useShareAppMessage(() => ({
    title: t('share.appTitle'),
    path: '/pkg-learn/live/list',
    imageUrl: '/static/share.png',
  }))
  useShareTimeline(() => ({
    title: t('share.timelineTitle'),
    query: '',
  }))

  const items: LiveListItem[] = list.map((item) => ({
    id: item.id,
    title: item.title,
    lecturer: item.lecturerName ?? '',
    status: item.isLive ? 'ongoing' : 'ended',
    startAt: formatStart(item.startTime),
    viewerCount: item.viewCount,
    cover: null,
  }))

  return (
    <ThemeRoot>
      <LiveListScreen
        t={t}
        items={items}
        activeTab={activeTab}
        onSelectTab={onSelectTab}
        tabs={TABS}
        loading={loading}
        refreshing={refreshing}
        error={loadFailed && list.length === 0 ? t('common.failed') : ''}
        onRefresh={() => {
          setRefreshing(true)
          void load(true).finally(() => setRefreshing(false))
        }}
        onPressItem={(item) => Taro.navigateTo({ url: `/pkg-learn/live/detail?id=${item.id}` })}
        onBack={() => void Taro.navigateBack()}
        onEndReached={() => void load()}
        loadingMore={loading && list.length > 0}
        onRetry={() => void load(true)}
        colorScheme={resolvedTheme}
        onNavigate={(target, params) => {
          if (target === 'LiveDetail' && params?.id !== undefined) {
            Taro.navigateTo({ url: `/pkg-learn/live/detail?id=${String(params.id)}` })
          }
        }}
        quickActions={{
          labels: {
            host: tt('live.startLiveBtn', '📺 我要开播'),
            calendar: tt('live.calendarBtn', '📅 日历'),
            subscriptions: tt('live.mySubscriptionBtn', '🔔 我的订阅'),
          },
          onPressHost: () => Taro.navigateTo({ url: '/pkg-learn/live/host/index' }),
          onPressCalendar: () => Taro.navigateTo({ url: '/pkg-learn/live/calendar' }),
          onPressSubscriptions: () => Taro.navigateTo({ url: '/pkg-learn/live/subscribe' }),
          colorScheme: resolvedTheme,
        }}
      />
    </ThemeRoot>
  )
}
