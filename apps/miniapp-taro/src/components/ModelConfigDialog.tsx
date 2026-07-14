import { View, Text, Input, Switch } from '@tarojs/components'

export interface ModelConfig {
  temperature?: number
  maxTokens?: number
  topP?: number
  systemPrompt?: string
  streamEnabled?: boolean
}

export interface ModelConfigDialogProps {
  visible?: boolean
  config?: ModelConfig
  onChange?: (config: ModelConfig) => void
  onClose?: () => void
}

export default function ModelConfigDialog({
  visible = false,
  config = {},
  onChange,
  onClose,
}: ModelConfigDialogProps) {
  if (!visible) return null

  const update = (patch: Partial<ModelConfig>) => {
    onChange?.({ ...config, ...patch })
  }

  return (
    <View className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <View className="absolute inset-0 bg-black/40" />
      <View
        className="relative bg-white rounded-xl mx-6 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <View className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <Text className="text-sm font-medium text-gray-800">模型配置</Text>
          <Text className="text-sm text-gray-400" onClick={onClose}>
            关闭
          </Text>
        </View>
        <View className="px-4 py-3">
          <View className="mb-3">
            <Text className="block text-xs text-gray-500 mb-1">温度 (0-2)</Text>
            <Input
              type="digit"
              className="w-full px-3 py-2 text-sm bg-gray-50 rounded-lg"
              placeholder="0.7"
              value={config.temperature?.toString() || ''}
              onInput={(e) => update({ temperature: parseFloat(e.detail.value) || 0 })}
            />
          </View>
          <View className="mb-3">
            <Text className="block text-xs text-gray-500 mb-1">最大 Token</Text>
            <Input
              type="number"
              className="w-full px-3 py-2 text-sm bg-gray-50 rounded-lg"
              placeholder="2048"
              value={config.maxTokens?.toString() || ''}
              onInput={(e) => update({ maxTokens: parseInt(e.detail.value) || 0 })}
            />
          </View>
          <View className="mb-3">
            <Text className="block text-xs text-gray-500 mb-1">Top P (0-1)</Text>
            <Input
              type="digit"
              className="w-full px-3 py-2 text-sm bg-gray-50 rounded-lg"
              placeholder="0.9"
              value={config.topP?.toString() || ''}
              onInput={(e) => update({ topP: parseFloat(e.detail.value) || 0 })}
            />
          </View>
          <View className="mb-3">
            <Text className="block text-xs text-gray-500 mb-1">系统提示词</Text>
            <Input
              className="w-full px-3 py-2 text-sm bg-gray-50 rounded-lg"
              placeholder="You are a helpful assistant"
              value={config.systemPrompt || ''}
              onInput={(e) => update({ systemPrompt: e.detail.value })}
            />
          </View>
          <View className="flex items-center justify-between py-2">
            <Text className="text-sm text-gray-700">流式输出</Text>
            <Switch
              checked={config.streamEnabled ?? true}
              onChange={(e) => update({ streamEnabled: e.detail.value })}
            />
          </View>
        </View>
      </View>
    </View>
  )
}
