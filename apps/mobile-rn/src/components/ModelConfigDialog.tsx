// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 模型配置弹窗(mobile-rn 端)
 *
 * 仅当 modelType 为 image/video/audio 时条件渲染媒体参数。
 *
 * 后端依赖回调预留(不引入原生依赖,由父组件注入):
 * - 系统音色:原版 GET /ali/audio/sys(fetchSystemVoices),RN 端由 systemVoices prop 注入
 *
 * 设计:参考 AgentRuntimePanel / ChatScreen 的 Modal+TouchableOpacity 关闭层模式,
 *      媒体参数用 Chip 选择器,音色用下拉展开列表(替代旧 Vue picker)。
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Modal, View, Text, Pressable, ScrollView, Switch, TouchableOpacity } from 'react-native'
import { useI18n } from '../i18n'
import { useUiTextField } from '../lib/use-ui-text-field'
import type { ModelConfigType } from '@ihui/ui-native'
import { ChevronLeft } from 'lucide-react-native'
import { currentRnTheme, tokens } from '../theme/active-tokens'
// 本组件所有会显形的几何数字(选项胶囊内衬与间距 / 参数输入框内衬 / 字段标签间距 / 字形)
// 一律不在本文件取数 —— 唯一源在
// @ihui/shared/ui/model-config-dialog-spec(与小程序端同档,裁决依据写在该文件);
// RN 单位 dp 与逻辑 px 1:1,换算取恒等。胶囊间距两端用同一档但各挂自己的机制
// (本端条目 margin、小程序容器 `gap`),换机制属重构不在本票,故只统一数值。
import {
  MODEL_CONFIG_CHIP_GAP_PX,
  MODEL_CONFIG_CHIP_PAD_X_PX,
  MODEL_CONFIG_CHIP_PAD_Y_PX,
  MODEL_CONFIG_INLINE_GLYPH_PX,
  MODEL_CONFIG_INPUT_PAD_X_PX,
  MODEL_CONFIG_LABEL_GAP_PX,
  modelConfigChipInnerStyle,
  modelConfigChipItemMarginStyle,
  modelConfigInputBoxStyle,
  modelConfigLabelGapStyle,
} from '@ihui/shared/ui/model-config-dialog-spec'
import { TextField } from '@ihui/rn-app'
import { Tappable } from '@ihui/ui-native'

const toUnit = (px: number) => px

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
export type ModelConfigDialogVariant = 'index'

/**
 * 动态配置变量(对齐原 index.vue parseModelInfo 解析出的 {name, desc, value})。
 * value 支持:字符串 / 数字 / [true,false](布尔开关) / 数组(选项列表) /
 * 尺寸对象数组(如 [{ '1k': { '1:1': '1024x1024', ... } }],触发 ratio 两级选择)。
 */
export interface ModelConfigVariable {
  name: string
  desc: string
  value: string | number | boolean | unknown[]
}

export interface ModelConfigDialogProps {
  visible: boolean
  /** 模型能力类型,默认 'text'(对齐小程序端同名字段的可选性与默认值) */
  modelType?: ModelType
  config: ModelConfig
  onChange: (config: ModelConfig) => void
  onClose: () => void
  /** 变体选择,默认 'index' */
  variant?: ModelConfigDialogVariant

  /** 模型名称(保留与小程序端同名键对账) */
  modelName?: string

  // ===== 动态配置(对齐原 index.vue 的 variables)=====
  /** 动态配置变量列表(原 modelInfo.variables;不传则仅渲染基础参数) */
  variables?: ModelConfigVariable[]
  /** 系统音色列表(对齐原 fetchSystemVoices → GET /ali/audio/sys;RN 端由父组件注入) */
  systemVoices?: Array<{ id: string; name: string }>
}

const ASPECT_RATIOS = ['1:1', '3:4', '4:3', '16:9', '9:16'] as const
const RESOLUTIONS = ['512x512', '1024x1024', '2048x2048'] as const
const FRAME_COUNTS = [5, 8, 16, 24] as const
const TIMBRES: ReadonlyArray<{ id: string; nameKey: string }> = [
  { id: 'longxiaochun', nameKey: 'profile.cfgVoiceLongxiaochun' },
  { id: 'longhua', nameKey: 'profile.cfgVoiceLonghua' },
  { id: 'longshuo', nameKey: 'profile.cfgVoiceLongshuo' },
  { id: 'longyue', nameKey: 'profile.cfgVoiceLongyue' },
  { id: 'longshu', nameKey: 'profile.cfgVoiceLongshu' },
  { id: 'longmiao', nameKey: 'profile.cfgVoiceLongmiao' },
]

