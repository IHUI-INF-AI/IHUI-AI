import { useMemo } from 'react'
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type {
  AssistantItem,
  AssistantScreenProps,
  AssistantStatus,
  AssistantSubTab,
  AssistantTab,
} from '../../types'

/** 助手管理共享屏 — props 注入式跨端组件(纯 UI,不依赖平台 API) */
export type { AssistantItem, AssistantScreenProps, AssistantStatus, AssistantSubTab, AssistantTab }

const TABS: { id: AssistantTab; labelKey: string }[] = [
  { id: 'draft', labelKey: 'assistant.tabDraft' },
  { id: 'reviewing', labelKey: 'assistant.tabReviewing' },
  { id: 'published', labelKey: 'assistant.tabPublished' },
]
const SUB_TABS: { id: AssistantSubTab; labelKey: string }[] = [
  { id: 'all', labelKey: 'assistant.subTabAll' },
  { id: 'rejected', labelKey: 'assistant.subTabRejected' },
  { id: 'offline', labelKey: 'assistant.subTabOffline' },
]

export function AssistantScreen({
  t,
  items,
  tab,
  subTab,
  keyword,
  loading,
  refreshing,
  error,
  onTabChange,
  onSubTabChange,
  onKeywordChange,
  onRefresh,
  onEdit,
  onOffline,
  colorScheme = 'light',
}: AssistantScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const showSubTab = tab === 'draft'
  const list = items.filter((a) => {
    if (showSubTab) {
      if (subTab === 'all' && a.status !== 'draft') return false
      if (subTab === 'rejected' && a.status !== 'rejected') return false
      if (subTab === 'offline' && a.status !== 'offline') return false
    } else if (a.status !== tab) {
      return false
    }
    return keyword ? a.name.includes(keyword) : true
  })

  const badgeFor = (a: AssistantItem): { text: string; color: string; bg: string } => {
    if (a.status === 'published')
      return {
        text: t('assistant.badgePublished'),
        color: tk.success.DEFAULT,
        bg: tk.success.light,
      }
    if (a.status === 'reviewing')
      return { text: t('assistant.badgeReviewing'), color: tk.purple.DEFAULT, bg: tk.purple.light }
    if (a.status === 'rejected')
      return {
        text: t('assistant.badgeRejected'),
        color: tk.warning.deep,
        bg: tk.warning.orangeLight,
      }
    if (a.status === 'offline')
      return { text: t('assistant.badgeOffline'), color: tk.text.secondary, bg: tk.surface.card }
    return { text: t('assistant.badgeDraft'), color: tk.text.secondary, bg: tk.surface.card }
  }

  const renderItem = ({ item }: { item: AssistantItem }) => {
    const badge = badgeFor(item)
    return (
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
          </View>
          <View style={styles.cardMain}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
              <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                <Text style={[styles.badgeText, { color: badge.color }]}>{badge.text}</Text>
              </View>
            </View>
            <Text style={styles.prologue} numberOfLines={2}>
              {item.prologue}
            </Text>
          </View>
        </View>
        {item.status === 'published' && (
          <View style={styles.cardMeta}>
            <Text style={styles.metaText}>
              {t('assistant.metaCategory')}: {item.category}
            </Text>
            <Text style={styles.metaText}>
              ¥{item.price} / {item.cycle || t('assistant.metaCycleForever')}
            </Text>
            <Text style={styles.metaText}>
              {t('assistant.metaAudience')}: {item.audience}
            </Text>
            <Text style={styles.metaText}>
              {t('assistant.metaPublishTime')}: {item.publishTime}
            </Text>
          </View>
        )}
        <View style={styles.cardActions}>
          {(item.status === 'draft' || item.status === 'reviewing') && (
            <TouchableOpacity
              style={styles.actionPrimary}
              onPress={() => onEdit(item)}
              activeOpacity={0.8}
            >
              <Text style={styles.actionPrimaryText}>{t('assistant.actionSettings')}</Text>
            </TouchableOpacity>
          )}
          {item.status === 'published' && (
            <TouchableOpacity
              style={styles.actionDanger}
              onPress={() => onOffline(item)}
              activeOpacity={0.8}
            >
              <Text style={styles.actionDangerText}>{t('assistant.actionOffline')}</Text>
            </TouchableOpacity>
          )}
          {(item.status === 'rejected' || item.status === 'offline') && (
            <TouchableOpacity
              style={styles.actionPrimary}
              onPress={() => onEdit(item)}
              activeOpacity={0.8}
            >
              <Text style={styles.actionPrimaryText}>{t('assistant.actionReedit')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('assistant.title')}</Text>
      </View>

      <View style={styles.tabRow}>
        {TABS.map((it) => {
          const active = tab === it.id
          return (
            <TouchableOpacity
              key={it.id}
              style={[styles.tabItem, active && styles.tabItemActive]}
              onPress={() => {
                onTabChange(it.id)
                onSubTabChange('all')
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{t(it.labelKey)}</Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {showSubTab && (
        <View style={styles.subTabRow}>
          {SUB_TABS.map((it) => {
            const active = subTab === it.id
            return (
              <TouchableOpacity
                key={it.id}
                onPress={() => onSubTabChange(it.id)}
                activeOpacity={0.8}
                style={styles.subTabItem}
              >
                <Text style={[styles.subTabText, active && styles.subTabTextActive]}>
                  {t(it.labelKey)}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
      )}

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={keyword}
          onChangeText={onKeywordChange}
          placeholder={t('assistant.searchPlaceholder')}
          placeholderTextColor={tk.text.tertiary}
        />
      </View>

      {error ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <FlatList
        data={list}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {loading ? t('assistant.loading') : t('assistant.empty')}
            </Text>
          </View>
        }
        renderItem={renderItem}
      />
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: { paddingHorizontal: 16, paddingVertical: 12 },
    headerTitle: { fontSize: 18, fontWeight: '600', color: tk.text.primary },
    tabRow: {
      flexDirection: 'row',
      marginHorizontal: 16,
      padding: 4,
      borderRadius: 10,
      backgroundColor: tk.surface.card,
    },
    tabItem: {
      flex: 1,
      height: 34,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabItemActive: { backgroundColor: tk.surface.bg },
    tabText: { fontSize: 13, color: tk.text.secondary },
    tabTextActive: { color: tk.text.primary, fontWeight: '600' },
    subTabRow: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 12, gap: 20 },
    subTabItem: { paddingVertical: 4 },
    subTabText: { fontSize: 13, color: tk.text.secondary },
    subTabTextActive: { color: tk.purple.DEFAULT, fontWeight: '600' },
    searchRow: { paddingHorizontal: 16, marginTop: 12 },
    searchInput: {
      height: 38,
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: 10,
      paddingHorizontal: 12,
      fontSize: 13,
      color: tk.text.primary,
      backgroundColor: tk.surface.muted,
    },
    errorBar: { paddingHorizontal: 16, paddingVertical: 8 },
    errorText: { fontSize: 12, color: tk.warning.deep },
    empty: { alignItems: 'center', paddingVertical: 48 },
    emptyText: { fontSize: 13, color: tk.text.tertiary },
    card: {
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    cardHead: { flexDirection: 'row' },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 10,
      backgroundColor: tk.purple.light,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    avatarText: { fontSize: 18, fontWeight: '600', color: tk.purple.DEFAULT },
    cardMain: { flex: 1 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    name: { flex: 1, fontSize: 15, fontWeight: '600', color: tk.text.primary },
    badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    badgeText: { fontSize: 11, fontWeight: '600' },
    prologue: { marginTop: 4, fontSize: 12, color: tk.text.secondary },
    cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 },
    metaText: { fontSize: 11, color: tk.text.tertiary },
    cardActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
    actionPrimary: {
      paddingHorizontal: 16,
      height: 32,
      borderRadius: 8,
      backgroundColor: tk.purple.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionPrimaryText: { fontSize: 13, fontWeight: '600', color: tk.surface.light },
    actionDanger: {
      paddingHorizontal: 16,
      height: 32,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.warning.deep,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionDangerText: { fontSize: 13, color: tk.warning.deep },
  })
}
