/**
 * KnowledgePlanet 知识星球内容展示组件(mobile-rn 端)
 *
 * 对齐历史项目 KnowledgePlanet/index.vue(官方资讯 / 星球社区双 tab + 资讯卡片):
 * - 标题栏:「知识星球」+「进入星球」入口(popular-courses-more,onEnter)
 * - 双 Tab:官方资讯 / 星球社区(popular-courses-tab,selectedTab 驱动列表切换)
 * - 卡片:封面图(左)+ 内容列(标题 / 作者徽章 / 相对时间 / 摘要)
 * - 卡片社交计数:分类标签 + 浏览 / 评论 / 点赞 / 转发(图标 + 数字,line-box)
 * - 下拉刷新(RefreshControl,refreshing/onRefresh 由父级驱动)
 * - 空态提示
 * - 浅色优雅风,rnLightTokens;圆角守门(AGENTS.md §4,无 rounded-full);无分割线(列表 gap 间距)
 * - 配色仅走 brand 黑 / success 绿 / warning 橙 / danger 红(禁用 purple/indigo)
 */
import { useState } from 'react'
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
import { Eye, MessageCircle, Share2, ThumbsUp, type LucideIcon } from 'lucide-react-native'

export interface KnowledgePlanetItem {
  id: string
  title: string
  cover?: string
  summary?: string
  author?: string
  createdAt: number
  /** 分类标签(对齐原项目 classification / typeBox-title) */
  category?: string
  /** 浏览数(对齐原项目 NumberOfVisitors) */
  views?: number
  /** 评论数(对齐原项目 message-Box) */
  comments?: number
  /** 点赞数(对齐原项目 Like) */
  likes?: number
  /** 转发数(对齐原项目 NumberOfForwarding) */
  forwards?: number
}

