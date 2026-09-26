// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * BottomActionBar 底部操作栏 (mobile-rn 端)
 *
 * 对齐历史 Uniapp BottomActionBar.vue(25+ 事件回调):
 * - 兼容旧 API:actions(简单按钮列表,LabelButton/IconButton 渲染)
 * - 新 API:聊天输入模式(prompt 提供),渲染完整 Uniapp 对齐 UI:
 *   + 模型信息条(onShowModelList / onShowModelConfig / onModelConfigChange)
 *   + ToggleButtonGroup(5 开关:onToggleSuperAgent/Agentfu/Mcp/KnowledgeBase/PermanentMemory)
 *   + 图片预览行(onRemoveImage(index))
 *   + InputArea(TextInput + 语音 + 发送:onPromptChange/onInputFocus/Blur/Click/onSend/onTextareaHeightChange)
 *   + 辅助按钮行(onFunctionHandle / onSourceHandle / onFangda)
 *   + IconButtonGroup(相机/相册/文件/微信文件:onIconClick(type))
 *   + 键盘监听(onKeyboardShow / onKeyboardHide)
 *   + 语音动画(onStartVoiceAnimation / onStopVoiceAnimation via voiceInputEnabled)
 *   + 长按手势(onStartLongPress / onEndLongPress on voice button)
 * - 固定底部 100% 屏宽,SafeArea padding
 * - 浅色优雅风,无霓虹 / 无渐变,系统字体
 * - AGENTS.md §3:禁 any,onModelConfigChange 用 unknown 类型
 */
import { useEffect, useRef } from 'react'
import { tokens } from '../theme/active-tokens'
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageStyle,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useI18n } from '../i18n'
import { useUiTextField } from '../lib/use-ui-text-field'
import { AddPanel, PlusButton } from './AddPanel'
import {
  Camera,
  ChevronDown,
  Folder,
  Image as ImageIcon,
  Maximize,
  MessageCircle,
  Mic,
  Paperclip,
  Scissors,
  Settings,
} from 'lucide-react-native'

import { rnGeometry, rnRadius } from '@ihui/design-tokens'
import {
  BOTTOM_ACTION_BAR_CHIP_FONT_PX,
  BOTTOM_ACTION_BAR_CHIP_ROW_GAP_PX,
  BOTTOM_ACTION_BAR_MODEL_BAR_FONT_PX,
  BOTTOM_ACTION_BAR_TEXT_FONT_PX,
} from '@ihui/shared/ui/bottom-action-bar-spec'

// ── 兼容旧 API:简单按钮列表 ──

export interface BottomActionBarAction {
  key: string
  label?: string
  icon?: string
  primary?: boolean
  onPress: () => void
  disabled?: boolean
  loading?: boolean
}

/** 图标按钮组点击来源(对齐 Uniapp handleIconClick(type):camera/album/file/wxfile) */
export type BottomActionBarIconType = 'camera' | 'album' | 'file' | 'wxfile'

// ── 新 API:25+ 事件回调 + 状态 ──

export interface BottomActionBarProps {
  /** 兼容旧 API:简单按钮列表。提供时渲染 LabelButton/IconButton 行 */
  actions?: ReadonlyArray<BottomActionBarAction>
  /** 新 API:聊天输入模式。提供 prompt(含空串)时切换到完整聊天输入 UI */
  prompt?: string
  onPromptChange?: (text: string) => void
  onSend?: () => void

