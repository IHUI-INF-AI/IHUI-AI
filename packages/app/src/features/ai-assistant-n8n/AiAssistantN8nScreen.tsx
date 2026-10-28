// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AiAssistantN8nScreen AI 助手对话(共享层,平台无关 UI)
 *
 * 对齐 mobile-rn AiAssistantN8nScreen 核心 UI:
 * - 消息气泡列表(user 右 / assistant 左)
 * - 快捷操作 chip(无消息时输入区上方横向 suggestedQuestions)
 * - 模型选择条(位于输入区上方)
 * - 浅色优雅风,圆角守门(无 rounded-full);无分割线(gap 间距)
 */
import { useMemo } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { TextField } from '../../components/TextField'
import { EmptyState } from '../../components/ScreenStates'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { TFunction } from '../../types'
import { ChevronRight, Settings } from 'lucide-react-native'

import { rnRadius, rnRadiusFor, rnSpacing, rnType } from '@ihui/design-tokens'
import type { N8nMessage } from '@ihui/types'
export type { N8nMessage }

/** AiAssistantN8nScreen props(wrapper 注入数据+回调) */
export interface AiAssistantN8nScreenProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  messages: N8nMessage[]
  loading?: boolean
  refreshing?: boolean
  loadingMore?: boolean
  error?: string
  search?: string
  searchInput: string
  showSearch?: boolean
  selectedModelLabel: string
  showModelPicker?: boolean
  modelConfigVisible?: boolean
  modelConfig?: {
    temperature: number
    maxTokens: number
    topP: number
    systemPrompt: string
  }
  previewImage?: string | null
  toastVisible?: boolean
  toastType?: 'info' | 'error' | 'success' | 'warning'
  toastMessage?: string
  quickSuggestions: readonly string[]
  sending: boolean
  onRefresh?: () => void
  onEndReached?: () => void
  onSubmitSearch?: () => void
  onSearchInputChange?: (v: string) => void
  onSend?: (text: string) => void
  onStop?: () => void
  onModelPress: () => void
  onModelConfigPress: () => void
  onPreviewImage: (url: string) => void
  onClosePreview?: () => void
  emptyText: string
}