/** 视频特有配置项(对齐原 shouldShowItem,仅在视频模型下显示) */
const VIDEO_ONLY_VARIABLES = ['duration', 'movement', 'frames', 'enhanceClarity']

/** 判断是否为布尔选项 [true, false](对齐原 isBooleanOption) */
function isBooleanOption(value: unknown): value is [true, false] {
  return Array.isArray(value) && value.length === 2 && value[0] === true && value[1] === false
}

/** 判断是否为数组选项(对齐原 isArrayOption) */
function isArrayOption(value: unknown): value is unknown[] {
  return Array.isArray(value)
}

/** 判断是否为尺寸类型(数组元素为对象且含 1k/2k/4k 等键,对齐原 isSizeType) */
function isSizeType(value: unknown[]): boolean {
  if (value.length === 0) return false
  const first = value[0]
  if (first && typeof first === 'object' && !Array.isArray(first)) {
    return Object.keys(first as object).some((k) => k.toLowerCase().includes('k'))
  }
  return false
}

/** 计算动态变量初始值(对齐原 initSetVariables) */
function buildInitialValues(variables: ModelConfigVariable[]): Record<string, unknown> {
  const init: Record<string, unknown> = {}
  variables.forEach((v) => {
    if (isBooleanOption(v.value)) {
      init[v.name] = false
    } else if (isArrayOption(v.value) && (v.value as unknown[]).length > 0) {
      init[v.name] = (v.value as unknown[])[0]
    } else {
      init[v.name] = typeof v.value === 'string' || typeof v.value === 'number' ? v.value : ''
    }
  })
  return init
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="rounded-md active:opacity-60"
      style={{
        ...modelConfigChipInnerStyle(
          MODEL_CONFIG_CHIP_PAD_X_PX,
          MODEL_CONFIG_CHIP_PAD_Y_PX,
          toUnit,
        ),
        ...modelConfigChipItemMarginStyle(MODEL_CONFIG_CHIP_GAP_PX, toUnit),
        backgroundColor: active ? tokens.success.light : tokens.surface.muted,
      }}
    >
      <Text
        className="text-xs"
        style={{ color: active ? tokens.success.deepText : tokens.text.secondary }}
      >
        {label}
      </Text>
    </Pressable>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="mb-3">
      <Text
        className="text-xs font-medium"
        style={{
          ...modelConfigLabelGapStyle(MODEL_CONFIG_LABEL_GAP_PX, toUnit),
          color: tokens.text.tertiary,
        }}
      >
        {label}
      </Text>
      {children}
    </View>
  )
}

// ===== 动态配置项渲染(对齐原 index.vue 动态 v-for variables)=====

/** 尺寸 ratio 两级选择器(对齐原 index.vue type='ratio') */
function RatioSelector({
  options,
  value,
  onSelect,
}: {
  options: unknown[]
  value: unknown
  onSelect: (v: unknown) => void
}) {
  const [sizeIndex, setSizeIndex] = useState<number | null>(null)
  const { t } = useI18n()

  const sizeObj =
    sizeIndex !== null && sizeIndex >= 0 && sizeIndex < options.length
      ? (options[sizeIndex] as Record<string, unknown>)
      : null
  const sizeKey = sizeObj ? Object.keys(sizeObj)[0] : ''
  const ratioMap = sizeObj && sizeKey ? (sizeObj[sizeKey] as Record<string, string>) : null
  const selectedRatio =
    value && typeof value === 'object' ? ((value as { ratio?: string }).ratio ?? '') : ''

  // 第一级:选择尺寸(1k / 2k / 4k)
  if (!sizeObj) {
    return (
      <View className="flex-row flex-wrap">
        {options.map((opt, idx) => {
          const key =
            opt && typeof opt === 'object'
              ? (Object.keys(opt as object)[0] ?? String(opt))
              : String(opt)
          return (
            <Chip
              key={key}
              label={key}
              active={sizeIndex === idx}
              onPress={() => setSizeIndex(idx)}
            />
          )
        })}
      </View>
    )
  }

  // 第二级:选择比例
  return (
    <View>
      <View className="mb-1.5 flex-row items-center">
        <Pressable
          onPress={() => setSizeIndex(null)}
          className="mr-1.5 flex-row items-center rounded-md px-2.5 py-1.5 active:opacity-60"
          style={{ backgroundColor: tokens.surface.muted }}
          accessibilityLabel={t('common.back')}
        >
          <ChevronLeft size={MODEL_CONFIG_INLINE_GLYPH_PX} color={tokens.text.secondary} />
        </Pressable>
        <Text className="text-xs font-medium" style={{ color: tokens.text.tertiary }}>
          {sizeKey}
        </Text>
      </View>
      <View className="flex-row flex-wrap">
        {ratioMap
          ? Object.keys(ratioMap).map((ratio) => (
              <Chip
                key={ratio}
                label={`${ratio} (${ratioMap[ratio]})`}
                active={selectedRatio === ratio}
                onPress={() => onSelect({ size: sizeKey, ratio, resolution: ratioMap[ratio] })}
              />
            ))
          : null}
      </View>
    </View>
  )
}

