import { useMemo } from 'react'
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { AiGroupItem, AiGroupScreenProps, AiGroupTab } from '../../types'

/** AI 群组共享屏 — props 注入式跨端组件(纯 UI,不依赖平台 API) */
export type { AiGroupItem, AiGroupScreenProps, AiGroupTab }

const TABS: { id: AiGroupTab; labelKey: string }[] = [
  { id: 'mine', labelKey: 'aiGroup.tabMine' },
  { id: 'discover', labelKey: 'aiGroup.tabDiscover' },
]

export function AiGroupScreen({
  t,
  items,
  tab,
  selectedItem,
  loading,
  refreshing,
  error,
  onTabChange,
  onPressItem,
  onBackToList,
  onEnterChat,
  onRefresh,
  onRetry,
  colorScheme = 'light',
}: AiGroupScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={tk.text.secondary} />
      </View>
    )
  }

  if (error && items.length === 0) {
    return (
      <View style={[styles.container, styles.center, { padding: 16 }]}>
        <Text style={[styles.emptyText, { marginBottom: 12 }]}>{error}</Text>
        <TouchableOpacity style={styles.enterMiniBtn} onPress={onRetry} activeOpacity={0.85}>
          <Text style={styles.enterMiniText}>{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (selectedItem) {
    return (
      <View style={styles.container}>
        <View style={styles.detailHead}>
          <TouchableOpacity onPress={onBackToList} hitSlop={8}>
            <Text style={styles.backText}>{t('aiGroup.back')}</Text>
          </TouchableOpacity>
          <Text style={styles.detailTitle} numberOfLines={1}>
            {selectedItem.name}
          </Text>
        </View>
        <ScrollView style={styles.detailBody} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          <Text style={styles.detailDesc}>{selectedItem.desc}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>
              {t('aiGroup.metaActive', { time: selectedItem.lastActive })}
            </Text>
            <Text style={styles.metaText}>
              {t('aiGroup.metaMessages', { count: selectedItem.messages })}
            </Text>
          </View>

          <Text style={styles.sectionTitle}>
            {t('aiGroup.detailMembers', { count: selectedItem.members.length })}
          </Text>
          {selectedItem.members.map((m) => (
            <View key={m.id} style={styles.memberItem}>
              <View style={styles.memberAvatar}>
                <Text style={styles.memberAvatarText}>{m.name.charAt(0)}</Text>
              </View>
              <View style={styles.memberMain}>
                <Text style={styles.memberName}>{m.name}</Text>
                <Text style={styles.memberRole}>{t('aiGroup.memberRole', { role: m.role })}</Text>
              </View>
              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>{m.role}</Text>
              </View>
            </View>
          ))}

          <Text style={styles.sectionTitle}>{t('aiGroup.detailRecent')}</Text>
          <View style={styles.previewBubble}>
            <Text style={styles.previewName}>{selectedItem.members[0]?.name}</Text>
            <Text style={styles.previewText}>{t('aiGroup.previewHello')}</Text>
          </View>
          <View style={styles.previewBubbleMine}>
            <Text style={styles.previewTextMine}>{t('aiGroup.previewMine')}</Text>
          </View>

          <TouchableOpacity
            style={styles.enterBtn}
            onPress={() => onEnterChat(selectedItem)}
            activeOpacity={0.85}
          >
            <Text style={styles.enterBtnText}>{t('aiGroup.detailEnter')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    )
  }

  const list = tab === 'mine' ? items : items.slice().reverse()
  const enterLabel = tab === 'mine' ? t('aiGroup.enterMine') : t('aiGroup.enterDiscover')

  const renderItem = ({ item }: { item: AiGroupItem }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPressItem(item)}
      activeOpacity={0.85}
    >
      <View style={styles.cardHead}>
        <View style={styles.cardIcon}>
          <Text style={styles.cardIconText}>{item.name.charAt(0)}</Text>
        </View>
        <View style={styles.cardMain}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={styles.tagBadge}>
              <Text style={styles.tagText}>{item.tag}</Text>
            </View>
          </View>
          <Text style={styles.desc} numberOfLines={2}>
            {item.desc}
          </Text>
        </View>
      </View>
      <View style={styles.cardFoot}>
        <View style={styles.memberPreview}>
          {item.members.slice(0, 3).map((m, i) => (
            <View key={m.id} style={[styles.miniAvatar, { marginLeft: i === 0 ? 0 : -6 }]}>
              <Text style={styles.miniAvatarText}>{m.name.charAt(0)}</Text>
            </View>
          ))}
          {item.members.length > 3 ? (
            <Text style={styles.moreText}>+{item.members.length - 3}</Text>
          ) : null}
        </View>
        <Text style={styles.footMeta}>
          {t('aiGroup.cardMembers', { count: item.members.length, messages: item.messages })}
        </Text>
        <View style={styles.enterMiniBtn}>
          <Text style={styles.enterMiniText}>{enterLabel}</Text>
        </View>
      </View>
    </TouchableOpacity>
  )

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('aiGroup.title')}</Text>
        <Text style={styles.headerSub}>{t('aiGroup.subtitle')}</Text>
      </View>

      <View style={styles.tabRow}>
        {TABS.map((it) => {
          const active = tab === it.id
          return (
            <TouchableOpacity
              key={it.id}
              style={[styles.tabItem, active && styles.tabItemActive]}
              onPress={() => onTabChange(it.id)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{t(it.labelKey)}</Text>
            </TouchableOpacity>
          )
        })}
      </View>

      <FlatList
        data={list}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('aiGroup.empty')}</Text>
          </View>
        }
        renderItem={renderItem}
      />
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.light },
    center: { alignItems: 'center', justifyContent: 'center' },
    header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
    headerTitle: { fontSize: 20, fontWeight: '700', color: tk.text.primary },
    headerSub: { marginTop: 4, fontSize: 12, color: tk.text.secondary },
    tabRow: {
      flexDirection: 'row',
      marginHorizontal: 16,
      padding: 4,
      borderRadius: 10,
      backgroundColor: tk.surface.card,
    },
    tabItem: { flex: 1, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    tabItemActive: { backgroundColor: tk.surface.light },
    tabText: { fontSize: 13, color: tk.text.secondary },
    tabTextActive: { color: tk.text.primary, fontWeight: '600' },
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
    cardIcon: {
      width: 44,
      height: 44,
      borderRadius: 10,
      backgroundColor: tk.indigo.light,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    cardIconText: { fontSize: 18, fontWeight: '600', color: tk.indigo.deep },
    cardMain: { flex: 1 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    name: { flex: 1, fontSize: 15, fontWeight: '600', color: tk.text.primary },
    tagBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: tk.purple.light },
    tagText: { fontSize: 11, color: tk.purple.DEFAULT },
    desc: { marginTop: 4, fontSize: 12, color: tk.text.secondary, lineHeight: 18 },
    cardFoot: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 },
    memberPreview: { flexDirection: 'row', alignItems: 'center' },
    miniAvatar: {
      width: 22,
      height: 22,
      borderRadius: 6,
      backgroundColor: tk.border.light,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: tk.surface.light,
    },
    miniAvatarText: { fontSize: 10, fontWeight: '600', color: tk.text.secondary },
    moreText: { marginLeft: 4, fontSize: 11, color: tk.text.tertiary },
    footMeta: { fontSize: 11, color: tk.text.tertiary },
    enterMiniBtn: {
      marginLeft: 'auto',
      paddingHorizontal: 12,
      height: 28,
      borderRadius: 8,
      backgroundColor: tk.purple.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    enterMiniText: { fontSize: 12, fontWeight: '600', color: tk.surface.light },
    detailHead: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomColor: tk.surface.card,
      borderBottomWidth: 1,
    },
    backText: { fontSize: 14, color: tk.purple.DEFAULT, marginRight: 12 },
    detailTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: tk.text.primary },
    detailBody: { flex: 1 },
    detailDesc: { fontSize: 13, color: tk.gray[600], lineHeight: 20 },
    metaRow: { flexDirection: 'row', gap: 16, marginTop: 8 },
    metaText: { fontSize: 11, color: tk.text.tertiary },
    sectionTitle: {
      marginTop: 20,
      marginBottom: 10,
      fontSize: 13,
      fontWeight: '600',
      color: tk.text.primary,
    },
    memberItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: tk.surface.muted,
      paddingHorizontal: 12,
      marginBottom: 8,
    },
    memberAvatar: {
      width: 36,
      height: 36,
      borderRadius: 8,
      backgroundColor: tk.indigo.light,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    memberAvatarText: { fontSize: 14, fontWeight: '600', color: tk.indigo.deep },
    memberMain: { flex: 1 },
    memberName: { fontSize: 13, fontWeight: '600', color: tk.text.primary },
    memberRole: { marginTop: 2, fontSize: 11, color: tk.text.tertiary },
    roleBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: tk.purple.light },
    roleBadgeText: { fontSize: 11, color: tk.purple.DEFAULT },
    previewBubble: {
      padding: 10,
      borderRadius: 10,
      backgroundColor: tk.surface.card,
      marginBottom: 8,
    },
    previewName: { fontSize: 11, color: tk.purple.DEFAULT, fontWeight: '600', marginBottom: 4 },
    previewText: { fontSize: 13, color: tk.text.medium, lineHeight: 18 },
    previewBubbleMine: {
      padding: 10,
      borderRadius: 10,
      backgroundColor: tk.purple.DEFAULT,
      alignSelf: 'flex-end',
      maxWidth: '80%',
      marginBottom: 8,
    },
    previewTextMine: { fontSize: 13, color: tk.surface.light, lineHeight: 18 },
    enterBtn: {
      marginTop: 16,
      height: 44,
      borderRadius: 10,
      backgroundColor: tk.purple.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    enterBtnText: { fontSize: 14, fontWeight: '600', color: tk.surface.light },
  })
}
