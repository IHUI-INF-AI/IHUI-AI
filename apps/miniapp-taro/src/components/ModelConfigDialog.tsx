import { useState } from 'react'
import { View, Text, Input, Switch } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useI18n } from '@/i18n'
import type { ModelConfigType } from '@ihui/types'
import Selecter from './Selecter'
import './ModelConfigDialog.css'

// ===== 默认 variant 用:简化版配置 =====
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

// 共享类型 ModelConfigType 已下沉到 packages/types,两端复用(替代原内联字面量)
export interface ModelConfigDialogProps {
  visible?: boolean
  /** 'default' = 简化版;'aigc' = 对齐原项目 ModelConfigDialog/indexa.vue */
  variant?: 'default' | 'aigc'
  /** default variant 用 */
  modelType?: ModelConfigType
  /** default variant 用 */
  config?: ModelConfig
  onChange?: (config: ModelConfig | Record<string, unknown>) => void
  onClose?: () => void
  // ===== aigc variant 专用 =====
  /** aigc variant:动态配置项(来自后端 modelInfo.variables) */
  variables?: AigcVariable[]
  /** aigc variant:当前模型名(用于判断视频模型) */
  modelName?: string
  /** aigc variant:是否 VIP(水印禁用判定) */
  isVip?: number
  /** aigc variant:系统音色列表(默认使用内置 SYSTEM_VOICES) */
  systemVoices?: Array<string | SelecterOptionObj>
}

// ===== aigc variant:动态配置项类型 =====
export interface AigcVariable {
  name: string
  desc: string
  value: boolean | string | number | Array<string | number | SelecterOptionObj>
}