function DynamicVariables({
  variables,
  isVideoModel,
}: {
  variables: ModelConfigVariable[]
  isVideoModel: boolean
}) {
  const { t } = useI18n()
  const [values, setValues] = useState<Record<string, unknown>>(() => buildInitialValues(variables))
  const valuesRef = useRef(values)
  valuesRef.current = values

  // 变量列表变化时重置(对齐原 modelInfo watch → parseModelInfo → initSetVariables)
  useEffect(() => {
    const next = buildInitialValues(variables)
    valuesRef.current = next
    setValues(next)
  }, [variables])

  const emit = (patch: Record<string, unknown>) => {
    const next = { ...valuesRef.current, ...patch }
    valuesRef.current = next
    setValues(next)
  }

  return (
    <>
      {variables
        .filter((v) => (VIDEO_ONLY_VARIABLES.includes(v.name) ? isVideoModel : true))
        .map((v) => {
          const cur = values[v.name]

          // 布尔选项 → 开关
          if (isBooleanOption(v.value)) {
            return (
              <Row key={v.name} label={v.desc}>
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs" style={{ color: tokens.text.secondary }}>
                    {cur ? t('profile.cfgEnabledOn') : t('profile.cfgEnabledOff')}
                  </Text>
                  <Switch
                    value={!!cur}
                    onValueChange={(nv) => emit({ [v.name]: nv })}
                    trackColor={{ false: tokens.border.light, true: tokens.brand.DEFAULT }}
                  />
                </View>
              </Row>
            )
          }

          const arr = isArrayOption(v.value) ? (v.value as unknown[]) : null

          // 数组选项 → 选择器(尺寸类型走 ratio 两级)
          if (arr && arr.length > 0) {
            if (isSizeType(arr)) {
              return (
                <Row key={v.name} label={v.desc}>
                  <RatioSelector
                    options={arr}
                    value={cur}
                    onSelect={(val) => emit({ [v.name]: val })}
                  />
                </Row>
              )
            }
            return (
              <Row key={v.name} label={v.desc}>
                <View className="flex-row flex-wrap">
                  {arr.map((opt) => {
                    const label =
                      opt && typeof opt === 'object' && !Array.isArray(opt)
                        ? ((opt as { desc?: string }).desc ?? String(opt))
                        : String(opt)
                    return (
                      <Chip
                        key={label}
                        label={label}
                        active={cur === opt}
                        onPress={() => emit({ [v.name]: cur === opt ? '' : opt })}
                      />
                    )
                  })}
                </View>
              </Row>
            )
          }

          // 其他 → 输入框
          return (
            <Row key={v.name} label={v.desc}>
              <TextField
                colorScheme={currentRnTheme()}
                value={String(cur ?? '')}
                onChangeText={(t) => emit({ [v.name]: t })}
                placeholder={t('modelConfig.inputPrefix', { desc: String(v.desc) })}
                className="rounded-sm text-xs"
                style={{
                  ...modelConfigInputBoxStyle(MODEL_CONFIG_INPUT_PAD_X_PX, toUnit),
                  backgroundColor: tokens.surface.muted,
                  color: tokens.text.primary,
                }}
              />
            </Row>
          )
        })}
    </>
  )
}

// ===== 主组件(变体分发)=====

export function ModelConfigDialog(props: ModelConfigDialogProps) {
  return <BasicModelConfigDialog {...props} />
}

