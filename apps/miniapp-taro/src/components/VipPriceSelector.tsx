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

const DEFAULT_OPTIONS: PriceOption[] = [
  { id: '1', name: '月度', price: 29, period: '1个月', popular: false },
  {
    id: '2',
    name: '季度',
    price: 79,
    originalPrice: 87,
    period: '3个月',
    popular: true,
    discount: '9折',
  },
  { id: '3', name: '年度', price: 268, originalPrice: 348, period: '12个月', discount: '7.7折' },
]

export default function VipPriceSelector({
  options = DEFAULT_OPTIONS,
  selectedId = '2',
  onSelect,
}: VipPriceSelectorProps) {
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
                <Text className="text-[10px] text-white">热门</Text>
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
            <Text className="block text-xs text-muted-foreground text-center mt-1">{opt.period}</Text>
            {opt.discount && (
              <View
                className="mt-1.5 px-1.5 py-0.5 rounded bg-[#f59e0b]/10 inline-block"
                style={{ display: 'block', textAlign: 'center' }}
              >
                <Text className="text-[10px] text-[#f59e0b]">{opt.discount}</Text>
              </View>
            )}
          </View>
        )
      })}
    </View>
  )
}
