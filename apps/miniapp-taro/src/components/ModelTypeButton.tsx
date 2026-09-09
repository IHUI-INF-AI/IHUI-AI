// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { View, Text } from '@tarojs/components'
import LineIcon, { type IconName } from '@/components/LineIcon'

export type ModelType = 'skills' | 'talk' | 'image' | 'video' | 'audio' | 'videoa' | 'other' | 'sck'

/**
 * ModelTypeButton 模型类型按钮
 *
 * 两种 variant:
 * - 'compact'(默认,兼容旧调用):小尺寸纵向布局(图标在上 + 文字在下),用于非首页
 * - 'wide'(首页专用):对齐 RN 端 HomeScreen modelTypeBtn:
 *   - 横向布局(LineIcon 图标 + 文字标签),自适应宽度
 *   - muted 背景 + 大圆角,active 态 primary 纯色(对齐 RN modelTypeBtnActive)
 *   - 图标 28rpx(RN lucide 14dp)+ 标签 24rpx(RN fontSize 12dp)
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
    // ===== wide 模式:对齐 RN HomeScreen modelTypeBtn(icon+label,muted 背景,active 纯色)=====
    return (
      <View
        className={`ai-model-type-btn ${active ? 'active' : ''}`}
        onClick={() => onClick?.(type)}
      >
        {/* 图标(LineIcon 随主题着色,对齐 RN 端 lucide size 14dp → 28rpx)*/}
        <LineIcon
          name={icon}
          size={28}
          color={active ? 'var(--color-primary-foreground)' : 'var(--color-foreground)'}
        />
        {/* 标签(RN modelTypeLabel fontSize 12dp → 24rpx,active 态对比白 + 600)*/}
        <Text className={`ai-model-type-label ${active ? 'active' : ''}`}>{label}</Text>
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
