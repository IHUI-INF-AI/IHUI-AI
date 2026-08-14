import { useMemo } from 'react'
import {
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { AigcCategory, AigcFileType, AigcListItem, AigcListScreenProps } from '../../types'

/** AIGC 作品列表共享屏 — props 注入式跨端组件(纯 UI,不依赖平台 API) */
export type { AigcCategory, AigcListItem, AigcListScreenProps }

export function AigcListScreen({
  t,
  items,
  categories,
  category,
  loading,
  refreshing,
  error,
  onSelectCategory,
  onRefresh,
  onPressItem,
  onPublish,
  onBack,
  onLoadMore,
  colorScheme = 'light',
}: AigcListScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const fileTypeForCategory = (key: AigcCategory): AigcFileType | undefined =>
    categories.find((c) => c.key === key)?.fileType

  const filtered =
    category === 'all' ? items : items.filter((w) => w.fileType === fileTypeForCategory(category))

  const renderItem = ({ item }: { item: AigcListItem }) => {
    if (item.fileType === 4) {
      return (
        <TouchableOpacity
          style={styles.textCard}
          onPress={() => onPressItem(item)}
          activeOpacity={0.7}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.cardTime}>{item.createdAt}</Text>
          </View>
          {item.prompt ? (
            <Text style={styles.promptText} numberOfLines={1}>
              {t('aigcList.promptLabel')} {item.prompt}
            </Text>
          ) : null}
          {item.content ? (
            <Text style={styles.contentText} numberOfLines={3}>
              {item.content}
            </Text>
          ) : null}
        </TouchableOpacity>
      )
    }
    if (item.fileType === 3) {
      return (
        <TouchableOpacity
          style={styles.audioCard}
          onPress={() => onPressItem(item)}
          activeOpacity={0.7}
        >
          <Image source={{ uri: item.coverUrl }} style={styles.audioCover} />
          <View style={styles.audioInfo}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.audioDuration}>{item.duration ?? '--:--'}</Text>
            <View style={styles.audioPlayBtn}>
              <Text style={styles.audioPlayText}>{t('aigcList.playAudio')}</Text>
            </View>
          </View>
        </TouchableOpacity>
      )
    }
    return (
      <TouchableOpacity
        style={styles.mediaCard}
        onPress={() => onPressItem(item)}
        activeOpacity={0.7}
      >
        <Image source={{ uri: item.coverUrl }} style={styles.mediaCover} resizeMode="cover" />
        {item.fileType === 1 ? (
          <View style={styles.videoBadge}>
            <Text style={styles.videoBadgeText}>{t('aigcList.videoBadge')}</Text>
          </View>
        ) : null}
        <View style={styles.mediaFooter}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.title}
          </Text>
          {item.subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {item.subtitle}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('aigcList.title')}</Text>
        <Text style={styles.headerSubtitle}>{t('aigcList.subtitle')}</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryBar}
        contentContainerStyle={styles.categoryContent}
      >
        {categories.map((c) => (
          <TouchableOpacity
            key={c.key}
            style={[styles.categoryChip, category === c.key && styles.categoryChipActive]}
            onPress={() => onSelectCategory(c.key)}
          >
            <Text style={[styles.categoryText, category === c.key && styles.categoryTextActive]}>
              {c.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {error ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <FlatList<AigcListItem>
        style={styles.list}
        data={filtered}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {loading ? t('common.loading') : t('aigcList.empty')}
            </Text>
          </View>
        }
        renderItem={renderItem}
      />

      <TouchableOpacity style={styles.fab} onPress={onPublish} activeOpacity={0.85}>
        <Text style={styles.fabText}>{t('aigcList.publish')}</Text>
      </TouchableOpacity>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.light },
    header: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 8 },
    backText: { fontSize: 14, color: tk.text.secondary },
    title: { marginTop: 8, fontSize: 22, fontWeight: '600', color: tk.text.primary },
    headerSubtitle: { marginTop: 4, fontSize: 13, color: tk.text.secondary },
    categoryBar: { maxHeight: 48 },
    categoryContent: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
    categoryChip: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: tk.surface.card,
    },
    categoryChipActive: { backgroundColor: tk.brand.DEFAULT },
    categoryText: { fontSize: 13, color: tk.text.medium },
    categoryTextActive: { color: tk.surface.light, fontWeight: '600' },
    list: { flex: 1, paddingHorizontal: 12 },
    row: { gap: 12, marginBottom: 12 },
    mediaCard: {
      flex: 1,
      borderRadius: 8,
      overflow: 'hidden',
      backgroundColor: tk.surface.muted,
    },
    mediaCover: { width: '100%', aspectRatio: 3 / 4, backgroundColor: tk.border.light },
    videoBadge: {
      position: 'absolute',
      top: 8,
      left: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    videoBadgeText: { fontSize: 11, color: tk.surface.light },
    mediaFooter: { padding: 10 },
    cardTitle: { fontSize: 14, fontWeight: '600', color: tk.text.primary },
    subtitle: { marginTop: 4, fontSize: 12, color: tk.text.secondary },
    textCard: {
      flex: 2,
      padding: 14,
      borderRadius: 10,
      backgroundColor: tk.surface.muted,
      marginBottom: 12,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cardTime: { fontSize: 11, color: tk.text.tertiary },
    promptText: { marginTop: 8, fontSize: 12, color: tk.brand.DEFAULT },
    contentText: { marginTop: 8, fontSize: 13, color: tk.text.medium, lineHeight: 20 },
    audioCard: {
      flex: 2,
      flexDirection: 'row',
      padding: 16,
      borderRadius: 8,
      backgroundColor: tk.surface.muted,
      marginBottom: 12,
      alignItems: 'center',
    },
    audioCover: { width: 64, height: 64, borderRadius: 8, backgroundColor: tk.border.light },
    audioInfo: { flex: 1, marginLeft: 12 },
    audioDuration: { marginTop: 4, fontSize: 11, color: tk.text.tertiary },
    audioPlayBtn: {
      marginTop: 8,
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 6,
      backgroundColor: tk.success.light,
    },
    audioPlayText: { fontSize: 12, color: tk.brand.DEFAULT, fontWeight: '600' },
    empty: { paddingVertical: 60, alignItems: 'center' },
    emptyText: { fontSize: 13, color: tk.text.tertiary },
    errorBar: { paddingHorizontal: 16, paddingVertical: 8 },
    errorText: { fontSize: 13, color: tk.danger.DEFAULT },
    fab: {
      position: 'absolute',
      bottom: 24,
      left: '50%',
      transform: [{ translateX: -80 }],
      width: 160,
      height: 44,
      borderRadius: 8,
      backgroundColor: tk.brand.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: tk.gray.black,
      shadowOpacity: 0.15,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 3,
    },
    fabText: { color: tk.surface.light, fontSize: 14, fontWeight: '600' },
  })
}
