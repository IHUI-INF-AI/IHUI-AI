import { useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { N8nModelItem, N8nModelScreenProps, N8nModelTab } from '../../types'

/** n8n 模型管理共享屏 — props 注入式跨端组件(纯 UI,不依赖平台 API) */
export type { N8nModelItem, N8nModelScreenProps }

/** 状态 tab 列表(label 通过 i18n 注入) */
const TABS: { id: N8nModelTab; labelKey: string }[] = [
  { id: 'all', labelKey: 'n8nModel.tabAll' },
  { id: 'running', labelKey: 'n8nModel.tabRunning' },
  { id: 'stopped', labelKey: 'n8nModel.tabStopped' },
]

export function N8nModelScreen({
  t,
  items,
  tab,
  keyword,
  loading,
  refreshing,
  error,
  onSelectTab,
  onKeywordChange,
  onRefresh,
  onRetry,
  onToggle,
  onEdit,
  onCreate,
  onBack,
  colorScheme = 'light',
}: N8nModelScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const list = items.filter((m) => {
    const matchTab = tab === 'all' ? true : m.status === tab
    const matchKw = keyword ? m.name.includes(keyword) || m.desc.includes(keyword) : true
    return matchTab && matchKw
  })

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('n8nModel.title')}</Text>
        <TouchableOpacity style={styles.createBtn} onPress={onCreate} activeOpacity={0.8}>
          <Text style={styles.createText}>{t('n8nModel.create')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={keyword}
          onChangeText={onKeywordChange}
          placeholder={t('n8nModel.searchPlaceholder')}
          placeholderTextColor={tk.text.tertiary}
        />
      </View>

      <View style={styles.tabRow}>
        {TABS.map((tabItem) => {
          const active = tab === tabItem.id
          return (
            <TouchableOpacity
              key={tabItem.id}
              style={[styles.tabItem, active && styles.tabItemActive]}
              onPress={() => onSelectTab(tabItem.id)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {t(tabItem.labelKey)}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {error ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={onRetry} activeOpacity={0.8}>
            <Text style={styles.retryText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {loading && items.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={tk.brand.DEFAULT} />
        </View>
      ) : (
        <FlatList<N8nModelItem>
          data={list}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.listBody}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[tk.brand.DEFAULT]}
            />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{t('n8nModel.empty')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <View style={styles.cardTitleRow}>
                  <View
                    style={[styles.dot, item.status === 'running' ? styles.dotRun : styles.dotStop]}
                  />
                  <Text style={styles.cardName} numberOfLines={1}>
                    {item.name}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.badge,
                    item.status === 'running' ? styles.badgeRun : styles.badgeStop,
                  ]}
                >
                  {item.status === 'running' ? t('n8nModel.running') : t('n8nModel.stopped')}
                </Text>
              </View>
              {item.desc ? (
                <Text style={styles.cardDesc} numberOfLines={2}>
                  {item.desc}
                </Text>
              ) : null}
              {item.url ? (
                <Text style={styles.cardUrl} numberOfLines={1}>
                  {item.url}
                </Text>
              ) : null}
              <View style={styles.cardMeta}>
                <Text style={styles.metaText}>{t('n8nModel.calls', { count: item.calls })}</Text>
                <Text style={styles.metaText}>
                  {t('n8nModel.params', { in: item.paramsIn, out: item.paramsOut })}
                </Text>
                <Text style={styles.metaText}>{item.updatedAt}</Text>
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    item.status === 'running' ? styles.actionStop : styles.actionStart,
                  ]}
                  onPress={() => onToggle(item)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.actionText}>
                    {item.status === 'running'
                      ? t('n8nModel.actionStop')
                      : t('n8nModel.actionStart')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionEdit}
                  onPress={() => onEdit(item)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.actionEditText}>{t('n8nModel.actionEdit')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
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
      justifyContent: 'space-between',
      paddingHorizontal: 10,
      paddingVertical: 12,
    },
    backText: { fontSize: 16, color: tk.text.secondary },
    headerTitle: { fontSize: 20, fontWeight: '600', color: tk.text.primary },
    createBtn: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 12,
      backgroundColor: tk.brand.DEFAULT,
    },
    createText: { fontSize: 14, fontWeight: '600', color: tk.surface.light },
    searchRow: { paddingHorizontal: 10 },
    searchInput: {
      height: 50,
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: 12,
      paddingHorizontal: 12,
      fontSize: 14,
      color: tk.text.primary,
      backgroundColor: '#f5f5f5',
    },
    tabRow: {
      flexDirection: 'row',
      marginHorizontal: 10,
      marginTop: 12,
      padding: 4,
      borderRadius: 12,
      backgroundColor: tk.surface.card,
    },
    tabItem: {
      flex: 1,
      height: 32,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabItemActive: { backgroundColor: tk.surface.bg },
    tabText: { fontSize: 14, color: tk.text.secondary },
    tabTextActive: { color: tk.text.primary, fontWeight: '600' },
    errorBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginHorizontal: 10,
      marginTop: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: tk.danger.light,
    },
    errorText: { flex: 1, fontSize: 14, color: tk.danger.DEFAULT },
    retryText: { fontSize: 14, fontWeight: '600', color: tk.brand.DEFAULT, marginLeft: 8 },
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    listBody: { padding: 10 },
    separator: { height: 12 },
    empty: { alignItems: 'center', paddingVertical: 48 },
    emptyText: { fontSize: 14, color: tk.text.tertiary },
    card: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: tk.border.light },
    cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cardTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
    dotRun: { backgroundColor: tk.success.DEFAULT },
    dotStop: { backgroundColor: tk.text.tertiary },
    cardName: { flex: 1, fontSize: 16, fontWeight: '600', color: tk.text.primary },
    badge: {
      fontSize: 11,
      fontWeight: '600',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 12,
    },
    badgeRun: { color: tk.success.DEFAULT, backgroundColor: tk.success.light },
    badgeStop: { color: tk.text.secondary, backgroundColor: tk.surface.card },
    cardDesc: { marginTop: 8, fontSize: 14, color: tk.text.medium },
    cardUrl: { marginTop: 8, fontSize: 11, color: tk.brand.DEFAULT },
    cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 },
    metaText: { fontSize: 11, color: tk.text.tertiary },
    cardActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
    actionBtn: {
      paddingHorizontal: 10,
      height: 34,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionStart: { backgroundColor: tk.success.DEFAULT },
    actionStop: { backgroundColor: tk.warning.deep },
    actionText: { fontSize: 14, fontWeight: '600', color: tk.surface.light },
    actionEdit: {
      paddingHorizontal: 10,
      height: 34,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionEditText: { fontSize: 14, color: tk.text.medium },
  })
}
