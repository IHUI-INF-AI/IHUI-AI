// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n } from '@/i18n'
import { View, Text, Input, Image } from '@tarojs/components'
import Taro, { useDidShow, useReachBottom, usePullDownRefresh } from '@tarojs/taro'
import { useState, useRef, useMemo, useCallback } from 'react'
import { formatDateByTemplate } from '@ihui/shared'
import { getOrderList, type Order } from '@/api'
import ThemeRoot from '@/components/ThemeRoot'

type OrderItem = Order & {
  outTradeNo?: string
  productName?: string
  images?: string[]
  refundTime?: string | number
  createdAt?: string | number
  description?: string
}

// 状态徽章色(对齐 RN SharedOrderScreen statusColors:浅底深字 token)
// - pending/refunding: warning.amberLight/amberText
// - paid/completed: success.light/deepText
// - cancelled/failed: danger.light/danger.DEFAULT
// - refunded/未知: surface.muted/text.tertiary
const STATUS_MAP: Record<string, { type: string; textKey: string; badge: string }> = {
  pending: {
    type: 'pending',
    textKey: 'order.status.pending',
    badge: 'bg-[var(--color-warning-amber-light)] text-[var(--color-warning-amber-text)]',
  },
  paid: {
    type: 'paid',
    textKey: 'order.status.paid',
    badge: 'bg-[var(--color-success-light)] text-[var(--color-success-deep-text)]',
  },
  cancelled: {
    type: 'cancelled',
    textKey: 'order.status.cancelled',
    badge: 'bg-[var(--color-danger-light)] text-[var(--color-danger)]',
  },
  refunding: {
    type: 'refunding',
    textKey: 'order.status.refunding',
    badge: 'bg-[var(--color-warning-amber-light)] text-[var(--color-warning-amber-text)]',
  },
  refunded: {
    type: 'refunded',
    textKey: 'order.status.refunded',
    badge: 'bg-muted text-[var(--color-text-tertiary)]',
  },
  completed: {
    type: 'completed',
    textKey: 'order.status.completed',
    badge: 'bg-[var(--color-success-light)] text-[var(--color-success-deep-text)]',
  },
  failed: {
    type: 'failed',
    textKey: 'order.status.failed',
    badge: 'bg-[var(--color-danger-light)] text-[var(--color-danger)]',
  },
  '0': {
    type: 'pending',
    textKey: 'order.status.pending',
    badge: 'bg-[var(--color-warning-amber-light)] text-[var(--color-warning-amber-text)]',
  },
  '1': {
    type: 'paid',
    textKey: 'order.status.paid',
    badge: 'bg-[var(--color-success-light)] text-[var(--color-success-deep-text)]',
  },
  '2': {
    type: 'completed',
    textKey: 'order.status.completed',
    badge: 'bg-[var(--color-success-light)] text-[var(--color-success-deep-text)]',
  },
  '3': {
    type: 'cancelled',
    textKey: 'order.status.cancelled',
    badge: 'bg-[var(--color-danger-light)] text-[var(--color-danger)]',
  },
  '4': {
    type: 'refunded',
    textKey: 'order.status.refunded',
    badge: 'bg-muted text-[var(--color-text-tertiary)]',
  },
}

const TABS = [
  { value: '', labelKey: 'order.tabs.all', fallback: '全部' },
  { value: 'pending', labelKey: 'order.tabs.pending', fallback: '待支付' },
  { value: 'paid', labelKey: 'order.tabs.paid', fallback: '已支付' },
  { value: 'cancelled', labelKey: 'order.tabs.cancelled', fallback: '已取消' },
  { value: 'refunded', labelKey: 'order.tabs.refunded', fallback: '已退款' },
]

const PAGE_SIZE = 10

function formatTimestamp(ts: string | number | undefined): string {
  if (!ts) return ''
  if (typeof ts === 'string') {
    // ISO 字符串(已 YYYY-MM-DD 开头)直接返回
    if (/^\d{4}-\d{2}-\d{2}/.test(ts)) return ts
    const n = Number(ts)
    if (!Number.isFinite(n)) return ts
    ts = n
  }
  // 秒级时间戳(< 1e12)→ 乘 1000 转毫秒
  const input = ts < 1e12 ? ts * 1000 : ts
  const formatted = formatDateByTemplate(input, 'YYYY-MM-DD HH:mm:ss')
  // 无效日期时 formatDateByTemplate 返回 '',原实现返回 String(ts),保留原行为
  return formatted || String(ts)
}

