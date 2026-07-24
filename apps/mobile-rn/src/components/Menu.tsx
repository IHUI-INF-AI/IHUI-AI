/**
 * Menu 功能菜单组件 (mobile-rn 端)
 * 基于 FlatList numColumns 实现网格布局
 * 保留图标 + 文字 + 点击回调
 * 迁移自旧项目 Vue 组件 (Ai-WXMiniVue/src/components/Menu/index.vue)
 */
import { FlatList, Image, StyleSheet, Text, TouchableOpacity } from 'react-native'

export interface MenuItem {
  id: number | string
  name: string
  icon: string
  [key: string]: unknown
}

export interface MenuProps {
  items?: MenuItem[]
  onPress?: (item: MenuItem, index: number) => void
  columns?: number
}

const DEFAULT_ITEMS: MenuItem[] = [
  { id: 1, name: '图片', icon: 'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/coursePlanet/8.png' },
  { id: 2, name: '视频', icon: 'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/coursePlanet/4.png' },
  { id: 3, name: '文案', icon: 'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/coursePlanet/2.png' },
  { id: 4, name: '智能体', icon: 'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/coursePlanet/11.png' },
  { id: 5, name: 'RPA', icon: 'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/coursePlanet/5.png' },
  { id: 6, name: '编程', icon: 'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/coursePlanet/7.png' },
  { id: 7, name: '音乐', icon: 'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/coursePlanet/3.png' },
  { id: 8, name: '其他', icon: 'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/coursePlanet/10.png' },
]

export default function Menu({ items = DEFAULT_ITEMS, onPress, columns = 4 }: MenuProps) {
  return (
    <FlatList
      data={items}
      numColumns={columns}
      scrollEnabled={false}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={styles.container}
      renderItem={({ item, index }) => (
        <TouchableOpacity
          style={[styles.item, { width: `${100 / columns}%` }]}
          activeOpacity={0.7}
          onPress={() => onPress?.(item, index)}
        >
          <Image
            source={{ uri: item.icon }}
            style={styles.icon}
          />
          <Text style={styles.name}>{item.name}</Text>
        </TouchableOpacity>
      )}
    />
  )
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  item: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  icon: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
  },
  name: {
    fontSize: 12,
    color: '#111827',
    marginTop: 8,
  },
})
