import { useEffect, useMemo, useRef } from 'react'
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { TFunction } from '../../types'

/** 私聊消息(平台注入,字段对齐 mobile-rn MessageChatScreen ChatMsg) */
export interface MessageChatMessage {
  id: string
  /** 发送者 ID(= fromUserId 别名) */
  senderId: string
  /** 是否为本机用户发送(决定左右对齐) */
  isMine: boolean
  content: string
  createdAt: string
}

/** MessageChatScreen props(注入式:wrapper 保留 API 调用) */
export interface MessageChatScreenProps {
  t: TFunction
  /** 对端昵称(header 标题) */
  title: string
  messages: MessageChatMessage[]
  loading: boolean
  error: string
  input: string
  sending: boolean
  onInputChange: (text: string) => void
  onSend: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/**
 * 私聊共享屏 — props 注入式跨端组件
 *
 * 平台无关:负责渲染 header(返回 + 对端昵称)+ 消息列表(本机右对齐 + 对端左对齐)
 * + 输入框 + 发送按钮 + 自动滚动到底部。平台特定(API/导航)由 wrapper 注入。
 */
export function MessageChatScreen({
  t,
  title,
  messages,
  loading,
  error,
  input,
  sending,
  onInputChange,
  onSend,
  onBack,
  colorScheme = 'light',
}: MessageChatScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const listRef = useRef<FlatList<MessageChatMessage> | null>(null)

  useEffect(() => {
    if (messages.length > 0) {
      const timer = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [messages.length])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={tk.brand.DEFAULT} />
        <Text style={styles.muted}>{t('common.loading')}</Text>
      </View>
    )
  }

  if (error && messages.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
        <TouchableOpacity style={styles.btn} onPress={onBack}>
          <Text style={styles.btnText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.back}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>
      <FlatList
        ref={(r) => {
          listRef.current = r
        }}
        data={messages}
        keyExtractor={(item) => item.id}
        style={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.muted}>{t('messageChat.empty')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.msg, item.isMine ? styles.msgMine : styles.msgPeer]}>
            <Text style={styles.content}>{item.content}</Text>
            <Text style={styles.meta}>{item.createdAt}</Text>
          </View>
        )}
      />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={onInputChange}
          placeholder={t('messageChat.placeholder')}
          placeholderTextColor={tk.text.tertiary}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || sending) && styles.sendDisabled]}
          onPress={onSend}
          disabled={!input.trim() || sending}
        >
          <Text style={styles.sendText}>{t('messageChat.send')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
      paddingHorizontal: 16,
      paddingTop: 48,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.surface.bg,
      padding: 16,
    },
    muted: { marginTop: 8, fontSize: 13, color: tk.text.secondary },
    error: { fontSize: 13, color: tk.error.text, marginBottom: 8, textAlign: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
    back: { fontSize: 14, color: tk.text.secondary },
    title: { flex: 1, fontSize: 18, fontWeight: '600', color: tk.text.primary },
    list: { flex: 1 },
    empty: { paddingVertical: 40, alignItems: 'center' },
    msg: { padding: 10, borderRadius: 8, marginBottom: 8, maxWidth: '80%' },
    msgMine: { alignSelf: 'flex-end', backgroundColor: tk.brand.DEFAULT },
    msgPeer: { alignSelf: 'flex-start', backgroundColor: tk.surface.card },
    content: { fontSize: 14, color: tk.surface.light },
    meta: { marginTop: 4, fontSize: 10, color: 'rgba(255,255,255,0.7)' },
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
    input: {
      flex: 1,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
      fontSize: 14,
      color: tk.text.primary,
    },
    sendBtn: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: tk.brand.DEFAULT,
    },
    sendDisabled: { backgroundColor: tk.text.tertiary },
    sendText: { color: tk.surface.light, fontSize: 14, fontWeight: '600' },
    btn: {
      marginTop: 12,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: tk.brand.DEFAULT,
    },
    btnText: { color: tk.surface.light, fontSize: 14 },
  })
}
