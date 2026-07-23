import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useRef, useEffect } from 'react'
import { getRefundList } from '@/api'
import { useI18n } from '@/i18n'
import './refund-list.css'

type RefundStatus = 'refunding' | 'refunded' | 'rejected'
type TabKey = 'all' | RefundStatus

interface RefundItem {
  id: string
  orderNo: string
  title: string
  amount: number
  status: RefundStatus
  applyTime: string
  reason: string
  refundTime: string
  estimateTime: string
}

interface TimelineStep {
  title: string
  time: string
  state: 'done' | 'active' | 'todo'
}

const PAGE_SIZE = 10

const toMs = (v: unknown): number => {
  if (typeof v === 'number') return v > 1e12 ? v : v * 1000
  const n = Number(v)
  if (!isNaN(n) && n > 0) return n > 1e12 ? n : n * 1000
  const d = Date.parse(String(v))
  return isNaN(d) ? 0 : d
}

const formatTime = (v: unknown): string => {
  const ms = toMs(v)
  if (!ms) return v ? String(v) : ''
  const d = new Date(ms)
  if (isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

const toYuan = (cents: number) => ((cents || 0) / 100).toFixed(2)

const normalizeStatus = (raw?: unknown, refundRaw?: unknown): RefundStatus => {
  const s = String(refundRaw ?? raw ?? '').toLowerCase()
  if (s.includes('reject') || s === 'failed' || s === 'cancelled' || s === 'rejected') return 'rejected'
  if (s.includes('refund') && !s.includes('ing')) return 'refunded'
  return 'refunding'
}

export default function RefundList() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))

  const [rawList, setRawList] = useState<RefundItem[]>([])
  const [displayList, setDisplayList] = useState<RefundItem[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)

  const pageRef = useRef(1)
  const hasMoreRef = useRef(true)
  const loadingRef = useRef(false)

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: 'all', label: tt('order.refundList.tabAll', '全部') },
    { key: 'refunding', label: tt('order.refundList.tabRefunding', '退款中') },
    { key: 'refunded', label: tt('order.refundList.tabRefunded', '已退款') },
    { key: 'rejected', label: tt('order.refundList.tabRejected', '已拒绝') },
  ]

  const statusText = (s: RefundStatus) =>
    s === 'refunding'
      ? tt('order.refundList.statusRefunding', '退款中')
      : s === 'refunded'
        ? tt('order.refundList.statusRefunded', '已退款')
        : tt('order.refundList.statusRejected', '已拒绝')

  const load = async (reset = false) => {
    if (loadingRef.current) return
    if (reset) {
      pageRef.current = 1
      hasMoreRef.current = true
      setHasMore(true)
      setRawList([])
    }
    if (!hasMoreRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      const res = await getRefundList({ page: pageRef.current, pageSize: PAGE_SIZE })
      const rows = (res.list || []) as unknown as Array<Record<string, unknown>>
      const items: RefundItem[] = rows.map((u) => ({
        id: String(u.id ?? u.orderNo ?? ''),
        orderNo: String(u.orderNo ?? u.outTradeNo ?? ''),
        title: String(u.title ?? u.productName ?? ''),
        amount: Number(u.amount ?? 0),
        status: normalizeStatus(u.status, u.refundStatus),
        applyTime: formatTime(u.applyTime ?? u.createTime ?? u.refundTime),
        reason: String(u.reason ?? u.refundReason ?? ''),
        refundTime: formatTime(u.refundTime),
        estimateTime: formatTime(u.estimateTime ?? u.refundTime),
      }))
      setRawList((prev) => (reset ? items : [...prev, ...items]))
      const more = pageRef.current * PAGE_SIZE < (res.total ?? 0)
      hasMoreRef.current = more
      setHasMore(more)
      pageRef.current++
    } catch {
      // ignore
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }

  useDidShow(() => {
    load(true)
  })

  useEffect(() => {
    setDisplayList(activeTab === 'all' ? rawList : rawList.filter((i) => i.status === activeTab))
  }, [rawList, activeTab])

  const onRefresh = async () => {
    setRefreshing(true)
    await load(true)
    setRefreshing(false)
  }

  const toggleExpand = (id: string) => setExpandedId((cur) => (cur === id ? null : id))

  const goDetail = (item: RefundItem) => {
    Taro.navigateTo({ url: `/pages/order/detail?id=${item.id}` })
  }

  const buildTimeline = (item: RefundItem): TimelineStep[] => {
    const finalDone = item.status === 'refunded' || item.status === 'rejected'
    return [
      { title: tt('order.refundList.stepApply', '申请退款'), time: item.applyTime, state: 'done' },
      {
        title: tt('order.refundList.stepReview', '审核中'),
        time: '',
        state: finalDone ? 'done' : 'active',
      },
      {
        title: statusText(item.status),
        time: item.refundTime,
        state: finalDone ? 'done' : 'todo',
      },
    ]
  }

  return (
    <View className="refund-page">
      <View className="refund-tabs">
        {tabs.map((tab) => (
          <View
            key={tab.key}
            className={`refund-tab${activeTab === tab.key ? ' refund-tab-active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <Text>{tab.label}</Text>
          </View>
        ))}
      </View>

      <ScrollView
        scrollY
        refresherEnabled
        refresherTriggered={refreshing}
        onRefresherRefresh={onRefresh}
        onScrollToLower={() => load()}
        lowerThreshold={80}
        className="refund-scroll"
      >
        {displayList.length > 0 && (
          <View className="refund-list">
            {displayList.map((item) => {
              const opened = expandedId === item.id
              return (
                <View key={item.id} className="refund-card">
                  <View className="refund-card-head">
                    <Text className="refund-order-no">
                      {t('order.refundList.orderNo', { no: item.orderNo })}
                    </Text>
                    <Text className={`refund-status refund-status-${item.status}`}>
                      {statusText(item.status)}
                    </Text>
                  </View>
                  <View className="refund-card-body">
                    <Text className="refund-title">{item.title}</Text>
                    <View className="refund-reason">
                      <Text className="refund-reason-label">
                        {tt('order.refundList.reason', '退款原因')}
                      </Text>
                      <Text className="refund-reason-text">{item.reason || '-'}</Text>
                    </View>
                  </View>
                  <View className="refund-card-foot">
                    <Text className="refund-time">{item.applyTime}</Text>
                    <Text className="refund-amount">¥{toYuan(item.amount)}</Text>
                  </View>

                  {item.status === 'refunded' && item.estimateTime && (
                    <View className="refund-tip">
                      {tt('order.refundList.estimateTip', '预计到账时间')}: {item.estimateTime}
                    </View>
                  )}

                  <View className="refund-card-actions">
                    <Text className="refund-action-btn" onClick={() => toggleExpand(item.id)}>
                      {opened
                        ? tt('order.refundList.collapse', '收起进度')
                        : tt('order.refundList.viewProgress', '查看进度')}
                    </Text>
                    <Text
                      className="refund-action-btn refund-action-primary"
                      onClick={() => goDetail(item)}
                    >
                      {tt('order.refundList.viewOrder', '订单详情')}
                    </Text>
                  </View>

                  {opened && (
                    <View className="refund-timeline">
                      {buildTimeline(item).map((step, idx, arr) => (
                        <View key={idx} className={`refund-step refund-step-${step.state}`}>
                          <View className="refund-step-indicator">
                            <View className="refund-step-dot" />
                            {idx < arr.length - 1 && <View className="refund-step-line" />}
                          </View>
                          <View className="refund-step-content">
                            <Text className="refund-step-title">{step.title}</Text>
                            {step.time ? (
                              <Text className="refund-step-time">{step.time}</Text>
                            ) : null}
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )
            })}
          </View>
        )}

        {displayList.length === 0 && !loading && (
          <View className="refund-empty">
            <Text className="refund-empty-icon">📦</Text>
            <Text className="refund-empty-text">
              {tt('order.refundList.empty', '暂无退款记录')}
            </Text>
          </View>
        )}
        {loading && <Text className="refund-loading">{tt('common.loading', '加载中…')}</Text>}
        {!loading && !hasMore && displayList.length > 0 && (
          <Text className="refund-no-more">{tt('order.refundList.noMore', '没有更多了')}</Text>
        )}
      </ScrollView>
    </View>
  )
}
