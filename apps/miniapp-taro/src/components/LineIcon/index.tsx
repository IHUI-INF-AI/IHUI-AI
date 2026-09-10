// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍​‍‌⁠

/**
 * LineIcon — 跨平台线性图标(对齐 RN 端 lucide + token 着色)
 *
 * 背景:小程序端此前用 <Image src="静态svg">,描边写死、无法随浅/深主题换色,
 * 与 RN 端(rn-tokens:浅色 text.secondary=#666 深色=#999、选中态 brand)不一致。
 *
 * 方案:CSS mask 渲染。以 SVG 为 mask(只取 alpha),实际颜色由 background 决定
 * → 一个组件在 weapp 原生 & H5 都能随主题换色、可用 token 精确着色。
 * - 默认色 var(--color-muted-foreground)(≈RN text.secondary)
 * - 选中/强调态由调用方传 brand 色,与 RN 端 brand.DEFAULT 对齐
 *
 * 用法:<LineIcon name="heart" size={32} color="var(--color-brand)" />
 */
import { View } from '@tarojs/components'
import type { ITouchEvent } from '@tarojs/components'
import { ICONS, type IconName } from './icons'

export type { IconName } from './icons'

export interface LineIconProps {
  /** 图标名,见 icons.ts */
  name: IconName
  /** 边长,数字按 rpx 处理,也支持字符串(如 '32rpx') */
  size?: number | string
  /** 图标颜色,CSS color。默认随主题 muted-foreground */
  color?: string
  className?: string
  style?: React.CSSProperties
  onClick?: (event: ITouchEvent) => void
}

export default function LineIcon({
  name,
  size = 40,
  color = 'var(--color-muted-foreground)',
  className,
  style,
  onClick,
}: LineIconProps) {
  const raw = ICONS[name]
  if (!raw) return null
  // 跨端尺寸:H5 内联样式不识别 rpx,需按 750 设计稿×视口宽度转 px;原生端直接用 rpx。
  let dim: string | undefined
  if (typeof size === 'number') {
    if (process.env.TARO_ENV === 'h5') {
      const vw = typeof window !== 'undefined' ? window.innerWidth || 375 : 375
      dim = `${(size * (vw / 750)).toFixed(1)}px`
    } else {
      dim = `${size}rpx`
    }
  } else {
    dim = size
  }
  const uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(raw)}`

  return (
    <View
      className={className}
      onClick={onClick}
      style={{
        width: dim,
        height: dim,
        background: color,
        display: 'inline-block',
        maskImage: `url("${uri}")`,
        WebkitMaskImage: `url("${uri}")`,
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskSize: '100% 100%',
        WebkitMaskSize: '100% 100%',
        maskPosition: 'center',
        WebkitMaskPosition: 'center',
        ...style,
      }}
    />
  )
}
