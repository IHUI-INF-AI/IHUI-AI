// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTt, useI18n, type TtFn } from '@/i18n'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow, useReachBottom, usePullDownRefresh } from '@tarojs/taro'
import { useState, useRef } from 'react'
import * as api from '@/api'
import { logger } from '@/utils/logger'
import ThemeRoot from '@/components/ThemeRoot'

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

const TABS = (tt: TtFn): Tab[] => [
  { value: '', labelKey: 'distribution.orderList.all', fallback: tt('common.all', '全部') },
  {
    value: 'settled',
    labelKey: 'distribution.orderList.settled',
    fallback: tt('developer.income.settled', '已结算'),
  },
  {
    value: 'pending',
    labelKey: 'distribution.orderList.pending',
    fallback: tt('distribution.pendingSettle', '待结算'),
  },
]

/* 对齐 RN DistributionOrderListScreen statusColor:已结算→success 底、待结算→tertiary 底,文字恒白 */
const STATUS_LABELS = (tt: TtFn): Record<string, { key: string; fb: string; cls: string }> => ({
  settled: {
    key: 'distribution.orderList.settled',
    fb: tt('developer.income.settled', '已结算'),
    cls: 'bg-[var(--color-success)] text-[var(--color-surface-light)]',
  },
  pending: {
    key: 'distribution.orderList.pending',
    fb: tt('distribution.pendingSettle', '待结算'),
    cls: 'bg-[var(--color-text-tertiary)] text-[var(--color-surface-light)]',
  },
  paid: {
    key: 'distribution.orderList.settled',
    fb: tt('developer.income.settled', '已结算'),
    cls: 'bg-[var(--color-success)] text-[var(--color-surface-light)]',
  },
  unpaid: {
    key: 'distribution.orderList.pending',
    fb: tt('distribution.pendingSettle', '待结算'),
    cls: 'bg-[var(--color-text-tertiary)] text-[var(--color-surface-light)]',
  },
})

const PAGE_SIZE = 20

export default function DistributionOrderList() {
  const { t } = useI18n()
  const tt = useTt()
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

  const totalCommission = list.reduce((sum, o) => sum + (Number(o.commission) || 0), 0)

  /* 对齐 RN DistributionOrderListScreen(packages/app 共享屏):tab 胶囊 24rpx 圆角 active 品牌底,
     订单卡 card 底 24rpx 圆角 + 28rpx padding;RN 卡片用 surface.light(恒白),暗色下不可读,
     按语义 token 修正为 bg-card。小程序数据模型无买家/订单金额/佣金率字段,RN 对应行未渲染 */
  return (
    <ThemeRoot className="min-h-screen bg-background pb-[48rpx]">
      {/* 对齐 RN tabsBar/tabsRow:px 12dp→24rpx + gap 8dp→16rpx,tab py 6dp→12rpx */}
      <View className="px-[24rpx] pt-[20rpx] pb-[24rpx]">
        <View className="flex flex-row gap-[16rpx]">
          {TABS(tt).map((tab) => (
            <View
              key={tab.value}
              className={`flex-1 flex items-center justify-center py-[12rpx] rounded-[24rpx] ${activeTab === tab.value ? 'bg-primary' : 'bg-card'}`}
              onClick={() => switchTab(tab.value)}
              hoverClass="opacity-60"
            >
              <Text
                className={`text-[28rpx] ${activeTab === tab.value ? 'text-[var(--color-primary-foreground)] font-semibold' : 'text-muted-foreground'}`}
              >
                {tt(tab.labelKey, tab.fallback)}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* 总数行 — 小程序特有统计行,按 RN 文字层级着色 */}
      <View className="mx-[20rpx] mb-[16rpx]">
        <Text className="text-[28rpx] text-muted-foreground">
          {tt('distribution.orderList.totalCount', '共')} {list.length}{' '}
          {tt('distribution.orderList.orders', '笔')},
          {tt('distribution.orderList.commissionTotal', '佣金总额')}:¥{totalCommission}
        </Text>
      </View>

      {/* 对齐 RN listContent:px 10dp→20rpx + gap 12dp→24rpx;订单卡 padding 14dp→28rpx gap 8dp→16rpx */}
      {list.length > 0 && (
        <View className="px-[20rpx] flex flex-col gap-[24rpx]">
          {list.map((o) => {
            const statusInfo = STATUS_LABELS(tt)[o.status] || {
              key: '',
              fb: o.status,
              cls: 'bg-[var(--color-text-tertiary)] text-[var(--color-surface-light)]',
            }
            return (
              <View
                key={o.id}
                className="rounded-[24rpx] bg-card p-[28rpx] flex flex-col gap-[16rpx]"
                onClick={() => onItemClick(o.id)}
                hoverClass="opacity-60"
              >
                <View className="flex flex-row justify-between items-center gap-[16rpx]">
                  <Text className="flex-1 text-[28rpx] text-foreground truncate">
                    {tt('distribution.orderList.orderNo', '订单号')}:{o.orderNo || '-'}
                  </Text>
                  <Text
                    className={`flex-shrink-0 px-[16rpx] py-[4rpx] rounded-[24rpx] text-[22rpx] ${statusInfo.cls}`}
                  >
                    {statusInfo.key ? tt(statusInfo.key, statusInfo.fb) : statusInfo.fb}
                  </Text>
                </View>
                <Text className="text-[32rpx] font-semibold text-foreground">{o.product}</Text>
                <View className="flex flex-row justify-between items-center">
                  <Text className="text-[28rpx] text-[var(--color-text-tertiary)]">
                    {o.time || '-'}
                  </Text>
                  <View className="flex flex-row items-center gap-[8rpx]">
                    <Text className="text-[22rpx] text-muted-foreground">
                      {tt('distribution.orderList.commission', '佣金')}
                    </Text>
                    <Text className="text-[32rpx] font-semibold text-[var(--color-danger)]">
                      ¥{o.commission}
                    </Text>
                  </View>
                </View>
              </View>
            )
          })}
        </View>
      )}

      {list.length === 0 && !loading && !error && (
        <View className="py-[96rpx] text-center">
          <Text className="text-[32rpx] text-muted-foreground">
            {t('distribution.orderList.empty')}
          </Text>
        </View>
      )}

      {error && !loading && (
        <View className="flex flex-col items-center py-[48rpx] gap-[24rpx]">
          <Text className="text-[28rpx] text-muted-foreground text-center">
            {tt('distribution.orderList.error', '加载失败')}
          </Text>
          <View
            className="px-[40rpx] h-[72rpx] rounded-[20rpx] bg-primary flex items-center justify-center"
            onClick={() => load(true)}
            hoverClass="opacity-60"
          >
            <Text className="text-[28rpx] font-medium text-[var(--color-primary-foreground)]">
              {tt('distribution.orderList.retry', '点击重试')}
            </Text>
          </View>
        </View>
      )}

      {loading && (
        <Text className="block text-center text-[28rpx] text-[var(--color-text-tertiary)] py-[24rpx]">
          {t('distribution.orderList.loading')}
        </Text>
      )}

      {!loading && !hasMore && list.length > 0 && (
        <Text className="block text-center text-[28rpx] text-[var(--color-text-tertiary)] py-[24rpx]">
          {tt('distribution.orderList.noMore', '没有更多了')}
        </Text>
      )}
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
