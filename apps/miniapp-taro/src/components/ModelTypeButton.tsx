// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { View, Text, Image } from '@tarojs/components'
import { cn } from '@ihui/design-tokens'
import LineIcon, { type IconName } from '@/components/LineIcon'
// wide 模式按钮背景 SVG(Vite 编译时内联为 base64)
import activeBackSvg from '@/static/images/add/active_back.svg'
import backDefaultSvg from '@/static/images/add/back_default.svg'

export type ModelType = 'skills' | 'talk' | 'image' | 'video' | 'audio' | 'videoa' | 'other' | 'sck'

/**
 * ModelTypeButton 模型类型按钮
 *
 * 两种 variant:
 * - 'compact'(默认,兼容旧调用):小尺寸纵向布局(图标在上 + 文字在下),用于非首页
 * - 'wide'(首页专用):对齐原项目 .model-type-btn:
 *   - 200rpx × 60rpx,横向布局
 *   - btn-bg 背景层(absolute 填充,选中态高亮)
 *   - btn-content-wrapper 内容层(z-index 3,图标 140rpx×50rpx)
 *   - btn-arrow 箭头(20rpx×20rpx,选中时 rotate(180deg))
 *
 * 微信小程序 <Image> 不直接支持 svg,但 Taro 4 + Vite 编译时
 * 会把 import xxx from './x.svg' 处理为 base64 编码,在 <Image src> 中可正常显示。
 */
export interface ModelTypeButtonProps {
  type: ModelType
  label: string
  icon: IconName
  active?: boolean
  onClick?: (type: ModelType) => void
  /** 样式变体:'compact' 紧凑(旧)/ 'wide' 宽按钮(首页专用,对齐原项目 200rpx×60rpx)*/
  variant?: 'compact' | 'wide'
}

export default function ModelTypeButton({
  type,
  label,
  icon,
  active = false,
  onClick,
  variant = 'compact',
}: ModelTypeButtonProps) {
  if (variant === 'wide') {
    // ===== wide 模式:对齐原项目 .model-type-btn(200rpx×60rpx + btn-bg + btn-content + btn-arrow)=====
    return (
      <View className="ai-model-type-btn" onClick={() => onClick?.(type)}>
        {/* btn-bg 背景层(absolute 填充,选中态切换 SVG)*/}
        <Image
          className="absolute top-0 left-0"
          src={active ? activeBackSvg : backDefaultSvg}
          style={{ width: '100%', height: '100%', zIndex: 1, opacity: active ? 1 : 0.6 }}
          mode="aspectFill"
        />
        {/* btn-content-wrapper 内容层(z-index 3,横向布局)*/}
        <View className="relative flex items-center justify-center" style={{ zIndex: 3 }}>
          {/* btn-content 图标(LineIcon 随主题着色,对齐 RN 端 lucide)*/}
          <LineIcon
            name={icon}
            size={40}
            color={active ? 'var(--color-primary-foreground)' : 'var(--color-foreground)'}
          />
          {/* btn-arrow 箭头 20rpx×20rpx(选中时 rotate 180deg,LineIcon 随主题着色)*/}
          <LineIcon
            name="chevron-down"
            size={20}
            color={active ? 'var(--color-primary-foreground)' : 'var(--color-foreground)'}
            className={cn('ai-btn-arrow ml-[6rpx]', active && 'ai-btn-arrow-rotate')}
            style={{ position: 'relative', zIndex: 3 }}
          />
        </View>
      </View>
    )
  }

  // ===== compact 模式:兼容旧调用(纵向布局 图标+文字)=====
  return (
    <View
      className={`flex flex-col items-center justify-center mr-3 px-3 py-2 rounded-lg transition-colors ${
        active ? 'bg-primary/10 border border-primary/30' : 'bg-muted border border-transparent'
      }`}
      onClick={() => onClick?.(type)}
    >
      <LineIcon
        name={icon}
        size={40}
        color={active ? 'var(--color-primary)' : 'var(--color-muted-foreground)'}
        className="mb-1"
      />
      <Text className={`text-[22rpx] ${active ? 'text-primary' : 'text-foreground'}`}>{label}</Text>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
