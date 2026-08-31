// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTt, type TtFn } from '@/i18n'
import { View, Text, Image } from '@tarojs/components'
import { cn } from '@ihui/design-tokens'
import type { MenuItem } from '@ihui/types'
import { BSPAPP_BASE } from '@/constants/icon-urls'

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

export default function Menu(props: MenuProps) {
  const tt = useTt()
  const { items = DEFAULT_ITEMS(tt), columns = 4, onItemClick, className = '' } = props
  return (
    <View className={cn('flex flex-wrap', className)}>
      {items.map((item, index) => (
        <View
          key={item.id ?? index}
          className="flex flex-col items-center gap-2 py-2"
          style={{ width: `${100 / columns}%` }}
          onClick={() => onItemClick?.(item, index)}
        >
          {item.icon ? (
            /^(https?:)?\/\//.test(item.icon) || item.icon.startsWith('/') ? (
              <Image src={item.icon} mode="aspectFill" className="w-10 h-10 rounded-md" />
            ) : (
              <View className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                <Text className="text-2xl">{item.icon}</Text>
              </View>
            )
          ) : (
            <View className="w-10 h-10 rounded-md bg-primary/10" />
          )}
          <Text className="text-xs text-foreground">{item.name}</Text>
        </View>
      ))}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
