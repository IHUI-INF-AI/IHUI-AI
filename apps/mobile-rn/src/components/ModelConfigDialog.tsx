/**
 * 模型配置弹窗(mobile-rn 端)
 *
 * 支持参数:
 * - 基础:temperature / maxTokens / topP / systemPrompt / streamEnabled
 * - 图片:aspectRatio / resolution
 * - 视频:frameCount
 * - 音频:timbre(CosyVoice 音色)
 *
 * 仅当 modelType 为 image/video/audio 时条件渲染媒体参数。
 *
 * 设计:参考 AgentRuntimePanel / ChatScreen 的 Modal+TouchableOpacity 关闭层模式,
 *      媒体参数用 Chip 选择器,音色用下拉展开列表(替代旧 Vue picker)。
 */
import { useCallback, useState } from 'react'
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Switch,
  TouchableOpacity,
} from 'react-native'
import { useI18n } from '../i18n'

export type ModelType = 'text' | 'image' | 'video' | 'audio' | 'multimodal'

export interface ModelConfig {
  temperature: number
  maxTokens: number
  topP: number
  systemPrompt: string
  streamEnabled: boolean
  aspectRatio?: string
  resolution?: string
  frameCount?: number
  timbre?: string
}

export interface ModelConfigDialogProps {
  visible: boolean
  modelType: ModelType
  config: ModelConfig
  onChange: (config: ModelConfig) => void
  onClose: () => void
}

const ASPECT_RATIOS = ['1:1', '3:4', '4:3', '16:9', '9:16'] as const
const RESOLUTIONS = ['512x512', '1024x1024', '2048x2048'] as const
const FRAME_COUNTS = [5, 8, 16, 24] as const
const TIMBRES = [
  { id: 'longxiaochun', name: '龙小淳 · 女 · 温柔' },
  { id: 'longhua', name: '龙华 · 男 · 沉稳' },
  { id: 'longshuo', name: '龙朔 · 男 · 清亮' },
  { id: 'longyue', name: '龙悦 · 女 · 活泼' },
  { id: 'longshu', name: '龙叔 · 男 · 浑厚' },
  { id: 'longmiao', name: '龙妙 · 女 · 甜美' },
] as const

function Chip({
  label,
  active,
  onPress,
}: {
  label: string
  active: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      className={
        active
          ? 'mr-1.5 mb-1.5 rounded-md bg-emerald-50 px-2.5 py-1.5'
          : 'mr-1.5 mb-1.5 rounded-md bg-gray-50 px-2.5 py-1.5'
      }
    >
      <Text className={active ? 'text-xs text-emerald-700' : 'text-xs text-gray-600'}>
        {label}
      </Text>
    </Pressable>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="mb-3">
      <Text className="mb-1.5 text-xs font-medium text-gray-500">{label}</Text>
      {children}
    </View>
  )
}

