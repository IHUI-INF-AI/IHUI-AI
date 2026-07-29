import { useEffect, useMemo, useRef } from 'react'
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { AgentChatMessage, AgentChatScreenProps } from '../../types'

/** Agent 聊天共享屏 — props 注入式跨端组件(wrapper 保留 API 调用,共享层负责渲染+自动滚动) */
export type { AgentChatScreenProps }

export function AgentChatScreen({
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
}: AgentChatScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const listRef = useRef<FlatList<AgentChatMessage> | null>(null)

  // 消息列表变化时自动滚动到底部(共享层持有 ref,根治跨端重复实现)
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
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
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
            <Text style={styles.muted}>{t('agentChat.empty')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View
            style={[
              styles.msg,
              item.role === 'user' ? styles.msgUser : styles.msgAssistant,
            ]}
          >
            <Text
              style={[
                styles.msgText,
                item.role === 'user' ? styles.msgTextUser : styles.msgTextAssistant,
              ]}
            >
              {item.content}
            </Text>
          </View>
        )}
      />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={onInputChange}
          placeholder={t('agentChat.placeholder')}
          placeholderTextColor={tk.text.tertiary}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !input.trim() || sending ? styles.sendBtnDisabled : null]}
          onPress={onSend}
          disabled={!input.trim() || sending}
        >
          <Text style={styles.sendBtnText}>{t('agentChat.send')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg, paddingHorizontal: 16, paddingTop: 48 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 8,
    },
    back: { fontSize: 14, color: tk.text.secondary },
    title: { flex: 1, fontSize: 18, fontWeight: '600', color: tk.text.primary },
    list: { flex: 1 },
    empty: { paddingVertical: 40, alignItems: 'center' },
    muted: { fontSize: 13, color: tk.text.secondary },
    msg: {
      maxWidth: '85%',
      marginBottom: 8,
      borderRadius: 8,
      padding: 10,
    },
    msgUser: { alignSelf: 'flex-end', backgroundColor: tk.brand.DEFAULT },
    msgAssistant: { alignSelf: 'flex-start', backgroundColor: tk.surface.card },
    msgText: { fontSize: 14 },
    msgTextUser: { color: tk.surface.light },
    msgTextAssistant: { color: tk.text.primary },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 8,
    },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 14,
      color: tk.text.primary,
    },
    sendBtn: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: tk.brand.DEFAULT,
    },
    sendBtnDisabled: { opacity: 0.5 },
    sendBtnText: { color: tk.surface.light, fontSize: 14, fontWeight: '600' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: tk.surface.bg },
    error: { fontSize: 13, color: tk.error.text, textAlign: 'center', marginBottom: 8 },
    backBtn: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: tk.brand.DEFAULT,
    },
    backBtnText: { color: tk.surface.light, fontSize: 14 },
  })
}
