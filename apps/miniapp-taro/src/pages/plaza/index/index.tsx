// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// 对齐目标(RN 共享屏): packages/app/src/features/plaza/PlazaScreen.tsx
// 2026-11-05 薄壳化:列表/搜索/状态条/发布按钮 + 赛道抽屉/身份切换/详情居中弹层 全部走共享屏;
// 页内只留小程序导航头(平台 chrome,RN 对应 NavBar)与数据获取。
// 三段弹层 props 由 RN 同屏真消费(见提交说明 file:line),不是"只有小程序传"的 prop。

import { useCallback, useRef, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh, useReachBottom } from '@tarojs/taro'
import * as api from '@/api'
import { useTt, t } from '@/i18n'
import { logger } from '@/utils/logger'
import ThemeRoot from '@/components/ThemeRoot'
import { PlazaScreen } from '@ihui/rn-app/features/plaza/PlazaScreen'
import { useUserStore } from '@/stores/user'
import type { PlazaItem } from '@ihui/types'
import './index.css'

const PAGE_SIZE = 10

/** 赛道选项(与 RN CategoryDropdown 同一份数据形状;id 空串=全部) */
const TRACK_ITEMS = [
  { id: '', label: '全部赛道' },
  ...['ai', 'web', 'app', 'design', 'video', 'ops'].map((id) => ({ id, label: id.toUpperCase() })),
]

/** 身份选项(与 RN 身份弹层同形:需求方/开发者) */
const IDENTITY_ITEMS = [
  { id: 'demander', labelKey: 'plaza.index.identityDemander', fallback: '需求方' },
  { id: 'developer', labelKey: 'plaza.index.identityDeveloper', fallback: '开发者' },
]

/** 后端行 → 共享屏 PlazaItem(只做字段改名,不在壳里二次投影) */
function normalizeRow(raw: Record<string, unknown>): PlazaItem {
  const categories = Array.isArray(raw['categories']) ? (raw['categories'] as string[]) : []
  const types = Array.isArray(raw['types']) ? (raw['types'] as string[]) : []
  const track = categories[0] ?? types[0] ?? ''
  return {
    ...raw,
    id: String(raw['id'] ?? ''),
    title: String(raw['title'] ?? ''),
    description: String(raw['description'] ?? ''),
    creator: String(raw['userId'] ?? ''),
    status: String(raw['taskStatus'] ?? raw['status'] ?? ''),
    track,
    category: track,
  } as unknown as PlazaItem
}

