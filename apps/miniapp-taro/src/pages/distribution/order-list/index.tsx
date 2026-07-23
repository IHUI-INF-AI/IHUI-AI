import { View, Text } from '@tarojs/components'
import Taro, { useDidShow, useReachBottom, usePullDownRefresh } from '@tarojs/taro'
import { useState, useRef } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { logger } from '@/utils/logger'
import './index.css'

interface OrderItem {
  id: string
  orderNo: string
  product: string
  amount: number
  commission: number
  status: string
  time: string
}

type TabValue = '' | 'settled' | 'pending'

interface Tab {
  value: TabValue
  labelKey: string
  fallback: string
}

const TABS: Tab[] = [
  { value: '', labelKey: 'distribution.orderList.all', fallback: '全部' },
  { value: 'settled', labelKey: 'distribution.orderList.settled', fallback: '已结算' },
  { value: 'pending', labelKey: 'distribution.orderList.pending', fallback: '待结算' },
]

const STATUS_LABELS: Record<string, { key: string; fb: string; cls: string }> = {
  settled: { key: 'distribution.orderList.settled', fb: '已结算', cls: 'ol-status-settled' },
  pending: { key: 'distribution.orderList.pending', fb: '待结算', cls: 'ol-status-pending' },
  paid: { key: 'distribution.orderList.settled', fb: '已结算', cls: 'ol-status-settled' },
  unpaid: { key: 'distribution.orderList.pending', fb: '待结算', cls: 'ol-status-pending' },
}

const PAGE_SIZE = 20

export default function DistributionOrderList() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => {
    const v = t(k)
    return v === k ? fb : v
  }
  const [list, setList] = useState<OrderItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [activeTab, setActiveTab] = useState<TabValue>('')
  const pageRef = useRef(1)
  const hasMoreRef = useRef(true)
  const loadingRef = useRef(false)
  const tabRef = useRef<TabValue>('')

  const load = async (reset = false) => {
    if (loadingRef.current) return
    if (reset) {
      pageRef.current = 1
      hasMoreRef.current = true
      setHasMore(true)
      setList([])
      setError(false)
    }
    if (!hasMoreRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      const res = (await api.get('/distribution/orders', {
        page: pageRef.current,
        pageSize: PAGE_SIZE,
        status: tabRef.current || undefined,
      })) as unknown as {
        list: Array<Record<string, unknown>>
        total: number
      }
      const items: OrderItem[] = (res.list || []).map((o) => ({
        id: String(o.id ?? ''),
        orderNo: (o.orderNo as string) || (o.order_no as string) || '',
        product:
          (o.product as string) ||
          (o.title as string) ||
          (o.goodsName as string) ||
          tt('distribution.orderList.product', '商品'),
        amount: (o.amount as number) ?? (o.totalAmount as number) ?? 0,
        commission: (o.commission as number) ?? (o.commissionAmount as number) ?? 0,
        status: (o.status as string) ?? 'pending',
        time: (o.createTime as string) || (o.createdAt as string) || (o.time as string) || '',
      }))
      setList((prev) => (reset ? items : [...prev, ...items]))
      const more = pageRef.current * PAGE_SIZE < (res.total ?? 0)
      hasMoreRef.current = more
      setHasMore(more)
      pageRef.current++
    } catch (e) {
      logger.error('unknown', '加载分销订单', e)
      setError(true)
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }

  const switchTab = (tab: TabValue) => {
    tabRef.current = tab
    setActiveTab(tab)
    load(true)
  }

  const onItemClick = (id: string) => {
    Taro.navigateTo({ url: `/pages/order/detail?id=${id}` })
  }

  useDidShow(() => {
    load(true)
  })

  useReachBottom(() => {
    load()
  })

  usePullDownRefresh(() => {
    load(true).finally(() => Taro.stopPullDownRefresh())
  })

  return (
    <View className="ol-page">
      <View className="ol-tabs">
        {TABS.map((tab) => (
          <View
            key={tab.value}
            className={`ol-tab ${activeTab === tab.value ? 'ol-tab-active' : ''}`}
            onClick={() => switchTab(tab.value)}
          >
            <Text>{tt(tab.labelKey, tab.fallback)}</Text>
          </View>
        ))}
      </View>

      {list.length > 0 && (
        <View className="ol-list">
          {list.map((o) => {
            const statusInfo = STATUS_LABELS[o.status] || {
              key: '',
              fb: o.status,
              cls: 'ol-status-pending',
            }
            return (
              <View
                key={o.id}
                className="ol-order-card"
                onClick={() => onItemClick(o.id)}
              >
                <View className="ol-order-header">
                  <Text className="ol-order-no">
                    {tt('distribution.orderList.orderNo', '订单号')}:{o.orderNo || '-'}
                  </Text>
                  <Text className={`ol-order-status ${statusInfo.cls}`}>
                    {statusInfo.key ? tt(statusInfo.key, statusInfo.fb) : statusInfo.fb}
                  </Text>
                </View>
                <Text className="ol-order-product">{o.product}</Text>
                <View className="ol-order-footer">
                  <View className="ol-order-amounts">
                    <Text className="ol-amount-label">
                      {tt('distribution.orderList.amount', '金额')} ¥{o.amount}
                    </Text>
                    <Text className="ol-commission">
                      {tt('distribution.orderList.commission', '佣金')} ¥{o.commission}
                    </Text>
                  </View>
                  <Text className="ol-order-time">{o.time || '-'}</Text>
                </View>
              </View>
            )
          })}
        </View>
      )}

      {list.length === 0 && !loading && !error && (
        <Text className="ol-empty">{t('distribution.orderList.empty')}</Text>
      )}

      {error && !loading && (
        <View className="ol-error" onClick={() => load(true)}>
          <Text className="ol-error-text">
            {tt('distribution.orderList.error', '加载失败')}
          </Text>
          <Text className="ol-error-retry">
            {tt('distribution.orderList.retry', '点击重试')}
          </Text>
        </View>
      )}

      {loading && (
        <Text className="ol-loading">{t('distribution.orderList.loading')}</Text>
      )}

      {!loading && !hasMore && list.length > 0 && (
        <Text className="ol-no-more">
          {tt('distribution.orderList.noMore', '没有更多了')}
        </Text>
      )}
    </View>
  )
}
