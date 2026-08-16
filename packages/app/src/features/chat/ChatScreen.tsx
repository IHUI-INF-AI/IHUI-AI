import { useMemo } from 'react'
import { FlatList, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type {
  ChatScreenMessage,
  ChatScreenModel,
  ChatScreenNavItem,
  ChatScreenProps,
} from '../../types'
import { MessageInput } from './MessageInput'

export type { ChatScreenMessage, ChatScreenModel, ChatScreenNavItem, ChatScreenProps }

/**
 * AI 主聊天共享屏 — props 注入式跨端组件(纯 UI,不依赖平台 API)
 *
 * 平台无关:渲染顶栏(标题 + 导航条目)+ 模型选择条 + Modal 选择器
 * + 消息列表(用户/助手气泡)+ 错误提示 + 输入栏(发送/停止)。
 * 平台特定(SSE 流式 / 截图 / 分享 / Alert / 导航跳转)由 wrapper 通过 props 注入。
 */
export function ChatScreen({
  t,
  messages,
  inputText,
  isStreaming,
  error,
  models,
  model,
  pickerOpen,
  navItems,
  inputFiles = [],
  agentVariables,
  isInputFocused = false,
  isInputFullscreen = false,
  isVoiceMode = false,
  isRecording = false,
  isSending = false,
  inputError = '',
  onInputTextChange,
  onSend,
  onStop,
  onModelChange,
  onPickerOpenChange,
  onLongPressMessage,
  onMessageRef,
  onInputFocus,
  onInputBlur,
  onInputFullscreenToggle,
  onInputVoiceToggle,
  onInputAddImage,
  onInputAddFile,
  onInputRemoveFile,
  onInputClear,
  onInputVoiceStart,
  onInputVoiceEnd,
  onInputAgentVariableTextChange,
  onInputAgentVariableImageChange,
  colorScheme = 'light',
  showHeader = true,
  showModelBar = true,
  showInput = true,
  renderMessage,
  renderListHeader,
  renderListFooter,
  itemSeparatorComponent,
  containerStyle,
  flatListStyle,
}: ChatScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const currentModelName = models.find((m) => m.id === model)?.name || model

  const renderItem = ({ item, index }: { item: ChatScreenMessage; index: number }) => {
    const isUser = item.role === 'user'
    const isLastAi = item.role === 'assistant' && isStreaming && index === messages.length - 1
    const setRef = (el: View | null) => {
      if (onMessageRef) onMessageRef(item.id, el)
    }
    if (renderMessage) {
      return <>{renderMessage(item, index)}</>
    }
    return (
      <View style={isUser ? styles.msgEnd : styles.msgStart}>
        <Pressable
          ref={setRef}
          onLongPress={() => onLongPressMessage(item)}
          delayLongPress={500}
          style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAi]}
        >
          <Text style={styles.bubbleText}>
            {item.content || (isLastAi ? t('chat.thinking') : '')}
          </Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={[styles.container, containerStyle]}>
      {showHeader ? (
        <View style={styles.header}>
          <Text style={styles.title}>{t('chat.title')}</Text>
          <View style={styles.navRow}>
            {navItems.map((n) => (
              <TouchableOpacity
                key={n.key}
                onPress={n.onPress}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.navText}>{n.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}

      {showModelBar ? (
        <TouchableOpacity
          onPress={() => onPickerOpenChange(true)}
          style={styles.modelBar}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        >
          <Text style={styles.modelText}>
            {t('chat.modelLabel')}: {currentModelName} ▾
          </Text>
        </TouchableOpacity>
      ) : null}

      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => onPickerOpenChange(false)}
      >
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => onPickerOpenChange(false)}
        >
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>{t('chat.selectModel')}</Text>
            </View>
            <FlatList
              data={models}
              keyExtractor={(m) => m.id}
              renderItem={({ item }) => {
                const active = item.id === model
                return (
                  <Pressable
                    onPress={() => {
                      onModelChange(item.id)
                      onPickerOpenChange(false)
                    }}
                    style={styles.pickerItem}
                  >
                    <Text style={[styles.pickerItemName, active && styles.pickerItemNameActive]}>
                      {item.name || item.id}
                    </Text>
                    <Text style={styles.pickerItemProvider}>{item.provider}</Text>
                  </Pressable>
                )
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      <FlatList
        style={[styles.list, flatListStyle]}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ItemSeparatorComponent={
          itemSeparatorComponent !== undefined && itemSeparatorComponent !== null
            ? () => <>{itemSeparatorComponent}</>
            : () => <View style={styles.listGap} />
        }
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          renderListHeader !== undefined ? () => <>{renderListHeader}</> : undefined
        }
        ListFooterComponent={
          renderListFooter !== undefined ? () => <>{renderListFooter}</> : undefined
        }
      />

      {error ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {showInput ? (
        <MessageInput
          t={t}
          text={inputText}
          isStreaming={isStreaming}
          isSending={isSending}
          disabled={false}
          files={inputFiles}
          agentVariables={agentVariables}
          showAddFileBtn={true}
          isFocused={isInputFocused}
          isFullscreen={isInputFullscreen}
          isVoiceMode={isVoiceMode}
          isRecording={isRecording}
          error={inputError}
          onTextChange={onInputTextChange}
          onSend={onSend}
          onStop={onStop}
          onFocus={onInputFocus ?? (() => undefined)}
          onBlur={onInputBlur ?? (() => undefined)}
          onFullscreenToggle={onInputFullscreenToggle ?? (() => undefined)}
          onVoiceToggle={onInputVoiceToggle ?? (() => undefined)}
          onAddImage={onInputAddImage ?? (() => undefined)}
          onAddFile={onInputAddFile ?? (() => undefined)}
          onRemoveFile={onInputRemoveFile ?? (() => undefined)}
          onClear={onInputClear ?? (() => undefined)}
          onVoiceStart={onInputVoiceStart ?? (() => undefined)}
          onVoiceEnd={onInputVoiceEnd ?? (() => undefined)}
          onAgentVariableTextChange={onInputAgentVariableTextChange}
          onAgentVariableImageChange={onInputAgentVariableImageChange}
          colorScheme={colorScheme}
        />
      ) : null}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: tk.border.light,
    },
    title: { fontSize: 20, fontWeight: '600', color: tk.text.primary },
    navRow: { flexDirection: 'row', gap: 12 },
    navText: { fontSize: 14, color: tk.text.secondary },
    modelBar: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: tk.border.light,
    },
    modelText: { fontSize: 14, color: tk.text.secondary },
    list: { flex: 1, paddingHorizontal: 12 },
    listContent: { paddingVertical: 12 },
    listGap: { height: 10 },
    msgEnd: { alignItems: 'flex-end' },
    msgStart: { alignItems: 'flex-start' },
    bubble: {
      maxWidth: '80%',
      borderRadius: 15,
      paddingHorizontal: 10,
      paddingVertical: 10,
    },
    bubbleUser: { backgroundColor: tk.surface.muted, borderRadius: 12 },
    bubbleAi: {
      backgroundColor: tk.surface.light,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    bubbleText: { fontSize: 16, lineHeight: 22, color: tk.text.primary },
    errorWrap: { paddingHorizontal: 16, paddingBottom: 8 },
    errorText: { fontSize: 14, color: tk.danger.DEFAULT },
    pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.2)' },
    pickerSheet: {
      marginTop: 'auto',
      backgroundColor: tk.surface.light,
    },
    pickerHeader: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: tk.border.light,
    },
    pickerTitle: { fontSize: 16, fontWeight: '600', color: tk.text.primary },
    pickerItem: { paddingHorizontal: 16, paddingVertical: 12 },
    pickerItemName: { fontSize: 14, color: tk.text.medium },
    pickerItemNameActive: { color: tk.text.primary, fontWeight: '500' },
    pickerItemProvider: { marginTop: 2, fontSize: 12, color: tk.text.tertiary },
  })
}