export default ModelConfigDialog
// ===== 共享参数表单(2026-09-06 抽取消除 2×140 行克隆)=====

interface ModelParamsBodyProps {
  config: ModelConfig
  update: (patch: Partial<ModelConfig>) => void
  isImage: boolean
  isVideo: boolean
  isAudio: boolean
  isVideoModel: boolean
  voiceList: ReadonlyArray<{ id: string; name: string }>
  timbreOpen: boolean
  setTimbreOpen: (v: boolean | ((prev: boolean) => boolean)) => void
  variables: ModelConfigVariable[]
}

/** 基础参数 + 图片/视频/音色条件参数 + 动态配置项 */
function ModelParamsBody(props: ModelParamsBodyProps) {
  const {
    config,
    update,
    isImage,
    isVideo,
    isAudio,
    isVideoModel,
    voiceList,
    timbreOpen,
    setTimbreOpen,
    variables,
  } = props
  const { t } = useI18n()

  useUiTextField({
    label: 'Temperature',
    value: String(config.temperature),
    setValue: (v) => update({ temperature: Number(v) || 0 }),
    keyboardType: 'numeric',
  })
  useUiTextField({
    label: 'Max Tokens',
    value: String(config.maxTokens),
    setValue: (v) => update({ maxTokens: Number(v) || 0 }),
    keyboardType: 'numeric',
  })
  useUiTextField({
    label: 'Top P',
    value: String(config.topP),
    setValue: (v) => update({ topP: Number(v) || 0 }),
    keyboardType: 'numeric',
  })
  useUiTextField({
    label: t('profile.cfgSysPromptPh'),
    value: config.systemPrompt,
    setValue: (v) => update({ systemPrompt: v }),
    multiline: true,
  })

  return (
    <>
      <Row label="Temperature">
        <View className="flex-row items-center">
          <TextField
            colorScheme={currentRnTheme()}
            value={String(config.temperature)}
            keyboardType="numeric"
            onChangeText={(v) => update({ temperature: Number(v) || 0 })}
            className="mr-2 flex-1 rounded-sm text-xs"
            style={{
              ...modelConfigInputBoxStyle(MODEL_CONFIG_INPUT_PAD_X_PX, toUnit),
              backgroundColor: tokens.surface.muted,
              color: tokens.text.primary,
            }}
          />
          <Text className="text-xs" style={{ color: tokens.text.tertiary }}>
            0.0 - 2.0
          </Text>
        </View>
      </Row>

      <Row label="Max Tokens">
        <TextField
          colorScheme={currentRnTheme()}
          value={String(config.maxTokens)}
          keyboardType="numeric"
          onChangeText={(v) => update({ maxTokens: Number(v) || 0 })}
          className="rounded-sm text-xs"
          style={{
            ...modelConfigInputBoxStyle(MODEL_CONFIG_INPUT_PAD_X_PX, toUnit),
            backgroundColor: tokens.surface.muted,
            color: tokens.text.primary,
          }}
        />
      </Row>

      <Row label="Top P">
        <TextField
          colorScheme={currentRnTheme()}
          value={String(config.topP)}
          keyboardType="numeric"
          onChangeText={(v) => update({ topP: Number(v) || 0 })}
          className="rounded-sm text-xs"
          style={{
            ...modelConfigInputBoxStyle(MODEL_CONFIG_INPUT_PAD_X_PX, toUnit),
            backgroundColor: tokens.surface.muted,
            color: tokens.text.primary,
          }}
        />
      </Row>

      <Row label="System Prompt">
        <TextField
          colorScheme={currentRnTheme()}
          value={config.systemPrompt}
          onChangeText={(v) => update({ systemPrompt: v })}
          placeholder={t('profile.cfgSysPromptPh')}
          multiline
          className="min-h-[60px] rounded-sm p-2 text-xs"
          style={{ backgroundColor: tokens.surface.muted, color: tokens.text.primary }}
        />
      </Row>

      <Row label="Stream">
        <View className="flex-row items-center justify-between">
          <Text className="text-xs" style={{ color: tokens.text.secondary }}>
            {config.streamEnabled ? t('profile.cfgEnabledOn') : t('profile.cfgEnabledOff')}
          </Text>
          <Switch
            value={config.streamEnabled}
            onValueChange={(v) => update({ streamEnabled: v })}
            trackColor={{ false: tokens.border.light, true: tokens.brand.DEFAULT }}
          />
        </View>
      </Row>

      {isImage ? (
        <>
          <Row label={t('profile.cfgImgRatio')}>
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

          <Row label={t('profile.cfgImgRes')}>
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
        <Row label={t('profile.cfgVideoFrames')}>
          <View className="flex-row flex-wrap">
            {FRAME_COUNTS.map((f) => (
              <Chip
                key={f}
                label={t('modelConfig.framesUnit', { n: f })}
                active={config.frameCount === f}
                onPress={() => update({ frameCount: f })}
              />
            ))}
          </View>
        </Row>
      ) : null}

      {isAudio ? (
        <Row label={t('profile.cfgTimbre')}>
          <Pressable
            onPress={() => setTimbreOpen((v) => !v)}
            className="rounded-md px-2.5 py-2 active:opacity-60"
            style={{ backgroundColor: tokens.surface.muted }}
          >
            <Text className="text-xs" style={{ color: tokens.text.primary }}>
              {voiceList.find((x) => x.id === config.timbre)?.name ?? t('profile.cfgTimbrePick')}
            </Text>
          </Pressable>
          {timbreOpen ? (
            <View
              className="mt-1.5 rounded-md border p-1"
              style={{ borderColor: tokens.border.light, backgroundColor: tokens.surface.card }}
            >
              {voiceList.map((tb) => (
                <Tappable
                  key={tb.id}
                  onPress={() => {
                    update({ timbre: tb.id })
                    setTimbreOpen(false)
                  }}
                  className="rounded-md px-2.5 py-2"
                >
                  <Text
                    className="text-xs"
                    style={{
                      color:
                        config.timbre === tb.id ? tokens.success.deepText : tokens.text.secondary,
                    }}
                  >
                    {tb.name}
                  </Text>
                </Tappable>
              ))}
            </View>
          ) : null}
        </Row>
      ) : null}

      {/* 动态配置项(对齐原 index.vue variables) */}
      <DynamicVariables variables={variables} isVideoModel={isVideoModel} />
    </>
  )
}

