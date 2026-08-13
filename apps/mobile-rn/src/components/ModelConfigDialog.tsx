/**
 * 模型配置弹窗(mobile-rn 端)
 *
 * 3 变体(对齐历史 Uniapp 项目):
 * - index(默认):基础模型配置弹窗(模型选择 + 参数调节)
 * - indexa:带高级设置的模型配置弹窗(数字人上传 + 音色克隆录音 + 参数调节)
 * - selecter:纯模型选择器(无参数调节)
 *
 * 对齐历史项目:
 * - index.vue → variant='index'
 * - indexa.vue(带音频菜单弹窗 + 录音弹窗)→ variant='indexa'
 * - selecter.vue(纯选项选择器)→ variant='selecter'
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
import type { ModelConfigType } from '@ihui/ui-native'

// 共享类型(ModelConfigType)从 packages/types 下沉,两端复用。
// 保留 ModelType 别名以维持本模块对外 API 向后兼容(虽然当前 mobile-rn 内部无外部引用,
// 但 export 关键字原本就在,删 export 会改变公开 API 表面)。
export type ModelType = ModelConfigType

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

/** 模型配置弹窗变体 */
export type ModelConfigDialogVariant = 'index' | 'indexa' | 'selecter'

/** selecter 变体:可选模型项 */
export interface ModelOption {
  id: string
  name: string
  description?: string
}

export interface ModelConfigDialogProps {
  visible: boolean
  modelType: ModelType
  config: ModelConfig
  onChange: (config: ModelConfig) => void
  onClose: () => void
  /** 变体选择,默认 'index' */
  variant?: ModelConfigDialogVariant

  // ===== indexa 变体:高级设置 Props =====
  /** 模型名称(用于条件渲染上传按钮,如 '智汇AI数字人' / '通义语音合成') */
  modelName?: string
  /** 首帧图 URL(已上传时显示缩略图) */
  firstFrameUrl?: string
  /** 尾帧图 URL */
  lastFrameUrl?: string
  /** 参考音色音频 URL */
  audioUrl?: string
  /** 克隆数字人视频 URL */
  videoUrl?: string
  /** 上传首帧图回调 */
  onUploadFirstFrame?: () => void
  /** 上传尾帧图回调 */
  onUploadLastFrame?: () => void
  /** 上传参考音色回调(打开音色选择菜单) */
  onUploadAudio?: () => void
  /** 克隆数字人回调 */
  onUploadVideo?: () => void
  /** 选择系统音色回调 */
  onSelectVoice?: () => void
  /** 克隆音色回调(打开录音弹窗) */
  onCloneVoice?: () => void
  /** 开始录音回调 */
  onStartRecording?: () => void
  /** 停止录音回调 */
  onStopRecording?: () => void
  /** 是否正在录音 */
  isRecording?: boolean
  /** 录音时长(秒) */
  recordDuration?: number