  // ── 25+ 事件回调(全部可选,对齐 Uniapp BottomActionBar.vue emit) ──
  onToggleSuperAgent?: () => void
  onToggleSuperAgentfu?: () => void
  onToggleMcp?: () => void
  onToggleKnowledgeBase?: () => void
  onTogglePermanentMemory?: () => void
  onToggleVoiceInput?: () => void
  onRemoveImage?: (index: number) => void
  onStartLongPress?: () => void
  onEndLongPress?: () => void
  onInputFocus?: () => void
  onInputBlur?: () => void
  onInputClick?: () => void
  onStartVoiceAnimation?: () => void
  onStopVoiceAnimation?: () => void
  onFunctionHandle?: () => void
  onSourceHandle?: () => void
  /** 添加附件回调(📁 按钮;不传时降级为占位提示 Alert) */
  onAddFile?: () => void
  onIconClick?: (type: BottomActionBarIconType) => void
  onShowModelConfig?: () => void
  onTextareaHeightChange?: (height: number) => void
  onModelConfigChange?: (config: unknown) => void
  onFangda?: () => void
  /** 手动压缩上下文回调(✂ 图标按钮,渲染在辅助按钮行;未传时不渲染) */
  onCompactContext?: () => void
  /** 压缩请求进行中(按钮切 loading 态并禁用,防重复点击) */
  compactContextLoading?: boolean
  /** 输入行内「+」按钮回调(对齐 Uniapp InputArea search-box2:functionHandle → isShowIcon 切换。
   *  提供后在发送按钮左侧渲染「+」;未提供时不渲染。滑出区(辅助行 + 图标按钮组)由 isShowIcon 驱动) */
  onPlusToggle?: () => void
  /** 「+」按钮激活态(与 isShowIcon 同源:滑出区展开时高亮 + 旋转 45°,对齐 Uniapp rotate-icon) */
  plusActive?: boolean
  onKeyboardShow?: () => void
  onKeyboardHide?: () => void
  onShowModelList?: () => void

  // ── 开关状态 ──
  superAgentEnabled?: boolean
  mcpEnabled?: boolean
  knowledgeBaseEnabled?: boolean
  permanentMemoryEnabled?: boolean
  voiceInputEnabled?: boolean
  /** Toggle 开关行(智能体/MCP/知识库/记忆 chips)是否渲染。
   *  对齐历史 uniapp ToggleButtonGroup.vue 根节点 v-if="false":默认隐藏,显式传 true 才渲染 */
  showToggleChips?: boolean

  // ── UI 扩展(功能对齐所需) ──
  /** 图片预览列表(绑定 onRemoveImage)*/
  images?: ReadonlyArray<string>
  /** 当前模型名(显示在模型信息条)*/
  modelName?: string
  /** 加载中(发送按钮 loading)*/
  isLoading?: boolean
  /** 显示图标按钮组(相机/相册/文件)*/
  isShowIcon?: boolean
}

// ── 常量 ──
//
// 与小程序端**同一元素**的档一律从共享源取数(出处注释写在对应行上):
//  - 字号 → `@ihui/shared/ui/bottom-action-bar-spec`(裁决依据写在该文件里)
//  - 命中方块 → `rnGeometry.tapBox`(design-tokens 几何表,与 web 顶栏 `w-9` 同档)
//  - 圆角 → `rnRadius.*`(守门 77 的单一源,本文件不存第三个圆角数字)
// 端内仍写数字的两类都不属"两端各写一份同一元素":
//  - 小程序端本文件里没有对应元素(图片预览行、模型条高与配置按钮、发送胶囊宽、旧模式按钮方块),
//    或不是尺寸(letterSpacing 0.2);
//  - 容器/行级 padding 与 gap:两端切分不同(RN 逐属性、小程序 CSS 简写串),强行配对会把一次
//    定档变成多次裁决 —— 逐条理由写在共享 spec 的头注里,不得为读数好看硬凑。

const CONTAINER_PADDING_HORIZONTAL = 12
const CONTAINER_PADDING_VERTICAL = 4
const ROW_GAP = 12
const COLUMN_GAP = 8

const ACTION_BUTTON_HEIGHT = 44
/** 旧模式文字按钮字号:与输入框同一档,取共享源(原 15 不在 design-tokens 字号档上)。 */
const ACTION_BUTTON_FONT_SIZE = BOTTOM_ACTION_BAR_TEXT_FONT_PX
const ICON_BUTTON_SIZE = 44
const ICON_BUTTON_EMOJI_SIZE = 18
const ICON_BUTTON_BORDER_RADIUS = ICON_BUTTON_SIZE / 2 // radius-exempt: 图标按钮几何正圆(44dp 直径/2)
/** 字距不是尺寸(守门 128 因键名含 spacing 会把它计入读数),不进几何表,登记为读数噪音。 */
const LABEL_LETTER_SPACING = 0.2

const TOGGLE_CHIP_HEIGHT = 32
/** chip 文字字号:两端同值档,取共享源(小程序端 chip 本就是 14,RN 原 13 就近吸附)。 */
const TOGGLE_CHIP_FONT_SIZE = BOTTOM_ACTION_BAR_CHIP_FONT_PX
// chip 行间距不在本文件取数 —— 唯一源是 @ihui/shared/ui/bottom-action-bar-spec(与小程序端同档)
const TOGGLE_CHIP_LETTER_SPACING = 0.2

