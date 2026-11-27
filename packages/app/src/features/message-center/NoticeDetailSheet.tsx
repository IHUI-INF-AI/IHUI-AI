// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).

/**
 * 站内消息详情抽屉(2026-11-27) —— RN 与小程序共用同一份实现。
 *
 * 数据一律由 @ihui/shared/notifications 的 buildNoticeDetail 投影后传入;
 * 平台只注入两个动作:onCopy(剪贴板) / onOpenSession(深链导航),其余三端同源。
 * 小程序经 rn-compat 直渲本组件(Modal 已在 Taro 侧有 Portal 实现)。
 */
import { rnRadiusFor, rnSpacing, rnType } from '@ihui/design-tokens'
import { useMemo, useEffect, useState } from 'react'
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import type { NoticeDetailSheetProps } from '@ihui/types'
import { noticeTypeLabelKey } from '@ihui/shared/notifications'
import { formatDateByTemplate } from '@ihui/shared/utils/date-utils'

import { getTokens, type AppThemeTokens } from '../../theme/tokens'

/** 详情/Props 类型 re-export(单一来源 @ihui/types) */
export type { NoticeDetailSheetProps }

export function NoticeDetailSheet({
  t,
  visible,
  detail,
  onClose,
  onCopy,
  onOpenSession,
  colorScheme = 'light',
}: NoticeDetailSheetProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  // 复制反馈就地做在共享组件里:三端不必各自弹 Toast,也避免"点了没动静"。
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    setCopied(false)
  }, [detail?.id])
  const handleCopy = () => {
    if (!detail || !onCopy) return
    onCopy(detail)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Modal
      visible={visible && detail !== null}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      // 安卓返回键 / 小程序遮罩点击统一走 onClose;内容区不吃遮罩事件
    >
      <View style={styles.root}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
          accessibilityLabel={t('common.close')}
        />
        {detail && (
          <View style={styles.sheet}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>{t('messageDetail.title')}</Text>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel={t('common.close')}
              >
                <Text style={styles.closeText}>{t('common.close')}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.metaRow}>
              <View style={styles.typeChip}>
                <Text style={styles.typeText}>{t(noticeTypeLabelKey(detail.type))}</Text>
              </View>
              {detail.createdAt.length > 0 && (
                <Text style={styles.metaText}>
                  {formatDateByTemplate(detail.createdAt, 'YYYY-MM-DD HH:mm')}
                </Text>
              )}
            </View>

            <Text style={styles.subject}>{detail.title || t('messageDetail.title')}</Text>

            {/* 全文区:保留换行;超长内容内部滚动,不把抽屉撑出屏幕 */}
            <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
              <Text style={styles.content} selectable>
                {detail.content || t('messageDetail.notFound')}
              </Text>
            </ScrollView>

            <View style={styles.footer}>
              {onCopy && (
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={handleCopy}
                  disabled={detail.content.length === 0}
                >
                  <Text style={styles.secondaryBtnText}>
                    {copied ? t('messageDetail.copied') : t('messageDetail.copy')}
                  </Text>
                </TouchableOpacity>
              )}
              {detail.sessionId && onOpenSession && (
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => onOpenSession(detail.sessionId as string)}
                >
                  <Text style={styles.primaryBtnText}>{t('messageDetail.viewSession')}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </View>
    </Modal>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    root: { flex: 1, justifyContent: 'flex-end' },
    // 遮罩独立成层:点空白关闭,但内容区(TouchableOpacity 之上的 sheet)不吃点击
    backdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    sheet: {
      maxHeight: '82%',
      backgroundColor: tk.surface.bg,
      borderTopLeftRadius: rnRadiusFor.card,
      borderTopRightRadius: rnRadiusFor.card,
      paddingHorizontal: rnSpacing.lg,
      paddingTop: rnSpacing.md,
      paddingBottom: rnSpacing.xl,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.md,
    },
    headerTitle: {
      fontSize: rnType.title.size,
      lineHeight: rnType.title.lineHeight,
      fontWeight: '600',
      color: tk.text.primary,
    },
    closeText: { fontSize: rnType.body.size, color: tk.text.secondary },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      marginTop: rnSpacing.sm,
    },
    typeChip: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing['2xs'],
      borderRadius: rnRadiusFor.chip,
      backgroundColor: tk.surface.muted,
    },
    typeText: { fontSize: rnType.caption.size, color: tk.text.secondary },
    metaText: { fontSize: rnType.caption.size, color: tk.text.secondary },
    subject: {
      marginTop: rnSpacing.md,
      fontSize: rnType.subtitle.size,
      lineHeight: rnType.subtitle.lineHeight,
      fontWeight: '600',
      color: tk.text.primary,
    },
    body: {
      marginTop: rnSpacing.sm,
      borderRadius: rnRadiusFor.card,
      backgroundColor: tk.surface.muted,
      // 抽屉有 maxHeight 82%:正文必须可收缩,否则超长消息会把 footer/关闭按钮顶出屏幕
      flexShrink: 1,
    },
    bodyContent: { padding: rnSpacing.md },
    content: {
      fontSize: rnType.body.size,
      lineHeight: rnType.body.lineHeight,
      color: tk.text.primary,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: rnSpacing.sm,
      marginTop: rnSpacing.md,
    },
    secondaryBtn: {
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadiusFor.chip,
      borderWidth: 1,
      borderColor: tk.border.medium,
    },
    secondaryBtnText: { fontSize: rnType.body.size, color: tk.text.primary },
    primaryBtn: {
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadiusFor.chip,
      backgroundColor: tk.brand.cta,
    },
    primaryBtnText: {
      fontSize: rnType.body.size,
      fontWeight: '600',
      color: tk.brand.ctaForeground,
    },
  })
}
