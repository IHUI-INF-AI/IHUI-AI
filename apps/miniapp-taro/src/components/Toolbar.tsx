import { View, Text, ScrollView, Image } from '@tarojs/components'
import { cn } from '@ihui/design-tokens'

/**
 * Toolbar 首页工具栏 — 对齐原项目 Toolbar/index.vue
 * 横向滚动 + 多个工具入口(图标 + 文字 + 可选红点/角标)
 *
 * 与原项目对齐:
 * - 默认 items 与原项目 headerMenu 一致(3 项:流量运营陪跑/一站式设备应用/AI其他技术服务),
 *   icon 用原项目 bspapp CDN URL(本地 assets/remote 无 tabbar/tabbar/ 副本,直接远程引用)。
 * - 原项目 item.imgUrl 是图片 URL;本组件 icon 支持图片路径或 emoji(兼容扩展)。
 * - 原项目 secondRowList/third-row 等运营位不在本组件范围(由页面层组合)。
 */
export interface ToolbarItem {
  id: string
  name: string
  icon?: string // 图片路径(http/https/本地路径)或 emoji
  badge?: string // 红点/角标文字(如未读数)
  onClick?: () => void
}

export interface ToolbarProps {
  items?: ToolbarItem[]
  className?: string
}

// 与原项目 Toolbar/index.vue 的 headerMenu 一致(bspapp CDN URL,本地无副本)
const BSPAPP_BASE = 'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com'

const DEFAULT_ITEMS: ToolbarItem[] = [
  {
    id: 'traffic-service',
    name: '流量运营陪跑',
    icon: `${BSPAPP_BASE}/tabbar/tabbar/图片 28@2x.png`,
  },
  {
    id: 'device-service',
    name: '一站式设备应用',
    icon: `${BSPAPP_BASE}/tabbar/tabbar/图片 32@2x.png`,
  },
  {
    id: 'ai-other-service',
    name: 'AI其他技术服务',
    icon: `${BSPAPP_BASE}/tabbar/tabbar/图片 32@2x (2).png`,
  },
]

// 判断 icon 是否为图片路径(非 emoji)
function isImagePath(icon: string): boolean {
  return /^(https?:)?\/\//.test(icon) || icon.startsWith('/')
}

export default function Toolbar({ items = DEFAULT_ITEMS, className }: ToolbarProps) {
  return (
    <ScrollView scrollX scrollWithAnimation className={cn('w-full', className)}>
      <View
        className="flex flex-row gap-3 px-4 py-3"
        style={{ width: 'max-content', whiteSpace: 'nowrap' }}
      >
        {items.map((item) => (
          <View
            key={item.id}
            className="flex flex-col items-center flex-shrink-0"
            style={{ width: 'auto' }}
            onClick={item.onClick}
          >
            <View className="relative">
              {item.icon ? (
                isImagePath(item.icon) ? (
                  <Image
                    src={item.icon}
                    mode="aspectFill"
                    className="w-[80rpx] h-[80rpx] rounded-xl bg-muted"
                  />
                ) : (
                  <View className="w-[80rpx] h-[80rpx] rounded-xl bg-muted flex items-center justify-center">
                    <Text className="text-2xl">{item.icon}</Text>
                  </View>
                )
              ) : (
                <View className="w-[80rpx] h-[80rpx] rounded-xl bg-muted" />
              )}
              {item.badge && (
                <View
                  className="absolute -top-1 -right-1 bg-destructive rounded-full min-w-[28rpx] h-[28rpx] flex items-center justify-center px-1"
                  // rounded-full 豁免:红点/角标(AGENTS.md §4 豁免)
                >
                  <Text className="text-white text-[20rpx]">{item.badge}</Text>
                </View>
              )}
            </View>
            <Text className="text-xs text-foreground mt-1 whitespace-nowrap">{item.name}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  )
}
