/**
 * CardWithList 卡片列表 (mobile-rn 端)
 *
 * 对齐历史项目 CardWithList.vue(卡片 + 横向滚动的列表项):
 * - 卡片容器:浅色 surface.light 底,padding 12,borderRadius 12
 * - 卡片头:可选标题(粗体) + 右侧「完整榜单」入口(带箭头,对齐原版 more-click)
 * - 主体:水平 ScrollView,内含若干 item 卡片(图标占位 + 标题 + 副标题)
 * - 点击单个 item → onItemClick(id);点击「完整榜单」→ onMore()
 * - 浅色优雅风,无霓虹无渐变,无分割线
 *
 * 任务规格:
 *   interface CardWithListItem { id: string; title: string; subtitle?: string; icon?: string }
 *   interface CardWithListProps { title?: string; items: CardWithListItem[]; onItemClick?: (id: string) => void; onMore?: () => void; moreText?: string }
 */
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { rnLightTokens as tk } from '@ihui/design-tokens'

export interface CardWithListItem {
  id: string
  title: string
  subtitle?: string
  icon?: string
}

export interface CardWithListProps {
  title?: string
  items: CardWithListItem[]
  onItemClick?: (id: string) => void
  /** 卡片头右侧「完整榜单」入口回调(对齐原版 more-click;不传则不渲染入口) */
  onMore?: () => void
  /** 入口文案,缺省「完整榜单」 */
  moreText?: string
}

const CARD_PADDING = 12
const CARD_RADIUS = 12
const HEADER_GAP = 8
const ITEM_WIDTH = '22%'
const ITEM_PADDING = 10
const ITEM_RADIUS = 4
const ITEM_GAP = 8
const ICON_SIZE = 50
const ICON_FONT_SIZE = 24
const ITEM_TITLE_FONT_SIZE = 12
const ITEM_SUBTITLE_FONT_SIZE = 10
const TITLE_FONT_SIZE = 16
const MORE_FONT_SIZE = 12
const MORE_ARROW_FONT_SIZE = 16

const DEFAULT_ICON = '🏷️'

export function CardWithList({ title, items, onItemClick, onMore, moreText }: CardWithListProps) {
  return (
    <View style={styles.card}>
      {title || onMore ? (
        <View style={styles.header}>
          {title ? (
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
          {onMore ? (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={onMore}
              style={styles.more}
              accessibilityRole="button"
              accessibilityLabel={moreText ?? '完整榜单'}
            >
              <Text style={styles.moreText}>{moreText ?? '完整榜单'}</Text>
              <Text style={styles.moreArrow} allowFontScaling={false}>
                ›
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.itemsContainer}
      >
        {items.map((item) => (
          <TouchableOpacity
            key={item.id}
            activeOpacity={0.8}
            onPress={() => onItemClick?.(item.id)}
            style={styles.item}
            accessibilityRole="button"
            accessibilityLabel={item.title}
          >
            <View style={styles.iconWrap}>
              <Text style={styles.iconText} allowFontScaling={false}>
                {item.icon ?? DEFAULT_ICON}
              </Text>
            </View>
            <Text style={styles.itemTitle} numberOfLines={1}>
              {item.title}
            </Text>
            {item.subtitle ? (
              <Text style={styles.itemSubtitle} numberOfLines={1}>
                {item.subtitle}
              </Text>
            ) : null}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tk.surface.light,
    borderRadius: CARD_RADIUS,
    padding: CARD_PADDING,
  } as ViewStyle,
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: HEADER_GAP,
  } as ViewStyle,
  title: {
    flex: 1,
    fontSize: TITLE_FONT_SIZE,
    fontWeight: '600',
    color: tk.text.primary,
  } as TextStyle,
  more: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  } as ViewStyle,
  moreText: {
    fontSize: MORE_FONT_SIZE,
    color: tk.text.secondary,
  } as TextStyle,
  moreArrow: {
    fontSize: MORE_ARROW_FONT_SIZE,
    color: tk.text.secondary,
    marginLeft: 2,
  } as TextStyle,
  itemsContainer: {
    gap: ITEM_GAP,
  } as ViewStyle,
  item: {
    width: ITEM_WIDTH,
    padding: ITEM_PADDING,
    borderRadius: ITEM_RADIUS,
    backgroundColor: tk.surface.muted,
    alignItems: 'center',
  } as ViewStyle,
  iconWrap: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ITEM_RADIUS,
    backgroundColor: tk.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  } as ViewStyle,
  iconText: {
    fontSize: ICON_FONT_SIZE,
  } as TextStyle,
  itemTitle: {
    fontSize: ITEM_TITLE_FONT_SIZE,
    fontWeight: '600',
    color: tk.text.primary,
    textAlign: 'center',
  } as TextStyle,
  itemSubtitle: {
    marginTop: 2,
    fontSize: ITEM_SUBTITLE_FONT_SIZE,
    color: tk.text.secondary,
    textAlign: 'center',
  } as TextStyle,
})

export default CardWithList
