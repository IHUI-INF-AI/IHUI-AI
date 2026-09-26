// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  View,
  Text,
  Image,
  Pressable,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  StyleSheet,
} from 'react-native'
import { Pin, PinOff } from 'lucide-react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { NotificationCard, createCardStyles } from '../../components/NotificationCard'
import type {
  MessageCenterItem,
  MessageConversationItem,
  MessageCenterScreenProps,
  MessageTab,
} from '../../types'

import { rnRadius } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'

/** 消息中心 Tab/Item/Props 类型 re-export(单一来源 @ihui/types) */
export type { MessageCenterItem, MessageConversationItem, MessageCenterScreenProps, MessageTab }

const TABS: MessageTab[] = ['system', 'order', 'course', 'social']

/**
 * 消息中心共享屏 — props 注入式跨端组件
 *
 * 平台无关:负责渲染 header + tab 切换栏 + 消息卡片列表 + 下拉刷新。
 * 平台特定(导航 / API 调用 / tab 切换拉取)由 wrapper 通过 props 注入。
 */
export function MessageCenterScreen({
  t,
  items,
  activeTab,
  onSelectTab,
  loading,
  refreshing,
  error,
  onRefresh,
  onPressItem,
  conversations,
  onPressConversation,
  onTogglePin,
  onBack,
  colorScheme = 'light',
}: MessageCenterScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const cardStyles = useMemo(() => createCardStyles(tk), [tk])

  const typeLabel = (type: MessageTab) => {
    switch (type) {
      case 'system':
        return t('messageCenter.type.system')
      case 'order':
        return t('messageCenter.type.order')
      case 'course':
        return t('messageCenter.type.course')
      case 'social':
        return t('messageCenter.type.social')
      default:
        return t('messageCenter.type.system')
    }
  }

  /**
   * 置顶按钮的无障碍名称(动作语义,与 web conversation-list 同形:
   * 已置顶 → 「取消置顶」,未置顶 → 「置顶」)。messageCenter.pin / messageCenter.unpin
   * 两键尚未入库(i18n 面由主会话统一登记),缺键时回落中文,不给读屏用户回显裸 key。
   */
  const pinActionLabel = (pinned: boolean | undefined): string => {
    const key = pinned ? 'messageCenter.unpin' : 'messageCenter.pin'
    const label = t(key)
    return label === key ? (pinned ? '取消置顶' : '置顶') : label
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>{t('messageCenter.title')}</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
      >
        {TABS.map((tab) => {
          const active = tab === activeTab
          return (
            <TouchableOpacity
              key={tab}
              onPress={() => onSelectTab(tab)}
              style={[styles.tab, active && styles.tabActive]}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {t(`messageCenter.tab.${tab}`)}
              </Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.muted}>{t('common.loading')}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listBody}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* 会话列表(对齐 Uniapp message 页聊天列表 chatList + handleChatClick) */}
          {conversations && conversations.length > 0 ? (
            <View style={styles.convSection}>
              <Text style={styles.convTitle}>{t('messageCenter.conversations')}</Text>
              {conversations.map((conv: MessageConversationItem) => (
                <TouchableOpacity
                  key={conv.id}
                  style={styles.convItem}
                  onPress={() => onPressConversation?.(conv)}
                  activeOpacity={0.7}
                >
                  <View style={styles.convAvatarWrap}>
                    {conv.avatar ? (
                      <Image source={{ uri: conv.avatar }} style={styles.convAvatar} />
                    ) : (
                      <View style={[styles.convAvatar, styles.convAvatarFallback]}>
                        <Text style={styles.convAvatarText}>
                          {conv.name.trim().charAt(0).toUpperCase() || '?'}
                        </Text>
                      </View>
                    )}
                    {conv.unread && conv.unread > 0 ? (
                      <View style={styles.convUnread}>
                        <Text style={styles.convUnreadText}>
                          {conv.unread > 99 ? '99+' : conv.unread}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.convContent}>
                    <View style={styles.convHeader}>
                      <Text style={styles.convName} numberOfLines={1}>
                        {conv.name}
                      </Text>
                      {conv.time ? (
                        <Text style={styles.convTime} allowFontScaling={false}>
                          {conv.time}
                        </Text>
                      ) : null}
                    </View>
                    {conv.lastMessage ? (
                      <Text style={styles.convPreview} numberOfLines={1}>
                        {conv.lastMessage}
                      </Text>
                    ) : null}
                  </View>
                  {/* 置顶切换(D20 G-11 端内接线):图标即动作,与 web 菜单同形;
                      onTogglePin 不传则整颗按钮不渲染(其它端零影响) */}
                  {onTogglePin ? (
                    <Pressable
                      style={styles.convPinBtn}
                      hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                      accessibilityRole="button"
                      accessibilityLabel={pinActionLabel(conv.pinned)}
                      onPress={() => onTogglePin(conv)}
                    >
                      {conv.pinned ? (
                        <PinOff size={16} color={tk.text.primary} />
                      ) : (
                        <Pin size={16} color={tk.text.tertiary} />
                      )}
                    </Pressable>
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          {items.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.muted}>{t('messageCenter.empty')}</Text>
            </View>
          ) : (
            items.map((item: MessageCenterItem) => (
              <NotificationCard
                key={item.id}
                item={item}
                typeLabel={typeLabel}
                onPress={onPressItem}
                styles={cardStyles}
              />
            ))
          )}
        </ScrollView>
      )}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 12,
      gap: 12,
    },
    title: { fontSize: 20, fontWeight: '600', color: tk.text.primary },
    tabs: { paddingHorizontal: 10, paddingVertical: 8, gap: 8 },
    tab: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: rnRadius.xl,
      backgroundColor: tk.surface.card,
    },
    tabActive: {
      backgroundColor: tk.brand.cta,
    },
    tabText: { fontSize: 14, color: tk.text.secondary },
    tabTextActive: { color: tk.surface.light, fontWeight: '600' },
    errorText: { paddingHorizontal: 10, fontSize: 14, color: tk.danger.DEFAULT },
    center: { alignItems: 'center', paddingVertical: 48 },
    muted: { fontSize: 14, color: tk.text.secondary, marginTop: 8 },
    listBody: { padding: 10 },
    // ── 会话列表区块(对齐 Uniapp message 页聊天列表) ──
    convSection: { marginBottom: 6 },
    convTitle: { fontSize: 13, fontWeight: '700', color: tk.text.primary, marginBottom: 4 },
    convItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 10,
      borderRadius: rnRadius.xl,
      gap: 12,
    },
    convAvatarWrap: { position: 'relative' },
    convAvatar: {
      width: 44,
      height: 44,
      borderRadius: rnRadius.lg, // 原 10,R1 吸附至 lg(8)
      backgroundColor: tk.surface.muted,
    },
    convAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
    convAvatarText: { fontSize: 16, fontWeight: '600', color: tk.text.primary },
    convUnread: {
      position: 'absolute',
      top: -4,
      right: -4,
      minWidth: 16,
      height: 16,
      borderRadius: rnRadius.lg,
      backgroundColor: tk.error.text,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 3,
    },
    convUnreadText: { fontSize: 10, color: tk.surface.light, fontWeight: '700' },
    convContent: { flex: 1 },
    convHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    convName: { flex: 1, fontSize: 15, fontWeight: '600', color: tk.text.primary },
    convTime: { fontSize: 12, color: tk.text.tertiary },
    convPreview: { marginTop: 2, fontSize: 13, color: tk.text.secondary },
    convPinBtn: { paddingHorizontal: 4, justifyContent: 'center' },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
