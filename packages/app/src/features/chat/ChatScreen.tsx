import { useEffect, useMemo, useRef } from 'react'
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type {
  ChatScreenMessage,
  ChatScreenModel,
  ChatScreenNavItem,
  ChatScreenProps,
} from '../../types'

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
  onInputTextChange,
  onSend,
  onStop,
  onModelChange,
  onPickerOpenChange,
  onLongPressMessage,
  onMessageRef,
  colorScheme = 'light',
}: ChatScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const listRef = useRef<FlatList<ChatScreenMessage> | null>(null)

  // 消息列表变化时自动滚动到底部(对齐 AgentChatScreen/LiveChatScreen 共享层模式)
  useEffect(() => {
    if (messages.length > 0) {
      const timer = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [messages.length])

  const currentModelName = models.find((m) => m.id === model)?.name || model

  const renderItem = ({ item, index }: { item: ChatScreenMessage; index: number }) => {
    const isUser = item.role === 'user'
    const isLastAi =
      item.role === 'assistant' && isStreaming && index === messages.length - 1
    const setRef = (el: View | null) => {
      if (onMessageRef) onMessageRef(item.id, el)
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
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('chat.title')}</Text>
        <View style={styles.navRow}>
          {navItems.map((n) => (
            <TouchableOpacity key={n.key} onPress={n.onPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.navText}>{n.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity
        onPress={() => onPickerOpenChange(true)}
        style={styles.modelBar}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      >
        <Text style={styles.modelText}>
          {t('chat.modelLabel')}: {currentModelName} ▾
        </Text>
      </TouchableOpacity>

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
        ref={(r) => {
          listRef.current = r
        }}
        style={styles.list}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={styles.listGap} />}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
      />

      {error ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={onInputTextChange}
          placeholder={t('chat.inputPlaceholder')}
          placeholderTextColor={tk.text.tertiary}
        />
        {isStreaming ? (
          <TouchableOpacity style={[styles.sendBtn, styles.sendBtnStop]} onPress={onStop}>
            <Text style={styles.sendBtnText}>{t('chat.stop')}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
            onPress={onSend}
            disabled={!inputText.trim()}
          >
            <Text style={styles.sendBtnText}>{t('chat.send')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  const primary = tk.brand.DEFAULT
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: tk.border.light,
    },
    title: { fontSize: 18, fontWeight: '600', color: tk.text.primary },
    navRow: { flexDirection: 'row', gap: 12 },
    navText: { fontSize: 13, color: tk.text.secondary },
    modelBar: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: tk.border.light,
    },
    modelText: { fontSize: 12, color: tk.text.secondary },
    list: { flex: 1, paddingHorizontal: 16 },
    listContent: { paddingVertical: 12 },
    listGap: { height: 8 },
    msgEnd: { alignItems: 'flex-end' },
    msgStart: { alignItems: 'flex-start' },
    bubble: {
      maxWidth: '80%',
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    bubbleUser: { backgroundColor: tk.surface.muted },
    bubbleAi: {
      backgroundColor: tk.surface.light,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    bubbleText: { fontSize: 14, color: tk.text.primary },
    errorWrap: { paddingHorizontal: 16, paddingBottom: 8 },
    errorText: { fontSize: 13, color: tk.danger.DEFAULT },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: tk.border.light,
      paddingHorizontal: 16,
      paddingVertical: 8,
      gap: 8,
    },
    input: {
      flex: 1,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
      fontSize: 14,
      color: tk.text.primary,
      backgroundColor: tk.surface.light,
    },
    sendBtn: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: primary,
    },
    sendBtnStop: {
      backgroundColor: tk.surface.muted,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    sendBtnDisabled: { backgroundColor: tk.text.tertiary },
    sendBtnText: { color: tk.surface.light, fontSize: 13, fontWeight: '600' },
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
    pickerTitle: { fontSize: 14, fontWeight: '600', color: tk.text.primary },
    pickerItem: { paddingHorizontal: 16, paddingVertical: 12 },
    pickerItemName: { fontSize: 13, color: tk.text.medium },
    pickerItemNameActive: { color: tk.text.primary, fontWeight: '500' },
    pickerItemProvider: { marginTop: 2, fontSize: 12, color: tk.text.tertiary },
  })
}
