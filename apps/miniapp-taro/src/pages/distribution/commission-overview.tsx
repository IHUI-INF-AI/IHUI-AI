// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 分销佣金概览块 — 对齐 packages/app/src/features/distribution/DistributionScreen.tsx
 *
 * 为什么单开子模块:母页(pages/distribution/index)已承载「个人信息卡 + 收益统计 + 功能宫格
 * + 二维码弹层」,再塞佣金卡/商品列表会顶穿单页行数上限(施工手册 §4)。
 *
 * 数据腿 = `GET /distribution/overview` — 与 RN 容器 apps/mobile-rn/src/screens/DistributionScreen.tsx
 * 同一支(它把响应喂给共享屏 DistributionScreen 的 `info`)。金额单位是**分**,展示一律经
 * `formatPrice`(分→元唯一出口,守门 248),不在本文件里再除一次 100。
 *
 * `products` 按共享屏 DistributionInfo.products 同一契约解构:后端当前不返回该字段 ⇒ 走空态
 * (与 RN 同形,不伪造商品行/不编造佣金数);后端补上即真实渲染。
 */
import { useCallback, useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useTt } from '@/i18n'
import { get } from '@/api'
import { formatPrice } from '@ihui/shared/utils/format'
import { EmptyState, ErrorState, ScreenSkeleton } from '@/components/ScreenStates.taro'

/** 共享屏 DistributionProduct(仅取本块要渲染的五个字段) */
interface DistributionProduct {
  id: string
  title: string
  salePrice: number
  commission: number
  sales: number
}

/** `GET /distribution/overview` 响应(args/api/src/routes/distribution.ts)①金额为分 ②products 当前后端不返回 */
interface DistributionOverview {
  level?: number
  totalCommission?: number
  pendingCommission?: number
  withdrawnCommission?: number
  products?: DistributionProduct[]
}

/** 提现入口:端内既有提现页(与宫格「申请提现」同一目标) */
const WITHDRAW_PATH = '/pages/distribution/withdraw'
/** 后端 /distribution/overview 无最低提现配置(与 RN 容器 WITHDRAW_MIN 同口径) */
const WITHDRAW_MIN = 0

