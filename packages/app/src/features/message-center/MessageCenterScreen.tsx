// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { scaleText } from '../../hooks/scaled-text'
import { View, Text, Image, ScrollView, RefreshControl, StyleSheet } from 'react-native'
import { Bell, Pin, PinOff, Settings, Trash2 } from 'lucide-react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { NotificationCard, createCardStyles } from '../../components/NotificationCard'
import { SearchInput } from '../../components/SearchInput'
import type {
  MessageCenterItem,
  MessageConversationItem,
  MessageCenterScreenProps,
  MessageTab,
} from '../../types'

import { rnRadius, rnRadiusFor, rnSpacing, rnType } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'
import { EmptyState, ScreenSkeleton } from '../../components/ScreenStates'
import { Tappable } from '@ihui/ui-native'
/** 消息中心 Tab/Item/Props 类型 re-export(单一来源 @ihui/types) */
export type { MessageCenterItem, MessageConversationItem, MessageCenterScreenProps, MessageTab }

const TABS: MessageTab[] = ['system', 'order', 'course', 'social']

/**
 * 消息中心共享屏 — props 注入式跨端组件
 *
 * 平台无关:负责渲染 header(返回 + 标题 + 设置入口)+ 通知横幅 + 搜索条
 * + tab 切换栏(可配置,默认回落四档)+ 会话区块 + 消息卡片列表 + 下拉刷新 + 加载更多。
 * 平台特定(导航 / API 调用 / tab 切换拉取 / 搜索过滤)由 wrapper 通过 props 注入。
 * 所有新增 UI 都只在对应 prop 传入时渲染 ⇒ 不传新 props 时与旧版逐字同形。
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
  tabs,
  conversationsTab,
  search,
  onPressSettings,
  notification,
  onMarkRead,
  onDeleteConversation,
  renderTabBody,
  hasMore,
  loadingMore,
  onLoadMore,
  emptyText,
}: MessageCenterScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const cardStyles = useMemo(() => createCardStyles(tk), [tk])

  /** tab 配置:平台注入优先;不传时回落四档默认 tab(文案仍取 i18n,与旧版一致) */
  const tabList: { key: string; label: string; unread?: number }[] =
    tabs ?? TABS.map((key) => ({ key, label: t(`messageCenter.tab.${key}`) }))
  /** 会话区块:未指定 conversationsTab 时保持旧行为(所有 tab 都渲染) */
  const showConversations = conversationsTab === undefined || conversationsTab === activeTab
  /** 自定义 tab 体(如私信);返回 null/undefined 时走默认会话 + 消息列表 */
  const customBody = renderTabBody ? renderTabBody(activeTab) : null
  const hasCustomBody = customBody !== null && customBody !== undefined

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
   * 已入 shared 五语言词条;缺键时(旧包/自定义 t)回落中文,不给读屏用户回显裸 key。
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
        {onPressSettings ? (
          <Tappable
            style={styles.headerAction}
            onPress={onPressSettings}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('messageCenter.settings')}
          >
            <Settings size={20} color={tk.text.secondary} />
          </Tappable>
        ) : null}
      </View>

      {/* 通知横幅(小程序 NavBar notification 插槽同形):有文案才渲染,可点则整条可点 */}
      {notification ? (
        notification.onPress ? (
          <Tappable
            style={styles.banner}
            onPress={notification.onPress}
            accessibilityRole="button"
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <Bell size={16} color={tk.text.secondary} />
            <Text style={styles.bannerText} numberOfLines={2}>
              {notification.text}
            </Text>
          </Tappable>
        ) : (
          <View style={styles.banner}>
            <Bell size={16} color={tk.text.secondary} />
            <Text style={styles.bannerText} numberOfLines={2}>
              {notification.text}
            </Text>
          </View>
        )
      ) : null}

      {/* 搜索条(平台负责过滤;共享屏不 fetch) */}
      {search ? (
        <View style={styles.searchWrap}>
          <SearchInput
            value={search.value}
            onChangeText={search.onChangeText}
            placeholder={search.placeholder ?? t('messageCenter.searchPh')}
            voiceEnabled={false}
            colorScheme={colorScheme}
          />
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
      >
        {tabList.map((tab) => {
          const active = tab.key === activeTab
          const unread = tab.unread ?? 0
          return (
            <Tappable
              key={tab.key}
              onPress={() => onSelectTab(tab.key)}
              style={[styles.tab, active && styles.tabActive]}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
              {unread > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
                </View>
              ) : null}
            </Tappable>
          )
        })}
      </ScrollView>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {hasCustomBody ? (
        <ScrollView
          contentContainerStyle={styles.listBody}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {customBody}
        </ScrollView>
      ) : loading && items.length === 0 ? (
        <ScreenSkeleton variant="list" count={4} colorScheme={colorScheme} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.listBody}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* 会话列表(对齐 Uniapp message 页聊天列表 chatList + handleChatClick) */}
          {showConversations && conversations && conversations.length > 0 ? (
            <View style={styles.convSection}>
              <Text style={styles.convTitle}>{t('messageCenter.conversations')}</Text>
              {conversations.map((conv: MessageConversationItem) => (
                <Tappable
                  key={conv.id}
                  style={styles.convItem}
                  onPress={() => onPressConversation?.(conv)}
                  accessibilityRole="button"
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
                      <View style={[styles.badge, styles.convUnread]}>
                        <Text style={styles.badgeText}>
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
                        <Text
                          style={[styles.convTime, scaleText(styles.convTime)]}
                          allowFontScaling={false}
                        >
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
                  {/* 删除会话(小程序 MessageActions 的 onDelete 同形):回调不传则整颗按钮不渲染 */}
                  {onDeleteConversation ? (
                    <Tappable
                      style={styles.convActionBtn}
                      hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                      accessibilityRole="button"
                      accessibilityLabel={t('messageCenter.deleteConv')}
                      onPress={() => onDeleteConversation(conv)}
                    >
                      <Trash2 size={16} color={tk.text.tertiary} />
                    </Tappable>
                  ) : null}
                  {/* 置顶切换(D20 G-11 端内接线):图标即动作,与 web 菜单同形;
                      onTogglePin 不传则整颗按钮不渲染(其它端零影响) */}
                  {onTogglePin ? (
                    <Tappable
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
                    </Tappable>
                  ) : null}
                </Tappable>
              ))}
            </View>
          ) : null}
          {items.length === 0 ? (
            <EmptyState title={emptyText ?? t('messageCenter.empty')} colorScheme={colorScheme} />
          ) : (
            items.map((item: MessageCenterItem) => (
              <NotificationCard
                key={item.id}
                item={item}
                typeLabel={typeLabel}
                onPress={onPressItem}
                styles={cardStyles}
                // 「标记已读」只在未读卡片上出现;onMarkRead 不传则整块操作区不渲染
                actionLabel={onMarkRead && !item.read ? t('messageCenter.markRead') : undefined}
                onAction={onMarkRead ? () => onMarkRead(item) : undefined}
              />
            ))
          )}
          {/* 底部加载更多:onLoadMore 不传或 hasMore===false 时不渲染 */}
          {onLoadMore && hasMore !== false && items.length > 0 ? (
            <Tappable
              style={[styles.loadMoreBtn, loadingMore === true && styles.loadMoreBtnDisabled]}
              onPress={onLoadMore}
              disabled={loadingMore === true}
              accessibilityRole="button"
            >
              <Text style={styles.loadMoreText}>
                {loadingMore === true ? t('common.loading') : t('messageCenter.loadMore')}
              </Text>
            </Tappable>
          ) : null}
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
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingVertical: rnSpacing.md,
      gap: rnSpacing.md,
    },
    title: { flex: 1, fontSize: rnType.heading.size, fontWeight: '600', color: tk.text.primary },
    headerAction: {
      paddingHorizontal: rnSpacing.xs,
      paddingVertical: rnSpacing['2xs'],
      justifyContent: 'center',
    },
    // ── 通知横幅(小程序 NavBar notification 插槽同形) ──
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      marginHorizontal: rnSpacing['sm-loose'],
      marginBottom: rnSpacing.sm,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    bannerText: { flex: 1, fontSize: rnType.body.size, color: tk.text.secondary },
    searchWrap: { paddingHorizontal: rnSpacing['sm-loose'], paddingBottom: rnSpacing.sm },
    tabs: {
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingVertical: rnSpacing.sm,
      gap: rnSpacing.sm,
    },
    tab: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing['2xs'],
      paddingHorizontal: 14,
      paddingVertical: rnSpacing['xs-loose'],
      borderRadius: rnRadius.xl,
      backgroundColor: tk.surface.card,
    },
    tabActive: {
      backgroundColor: tk.brand.cta,
    },
    tabText: { fontSize: rnType.body.size, color: tk.text.secondary },
    tabTextActive: { color: tk.brand.ctaForeground, fontWeight: '600' },
    // 未读徽标唯一形状(tab 与会话头像角标共用;角标只叠加定位)
    badge: {
      minWidth: 16,
      height: 16,
      borderRadius: rnRadiusFor.chip,
      backgroundColor: tk.error.text,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 3,
    },
    badgeText: { fontSize: 10, color: tk.surface.light, fontWeight: '700' },
    errorText: {
      paddingHorizontal: rnSpacing['sm-loose'],
      fontSize: rnType.body.size,
      color: tk.danger.DEFAULT,
    },
    listBody: { padding: rnSpacing['sm-loose'] },
    // ── 会话列表区块(对齐 Uniapp message 页聊天列表) ──
    convSection: { marginBottom: rnSpacing['xs-loose'] },
    convTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: tk.text.primary,
      marginBottom: rnSpacing.xs,
    },
    convItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: rnSpacing.md,
      paddingHorizontal: rnSpacing['sm-loose'],
      borderRadius: rnRadius.xl,
      gap: rnSpacing.md,
    },
    convAvatarWrap: { position: 'relative' },
    convAvatar: {
      width: 44,
      height: 44,
      borderRadius: rnRadius.lg, // 原 10,R1 吸附至 lg(8)
      backgroundColor: tk.surface.muted,
    },
    convAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
    convAvatarText: { fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
    convUnread: { position: 'absolute', top: -4, right: -4 },
    convContent: { flex: 1 },
    convHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
    },
    convName: { flex: 1, fontSize: rnType.strong.size, fontWeight: '600', color: tk.text.primary },
    convTime: { fontSize: rnType.label.size, color: tk.text.tertiary },
    convPreview: { marginTop: rnSpacing['2xs'], fontSize: 13, color: tk.text.secondary },
    convPinBtn: { paddingHorizontal: rnSpacing.xs, justifyContent: 'center' },
    convActionBtn: { paddingHorizontal: rnSpacing.xs, justifyContent: 'center' },
    loadMoreBtn: {
      alignSelf: 'center',
      marginTop: rnSpacing.md,
      paddingHorizontal: rnSpacing.lg,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadiusFor.control,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    loadMoreBtnDisabled: { opacity: 0.5 },
    loadMoreText: { fontSize: rnType.body.size, color: tk.text.secondary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
