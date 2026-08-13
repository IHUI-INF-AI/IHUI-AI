/**
 * StudyBar 学习 Tab 横条 (mobile-rn 端)
 *
 * 对齐历史项目 study/bar.vue(分段式 Tab 切换):
 * - 横向 ScrollView 容纳 Tab 项;灰色容器 + 白色选中态 + 加粗深色文字。
 * - 未选:浅灰文字;选中:白底卡片 + 深色加粗文字(对齐历史 .select)。
 * - 点击切换 → onChange(key)。
 * - 浅色优雅风,无霓虹/无渐变;颜色全部走 @ihui/design-tokens 的 rnLightTokens。
 * - 类型零 any,精确标注。
 */
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

export interface StudyBarItem {
  key: string
  label: string
}

export interface StudyBarProps {
  items: StudyBarItem[]
  activeKey: string
  onChange: (key: string) => void
}

export default function StudyBar({
  items,
  activeKey,
  onChange,
}: StudyBarProps): React.JSX.Element {
  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.container}
      >
        {items.map((item) => {
          const isActive = item.key === activeKey
          return (
            <TouchableOpacity
              key={item.key}
              activeOpacity={0.7}
              onPress={() => onChange(item.key)}
              style={[styles.tab, isActive ? styles.tabActive : styles.tabInactive]}
            >
              <Text style={isActive ? styles.tabTextActive : styles.tabTextInactive}>
                {item.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 9,
  },
  container: {
    flexGrow: 1,
    paddingVertical: 2,
    paddingHorizontal: 2,
    gap: 6,
    borderRadius: 8,
    backgroundColor: tokens.surface.card,
    borderWidth: 1,
    borderColor: tokens.border.light,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
  },
  tabActive: {
    backgroundColor: tokens.surface.light,
  },
  tabInactive: {
    backgroundColor: 'transparent',
  },
  tabTextActive: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.text.primary,
  },
  tabTextInactive: {
    fontSize: 14,
    fontWeight: '400',
    color: tokens.text.tertiary,
  },
})