export interface SelecterOptionObj {
  name?: string
  desc?: string
  value?: string | number
  [key: string]: unknown
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

// aigc variant:对齐原项目 indexa.vue 的系统音色与视频比例
const SYSTEM_VOICES = ['默认音色', '甜美女声', '成熟男声', '清澈童声', '专业播音', '情感朗读']
const VIDEO_ASPECT_RATIOS = ['1:1', '3:4', '4:3', '16:9', '9:16', '21:9']

const isBool = (v: unknown): v is boolean => typeof v === 'boolean'
const isArray = (v: unknown): v is Array<unknown> => Array.isArray(v)
const isSizeType = (arr: Array<unknown>): boolean =>
  arr.length > 0 && typeof arr[0] === 'object'

// 获取音色项的显示标签(字符串或 {name} 对象)
const voiceLabel = (v: string | SelecterOptionObj | undefined): string => {
  if (v === undefined) return ''
  return typeof v === 'string' ? v : v.name ?? ''
}

// ===== aigc variant:上传按钮项 =====
type UploadKey = 'firstFrame' | 'lastFrame' | 'audio' | 'video'

interface UploadEntry {
  url: string
  name: string
}

type UploadsState = Record<UploadKey, UploadEntry>

interface UploadItem {
  key: UploadKey
  label: string
  url: string
  name: string
  emptyIcon: string
  successIcon: string
}

export default function ModelConfigDialog({
  visible = false,
  variant = 'default',
  modelType = 'text',
  config = {},
  onChange,
  onClose,
  variables = [],
  modelName = '',
  isVip = 0,
  systemVoices = SYSTEM_VOICES,
}: ModelConfigDialogProps) {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  // aigc variant 内部状态
  const [configParamsObj, setConfigParamsObj] = useState<Record<string, unknown>>({})
  const [setVariables, setSetVariables] = useState<Array<{ name: string; desc: string; value: unknown }>>([])
  const [uploads, setUploads] = useState<UploadsState>({
    firstFrame: { url: '', name: '' },
    lastFrame: { url: '', name: '' },
    audio: { url: '', name: '' },
    video: { url: '', name: '' },
  })
  const [showAudioMenu, setShowAudioMenu] = useState(false)
  const [selectedVoiceIndex, setSelectedVoiceIndex] = useState<number>(-1)

  if (!visible) return null

  // ===== default variant:简化版(原有逻辑) =====
  if (variant === 'default') {
    const update = (patch: Partial<ModelConfig>) => {
      onChange?.({ ...config, ...patch })
    }
    const showImage = modelType === 'image' || modelType === 'multimodal'
    const showVideo = modelType === 'video' || modelType === 'multimodal'
    const showAudio = modelType === 'audio'
    return (
      <View className="fixed inset-0 z-[2000] flex items-center justify-center" onClick={onClose}>
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
                            ? 'border-primary bg-primary/10 text-primary'
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
                            ? 'border-primary bg-primary/10 text-primary'
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
                            ? 'border-primary bg-primary/10 text-primary'
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
                            ? 'border-primary bg-primary/10 text-primary'
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

  // ===== aigc variant:对齐原项目 indexa.vue =====
  const isVideoModel = !!(modelName && (modelName.includes('t2v') || modelName.includes('i2v')))

  // 判断是否显示某个配置项(视频特有项只在视频模型显示)
  const shouldShowItem = (item: AigcVariable): boolean => {
    if (['duration', 'movement', 'frames', 'enhanceClarity'].includes(item.name)) {
      return isVideoModel
    }
    return true
  }

  // 设置配置项值
  const setConfigValue = (name: string, val: unknown) => {
    const newParams = { ...configParamsObj, [name]: val }
    setConfigParamsObj(newParams)
    // 同步 setVariables
    const idx = setVariables.findIndex((it) => it.name === name)
    let newSetVars = setVariables
    if (idx !== -1) {
      newSetVars = setVariables.map((it, i) =>
        i === idx ? { name: it.name, desc: it.desc, value: val } : it
      )
      setSetVariables(newSetVars)
    }
    onChange?.({ ...newParams, setVariables: newSetVars })
  }

  // 处理上传
  const handleUpload = async (key: UploadKey) => {
    try {
      if (key === 'audio') {
        // 音频:从会话文件选
        const res = await Taro.chooseMessageFile({ count: 1, type: 'file', extension: ['mp3', 'wav', 'm4a'] })
        const f = res.tempFiles?.[0]
        if (f) {
          const url = f.path || ''
          setUploads((prev) => ({ ...prev, [key]: { url, name: f.name } }))
          setConfigValue('audio', url)
        }
      } else if (key === 'video') {
        const res = await Taro.chooseVideo({ sourceType: ['album', 'camera'] })
        if (res.tempFilePath) {
          setUploads((prev) => ({ ...prev, [key]: { url: res.tempFilePath, name: 'video.mp4' } }))
          setConfigValue('video', res.tempFilePath)
        }
      } else {
        // 首帧/尾帧图
        const res = await Taro.chooseImage({ count: 1, sourceType: ['album', 'camera'] })
        const path = res.tempFilePaths?.[0]
        if (path) {
          setUploads((prev) => ({ ...prev, [key]: { url: path, name: 'image.png' } }))
          setConfigValue(key, path)
        }
      }
    } catch (err) {
      // 用户取消或权限不足,不抛错
      console.warn('[ModelConfigDialog] upload failed:', err)
    }
  }

  const deleteUpload = (key: UploadKey) => {
    setUploads((prev) => ({ ...prev, [key]: { url: '', name: '' } }))
    setConfigValue(key, '')
  }

  // 上传按钮配置
  const uploadItems: UploadItem[] = [
    { key: 'firstFrame', label: '添加首帧图', url: uploads.firstFrame.url, name: uploads.firstFrame.name, emptyIcon: '🖼️', successIcon: '✅' },
    { key: 'lastFrame', label: '添加尾帧图', url: uploads.lastFrame.url, name: uploads.lastFrame.name, emptyIcon: '🖼️', successIcon: '✅' },
    { key: 'audio', label: '参考音色', url: uploads.audio.url, name: uploads.audio.name, emptyIcon: '🎵', successIcon: '🔊' },
    { key: 'video', label: '克隆数字人', url: uploads.video.url, name: uploads.video.name, emptyIcon: '🎬', successIcon: '🎞️' },
  ]

  return (
    <View className="fixed inset-0 z-[2000] flex items-center justify-center" onClick={onClose}>
      <View className="absolute inset-0 bg-black/40" />
      <View
        className="relative bg-card rounded-xl mx-4 w-full max-w-md max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <View className="flex items-center justify-between px-4 py-3 mb-2">
          <Text className="text-sm font-medium text-foreground">{tt('model.configTitle', '模型配置')}</Text>
          <Text className="text-sm text-muted-foreground" onClick={onClose}>
            {tt('common.close', '关闭')}
          </Text>
        </View>
        <View className="px-4 py-3">
          {/* 4 个上传按钮 */}
          <View className="flex items-center justify-between py-2">
            {uploadItems.map((it) => (
              <View
                key={it.key}
                className="flex flex-col items-center"
                onClick={() => it.key === 'audio' ? setShowAudioMenu(true) : handleUpload(it.key)}
              >
                <View className="relative">
                  {!it.url ? (
                    <View className="w-[74rpx] h-[74rpx] flex items-center justify-center bg-muted rounded-lg text-2xl">
                      {it.emptyIcon}
                    </View>
                  ) : (
                    <View className="w-[74rpx] h-[74rpx] flex items-center justify-center bg-primary/10 rounded-lg text-2xl">
                      {it.successIcon}
                    </View>
                  )}
                  {it.url && (
                    <View
                      className="absolute -top-1 -right-1 w-4 h-4 bg-destructive rounded-full flex items-center justify-center"
                      onClick={(e) => { e.stopPropagation(); deleteUpload(it.key) }}
                    >
                      <Text className="text-white text-[16rpx]">×</Text>
                    </View>
                  )}
                </View>
                <Text className="text-[24rpx] text-muted-foreground mt-1">{it.name || it.label}</Text>
              </View>
            ))}
          </View>

          {/* 音色选择弹窗 — 集成 Selecter type='voice' 选系统音色 + 上传克隆音色 */}
          {showAudioMenu && (
            <View
              className="fixed inset-0 z-[2100] flex items-center justify-center bg-black/40"
              onClick={() => setShowAudioMenu(false)}
            >
              <View
                className="mcd-audio-menu mx-6 w-full max-w-xs p-4"
                onClick={(e) => e.stopPropagation()}
              >
                <View className="flex items-center justify-between mb-3">
                  <Text className="text-sm font-medium">选择音色</Text>
                  <Text className="text-sm text-muted-foreground" onClick={() => setShowAudioMenu(false)}>×</Text>
                </View>
                {/* 系统音色选择 - Selecter type='voice' */}
                <View className="mb-3">
                  <Text className="block text-xs text-muted-foreground mb-2">
                    {selectedVoiceIndex >= 0
                      ? `当前：${voiceLabel(systemVoices[selectedVoiceIndex])}`
                      : '系统音色库'}
                  </Text>
                  <Selecter
                    type="voice"
                    options={systemVoices}
                    onChange={(val, idx) => {
                      setSelectedVoiceIndex(typeof idx === 'number' ? idx : -1)
                      setConfigValue('voice', val)
                      setShowAudioMenu(false)
                    }}
                  />
                </View>
                {/* 克隆音色 - 上传音频文件 */}
                <View
                  className="flex items-center py-2 rounded-md border border-border"
                  onClick={() => {
                    setShowAudioMenu(false)
                    handleUpload('audio')
                  }}
                >
                  <Text className="text-2xl mr-2">🎤</Text>
                  <View className="flex-1">
                    <Text className="block text-sm">{uploads.audio.name ? '当前：' + uploads.audio.name : '克隆音色'}</Text>
                    <Text className="block text-xs text-muted-foreground">上传音频文件克隆音色</Text>
                  </View>
                  <Text className="text-muted-foreground">›</Text>
                </View>
              </View>
            </View>
          )}

          {/* 动态配置项 */}
          {variables.filter(shouldShowItem).map((item) => {
            // 1. boolean 开关
            if (isBool(item.value)) {
              const checked = !!configParamsObj[item.name]
              return (
                <View key={item.name} className="flex items-center justify-between py-2 mb-2">
                  <Text className="text-sm text-foreground">{item.desc}</Text>
                  <View
                    className="w-[88rpx] h-[44rpx] rounded-full flex items-center px-[4rpx]"
                    style={{ backgroundColor: checked ? 'var(--color-primary)' : 'var(--color-muted)' }}
                    onClick={() => setConfigValue(item.name, !checked)}
                  >
                    <View
                      className="w-[36rpx] h-[36rpx] rounded-full bg-white transition-transform"
                      style={{ transform: checked ? 'translateX(44rpx)' : 'translateX(0)' }}
                    />
                  </View>
                </View>
              )
            }
            // 2. 数组选择器
            if (isArray(item.value) && item.value.length > 0 && !isBool(item.value[0])) {
              const selecterType = isSizeType(item.value) ? 'ratio' : ''
              return (
                <View key={item.name} className="mb-3">
                  <Text className="block text-xs text-muted-foreground mb-1">{item.desc}</Text>
                  <Selecter
                    type={selecterType as 'ratio' | ''}
                    options={item.value as Array<string | SelecterOptionObj | Record<string, unknown>>}
                    desc={item.desc}
                    isVip={isVip}
                    onChange={(val) => setConfigValue(item.name, val)}
                  />
                </View>
              )
            }
            // 3. 文本输入
            return (
              <View key={item.name} className="mb-3">
                <Text className="block text-xs text-muted-foreground mb-1">{item.desc}</Text>
                <Input
                  className="w-full px-3 py-2 text-sm bg-muted rounded-lg"
                  placeholder={`请输入${item.desc}`}
                  value={(configParamsObj[item.name] as string) || ''}
                  onInput={(e) => setConfigValue(item.name, e.detail.value)}
                />
              </View>
            )
          })}

          {/* 视频模型额外配置(对齐原项目固定项) */}
          {isVideoModel && (
            <View className="mt-3 pt-2 border-t border-border">
              <Text className="block text-xs text-muted-foreground mb-2">视频设置</Text>
              <View className="mb-3">
                <Text className="block text-xs text-muted-foreground mb-1">视频比例</Text>
                <Selecter
                  type="scale"
                  options={VIDEO_ASPECT_RATIOS}
                  onChange={(val) => setConfigValue('aspect_ratio', val)}
                />
              </View>
              <View className="mb-3">
                <Text className="block text-xs text-muted-foreground mb-1">视频分辨率</Text>
                <Selecter
                  type="video"
                  options={[]}
                  onChange={(val) => setConfigValue('videoResolution', val)}
                />
              </View>
            </View>
          )}
        </View>
      </View>
    </View>
  )
}
