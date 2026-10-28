// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { TextField } from '../../components/TextField'
import {
  EmptyState,
  ErrorState,
  PressableCard,
  ScreenSkeleton,
} from '../../components/ScreenStates'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { AiGroupItem, AiGroupScreenProps, AiGroupTab } from '../../types'
import { BackChevron } from '../../components/BackChevron'

import { rnRadius, rnRadiusFor, rnSpacing, rnType } from '@ihui/design-tokens'

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
  keyword,
  onKeywordChange,
  colorScheme = 'light',
}: AiGroupScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenSkeleton variant="list" count={4} colorScheme={colorScheme} />
      </View>
    )
  }

  if (error && items.length === 0) {
    return (
      <View style={styles.container}>
        <ErrorState
          message={error}
          onRetry={onRetry}
          retryLabel={t('common.retry')}
          colorScheme={colorScheme}
        />
      </View>
    )
  }

  if (selectedItem) {
    return (
      <View style={styles.container}>
        <View style={styles.detailHead}>
          <BackChevron onPress={onBackToList} label={t('common.back')} colorScheme={colorScheme} />
          <Text style={styles.detailTitle} numberOfLines={1}>
            {selectedItem.name}
          </Text>
        </View>
        <ScrollView
          style={styles.detailBody}
          contentContainerStyle={{ padding: rnSpacing.lg, paddingBottom: rnSpacing['3xl'] }}
        >
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

  // 搜索过滤(对齐 Uniapp ai_group/index.vue InputArea「搜索AI助手」:名称/描述关键字过滤)
  const kw = keyword?.trim().toLowerCase() ?? ''
  const list = (tab === 'mine' ? items : items.slice().reverse()).filter(
    (g) => !kw || g.name.toLowerCase().includes(kw) || g.desc.toLowerCase().includes(kw),
  )
  const enterLabel = tab === 'mine' ? t('aiGroup.enterMine') : t('aiGroup.enterDiscover')

  const renderItem = ({ item }: { item: AiGroupItem }) => (
    <PressableCard style={styles.card} onPress={() => onPressItem(item)} colorScheme={colorScheme}>
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
    </PressableCard>
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

      {/* 搜索框(对齐 Uniapp ai_group/index.vue InputArea「搜索AI助手」;未注入回调则不渲染) */}
      {onKeywordChange ? (
        <View style={styles.searchRow}>
          <TextField
            colorScheme={colorScheme}
            value={keyword ?? ''}
            onChangeText={onKeywordChange}
            placeholder={t('aiGroup.searchPlaceholder')}
            placeholderTextColor={tk.text.tertiary}
            style={styles.searchInput}
            returnKeyType="search"
          />
        </View>
      ) : null}

      <FlatList
        data={list}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: rnSpacing.lg, paddingBottom: rnSpacing['3xl'] }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={<EmptyState title={t('aiGroup.empty')} colorScheme={colorScheme} />}
        renderItem={renderItem}
      />
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.light },
    header: { paddingHorizontal: 10, paddingTop: rnSpacing.md, paddingBottom: rnSpacing.sm },
    headerTitle: { fontSize: 22, fontWeight: '700', color: tk.text.primary },
    headerSub: { marginTop: rnSpacing.sm, fontSize: rnType.body.size, color: tk.text.secondary },
    tabRow: {
      flexDirection: 'row',
      marginHorizontal: rnSpacing.lg,
      padding: rnSpacing.xs,
      borderRadius: rnRadius.lg,
      backgroundColor: tk.surface.card,
    },
    searchRow: { marginHorizontal: rnSpacing.lg, marginTop: 10 },
    searchInput: {
      height: 40,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      paddingHorizontal: rnSpacing.md,
      fontSize: rnType.body.size,
      color: tk.text.primary,
    },
    tabItem: {
      flex: 1,
      height: 34,
      borderRadius: rnRadius.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabItemActive: { backgroundColor: tk.surface.light },
    tabText: { fontSize: rnType.body.size, color: tk.text.secondary },
    tabTextActive: { color: tk.text.primary, fontWeight: '600' },
    card: {
      padding: 14,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    cardHead: { flexDirection: 'row' },
    cardIcon: {
      width: 44,
      height: 44,
      borderRadius: rnRadius.xl,
      backgroundColor: tk.surface.muted,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    cardIconText: { fontSize: rnType.heading.size, fontWeight: '600', color: tk.text.primary },
    cardMain: { flex: 1 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    name: { flex: 1, fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
    tagBadge: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
    },
    tagText: { fontSize: rnType.caption.size, color: tk.text.primary },
    desc: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.body.size,
      color: tk.text.secondary,
      lineHeight: 18,
    },
    cardFoot: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: rnSpacing.md,
      gap: rnSpacing.sm,
    },
    memberPreview: { flexDirection: 'row', alignItems: 'center' },
    miniAvatar: {
      width: 22,
      height: 22,
      borderRadius: rnRadius.xl,
      backgroundColor: tk.border.light,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: tk.surface.light,
    },
    miniAvatarText: { fontSize: 10, fontWeight: '600', color: tk.text.secondary },
    moreText: { marginLeft: rnSpacing.sm, fontSize: rnType.caption.size, color: tk.text.tertiary },
    footMeta: { fontSize: rnType.caption.size, color: tk.text.tertiary },
    enterMiniBtn: {
      marginLeft: 'auto',
      paddingHorizontal: rnSpacing.md,
      height: 28,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
      alignItems: 'center',
      justifyContent: 'center',
    },
    enterMiniText: { fontSize: rnType.body.size, fontWeight: '600', color: tk.surface.light },
    detailHead: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: rnSpacing.md,
      gap: rnSpacing.md,
    },
    detailTitle: {
      flex: 1,
      fontSize: rnType.subtitle.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
    detailBody: { flex: 1 },
    detailDesc: { fontSize: rnType.body.size, color: tk.gray[600], lineHeight: 20 },
    metaRow: { flexDirection: 'row', gap: rnSpacing.lg, marginTop: rnSpacing.sm },
    metaText: { fontSize: rnType.caption.size, color: tk.text.tertiary },
    sectionTitle: {
      marginTop: rnSpacing.xl,
      marginBottom: 10,
      fontSize: rnType.body.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
    memberItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderRadius: rnRadius.lg,
      backgroundColor: tk.surface.muted,
      paddingHorizontal: rnSpacing.md,
      marginBottom: rnSpacing.sm,
    },
    memberAvatar: {
      width: 36,
      height: 36,
      borderRadius: rnRadius.xl,
      backgroundColor: tk.surface.muted,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    memberAvatarText: { fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
    memberMain: { flex: 1 },
    memberName: { fontSize: rnType.body.size, fontWeight: '600', color: tk.text.primary },
    memberRole: { marginTop: rnSpacing.sm, fontSize: rnType.caption.size, color: tk.text.tertiary },
    roleBadge: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
    },
    roleBadgeText: { fontSize: rnType.caption.size, color: tk.text.primary },
    previewBubble: {
      padding: 10,
      borderRadius: rnRadiusFor.bubble,
      backgroundColor: tk.surface.card,
      marginBottom: rnSpacing.sm,
    },
    previewName: {
      fontSize: rnType.caption.size,
      color: tk.text.primary,
      fontWeight: '600',
      marginBottom: rnSpacing.sm,
    },
    previewText: { fontSize: rnType.body.size, color: tk.text.medium, lineHeight: 18 },
    previewBubbleMine: {
      padding: 10,
      borderRadius: rnRadius.lg,
      backgroundColor: tk.brand.cta,
      alignSelf: 'flex-end',
      maxWidth: '80%',
      marginBottom: rnSpacing.sm,
    },
    previewTextMine: { fontSize: rnType.body.size, color: tk.brand.ctaForeground, lineHeight: 18 },
    enterBtn: {
      marginTop: rnSpacing.lg,
      height: 44,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
      alignItems: 'center',
      justifyContent: 'center',
    },
    enterBtnText: { fontSize: rnType.title.size, fontWeight: '600', color: tk.surface.light },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
