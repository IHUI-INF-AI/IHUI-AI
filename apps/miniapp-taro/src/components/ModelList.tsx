import { View, Text, Image } from '@tarojs/components'

export interface ModelItem {
  id: string | number
  name: string
  desc?: string
  avatar?: string
  uses?: number
  tags?: string[]
}

export interface ModelListProps {
  models: ModelItem[]
  selectedId?: string | number
  onSelect?: (model: ModelItem) => void
  loading?: boolean
}

export default function ModelList({
  models,
  selectedId,
  onSelect,
  loading = false,
}: ModelListProps) {
  if (loading) {
    return (
      <View className="px-3 py-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <View key={i} className="flex items-center py-3 animate-pulse">
            <View className="w-10 h-10 mr-3 rounded-full bg-gray-100" />
            <View className="flex-1 space-y-2">
              <View className="h-3 w-1/3 rounded bg-gray-100" />
              <View className="h-2.5 w-2/3 rounded bg-gray-100" />
            </View>
          </View>
        ))}
      </View>
    )
  }

  if (!models.length) {
    return (
      <View className="flex items-center justify-center py-12">
        <Text className="text-sm text-gray-400">暂无模型</Text>
      </View>
    )
  }

  return (
    <View className="px-3 py-1">
      {models.map((model) => {
        const selected = model.id === selectedId
        return (
          <View
            key={model.id}
            className={`flex items-center py-2.5 px-3 mb-2 rounded-lg transition-colors ${
              selected ? 'bg-gray-100' : 'bg-white hover:bg-gray-50'
            }`}
            onClick={() => onSelect?.(model)}
          >
            {model.avatar ? (
              <Image
                className="w-10 h-10 mr-3 rounded-full bg-gray-50"
                src={model.avatar}
                mode="aspectFill"
              />
            ) : (
              <View className="flex items-center justify-center w-10 h-10 mr-3 rounded-full bg-gray-50">
                <Text className="text-sm font-medium text-gray-500">{model.name.charAt(0)}</Text>
              </View>
            )}
            <View className="flex-1 min-w-0">
              <View className="flex items-center">
                <Text className="text-sm font-medium text-gray-800 truncate">{model.name}</Text>
                {selected && <Text className="ml-2 text-xs text-green-600">✓</Text>}
              </View>
              {model.desc && <Text className="text-xs text-gray-400 truncate">{model.desc}</Text>}
              {model.tags && model.tags.length > 0 && (
                <View className="flex flex-wrap mt-1">
                  {model.tags.slice(0, 3).map((tag, i) => (
                    <Text
                      key={i}
                      className="text-[10px] px-1.5 py-0.5 mr-1 rounded bg-gray-50 text-gray-500"
                    >
                      {tag}
                    </Text>
                  ))}
                </View>
              )}
            </View>
            {model.uses !== undefined && (
              <Text className="text-xs text-gray-400 ml-2">{model.uses}次</Text>
            )}
          </View>
        )
      })}
    </View>
  )
}
