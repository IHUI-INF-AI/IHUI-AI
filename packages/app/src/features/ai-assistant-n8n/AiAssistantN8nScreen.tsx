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
  TextInput,
  View,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { TFunction } from '../../types'

/** N8n 消息项 */
export interface N8nMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  /** assistant 回复中提取的图片 URL 列表(对齐 Uniapp imgUrlList) */
  images?: string[]
}

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
        ListEmptyComponent={
          <View style={styles.centerWrap}>
            <Text style={styles.emptyText}>{emptyText}</Text>
          </View>
        }
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
          <Text style={styles.modelConfigBtnText}>⚙</Text>
          <Text style={styles.modelConfigBtnLabel}>{t('agent.config')}</Text>
        </Pressable>
        <Text style={styles.modelBarArrow}>{'›'}</Text>
      </Pressable>

      {/* 输入区 */}
      <View style={styles.inputWrap}>
        <TextInput
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
      paddingHorizontal: 16,
      paddingVertical: 8,
      paddingBottom: 16,
    } as ViewStyle,
    // 消息气泡
    messageRow: {
      flexDirection: 'row',
      marginVertical: 4,
    } as ViewStyle,
    messageRowUser: {
      justifyContent: 'flex-end',
    } as ViewStyle,
    messageRowAi: {
      justifyContent: 'flex-start',
    } as ViewStyle,
    messageBubble: {
      maxWidth: '78%',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
    } as ViewStyle,
    messageBubbleUser: {
      backgroundColor: tk.brand.DEFAULT,
    } as ViewStyle,
    messageBubbleAi: {
      backgroundColor: tk.surface.card,
    } as ViewStyle,
    messageText: {
      fontSize: 14,
      lineHeight: 20,
    } as TextStyle,
    messageTextUser: {
      color: tk.surface.light,
    } as TextStyle,
    messageTextAi: {
      color: tk.text.primary,
    } as TextStyle,
    // 回复内图片网格
    imageGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 8,
    } as ViewStyle,
    imageItem: {
      marginRight: 6,
      marginBottom: 6,
    } as ViewStyle,
    chatImage: {
      width: 120,
      height: 120,
      borderRadius: 6,
      backgroundColor: tk.surface.muted,
    } as ImageStyle,
    // 快捷操作区
    quickWrap: {
      backgroundColor: tk.surface.bg,
      borderTopWidth: 1,
      borderTopColor: tk.border.light,
    } as ViewStyle,
    quickScrollContent: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      gap: 8,
    } as ViewStyle,
    quickChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: tk.surface.card,
      borderWidth: 1,
      borderColor: tk.border.light,
    } as ViewStyle,
    quickChipText: {
      fontSize: 12,
      color: tk.text.secondary,
    } as TextStyle,
    // 模型选择条
    modelBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: tk.surface.card,
      borderTopWidth: 1,
      borderTopColor: tk.border.light,
    } as ViewStyle,
    modelBarLabel: {
      flex: 1,
      fontSize: 13,
      color: tk.text.secondary,
    } as TextStyle,
    modelConfigBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: tk.surface.muted,
    } as ViewStyle,
    modelConfigBtnText: {
      fontSize: 12,
      color: tk.text.secondary,
    } as TextStyle,
    modelConfigBtnLabel: {
      fontSize: 12,
      color: tk.text.secondary,
    } as TextStyle,
    modelBarArrow: {
      fontSize: 18,
      color: tk.text.tertiary,
      marginLeft: 8,
    } as TextStyle,
    // 输入区
    inputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: tk.surface.card,
      borderTopWidth: 1,
      borderTopColor: tk.border.light,
    } as ViewStyle,
    input: {
      flex: 1,
      height: 40,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: tk.surface.muted,
      color: tk.text.primary,
      fontSize: 14,
    } as ViewStyle,
    sendBtn: {
      marginLeft: 8,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: tk.brand.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
    } as ViewStyle,
    sendBtnText: {
      color: tk.surface.light,
      fontSize: 14,
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
      fontSize: 12,
      color: tk.text.tertiary,
    } as TextStyle,
    // 空态/加载态
    centerWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      gap: 12,
    } as ViewStyle,
    emptyText: {
      fontSize: 14,
      color: tk.text.tertiary,
      textAlign: 'center',
    } as TextStyle,
    loadingText: {
      fontSize: 14,
      color: tk.text.secondary,
      marginTop: 8,
    } as TextStyle,
    footerWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      gap: 6,
    } as ViewStyle,
    footerText: {
      fontSize: 12,
      color: tk.text.tertiary,
    } as TextStyle,
  })
}
