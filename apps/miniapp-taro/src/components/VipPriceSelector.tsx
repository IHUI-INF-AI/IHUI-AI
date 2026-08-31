// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTt, type TtFn } from '@/i18n'
import { View, Text } from '@tarojs/components'

export interface PriceOption {
  id: string
  name: string
  price: number
  originalPrice?: number
  period: string
  popular?: boolean
  discount?: string
}

export interface VipPriceSelectorProps {
  options?: PriceOption[]
  selectedId?: string
  onSelect?: (option: PriceOption) => void
}

const DEFAULT_OPTIONS = (tt: TtFn): PriceOption[] => [
  {
    id: '1',
    name: tt('vip.privilege.levelMonth', '月度'),
    price: 29,
    period: tt('VipPriceSelector.d1', '1个月'),
    popular: false,
  },
  {
    id: '2',
    name: tt('vip.privilege.levelQuarter', '季度'),
    price: 79,
    originalPrice: 87,
    period: tt('VipPriceSelector.d2', '3个月'),
    popular: true,
    discount: tt('VipPriceSelector.d3', '9折'),
  },
  {
    id: '3',
    name: tt('vip.privilege.levelYear', '年度'),
    price: 268,
    originalPrice: 348,
    period: tt('VipPriceSelector.d4', '12个月'),
    discount: tt('VipPriceSelector.d5', '7.7折'),
  },
]

export default function VipPriceSelector(props: VipPriceSelectorProps) {
  const tt = useTt()
  const { options = DEFAULT_OPTIONS(tt), selectedId = '2', onSelect } = props
  return (
    <View className="flex space-x-2 px-4 py-3">
      {options.map((opt) => {
        const selected = opt.id === selectedId
        return (
          <View
            key={opt.id}
            className={`flex-1 relative px-3 py-3 rounded-xl border-2 ${
              selected ? 'border-yellow-400 bg-yellow-50' : 'border-border bg-card'
            }`}
            onClick={() => onSelect?.(opt)}
          >
            {opt.popular && (
              <View
                className="absolute -top-2 left-1/2 px-2 py-0.5 rounded-md bg-destructive"
                style={{ transform: 'translateX(-50%)' }}
              >
                <Text className="text-[20rpx] text-white">{tt('vip.hot', '热门')}</Text>
              </View>
            )}
            <Text
              className={`block text-sm font-medium text-center ${selected ? 'text-yellow-700' : 'text-foreground'}`}
            >
              {opt.name}
            </Text>
            <View className="flex items-baseline justify-center mt-1">
              <Text className="text-xs text-muted-foreground">¥</Text>
              <Text
                className={`text-xl font-bold ${selected ? 'text-yellow-700' : 'text-foreground'}`}
              >
                {opt.price}
              </Text>
            </View>
            {opt.originalPrice && (
              <Text className="block text-xs text-muted-foreground line-through text-center mt-0.5">
                ¥{opt.originalPrice}
              </Text>
            )}
            <Text className="block text-xs text-muted-foreground text-center mt-1">
              {opt.period}
            </Text>
            {opt.discount && (
              <View
                className="mt-1.5 px-1.5 py-0.5 rounded bg-warning/10 inline-block"
                style={{ display: 'block', textAlign: 'center' }}
              >
                <Text className="text-[20rpx] text-warning">{opt.discount}</Text>
              </View>
            )}
          </View>
        )
      })}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
