import { useMemo } from 'react'
import { View, Text, TouchableOpacity, ScrollView, RefreshControl, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { NotificationCard, createCardStyles } from '../../components/NotificationCard'
import type { MessageCenterItem, MessageCenterScreenProps, MessageTab } from '../../types'

/** 消息中心 Tab/Item/Props 类型 re-export(单一来源 @ihui/types) */
export type { MessageCenterItem, MessageCenterScreenProps, MessageTab }

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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
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
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
    },
    backText: { fontSize: 14, color: tk.text.medium },
    title: { fontSize: 18, fontWeight: '600', color: tk.text.primary },
    tabs: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
    tab: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: tk.surface.card,
    },
    tabActive: {
      backgroundColor: tk.success.light,
    },
    tabText: { fontSize: 12, color: tk.text.secondary },
    tabTextActive: { color: tk.success.DEFAULT, fontWeight: '600' },
    errorText: { paddingHorizontal: 16, fontSize: 12, color: tk.danger.DEFAULT },
    center: { alignItems: 'center', paddingVertical: 48 },
    muted: { fontSize: 12, color: tk.text.secondary, marginTop: 8 },
    listBody: { padding: 16 },
  })
}