export interface KnowledgePlanetProps {
  items: KnowledgePlanetItem[]
  onItemClick: (id: string) => void
  onRefresh?: () => void
  refreshing?: boolean
  /** 「进入星球」回调(对齐原项目 popular-courses-more) */
  onEnter?: () => void
  /** 「星球社区」Tab 列表(对齐原项目 kList2);缺省时社区 Tab 复用 items */
  communityItems?: KnowledgePlanetItem[]
  /** Tab 切换回调(对齐原项目 handleTabClick) */
  onTabChange?: (index: number) => void
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

const CATEGORY_BADGE_RADIUS = 6
const CATEGORY_BADGE_PADDING_H = 8
const CATEGORY_BADGE_PADDING_V = 3

const STAT_ICON_SIZE = 12
const STAT_GAP = 4
const STAT_TEXT_SIZE = 11

const EMPTY_FONT_SIZE = 14

/** 星球 Tab(对齐原项目 popular-courses-tab:官方资讯 / 星球社区) */
const PLANET_TABS: ReadonlyArray<string> = ['官方资讯', '星球社区']

/** 大数字缩略展示(万),保留 1 位小数 */
function formatCount(value: number): string {
  if (value >= 10000) {
    const w = value / 10000
    return `${w >= 100 ? Math.round(w) : w.toFixed(1)}万`
  }
  return String(value)
}

interface StatProps {
  icon: LucideIcon
  value?: number
}

/** 单个社交计数:图标 + 数字(无值时整体不渲染) */
function Stat({ icon: Icon, value }: StatProps) {
  if (value === undefined) return null
  return (
    <View style={styles.stat}>
      <Icon size={STAT_ICON_SIZE} color={tokens.text.secondary} strokeWidth={1.8} />
      <Text style={styles.statText} allowFontScaling={false}>
        {formatCount(value)}
      </Text>
    </View>
  )
}

export function KnowledgePlanet({
  items,
  onItemClick,
  onRefresh,
  refreshing = false,
  onEnter,
  communityItems,
  onTabChange,
}: KnowledgePlanetProps) {
  const [selectedTab, setSelectedTab] = useState(0)

  // 资讯 Tab 用 items;社区 Tab 优先 communityItems,缺省复用 items(向后兼容单列表调用方)
  const activeItems = selectedTab === 0 ? items : (communityItems ?? items)

  const handleTabPress = (idx: number) => {
    setSelectedTab(idx)
    onTabChange?.(idx)
  }

  const renderItem = ({ item }: { item: KnowledgePlanetItem }) => {
    const author = item.author ?? DEFAULT_AUTHOR
    const hasSocial =
      item.category !== undefined ||
      item.views !== undefined ||
      item.comments !== undefined ||
      item.likes !== undefined ||
      item.forwards !== undefined
    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}
        onPress={() => onItemClick(item.id)}
        accessibilityRole="button"
        accessibilityLabel={item.title}
      >
        <View style={styles.cardTop}>
          {item.cover ? (
            <Image source={{ uri: item.cover }} style={styles.cover} resizeMode="cover" />
          ) : null}
          <View style={[styles.content, item.cover ? styles.contentGap : null]}>
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
        </View>

        {/* 社交计数行(对齐原项目 line-box:分类 + 浏览 | 评论 / 点赞 / 转发) */}
        {hasSocial ? (
          <View style={styles.socialRow}>
            <View style={styles.socialLeft}>
              {item.category ? (
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryText} numberOfLines={1} allowFontScaling={false}>
                    {item.category}
                  </Text>
                </View>
              ) : null}
              <Stat icon={Eye} value={item.views} />
            </View>
            <View style={styles.socialRight}>
              <Stat icon={MessageCircle} value={item.comments} />
              <Stat icon={ThumbsUp} value={item.likes} />
              <Stat icon={Share2} value={item.forwards} />
            </View>
          </View>
        ) : null}
      </Pressable>
    )
  }

  return (
    <View style={styles.wrapper}>
      {/* 标题栏:知识星球 + 进入星球(对齐原项目 popular-courses-title) */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon} />
          <Text style={styles.headerTitle}>知识星球</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.enterBtn, pressed ? styles.enterBtnPressed : null]}
          onPress={onEnter}
          accessibilityRole="button"
          accessibilityLabel="进入星球"
        >
          <Text style={styles.enterText}>进入星球</Text>
          <Text style={styles.enterArrow} allowFontScaling={false}>
            {'›'}
          </Text>
        </Pressable>
      </View>

      {/* Tab 切换(对齐原项目 popular-courses-tab-box) */}
      <View style={styles.tabBox}>
        {PLANET_TABS.map((tab, idx) => (
          <Pressable
            key={tab}
            style={({ pressed }) => [styles.tabItem, pressed ? styles.tabItemPressed : null]}
            onPress={() => handleTabPress(idx)}
            accessibilityRole="button"
            accessibilityState={{ selected: selectedTab === idx }}
            accessibilityLabel={tab}
          >
            <Text
              style={[
                styles.tabText,
                selectedTab === idx ? styles.tabTextActive : styles.tabTextNormal,
              ]}
            >
              {tab}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* 资讯 / 社区列表(随 Tab 切换) */}
      <FlatList
        data={activeItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: ITEM_GAP }} />}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={tokens.text.secondary}
            />
          ) : undefined
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>暂无内容</Text>
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  } as ViewStyle,
  // ── 标题栏(对齐原项目 popular-courses-title) ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: LIST_PADDING,
    paddingVertical: 10,
  } as ViewStyle,
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  } as ViewStyle,
  headerIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: tokens.brand.DEFAULT,
    marginRight: 8,
  } as ViewStyle,
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.text.primary,
  } as TextStyle,
  enterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  } as ViewStyle,
  enterBtnPressed: {
    opacity: 0.7,
  } as ViewStyle,
  enterText: {
    fontSize: 12,
    color: tokens.text.secondary,
  } as TextStyle,
  enterArrow: {
    fontSize: 16,
    lineHeight: 18,
    color: tokens.text.secondary,
    marginLeft: 2,
  } as TextStyle,
  // ── Tab 切换(对齐原项目 popular-courses-tab-box) ──
  tabBox: {
    flexDirection: 'row',
    paddingHorizontal: LIST_PADDING,
    gap: 16,
    paddingBottom: 8,
  } as ViewStyle,
  tabItem: {
    paddingVertical: 4,
  } as ViewStyle,
  tabItemPressed: {
    opacity: 0.7,
  } as ViewStyle,
  tabText: {
    fontSize: 14,
  } as TextStyle,
  tabTextActive: {
    color: tokens.brand.DEFAULT,
    fontWeight: '700',
  } as TextStyle,
  tabTextNormal: {
    color: tokens.text.secondary,
  } as TextStyle,
  listContent: {
    padding: LIST_PADDING,
  } as ViewStyle,
  card: {
    backgroundColor: tokens.surface.card,
    borderRadius: CARD_RADIUS,
    padding: CARD_PADDING,
  } as ViewStyle,
  cardPressed: {
    backgroundColor: tokens.surface.muted,
  } as ViewStyle,
  cardTop: {
    flexDirection: 'row',
  } as ViewStyle,
  cover: {
    width: COVER_WIDTH,
    height: COVER_HEIGHT,
    borderRadius: COVER_RADIUS,
    backgroundColor: tokens.border.light,
  } as ImageStyle,
  content: {
    flex: 1,
    justifyContent: 'space-between',
  } as ViewStyle,
  contentGap: {
    marginLeft: 12,
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
    backgroundColor: tokens.surface.light,
    borderRadius: AUTHOR_BADGE_RADIUS,
    paddingHorizontal: AUTHOR_BADGE_PADDING_H,
    paddingVertical: AUTHOR_BADGE_PADDING_V,
  } as ViewStyle,
  authorText: {
    fontSize: META_FONT_SIZE,
    lineHeight: META_FONT_SIZE + 2,
    color: tokens.text.primary,
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
  // ── 社交计数行(对齐原项目 line-box) ──
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: CARD_PADDING,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.border.light,
  } as ViewStyle,
  socialLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  } as ViewStyle,
  socialRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  } as ViewStyle,
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: STAT_GAP,
  } as ViewStyle,
  statText: {
    fontSize: STAT_TEXT_SIZE,
    lineHeight: STAT_TEXT_SIZE + 3,
    color: tokens.text.secondary,
  } as TextStyle,
  categoryBadge: {
    backgroundColor: tokens.warning.DEFAULT,
    borderRadius: CATEGORY_BADGE_RADIUS,
    paddingHorizontal: CATEGORY_BADGE_PADDING_H,
    paddingVertical: CATEGORY_BADGE_PADDING_V,
  } as ViewStyle,
  categoryText: {
    fontSize: META_FONT_SIZE,
    lineHeight: META_FONT_SIZE + 2,
    color: tokens.surface.light,
    fontWeight: '600',
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
