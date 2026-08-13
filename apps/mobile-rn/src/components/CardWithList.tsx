/**
 * CardWithList 卡片列表 (mobile-rn 端)
 *
 * 对齐历史项目 CardWithList.vue(卡片 + 横向滚动的列表项):
 * - 卡片容器:浅色 surface.light 底,padding 12,borderRadius 12
 * - 卡片头:可选标题(粗体)
 * - 主体:水平 ScrollView,内含若干 item 卡片(图标占位 + 标题 + 副标题)
 * - 点击单个 item → onItemClick(id)
 * - 浅色优雅风,无霓虹无渐变,无分割线
 *
 * 任务规格:
 *   interface CardWithListItem { id: string; title: string; subtitle?: string; icon?: string }
 *   interface CardWithListProps { title?: string; items: CardWithListItem[]; onItemClick?: (id: string) => void }
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
}

const CARD_PADDING = 12
const CARD_RADIUS = 12
const HEADER_GAP = 8
const ITEM_WIDTH = 96
const ITEM_PADDING = 10
const ITEM_RADIUS = 8
const ITEM_GAP = 8
const ICON_SIZE = 48
const ICON_FONT_SIZE = 24
const ITEM_TITLE_FONT_SIZE = 12
const ITEM_SUBTITLE_FONT_SIZE = 10
const TITLE_FONT_SIZE = 15

const DEFAULT_ICON = '🏷️'

export function CardWithList({ title, items, onItemClick }: CardWithListProps) {
  return (
    <View style={styles.card}>
      {title ? (
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
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
  title: {
    fontSize: TITLE_FONT_SIZE,
    fontWeight: '600',
    color: tk.text.primary,
    marginBottom: HEADER_GAP,
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
