// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import type { ReactNode } from 'react'
import {
  ChevronDown,
  Settings,
  Paperclip,
  Play,
  FileText,
  Keyboard,
  Mic,
} from 'lucide-react-native'
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { rnGeometry, rnRadius, rnRadiusFor, rnSpacing, rnType } from '@ihui/design-tokens'
import type {
  ChatScreenModel,
  MessageInputAgentVariable,
  MessageInputFile,
  TFunction,
} from '@ihui/types'

export type ChatComposerToggleKey =
  'webSearch' | 'deepThink' | 'imageGen' | 'fileContext' | 'agentMode'

export interface ChatComposerToggle {
  key: ChatComposerToggleKey
  label: string
  active: boolean
  disabled?: boolean
}

export interface ChatComposerProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  /** 输入值（受控） */
  value: string
  onChangeText: (value: string) => void
  placeholder?: string
  maxLength?: number
  disabled?: boolean
  loading?: boolean
  stopLabel?: string
  /** 附件列表（顺序即 UI 顺序，不排序） */
  files?: readonly MessageInputFile[]
  agentVariables?: readonly MessageInputAgentVariable[]
  models: readonly ChatScreenModel[]
  modelId: string
  modelPickerOpen?: boolean
  /** 功能开关组；顺序即渲染顺序 */
  toggles?: readonly ChatComposerToggle[]
  isFocused?: boolean
  isFullscreen?: boolean
  voiceMode?: boolean
  recording?: boolean
  error?: string
  /** 输入区上方的平台注入槽（如素材卡片）；不传不渲染 */
  headerSlot?: ReactNode

  onSubmit: () => void
  onStop: () => void
  onFocus?: () => void
  onBlur?: () => void
  /** 键盘高度(px,0=收起)；平台事件由 wrapper 注入，组件内不得监听 Keyboard */
  onKeyboardHeightChange?: (height: number) => void
  onFullscreenToggle?: () => void
  onVoiceToggle?: () => void
  onVoiceStart?: () => void
  onVoiceEnd?: () => void
  onAddImage?: () => void
  onAddFile?: () => void
  onRemoveFile?: (id: string) => void
  onClear?: () => void
  onPlusToggle?: () => void
  onToggle?: (key: ChatComposerToggleKey, next: boolean) => void
  onModelSelectOpen?: () => void
  onModelSelectClose?: () => void
  onModelChange?: (id: string) => void
  onModelConfigOpen?: () => void
  onAgentVariableTextChange?: (index: number, value: string) => void
  onAgentVariableImageChange?: (index: number) => void
}

/** 输入框字符上限默认值：与 RN InputArea 的 DEFAULT_MAX_LENGTH 同档 */
const DEFAULT_MAX_LENGTH = 500
/** 控件方块 44：块 3 契约「按钮高 44、图标钮 44×44」的固定档 */
const CONTROL_BOX = 44
/** 输入区外边距 12（块 3 契约固定档） */
const CONTAINER_PADDING = 12
/** 附件缩略图 72（对齐 RN 输入区 imgs_list 现状） */
const FILE_BOX = 72
const FILE_REMOVE_BOX = 18
const VOICE_BAR_HEIGHT = 40
const PICKER_MAX_HEIGHT = 320

/**
 * 块 3 输入区共享组件 — props 注入式跨端组件(纯 UI,不依赖平台 API)
 *
 * 渲染:全屏头 + 平台注入槽 + Agent 变量填槽 + 附件行 + 功能开关组 + 模型条
 * + 错误条 + 输入行(语音/文本 + 全屏/附件/清空/加号 + 发送/停止).
 * 平台能力(录音/相册/相机/文件选择/键盘高度/路由)全部由 wrapper 注入。
 */
