/**
 * SingleTypeBar 单选分类条(mobile-rn 端)
 *
 * 对齐历史 Uniapp components/type-bar/single.vue(单选水平 scroll-x 分类条):
 *   <scroll-view scroll-x> 内若干 tab_item,点击 select(item) emit change,
 *   active 项高亮(border + 背景 + 阴影),非 active 淡色。
 *
 * 与 TitleSwitchTypeBar(多选)区分:本组件单选,selectedId 唯一。
 * 浅色优雅风;圆角守门(8,无 rounded-full);无分割线(gap 间距);类型零 any。
 */
import { Pressable, ScrollView, StyleSheet, Text, type TextStyle, type ViewStyle } from 'react-native'
import { rnLightTokens as tokens } from '@ihui/design-tokens'

export interface SingleTypeBarItem {
  id: string
  label: string
}

export interface SingleTypeBarProps {
  items: readonly SingleTypeBarItem[]
  /** 当前选中项 id */
  selectedId: string
  /** 选中项变更回调(对齐 Uniapp emit change) */
  onSelect: (id: string) => void
}

export function SingleTypeBar({
  items,
  selectedId,
  onSelect,
}: SingleTypeBarProps): React.JSX.Element {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {items.map((item) => {
        const active = item.id === selectedId
        return (
          <Pressable
            key={item.id}
            style={({ pressed }) => [
              styles.item,
              active ? styles.itemActive : null,
              pressed ? styles.itemPressed : null,
            ]}
            onPress={() => onSelect(item.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={item.label}
          >
            <Text style={[styles.text, active ? styles.textActive : null]}>{item.label}</Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 8,
  } as ViewStyle,
  item: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.light,
  } as ViewStyle,
  itemActive: {
    backgroundColor: tokens.brand.DEFAULT,
    borderColor: tokens.brand.DEFAULT,
  } as ViewStyle,
  itemPressed: {
    opacity: 0.85,
  } as ViewStyle,
  text: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.text.secondary,
  } as TextStyle,
  textActive: {
    color: tokens.surface.light,
  } as TextStyle,
})

export default SingleTypeBar
