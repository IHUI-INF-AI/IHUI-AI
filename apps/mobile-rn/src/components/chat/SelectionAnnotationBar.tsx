// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// RN 端会话划词批注条(对齐 web d180-selection-annotations.tsx 的 SelectionAnnotationBar)。
// 无批注时整体不渲染(零占位);有批注渲染计数徽章 + 可展开面板(序号 + 选段原文 +
// 评论/未添加 + 评论输入/添加 + 单条移除 + 移除全部)。
//
// 文本一律走 t prop 注入(§19 禁止端内新增硬编码中文),由 ChatMessageItem 透传。

import { useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Eraser, MessageSquarePlus, X } from 'lucide-react-native'
import { TextField } from '@ihui/rn-app'
import { currentRnTheme, tokens } from '../../theme/active-tokens'
import { rnRadius, rnType } from '@ihui/design-tokens'
import { rpx } from '../../utils/rpx'
import {
  removeAllAnnotations,
  removeAnnotation,
  setComment,
  useSelectionAnnotations,
} from '../../lib/selection-annotations-store'

interface SelectionAnnotationBarProps {
  /** 消息 id */
  messageId: string
  /**
   * 归属会话 id(复合键的一半 —— 切对话后不串批注)。
   * 尚未关联后端对话的新会话为 null,此时落到 `''::msgId` 命名空间,仍在本屏内自洽。
   */
  conversationId: string | null
  /** i18n 取词(零端内硬编码中文) */
  t: (key: string, params?: Record<string, string | number>) => string
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: rpx(8),
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rpx(8),
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rpx(6),
    paddingHorizontal: rpx(12),
    paddingVertical: rpx(6),
    borderRadius: rnRadius.sm,
    backgroundColor: tokens.surface.muted,
  },
  badge: {
    minWidth: rpx(28),
    height: rpx(28),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: rnRadius.md,
    backgroundColor: tokens.brandAccent.deep,
    paddingHorizontal: rpx(6),
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: tokens.brandAccent.foreground,
  },
  removeAll: {
    alignItems: 'center',
    justifyContent: 'center',
    width: rpx(36),
    height: rpx(36),
    borderRadius: rnRadius.sm,
    backgroundColor: tokens.surface.muted,
  },
  panel: {
    marginTop: rpx(8),
    padding: rpx(16),
    borderRadius: rnRadius.xl,
    backgroundColor: tokens.surface.card,
    gap: rpx(12),
  },
  item: {
    gap: rpx(4),
  },
  label: {
    fontSize: rnType.label.size,
    fontWeight: '600',
    color: tokens.text.primary,
  },
  textMuted: {
    fontSize: rnType.label.size,
    color: tokens.text.tertiary,
  },
  textFg: {
    fontSize: rnType.label.size,
    color: tokens.text.primary,
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rpx(8),
    marginTop: rpx(4),
  },
  commentInput: {
    flex: 1,
    minWidth: 0,
    height: rpx(56),
    paddingHorizontal: rpx(12),
    borderRadius: rnRadius.sm,
    borderWidth: 1,
    borderColor: tokens.border.medium,
    backgroundColor: tokens.surface.bg,
    fontSize: rnType.label.size,
    color: tokens.text.primary,
  },
  addBtn: {
    paddingHorizontal: rpx(16),
    height: rpx(56),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: rnRadius.sm,
    backgroundColor: tokens.surface.muted,
  },
  addBtnText: {
    fontSize: rnType.label.size,
    color: tokens.text.secondary,
  },
  removeOne: {
    padding: rpx(6),
  },
})

/** 消息尾部划词批注条 */
export function SelectionAnnotationBar({
  messageId,
  conversationId,
  t,
}: SelectionAnnotationBarProps): ReactNode {
  const annotations = useSelectionAnnotations(conversationId, messageId)
  const [open, setOpen] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  if (annotations.length === 0) return null

  return (
    <View style={styles.wrap}>
      <View style={styles.barRow}>
        <Pressable
          onPress={() => setOpen((p) => !p)}
          style={styles.trigger}
          accessibilityRole="button"
          accessibilityLabel={t('selectionAnnotations.hoverHint')}
        >
          <MessageSquarePlus size={14} color={tokens.text.secondary} />
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{annotations.length}</Text>
          </View>
        </Pressable>
        <Pressable
          onPress={() => removeAllAnnotations(conversationId, messageId)}
          style={styles.removeAll}
          accessibilityRole="button"
          accessibilityLabel={t('selectionAnnotations.removeAll')}
        >
          <Eraser size={14} color={tokens.text.secondary} />
        </Pressable>
      </View>
      {open ? (
        <View style={styles.panel}>
          {annotations.map((a, i) => {
            const index = i + 1
            const draft = drafts[a.id] ?? ''
            return (
              <View key={a.id} style={styles.item}>
                <Text style={styles.label}>
                  {t('selectionAnnotations.originalText')} {index}
                </Text>
                <Text style={styles.textMuted}>{a.text}</Text>
                {a.comment ? (
                  <Text style={styles.textFg}>{a.comment}</Text>
                ) : (
                  <Text style={styles.textMuted}>{t('selectionAnnotations.noComment')}</Text>
                )}
                <View style={styles.commentRow}>
                  <TextField
                    colorScheme={currentRnTheme()}
                    style={styles.commentInput}
                    value={draft}
                    onChangeText={(v) => setDrafts((d) => ({ ...d, [a.id]: v }))}
                    placeholder={t('selectionAnnotations.commentPlaceholder')}
                    placeholderTextColor={tokens.text.tertiary}
                    accessibilityLabel={t('selectionAnnotations.commentAriaLabel')}
                  />
                  <Pressable
                    disabled={!draft.trim()}
                    onPress={() => {
                      setComment(conversationId, messageId, a.id, draft.trim())
                      setDrafts((d) => ({ ...d, [a.id]: '' }))
                    }}
                    style={styles.addBtn}
                  >
                    <Text style={styles.addBtnText}>{t('selectionAnnotations.addComment')}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => removeAnnotation(conversationId, messageId, a.id)}
                    style={styles.removeOne}
                    accessibilityRole="button"
                    accessibilityLabel={t('selectionAnnotations.removeOne')}
                  >
                    <X size={14} color={tokens.text.secondary} />
                  </Pressable>
                </View>
              </View>
            )
          })}
        </View>
      ) : null}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
