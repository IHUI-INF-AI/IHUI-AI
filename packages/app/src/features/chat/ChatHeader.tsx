// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo, type ReactNode } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { rnSpacing, rnType, rnRadius } from '@ihui/design-tokens'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { TFunction } from '../../types'

/**
 * 块 1:AI 聊天顶栏 / 折叠卡 / 压缩提示 —— 跨端共享(纯展示,零平台 API)
 *
 * 平台差异只走 props:图标节点由端侧注入(`icon` / `rightSlot`),组件自身不 import
 * 任何图标库、不读路由/存储/分享。RN 与小程序各自传自己的节点,视觉逐字不变。
 */

export interface ChatHeaderNavItem {
  key: string
  label: string
  /** 端侧图标节点(RN 传图标节点 / 小程序传 Image/LineIcon);不传只渲 label */
  icon?: ReactNode
  onPress?: () => void
}

export interface ChatHeaderProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  title: string
  /** 模型选择段;任一项缺失则整段不渲染 */
  modelLabel?: string
  modelName?: string
  onModelPress?: () => void
  navItems?: readonly ChatHeaderNavItem[]
  agentName?: string
  onAgentPress?: () => void
  onHelpPress?: () => void
  onHistoryPress?: () => void
  onClearPress?: () => void
  clearLabel?: string
  showClear?: boolean
  /** 端侧整栏覆盖(传则替代 navItems 区) */
  rightSlot?: ReactNode
}

export interface ChatCollapsibleCardProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  expanded: boolean
  onToggle: () => void
  /** 收起态文案 / 展开态文案 / 正文 */
  collapsedLabel: string
  expandedLabel: string
  title?: string
  body?: ReactNode
}

export interface ChatCompactionBannerProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  before: number
  after: number
  removed: number
}

export function ChatHeader({
  t,
  colorScheme = 'light',
  title,
  modelLabel,
  modelName,
  onModelPress,
  navItems,
  agentName,
  onAgentPress,
  onHelpPress,
  onHistoryPress,
  onClearPress,
  clearLabel,
  showClear = false,
  rightSlot,
}: ChatHeaderProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const hasModel = modelName !== undefined && modelName !== ''

  return (
    <View style={styles.header}>
      <View style={styles.left}>
        {hasModel ? (
          <TouchableOpacity
            onPress={onModelPress}
            disabled={onModelPress === undefined}
            style={styles.modelRow}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            accessibilityRole="button"
          >
            {modelLabel ? <Text style={styles.modelLabel}>{modelLabel}:</Text> : null}
            <Text style={styles.modelName} numberOfLines={1}>
              {modelName}
            </Text>
            <Text style={styles.chevron}>{'\u2304'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>

      <View style={styles.right}>
        {rightSlot !== undefined && rightSlot !== null ? (
          rightSlot
        ) : (
          <>
            {navItems?.map((item) => (
              <TouchableOpacity
                key={item.key}
                onPress={item.onPress}
                disabled={item.onPress === undefined}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                style={styles.navItem}
              >
                {item.icon ?? null}
                <Text style={styles.navText} numberOfLines={1}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
            {agentName ? (
              <TouchableOpacity
                onPress={onAgentPress}
                disabled={onAgentPress === undefined}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                accessibilityRole="button"
              >
                <Text style={styles.agentText} numberOfLines={1}>
                  {agentName}
                </Text>
              </TouchableOpacity>
            ) : null}
            {onHelpPress ? (
              <TouchableOpacity
                onPress={onHelpPress}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                accessibilityRole="button"
                accessibilityLabel={t('ai.chatMessageItem.thinkingProcess')}
              >
                <Text style={styles.helpText}>?</Text>
              </TouchableOpacity>
            ) : null}
            {onHistoryPress ? (
              <TouchableOpacity
                onPress={onHistoryPress}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                accessibilityRole="button"
              >
                <Text style={styles.navText}>{t('ai.history')}</Text>
              </TouchableOpacity>
            ) : null}
            {showClear && onClearPress ? (
              <TouchableOpacity
                onPress={onClearPress}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                accessibilityRole="button"
              >
                <Text style={styles.navText}>{clearLabel ?? t('ai.clear')}</Text>
              </TouchableOpacity>
            ) : null}
          </>
        )}
      </View>
    </View>
  )
}

export function ChatCollapsibleCard({
  colorScheme = 'light',
  expanded,
  onToggle,
  collapsedLabel,
  expandedLabel,
  title,
  body,
}: ChatCollapsibleCardProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  return (
    <View style={styles.card}>
      <TouchableOpacity
        onPress={onToggle}
        style={styles.cardButton}
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        accessibilityRole="button"
        accessibilityLabel={expanded ? expandedLabel : collapsedLabel}
      >
        <Text style={styles.cardButtonText} numberOfLines={1}>
          {(expanded ? expandedLabel : collapsedLabel) + (title ?? '')}
        </Text>
      </TouchableOpacity>
      {expanded && body !== undefined && body !== null ? (
        <View style={styles.cardBody}>{body}</View>
      ) : null}
    </View>
  )
}

export function ChatCompactionBanner({
  t,
  colorScheme = 'light',
  before,
  after,
  removed,
}: ChatCompactionBannerProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  return (
    <View style={styles.banner}>
      <Text style={styles.bannerTitle}>{t('chatAlert.compaction.title')}</Text>
      <Text style={styles.bannerMessage}>
        {t('chatAlert.compaction.message', { before, after, removed })}
      </Text>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
    },
    left: { flexDirection: 'row', alignItems: 'center' },
    modelRow: { flexDirection: 'row', alignItems: 'center' },
    modelLabel: { fontSize: rnType.label.size, color: tk.text.secondary },
    modelName: { fontSize: rnType.body.size, fontWeight: '600', color: tk.text.primary },
    chevron: {
      marginLeft: rnSpacing['2xs'],
      fontSize: rnType.label.size,
      color: tk.text.secondary,
    },
    title: {
      flex: 1,
      textAlign: 'center',
      fontSize: rnType.body.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
    right: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    navItem: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing['2xs'] },
    navText: { fontSize: rnType.body.size, color: tk.text.secondary },
    agentText: { fontSize: rnType.label.size, color: tk.text.secondary, maxWidth: 90 },
    helpText: { fontSize: rnType.title.size, fontWeight: '600', color: tk.text.secondary },
    card: { paddingHorizontal: rnSpacing.md, paddingVertical: rnSpacing['2xs'] },
    cardButton: { alignSelf: 'flex-start' },
    cardButtonText: { fontSize: rnType.label.size, color: tk.text.secondary },
    cardBody: {
      marginTop: rnSpacing.xs,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
      padding: rnSpacing.sm,
    },
    banner: {
      marginHorizontal: rnSpacing.md,
      marginTop: rnSpacing['2xs'],
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing['2xs'],
    },
    bannerTitle: { fontSize: rnType.label.size, fontWeight: '600', color: tk.text.secondary },
    bannerMessage: { fontSize: rnType.label.size, color: tk.text.secondary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
