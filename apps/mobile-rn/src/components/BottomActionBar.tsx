/**
 * BottomActionBar 底部操作栏 (mobile-rn 端)
 *
 * 对齐历史 Uniapp BottomActionBar.vue(25+ 事件回调):
 * - 兼容旧 API:actions(简单按钮列表,LabelButton/IconButton 渲染)
 * - 新 API:聊天输入模式(prompt 提供),渲染完整 Uniapp 对齐 UI:
 *   + 模型信息条(onShowModelList / onShowModelConfig / onModelConfigChange)
 *   + ToggleButtonGroup(5 开关:onToggleSuperAgent/Agentfu/Mcp/KnowledgeBase/PermanentMemory)
 *   + 图片预览行(onRemoveImage)
 *   + InputArea(TextInput + 语音 + 发送:onPromptChange/onInputFocus/Blur/Click/onSend/onTextareaHeightChange)
 *   + 辅助按钮行(onFunctionHandle / onSourceHandle / onFangda)
 *   + IconButtonGroup(相机/相册/文件:onIconClick)
 *   + 键盘监听(onKeyboardShow / onKeyboardHide)
 *   + 语音动画(onStartVoiceAnimation / onStopVoiceAnimation via voiceInputEnabled)
 *   + 长按手势(onStartLongPress / onEndLongPress on voice button)
 * - 固定底部 100% 屏宽,SafeArea padding
 * - 浅色优雅风,无霓虹 / 无渐变,系统字体
 * - AGENTS.md §3:禁 any,onModelConfigChange 用 unknown 类型
 */