export default function PlazaIndex() {
  const tt = useTt()
  const user = useUserStore((s) => s.user)
  const [items, setItems] = useState<PlazaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const [status, setStatus] = useState('waiting')
  const [search, setSearch] = useState('')
  const [showSearch, setShowSearch] = useState(true)
  const [track, setTrack] = useState('')
  const [trackVisible, setTrackVisible] = useState(false)
  const [identity, setIdentity] = useState('demander')
  const [identityVisible, setIdentityVisible] = useState(false)
  const [detailItem, setDetailItem] = useState<PlazaItem | null>(null)
  const queryRef = useRef({ status: 'waiting', search: '', track: '' })
  const pageRef = useRef(1)
  const busyRef = useRef(false)

  const load = useCallback(
    async (reset: boolean) => {
      if (busyRef.current) return
      busyRef.current = true
      if (reset) setRefreshing(true)
      else setLoadingMore(true)
      try {
        const q = queryRef.current
        const res = (await api.getPlazaList({
          page: reset ? 1 : pageRef.current + 1,
          pageSize: PAGE_SIZE,
          taskStatus: q.status === 'mine' || !q.status ? undefined : q.status,
          creator: q.status === 'mine' && user?.id ? String(user.id) : undefined,
          search: q.search || undefined,
          categories: q.track || undefined,
        })) as { list?: Record<string, unknown>[]; total?: number }
        const rows = (res.list ?? []).map(normalizeRow)
        pageRef.current = reset ? 1 : pageRef.current + 1
        setItems((prev) => (reset ? rows : [...prev, ...rows]))
        setHasMore(pageRef.current * PAGE_SIZE < Number(res.total ?? 0))
        setError('')
      } catch (e) {
        logger.error('plaza/index', 'load plaza list failed', e)
        setError(tt('plaza.index.loadFail', '加载失败,请稍后重试'))
      } finally {
        busyRef.current = false
        setLoading(false)
        setRefreshing(false)
        setLoadingMore(false)
      }
    },
    [tt, user?.id],
  )

  useDidShow(() => {
    void load(true)
  })

  usePullDownRefresh(() => {
    void load(true).finally(() => Taro.stopPullDownRefresh())
  })

  useReachBottom(() => {
    if (hasMore) void load(false)
  })

  const applyStatus = (next: string) => {
    queryRef.current = { ...queryRef.current, status: next }
    setStatus(next)
    void load(true)
  }

  const applySearch = (next: string) => {
    queryRef.current = { ...queryRef.current, search: next }
    setSearch(next)
  }

  const selectTrack = (id: string) => {
    queryRef.current = { ...queryRef.current, track: id }
    setTrack(id)
    setTrackVisible(false)
    void load(true)
  }

  const selectIdentity = (id: string) => {
    setIdentity(id)
    setIdentityVisible(false)
    if (id === 'developer') void Taro.navigateTo({ url: '/pkg-ai/dev-space/index' })
  }

  return (
    <ThemeRoot>
      <View className="pza-page">
        <View className="pza-header">
          <Text className="pza-page-title">{tt('plaza.index.title', 'AI需求广场')}</Text>
          <View className="pza-nav-btns">
            {[
              {
                id: 'search',
                label: tt('plaza.index.search', '搜索'),
                onClick: () => setShowSearch((v) => !v),
              },
              {
                id: 'menu',
                label: tt('plaza.index.menu', '菜单'),
                onClick: () => setIdentityVisible(true),
              },
              {
                id: 'category',
                label: tt('plaza.index.category', '分类'),
                onClick: () => setTrackVisible(true),
              },
            ].map((action) => (
              <Text key={action.id} className="pza-nav-btn" onClick={action.onClick}>
                {action.label}
              </Text>
            ))}
          </View>
        </View>
        <PlazaScreen
          t={t}
          items={items}
          loading={loading}
          refreshing={refreshing}
          loadingMore={loadingMore}
          error={error}
          status={status}
          search={search}
          showSearch={showSearch}
          onRefresh={() => void load(true)}
          onEndReached={() => {
            if (hasMore) void load(false)
          }}
          onStatusChange={applyStatus}
          onSearchChange={applySearch}
          onSubmitSearch={() => void load(true)}
          onPressItem={(item) => setDetailItem(item)}
          onPublish={() => void Taro.navigateTo({ url: '/pkg-content/plaza/set-need/index' })}
          onRetry={() => void load(true)}
          trackFilter={{
            visible: trackVisible,
            items: TRACK_ITEMS,
            selectedId: track,
            onSelect: selectTrack,
            onVisibleChange: setTrackVisible,
            panelTitle: tt('plaza.index.category', '分类'),
          }}
          identitySheet={{
            visible: identityVisible,
            title: tt('plaza.index.identityTitle', '切换身份'),
            items: IDENTITY_ITEMS.map((it) => ({ id: it.id, label: tt(it.labelKey, it.fallback) })),
            selectedId: identity,
            onSelect: selectIdentity,
            onClose: () => setIdentityVisible(false),
          }}
          detail={{
            item: detailItem,
            onClose: () => setDetailItem(null),
            onOpenDetail: (item) => {
              setDetailItem(null)
              void Taro.navigateTo({ url: `/pkg-content/plaza/detail/index?id=${String(item.id)}` })
            },
          }}
        />
      </View>
    </ThemeRoot>
  )
}
