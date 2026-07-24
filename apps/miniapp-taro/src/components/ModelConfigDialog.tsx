import { View, Text, Input, Switch } from '@tarojs/components'
import { useI18n } from '@/i18n'

export interface ModelConfig {
  temperature?: number
  maxTokens?: number
  topP?: number
  systemPrompt?: string
  streamEnabled?: boolean
  aspectRatio?: string
  resolution?: string
  frameCount?: number
  timbre?: string
}

export interface ModelConfigDialogProps {
  visible?: boolean
  modelType?: 'text' | 'image' | 'video' | 'audio' | 'multimodal'
  config?: ModelConfig
  onChange?: (config: ModelConfig) => void
  onClose?: () => void
}

const ASPECT_RATIOS = ['1:1', '3:4', '4:3', '16:9', '9:16']
const RESOLUTIONS = ['512', '768', '1024', '1536', '2048']
const FRAME_COUNTS = [16, 24, 30, 60]
const TIMBRES = [
  { id: 'longxiaoxia', name: '龙小夏' },
  { id: 'longxiaoze', name: '龙小泽' },
  { id: 'longchengcheng', name: '龙橙橙' },
  { id: 'longshu', name: '龙叔' },
  { id: 'longmom', name: '龙妈' },
]

export default function ModelConfigDialog({
  visible = false,
  modelType = 'text',
  config = {},
  onChange,
  onClose,
}: ModelConfigDialogProps) {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  if (!visible) return null

  const update = (patch: Partial<ModelConfig>) => {
    onChange?.({ ...config, ...patch })
  }

  const showImage = modelType === 'image' || modelType === 'multimodal'
  const showVideo = modelType === 'video' || modelType === 'multimodal'
  const showAudio = modelType === 'audio'

  return (
    <View className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <View className="absolute inset-0 bg-black/40" />
      <View
        className="relative bg-card rounded-xl mx-6 w-full max-w-sm max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <View className="flex items-center justify-between px-4 py-3 mb-2">
          <Text className="text-sm font-medium text-foreground">{tt('model.configTitle', '模型配置')}</Text>
          <Text className="text-sm text-muted-foreground" onClick={onClose}>
            {tt('common.close', '关闭')}
          </Text>
        </View>
        <View className="px-4 py-3">
          <View className="mb-3">
            <Text className="block text-xs text-muted-foreground mb-1">{tt('model.temperature', '温度 (0-2)')}</Text>
            <Input
              type="digit"
              className="w-full px-3 py-2 text-sm bg-muted rounded-lg"
              placeholder="0.7"
              value={config.temperature?.toString() || ''}
              onInput={(e) => update({ temperature: parseFloat(e.detail.value) || 0 })}
            />
          </View>
          <View className="mb-3">
            <Text className="block text-xs text-muted-foreground mb-1">{tt('model.maxToken', '最大 Token')}</Text>
            <Input
              type="number"
              className="w-full px-3 py-2 text-sm bg-muted rounded-lg"
              placeholder="2048"
              value={config.maxTokens?.toString() || ''}
              onInput={(e) => update({ maxTokens: parseInt(e.detail.value) || 0 })}
            />
          </View>
          <View className="mb-3">
            <Text className="block text-xs text-muted-foreground mb-1">Top P (0-1)</Text>
            <Input
              type="digit"
              className="w-full px-3 py-2 text-sm bg-muted rounded-lg"
              placeholder="0.9"
              value={config.topP?.toString() || ''}
              onInput={(e) => update({ topP: parseFloat(e.detail.value) || 0 })}
            />
          </View>
          <View className="mb-3">
            <Text className="block text-xs text-muted-foreground mb-1">{tt('model.systemPrompt', '系统提示词')}</Text>
            <Input
              className="w-full px-3 py-2 text-sm bg-muted rounded-lg"
              placeholder="You are a helpful assistant"
              value={config.systemPrompt || ''}
              onInput={(e) => update({ systemPrompt: e.detail.value })}
            />
          </View>
          <View className="flex items-center justify-between py-2 mb-2">
            <Text className="text-sm text-foreground">{tt('model.streaming', '流式输出')}</Text>
            <Switch
              checked={config.streamEnabled ?? true}
              onChange={(e) => update({ streamEnabled: e.detail.value })}
            />
          </View>

          {showImage && (
            <View className="mt-4 pt-2">
              <Text className="block text-xs text-muted-foreground mb-2">图片设置</Text>
              <View className="mb-3">
                <Text className="block text-xs text-muted-foreground mb-1">比例</Text>
                <View className="flex flex-wrap gap-2">
                  {ASPECT_RATIOS.map((r) => (
                    <View
                      key={r}
                      className={`px-3 py-1 text-xs rounded-md border ${
                        config.aspectRatio === r
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          : 'border-border text-muted-foreground'
                      }`}
                      onClick={() => update({ aspectRatio: r })}
                    >
                      {r}
                    </View>
                  ))}
                </View>
              </View>
              <View className="mb-3">
                <Text className="block text-xs text-muted-foreground mb-1">分辨率</Text>
                <View className="flex flex-wrap gap-2">
                  {RESOLUTIONS.map((r) => (
                    <View
                      key={r}
                      className={`px-3 py-1 text-xs rounded-md border ${
                        config.resolution === r
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          : 'border-border text-muted-foreground'
                      }`}
                      onClick={() => update({ resolution: r })}
                    >
                      {r}
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}

          {showVideo && (
            <View className="mt-2 pt-2 border-t border-border">
              <Text className="block text-xs text-muted-foreground mb-2">视频设置</Text>
              <View className="mb-3">
                <Text className="block text-xs text-muted-foreground mb-1">帧数</Text>
                <View className="flex flex-wrap gap-2">
                  {FRAME_COUNTS.map((f) => (
                    <View
                      key={f}
                      className={`px-3 py-1 text-xs rounded-md border ${
                        config.frameCount === f
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          : 'border-border text-muted-foreground'
                      }`}
                      onClick={() => update({ frameCount: f })}
                    >
                      {f}fps
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}

          {showAudio && (
            <View className="mt-4 pt-2">
              <Text className="block text-xs text-muted-foreground mb-2">音频设置</Text>
              <View className="mb-3">
                <Text className="block text-xs text-muted-foreground mb-1">音色</Text>
                <View className="flex flex-wrap gap-2">
                  {TIMBRES.map((tb) => (
                    <View
                      key={tb.id}
                      className={`px-3 py-1 text-xs rounded-md border ${
                        config.timbre === tb.id
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          : 'border-border text-muted-foreground'
                      }`}
                      onClick={() => update({ timbre: tb.id })}
                    >
                      {tb.name}
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}
        </View>
      </View>
    </View>
  )
}
