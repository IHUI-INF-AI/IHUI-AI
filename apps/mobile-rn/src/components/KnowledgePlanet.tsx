/**
 * KnowledgePlanet 知识星球内容展示组件(mobile-rn 端)
 *
 * 对齐历史项目 KnowledgePlanet/index.vue(资讯列表 / 广场动态卡片):
 * - 卡片列表:封面图(左)+ 内容列(标题 / 作者徽章 / 相对时间 / 摘要)
 * - 下拉刷新(RefreshControl,refreshing/onRefresh 由父级驱动)
 * - 空态提示
 * - 浅色优雅风,rnLightTokens;圆角守门(AGENTS.md §4,无 rounded-full);无分割线(列表 gap 间距)
 */
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { formatRelativeTime } from '@ihui/shared'

export interface KnowledgePlanetItem {
  id: string
  title: string
  cover?: string
  summary?: string
  author?: string
  createdAt: number
}

export interface KnowledgePlanetProps {
  items: KnowledgePlanetItem[]
  onItemClick: (id: string) => void
  onRefresh?: () => void
  refreshing?: boolean
}

const DEFAULT_AUTHOR = 'AI 智汇社'

const LIST_PADDING = 16
const ITEM_GAP = 12
const CARD_RADIUS = 12
const CARD_PADDING = 12

const COVER_WIDTH = 100
const COVER_HEIGHT = 80
const COVER_RADIUS = 8

const TITLE_FONT_SIZE = 15
const SUMMARY_FONT_SIZE = 12
const META_FONT_SIZE = 11

const AUTHOR_BADGE_RADIUS = 6
const AUTHOR_BADGE_PADDING_H = 8
const AUTHOR_BADGE_PADDING_V = 3

const EMPTY_FONT_SIZE = 14

export function KnowledgePlanet({ items, onItemClick, onRefresh, refreshing = false }: KnowledgePlanetProps) {
  const renderItem = ({ item }: { item: KnowledgePlanetItem }) => {
    const author = item.author ?? DEFAULT_AUTHOR
    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}
        onPress={() => onItemClick(item.id)}
        accessibilityRole="button"
        accessibilityLabel={item.title}
      >
        {item.cover ? (
          <Image source={{ uri: item.cover }} style={styles.cover} resizeMode="cover" />
        ) : null}
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={2}>
            {item.title}
          </Text>
          <View style={styles.metaRow}>
            <View style={styles.authorBadge}>
              <Text style={styles.authorText} numberOfLines={1} allowFontScaling={false}>
                {author}
              </Text>
            </View>
            <Text style={styles.timeText} allowFontScaling={false}>
              {formatRelativeTime(item.createdAt)}
            </Text>
          </View>
          {item.summary ? (
            <Text style={styles.summary} numberOfLines={2}>
              {item.summary}
            </Text>
          ) : null}
        </View>
      </Pressable>
    )
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      contentContainerStyle={styles.listContent}
      ItemSeparatorComponent={() => <View style={{ height: ITEM_GAP }} />}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.text.secondary} />
        ) : undefined
      }
      ListEmptyComponent={
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>暂无内容</Text>
        </View>
      }
    />
  )
}

const styles = StyleSheet.create({
  listContent: {
    padding: LIST_PADDING,
  } as ViewStyle,
  card: {
    flexDirection: 'row',
    backgroundColor: tokens.surface.card,
    borderRadius: CARD_RADIUS,
    padding: CARD_PADDING,
  } as ViewStyle,
  cardPressed: {
    backgroundColor: tokens.surface.muted,
  } as ViewStyle,
  cover: {
    width: COVER_WIDTH,
    height: COVER_HEIGHT,
    borderRadius: COVER_RADIUS,
    backgroundColor: tokens.border.light,
  } as ImageStyle,
  content: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  } as ViewStyle,
  title: {
    fontSize: TITLE_FONT_SIZE,
    lineHeight: TITLE_FONT_SIZE + 4,
    fontWeight: '600',
    color: tokens.text.primary,
  } as TextStyle,
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  } as ViewStyle,
  authorBadge: {
    backgroundColor: tokens.purple.light,
    borderRadius: AUTHOR_BADGE_RADIUS,
    paddingHorizontal: AUTHOR_BADGE_PADDING_H,
    paddingVertical: AUTHOR_BADGE_PADDING_V,
  } as ViewStyle,
  authorText: {
    fontSize: META_FONT_SIZE,
    lineHeight: META_FONT_SIZE + 2,
    color: tokens.purple.DEFAULT,
    fontWeight: '600',
  } as TextStyle,
  timeText: {
    fontSize: META_FONT_SIZE,
    lineHeight: META_FONT_SIZE + 2,
    color: tokens.text.secondary,
  } as TextStyle,
  summary: {
    marginTop: 6,
    fontSize: SUMMARY_FONT_SIZE,
    lineHeight: SUMMARY_FONT_SIZE + 6,
    color: tokens.text.secondary,
  } as TextStyle,
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  } as ViewStyle,
  emptyText: {
    fontSize: EMPTY_FONT_SIZE,
    lineHeight: EMPTY_FONT_SIZE + 4,
    color: tokens.text.tertiary,
  } as TextStyle,
})

export default KnowledgePlanet
