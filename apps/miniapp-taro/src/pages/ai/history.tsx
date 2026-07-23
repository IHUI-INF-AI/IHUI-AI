import { View, Text, Input, Button, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useMemo } from 'react'
import { useI18n } from '@/i18n'
import './history.css'

type FilterType = 'all' | 'chat' | 'image' | 'voice' | 'agent'
type GroupKey = 'today' | 'yesterday' | 'thisWeek' | 'earlier'

interface HistoryItem {
  id: string
  title: string
  time: string
  type?: FilterType
  timestamp?: number
  messages: Array<{ content: string }>
  messageCount?: number
}

const HISTORY_KEY = 'ai_chat_history'
const PAGE_SIZE = 20

const FILTERS: Array<{ key: FilterType; labelKey: string; fallback: string; icon: string }> = [
  { key: 'all', labelKey: 'ai.historyPage.filterAll', fallback: '全部', icon: '💬' },
  { key: 'chat', labelKey: 'ai.historyPage.filterChat', fallback: 'AI对话', icon: '💬' },
  { key: 'image', labelKey: 'ai.historyPage.filterImage', fallback: 'AI绘图', icon: '🎨' },
  { key: 'voice', labelKey: 'ai.historyPage.filterVoice', fallback: 'AI语音', icon: '🎤' },
  { key: 'agent', labelKey: 'ai.historyPage.filterAgent', fallback: '智能体', icon: '🤖' },
]

const GROUP_LABELS: Array<{ key: GroupKey; labelKey: string; fallback: string }> = [
  { key: 'today', labelKey: 'ai.historyPage.today', fallback: '今天' },
  { key: 'yesterday', labelKey: 'ai.historyPage.yesterday', fallback: '昨天' },
  { key: 'thisWeek', labelKey: 'ai.historyPage.thisWeek', fallback: '本周' },
  { key: 'earlier', labelKey: 'ai.historyPage.earlier', fallback: '更早' },
]