export function ChatComposer({
  t,
  colorScheme = 'light',
  value,
  onChangeText,
  placeholder,
  maxLength = DEFAULT_MAX_LENGTH,
  disabled = false,
  loading = false,
  stopLabel,
  files = [],
  agentVariables,
  models,
  modelId,
  modelPickerOpen = false,
  toggles = [],
  isFocused = false,
  isFullscreen = false,
  voiceMode = false,
  recording = false,
  error,
  headerSlot,
  onSubmit,
  onStop,
  onFocus,
  onBlur,
  onFullscreenToggle,
  onVoiceToggle,
  onVoiceStart,
  onVoiceEnd,
  onAddImage,
  onAddFile,
  onRemoveFile,
  onClear,
  onPlusToggle,
  onToggle,
  onModelSelectOpen,
  onModelSelectClose,
  onModelChange,
  onModelConfigOpen,
  onAgentVariableTextChange,
  onAgentVariableImageChange,
}: ChatComposerProps) {
  const tk = getTokens(colorScheme)
  const styles = createStyles(tk)

  const currentModelName = models.find((m) => m.id === modelId)?.name ?? modelId
  const canSend = !disabled && !loading && value.trim().length > 0
  const showAgentVars = (agentVariables?.length ?? 0) > 0

  const handleSubmit = (): void => {
    if (!canSend) return
    onSubmit()
  }

  return (
    <View style={[styles.container, isFullscreen && styles.containerFullscreen]}>
      {/* 全屏模式 header(返回 + 提示):只切样式与标题,不清空输入 */}
      {isFullscreen ? (
        <View style={styles.fullscreenHeader}>
          {onFullscreenToggle ? (
            <TouchableOpacity
              onPress={onFullscreenToggle}
              style={styles.fullscreenBackBtn}
              accessibilityLabel={t('messageInput.fullscreenBack')}
            >
              <Text style={styles.fullscreenBackGlyph}>‹</Text>
            </TouchableOpacity>
          ) : null}
          <Text style={styles.fullscreenHint}>{t('messageInput.fullscreenHint')}</Text>
        </View>
      ) : null}

      {/* 输入区上方的平台注入槽(不传不渲染) */}
      {headerSlot ?? null}

      {/* Agent 变量填槽 */}
      {showAgentVars ? (
        <View style={styles.agentVars}>
          {(agentVariables ?? []).map((v: MessageInputAgentVariable, index: number) => (
            <View key={`${v.name}-${index}`} style={styles.agentVarItem}>
              <Text style={styles.agentVarLabel} numberOfLines={1}>
                {v.name || v.description}
              </Text>
              {v.type === 'text' ? (
                <TextInput
                  style={styles.agentVarInput}
                  value={v.value}
                  onChangeText={(next: string) => onAgentVariableTextChange?.(index, next)}
                  placeholder={v.description}
                  placeholderTextColor={tk.text.tertiary}
                />
              ) : (
                <TouchableOpacity
                  style={styles.agentVarImageBtn}
                  onPress={() => onAgentVariableImageChange?.(index)}
                  activeOpacity={0.7}
                >
                  {v.value ? (
                    <Image
                      source={{ uri: v.value }}
                      style={styles.agentVarImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <Text style={styles.agentVarImageText}>+ {v.description}</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      ) : null}

      {/* 附件预览区(顺序即传入顺序) */}
      {files.length > 0 ? (
        <View style={styles.filesWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filesRow}
          >
            {files.map((f: MessageInputFile) => (
              <View key={f.id} style={styles.fileItem}>
                {f.type === 'image' ? (
                  <Image source={{ uri: f.url }} style={styles.fileImage} resizeMode="cover" />
                ) : (
                  <View style={styles.filePlaceholder}>
                    <Text style={styles.fileGlyph}>
                      {f.type === 'video' ? (
                        <Play size={16} color={tk.text.tertiary} />
                      ) : (
                        <FileText size={16} color={tk.text.tertiary} />
                      )}
                    </Text>
                    <Text style={styles.fileName} numberOfLines={1}>
                      {f.filename ||
                        t(f.type === 'video' ? 'messageInput.video' : 'messageInput.document')}
                    </Text>
                  </View>
                )}
                {onRemoveFile ? (
                  <TouchableOpacity
                    hitSlop={8}
                    style={styles.fileRemove}
                    onPress={() => onRemoveFile(f.id)}
                    accessibilityLabel={t('chat.imageDelete')}
                  >
                    <Text style={styles.fileRemoveText}>×</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* 功能开关组(原序渲染,点击回传取反值) */}
      {toggles.length > 0 ? (
        <View style={styles.toggleRow}>
          {toggles.map((tg) => (
            <TouchableOpacity
              key={tg.key}
              style={[
                styles.toggleChip,
                tg.active && styles.toggleChipActive,
                tg.disabled && styles.toggleChipDisabled,
              ]}
              disabled={tg.disabled === true}
              onPress={() => onToggle?.(tg.key, !tg.active)}
              accessibilityState={{ selected: tg.active }}
              accessibilityLabel={tg.label}
            >
              <Text style={[styles.toggleText, tg.active && styles.toggleTextActive]}>
                {tg.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {/* 模型条(触发钮/配置钮未注入时只显示当前模型名) */}
      {models.length > 0 || currentModelName ? (
        <View style={styles.modelRow}>
          {onModelSelectOpen ? (
            <TouchableOpacity style={styles.modelBtn} onPress={onModelSelectOpen} hitSlop={4}>
              <Text style={styles.modelName} numberOfLines={1}>
                {currentModelName}
              </Text>
              <ChevronDown size={12} color={tk.text.tertiary} />
            </TouchableOpacity>
          ) : (
            <Text style={styles.modelName} numberOfLines={1}>
              {currentModelName}
            </Text>
          )}
          {onModelConfigOpen ? (
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={onModelConfigOpen}
              hitSlop={4}
              accessibilityLabel={t('bab.modelConfig')}
            >
              <Settings size={16} color={tk.text.tertiary} />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {/* 错误条:位于输入框上方,不遮挡发送按钮 */}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {/* 主输入行 */}
      <View style={[styles.inputRow, isFocused && styles.inputRowFocused]}>
        {onVoiceToggle ? (
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={onVoiceToggle}
            disabled={disabled}
            hitSlop={4}
            accessibilityLabel={t('messageInput.voiceHint')}
          >
            <Text style={styles.iconGlyph}>
              {voiceMode ? (
                <Keyboard size={16} color={tk.text.tertiary} />
              ) : (
                <Mic size={16} color={tk.text.tertiary} />
              )}
            </Text>
          </TouchableOpacity>
        ) : null}

        {voiceMode ? (
          <Pressable
            style={styles.voiceBar}
            onLongPress={onVoiceStart}
            onPressOut={onVoiceEnd}
            delayLongPress={300}
            disabled={disabled}
            accessibilityLabel={t('messageInput.voiceHint')}
          >
            <Text style={styles.voiceHint}>
              {recording ? t('messageInput.recording') : t('messageInput.voiceHint')}
            </Text>
          </Pressable>
        ) : (
          <TextInput
            style={[styles.input, isFullscreen && styles.inputFullscreen]}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder || t('messageInput.placeholder')}
            placeholderTextColor={tk.text.tertiary}
            onFocus={onFocus}
            onBlur={onBlur}
            multiline
            maxLength={maxLength}
            editable={!disabled}
            textAlignVertical="top"
          />
        )}

        <View style={styles.rightActions}>
          {isFocused && onFullscreenToggle ? (
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={onFullscreenToggle}
              hitSlop={4}
              accessibilityLabel={t('messageInput.fullscreenHint')}
            >
              <Text style={styles.iconGlyph}>{isFullscreen ? '⤡' : '⤢'}</Text>
            </TouchableOpacity>
          ) : null}
          {!isFocused && onAddImage ? (
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={onAddImage}
              disabled={disabled}
              hitSlop={4}
              accessibilityLabel={t('bab.camera')}
            >
              <Text style={styles.iconGlyph}>＋</Text>
            </TouchableOpacity>
          ) : null}
          {isFocused && onAddFile ? (
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={onAddFile}
              disabled={disabled}
              hitSlop={4}
              accessibilityLabel={t('messageInput.addFile')}
            >
              <Paperclip size={16} color={tk.text.tertiary} />
            </TouchableOpacity>
          ) : null}
          {onClear && value.length > 0 && !loading ? (
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={onClear}
              hitSlop={4}
              accessibilityLabel={t('common.close')}
            >
              <Text style={styles.iconGlyph}>×</Text>
            </TouchableOpacity>
          ) : null}
          {onPlusToggle ? (
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={onPlusToggle}
              hitSlop={4}
              accessibilityLabel={t('common.more')}
            >
              <Text style={styles.iconGlyph}>＋</Text>
            </TouchableOpacity>
          ) : null}

          {/* 发送/停止二态互斥:loading 时只显示停止 */}
          {loading ? (
            <TouchableOpacity
              style={[styles.sendBtn, styles.stopBtn]}
              onPress={onStop}
              accessibilityLabel={stopLabel || t('chat.stop')}
            >
              <Text style={styles.stopBtnText}>{stopLabel || t('chat.stop')}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
              onPress={handleSubmit}
              disabled={!canSend}
              accessibilityLabel={t('messageInput.send')}
            >
              <Text style={styles.sendBtnText}>{t('messageInput.send')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 模型选择面板(打开态由 props 控制,组件内不自带开关) */}
      {modelPickerOpen ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => onModelSelectClose?.()}
        >
          <View style={styles.pickerOverlay}>
            <Pressable
              style={styles.pickerMask}
              onPress={() => onModelSelectClose?.()}
              accessibilityLabel={t('common.close')}
            />
            <View style={styles.pickerCard}>
              <ScrollView style={styles.pickerList}>
                {models.map((m: ChatScreenModel) => (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.pickerItem, m.id === modelId && styles.pickerItemActive]}
                    onPress={() => onModelChange?.(m.id)}
                  >
                    <Text
                      style={[
                        styles.pickerItemText,
                        m.id === modelId && styles.pickerItemTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {m.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: {
      paddingHorizontal: CONTAINER_PADDING,
      paddingTop: rnSpacing['xs-loose'],
      paddingBottom: CONTAINER_PADDING,
      backgroundColor: tk.surface.bg,
    },
    containerFullscreen: {
      flex: 1,
      paddingHorizontal: 0,
    },
    fullscreenHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: rnSpacing.lg,
      paddingVertical: rnSpacing.md,
    },
    fullscreenBackBtn: {
      width: rnGeometry.tapBox,
      height: rnGeometry.tapBox,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fullscreenBackGlyph: {
      fontSize: rnType.title.size,
      lineHeight: rnType.title.lineHeight,
      color: tk.text.secondary,
    },
    fullscreenHint: {
      fontSize: rnType.label.size,
      lineHeight: rnType.label.lineHeight,
      color: tk.text.tertiary,
    },
    agentVars: {
      paddingVertical: rnSpacing.sm,
      paddingHorizontal: rnSpacing.xs,
    },
    agentVarItem: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing.xs,
    },
    agentVarLabel: {
      fontSize: rnType.label.size,
      lineHeight: rnType.label.lineHeight,
      color: tk.text.tertiary,
      marginBottom: rnSpacing.xs,
    },
    agentVarInput: {
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingVertical: rnSpacing['xs-loose'],
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
      fontSize: rnType.body.size,
      lineHeight: rnType.body.lineHeight,
      color: tk.text.primary,
      backgroundColor: tk.surface.light,
    },
    agentVarImageBtn: {
      width: FILE_BOX,
      height: FILE_BOX,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.surface.muted,
    },
    agentVarImage: { width: '100%', height: '100%' },
    agentVarImageText: {
      fontSize: rnType.caption.size,
      lineHeight: rnType.caption.lineHeight,
      color: tk.text.tertiary,
    },
    filesWrap: { paddingVertical: rnSpacing.sm },
    filesRow: {
      gap: rnSpacing.sm,
      paddingHorizontal: rnSpacing.xs,
    },
    fileItem: {
      position: 'relative',
      width: FILE_BOX,
      height: FILE_BOX,
      borderRadius: rnRadius.xl,
      overflow: 'hidden',
      backgroundColor: tk.border.light,
    },
    fileImage: { width: '100%', height: '100%' },
    filePlaceholder: {
      width: '100%',
      height: '100%',
      backgroundColor: tk.surface.muted,
      alignItems: 'center',
      justifyContent: 'center',
      padding: rnSpacing.xs,
    },
    fileGlyph: {
      fontSize: rnType.title.size,
      lineHeight: rnType.title.lineHeight,
      color: tk.text.secondary,
      marginBottom: rnSpacing['2xs'],
    },
    fileName: {
      fontSize: rnType.badge.size,
      lineHeight: rnType.badge.lineHeight,
      color: tk.text.secondary,
      textAlign: 'center',
    },
    fileRemove: {
      position: 'absolute',
      top: 2,
      right: 2,
      width: FILE_REMOVE_BOX,
      height: FILE_REMOVE_BOX,
      borderRadius: FILE_REMOVE_BOX / 2,
      backgroundColor: tk.danger.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fileRemoveText: {
      color: tk.surface.light,
      fontSize: rnType.label.size,
      lineHeight: rnType.label.lineHeight,
      fontWeight: '700',
    },
    toggleRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing.xs,
    },
    toggleChip: {
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadiusFor.chip,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    toggleChipActive: {
      borderColor: tk.brand.DEFAULT,
      backgroundColor: tk.surface.muted,
    },
    toggleChipDisabled: { opacity: 0.5 },
    toggleText: {
      fontSize: rnType.label.size,
      lineHeight: rnType.label.lineHeight,
      color: tk.text.secondary,
    },
    toggleTextActive: { color: tk.text.primary, fontWeight: '600' },
    modelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: rnSpacing['2xs'],
    },
    modelBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing['2xs'],
      flexShrink: 1,
    },
    modelName: {
      fontSize: rnType.label.size,
      lineHeight: rnType.label.lineHeight,
      color: tk.text.tertiary,
      flexShrink: 1,
    },
    modelChevron: {
      fontSize: rnType.badge.size,
      lineHeight: rnType.badge.lineHeight,
      color: tk.text.tertiary,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      borderRadius: rnRadius['2xl'],
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
      paddingHorizontal: rnSpacing['md-loose'],
      paddingVertical: rnSpacing['xs-loose'],
      gap: rnSpacing['sm-loose'],
    },
    inputRowFocused: { borderColor: tk.text.secondary },
    iconBtn: {
      width: CONTROL_BOX,
      height: CONTROL_BOX,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconGlyph: {
      fontSize: rnType.title.size,
      lineHeight: rnType.title.lineHeight,
      color: tk.text.secondary,
    },
    input: {
      flex: 1,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing['xs-loose'],
      fontSize: rnType.subtitle.size,
      lineHeight: rnType.subtitle.lineHeight,
      color: tk.text.primary,
      minHeight: CONTROL_BOX,
      maxHeight: 120,
    },
    inputFullscreen: { flex: 1, minHeight: 200, textAlignVertical: 'top' },
    voiceBar: {
      flex: 1,
      height: VOICE_BAR_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    voiceHint: {
      fontSize: rnType.body.size,
      lineHeight: rnType.body.lineHeight,
      color: tk.text.secondary,
    },
    rightActions: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: rnSpacing['2xs'],
    },
    sendBtn: {
      paddingHorizontal: rnSpacing['md-loose'],
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.DEFAULT,
      minWidth: 50,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stopBtn: {
      backgroundColor: tk.surface.muted,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    stopBtnText: {
      fontSize: rnType.body.size,
      lineHeight: rnType.body.lineHeight,
      color: tk.text.primary,
      fontWeight: '600',
    },
    sendBtnDisabled: { backgroundColor: tk.text.tertiary },
    sendBtnText: {
      color: tk.surface.light,
      fontSize: rnType.body.size,
      lineHeight: rnType.body.lineHeight,
      fontWeight: '600',
    },
    errorText: {
      marginBottom: rnSpacing.xs,
      fontSize: rnType.body.size,
      lineHeight: rnType.body.lineHeight,
      color: tk.danger.DEFAULT,
    },
    pickerOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: tk.overlay.modal,
    },
    pickerMask: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },
    pickerCard: {
      maxHeight: PICKER_MAX_HEIGHT,
      borderTopLeftRadius: rnRadius['2xl'],
      borderTopRightRadius: rnRadius['2xl'],
      backgroundColor: tk.surface.card,
      paddingVertical: rnSpacing.sm,
    },
    pickerList: { maxHeight: PICKER_MAX_HEIGHT },
    pickerItem: {
      paddingHorizontal: rnSpacing.lg,
      paddingVertical: rnSpacing.md,
    },
    pickerItemActive: { backgroundColor: tk.surface.muted },
    pickerItemText: {
      fontSize: rnType.body.size,
      lineHeight: rnType.body.lineHeight,
      color: tk.text.primary,
    },
    pickerItemTextActive: { color: tk.text.primary, fontWeight: '600' },
  })
}
