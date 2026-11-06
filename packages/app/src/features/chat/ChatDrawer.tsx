// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会话抽屉共享层（块 5，契约见同目录 CONTRACTS.md）。
 *
 * 零平台 API：不读存储、不取会话、不跳路由、不弹系统框。会话数据、打开/关闭、
 * 选择/删除/收藏、底部入口全部由 props 注入。
 *
 * 顺序口径：会话按 wrapper 传入顺序原样渲染（置顶 / 收藏 / 日期桶的顺序由
 * wrapper 排好），时间列直接展示传入的 timeLabel，本组件不重新分组、不排序。
 * 契约明确禁止滑动手势，删除与收藏用行内显式按钮。
 */
import { useMemo } from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { rnGeometry, rnRadius, rnRadiusFor, rnSpacing, rnType } from '@ihui/design-tokens'
import type { TFunction } from '@ihui/types'

import { getTokens, type AppThemeTokens } from '../../theme/tokens'

export interface ChatDrawerConversation {
  id: string
  title: string
  timeLabel: string
  pinned?: boolean
  favorited?: boolean
  modelName?: string
}

export interface ChatDrawerTab {
  key: string
  label: string
}

export interface ChatDrawerProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  open: boolean
  conversations?: readonly ChatDrawerConversation[]
  tabs?: readonly ChatDrawerTab[]
  activeTab?: string
  /** 顶栏是否显示"领取免费额度"入口 */
  showClaimFree?: boolean

  onClose: () => void
  onTabChange?: (key: string) => void
  onSelectConversation?: (id: string) => void
  onDeleteConversation?: (id: string) => void
  onToggleFavorite?: (id: string, next: boolean) => void
  onCreateNewChat: () => void
  onOpenSettings?: () => void
  onOpenMessages?: () => void
  onGoHome?: () => void
  onClaimFree?: () => void
  onNavigateDomain?: (key: string) => void
}

