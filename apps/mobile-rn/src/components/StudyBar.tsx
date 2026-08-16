/**
 * StudyBar 学习 Tab 横条 (mobile-rn 端)
 *
 * 对齐历史项目 study/bar.vue(等宽分段式 Tab 切换):
 * - 灰色容器(color_cont:#eee)内等宽排布若干 Tab(bar_item flex:1,justify-content:space-between)。
 * - 未选:浅灰文字;选中:白底卡片 + 深色加粗文字(对齐历史 .select)。
 * - 点击切换 → onChange(key);受控组件(activeKey 驱动)。
 * - 浅色优雅风,无霓虹/无渐变;颜色全部走 @ihui/design-tokens 的 rnLightTokens;禁用 purple/indigo。
 * - 类型零 any,精确标注。
 */
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

export interface StudyBarItem {
  key: string
  label: string
}

export interface StudyBarProps {
  items: StudyBarItem[]
  activeKey: string
  onChange: (key: string) => void
}

export default function StudyBar({ items, activeKey, onChange }: StudyBarProps): React.JSX.Element {
  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        {items.map((item) => {
          const isActive = item.key === activeKey
          return (
            <TouchableOpacity
              key={item.key}
              activeOpacity={0.7}
              onPress={() => onChange(item.key)}
              style={[styles.tab, isActive ? styles.tabActive : null]}
            >
              <Text style={isActive ? styles.tabTextActive : styles.tabTextInactive}>
                {item.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 9,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 2,
    borderRadius: 8,
    backgroundColor: tokens.surface.card,
    borderWidth: 1,
    borderColor: tokens.border.light,
  },
  tab: {
    flex: 1,
    height: 26,
    marginHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: tokens.surface.light,
  },
  tabTextActive: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.text.primary,
  },
  tabTextInactive: {
    fontSize: 16,
    fontWeight: '400',
    color: tokens.text.tertiary,
  },
})
