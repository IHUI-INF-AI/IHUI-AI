// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 智汇值充值套餐:对齐 packages/app/src/features/token-value/TokenValueScreen.tsx 的 PACKAGES + pkgCard 段
import { View, Text, ScrollView } from '@tarojs/components'
import type { TtFn } from '@/i18n'

export interface TokenPackage {
  id: string
  tokens: number
  price: number
  bonus: number
  popular?: boolean
}

/** 充值套餐:产品配置(静态前端数据,非业务数据;数值与共享屏 PACKAGES 逐项一致) */
export const TOKEN_PACKAGES: TokenPackage[] = [
  { id: '1', tokens: 100000, price: 9.9, bonus: 0 },
  { id: '2', tokens: 500000, price: 39.9, bonus: 50000 },
  { id: '3', tokens: 1000000, price: 68, bonus: 150000, popular: true },
  { id: '4', tokens: 5000000, price: 298, bonus: 1000000 },
]

/** 大数按「亿 / 万」截断(与共享屏 formatToken 同式;非有限数按 0 收口) */
export function formatTokenValue(n: number): string {
  if (!Number.isFinite(n)) return '0'
  if (Math.abs(n) >= 100000000) return `${(n / 100000000).toFixed(2)}亿`
  if (Math.abs(n) >= 10000) return `${(n / 10000).toFixed(1)}万`
  return `${n}`
}

interface TokenPackagesProps {
  tt: TtFn
  onSelect: (pkg: TokenPackage) => void
}

/** 充值套餐横滑卡组(热门徽章 / 智汇值单位 / 赠送奖励 / 价格,对齐 RN pkgCard 同信息结构) */
export default function TokenPackages({ tt, onSelect }: TokenPackagesProps) {
  return (
    <View className="px-[20rpx]">
      <Text className="block mt-[40rpx] mb-[24rpx] text-[length:32rpx] font-semibold text-foreground">
        {tt('tokenValue.packagesTitle', '充值套餐')}
      </Text>
      <ScrollView scrollX enhanced showScrollbar={false}>
        <View className="flex items-stretch gap-[20rpx] py-[8rpx]">
          {TOKEN_PACKAGES.map((p) => (
            <View
              key={p.id}
              className={`flex flex-col items-center shrink-0 w-[260rpx] p-[28rpx] box-border rounded-lg border-[length:3rpx] ${
                p.popular ? 'border-brand-accent-deep bg-muted' : 'border-border bg-background'
              }`}
              hoverClass="opacity-60"
              onClick={() => onSelect(p)}
            >
              <View className="h-[32rpx] flex items-center justify-center">
                {p.popular ? (
                  <Text className="px-[16rpx] py-[2rpx] rounded-md bg-cta text-cta-foreground text-[length:20rpx] font-semibold">
                    {tt('tokenValue.popular', '热门')}
                  </Text>
                ) : null}
              </View>
              <Text className="mt-[16rpx] text-[length:40rpx] font-bold text-foreground">
                {formatTokenValue(p.tokens)}
              </Text>
              <Text className="mt-[8rpx] text-[length:22rpx] text-muted-foreground">
                {tt('tokenValue.tokenUnit', '智汇值')}
              </Text>
              <Text className="mt-[8rpx] min-h-[32rpx] text-[length:22rpx] font-semibold text-brand-accent-deep">
                {p.bonus > 0
                  ? `${tt('tokenValue.bonus', '奖励')} ${formatTokenValue(p.bonus)}`
                  : ''}
              </Text>
              <View className="mt-[16rpx] h-[56rpx] px-[24rpx] flex items-center justify-center rounded-xl bg-cta">
                <Text className="text-[length:28rpx] font-semibold text-cta-foreground">
                  ¥{p.price}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
