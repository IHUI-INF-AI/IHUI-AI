import { useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type {
  ModelPlazaItem,
  ModelPlazaModelType,
  ModelPlazaProvider,
  ModelPlazaScreenProps,
  ModelPlazaTypeFilter,
} from '../../types'

/** 模型广场共享屏 — props 注入式跨端组件(纯 UI,不依赖平台 API) */
export type { ModelPlazaItem, ModelPlazaProvider, ModelPlazaScreenProps }

/** 类型筛选 tab 列表(label 通过 i18n 注入,共享层不持有翻译) */
const TYPE_TABS: { id: ModelPlazaTypeFilter; labelKey: string }[] = [
  { id: 'all', labelKey: 'modelPlaza.typeAll' },
  { id: 'text', labelKey: 'modelPlaza.typeText' },
  { id: 'image', labelKey: 'modelPlaza.typeImage' },
  { id: 'av', labelKey: 'modelPlaza.typeAv' },
]

/**
 * 厂商图标映射(首字母色块占位,对齐 Uniapp provider-tab 36×36rpx 厂商图标)。
 * lucide-react-native 未在 packages/app 引入(共享包不引入新依赖),
 * 改用「首字母 + 厂商品牌色背景圆」作为视觉占位。
 * 缺省回退: provider.id 首字母大写 + 中性灰背景。
 */
const PROVIDER_ICONS: Record<string, { letter: string; bg: string }> = {
  openai: { letter: 'O', bg: '#10A37F' },
  anthropic: { letter: 'A', bg: '#D97757' },
  google: { letter: 'G', bg: '#4285F4' },
  cloudflare: { letter: 'C', bg: '#F38020' },
  stepfun: { letter: 'S', bg: '#E94560' },
  nvidia: { letter: 'N', bg: '#76B900' },
}

function providerIcon(providerId: string): { letter: string; bg: string } {
  return (
    PROVIDER_ICONS[providerId] ?? {
      letter: providerId.charAt(0).toUpperCase() || '?',
      bg: '#9CA3AF',
    }
  )
}

/** 类型徽章配色(对齐 mobile-rn 原实现:图像紫 / 音视频绿 / 文本蓝) */
function typeBadge(
  type: ModelPlazaModelType,
  tk: AppThemeTokens,
): { text: string; color: string; bg: string; labelKey: string } {
  if (type === 'image') {
    return {
      text: '',
      color: tk.purple.DEFAULT,
      bg: tk.purple.light,
      labelKey: 'modelPlaza.typeImage',
    }
  }
  if (type === 'av') {
    return { text: '', color: tk.success.deep, bg: tk.success.light, labelKey: 'modelPlaza.typeAv' }
  }
  return {
    text: '',
    color: tk.indigo.DEFAULT,
    bg: tk.indigo.light,
    labelKey: 'modelPlaza.typeText',
  }
}

export function ModelPlazaScreen({
  t,
  items,
  providers,
  providerId,
  typeFilter,
  loading,
  refreshing,
  error,
  onSelectProvider,
  onSelectType,
  onRefresh,
  onPressCompare,
  onPressItem,
  onBack,
  colorScheme = 'light',
}: ModelPlazaScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const currentProvider = providers.find((p) => p.id === providerId) ?? null
  const listByProvider = items.filter((m) => m.providerId === providerId)
  const filteredList =
    typeFilter === 'all' ? listByProvider : listByProvider.filter((m) => m.type === typeFilter)

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('modelPlaza.title')}</Text>
        <TouchableOpacity style={styles.compareBtn} onPress={onPressCompare} activeOpacity={0.85}>
          <Text style={styles.compareText}>{t('modelPlaza.compareBtn')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.providerSection}>
        <Text style={styles.sectionLabel}>{t('modelPlaza.selectProviderLabel')}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.providerScroll}
          contentContainerStyle={styles.providerScrollContent}
        >
          {providers.map((p) => {
            const active = providerId === p.id
            const ic = providerIcon(p.id)
            return (
              <TouchableOpacity
                key={p.id}
                style={[styles.providerTab, active && styles.providerTabActive]}
                onPress={() => onSelectProvider(p.id)}
                activeOpacity={0.8}
              >
                <View style={[styles.providerTabIcon, { backgroundColor: ic.bg }]}>
                  <Text style={styles.providerTabIconText}>{ic.letter}</Text>
                </View>
                <Text style={[styles.providerText, active && styles.providerTextActive]}>
                  {p.name}
                </Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      </View>

      {currentProvider ? (
        <View style={styles.providerHeader}>
          <Text style={styles.providerName}>{currentProvider.name}</Text>
          <Text style={styles.providerMeta}>
            {t('modelPlaza.providerTotal', { count: currentProvider.total })}
          </Text>
          {currentProvider.desc ? (
            <Text style={styles.providerDesc}>{currentProvider.desc}</Text>
          ) : null}
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.typeTabs}>
        {TYPE_TABS.map((tab) => {
          const active = typeFilter === tab.id
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.typeTab, active && styles.typeTabActive]}
              onPress={() => onSelectType(tab.id)}
              activeOpacity={0.8}
            >
              <Text style={[styles.typeTabText, active && styles.typeTabTextActive]}>
                {t(tab.labelKey)}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      <FlatList<ModelPlazaItem>
        data={filteredList}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.listBody}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {loading
                ? t('common.loading')
                : error
                  ? t('modelPlaza.loadFailed')
                  : t('modelPlaza.emptyType')}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const tb = typeBadge(item.type, tk)
          return (
            <TouchableOpacity
              style={styles.modelCard}
              onPress={() => onPressItem(item)}
              activeOpacity={0.85}
            >
              <View style={styles.cardTop}>
                <Text style={styles.modelName} numberOfLines={1}>
                  {item.name}
                </Text>
                <View style={[styles.typeBadge, { backgroundColor: tb.bg }]}>
                  <Text style={[styles.typeBadgeText, { color: tb.color }]}>{t(tb.labelKey)}</Text>
                </View>
              </View>
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>{t('modelPlaza.input')}</Text>
                <Text style={styles.priceValue}>
                  {item.inputPrice !== null
                    ? t('modelPlaza.priceUnit', { price: item.inputPrice })
                    : '-'}
                </Text>
                {item.outputPrice !== null ? (
                  <>
                    <Text style={styles.priceDivider}>|</Text>
                    <Text style={styles.priceLabel}>{t('modelPlaza.output')}</Text>
                    <Text style={styles.priceValue}>
                      {t('modelPlaza.priceUnit', { price: item.outputPrice })}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.priceExtra}>{t('modelPlaza.perCall')}</Text>
                )}
              </View>
              {item.desc ? (
                <Text style={styles.cardDesc} numberOfLines={2}>
                  {item.desc}
                </Text>
              ) : null}
              <View style={styles.cardTagRow}>
                {item.tags.map((tag) => (
                  <View key={tag} style={styles.cardTag}>
                    <Text style={styles.cardTagText}>{tag}</Text>
                  </View>
                ))}
                {item.payMode ? <Text style={styles.payMode}>{item.payMode}</Text> : null}
              </View>
            </TouchableOpacity>
          )
        }}
      />
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.muted },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
      backgroundColor: tk.surface.bg,
    },
    backText: { fontSize: 14, color: tk.text.secondary },
    headerTitle: { fontSize: 20, fontWeight: '700', color: tk.text.primary },
    compareBtn: {
      paddingHorizontal: 12,
      height: 30,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.purple.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    compareText: { fontSize: 12, fontWeight: '600', color: tk.purple.DEFAULT },
    providerScroll: { maxHeight: 44, backgroundColor: tk.surface.bg },
    providerScrollContent: { paddingHorizontal: 16, gap: 8, paddingVertical: 6 },
    providerSection: {
      backgroundColor: tk.surface.bg,
      paddingTop: 10,
      paddingBottom: 6,
    },
    sectionLabel: {
      fontSize: 13,
      color: tk.text.tertiary,
      marginBottom: 8,
      marginHorizontal: 16,
    },
    providerTab: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 14,
      height: 32,
      borderRadius: 16,
      borderWidth: 0,
      backgroundColor: tk.surface.card,
      justifyContent: 'center',
    },
    providerTabActive: {
      backgroundColor: tk.indigo.light,
      borderWidth: 1,
      borderColor: tk.brand.DEFAULT,
    },
    providerTabIcon: {
      width: 18,
      height: 18,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
    },
    providerTabIconText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF', lineHeight: 13 },
    providerText: { fontSize: 13, color: tk.text.secondary },
    providerTextActive: { color: tk.indigo.deep, fontWeight: '600' },
    providerHeader: {
      paddingHorizontal: 12,
      paddingVertical: 14,
      backgroundColor: tk.surface.bg,
    },
    providerName: { fontSize: 18, fontWeight: '600', color: tk.text.primary },
    providerMeta: { marginTop: 4, fontSize: 11, color: tk.text.tertiary },
    providerDesc: { marginTop: 6, fontSize: 12, color: tk.text.secondary, lineHeight: 18 },
    errorBar: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: tk.surface.bg },
    errorText: { fontSize: 12, color: tk.danger.bright },
    typeTabs: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: tk.surface.bg,
    },
    typeTab: {
      paddingHorizontal: 12,
      height: 30,
      borderRadius: 16,
      backgroundColor: tk.surface.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    typeTabActive: { backgroundColor: tk.purple.DEFAULT },
    typeTabText: { fontSize: 12, color: tk.text.secondary },
    typeTabTextActive: { color: tk.surface.light, fontWeight: '600' },
    listBody: { padding: 16, paddingBottom: 32 },
    separator: { height: 10 },
    empty: { alignItems: 'center', paddingVertical: 48 },
    emptyText: { fontSize: 13, color: tk.text.tertiary },
    modelCard: { padding: 12, borderRadius: 12, backgroundColor: tk.surface.bg },
    cardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    modelName: { flex: 1, fontSize: 15, fontWeight: '600', color: tk.text.primary },
    typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginLeft: 8 },
    typeBadgeText: { fontSize: 11, fontWeight: '600' },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 8,
      flexWrap: 'wrap',
    },
    priceLabel: { fontSize: 11, color: tk.text.tertiary },
    priceValue: { fontSize: 12, color: tk.indigo.DEFAULT, fontWeight: '600' },
    priceDivider: { fontSize: 11, color: tk.border.medium, marginHorizontal: 4 },
    priceExtra: { fontSize: 11, color: tk.text.tertiary },
    cardDesc: { fontSize: 12, color: tk.text.secondary, lineHeight: 18, marginBottom: 8 },
    cardTagRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
    cardTag: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
      backgroundColor: tk.surface.card,
    },
    cardTagText: { fontSize: 11, color: tk.text.secondary },
    payMode: { marginLeft: 'auto', fontSize: 11, color: tk.text.tertiary },
  })
}