const INPUT_MIN_HEIGHT = 44
const INPUT_BORDER_RADIUS = rnRadius['2xl'] // 原 15,R1 吸附至 2xl(16)
/** 输入框字号:与小程序默认变体的 `text-sm` 同档,取共享源。 */
const INPUT_FONT_SIZE = BOTTOM_ACTION_BAR_TEXT_FONT_PX
const INPUT_PADDING_HORIZONTAL = 12
const INPUT_MAX_HEIGHT = 100 // 多行输入的自然生长上限(键盘避让下的可视高度),非布局档,两端不同形

const SEND_BTN_WIDTH = 56
const SEND_BTN_HEIGHT = 44

/** 语音按钮命中方块:取共享几何表档(小程序端本文件里没有这枚方块)。 */
const VOICE_BTN_SIZE = rnGeometry.tapBox

/** 辅助按钮命中方块:同上,tapBox 档。 */
const SECONDARY_BTN_SIZE = rnGeometry.tapBox
const SECONDARY_BTN_EMOJI_SIZE = 18

/** 图标按钮组标准项(相机/相册/本地文件/微信文件,对齐 Uniapp isShowIcon 图标组;
 *  面板渲染统一走共享 AddPanel,此处仅声明项定义) */
const ICON_GROUP_ITEMS: ReadonlyArray<{
  type: BottomActionBarIconType
  label: string
  Icon: typeof Camera
}> = [
  { type: 'camera', label: '相机', Icon: Camera },
  { type: 'album', label: '相册', Icon: ImageIcon },
  { type: 'file', label: '本地文件', Icon: Folder },
  { type: 'wxfile', label: '微信文件', Icon: MessageCircle },
]

// 图片预览行:小程序端本文件里没有这一行(该端预览在 InputArea)—— 这些档无对照,保留端内。
const IMAGE_PREVIEW_SIZE = 48
const IMAGE_REMOVE_SIZE = 16

// 模型条高度与配置按钮方块:小程序端模型条无固定高、也没有配置按钮 —— 同上,无对照。
const MODEL_BAR_HEIGHT = 28
/** 模型提示条字号:两端原值(小程序 10 / RN 13)都不在字号档上,公共吸附档 = 12,取共享源。 */
const MODEL_BAR_FONT_SIZE = BOTTOM_ACTION_BAR_MODEL_BAR_FONT_PX

const EMPTY_ACTIONS: ReadonlyArray<BottomActionBarAction> = []

export function BottomActionBar(props: BottomActionBarProps) {
  // 新模式:聊天输入(prompt 提供,含空串)
  if (props.prompt !== undefined) {
    return <ChatInputBar {...props} />
  }
  // 旧模式:简单按钮列表(actions)
  return <SimpleButtonBar actions={props.actions ?? EMPTY_ACTIONS} />
}

// ── 旧模式:简单按钮列表(保持原渲染逻辑) ──

interface SimpleButtonBarProps {
  actions: ReadonlyArray<BottomActionBarAction>
}

function SimpleButtonBar({ actions }: SimpleButtonBarProps) {
  const insets = useSafeAreaInsets()

  return (
    <View
      style={[
        styles.container,
        styles.rowMode,
        { paddingBottom: CONTAINER_PADDING_VERTICAL + insets.bottom },
      ]}
    >
      {actions.map((action) => (
        <BottomActionBarItem key={action.key} action={action} />
      ))}
    </View>
  )
}

interface BottomActionBarItemProps {
  action: BottomActionBarAction
}

function BottomActionBarItem({ action }: BottomActionBarItemProps) {
  const isIconOnly = action.icon !== undefined && action.label === undefined

  if (isIconOnly) {
    return <IconButton action={action} />
  }
  return <LabelButton action={action} />
}

