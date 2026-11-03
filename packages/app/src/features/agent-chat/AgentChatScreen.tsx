// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useEffect, useMemo, useRef } from 'react'
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { TextField } from '../../components/TextField'
import { ChevronLeft } from 'lucide-react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { AgentChatMessage, AgentChatScreenProps } from '../../types'

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'
import { EmptyState, ScreenSkeleton } from '../../components/ScreenStates'

/** 流式回复的临时气泡 id:不参与服务端 id 空间,仅供 FlatList keyExtractor 稳定 */
const PENDING_MESSAGE_ID = '__streaming_assistant__'

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
  pendingAssistantText,
  streaming,
  onStopStreaming,
  sendError,
}: AgentChatScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const listRef = useRef<FlatList<AgentChatMessage> | null>(null)

  // 流式气泡只在宿主显式传入 pendingAssistantText 时出现(undefined = 该宿主未接入流式)。
  const listData = useMemo<AgentChatMessage[]>(() => {
    if (pendingAssistantText === undefined) return messages
    return [
      ...messages,
      { id: PENDING_MESSAGE_ID, role: 'assistant', content: pendingAssistantText },
    ]
  }, [messages, pendingAssistantText])

  // 消息列表变化(含流式增量)时自动滚动到底部(共享层持有 ref,根治跨端重复实现)
  useEffect(() => {
    if (listData.length > 0) {
      const timer = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [listData.length, pendingAssistantText])

  if (loading) {
    return <ScreenSkeleton variant="list" count={4} colorScheme={colorScheme} />
  }
  if (error && messages.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={onBack}
          accessibilityLabel={t('common.back')}
        >
          <ChevronLeft size={16} color={tk.brand.ctaForeground} />
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>
      <FlatList
        ref={(r) => {
          listRef.current = r
        }}
        data={listData}
        keyExtractor={(item) => item.id}
        style={styles.list}
        ListEmptyComponent={<EmptyState title={t('agentChat.empty')} colorScheme={colorScheme} />}
        renderItem={({ item }) => {
          const pending = item.id === PENDING_MESSAGE_ID
          return (
            <View style={[styles.msg, item.role === 'user' ? styles.msgUser : styles.msgAssistant]}>
              {pending && item.content === '' ? (
                // 首包(delta)到达前的流式加载态;文本到达后立即换成增量内容
                <ActivityIndicator size="small" color={tk.text.tertiary} />
              ) : (
                <Text
                  style={[
                    styles.msgText,
                    item.role === 'user' ? styles.msgTextUser : styles.msgTextAssistant,
                  ]}
                >
                  {item.content}
                </Text>
              )}
            </View>
          )
        }}
      />
      {sendError ? <Text style={styles.sendError}>{sendError}</Text> : null}
      <View style={styles.inputRow}>
        <TextField
          colorScheme={colorScheme}
          style={styles.input}
          value={input}
          onChangeText={onInputChange}
          placeholder={t('agentChat.placeholder')}
          placeholderTextColor={tk.text.tertiary}
        />
        {streaming === true && onStopStreaming ? (
          <TouchableOpacity
            style={styles.stopBtn}
            onPress={onStopStreaming}
            accessibilityLabel={t('agentChat.stop')}
          >
            <Text style={styles.sendBtnText}>{t('agentChat.stop')}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.sendBtn, !input.trim() || sending ? styles.sendBtnDisabled : null]}
            onPress={onSend}
            disabled={!input.trim() || sending}
          >
            <Text style={styles.sendBtnText}>{t('agentChat.send')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
      paddingHorizontal: rnSpacing['sm-loose'],
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.md,
      marginBottom: rnSpacing.sm,
    },
    title: { flex: 1, fontSize: rnType.heading.size, fontWeight: '700', color: tk.text.primary },
    list: { flex: 1 },
    msg: {
      maxWidth: '85%',
      marginBottom: rnSpacing.sm,
      borderRadius: rnRadius.xl,
      padding: rnSpacing['sm-loose'],
    },
    msgUser: { alignSelf: 'flex-end', backgroundColor: tk.brand.cta },
    msgAssistant: { alignSelf: 'flex-start', backgroundColor: tk.surface.card },
    msgText: { fontSize: rnType.title.size },
    msgTextUser: { color: tk.surface.light },
    msgTextAssistant: { color: tk.text.primary },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing.sm,
    },
    input: {
      flex: 1,
      height: 50,
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: rnRadius.sm,
      paddingHorizontal: rnSpacing.md,
      fontSize: rnType.title.size,
      color: tk.text.primary,
      backgroundColor: tk.surface.muted,
    },
    sendBtn: {
      paddingHorizontal: rnSpacing['md-loose'],
      height: 50,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendBtnDisabled: { opacity: 0.5 },
    stopBtn: {
      paddingHorizontal: rnSpacing['md-loose'],
      height: 50,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendBtnText: { color: tk.surface.light, fontSize: rnType.title.size, fontWeight: '600' },
    sendError: {
      fontSize: rnType.caption.size,
      color: tk.error.text,
      marginBottom: rnSpacing.xs,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: rnSpacing.lg,
      backgroundColor: tk.surface.bg,
    },
    error: {
      fontSize: rnType.body.size,
      color: tk.error.text,
      textAlign: 'center',
      marginBottom: rnSpacing.sm,
    },
    backBtn: {
      paddingHorizontal: rnSpacing.lg,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
    },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
