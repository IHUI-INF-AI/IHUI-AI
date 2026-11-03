// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'

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
import {
  FileText,
  Film,
  Image as ImageIcon,
  Music,
  Sparkles,
  type LucideIcon,
} from 'lucide-react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { AigcCategory, AigcFileType, AigcListItem, AigcListScreenProps } from '../../types'
import { BackChevron } from '../../components/BackChevron'
import { EmptyState, ScreenSkeleton } from '../../components/ScreenStates'
import { assertRequiredPort, isCapabilityOff, resolveOptionalPort } from '../../host/ports'

/** AIGC 作品类型 → 轮播图占位图标(0 图片 / 1 视频 / 3 音频 / 4 文案) */
const FILE_TYPE_ICON = {
  0: ImageIcon,
  1: Film,
  3: Music,
  4: FileText,
} satisfies Record<AigcFileType, LucideIcon>

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
  onToast,
  audio,
  carousel,
}: AigcListScreenProps) {
  assertRequiredPort('onToast', onToast)

  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  /** 音频端口缺省 = capability-off:显式失败提示,绝不假装播放成功 */
  const audioPort = resolveOptionalPort(audio)
  const playAudio = (item: AigcListItem) => {
    if (isCapabilityOff(audioPort)) {
      onToast(t('common.failed'))
      return
    }
    const url = item.audioUrl || item.fileUrl
    if (!url) {
      onToast(t('common.failed'))
      return
    }
    audioPort.play(url)
  }

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
            <TouchableOpacity
              style={styles.audioPlayBtn}
              activeOpacity={0.7}
              onPress={(event) => {
                // 阻止冒泡:点"播放"不应同时跳到作品详情
                event.stopPropagation()
                playAudio(item)
              }}
            >
              <Text style={styles.audioPlayText}>{t('aigcList.playAudio')}</Text>
            </TouchableOpacity>
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
      {carousel && carousel.items.length > 0 ? (
        <ScrollView
          horizontal
          testID="aigc-list-carousel"
          showsHorizontalScrollIndicator={false}
          style={styles.carousel}
          contentContainerStyle={styles.carouselContent}
        >
          {carousel.items.map((item) => {
            const Icon = FILE_TYPE_ICON[item.fileType] ?? Sparkles
            return (
              <TouchableOpacity
                key={item.id}
                testID={`aigc-carousel-${item.id}`}
                style={styles.carouselCard}
                activeOpacity={0.8}
                onPress={() => carousel.onPress(item)}
              >
                {item.coverUrl ? (
                  <Image source={{ uri: item.coverUrl }} style={styles.carouselCover} />
                ) : (
                  <View style={styles.carouselCover}>
                    <Icon size={32} color={tk.brand.DEFAULT} />
                  </View>
                )}
                <View style={styles.carouselInfo}>
                  <Text style={styles.carouselTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.carouselFree}>免费</Text>
                </View>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      ) : null}

      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
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
          loading ? (
            <ScreenSkeleton variant="grid" count={4} colorScheme={colorScheme} />
          ) : (
            <EmptyState title={t('aigcList.empty')} colorScheme={colorScheme} />
          )
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
    carousel: { flexGrow: 0, marginTop: rnSpacing.sm },
    carouselContent: {
      paddingHorizontal: rnSpacing['sm-loose'],
      gap: rnSpacing.sm,
    },
    carouselCard: {
      width: 240,
      height: 144,
      borderRadius: rnRadius.lg,
      overflow: 'hidden',
      backgroundColor: tk.surface.card,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    carouselCover: {
      width: '100%',
      height: 96,
      backgroundColor: tk.border.light,
      alignItems: 'center',
      justifyContent: 'center',
    },
    carouselInfo: { paddingHorizontal: rnSpacing.md, paddingVertical: rnSpacing.sm },
    carouselTitle: { fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
    carouselFree: {
      marginTop: rnSpacing.xs,
      fontSize: rnType.caption.size,
      color: tk.brand.DEFAULT,
    },
    header: { paddingHorizontal: rnSpacing['sm-loose'], paddingBottom: rnSpacing.sm },
    title: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.heading.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
    headerSubtitle: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.body.size,
      color: tk.text.secondary,
    },
    categoryBar: { maxHeight: 48 },
    categoryContent: {
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingVertical: rnSpacing.sm,
      gap: rnSpacing.sm,
    },
    categoryChip: {
      paddingHorizontal: rnSpacing['md-loose'],
      paddingVertical: rnSpacing['xs-loose'],
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.card,
    },
    categoryChipActive: { backgroundColor: tk.brand.cta },
    categoryText: { fontSize: rnType.body.size, color: tk.text.medium },
    categoryTextActive: { color: tk.surface.light, fontWeight: '600' },
    list: { flex: 1, paddingHorizontal: rnSpacing.md },
    row: { gap: rnSpacing.md, marginBottom: rnSpacing.md },
    mediaCard: {
      flex: 1,
      borderRadius: rnRadius.lg,
      overflow: 'hidden',
      backgroundColor: tk.surface.light,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    mediaCover: { width: '100%', aspectRatio: 3 / 4, backgroundColor: tk.border.light },
    videoBadge: {
      position: 'absolute',
      top: 8,
      left: 8,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.md,
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    videoBadgeText: { fontSize: rnType.caption.size, color: tk.surface.light },
    mediaFooter: { padding: rnSpacing.md },
    cardTitle: { fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
    subtitle: { marginTop: rnSpacing.sm, fontSize: rnType.body.size, color: tk.text.secondary },
    textCard: {
      flex: 2,
      padding: rnSpacing['md-loose'],
      borderRadius: rnRadius.lg,
      backgroundColor: tk.surface.light,
      borderWidth: 1,
      borderColor: tk.border.light,
      marginBottom: rnSpacing.md,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cardTime: { fontSize: rnType.caption.size, color: tk.text.tertiary },
    promptText: { marginTop: rnSpacing.sm, fontSize: rnType.body.size, color: tk.brand.DEFAULT },
    contentText: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.body.size,
      color: tk.text.medium,
      lineHeight: rnType.body.lineHeight,
    },
    audioCard: {
      flex: 2,
      flexDirection: 'row',
      padding: rnSpacing['md-loose'],
      borderRadius: rnRadius.lg,
      backgroundColor: tk.surface.light,
      borderWidth: 1,
      borderColor: tk.border.light,
      marginBottom: rnSpacing.md,
      alignItems: 'center',
    },
    audioCover: {
      width: 64,
      height: 64,
      borderRadius: rnRadius.xl,
      backgroundColor: tk.border.light,
    },
    audioInfo: { flex: 1, marginLeft: rnSpacing.md },
    audioDuration: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.caption.size,
      color: tk.text.tertiary,
    },
    audioPlayBtn: {
      marginTop: rnSpacing.sm,
      alignSelf: 'flex-start',
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.success.light,
    },
    audioPlayText: { fontSize: rnType.body.size, color: tk.brand.DEFAULT, fontWeight: '600' },
    errorBar: { paddingHorizontal: rnSpacing['sm-loose'], paddingVertical: rnSpacing.sm },
    errorText: { fontSize: rnType.body.size, color: tk.danger.DEFAULT },
    fab: {
      position: 'absolute',
      bottom: 24,
      left: '50%',
      transform: [{ translateX: -80 }],
      width: 160,
      height: 44,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: tk.gray.black,
      shadowOpacity: 0.15,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 3,
    },
    fabText: { color: tk.surface.light, fontSize: rnType.title.size, fontWeight: '600' },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