export default function CommissionOverview({ reloadTick }: { reloadTick: number }) {
  const tt = useTt()
  const [info, setInfo] = useState<DistributionOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setFailed(false)
    try {
      const res = await get<DistributionOverview>('/distribution/overview')
      setInfo(res ?? null)
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  // 挂载即取一次
  useEffect(() => {
    void load()
  }, [load])

  // 母页每次显示(useDidShow)递增 reloadTick,本块同批重取(tick=0 是挂载首帧,已由上一条覆盖)
  useEffect(() => {
    if (reloadTick > 0) void load()
  }, [load, reloadTick])

  if (loading && !info) return <ScreenSkeleton variant="card" count={2} />
  if (failed && !info) {
    return (
      <ErrorState
        message={tt('distribution.team.error', '加载失败')}
        onRetry={() => void load()}
        retryLabel={tt('distribution.retry', '重试')}
      />
    )
  }
  if (!info) return <EmptyState title={tt('distribution.empty', '暂无数据')} />

  const products = info.products ?? []
  const canWithdraw = (info.pendingCommission ?? 0) >= WITHDRAW_MIN
  const onWithdraw = () => {
    if (!canWithdraw) return
    Taro.navigateTo({ url: WITHDRAW_PATH }).catch(() => {})
  }

  return (
    <View className="mt-[24rpx]">
      <Text className="block mb-[16rpx] text-[length:24rpx] text-muted-foreground">
        {tt('distribution.subtitle', '推广商品,赚取佣金')}
      </Text>

      {/* 等级卡(对齐 RN levelCard:左等级 / 右佣金比例) */}
      <View className="p-[28rpx] rounded-xl bg-[var(--color-success-light)] flex flex-row items-center justify-between">
        <View>
          <Text className="block text-[length:22rpx] text-[var(--color-success-deep-text)]">
            {tt('distribution.level', '分销等级')}
          </Text>
          <Text className="block mt-[8rpx] text-[length:36rpx] font-semibold text-[var(--color-success)]">
            {info.level ?? 0}
          </Text>
        </View>
        <View className="flex flex-col items-end">
          <Text className="block text-[length:22rpx] text-[var(--color-success-deep-text)]">
            {tt('distribution.commissionRate', '佣金比例')}
          </Text>
          {/* 与 RN 同形:后端 /distribution/overview 未返回佣金比例时显示占位符,不编造数值 */}
          <Text className="block mt-[8rpx] text-[length:36rpx] font-semibold text-[var(--color-success)]">
            —
          </Text>
        </View>
      </View>

      {/* 收益卡(对齐 RN earningsCard:累计 / 已提现 / 待结算 + 提现按钮 + 门槛提示) */}
      <View className="mt-[20rpx] p-[28rpx] rounded-xl border border-[var(--color-border)] bg-card">
        <View className="flex flex-row items-start justify-between">
          <View className="flex flex-col items-center flex-1">
            <Text className="text-[length:34rpx] font-semibold text-foreground whitespace-nowrap">
              {formatPrice(info.totalCommission ?? 0)}
            </Text>
            <Text className="mt-[8rpx] text-[length:22rpx] text-muted-foreground">
              {tt('distribution.totalEarnings', '累计收益')}
            </Text>
          </View>
          <View className="flex flex-col items-center flex-1">
            <Text className="text-[length:34rpx] font-semibold text-foreground whitespace-nowrap">
              {formatPrice(info.withdrawnCommission ?? 0)}
            </Text>
            <Text className="mt-[8rpx] text-[length:22rpx] text-muted-foreground">
              {tt('distribution.withdrawn', '已提现')}
            </Text>
          </View>
          <View className="flex flex-col items-center flex-1">
            <Text className="text-[length:34rpx] font-semibold text-[var(--color-success)] whitespace-nowrap">
              {formatPrice(info.pendingCommission ?? 0)}
            </Text>
            <Text className="mt-[8rpx] text-[length:22rpx] text-muted-foreground">
              {tt('distribution.pending', '待结算')}
            </Text>
          </View>
        </View>

        <View
          className={`mt-[20rpx] h-[88rpx] flex items-center justify-center rounded-lg ${
            canWithdraw ? 'bg-[var(--color-cta)]' : 'bg-[var(--color-border)]'
          }`}
          onClick={onWithdraw}
          hoverClass={canWithdraw ? 'opacity-60' : 'none'}
        >
          <Text
            className={`text-[length:28rpx] font-semibold ${
              canWithdraw ? 'text-[var(--color-cta-foreground)]' : 'text-muted-foreground'
            }`}
          >
            {tt('distribution.index.menuWithdraw', '申请提现')}
          </Text>
        </View>
        <Text className="block mt-[12rpx] text-center text-[length:22rpx] text-muted-foreground">
          {tt('distribution.withdrawMin', '满 ¥{amount} 方可提现', {
            amount: formatPrice(WITHDRAW_MIN),
          })}
        </Text>
      </View>

      {/* 分销商品(对齐 RN sectionTitle + productCard;空列表走空态) */}
      <Text className="block mt-[24rpx] mb-[12rpx] text-[length:28rpx] font-semibold text-foreground">
        {tt('distribution.products', '分销商品')}
      </Text>
      {products.length === 0 ? (
        <EmptyState title={tt('distribution.empty', '暂无数据')} />
      ) : (
        <View className="flex flex-col gap-[16rpx]">
          {products.map((item) => (
            <View
              key={item.id}
              className="p-[28rpx] rounded-xl border border-[var(--color-border)] bg-card"
            >
              <Text className="block text-[length:28rpx] font-semibold text-foreground">
                {item.title}
              </Text>
              <View className="mt-[12rpx] flex flex-row items-center justify-between">
                <Text className="text-[length:26rpx] font-semibold text-[var(--color-success)]">
                  ¥{item.salePrice}
                </Text>
                <Text className="text-[length:22rpx] text-muted-foreground">
                  {tt('distribution.orderList.commission', '佣金')}: ¥{item.commission}
                </Text>
                <Text className="text-[length:22rpx] text-muted-foreground">
                  {tt('distribution.sales', '已售 {count} 件', { count: item.sales })}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
