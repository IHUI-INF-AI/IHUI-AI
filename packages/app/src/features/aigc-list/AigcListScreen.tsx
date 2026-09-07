// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo, useState } from 'react'
import {
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ImageLoadEvent,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { AigcCategory, AigcFileType, AigcListItem, AigcListScreenProps } from '../../types'

/** AIGC 作品列表共享屏 — props 注入式跨端组件(纯 UI,不依赖平台 API) */
export type { AigcCategory, AigcListItem, AigcListScreenProps }

type AigcStyles = ReturnType<typeof createStyles>

/** 瀑布流图片:对齐历史 image mode="widthFix" — 加载后按真实宽高比撑开自然高度 */
function WaterfallImage({
  uri,
  styles,
}: {
  uri?: string
  styles: AigcStyles
}) {
  const [ratio, setRatio] = useState(3 / 4)
  if (!uri) {
    return <View style={[styles.waterfallImage, { aspectRatio: 3 / 4 }]} />
  }
  return (
    <Image
      source={{ uri }}
      style={[styles.waterfallImage, { aspectRatio: ratio }]}
      resizeMode="cover"
      onLoad={(e: ImageLoadEvent) => {
        const src = e.nativeEvent.source
        if (src?.width && src?.height && src.width > 0) {
          setRatio(src.width / src.height)
        }
      }}
    />
  )
}

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

  /**
   * 列表行分组:媒体(fileType 0/1)走双列瀑布流,文本(4)/音频(3)保持整行卡片。
   * 对齐历史 pages/tools/aigc/index.vue:瀑布流 getColumnItems(index % 2) 分列,
   * 文本/音频分类走独立列表分支。
   */
  type AigcListRow =
    | { kind: 'waterfall'; media: AigcListItem[] }
    | { kind: 'single'; item: AigcListItem }

  const rows = useMemo<AigcListRow[]>(() => {
    const media = filtered.filter((w) => w.fileType === 0 || w.fileType === 1)
    const singles = filtered.filter((w) => w.fileType !== 0 && w.fileType !== 1)
    const out: AigcListRow[] = []
    if (media.length > 0) out.push({ kind: 'waterfall', media })
    for (const item of singles) out.push({ kind: 'single', item })
    return out
  }, [filtered])

  /** 双列瀑布流:对齐历史 index % 2 分列 + 图片 widthFix 自然高度 */
  const renderWaterfall = (media: AigcListItem[]) => {
    const columns: [AigcListItem[], AigcListItem[]] = [[], []]
    media.forEach((item, index) => columns[index % 2]!.push(item))
    return (
      <View style={styles.waterfallContainer}>
        {columns.map((column, columnIndex) => (
          <View key={columnIndex} style={styles.waterfallColumn}>
            {column.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.waterfallItem}
                activeOpacity={0.7}
                onPress={() => onPressItem(item)}
              >
                {item.fileType === 1 ? (
                  <View style={styles.videoThumb}>
                    {item.coverUrl ? (
                      <Image
                        source={{ uri: item.coverUrl }}
                        style={styles.videoThumbImage}
                        resizeMode="cover"
                      />
                    ) : null}
                    <View style={styles.playOverlay}>
                      <View style={styles.playButton}>
                        <Text style={styles.playIcon}>▶</Text>
                      </View>
                    </View>
                  </View>
                ) : (
                  <WaterfallImage uri={item.fileUrl ?? item.coverUrl} styles={styles} />
                )}
                <View style={styles.waterfallFooter}>
                  <Text style={styles.waterfallTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  {item.subtitle ? (
                    <Text style={styles.waterfallSubtitle} numberOfLines={1}>
                      {item.subtitle}
                    </Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>
    )
  }

  const renderSingle = (item: AigcListItem) => {
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
    return null
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

      <FlatList<AigcListRow>
        style={styles.list}
        data={rows}
        keyExtractor={(row) => (row.kind === 'waterfall' ? 'waterfall' : row.item.id)}
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
        renderItem={({ item: row }) =>
          row.kind === 'waterfall' ? renderWaterfall(row.media) : renderSingle(row.item)
        }
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
    header: { paddingHorizontal: 10, paddingTop: 48, paddingBottom: 8 },
    backText: { fontSize: 16, color: tk.text.secondary },
    title: { marginTop: 8, fontSize: 22, fontWeight: '600', color: tk.text.primary },
    headerSubtitle: { marginTop: 8, fontSize: 14, color: tk.text.secondary },
    categoryBar: { maxHeight: 48 },
    categoryContent: { paddingHorizontal: 10, paddingVertical: 8, gap: 8 },
    categoryChip: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 12,
      backgroundColor: tk.surface.card,
    },
    categoryChipActive: { backgroundColor: tk.brand.DEFAULT },
    categoryText: { fontSize: 14, color: tk.text.medium },
    categoryTextActive: { color: tk.surface.light, fontWeight: '600' },
    list: { flex: 1, paddingHorizontal: 12 },
    // 双列瀑布流(对齐历史 .waterfall-container/.waterfall-column/.waterfall-item)
    waterfallContainer: { flexDirection: 'row', paddingVertical: 10 },
    waterfallColumn: { flex: 1, paddingHorizontal: 5 },
    waterfallItem: {
      marginBottom: 10,
      borderRadius: 8,
      overflow: 'hidden',
      backgroundColor: tk.surface.muted,
    },
    waterfallImage: { width: '100%', backgroundColor: tk.surface.muted },
    // 视频缩略图:对齐历史 400rpx 固定高 + aspectFill + 居中播放按钮
    videoThumb: { width: '100%', height: 200, backgroundColor: tk.surface.muted },
    videoThumbImage: { width: '100%', height: '100%' },
    playOverlay: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    playButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    playIcon: { fontSize: 14, color: tk.surface.light },
    waterfallFooter: { padding: 10 },
    waterfallTitle: { fontSize: 14, fontWeight: '600', color: tk.text.primary },
    waterfallSubtitle: { marginTop: 4, fontSize: 12, color: tk.text.secondary },
    cardTitle: { fontSize: 16, fontWeight: '600', color: tk.text.primary },
    textCard: {
      flex: 2,
      padding: 14,
      borderRadius: 12,
      backgroundColor: tk.surface.light,
      borderWidth: 1,
      borderColor: tk.border.light,
      marginBottom: 12,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cardTime: { fontSize: 11, color: tk.text.tertiary },
    promptText: { marginTop: 8, fontSize: 14, color: tk.brand.DEFAULT },
    contentText: { marginTop: 8, fontSize: 14, color: tk.text.medium, lineHeight: 20 },
    audioCard: {
      flex: 2,
      flexDirection: 'row',
      padding: 14,
      borderRadius: 12,
      backgroundColor: tk.surface.light,
      borderWidth: 1,
      borderColor: tk.border.light,
      marginBottom: 12,
      alignItems: 'center',
    },
    audioCover: { width: 64, height: 64, borderRadius: 12, backgroundColor: tk.border.light },
    audioInfo: { flex: 1, marginLeft: 12 },
    audioDuration: { marginTop: 8, fontSize: 11, color: tk.text.tertiary },
    audioPlayBtn: {
      marginTop: 8,
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      backgroundColor: tk.success.light,
    },
    audioPlayText: { fontSize: 14, color: tk.brand.DEFAULT, fontWeight: '600' },
    empty: { paddingVertical: 60, alignItems: 'center' },
    emptyText: { fontSize: 14, color: tk.text.tertiary },
    errorBar: { paddingHorizontal: 10, paddingVertical: 8 },
    errorText: { fontSize: 14, color: tk.danger.DEFAULT },
    fab: {
      position: 'absolute',
      bottom: 24,
      left: '50%',
      transform: [{ translateX: -80 }],
      width: 160,
      height: 44,
      borderRadius: 12,
      backgroundColor: tk.brand.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: tk.gray.black,
      shadowOpacity: 0.15,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 3,
    },
    fabText: { color: tk.surface.light, fontSize: 16, fontWeight: '600' },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