export function AiAssistantN8nScreen({
  t,
  colorScheme = 'light',
  messages,
  refreshing,
  loadingMore,
  selectedModelLabel,
  searchInput,
  quickSuggestions,
  sending,
  onRefresh,
  onEndReached,
  onSubmitSearch,
  onSearchInputChange,
  onSend,
  onStop,
  onModelPress,
  onModelConfigPress,
  onPreviewImage,
  emptyText,
}: AiAssistantN8nScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  // 渲染消息气泡
  function renderMessageBubble({ item }: { item: N8nMessage }) {
    const isUser = item.role === 'user'
    const hasImages = !isUser && item.images && item.images.length > 0

    return (
      <View style={[styles.messageRow, isUser ? styles.messageRowUser : styles.messageRowAi]}>
        <View
          style={[styles.messageBubble, isUser ? styles.messageBubbleUser : styles.messageBubbleAi]}
        >
          {item.content ? (
            <Text
              style={[styles.messageText, isUser ? styles.messageTextUser : styles.messageTextAi]}
            >
              {item.content}
            </Text>
          ) : null}
          {hasImages ? (
            <View style={styles.imageGrid}>
              {item.images!.map((url, i) => (
                <Pressable
                  key={`${url}-${i}`}
                  style={styles.imageItem}
                  onPress={() => onPreviewImage(url)}
                >
                  <Image source={{ uri: url }} style={styles.chatImage} resizeMode="cover" />
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      </View>
    )
  }

  return (
    <View style={styles.root}>
      {/* 消息列表 */}
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessageBubble}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing ?? false}
            onRefresh={onRefresh}
            tintColor={tk.text.tertiary}
          />
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerWrap}>
              <ActivityIndicator color={tk.brand.DEFAULT} size="small" />
            </View>
          ) : null
        }
        ListEmptyComponent={<EmptyState title={emptyText} colorScheme={colorScheme} />}
      />

      {/* 快捷操作区 */}
      {messages.length === 0 && quickSuggestions.length > 0 ? (
        <View style={styles.quickWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickScrollContent}
          >
            {quickSuggestions.map((question) => (
              <Pressable key={question} style={styles.quickChip} onPress={() => onSend?.(question)}>
                <Text style={styles.quickChipText} numberOfLines={1}>
                  {question}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* 模型选择条 */}
      <Pressable style={styles.modelBar} onPress={onModelPress}>
        <Text style={styles.modelBarLabel} numberOfLines={1}>
          {t('chat.modelLabel')}: {selectedModelLabel}
        </Text>
        <Pressable style={styles.modelConfigBtn} onPress={onModelConfigPress}>
          <Settings size={14} color={tk.text.secondary} />
          <Text style={styles.modelConfigBtnLabel}>{t('agent.config')}</Text>
        </Pressable>
        <ChevronRight size={20} color={tk.text.tertiary} style={styles.modelBarArrow} />
      </Pressable>

      {/* 输入区 */}
      <View style={styles.inputWrap}>
        <TextField
          colorScheme={colorScheme}
          style={styles.input}
          value={searchInput}
          onChangeText={onSearchInputChange}
          placeholder={t('aiAssistantN8n.placeholder')}
          placeholderTextColor={tk.text.tertiary}
          maxLength={2000}
          editable={!sending}
          returnKeyType="send"
          onSubmitEditing={onSubmitSearch}
        />
        {/* 发送/停止按钮:流式输出中变为停止(对齐 Uniapp BottomActionBar isLoading 模式) */}
        <Pressable
          style={styles.sendBtn}
          onPress={() => (sending ? onStop?.() : onSend?.(searchInput))}
          disabled={!sending && !searchInput.trim()}
        >
          {sending ? (
            <Text style={styles.sendBtnText}>{t('chat.stop')}</Text>
          ) : (
            <Text style={styles.sendBtnText}>{t('chat.send')}</Text>
          )}
        </Pressable>
      </View>

      {/* 流式状态条 */}
      {sending ? (
        <View style={styles.streamingBar}>
          <ActivityIndicator color={tk.brand.DEFAULT} size="small" />
          <Text style={styles.streamingText}>{t('aiAssistantN8n.streaming')}</Text>
        </View>
      ) : null}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: tk.surface.bg,
    } as ViewStyle,
    listContent: {
      paddingHorizontal: 10,
      paddingVertical: rnSpacing.sm,
      paddingBottom: rnSpacing.lg,
    } as ViewStyle,
    // 消息气泡
    messageRow: {
      flexDirection: 'row',
      marginVertical: rnSpacing.sm,
    } as ViewStyle,
    messageRowUser: {
      justifyContent: 'flex-end',
    } as ViewStyle,
    messageRowAi: {
      justifyContent: 'flex-start',
    } as ViewStyle,
    messageBubble: {
      maxWidth: '78%',
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadiusFor.bubble,
    } as ViewStyle,
    messageBubbleUser: {
      backgroundColor: tk.brand.cta,
    } as ViewStyle,
    messageBubbleAi: {
      backgroundColor: tk.surface.card,
    } as ViewStyle,
    messageText: {
      fontSize: rnType.title.size,
      lineHeight: 20,
    } as TextStyle,
    messageTextUser: {
      color: tk.brand.ctaForeground,
    } as TextStyle,
    messageTextAi: {
      color: tk.text.primary,
    } as TextStyle,
    // 回复内图片网格
    imageGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: rnSpacing.sm,
    } as ViewStyle,
    imageItem: {
      marginRight: rnSpacing.sm,
      marginBottom: rnSpacing.sm,
    } as ViewStyle,
    chatImage: {
      width: 120,
      height: 120,
      borderRadius: rnRadius.xl,
      backgroundColor: tk.surface.muted,
    } as ImageStyle,
    // 快捷操作区
    quickWrap: {
      backgroundColor: tk.surface.bg,
    } as ViewStyle,
    quickScrollContent: {
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      gap: rnSpacing.sm,
    } as ViewStyle,
    quickChip: {
      paddingHorizontal: rnSpacing.md,
      paddingVertical: 6,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.card,
      borderWidth: 1,
      borderColor: tk.border.light,
    } as ViewStyle,
    quickChipText: {
      fontSize: rnType.body.size,
      color: tk.text.secondary,
    } as TextStyle,
    // 模型选择条
    modelBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      backgroundColor: tk.surface.card,
    } as ViewStyle,
    modelBarLabel: {
      flex: 1,
      fontSize: rnType.body.size,
      color: tk.text.secondary,
    } as TextStyle,
    modelConfigBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.muted,
    } as ViewStyle,
    modelConfigBtnLabel: {
      fontSize: rnType.body.size,
      color: tk.text.secondary,
    } as TextStyle,
    modelBarArrow: {
      color: tk.text.tertiary,
      marginLeft: rnSpacing.sm,
    } as TextStyle,
    // 输入区
    inputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      backgroundColor: tk.surface.card,
    } as ViewStyle,
    input: {
      flex: 1,
      height: 50,
      paddingHorizontal: rnSpacing.md,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.muted,
      color: tk.text.primary,
      fontSize: rnType.title.size,
    } as ViewStyle,
    sendBtn: {
      marginLeft: rnSpacing.sm,
      paddingHorizontal: rnSpacing.lg,
      height: 50,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
      alignItems: 'center',
      justifyContent: 'center',
    } as ViewStyle,
    sendBtnText: {
      color: tk.brand.ctaForeground,
      fontSize: rnType.title.size,
      fontWeight: '600',
    } as TextStyle,
    // 流式状态条
    streamingBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 6,
      backgroundColor: tk.surface.card,
    } as ViewStyle,
    streamingText: {
      fontSize: rnType.body.size,
      color: tk.text.tertiary,
    } as TextStyle,
    footerWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: rnSpacing.md,
      gap: 6,
    } as ViewStyle,
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
