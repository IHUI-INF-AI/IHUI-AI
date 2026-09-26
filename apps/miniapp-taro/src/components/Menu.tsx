// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTt, type TtFn } from '@/i18n'
import { View, Text, Image } from '@tarojs/components'
import { cn, TARO_RPX_PER_PX } from '@ihui/design-tokens'
import {
  MENU_DEFAULT_COLUMNS,
  MENU_LABEL_FONT_PX,
  menuItemStyle,
  menuTileStyle,
} from '@ihui/shared/ui/menu-spec'
import type { MenuItem } from '@ihui/types'
import { BSPAPP_BASE } from '@/constants/icon-urls'
import { rpx } from '@/utils/rpx'

// 共享类型 MenuItem 已下沉到 packages/types,两端复用。
// 统一为必选版(id/icon 必选),本组件原 `item.id ?? index` 和 `item.icon ?` 仍合法。
export type { MenuItem }

export interface MenuProps {
  items?: MenuItem[]
  columns?: number
  onItemClick?: (item: MenuItem, index: number) => void
  className?: string
}

// 与原项目 Menu/index.vue 一致(bspapp CDN URL,本地 assets/remote 无 tabbar/coursePlanet/ 副本)
// 2026-08-27:bspapp.com 已失效,统一走 icon-urls 的 BSPAPP_BASE(现指向 https://aizhs.top,
// 由 web 端 184 条精确 rewrite 回源本机 cdn-server 出图)

const DEFAULT_ITEMS = (tt: TtFn): MenuItem[] => [
  {
    id: 1,
    name: tt('aigc.list.catImage', '图片'),
    icon: `${BSPAPP_BASE}/tabbar/coursePlanet/8.png`,
  },
  {
    id: 2,
    name: tt('aigc.list.catVideo', '视频'),
    icon: `${BSPAPP_BASE}/tabbar/coursePlanet/4.png`,
  },
  {
    id: 3,
    name: tt('aigcPublish.typeText', '文案'),
    icon: `${BSPAPP_BASE}/tabbar/coursePlanet/2.png`,
  },
  { id: 4, name: tt('agent.title', '智能体'), icon: `${BSPAPP_BASE}/tabbar/coursePlanet/11.png` },
  { id: 5, name: 'RPA', icon: `${BSPAPP_BASE}/tabbar/coursePlanet/5.png` },
  {
    id: 6,
    name: tt('ai.agentList.categories.coding', '编程'),
    icon: `${BSPAPP_BASE}/tabbar/coursePlanet/7.png`,
  },
  { id: 7, name: tt('Menu.d1', '音乐'), icon: `${BSPAPP_BASE}/tabbar/coursePlanet/3.png` },
  { id: 8, name: tt('setting.other', '其他'), icon: `${BSPAPP_BASE}/tabbar/coursePlanet/10.png` },
]

/// 格结构与档位数字在 @ihui/shared/ui/menu-spec;本文件只做 rpx 换算 + 挂 Taro 原语。
const toUnit = (px: number) => rpx(px * TARO_RPX_PER_PX)
const ITEM_STYLE = menuItemStyle(toUnit)
const TILE_STYLE = menuTileStyle(toUnit)
const LABEL_STYLE = { fontSize: toUnit(MENU_LABEL_FONT_PX) }

export default function Menu(props: MenuProps) {
  const tt = useTt()
  const {
    items = DEFAULT_ITEMS(tt),
    columns = MENU_DEFAULT_COLUMNS,
    onItemClick,
    className = '',
  } = props
  return (
    <View className={cn('flex flex-wrap', className)}>
      {items.map((item, index) => (
        <View
          key={item.id ?? index}
          style={{ ...ITEM_STYLE, width: `${100 / columns}%` }}
          onClick={() => onItemClick?.(item, index)}
          hoverClass="opacity-60"
        >
          {item.icon ? (
            /^(https?:)?\/\//.test(item.icon) || item.icon.startsWith('/') ? (
              <Image src={item.icon} mode="aspectFill" className="rounded-md" style={TILE_STYLE} />
            ) : (
              // text-2xl(24) 是本端独有的 emoji 兜底字面 —— RN 端没有这一格,不共档
              <View className="rounded-md bg-primary/10" style={TILE_STYLE}>
                <Text className="text-2xl">{item.icon}</Text>
              </View>
            )
          ) : (
            <View className="rounded-md bg-primary/10" style={TILE_STYLE} />
          )}
          <Text className="text-foreground" style={LABEL_STYLE}>
            {item.name}
          </Text>
        </View>
      ))}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