import { useEffect, useRef } from 'react'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import {
  ActivityIndicator,
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
  onRemoveImage?: () => void
  onStartLongPress?: () => void
  onEndLongPress?: () => void
  onInputFocus?: () => void
  onInputBlur?: () => void
  onInputClick?: () => void
  onStartVoiceAnimation?: () => void
  onStopVoiceAnimation?: () => void
  onFunctionHandle?: () => void
  onSourceHandle?: () => void
  onIconClick?: () => void
  onShowModelConfig?: () => void
  onTextareaHeightChange?: (height: number) => void
  onModelConfigChange?: (config: unknown) => void
  onFangda?: () => void
  onKeyboardShow?: () => void
  onKeyboardHide?: () => void
  onShowModelList?: () => void

  // ── 开关状态 ──
  superAgentEnabled?: boolean
  mcpEnabled?: boolean
  knowledgeBaseEnabled?: boolean
  permanentMemoryEnabled?: boolean
  voiceInputEnabled?: boolean

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

const CONTAINER_PADDING_HORIZONTAL = 16
const CONTAINER_PADDING_VERTICAL = 12
const ROW_GAP = 12
const COLUMN_GAP = 8

const ACTION_BUTTON_HEIGHT = 44
const ACTION_BUTTON_BORDER_RADIUS = 8
const ACTION_BUTTON_FONT_SIZE = 15
const ICON_BUTTON_SIZE = 44
const ICON_BUTTON_EMOJI_SIZE = 18
const ICON_BUTTON_BORDER_RADIUS = ICON_BUTTON_SIZE / 2
const LABEL_LETTER_SPACING = 0.2

const TOGGLE_CHIP_HEIGHT = 32
const TOGGLE_CHIP_BORDER_RADIUS = 6
const TOGGLE_CHIP_FONT_SIZE = 13
const TOGGLE_CHIP_GAP = 8
const TOGGLE_CHIP_LETTER_SPACING = 0.2

const INPUT_MIN_HEIGHT = 44
const INPUT_BORDER_RADIUS = 8
const INPUT_FONT_SIZE = 15
const INPUT_PADDING_HORIZONTAL = 12
const INPUT_MAX_HEIGHT = 100

const SEND_BTN_WIDTH = 56
const SEND_BTN_HEIGHT = 44

const VOICE_BTN_SIZE = 36

const SECONDARY_BTN_SIZE = 36
const SECONDARY_BTN_EMOJI_SIZE = 18

const ICON_GROUP_ITEM_SIZE = 64
const ICON_GROUP_ITEM_EMOJI_SIZE = 24
const ICON_GROUP_ITEM_RADIUS = 8

const IMAGE_PREVIEW_SIZE = 48
const IMAGE_PREVIEW_RADIUS = 6
const IMAGE_REMOVE_SIZE = 16

const MODEL_BAR_HEIGHT = 28
const MODEL_BAR_FONT_SIZE = 13

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

  const labelStyle: TextStyle = isPrimary
    ? styles.primaryButtonLabel
    : styles.secondaryButtonLabel

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
    onIconClick,
    onShowModelConfig,
    onTextareaHeightChange,
    onModelConfigChange,
    onFangda,
    onKeyboardShow,
    onKeyboardHide,
    onShowModelList,
    superAgentEnabled = false,
    mcpEnabled = false,
    knowledgeBaseEnabled = false,
    permanentMemoryEnabled = false,
    voiceInputEnabled = false,
    images,
    modelName,
    isLoading = false,
    isShowIcon = false,
  } = props

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
    { key: 'knowledge-base', label: '知识库', active: knowledgeBaseEnabled, onPress: onToggleKnowledgeBase },
    { key: 'permanent-memory', label: '记忆', active: permanentMemoryEnabled, onPress: onTogglePermanentMemory },
  ]
  const visibleChips = allChips.filter(
    (chip): chip is ToggleChipConfig & { onPress: () => void } => chip.onPress !== undefined,
  )

  const showModelBar =
    modelName !== undefined || onShowModelList !== undefined || onShowModelConfig !== undefined
  const showSecondaryRow =
    onFunctionHandle !== undefined || onSourceHandle !== undefined || onFangda !== undefined
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
              <Text style={styles.modelArrow}>{'▼'}</Text>
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
              <Text style={styles.configEmoji} allowFontScaling={false}>
                {'⚙️'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* Toggle chips 行 */}
      {visibleChips.length > 0 ? (
        <View style={styles.toggleRow}>
          {visibleChips.map((chip) => (
            <ToggleChip key={chip.key} label={chip.label} active={chip.active} onPress={chip.onPress} />
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
                  onPress={onRemoveImage}
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
            <Text style={styles.voiceEmoji} allowFontScaling={false}>
              {'🎤'}
            </Text>
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
          placeholder="输入消息..."
          placeholderTextColor={tokens.text.tertiary}
          multiline
          editable={!isLoading}
        />

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
              <ActivityIndicator size="small" color={tokens.surface.light} />
            ) : (
              <Text style={styles.sendLabel} numberOfLines={1}>
                {'发送'}
              </Text>
            )}
          </Pressable>
        ) : null}
      </View>

      {/* 辅助按钮行:ƒ / 📎 / ⛶ */}
      {showSecondaryRow ? (
        <View style={styles.secondaryRow}>
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
              <Text style={styles.secondaryEmoji} allowFontScaling={false}>
                {'📎'}
              </Text>
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
              <Text style={styles.secondaryEmoji} allowFontScaling={false}>
                {'⛶'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* 图标按钮组:相机 / 相册 / 文件 */}
      {showIconGroup ? (
        <View style={styles.iconGroup}>
          <Pressable
            style={styles.iconGroupItem}
            onPress={onIconClick}
            accessibilityRole="button"
            accessibilityLabel="相机"
          >
            <Text style={styles.iconGroupEmoji} allowFontScaling={false}>
              {'📷'}
            </Text>
            <Text style={styles.iconGroupLabel} numberOfLines={1}>
              {'相机'}
            </Text>
          </Pressable>
          <Pressable
            style={styles.iconGroupItem}
            onPress={onIconClick}
            accessibilityRole="button"
            accessibilityLabel="相册"
          >
            <Text style={styles.iconGroupEmoji} allowFontScaling={false}>
              {'🖼️'}
            </Text>
            <Text style={styles.iconGroupLabel} numberOfLines={1}>
              {'相册'}
            </Text>
          </Pressable>
          <Pressable
            style={styles.iconGroupItem}
            onPress={onIconClick}
            accessibilityRole="button"
            accessibilityLabel="文件"
          >
            <Text style={styles.iconGroupEmoji} allowFontScaling={false}>
              {'📁'}
            </Text>
            <Text style={styles.iconGroupLabel} numberOfLines={1}>
              {'文件'}
            </Text>
          </Pressable>
        </View>
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
    borderRadius: ACTION_BUTTON_BORDER_RADIUS,
    backgroundColor: tokens.brand.DEFAULT,
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
    color: tokens.surface.light,
    textAlign: 'center',
  } as TextStyle,
  secondaryButton: {
    flex: 1,
    height: ACTION_BUTTON_HEIGHT,
    borderRadius: ACTION_BUTTON_BORDER_RADIUS,
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
    gap: TOGGLE_CHIP_GAP,
  } as ViewStyle,
  toggleChip: {
    height: TOGGLE_CHIP_HEIGHT,
    paddingHorizontal: 10,
    borderRadius: TOGGLE_CHIP_BORDER_RADIUS,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  toggleChipActive: {
    backgroundColor: tokens.brand.DEFAULT,
    borderColor: tokens.brand.DEFAULT,
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
    color: tokens.surface.light,
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
    borderRadius: IMAGE_PREVIEW_RADIUS,
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
    borderRadius: IMAGE_REMOVE_SIZE / 2,
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
    borderRadius: VOICE_BTN_SIZE / 2,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  voiceBtnActive: {
    backgroundColor: tokens.brand.DEFAULT,
    borderColor: tokens.brand.DEFAULT,
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
    backgroundColor: tokens.surface.light,
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
    backgroundColor: tokens.brand.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  sendBtnDisabled: {
    opacity: 0.6,
  } as ViewStyle,
  sendLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.surface.light,
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
    borderRadius: SECONDARY_BTN_SIZE / 2,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  secondaryEmoji: {
    fontSize: SECONDARY_BTN_EMOJI_SIZE,
    lineHeight: SECONDARY_BTN_EMOJI_SIZE + 2,
  } as TextStyle,

  // ── 新模式:图标按钮组 ──
  iconGroup: {
    flexDirection: 'row',
    gap: 12,
  } as ViewStyle,
  iconGroupItem: {
    width: ICON_GROUP_ITEM_SIZE,
    height: ICON_GROUP_ITEM_SIZE,
    borderRadius: ICON_GROUP_ITEM_RADIUS,
    backgroundColor: tokens.surface.muted,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  iconGroupEmoji: {
    fontSize: ICON_GROUP_ITEM_EMOJI_SIZE,
    lineHeight: ICON_GROUP_ITEM_EMOJI_SIZE + 2,
  } as TextStyle,
  iconGroupLabel: {
    fontSize: 11,
    color: tokens.text.secondary,
    marginTop: 2,
  } as TextStyle,
})

export default BottomActionBar