// ===== index 变体(基础模型配置)=====

function BasicModelConfigDialog({
  visible,
  modelType = 'text',
  config,
  onChange,
  onClose,
  variables = [],
  systemVoices,
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
  // 视频模型:动态变量里的视频特有项才显示
  const isVideoModel = isVideo
  // 系统音色:优先用父组件注入(对齐原 fetchSystemVoices),否则用内置默认列表
  const voiceList =
    systemVoices && systemVoices.length > 0
      ? systemVoices
      : TIMBRES.map((tb) => ({ id: tb.id, name: t(tb.nameKey) }))

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity className="flex-1 bg-black/20" activeOpacity={1} onPress={onClose}>
        <View className="mt-auto" style={{ backgroundColor: tokens.surface.card }}>
          <View className="flex-row items-center justify-between px-4 py-3">
            <Text className="text-sm font-semibold" style={{ color: tokens.text.primary }}>
              {t('agent.config')}
            </Text>
            <Tappable onPress={onClose} hitSlop={8}>
              <Text className="text-xs" style={{ color: tokens.text.tertiary }}>
                {t('common.cancel')}
              </Text>
            </Tappable>
          </View>

          <ScrollView className="max-h-[60%] px-4 pb-2">
            <ModelParamsBody
              config={config}
              update={update}
              isImage={isImage}
              isVideo={isVideo}
              isAudio={isAudio}
              isVideoModel={isVideoModel}
              voiceList={voiceList}
              timbreOpen={timbreOpen}
              setTimbreOpen={setTimbreOpen}
              variables={variables}
            />
          </ScrollView>

          <View className="flex-row gap-2 px-4 pb-4 pt-2">
            <Pressable
              onPress={onClose}
              className="flex-1 items-center rounded-md py-2.5 active:opacity-60"
              style={{ backgroundColor: tokens.surface.muted }}
            >
              <Text className="text-xs" style={{ color: tokens.text.secondary }}>
                {t('common.cancel')}
              </Text>
            </Pressable>
            <Pressable
              onPress={onClose}
              className="flex-1 items-center rounded-md py-2.5 active:opacity-60"
              style={{ backgroundColor: tokens.success.DEFAULT }}
            >
              <Text className="text-xs text-white">{t('common.save')}</Text>
            </Pressable>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  )
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
