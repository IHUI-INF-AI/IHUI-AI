// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { ScrollView, View, Text, Image } from '@tarojs/components'
import './CategoryBar.css'

/**
 * 统一分类条 —— web `@ihui/ui-react` CategoryBar 与 RN `CategoryInlineBar` 的 Taro 同形实现。
 *
 * 平台特有:依赖 @tarojs/components 的 ScrollView(scrollX + enhanced + showScrollbar),
 * 不适合共享层。
 *
 * 几何与两版逐档对齐(小程序 375→750,故 web px ×2 = rpx):
 *   项高 32px→64rpx / 圆角 --radius-md(6px) / 横向内边距 12px→24rpx /
 *   项间距 8px→16rpx / 图文间距 6px→12rpx / 文字 13px→26rpx,行高 18px→36rpx /
 *   静止态 card 底 + 完整描边 + secondary 文字,选中态 primary 底 + primary-foreground 文字 + 600 字重 /
 *   计数徽章 16px→32rpx 见方(最小宽)、水平内边距 4px→8rpx、字号 10px→20rpx、行高同字号、等宽数字。
 * 只滚不折行、无渐变遮罩、无分割线、零文案(标签由调用方 t() 取词注入)。
 */
export interface CategoryBarItem {
  /** 稳定标识(单选值) */
  id: string
  /** 已取词的显示文案 */
  label: string
  /** 条目图标:小程序端 lucide 风格 SVG 路径(/static/images/icons/*.svg)或远程图标 URL */
  icon?: string
  /** 计数徽章(可选) */
  count?: number
}

export interface CategoryBarProps {
  items: readonly CategoryBarItem[]
  /** 当前选中 id;null 表示全未选 */
  value: string | null
  onChange: (id: string) => void
  /** 外层容器样式(页面级内外边距由调用方决定,组件不写死) */
  className?: string
}

export default function CategoryBar({ items, value, onChange, className }: CategoryBarProps) {
  if (items.length === 0) return null

  return (
    <ScrollView
      scrollX
      enhanced
      showScrollbar={false}
      scrollWithAnimation
      className={`category-bar${className ? ` ${className}` : ''}`}
    >
      <View className="category-bar__inner">
        {items.map((item) => {
          const active = item.id === value
          return (
            <View
              key={item.id}
              className={`category-bar__item${active ? ' category-bar__item--active' : ''}`}
              onClick={() => onChange(item.id)}
              hoverClass="opacity-60"
            >
              {item.icon ? (
                <Image className="category-bar__icon" src={item.icon} mode="aspectFit" />
              ) : null}
              <Text className="category-bar__label">{item.label}</Text>
              {typeof item.count === 'number' ? (
                <View
                  className={`category-bar__badge${active ? ' category-bar__badge--active' : ''}`}
                >
                  <Text className="category-bar__badge-text">{item.count}</Text>
                </View>
              ) : null}
            </View>
          )
        })}
      </View>
    </ScrollView>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