export function ModelConfigDialog({
  visible,
  modelType,
  config,
  onChange,
  onClose,
}: ModelConfigDialogProps) {
  const { t } = useI18n()
  const [timbreOpen, setTimbreOpen] = useState(false)

  const update = useCallback(
    (patch: Partial<ModelConfig>) => onChange({ ...config, ...patch }),
    [config, onChange],
  )

  const isImage = modelType === 'image' || modelType === 'multimodal'
  const isVideo = modelType === 'video'
  const isAudio = modelType === 'audio'

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        className="flex-1 bg-black/20"
        activeOpacity={1}
        onPress={onClose}
      >
        <View className="mt-auto bg-white">
          <View className="flex-row items-center justify-between px-4 py-3">
            <Text className="text-sm font-semibold text-gray-900">{t('agent.config')}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text className="text-xs text-gray-500">{t('common.cancel')}</Text>
            </Pressable>
          </View>

          <ScrollView className="max-h-[60%] px-4 pb-2">
            <Row label="Temperature">
              <View className="flex-row items-center">
                <TextInput
                  value={String(config.temperature)}
                  keyboardType="numeric"
                  onChangeText={(v) => update({ temperature: Number(v) || 0 })}
                  className="mr-2 h-8 flex-1 rounded-md bg-gray-50 px-2 text-xs text-gray-900"
                />
                <Text className="text-xs text-gray-400">0.0 - 2.0</Text>
              </View>
            </Row>

            <Row label="Max Tokens">
              <TextInput
                value={String(config.maxTokens)}
                keyboardType="numeric"
                onChangeText={(v) => update({ maxTokens: Number(v) || 0 })}
                className="h-8 rounded-md bg-gray-50 px-2 text-xs text-gray-900"
              />
            </Row>

            <Row label="Top P">
              <TextInput
                value={String(config.topP)}
                keyboardType="numeric"
                onChangeText={(v) => update({ topP: Number(v) || 0 })}
                className="h-8 rounded-md bg-gray-50 px-2 text-xs text-gray-900"
              />
            </Row>

            <Row label="System Prompt">
              <TextInput
                value={config.systemPrompt}
                onChangeText={(v) => update({ systemPrompt: v })}
                placeholder="请输入系统提示词"
                multiline
                className="min-h-[60px] rounded-md bg-gray-50 p-2 text-xs text-gray-900"
              />
            </Row>

            <Row label="Stream">
              <View className="flex-row items-center justify-between">
                <Text className="text-xs text-gray-600">
                  {config.streamEnabled ? '已启用' : '未启用'}
                </Text>
                <Switch
                  value={config.streamEnabled}
                  onValueChange={(v) => update({ streamEnabled: v })}
                />
              </View>
            </Row>

            {isImage ? (
              <>
                <Row label="图片比例">
                  <View className="flex-row flex-wrap">
                    {ASPECT_RATIOS.map((r) => (
                      <Chip
                        key={r}
                        label={r}
                        active={config.aspectRatio === r}
                        onPress={() => update({ aspectRatio: r })}
                      />
                    ))}
                  </View>
                </Row>

                <Row label="图片分辨率">
                  <View className="flex-row flex-wrap">
                    {RESOLUTIONS.map((r) => (
                      <Chip
                        key={r}
                        label={r}
                        active={config.resolution === r}
                        onPress={() => update({ resolution: r })}
                      />
                    ))}
                  </View>
                </Row>
              </>
            ) : null}

            {isVideo ? (
              <Row label="视频帧数">
                <View className="flex-row flex-wrap">
                  {FRAME_COUNTS.map((f) => (
                    <Chip
                      key={f}
                      label={`${f} 帧`}
                      active={config.frameCount === f}
                      onPress={() => update({ frameCount: f })}
                    />
                  ))}
                </View>
              </Row>
            ) : null}

            {isAudio ? (
              <Row label="音色">
                <Pressable
                  onPress={() => setTimbreOpen((v) => !v)}
                  className="rounded-md bg-gray-50 px-2.5 py-2"
                >
                  <Text className="text-xs text-gray-900">
                    {TIMBRES.find((x) => x.id === config.timbre)?.name ?? '请选择音色'}
                  </Text>
                </Pressable>
                {timbreOpen ? (
                  <View className="mt-1.5 rounded-md border border-gray-100 bg-white p-1">
                    {TIMBRES.map((tb) => (
                      <Pressable
                        key={tb.id}
                        onPress={() => {
                          update({ timbre: tb.id })
                          setTimbreOpen(false)
                        }}
                        className="rounded-md px-2.5 py-2"
                      >
                        <Text
                          className={
                            config.timbre === tb.id
                              ? 'text-xs text-emerald-700'
                              : 'text-xs text-gray-700'
                          }
                        >
                          {tb.name}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </Row>
            ) : null}
          </ScrollView>

          <View className="flex-row gap-2 px-4 pb-4 pt-2">
            <Pressable
              onPress={onClose}
              className="flex-1 items-center rounded-md bg-gray-100 py-2.5"
            >
              <Text className="text-xs text-gray-700">{t('common.cancel')}</Text>
            </Pressable>
            <Pressable
              onPress={onClose}
              className="flex-1 items-center rounded-md bg-emerald-500 py-2.5"
            >
              <Text className="text-xs text-white">{t('common.save')}</Text>
            </Pressable>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  )
}

export default ModelConfigDialog
