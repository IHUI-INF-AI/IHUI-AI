import { useMemo } from 'react'
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type {
  MessageInputAgentVariable,
  MessageInputFile,
  MessageInputProps,
} from '../../types'

export type { MessageInputAgentVariable, MessageInputFile, MessageInputProps }

const VOICE_BAR_COUNT = 30

/**
 * AI 消息输入框共享组件 — props 注入式跨端组件(纯 UI,不依赖平台 API)
 *
 * 平台无关:渲染附件预览(图片/文档/视频) + 文本输入区(textarea + 焦点态)
 * + 语音输入模式(30 根波形) + 全屏放大模式 + Agent 变量填槽
 * + 底部按钮行(语音切换 + 附件 + 发送/停止)。
 *
 * 平台特定(语音录制/文件选择/图片选择/键盘适配)由 wrapper 通过 props 注入。
 *
 * 对标 D 盘 Ai-WXMiniVue 项目 InputArea.vue 全量能力(2026-07-29 提取)。
 */
export function MessageInput({
  t,
  text,
  placeholder,
  isStreaming,
  isSending,
  disabled,
  files,
  agentVariables,
  showAddFileBtn,
  isFocused,
  isFullscreen,
  isVoiceMode,
  isRecording,
  error,
  onTextChange,
  onSend,
  onStop,
  onFocus,
  onBlur,
  onFullscreenToggle,
  onVoiceToggle,
  onAddImage,
  onAddFile,
  onRemoveFile,
  onClear,
  onVoiceStart,
  onVoiceEnd,
  onAgentVariableTextChange,
  onAgentVariableImageChange,
  colorScheme = 'light',
}: MessageInputProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const canSend = !isStreaming && !isSending && (text.trim().length > 0 || files.length > 0)
  const showFiles = files.length > 0
  const showAgentVars = agentVariables && agentVariables.length > 0

  return (
    <View style={[styles.container, isFullscreen && styles.containerFullscreen]}>
      {/* 全屏模式 header(返回按钮 + 提示) */}
      {isFullscreen ? (
        <View style={styles.fullscreenHeader}>
          <TouchableOpacity onPress={onFullscreenToggle} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.fullscreenBackText}>{t('messageInput.fullscreenBack')}</Text>
          </TouchableOpacity>
          <Text style={styles.fullscreenHint}>{t('messageInput.fullscreenHint')}</Text>
        </View>
      ) : null}

      {/* Agent 变量填槽区 */}
      {showAgentVars ? (
        <View style={styles.agentVarsContainer}>
          {agentVariables.map((v: MessageInputAgentVariable, i: number) => (
            <View key={i} style={styles.agentVarItem}>
              <Text style={styles.agentVarLabel} numberOfLines={1}>
                {v.name || v.description}
              </Text>
              {v.type === 'text' ? (
                <TextInput
                  style={styles.agentVarInput}
                  value={v.value}
                  onChangeText={(val: string) => onAgentVariableTextChange?.(i, val)}
                  placeholder={v.description}
                  placeholderTextColor={tk.text.tertiary}
                />
              ) : (
                <TouchableOpacity
                  style={styles.agentVarImageBtn}
                  onPress={() => onAgentVariableImageChange?.(i)}
                  activeOpacity={0.7}
                >
                  {v.value ? (
                    <Image source={{ uri: v.value }} style={styles.agentVarImage} resizeMode="cover" />
                  ) : (
                    <Text style={styles.agentVarImageText}>+ {v.description}</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      ) : null}

      {/* 附件预览区(图片/文档/视频) */}
      {showFiles ? (
        <View style={styles.filesWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filesRow}>
            {files.map((f: MessageInputFile) => (
              <View key={f.id} style={styles.fileItem}>
                {f.type === 'image' ? (
                  <Image source={{ uri: f.url }} style={styles.fileImage} resizeMode="cover" />
                ) : f.type === 'video' ? (
                  <View style={styles.fileVideoPlaceholder}>
                    <Text style={styles.fileVideoBadge}>▶</Text>
                    <Text style={styles.fileVideoText} numberOfLines={1}>
                      {f.filename || t('messageInput.video')}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.fileDocPlaceholder}>
                    <Text style={styles.fileDocIcon}>📄</Text>
                    <Text style={styles.fileDocText} numberOfLines={1}>
                      {f.filename || t('messageInput.document')}
                    </Text>
                  </View>
                )}
                <TouchableOpacity style={styles.fileRemove} onPress={() => onRemoveFile(f.id)}>
                  <Text style={styles.fileRemoveText}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* 主输入行 */}
      <View style={[styles.inputRow, isFocused && styles.inputRowFocused]}>
        {/* 语音/键盘切换按钮 */}
        <TouchableOpacity style={styles.iconBtn} onPress={onVoiceToggle} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
          <Text style={styles.iconBtnText}>{isVoiceMode ? '⌨' : '🎙'}</Text>
        </TouchableOpacity>

        {/* 文本输入区(语音模式下隐藏) */}
        {isVoiceMode ? (
          <Pressable
            style={styles.voiceBarWrap}
            onPressIn={onVoiceStart}
            onPressOut={onVoiceEnd}
            delayLongPress={200}
          >
            <Text style={styles.voiceBarHint}>
              {isRecording ? t('messageInput.recording') : t('messageInput.voiceHint')}
            </Text>
            {isRecording ? (
              <View style={styles.voiceBar}>
                {Array.from({ length: VOICE_BAR_COUNT }, (_, n) => (
                  <View
                    key={n}
                    style={[
                      styles.voiceBarLine,
                      {
                        height: 4 + ((n * 7) % 20),
                        backgroundColor: isRecording ? tk.success.DEFAULT : tk.border.light,
                      },
                    ]}
                  />
                ))}
              </View>
            ) : null}
          </Pressable>
        ) : (
          <TextInput
            style={[styles.input, isFullscreen && styles.inputFullscreen]}
            value={text}
            onChangeText={onTextChange}
            placeholder={placeholder || t('messageInput.placeholder')}
            placeholderTextColor={tk.text.tertiary}
            onFocus={onFocus}
            onBlur={onBlur}
            multiline
            maxLength={50000}
            editable={!disabled}
            textAlignVertical="top"
          />
        )}

        {/* 右侧操作区(全屏切换 + 附件 + 发送/停止) */}
        <View style={styles.rightActions}>
          {isFocused ? (
            <TouchableOpacity style={styles.iconBtn} onPress={onFullscreenToggle} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
              <Text style={styles.iconBtnText}>{isFullscreen ? '⊟' : '⛶'}</Text>
            </TouchableOpacity>
          ) : null}
          {showAddFileBtn && !isFocused ? (
            <TouchableOpacity style={styles.iconBtn} onPress={onAddImage} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
              <Text style={styles.iconBtnText}>+</Text>
            </TouchableOpacity>
          ) : null}
          {showAddFileBtn && isFocused ? (
            <TouchableOpacity style={styles.iconBtn} onPress={onAddFile} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
              <Text style={styles.iconBtnText}>📎</Text>
            </TouchableOpacity>
          ) : null}
          {text.length > 0 && !isStreaming ? (
            <TouchableOpacity style={styles.iconBtn} onPress={onClear} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
              <Text style={styles.iconBtnText}>×</Text>
            </TouchableOpacity>
          ) : null}
          {isStreaming ? (
            <TouchableOpacity style={[styles.sendBtn, styles.sendBtnStop]} onPress={onStop}>
              <Text style={styles.sendBtnText}>{t('messageInput.stop')}</Text>
            </TouchableOpacity>
          ) : isSending ? (
            <View style={[styles.sendBtn, styles.sendBtnDisabled]}>
              <ActivityIndicator color={tk.surface.light} size="small" />
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
              onPress={onSend}
              disabled={!canSend}
            >
              <Text style={styles.sendBtnText}>{t('messageInput.send')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  const primary = tk.brand.DEFAULT
  return StyleSheet.create({
    container: {
      paddingHorizontal: 10,
      paddingTop: 5,
      paddingBottom: 10,
      backgroundColor: tk.surface.bg,
      borderTopWidth: 1,
      borderTopColor: tk.border.light,
    },
    containerFullscreen: {
      flex: 1,
      paddingHorizontal: 0,
    },
    fullscreenHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: tk.border.light,
    },
    fullscreenBackText: { fontSize: 16, color: tk.text.secondary, marginRight: 12 },
    fullscreenHint: { fontSize: 12, color: tk.text.tertiary },
    agentVarsContainer: {
      paddingVertical: 8,
      paddingHorizontal: 4,
      borderBottomWidth: 1,
      borderBottomColor: tk.border.light,
    },
    agentVarItem: { paddingHorizontal: 8, paddingVertical: 4 },
    agentVarLabel: { fontSize: 12, color: tk.text.tertiary, marginBottom: 4 },
    agentVarInput: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: tk.border.light,
      fontSize: 14,
      color: tk.text.primary,
      backgroundColor: tk.surface.light,
    },
    agentVarImageBtn: {
      width: 80,
      height: 80,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: tk.border.light,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.surface.muted,
    },
    agentVarImage: { width: '100%', height: '100%' },
    agentVarImageText: { fontSize: 11, color: tk.text.tertiary },
    filesWrap: { paddingVertical: 8 },
    filesRow: { gap: 8, paddingHorizontal: 4 },
    fileItem: {
      position: 'relative',
      width: 72,
      height: 72,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: tk.border.light,
    },
    fileImage: { width: '100%', height: '100%' },
    fileVideoPlaceholder: {
      width: '100%',
      height: '100%',
      backgroundColor: tk.text.primary,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 4,
    },
    fileVideoBadge: { color: tk.surface.light, fontSize: 16, marginBottom: 2 },
    fileVideoText: { color: tk.surface.light, fontSize: 9, textAlign: 'center' },
    fileDocPlaceholder: {
      width: '100%',
      height: '100%',
      backgroundColor: tk.surface.muted,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 4,
    },
    fileDocIcon: { fontSize: 20, marginBottom: 2 },
    fileDocText: { fontSize: 9, color: tk.text.secondary, textAlign: 'center' },
    fileRemove: {
      position: 'absolute',
      top: 2.5,
      right: 2.5,
      width: 15,
      height: 15,
      borderRadius: 7.5,
      backgroundColor: tk.danger.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fileRemoveText: { color: tk.surface.light, fontSize: 12, lineHeight: 12, fontWeight: '700' },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      borderRadius: 15,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
      paddingHorizontal: 15,
      paddingVertical: 6,
      gap: 10,
    },
    inputRowFocused: { borderColor: primary },
    iconBtn: {
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconBtnText: { fontSize: 20, color: tk.text.secondary },
    input: {
      flex: 1,
      paddingHorizontal: 8,
      paddingVertical: 6,
      fontSize: 18,
      color: tk.text.primary,
      minHeight: 40,
      maxHeight: 120,
    },
    inputFullscreen: { flex: 1, minHeight: 200, textAlignVertical: 'top' },
    voiceBarWrap: {
      flex: 1,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    voiceBarHint: { fontSize: 12, color: tk.text.tertiary },
    voiceBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      height: 20,
    },
    voiceBarLine: { width: 1, borderRadius: 1 },
    rightActions: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
    sendBtn: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 15,
      backgroundColor: primary,
      minWidth: 50,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendBtnStop: {
      backgroundColor: tk.surface.muted,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    sendBtnDisabled: { backgroundColor: tk.text.tertiary },
    sendBtnText: { color: tk.surface.light, fontSize: 14, fontWeight: '600' },
    errorText: { marginTop: 4, fontSize: 14, color: tk.danger.DEFAULT },
  })
}