  // ===== selecter 变体 Props =====
  /** 可选模型列表 */
  models?: ModelOption[]
  /** 当前选中模型 ID */
  selectedModelId?: string
  /** 选择模型回调 */
  onSelectModel?: (id: string) => void
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

// ===== 主组件(变体分发)=====

export function ModelConfigDialog(props: ModelConfigDialogProps) {
  const variant = props.variant ?? 'index'
  if (variant === 'selecter') return <ModelSelecterDialog {...props} />
  if (variant === 'indexa') return <AdvancedModelConfigDialog {...props} />
  return <BasicModelConfigDialog {...props} />
}

export default ModelConfigDialog

// ===== index 变体(基础模型配置)=====

function BasicModelConfigDialog({
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
                  className="mr-2 h-10 flex-1 rounded-md bg-gray-50 px-2 text-xs text-gray-900"
                />
                <Text className="text-xs text-gray-400">0.0 - 2.0</Text>
              </View>
            </Row>

            <Row label="Max Tokens">
              <TextInput
                value={String(config.maxTokens)}
                keyboardType="numeric"
                onChangeText={(v) => update({ maxTokens: Number(v) || 0 })}
                className="h-10 rounded-md bg-gray-50 px-2 text-xs text-gray-900"
              />
            </Row>

            <Row label="Top P">
              <TextInput
                value={String(config.topP)}
                keyboardType="numeric"
                onChangeText={(v) => update({ topP: Number(v) || 0 })}
                className="h-10 rounded-md bg-gray-50 px-2 text-xs text-gray-900"
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

// ===== indexa 变体(高级设置:数字人上传 + 音色克隆)=====

function AdvancedModelConfigDialog(props: ModelConfigDialogProps) {
  const {
    visible,
    modelType,
    config,
    onChange,
    onClose,
    modelName,
    firstFrameUrl,
    lastFrameUrl,
    audioUrl,
    videoUrl,
    onUploadFirstFrame,
    onUploadLastFrame,
    onUploadVideo,
    onSelectVoice,
    onCloneVoice,
    onStartRecording,
    onStopRecording,
    isRecording = false,
    recordDuration = 0,
  } = props

  const { t } = useI18n()
  const [timbreOpen, setTimbreOpen] = useState(false)
  const [showAudioMenu, setShowAudioMenu] = useState(false)
  const [showRecordDialog, setShowRecordDialog] = useState(false)

  const update = useCallback(
    (patch: Partial<ModelConfig>) => onChange({ ...config, ...patch }),
    [config, onChange],
  )

  const isImage = modelType === 'image' || modelType === 'multimodal'
  const isVideo = modelType === 'video'
  const isAudio = modelType === 'audio'

  // 数字人模型:显示首帧图/尾帧图/克隆数字人按钮
  const isDigitalHuman = modelName?.includes('数字人') ?? false
  // 语音合成模型:显示参考音色按钮
  const isVoiceSynthesis = modelName?.includes('语音') ?? false
  // 显示上传按钮组的条件
  const showUploadButtons = isDigitalHuman || isVoiceSynthesis

  const handleAudioMenu = () => {
    setShowAudioMenu(true)
  }

  const handleSelectVoice = () => {
    setShowAudioMenu(false)
    onSelectVoice?.()
  }

  const handleCloneVoice = () => {
    setShowAudioMenu(false)
    setShowRecordDialog(true)
    onCloneVoice?.()
  }

  const handleStartRecord = () => {
    onStartRecording?.()
  }

  const handleStopRecord = () => {
    onStopRecording?.()
  }

  const handleCloseRecordDialog = () => {
    setShowRecordDialog(false)
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        className="flex-1 bg-black/20"
        activeOpacity={1}
        onPress={onClose}
      >
        <View className="mt-auto bg-white">
          {/* 头部 */}
          <View className="flex-row items-center justify-between px-4 py-3">
            <Text className="text-sm font-semibold text-gray-900">{t('agent.config')}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text className="text-xs text-gray-500">{t('common.cancel')}</Text>
            </Pressable>
          </View>

          <ScrollView className="max-h-[60%] px-4 pb-2">
            {/* 数字人生成相关功能按钮 */}
            {showUploadButtons ? (
              <View className="flex-row flex-wrap justify-between pt-2 pb-1">
                {/* 首帧图 */}
                {isDigitalHuman ? (
                  <UploadButton
                    label="添加首帧图"
                    url={firstFrameUrl}
                    onPress={onUploadFirstFrame}
                  />
                ) : null}

                {/* 尾帧图 */}
                {isDigitalHuman ? (
                  <UploadButton
                    label="添加尾帧图"
                    url={lastFrameUrl}
                    onPress={onUploadLastFrame}
                  />
                ) : null}

                {/* 参考音色 */}
                {isVoiceSynthesis || isDigitalHuman ? (
                  <UploadButton
                    label="参考音色"
                    url={audioUrl}
                    onPress={handleAudioMenu}
                  />
                ) : null}

                {/* 克隆数字人 */}
                {isDigitalHuman ? (
                  <UploadButton
                    label="克隆数字人"
                    url={videoUrl}
                    onPress={onUploadVideo}
                  />
                ) : null}
              </View>
            ) : null}

            {/* 基础参数(同 index 变体) */}
            <Row label="Temperature">
              <View className="flex-row items-center">
                <TextInput
                  value={String(config.temperature)}
                  keyboardType="numeric"
                  onChangeText={(v) => update({ temperature: Number(v) || 0 })}
                  className="mr-2 h-10 flex-1 rounded-md bg-gray-50 px-2 text-xs text-gray-900"
                />
                <Text className="text-xs text-gray-400">0.0 - 2.0</Text>
              </View>
            </Row>

            <Row label="Max Tokens">
              <TextInput
                value={String(config.maxTokens)}
                keyboardType="numeric"
                onChangeText={(v) => update({ maxTokens: Number(v) || 0 })}
                className="h-10 rounded-md bg-gray-50 px-2 text-xs text-gray-900"
              />
            </Row>

            <Row label="Top P">
              <TextInput
                value={String(config.topP)}
                keyboardType="numeric"
                onChangeText={(v) => update({ topP: Number(v) || 0 })}
                className="h-10 rounded-md bg-gray-50 px-2 text-xs text-gray-900"
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

          {/* 底部按钮 */}
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

      {/* 音频选择菜单弹窗 */}
      {showAudioMenu ? (
        <TouchableOpacity
          className="absolute inset-0 bg-black/40"
          activeOpacity={1}
          onPress={() => setShowAudioMenu(false)}
        >
          <View className="flex-1 items-center justify-center">
            <View
              className="w-[80%] overflow-hidden rounded-xl bg-white"
              onStartShouldSetResponder={() => true}
            >
              {/* 弹窗头部 */}
              <View className="flex-row items-center justify-between px-5 py-4">
                <Text className="text-sm font-semibold text-gray-900">选择音色</Text>
                <Pressable onPress={() => setShowAudioMenu(false)} hitSlop={8}>
                  <Text className="text-xs text-gray-500">✕</Text>
                </Pressable>
              </View>

              {/* 菜单项 */}
              <Pressable
                onPress={handleSelectVoice}
                className="flex-row items-center px-5 py-3"
              >
                <View className="mr-3 h-10 w-10 items-center justify-center rounded-lg bg-purple-50">
                  <Text className="text-lg">🎵</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-medium text-gray-900">选择音色</Text>
                  <Text className="text-xs text-gray-400">
                    {audioUrl ? '当前已选择音色' : '从系统音色库中选择'}
                  </Text>
                </View>
                <Text className="text-xs text-gray-300">›</Text>
              </Pressable>

              <Pressable
                onPress={handleCloneVoice}
                className="flex-row items-center px-5 py-3"
              >
                <View className="mr-3 h-10 w-10 items-center justify-center rounded-lg bg-purple-50">
                  <Text className="text-lg">🎙️</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-medium text-gray-900">克隆音色</Text>
                  <Text className="text-xs text-gray-400">上传音频文件克隆音色</Text>
                </View>
                <Text className="text-xs text-gray-300">›</Text>
              </Pressable>
            </View>
          </View>
        </TouchableOpacity>
      ) : null}

      {/* 录音弹窗 */}
      {showRecordDialog ? (
        <Modal visible={showRecordDialog} transparent animationType="fade"
          onRequestClose={handleCloseRecordDialog}>
          <TouchableOpacity
            className="flex-1 bg-black/50"
            activeOpacity={1}
            onPress={handleCloseRecordDialog}
          >
            <View className="flex-1 items-center justify-center">
              <View
                className="w-[85%] overflow-hidden rounded-xl bg-white"
                onStartShouldSetResponder={() => true}
              >
                {/* 录音弹窗头部 */}
                <View className="flex-row items-center justify-between px-5 py-4">
                  <Text className="text-sm font-semibold text-gray-900">音色克隆</Text>
                  <Pressable onPress={handleCloseRecordDialog} hitSlop={8}>
                    <Text className="text-xs text-gray-500">✕</Text>
                  </Pressable>
                </View>

                {/* 录音内容 */}
                <View className="px-5 pb-5">
                  {/* 朗读文本 */}
                  <Text className="mb-1.5 text-xs text-gray-500">请朗读以下文本:</Text>
                  <View className="mb-4 rounded-lg bg-gray-50 p-3">
                    <Text className="text-xs leading-5 text-gray-700">
                      我正在录制智汇 AI 定制克隆声音。通过这段录制,你将拥有一个与自己声音高度相似的 AI 语音模型。
                    </Text>
                  </View>

                  {/* 录音状态 */}
                  <View className="mb-4 items-center">
                    <Text className="text-xs text-gray-500">
                      {isRecording ? `录音中... ${recordDuration}秒` : '点击下方按钮开始录音'}
                    </Text>
                  </View>

                  {/* 录音按钮 */}
                  <View className="mb-3 items-center">
                    <Pressable
                      onPress={isRecording ? handleStopRecord : handleStartRecord}
                      className={
                        isRecording
                          ? 'h-16 w-16 items-center justify-center rounded-xl bg-red-500'
                          : 'h-16 w-16 items-center justify-center rounded-xl bg-indigo-500'
                      }
                    >
                      <Text className="text-2xl text-white">
                        {isRecording ? '⏹' : '🎙️'}
                      </Text>
                    </Pressable>
                    <Text className="mt-2 text-xs text-gray-500">
                      {isRecording ? '停止录音' : '开始录音'}
                    </Text>
                  </View>

                  {/* 提示 */}
                  <Text className="text-center text-xs text-gray-400">
                    建议录音时长 10-30 秒,请确保环境安静
                  </Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      ) : null}
    </Modal>
  )
}

/** indexa 变体:上传按钮(虚线边框 + 图标 + 标签) */
function UploadButton({
  label,
  url,
  onPress,
}: {
  label: string
  url?: string
  onPress?: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      className="mr-1.5 mb-1.5 w-[80px] items-center rounded-lg border border-dashed border-purple-200 bg-purple-50 py-2"
    >
      <View className="mb-1 h-8 w-8 items-center justify-center">
        <Text className="text-lg">{url ? '✓' : '＋'}</Text>
      </View>
      <Text className="text-xs text-gray-600" numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  )
}

// ===== selecter 变体(纯模型选择器,无参数调节)=====

function ModelSelecterDialog({
  visible,
  onClose,
  models = [],
  selectedModelId,
  onSelectModel,
}: ModelConfigDialogProps) {
  const { t } = useI18n()

  const handleSelect = (id: string) => {
    onSelectModel?.(id)
    onClose()
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        className="flex-1 bg-black/20"
        activeOpacity={1}
        onPress={onClose}
      >
        <View className="mt-auto bg-white">
          {/* 头部 */}
          <View className="flex-row items-center justify-between px-4 py-3">
            <Text className="text-sm font-semibold text-gray-900">选择模型</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text className="text-xs text-gray-500">{t('common.cancel')}</Text>
            </Pressable>
          </View>

          {/* 模型列表 */}
          <ScrollView className="max-h-[50%] px-4 pb-2">
            {models.length === 0 ? (
              <View className="py-8 items-center">
                <Text className="text-xs text-gray-400">暂无可选模型</Text>
              </View>
            ) : (
              models.map((model) => {
                const isActive = model.id === selectedModelId
                return (
                  <Pressable
                    key={model.id}
                    onPress={() => handleSelect(model.id)}
                    className={
                      isActive
                        ? 'mb-2 rounded-md bg-emerald-50 px-3 py-3'
                        : 'mb-2 rounded-md bg-gray-50 px-3 py-3'
                    }
                  >
                    <Text
                      className={
                        isActive
                          ? 'text-sm font-medium text-emerald-700'
                          : 'text-sm font-medium text-gray-900'
                      }
                    >
                      {model.name}
                    </Text>
                    {model.description ? (
                      <Text className="mt-0.5 text-xs text-gray-400">
                        {model.description}
                      </Text>
                    ) : null}
                  </Pressable>
                )
              })
            )}
          </ScrollView>

          {/* 底部关闭按钮 */}
          <View className="px-4 pb-4 pt-2">
            <Pressable
              onPress={onClose}
              className="items-center rounded-md bg-gray-100 py-2.5"
            >
              <Text className="text-xs text-gray-700">{t('common.cancel')}</Text>
            </Pressable>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  )
}