function LabelButton({ action }: BottomActionBarItemProps) {
  const isPrimary = action.primary === true
  const isDisabled = action.disabled === true
  const isLoading = action.loading === true

  const handlePress = () => {
    if (!isDisabled && !isLoading) {
      action.onPress()
    }
  }

  const baseStyle: ViewStyle = isPrimary ? styles.primaryButton : styles.secondaryButton
  const pressedStyle: ViewStyle = isPrimary
    ? styles.primaryButtonPressed
    : styles.secondaryButtonPressed
  const disabledStyle: ViewStyle = styles.buttonDisabled

  const labelStyle: TextStyle = isPrimary ? styles.primaryButtonLabel : styles.secondaryButtonLabel

  const style = ({ pressed }: { pressed: boolean }): StyleProp<ViewStyle> => [
    baseStyle,
    pressed && !isDisabled && !isLoading ? pressedStyle : null,
    isDisabled || isLoading ? disabledStyle : null,
  ]

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled || isLoading}
      accessibilityRole="button"
      accessibilityLabel={action.label}
      accessibilityState={{ disabled: isDisabled, busy: isLoading }}
      style={style}
    >
      {isLoading ? (
        <ActivityIndicator
          size="small"
          color={isPrimary ? tokens.surface.light : tokens.text.primary}
        />
      ) : (
        <Text style={labelStyle} numberOfLines={1}>
          {action.label}
        </Text>
      )}
    </Pressable>
  )
}

function IconButton({ action }: BottomActionBarItemProps) {
  const isDisabled = action.disabled === true
  const isLoading = action.loading === true
  const icon = action.icon ?? ''

  const handlePress = () => {
    if (!isDisabled && !isLoading) {
      action.onPress()
    }
  }

  const style = ({ pressed }: { pressed: boolean }): StyleProp<ViewStyle> => [
    styles.iconButton,
    pressed && !isDisabled && !isLoading ? styles.iconButtonPressed : null,
    isDisabled || isLoading ? styles.buttonDisabled : null,
  ]

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled || isLoading}
      accessibilityRole="button"
      accessibilityLabel={action.label}
      accessibilityState={{ disabled: isDisabled, busy: isLoading }}
      style={style}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color={tokens.text.primary} />
      ) : (
        <Text style={styles.iconButtonEmoji} allowFontScaling={false}>
          {icon}
        </Text>
      )}
    </Pressable>
  )
}

// ── 新模式:聊天输入栏(25+ 事件绑定) ──

interface ToggleChipConfig {
  key: string
  label: string
  active: boolean
  onPress: (() => void) | undefined
}

