import { View, Text, Input, Image } from '@tarojs/components'
import Taro, { useDidShow, useReachBottom, usePullDownRefresh } from '@tarojs/taro'
import { useState, useRef, useMemo, useCallback } from 'react'
import { getOrderList, type Order } from '@/api'
import { useI18n } from '@/i18n'

type OrderItem = Order & {
  outTradeNo?: string
  productName?: string
  images?: string[]
  refundTime?: string | number
  createdAt?: string | number
  description?: string
}

const STATUS_MAP: Record<string, { type: string; textKey: string; color: string }> = {
  pending: { type: 'pending', textKey: 'order.status.pending', color: 'text-[#f59e0b]' },
  paid: { type: 'paid', textKey: 'order.status.paid', color: 'text-primary' },
  cancelled: { type: 'cancelled', textKey: 'order.status.cancelled', color: 'text-muted-foreground' },
  refunding: { type: 'refunding', textKey: 'order.status.refunding', color: 'text-[#f59e0b]' },
  refunded: { type: 'refunded', textKey: 'order.status.refunded', color: 'text-muted-foreground' },
  completed: { type: 'completed', textKey: 'order.status.completed', color: 'text-primary' },
  failed: { type: 'failed', textKey: 'order.status.failed', color: 'text-destructive' },
  '0': { type: 'pending', textKey: 'order.status.pending', color: 'text-[#f59e0b]' },
  '1': { type: 'paid', textKey: 'order.status.paid', color: 'text-primary' },
  '2': { type: 'completed', textKey: 'order.status.completed', color: 'text-primary' },
  '3': { type: 'cancelled', textKey: 'order.status.cancelled', color: 'text-muted-foreground' },
  '4': { type: 'refunded', textKey: 'order.status.refunded', color: 'text-muted-foreground' },
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
    if (/^\d{4}-\d{2}-\d{2}/.test(ts)) return ts
    const n = Number(ts)
    if (!Number.isFinite(n)) return ts
    ts = n
  }
  const ms = ts < 1e12 ? ts * 1000 : ts
  const d = new Date(ms)
  if (isNaN(d.getTime())) return String(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
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
    STATUS_MAP[s] || { type: s, textKey: '', color: 'text-muted-foreground' }

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
      <View className="flex items-center bg-card px-[24rpx] py-[20rpx]">
        <View className="w-[80rpx] text-[40rpx] text-foreground" onClick={goBack}>
          <Text>‹</Text>
        </View>
        <Text className="flex-1 text-center text-[32rpx] text-foreground font-semibold">
          {tt('order.list.title', '我的订单')}
        </Text>
        <View
          className="w-[80rpx] text-right text-[26rpx] text-primary"
          onClick={toggleSearch}
        >
          <Text>{showSearch ? tt('order.list.cancel', '取消') : tt('order.list.search', '搜索')}</Text>
        </View>
      </View>

      <View className="flex bg-card">
        {TABS.map((tab) => (
          <Text
            key={tab.value}
            className={`flex-1 text-center text-[26rpx] py-[24rpx] ${status === tab.value ? 'text-primary font-semibold' : 'text-muted-foreground'}`}
            onClick={() => switchTab(tab.value)}
          >
            {tt(tab.labelKey, tab.fallback)}
          </Text>
        ))}
      </View>

      {showSearch && (
        <View className="px-[24rpx] py-[16rpx] bg-background">
          <Input
            className="h-[64rpx] px-[24rpx] bg-card rounded-lg text-[26rpx]"
            placeholder={tt('order.list.searchPlaceholder', '搜索我的订单')}
            value={keyword}
            onInput={(e) => onSearchInput(e.detail.value)}
            confirmType="search"
          />
        </View>
      )}

      {filtered.length > 0 && (
        <View className="p-[24rpx]">
          {filtered.map((o) => {
            const info = statusInfo(o.status as string)
            const img = o.images && o.images.length > 0 ? o.images[0] : ''
            const orderNoText = o.outTradeNo || o.orderNo
            const productName = o.productName || o.title
            const createTimeText = formatTimestamp(o.createdAt || o.createTime)
            const refundTimeText = o.refundTime ? formatTimestamp(o.refundTime) : ''
            return (
              <View
                key={o.id}
                className="bg-card rounded-lg p-[24rpx] mb-[24rpx]"
                onClick={() => goDetail(o.id)}
              >
                <View className="flex justify-between items-center">
                  <Text className="text-[24rpx] text-muted-foreground">
                    {tt('order.list.orderNo', '订单号')}：{orderNoText}
                  </Text>
                  <Text className={`text-[24rpx] ${info.color}`}>
                    {info.textKey ? t(info.textKey) : o.status}
                  </Text>
                </View>
                <View className="flex mt-[20rpx]">
                  {img ? (
                    <Image
                      className="w-[160rpx] h-[160rpx] rounded-md bg-background"
                      src={img}
                      mode="aspectFill"
                      lazyLoad
                    />
                  ) : null}
                  <View className={`flex-1 ${img ? 'ml-[20rpx]' : ''}`}>
                    <Text className="block text-[28rpx] text-foreground font-semibold">
                      {productName}
                    </Text>
                    {o.description ? (
                      <Text className="block text-[24rpx] text-muted-foreground mt-[12rpx] line-clamp-2">
                        {o.description}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <View className="flex justify-between items-end mt-[20rpx]">
                  <View className="flex flex-col">
                    <Text className="text-[22rpx] text-muted-foreground">
                      {tt('order.list.orderTime', '下单时间')}：{createTimeText}
                    </Text>
                    {refundTimeText ? (
                      <Text className="text-[22rpx] text-muted-foreground mt-[8rpx]">
                        {tt('order.list.refundTime', '退款时间')}：{refundTimeText}
                      </Text>
                    ) : null}
                  </View>
                  <Text className="text-[32rpx] text-destructive font-semibold">¥{o.amount}</Text>
                </View>
                {(o.status === 'pending' || o.status === 'paid') && (
                  <View className="flex justify-end mt-[20rpx]">
                    {o.status === 'pending' && (
                      <Text
                        className="inline-block text-[24rpx] text-white bg-primary px-[32rpx] py-[10rpx] rounded-md"
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
            )
          })}
        </View>
      )}
      {filtered.length === 0 && !loading && (
        <View className="text-center py-[120rpx] text-muted-foreground">
          <Text>
            {keyword
              ? tt('order.list.notFound', '未找到相关订单')
              : tt('order.list.empty', '暂无订单')}
          </Text>
        </View>
      )}
      {loading && (
        <View className="text-center py-[120rpx] text-muted-foreground">
          <Text>{tt('common.loading', '加载中...')}</Text>
        </View>
      )}
    </View>
  )
}