export default function OrderList() {
  const { t } = useI18n()
  const tt = useCallback((k: string, fb: string) => (t(k) === k ? fb : t(k)), [t])
  const [list, setList] = useState<OrderItem[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [keyword, setKeyword] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const statusRef = useRef('')
  const pageRef = useRef(1)
  const hasMoreRef = useRef(true)
  const loadingRef = useRef(false)

  const statusInfo = (s: string) =>
    STATUS_MAP[s] || {
      type: s,
      textKey: '',
      badge: 'bg-muted text-[var(--color-text-tertiary)]',
    }

  const load = async (reset = false) => {
    if (loadingRef.current) return
    if (reset) {
      pageRef.current = 1
      hasMoreRef.current = true
      setList([])
    }
    if (!hasMoreRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      const res = await getOrderList({
        page: pageRef.current,
        pageSize: PAGE_SIZE,
        status: statusRef.current || undefined,
      })
      const items = (res.list || []) as OrderItem[]
      setList((prev) => (reset ? items : [...prev, ...items]))
      hasMoreRef.current = pageRef.current * PAGE_SIZE < res.total
      pageRef.current++
    } catch {
      // ignore
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }

  const switchTab = (s: string) => {
    statusRef.current = s
    setStatus(s)
    load(true)
  }

  const onSearchInput = (kw: string) => setKeyword(kw)

  const toggleSearch = () => {
    setShowSearch((v) => !v)
    if (showSearch) setKeyword('')
  }

  const filtered = useMemo(() => {
    const kw = keyword.trim()
    if (!kw) return list
    return list.filter(
      (o) =>
        (o.title || '').includes(kw) ||
        (o.orderNo || '').includes(kw) ||
        (o.outTradeNo || '').includes(kw) ||
        (o.productName || '').includes(kw),
    )
  }, [list, keyword])

  const goBack = () => {
    Taro.navigateBack({ delta: 1 }).catch(() => {
      Taro.switchTab({ url: '/pages/index/index' })
    })
  }

  const goDetail = (id: string | number) => {
    Taro.navigateTo({ url: `/pages/order/detail?id=${id}` })
  }

  const goPay = (o: OrderItem) => {
    Taro.navigateTo({ url: `/pages/pay/index?orderNo=${o.orderNo}&amount=${o.amount}` })
  }

  const goRefund = (o: OrderItem) => {
    Taro.navigateTo({ url: `/pages/order/refund?orderNo=${o.orderNo}` })
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
    <View className="min-h-screen bg-background">
      {/* 头部(对齐 RN header:paddingH 20rpx / paddingV 24rpx / gap 24rpx / 返回 32rpx text.medium / 标题 40rpx 600) */}
      <View className="flex items-center gap-[24rpx] bg-card px-[20rpx] py-[24rpx]">
        <View
          className="w-[80rpx] text-[32rpx] text-[var(--color-text-medium)]"
          onClick={goBack}
        >
          <Text>‹</Text>
        </View>
        <Text className="flex-1 text-center text-[40rpx] text-foreground font-semibold">
          {tt('order.list.title', '我的订单')}
        </Text>
        <View className="w-[80rpx] text-right text-[26rpx] text-primary" onClick={toggleSearch}>
          <Text>
            {showSearch ? tt('order.list.cancel', '取消') : tt('order.list.search', '搜索')}
          </Text>
        </View>
      </View>

      {/* Tab 胶囊(对齐 RN tabs:白底胶囊 paddingH 28rpx / paddingV 12rpx / 圆角 24rpx / 28rpx,
          选中黑底白字) */}
      <View className="flex flex-row gap-[16rpx] px-[20rpx] py-[16rpx]">
        {TABS.map((tab) => (
          <Text
            key={tab.value}
            className={`px-[28rpx] py-[12rpx] rounded-[24rpx] text-[28rpx] ${
              status === tab.value
                ? 'bg-primary text-primary-foreground font-semibold'
                : 'bg-card text-muted-foreground'
            }`}
            onClick={() => switchTab(tab.value)}
          >
            {tt(tab.labelKey, tab.fallback)}
          </Text>
        ))}
      </View>

      {showSearch && (
        <View className="px-[20rpx] py-[8rpx] bg-background">
          <Input
            className="h-[80rpx] px-[24rpx] bg-card rounded-[20rpx] text-[28rpx] border-[2rpx] border-border"
            placeholder={tt('order.list.searchPlaceholder', '搜索我的订单')}
            value={keyword}
            onInput={(e) => onSearchInput(e.detail.value)}
            confirmType="search"
          />
        </View>
      )}

      {filtered.length > 0 && (
        <View className="p-[20rpx]">
          {filtered.map((o) => {
            const info = statusInfo(o.status as string)
            const img = o.images && o.images.length > 0 ? o.images[0] : ''
            const orderNoText = o.outTradeNo || o.orderNo
            const productName = o.productName || o.title
            const createTimeText = formatTimestamp(o.createdAt || o.createTime)
            const refundTimeText = o.refundTime ? formatTimestamp(o.refundTime) : ''
            return (
              <ThemeRoot key={o.id}>
                {/* 订单卡(对齐 RN card:padding 24rpx / 圆角 24rpx / 2rpx 描边 / 白底 / mb 24rpx;
                    内部对齐 cardBodyRow:商品图 260rpx + 右侧 info[cardHead → metaRow → amountRow]) */}
                <View
                  className="bg-card rounded-[24rpx] border-[2rpx] border-border p-[24rpx] mb-[24rpx]"
                  onClick={() => goDetail(o.id)}
                >
                  <View className="flex gap-[24rpx]">
                    {img ? (
                      <Image
                        className="w-[260rpx] h-[260rpx] rounded-[20rpx] bg-card"
                        src={img}
                        mode="aspectFill"
                        lazyLoad
                      />
                    ) : null}
                    <View className="flex-1 min-w-0">
                      <View className="flex justify-between items-center gap-[16rpx]">
                        <Text
                          className="flex-1 text-[32rpx] text-foreground font-semibold"
                          numberOfLines={1}
                        >
                          {productName}
                        </Text>
                        <Text
                          className={`px-[12rpx] py-[4rpx] rounded-[8rpx] text-[22rpx] font-medium ${info.badge}`}
                        >
                          {info.textKey ? t(info.textKey) : o.status}
                        </Text>
                      </View>
                      <View className="flex justify-between mt-[16rpx]">
                        <Text className="text-[22rpx] text-[var(--color-text-tertiary)]">
                          {tt('order.list.orderNo', '订单号')}：{orderNoText}
                        </Text>
                        <Text className="text-[22rpx] text-[var(--color-text-tertiary)]">
                          {createTimeText}
                        </Text>
                      </View>
                      <View className="flex justify-between items-end mt-[16rpx]">
                        <Text className="text-[22rpx] text-[var(--color-text-tertiary)]">
                          {refundTimeText
                            ? `${tt('order.list.refundTime', '退款时间')}：${refundTimeText}`
                            : ''}
                        </Text>
                        <Text className="text-[36rpx] text-foreground font-bold">¥{o.amount}</Text>
                      </View>
                      {o.description ? (
                        <Text className="block text-[24rpx] text-muted-foreground mt-[12rpx] line-clamp-2">
                          {o.description}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  {(o.status === 'pending' || o.status === 'paid') && (
                    <View className="flex justify-end mt-[20rpx]">
                      {o.status === 'pending' && (
                        <Text
                          className="inline-block text-[24rpx] text-primary-foreground bg-primary px-[32rpx] py-[10rpx] rounded-md"
                          onClick={(e) => {
                            e.stopPropagation()
                            goPay(o)
                          }}
                        >
                          {tt('order.list.goPay', '去支付')}
                        </Text>
                      )}
                      {o.status === 'paid' && (
                        <Text
                          className="inline-block text-[24rpx] text-primary px-[32rpx] py-[10rpx] border-[2rpx] border-primary rounded-md"
                          onClick={(e) => {
                            e.stopPropagation()
                            goRefund(o)
                          }}
                        >
                          {tt('order.list.applyRefund', '申请退款')}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              </ThemeRoot>
            )
          })}
        </View>
      )}
      {filtered.length === 0 && !loading && (
        <View className="flex flex-col items-center py-[96rpx] text-muted-foreground">
          <Text className="text-[28rpx]">
            {keyword
              ? tt('order.list.notFound', '未找到相关订单')
              : tt('order.list.empty', '暂无订单')}
          </Text>
        </View>
      )}
      {loading && (
        <View className="flex flex-col items-center py-[96rpx] text-muted-foreground">
          <Text className="text-[28rpx]">{tt('common.loading', '加载中...')}</Text>
        </View>
      )}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
