// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Menu 功能菜单组件 (mobile-rn 端)
 * 基于 FlatList numColumns 实现网格布局
 * 保留图标 + 文字 + 点击回调
 * 迁移自旧项目 Vue 组件 (Ai-WXMiniVue/src/components/Menu/index.vue)
 */
import { tokens } from '../theme/active-tokens'
import { rnRadiusFor } from '@ihui/design-tokens'
import { FlatList, Image, StyleSheet, Text, TouchableOpacity } from 'react-native'
import type { MenuItem } from '@ihui/ui-native'
import { toImageSource, type CarouselSlideImg } from './Carousel'
// 菜单图标静态 import(declarations.d.ts 图片模块声明,Metro 标准形态,无需 lint 抑制)
import IMG_PIC from '../../assets/images/menu/8.png'
import IMG_VIDEO from '../../assets/images/menu/4.png'
import IMG_WENAN from '../../assets/images/menu/2.png'
import IMG_AGENT from '../../assets/images/menu/11.png'
import IMG_RPA from '../../assets/images/menu/5.png'
import IMG_CODE from '../../assets/images/menu/7.png'
import IMG_MUSIC from '../../assets/images/menu/3.png'
import IMG_OTHER from '../../assets/images/menu/10.png'
import {
  MENU_CONTAINER_PADDING_PX,
  MENU_DEFAULT_COLUMNS,
  MENU_LABEL_FONT_PX,
  menuItemStyle,
  menuTileStyle,
} from '@ihui/shared/ui/menu-spec'

/** 菜单项:共享 MenuItem 基础上把 icon 放宽为远端 URL 或本地 require 资源 ——
 *  2026-10-15 图标本地化后经 require 引入(原生为 number,Metro web 下为 { uri } 资产对象)。 */
export type MenuEntry = Pick<MenuItem, 'id' | 'name'> & { icon: CarouselSlideImg }

export interface MenuProps {
  items?: MenuEntry[]
  onPress?: (item: MenuEntry, index: number) => void
  columns?: number
}

// 2026-10-15 本地化:原 bspapp 云存储 CDN(mp-aab956eb-…)整体不可达(HTTP 000),
// 8 个菜单图标按原 CDN 路径打包进应用(文件副本与 apps/web/public 本地化批次同源):
//   tabbar/coursePlanet/8.png  → assets/images/menu/8.png
//   tabbar/coursePlanet/4.png  → assets/images/menu/4.png
//   tabbar/coursePlanet/2.png  → assets/images/menu/2.png
//   tabbar/coursePlanet/11.png → assets/images/menu/11.png
//   tabbar/coursePlanet/5.png  → assets/images/menu/5.png
//   tabbar/coursePlanet/7.png  → assets/images/menu/7.png
//   tabbar/coursePlanet/3.png  → assets/images/menu/3.png
//   tabbar/coursePlanet/10.png → assets/images/menu/10.png
const DEFAULT_ITEMS: MenuEntry[] = [
  { id: 1, name: '图片', icon: IMG_PIC },
  { id: 2, name: '视频', icon: IMG_VIDEO },
  { id: 3, name: '文案', icon: IMG_WENAN },
  { id: 4, name: '智能体', icon: IMG_AGENT },
  { id: 5, name: 'RPA', icon: IMG_RPA },
  { id: 6, name: '编程', icon: IMG_CODE },
  { id: 7, name: '音乐', icon: IMG_MUSIC },
  { id: 8, name: '其他', icon: IMG_OTHER },
]

export default function Menu({
  items = DEFAULT_ITEMS,
  onPress,
  columns = MENU_DEFAULT_COLUMNS,
}: MenuProps) {
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
          <Image source={toImageSource(item.icon)} style={styles.icon} />
          <Text style={styles.name}>{item.name}</Text>
        </TouchableOpacity>
      )}
    />
  )
}

/// RN 单位是 dp,与逻辑 px 1:1,故换算取恒等;格结构与图块盒在 @ihui/shared/ui/menu-spec
const toUnit = (px: number) => px

const styles = StyleSheet.create({
  container: {
    paddingVertical: MENU_CONTAINER_PADDING_PX, // 两端同档,唯一源在 @ihui/shared/ui/menu-spec
  },
  item: menuItemStyle(toUnit),
  icon: {
    ...menuTileStyle(toUnit),
    // 图块 = chip→md(6),与小程序侧 rounded-md 同档(radius.js 角色档)
    borderRadius: rnRadiusFor.chip,
    resizeMode: 'contain',
  },
  name: {
    fontSize: MENU_LABEL_FONT_PX,
    color: tokens.text.primary,
  },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