function ChatInputBar(props: BottomActionBarProps) {
  const { t } = useI18n()
  const {
    prompt = '',
    onPromptChange,
    onSend,
    onToggleSuperAgent,
    onToggleSuperAgentfu,
    onToggleMcp,
    onToggleKnowledgeBase,
    onTogglePermanentMemory,
    onToggleVoiceInput,
    onRemoveImage,
    onStartLongPress,
    onEndLongPress,
    onInputFocus,
    onInputBlur,
    onInputClick,
    onStartVoiceAnimation,
    onStopVoiceAnimation,
    onFunctionHandle,
    onSourceHandle,
    onAddFile,
    onIconClick,
    onShowModelConfig,
    onTextareaHeightChange,
    onModelConfigChange,
    onFangda,
    onCompactContext,
    compactContextLoading = false,
    onPlusToggle,
    plusActive = false,
    onKeyboardShow,
    onKeyboardHide,
    onShowModelList,
    superAgentEnabled = false,
    mcpEnabled = false,
    knowledgeBaseEnabled = false,
    permanentMemoryEnabled = false,
    voiceInputEnabled = false,
    showToggleChips = false,
    images,
    modelName,
    isLoading = false,
    isShowIcon = false,
  } = props
  useUiTextField({
    label: t('chat.inputPlaceholder'),
    value: prompt,
    setValue: onPromptChange,
    multiline: true,
    disabled: isLoading,
  })

  const insets = useSafeAreaInsets()
  const prevVoiceEnabled = useRef(false)

  // 键盘监听:keyboardDidShow / keyboardDidHide
  useEffect(() => {
    if (onKeyboardShow === undefined && onKeyboardHide === undefined) return
    const showSub = Keyboard.addListener('keyboardDidShow', () => onKeyboardShow?.())
    const hideSub = Keyboard.addListener('keyboardDidHide', () => onKeyboardHide?.())
    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [onKeyboardShow, onKeyboardHide])

  // 语音动画:start/stop(voiceInputEnabled 状态变化触发)
  useEffect(() => {
    if (voiceInputEnabled && !prevVoiceEnabled.current) {
      onStartVoiceAnimation?.()
    }
    if (!voiceInputEnabled && prevVoiceEnabled.current) {
      onStopVoiceAnimation?.()
    }
    prevVoiceEnabled.current = voiceInputEnabled
  }, [voiceInputEnabled, onStartVoiceAnimation, onStopVoiceAnimation])

  const allChips: ReadonlyArray<ToggleChipConfig> = [
    { key: 'super-agent', label: '智能体', active: superAgentEnabled, onPress: onToggleSuperAgent },
    { key: 'super-agentfu', label: '智能体辅', active: false, onPress: onToggleSuperAgentfu },
    { key: 'mcp', label: 'MCP', active: mcpEnabled, onPress: onToggleMcp },
    {
      key: 'knowledge-base',
      label: '知识库',
      active: knowledgeBaseEnabled,
      onPress: onToggleKnowledgeBase,
    },
    {
      key: 'permanent-memory',
      label: '记忆',
      active: permanentMemoryEnabled,
      onPress: onTogglePermanentMemory,
    },
  ]
  const visibleChips = allChips.filter(
    (chip): chip is ToggleChipConfig & { onPress: () => void } => chip.onPress !== undefined,
  )

  const showModelBar =
    modelName !== undefined || onShowModelList !== undefined || onShowModelConfig !== undefined
  // 滑出区联动(对齐 Uniapp isShowIcon):辅助按钮行与图标按钮组都随「+」展开/收起,默认隐藏
  const showSecondaryRow =
    isShowIcon &&
    (onFunctionHandle !== undefined ||
      onSourceHandle !== undefined ||
      onFangda !== undefined ||
      onCompactContext !== undefined ||
      onAddFile !== undefined)
  const showIconGroup = isShowIcon && onIconClick !== undefined

  return (
    <View
      style={[
        styles.container,
        styles.columnMode,
        { paddingBottom: CONTAINER_PADDING_VERTICAL + insets.bottom },
      ]}
    >
      {/* 模型信息条 */}
      {showModelBar ? (
        <View style={styles.modelBar}>
          {modelName !== undefined || onShowModelList !== undefined ? (
            <Pressable
              style={styles.modelNameBtn}
              onPress={onShowModelList}
              onLongPress={
                onModelConfigChange !== undefined
                  ? () => onModelConfigChange({ trigger: 'model-name-longpress' })
                  : undefined
              }
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={`模型: ${modelName ?? '选择模型'}`}
            >
              <Text style={styles.modelNameLabel} numberOfLines={1}>
                {modelName ?? '选择模型'}
              </Text>
              <ChevronDown size={10} color={tokens.text.tertiary} />
            </Pressable>
          ) : null}
          {onShowModelConfig !== undefined ? (
            <Pressable
              style={styles.configBtn}
              onPress={onShowModelConfig}
              onLongPress={
                onModelConfigChange !== undefined
                  ? () => onModelConfigChange({ trigger: 'config-longpress' })
                  : undefined
              }
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel="模型配置"
            >
              <Settings size={16} color={tokens.text.secondary} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* Toggle chips 行(对齐历史 uniapp ToggleButtonGroup v-if="false":默认隐藏,显式开启才渲染) */}
      {showToggleChips && visibleChips.length > 0 ? (
        <View style={styles.toggleRow}>
          {visibleChips.map((chip) => (
            <ToggleChip
              key={chip.key}
              label={chip.label}
              active={chip.active}
              onPress={chip.onPress}
            />
          ))}
        </View>
      ) : null}

      {/* 图片预览行 */}
      {images !== undefined && images.length > 0 ? (
        <View style={styles.imageRow}>
          {images.map((uri, index) => (
            <View key={index} style={styles.imagePreview}>
              <Image source={{ uri }} style={styles.imagePreviewImg} resizeMode="cover" />
              {onRemoveImage !== undefined ? (
                <Pressable
                  style={styles.imageRemoveBtn}
                  onPress={() => onRemoveImage(index)}
                  hitSlop={4}
                  accessibilityRole="button"
                  accessibilityLabel="删除图片"
                >
                  <Text style={styles.imageRemoveIcon}>{'×'}</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {/* 输入行:语音 + TextInput + 发送 */}
      <View style={styles.inputRow}>
        {onToggleVoiceInput !== undefined ? (
          <Pressable
            style={[styles.voiceBtn, voiceInputEnabled ? styles.voiceBtnActive : null]}
            onPress={onToggleVoiceInput}
            onLongPress={onStartLongPress}
            onPressOut={onEndLongPress}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel="语音输入"
          >
            <Mic size={18} color={tokens.text.secondary} />
          </Pressable>
        ) : null}

        <TextInput
          style={styles.input}
          value={prompt}
          onChangeText={onPromptChange}
          onFocus={onInputFocus}
          onBlur={onInputBlur}
          onTouchStart={() => onInputClick?.()}
          onContentSizeChange={(e) => {
            onTextareaHeightChange?.(e.nativeEvent.contentSize.height)
          }}
          placeholder={t('chat.inputPlaceholder')}
          placeholderTextColor={tokens.text.tertiary}
          multiline
          editable={!isLoading}
        />

        {/* 「+」按钮(对齐 Uniapp InputArea search-box2:functionHandle → isShowIcon 切换滑出区;
            视觉统一走共享 PlusButton,面板统一走共享 AddPanel) */}
        {onPlusToggle !== undefined ? (
          <PlusButton active={plusActive} onPress={onPlusToggle} />
        ) : null}

        {onSend !== undefined ? (
          <Pressable
            style={[styles.sendBtn, isLoading ? styles.sendBtnDisabled : null]}
            onPress={onSend}
            disabled={isLoading}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={isLoading ? '加载中' : '发送'}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={tokens.brand.ctaForeground} />
            ) : (
              <Text style={styles.sendLabel} numberOfLines={1}>
                {'发送'}
              </Text>
            )}
          </Pressable>
        ) : null}
      </View>

      {/* 辅助按钮行:附件 / ƒ / 📎 / ⛶ */}
      {showSecondaryRow ? (
        <View style={styles.secondaryRow}>
          {/* 添加附件(ChatScreen 传入 onAddFile → DocumentPicker + uploadFileMultipart 真实上传;
              未传 onAddFile 时降级为占位提示 Alert,保持向后兼容) */}
          <Pressable
            style={styles.addFileBtn}
            onPress={() => {
              if (onAddFile) {
                onAddFile()
              } else {
                Alert.alert(
                  t('messageInput.addFile'),
                  `${t('messageInput.document')} / ${t('messageInput.video')} 等附件选择功能待接入`,
                )
              }
            }}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={t('messageInput.addFile')}
          >
            <Folder size={18} color={tokens.text.secondary} />
          </Pressable>
          {onFunctionHandle !== undefined ? (
            <Pressable
              style={styles.secondaryBtn}
              onPress={onFunctionHandle}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel="功能"
            >
              <Text style={styles.secondaryEmoji} allowFontScaling={false}>
                {'ƒ'}
              </Text>
            </Pressable>
          ) : null}
          {onSourceHandle !== undefined ? (
            <Pressable
              style={styles.secondaryBtn}
              onPress={onSourceHandle}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel="来源"
            >
              <Paperclip size={18} color={tokens.text.secondary} />
            </Pressable>
          ) : null}
          {onFangda !== undefined ? (
            <Pressable
              style={styles.secondaryBtn}
              onPress={onFangda}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel="放大"
            >
              <Maximize size={18} color={tokens.text.secondary} />
            </Pressable>
          ) : null}
          {/* 手动压缩上下文(2026-09-02 立,对齐 web 端 message-input compactButton):
              ✂ 图标 + loading 态(ActivityIndicator),请求中禁用防重复点击 */}
          {onCompactContext !== undefined ? (
            <Pressable
              style={styles.secondaryBtn}
              onPress={onCompactContext}
              disabled={compactContextLoading}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={t('messageInput.compactButton')}
              accessibilityState={{ busy: compactContextLoading }}
            >
              {compactContextLoading ? (
                <ActivityIndicator size="small" color={tokens.text.secondary} />
              ) : (
                <Scissors size={18} color={tokens.text.secondary} />
              )}
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* 图标按钮组:相机 / 相册 / 本地文件 / 微信文件(统一走共享 AddPanel 底部滑出面板;
          onIconClick('camera'|'album'|'file'|'wxfile') 契约不变,ChatScreen/AssistantScreen 零改动)。
          24 是面板项图标墨迹档 —— 小程序端的同一功能是内联 PNG 卡(另一枚布局角色),
          两端配对要到 AddPanel 那一票一并裁,本票不在此单独立档。 */}
      {onIconClick !== undefined ? (
        <AddPanel
          visible={showIconGroup}
          onClose={() => onPlusToggle?.()}
          items={ICON_GROUP_ITEMS.map((item) => ({
            key: item.type,
            label: item.label,
            icon: <item.Icon size={24} color={tokens.text.secondary} />,
            onPress: () => onIconClick(item.type),
          }))}
        />
      ) : null}
    </View>
  )
}

// ── ToggleChip 子组件 ──

interface ToggleChipProps {
  label: string
  active: boolean
  onPress: () => void
}

function ToggleChip({ label, active, onPress }: ToggleChipProps) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.toggleChip,
        active ? styles.toggleChipActive : null,
        pressed ? styles.toggleChipPressed : null,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
    >
      <Text
        style={[styles.toggleChipLabel, active ? styles.toggleChipLabelActive : null]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  )
}

// ── 样式 ──

const styles = StyleSheet.create({
  // ── 容器(共用) ──
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    paddingHorizontal: CONTAINER_PADDING_HORIZONTAL,
    paddingTop: CONTAINER_PADDING_VERTICAL,
    backgroundColor: tokens.surface.card,
    borderTopWidth: 1,
    borderTopColor: tokens.border.light,
  } as ViewStyle,
  rowMode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ROW_GAP,
  } as ViewStyle,
  columnMode: {
    flexDirection: 'column',
    gap: COLUMN_GAP,
  } as ViewStyle,

  // ── 旧模式:按钮样式 ──
  primaryButton: {
    flex: 1,
    height: ACTION_BUTTON_HEIGHT,
    borderRadius: rnRadius.lg,
    backgroundColor: tokens.brand.cta,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  primaryButtonPressed: {
    opacity: 0.8,
  } as ViewStyle,
  primaryButtonLabel: {
    fontSize: ACTION_BUTTON_FONT_SIZE,
    lineHeight: ACTION_BUTTON_FONT_SIZE + 4,
    fontWeight: '500',
    letterSpacing: LABEL_LETTER_SPACING,
    color: tokens.brand.ctaForeground,
    textAlign: 'center',
  } as TextStyle,
  secondaryButton: {
    flex: 1,
    height: ACTION_BUTTON_HEIGHT,
    borderRadius: rnRadius.lg,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  secondaryButtonPressed: {
    backgroundColor: tokens.surface.muted,
  } as ViewStyle,
  secondaryButtonLabel: {
    fontSize: ACTION_BUTTON_FONT_SIZE,
    lineHeight: ACTION_BUTTON_FONT_SIZE + 4,
    fontWeight: '500',
    letterSpacing: LABEL_LETTER_SPACING,
    color: tokens.text.primary,
    textAlign: 'center',
  } as TextStyle,
  iconButton: {
    width: ICON_BUTTON_SIZE,
    height: ICON_BUTTON_SIZE,
    borderRadius: ICON_BUTTON_BORDER_RADIUS,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  iconButtonPressed: {
    backgroundColor: tokens.surface.muted,
  } as ViewStyle,
  iconButtonEmoji: {
    fontSize: ICON_BUTTON_EMOJI_SIZE,
    lineHeight: ICON_BUTTON_EMOJI_SIZE + 2,
    textAlign: 'center',
  } as TextStyle,
  buttonDisabled: {
    opacity: 0.5,
  } as ViewStyle,

  // ── 新模式:模型信息条 ──
  modelBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: MODEL_BAR_HEIGHT,
  } as ViewStyle,
  modelNameBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  } as ViewStyle,
  modelNameLabel: {
    fontSize: MODEL_BAR_FONT_SIZE,
    color: tokens.text.secondary,
    // 200 是文本截断上限(内容自适应,不是布局档),与小程序端"整行 flex 换行"是两种机制 —— 不同形
    maxWidth: 200,
  } as TextStyle,
  modelArrow: {
    fontSize: 10,
    color: tokens.text.tertiary,
  } as TextStyle,
  configBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  configEmoji: {
    fontSize: 16,
    lineHeight: 20,
  } as TextStyle,

  // ── 新模式:Toggle chips ──
  toggleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: BOTTOM_ACTION_BAR_CHIP_ROW_GAP_PX,
  } as ViewStyle,
  toggleChip: {
    height: TOGGLE_CHIP_HEIGHT,
    paddingHorizontal: 10,
    borderRadius: rnRadius.md,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  toggleChipActive: {
    backgroundColor: tokens.brand.cta,
    borderColor: tokens.brandAccent.deep,
  } as ViewStyle,
  toggleChipPressed: {
    opacity: 0.8,
  } as ViewStyle,
  toggleChipLabel: {
    fontSize: TOGGLE_CHIP_FONT_SIZE,
    fontWeight: '500',
    letterSpacing: TOGGLE_CHIP_LETTER_SPACING,
    color: tokens.text.primary,
  } as TextStyle,
  toggleChipLabelActive: {
    color: tokens.brand.ctaForeground,
  } as TextStyle,

  // ── 新模式:图片预览 ──
  imageRow: {
    flexDirection: 'row',
    gap: 8,
  } as ViewStyle,
  imagePreview: {
    position: 'relative',
    width: IMAGE_PREVIEW_SIZE,
    height: IMAGE_PREVIEW_SIZE,
    borderRadius: rnRadius.md,
    overflow: 'hidden',
  } as ViewStyle,
  imagePreviewImg: {
    width: IMAGE_PREVIEW_SIZE,
    height: IMAGE_PREVIEW_SIZE,
  } as ImageStyle,
  imageRemoveBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: IMAGE_REMOVE_SIZE,
    height: IMAGE_REMOVE_SIZE,
    borderRadius: IMAGE_REMOVE_SIZE / 2, // radius-exempt: 图片删除角标正圆(16dp 直径/2)
    backgroundColor: tokens.overlay.modal,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  imageRemoveIcon: {
    fontSize: 12,
    lineHeight: 14,
    color: tokens.surface.light,
    fontWeight: '600',
  } as TextStyle,

  // ── 新模式:输入行 ──
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  } as ViewStyle,
  voiceBtn: {
    width: VOICE_BTN_SIZE,
    height: VOICE_BTN_SIZE,
    borderRadius: VOICE_BTN_SIZE / 2, // radius-exempt: 语音按钮几何正圆(36dp 直径/2)
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  voiceBtnActive: {
    backgroundColor: tokens.brand.cta,
    borderColor: tokens.brandAccent.deep,
  } as ViewStyle,
  voiceEmoji: {
    fontSize: 18,
    lineHeight: 22,
  } as TextStyle,
  input: {
    flex: 1,
    minHeight: INPUT_MIN_HEIGHT,
    maxHeight: INPUT_MAX_HEIGHT,
    borderRadius: INPUT_BORDER_RADIUS,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.card,
    paddingHorizontal: INPUT_PADDING_HORIZONTAL,
    paddingVertical: 10,
    fontSize: INPUT_FONT_SIZE,
    color: tokens.text.primary,
    includeFontPadding: false,
  } as TextStyle,
  sendBtn: {
    width: SEND_BTN_WIDTH,
    height: SEND_BTN_HEIGHT,
    borderRadius: INPUT_BORDER_RADIUS,
    backgroundColor: tokens.brand.cta,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  sendBtnDisabled: {
    opacity: 0.6,
  } as ViewStyle,
  sendLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.brand.ctaForeground,
  } as TextStyle,

  // ── 新模式:辅助按钮行 ──
  secondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  } as ViewStyle,
  secondaryBtn: {
    width: SECONDARY_BTN_SIZE,
    height: SECONDARY_BTN_SIZE,
    borderRadius: SECONDARY_BTN_SIZE / 2, // radius-exempt: 辅助图标按钮正圆(36dp 直径/2)
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  // 添加附件按钮(有 onAddFile 时真实上传,否则降级占位提示)
  addFileBtn: {
    height: SECONDARY_BTN_SIZE,
    minWidth: SECONDARY_BTN_SIZE,
    paddingHorizontal: 8,
    borderRadius: SECONDARY_BTN_SIZE / 2, // radius-exempt: 附件按钮胶囊(高 36dp/2)
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  } as ViewStyle,
  secondaryEmoji: {
    fontSize: SECONDARY_BTN_EMOJI_SIZE,
    lineHeight: SECONDARY_BTN_EMOJI_SIZE + 2,
  } as TextStyle,
})

export default BottomActionBar
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
