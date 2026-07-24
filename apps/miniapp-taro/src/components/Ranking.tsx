import { View, Text, Image } from '@tarojs/components'
import { useI18n } from '@/i18n'

export interface RankingItem {
  id: string | number
  nickname?: string
  name?: string
  avatar?: string
  score?: number
  value?: number
  commission?: number
  minutes?: number
}

export interface RankingProps {
  list: RankingItem[]
  title?: string
  unit?: string
  loading?: boolean
}

const MEDALS = ['🥇', '🥈', '🥉']

function getValue(item: RankingItem): number {
  return item.score || item.value || item.commission || item.minutes || 0
}

function getName(item: RankingItem): string {
  return item.nickname || item.name || '匿名'
}

export default function Ranking({ list, title, unit = '', loading = false }: RankingProps) {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  if (loading) {
    return (
      <View className="px-3 py-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <View key={i} className="flex items-center py-3 animate-pulse">
            <View className="w-6 h-4 mr-3 bg-muted rounded" />
            <View className="w-9 h-9 mr-3 rounded-lg bg-muted" />
            <View className="flex-1 h-3 bg-muted rounded" />
          </View>
        ))}
      </View>
    )
  }

  return (
    <View className="px-3 py-2">
      {title && <Text className="block text-base font-medium text-foreground mb-2">{title}</Text>}
      {list.length === 0 ? (
        <View className="flex items-center justify-center py-12">
          <Text className="text-sm text-muted-foreground">{tt('ranking.noData', '暂无排行数据')}</Text>
        </View>
      ) : (
        list.map((item, idx) => (
          <View
            key={item.id}
            className={`flex items-center py-2.5 px-3 mb-1.5 rounded-lg ${
              idx < 3 ? 'bg-amber-50/60' : 'bg-card'
            }`}
          >
            <View className="flex items-center justify-center w-6 mr-3">
              {idx < 3 ? (
                <Text className="text-lg">{MEDALS[idx]}</Text>
              ) : (
                <Text className="text-sm font-medium text-muted-foreground">{idx + 1}</Text>
              )}
            </View>
            {item.avatar ? (
              <Image
                className="w-9 h-9 mr-3 rounded-lg bg-muted"
                src={item.avatar}
                mode="aspectFill"
              />
            ) : (
              <View className="flex items-center justify-center w-9 h-9 mr-3 rounded-lg bg-muted">
                <Text className="text-xs font-medium text-muted-foreground">{getName(item).charAt(0)}</Text>
              </View>
            )}
            <Text className="flex-1 text-sm text-foreground truncate">{getName(item)}</Text>
            <Text className={`text-sm font-medium ${idx < 3 ? 'text-amber-600' : 'text-foreground'}`}>
              {getValue(item)}
              {unit}
            </Text>
          </View>
        ))
      )}
    </View>
  )
}
