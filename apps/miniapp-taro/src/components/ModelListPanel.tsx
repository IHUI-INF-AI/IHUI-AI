import { View, Text, ScrollView, Image } from '@tarojs/components'
import EmptyState from './EmptyState'
import { type ModelType } from './ModelTypeButton'

export interface ModelInfo {
  id: string | number
  name: string
  source?: string
  desc?: string
  avatar?: string
  tags?: string[]
}

export interface ModelListPanelProps {
  visible?: boolean
  modelType?: ModelType | ''
  models?: ModelInfo[]
  selectedId?: string | number
  loading?: boolean
  onSelect?: (model: ModelInfo) => void
}

const TYPE_LABELS: Record<string, string> = {
  talk: '对话模型',
  image: '图像模型',
  video: '视频模型',
  audio: '音频模型',
  videoa: '数字人',
  other: '全能模型',
}

export default function ModelListPanel({
  visible = false,
  modelType = '',
  models = [],
  selectedId,
  loading = false,
  onSelect,
}: ModelListPanelProps) {
  if (!visible) return null

  return (
    <View className="bg-white rounded-t-2xl shadow-lg" style={{ maxHeight: '50vh' }}>
      <View className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <Text className="text-sm font-medium text-gray-800">
          {TYPE_LABELS[modelType] || '模型列表'}
        </Text>
      </View>
      <ScrollView scrollY className="px-3 py-2" style={{ maxHeight: '40vh' }}>
        {loading ? (
          <View className="py-8 text-center">
            <Text className="text-sm text-gray-400">加载中...</Text>
          </View>
        ) : models.length === 0 ? (
          <EmptyState text="暂无模型" />
        ) : (
          models.map((model) => {
            const selected = model.id === selectedId
            return (
              <View
                key={model.id}
                className={`flex items-center py-2.5 px-3 mb-2 rounded-lg transition-colors ${
                  selected ? 'bg-indigo-50' : 'bg-gray-50'
                }`}
                onClick={() => onSelect?.(model)}
              >
                {model.avatar ? (
                  <Image
                    className="w-9 h-9 mr-3 rounded-lg bg-gray-100"
                    src={model.avatar}
                    mode="aspectFill"
                  />
                ) : (
                  <View className="flex items-center justify-center w-9 h-9 mr-3 rounded-lg bg-indigo-50">
                    <Text className="text-sm text-indigo-400">{model.name.charAt(0)}</Text>
                  </View>
                )}
                <View className="flex-1 min-w-0">
                  <Text className="block text-sm font-medium text-gray-800 truncate">
                    {model.name}
                  </Text>
                  {model.desc && (
                    <Text className="block text-xs text-gray-400 truncate">{model.desc}</Text>
                  )}
                </View>
                {selected && <Text className="text-xs text-indigo-600 ml-2">✓</Text>}
              </View>
            )
          })
        )}
      </ScrollView>
    </View>
  )
}