export function ChatDrawer({
  t,
  colorScheme = 'light',
  open,
  conversations = [],
  tabs = [],
  activeTab,
  showClaimFree = false,
  onClose,
  onTabChange,
  onSelectConversation,
  onDeleteConversation,
  onToggleFavorite,
  onCreateNewChat,
  onOpenSettings,
  onOpenMessages,
  onGoHome,
  onClaimFree,
}: ChatDrawerProps) {
  const tokens = useMemo(() => getTokens(colorScheme), [colorScheme])
  const styles = useMemo(() => createStyles(tokens), [tokens])

  if (!open) return null

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.panel} onPress={(event) => event.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{t('drawer.history')}</Text>
            <TouchableOpacity
              style={styles.closeButton}
              hitSlop={8}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
            >
              <Text style={styles.closeGlyph}>{'✕'}</Text>
            </TouchableOpacity>
          </View>

          {showClaimFree && onClaimFree ? (
            <TouchableOpacity
              style={styles.claimFree}
              activeOpacity={0.7}
              onPress={onClaimFree}
              accessibilityRole="button"
            >
              <Text style={styles.claimFreeText}>{t('drawer.claimFree')}</Text>
            </TouchableOpacity>
          ) : null}

          {tabs.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.tabBar}
              contentContainerStyle={styles.tabBarContent}
            >
              {tabs.map((tab) => {
                const active = tab.key === activeTab
                return (
                  <TouchableOpacity
                    key={tab.key}
                    style={[styles.chip, active ? styles.chipActive : null]}
                    activeOpacity={0.7}
                    onPress={onTabChange ? () => onTabChange(tab.key) : undefined}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.chipText, active ? styles.chipActiveText : null]}>
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          ) : null}

          <TouchableOpacity
            style={styles.newChat}
            activeOpacity={0.7}
            onPress={onCreateNewChat}
            accessibilityRole="button"
          >
            <Text style={styles.newChatGlyph}>{'+'}</Text>
            <Text style={styles.newChatText}>{t('drawer.newChat')}</Text>
          </TouchableOpacity>

          <Text style={styles.sectionLabel}>{t('drawer.history')}</Text>

          {conversations.length === 0 ? (
            <Text style={styles.emptyText}>{t('drawer.noHistory')}</Text>
          ) : (
            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {conversations.map((conversation) => (
                <View key={conversation.id} style={styles.conversationRow}>
                  <TouchableOpacity
                    style={styles.conversationMain}
                    activeOpacity={0.7}
                    onPress={
                      onSelectConversation ? () => onSelectConversation(conversation.id) : undefined
                    }
                    accessibilityRole="button"
                  >
                    <View style={styles.titleRow}>
                      {conversation.pinned ? <Text style={styles.pinMark}>{'↑'}</Text> : null}
                      {conversation.favorited ? (
                        <Text style={styles.favoriteMark}>{'★'}</Text>
                      ) : null}
                      <Text style={styles.conversationTitle} numberOfLines={1}>
                        {conversation.title}
                      </Text>
                    </View>
                    <View style={styles.metaRow}>
                      <Text style={styles.conversationTime}>{conversation.timeLabel}</Text>
                      {conversation.modelName ? (
                        <Text style={styles.conversationModel} numberOfLines={1}>
                          {conversation.modelName}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>

                  {onToggleFavorite ? (
                    <TouchableOpacity
                      style={styles.actionButton}
                      activeOpacity={0.7}
                      onPress={() => onToggleFavorite(conversation.id, !conversation.favorited)}
                      accessibilityRole="button"
                    >
                      <Text style={styles.actionText}>
                        {conversation.favorited ? t('drawer.collected') : t('drawer.collect')}
                      </Text>
                    </TouchableOpacity>
                  ) : null}

                  {onDeleteConversation ? (
                    <TouchableOpacity
                      style={styles.actionButton}
                      activeOpacity={0.7}
                      onPress={() => onDeleteConversation(conversation.id)}
                      accessibilityRole="button"
                    >
                      <Text style={styles.deleteText}>{t('drawer.delete')}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}
            </ScrollView>
          )}

          <View style={styles.footer}>
            {onOpenSettings ? (
              <TouchableOpacity
                style={styles.footerButton}
                activeOpacity={0.7}
                onPress={onOpenSettings}
                accessibilityRole="button"
              >
                <Text style={styles.footerText}>{t('menu.settings')}</Text>
              </TouchableOpacity>
            ) : null}
            {onOpenMessages ? (
              <TouchableOpacity
                style={styles.footerButton}
                activeOpacity={0.7}
                onPress={onOpenMessages}
                accessibilityRole="button"
              >
                <Text style={styles.footerText}>{t('menu.messageCenter')}</Text>
              </TouchableOpacity>
            ) : null}
            {onGoHome ? (
              <TouchableOpacity
                style={styles.footerButton}
                activeOpacity={0.7}
                onPress={onGoHome}
                accessibilityRole="button"
              >
                <Text style={styles.footerText}>{t('profile.backHome')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function createStyles(tokens: AppThemeTokens) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      flexDirection: 'row',
      backgroundColor: tokens.overlay.modal,
    },
    panel: {
      width: rnGeometry.drawerWidth,
      maxWidth: '80%',
      height: '100%',
      backgroundColor: tokens.surface.card,
      paddingHorizontal: rnSpacing.md,
      paddingTop: rnSpacing.md,
      paddingBottom: rnSpacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: rnSpacing.sm,
    },
    headerTitle: {
      fontSize: rnType.title.size,
      fontWeight: '600',
      color: tokens.text.primary,
    },
    closeButton: {
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeGlyph: {
      fontSize: rnType.title.size,
      color: tokens.text.tertiary,
    },
    claimFree: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing.xs,
      marginBottom: rnSpacing.sm,
      borderRadius: rnRadius.md,
      backgroundColor: tokens.surface.muted,
    },
    claimFreeText: {
      fontSize: rnType.bodySm.size,
      color: tokens.text.primary,
    },
    tabBar: {
      flexGrow: 0,
      marginBottom: rnSpacing.sm,
    },
    tabBarContent: {
      gap: rnSpacing.sm,
    },
    chip: {
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.md,
      backgroundColor: tokens.surface.muted,
    },
    chipActive: {
      backgroundColor: tokens.brand.cta,
    },
    chipText: {
      fontSize: rnType.bodySm.size,
      color: tokens.text.secondary,
    },
    chipActiveText: {
      color: tokens.brand.ctaForeground,
    },
    newChat: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      minHeight: rnGeometry.tapBox,
      paddingHorizontal: rnSpacing.sm,
      borderRadius: rnRadius.md,
      backgroundColor: tokens.surface.muted,
      marginBottom: rnSpacing.md,
    },
    newChatGlyph: {
      fontSize: rnType.body.size,
      fontWeight: '600',
      color: tokens.text.primary,
    },
    newChatText: {
      fontSize: rnType.body.size,
      color: tokens.text.primary,
    },
    sectionLabel: {
      fontSize: rnType.label.size,
      fontWeight: '600',
      color: tokens.text.tertiary,
      marginBottom: rnSpacing.xs,
    },
    emptyText: {
      fontSize: rnType.bodySm.size,
      color: tokens.text.tertiary,
    },
    list: {
      flex: 1,
    },
    listContent: {
      gap: rnSpacing.sm,
      paddingBottom: rnSpacing.md,
    },
    conversationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
      padding: rnSpacing.sm,
      borderRadius: rnRadius.md,
      backgroundColor: tokens.surface.muted,
    },
    conversationMain: {
      flex: 1,
      gap: rnSpacing['2xs'],
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing['2xs'],
    },
    pinMark: {
      fontSize: rnType.caption.size,
      color: tokens.text.secondary,
    },
    favoriteMark: {
      fontSize: rnType.caption.size,
      color: tokens.text.secondary,
    },
    conversationTitle: {
      flex: 1,
      fontSize: rnType.body.size,
      color: tokens.text.primary,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
    },
    conversationTime: {
      fontSize: rnType.caption.size,
      color: tokens.text.tertiary,
    },
    conversationModel: {
      flex: 1,
      fontSize: rnType.caption.size,
      color: tokens.text.tertiary,
    },
    actionButton: {
      paddingHorizontal: rnSpacing['2xs'],
      paddingVertical: rnSpacing['2xs'],
      borderRadius: rnRadius.sm,
      backgroundColor: tokens.surface.card,
    },
    actionText: {
      fontSize: rnType.caption.size,
      color: tokens.text.secondary,
    },
    deleteText: {
      fontSize: rnType.caption.size,
      color: tokens.danger.DEFAULT,
    },
    footer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: rnSpacing.sm,
      paddingTop: rnSpacing.sm,
      borderTopWidth: 1,
      borderTopColor: tokens.border.light,
    },
    footerButton: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadiusFor.control,
      backgroundColor: tokens.surface.muted,
    },
    footerText: {
      fontSize: rnType.caption.size,
      color: tokens.text.secondary,
    },
  })
}
