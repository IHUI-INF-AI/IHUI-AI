// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { MessageSquare, Trash2 } from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { TFunction } from '../../types'
import { getTokens, type AppThemeMode, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { TextField } from '../../components/TextField'

/**
 * 私信会话内容共享屏 —— 承载 web /letters 右侧 ChatWindow(同口径:消息按 id 升序、
 * 我方右对齐 cta 实底/对方左对齐 muted、删除逐条确认、发送 1000 字上限)。
 * 平台无关:GET /api/private-letters/list、POST、DELETE 与确认弹窗(appAlert/Taro.showModal)
 * 由薄壳注入 —— 与 CartScreen「删除确认留在薄壳」同一先例。
 */
export interface LetterChatMessageRow {
  id: number
  content: string
  /** 薄壳按 web helpers.ts 同参格式化(zh-CN,MM/DD HH:mm) */
  timeText: string
  mine: boolean
}

export interface LetterChatScreenProps {
  t: TFunction
  colorScheme: AppThemeMode
  onBack: () => void
  /** 会话标题(对方昵称) */
  memberName: string
  loading: boolean
  error: string | null
  /** 消息按时间倒序传入(FlatList inverted ⇒ 视觉上最新在底部) */
  messages: LetterChatMessageRow[]
  draft: string
  onDraftChange: (value: string) => void
  sending: boolean
  sendError: string | null
  /** 正在删除中的消息 id(按钮禁用态,与 web deletingId 同口径) */
  deletingId: number | null
  onSend: () => void
  onRequestDelete: (message: LetterChatMessageRow) => void
}

export function LetterChatScreen({
  t,
  colorScheme,
  onBack,
  memberName,
  loading,
  error,
  messages,
  draft,
  onDraftChange,
  sending,
  sendError,
  deletingId,
  onSend,
  onRequestDelete,
}: LetterChatScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('lettersPage.back')} colorScheme={colorScheme} />
        <View style={styles.avatarBox}>
          <Text style={styles.avatarText}>{(memberName || '?').slice(0, 1)}</Text>
        </View>
        <Text style={styles.headerName} numberOfLines={1}>
          {memberName}
        </Text>
      </View>

      {loading ? (
        <View style={styles.centerBlock}>
          <ActivityIndicator size="small" color={tk.brand.DEFAULT} />
          <Text style={styles.muted}>{t('lettersPage.loading')}</Text>
        </View>
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : messages.length === 0 ? (
        <View style={styles.centerBlock}>
          <MessageSquare size={30} color={tk.text.tertiary} />
          <Text style={styles.muted}>{t('lettersPage.empty')}</Text>
        </View>
      ) : (
        <FlatList<LetterChatMessageRow>
          data={messages}
          inverted
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const isDeleting = deletingId === item.id
            return (
              <View style={item.mine ? styles.rowMine : styles.rowTheirs}>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => onRequestDelete(item)}
                  disabled={isDeleting}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Trash2 size={13} color={tk.text.tertiary} />
                </TouchableOpacity>
                <View style={item.mine ? styles.bubbleMine : styles.bubbleTheirs}>
                  <Text style={item.mine ? styles.bubbleMineText : styles.bubbleTextTheirs}>
                    {item.content}
                  </Text>
                  <Text style={item.mine ? [styles.bubbleMineText, styles.bubbleTimeMine] : styles.bubbleTimeTheirs}>
                    {item.mine ? `${t('lettersPage.you')} · ` : ''}
                    {item.timeText}
                  </Text>
                </View>
              </View>
            )
          }}
        />
      )}

      {sendError ? <Text style={styles.error}>{sendError}</Text> : null}

      <View style={styles.composer}>
        <TextField
          colorScheme={colorScheme}
          style={styles.composerInput}
          value={draft}
          onChangeText={onDraftChange}
          placeholder={t('lettersPage.sendPlaceholder')}
          placeholderTextColor={tk.text.tertiary}
          maxLength={1000}
          onSubmitEditing={onSend}
          returnKeyType="send"
          editable={!sending}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (sending || !draft.trim()) && styles.sendBtnDisabled]}
          onPress={onSend}
          disabled={sending || !draft.trim()}
        >
          {sending ? (
            <ActivityIndicator size="small" color={tk.brand.ctaForeground} />
          ) : (
            <Text style={styles.sendText}>{t('lettersPage.send')}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.md,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      backgroundColor: tk.surface.muted,
    },
    avatarBox: {
      width: 36,
      height: 36,
      borderRadius: rnRadius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.surface.card,
    },
    avatarText: { fontSize: rnType.label.size, fontWeight: '500', color: tk.text.secondary },
    headerName: { flex: 1, fontSize: rnType.body.size, fontWeight: '500', color: tk.text.primary },
    centerBlock: {
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing['2xl'],
      paddingHorizontal: rnSpacing.md,
    },
    muted: { fontSize: rnType.label.size, color: tk.text.secondary },
    error: {
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      fontSize: rnType.body.size,
      color: tk.danger.DEFAULT,
    },
    listContent: { paddingHorizontal: rnSpacing.md, paddingTop: rnSpacing.md },
    rowMine: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'flex-end',
      gap: rnSpacing.xs,
      marginBottom: rnSpacing.md,
    },
    rowTheirs: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
      alignItems: 'flex-end',
      gap: rnSpacing.xs,
      marginBottom: rnSpacing.md,
    },
    deleteBtn: { padding: rnSpacing.xs },
    bubbleMine: {
      maxWidth: '70%',
      borderRadius: rnRadius.xl,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      backgroundColor: tk.brand.cta,
    },
    bubbleTheirs: {
      maxWidth: '70%',
      borderRadius: rnRadius.xl,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      backgroundColor: tk.surface.muted,
    },
    bubbleMineText: { fontSize: rnType.body.size, color: tk.brand.ctaForeground },
    bubbleTextTheirs: { fontSize: rnType.body.size, color: tk.text.primary },
    bubbleTimeMine: {
      marginTop: 2,
      textAlign: 'right',
      fontSize: rnType.caption.size,
    },
    bubbleTimeTheirs: {
      marginTop: 2,
      textAlign: 'right',
      fontSize: rnType.caption.size,
      color: tk.text.tertiary,
    },
    composer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      padding: rnSpacing.md,
      borderTopWidth: 1,
      borderTopColor: tk.border.light,
    },
    composerInput: {
      flex: 1,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: 10,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
      fontSize: rnType.body.size,
      color: tk.text.primary,
      backgroundColor: tk.surface.inputBg,
    },
    sendBtn: {
      paddingHorizontal: rnSpacing.lg,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
    },
    sendBtnDisabled: { opacity: 0.5 },
    sendText: { color: tk.brand.ctaForeground, fontSize: rnType.body.size, fontWeight: '600' },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