function loadAll(): HistoryItem[] {
  try {
    const raw = Taro.getStorageSync(HISTORY_KEY)
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

function getGroupKey(ts: number): GroupKey {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const day = 86400000
  if (ts >= today) return 'today'
  if (ts >= today - day) return 'yesterday'
  if (ts >= today - day * 7) return 'thisWeek'
  return 'earlier'
}

function itemTimestamp(h: HistoryItem): number {
  if (h.timestamp) return h.timestamp
  const parsed = new Date(h.time).getTime()
  return isNaN(parsed) ? Date.now() : parsed
}

const fmtTime = (ts: number) =>
  new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(ts)

export default function HistoryPage() {
  const { t } = useI18n()
  const tt = useCallback((k: string, fb: string) => (t(k) === k ? fb : t(k)), [t])

  const [list, setList] = useState<HistoryItem[]>([])
  const [filter, setFilter] = useState<FilterType>('all')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(() => {
    setList(loadAll())
    setPage(1)
    setHasMore(true)
  }, [])

  useDidShow(load)

  const filtered = useMemo(() => {
    let arr = list
    if (filter !== 'all') arr = arr.filter((x) => (x.type || 'chat') === filter)
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase()
      arr = arr.filter(
        (x) =>
          x.title.toLowerCase().includes(kw) ||
          (x.messages?.[x.messages.length - 1]?.content || '').toLowerCase().includes(kw),
      )
    }
    return [...arr].sort((a, b) => itemTimestamp(b) - itemTimestamp(a))
  }, [list, filter, keyword])

  const visible = useMemo(() => filtered.slice(0, page * PAGE_SIZE), [filtered, page])

  const groups = useMemo(() => {
    const m: Record<GroupKey, HistoryItem[]> = {
      today: [],
      yesterday: [],
      thisWeek: [],
      earlier: [],
    }
    visible.forEach((item) => {
      m[getGroupKey(itemTimestamp(item))].push(item)
    })
    return m
  }, [visible])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    setTimeout(() => {
      load()
      setRefreshing(false)
      Taro.showToast({ title: tt('ai.historyPage.refreshSuccess', '刷新成功'), icon: 'none' })
    }, 500)
  }, [load, tt])

  const onLoadMore = useCallback(() => {
    if (!hasMore) return
    const next = page + 1
    if (next * PAGE_SIZE >= filtered.length) {
      setHasMore(false)
      return
    }
    setPage(next)
  }, [hasMore, page, filtered.length])

  const goChat = useCallback((h?: HistoryItem) => {
    Taro.navigateTo({ url: `/pages/ai/chat${h ? `?sessionId=${h.id}` : ''}` })
  }, [])

  const onDeleteOne = useCallback(
    (h: HistoryItem) => {
      Taro.showModal({
        title: tt('ai.historyPage.deleteOne', '删除该对话'),
        content: h.title || h.id,
        confirmText: t('common.confirm'),
        cancelText: t('common.cancel'),
        success: (res) => {
          if (!res.confirm) return
          setList((prev) => {
            const next = prev.filter((x) => x.id !== h.id)
            Taro.setStorageSync(HISTORY_KEY, next)
            return next
          })
          Taro.showToast({ title: t('success.deleted'), icon: 'none' })
        },
      })
    },
    [t, tt],
  )

  const onClearAll = useCallback(() => {
    if (list.length === 0) return
    Taro.showModal({
      title: tt('ai.historyPage.clearAll', '清空全部'),
      content: tt('ai.historyPage.clearConfirm', '确定要清空全部对话历史吗?'),
      confirmText: t('common.confirm'),
      cancelText: t('common.cancel'),
      success: (res) => {
        if (!res.confirm) return
        Taro.setStorageSync(HISTORY_KEY, [])
        setList([])
        Taro.showToast({ title: tt('ai.historyPage.cleared', '已清空'), icon: 'none' })
      },
    })
  }, [list.length, t, tt])

  const isFiltered = keyword.trim() || filter !== 'all'
  const iconFor = (h: HistoryItem) =>
    FILTERS.find((f) => f.key === (h.type || 'chat'))?.icon || '💬'

  return (
    <View className="page">
      <View className="search-bar">
        <Input
          className="search-input"
          placeholder={tt('ai.historyPage.searchPlaceholder', '搜索对话历史')}
          value={keyword}
          onInput={(e) => {
            setKeyword(e.detail.value)
            setPage(1)
            setHasMore(true)
          }}
        />
        {list.length > 0 ? (
          <Text className="clear-all" onClick={onClearAll}>
            {tt('ai.historyPage.clearAll', '清空全部')}
          </Text>
        ) : null}
      </View>

      <View className="filters">
        {FILTERS.map((f) => (
          <Text
            key={f.key}
            className={`filter-chip${filter === f.key ? ' active' : ''}`}
            onClick={() => {
              setFilter(f.key)
              setPage(1)
              setHasMore(true)
            }}
          >
            {f.icon} {tt(f.labelKey, f.fallback)}
          </Text>
        ))}
      </View>

      <ScrollView
        className="list-scroll"
        scrollY
        refresherEnabled
        refresherTriggered={refreshing}
        onRefresherRefresh={onRefresh}
        onScrollToLower={onLoadMore}
        lowerThreshold={80}
      >
        {filtered.length === 0 ? (
          <View className="empty">
            <Text className="empty-icon">{isFiltered ? '🔍' : '💬'}</Text>
            <Text className="empty-text">
              {isFiltered
                ? tt('ai.historyPage.noResult', '未找到相关对话')
                : t('ai.historyPage.empty')}
            </Text>
            {!isFiltered ? (
              <Button className="btn" onClick={() => goChat()}>
                {tt('ai.historyPage.startNew', '开始新对话')}
              </Button>
            ) : null}
          </View>
        ) : (
          <View className="list">
            {GROUP_LABELS.map((g) => {
              const items = groups[g.key]
              if (!items || items.length === 0) return null
              return (
                <View key={g.key} className="group">
                  <Text className="group-label">{tt(g.labelKey, g.fallback)}</Text>
                  {items.map((h) => {
                    const ts = itemTimestamp(h)
                    const count = h.messageCount || h.messages?.length || 0
                    const preview =
                      h.messages?.[h.messages.length - 1]?.content || t('ai.historyPage.empty')
                    return (
                      <View
                        key={h.id}
                        className="item"
                        onClick={() => goChat(h)}
                        onLongPress={() => onDeleteOne(h)}
                      >
                        <View className="item-icon">
                          <Text>{iconFor(h)}</Text>
                        </View>
                        <View className="item-body">
                          <View className="item-header">
                            <Text className="title">{h.title}</Text>
                            <Text className="time">{fmtTime(ts)}</Text>
                          </View>
                          <Text className="preview">{preview}</Text>
                          <Text className="meta">
                            {tt('ai.historyPage.msgCount', '{{n}} 条消息').replace(
                              '{{n}}',
                              String(count),
                            )}
                          </Text>
                        </View>
                      </View>
                    )
                  })}
                </View>
              )
            })}
            {!hasMore ? (
              <Text className="no-more">{tt('ai.historyPage.noMore', '没有更多了')}</Text>
            ) : null}
          </View>
        )}
      </ScrollView>
    </View>
  )
}
