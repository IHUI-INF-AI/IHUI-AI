// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Xiaofang — 品牌吉祥物「小方」统一出口(2026-11-15 立)
 *
 * 三态资产(唯一源 = public/images/):
 *  - full:/images/xiaofang.svg        全身,用于空态 / 加载 / banner
 *  - face:/images/xiaofang-face.svg   笑脸头像,用于 24–96px 小尺寸位
 *  - lost:/images/xiaofang-lost.svg   疑问表情,用于 404
 *  - wave:/images/xiaofang-wave.gif   原始招手动图,用于需要"打招呼"的空态
 *
 * 彩色资产均由原始设计稿/表情包自动描摹为矢量(trace,透明底),
 * 造型与配色以设计原图为准,不做手绘改形。
 *
 * 用原生 img 而非 next/image:SVG 不需要图片优化,且 404 静态页由
 * scripts/build-brand-404.mts 在纯 Node 里 renderToStaticMarkup 渲染,
 * 原生 img 不依赖 Next Image 运行时配置。调用方只管尺寸与位置。
 */
import * as React from 'react'

import { cn } from '@/lib/utils'

type XiaofangVariant = 'full' | 'face' | 'lost' | 'wave'

const XIAOFANG_SRC: Record<XiaofangVariant, string> = {
  full: '/images/xiaofang.svg?v=20261115h',
  face: '/images/xiaofang-face.svg?v=20261115h',
  lost: '/images/xiaofang-lost.svg?v=20261115h',
  wave: '/images/xiaofang-wave.gif?v=20261115h',
}

/** 动图是 400×267 横版,其余为方形;size 统一表示宽度。 */
const XIAOFANG_ASPECT: Record<XiaofangVariant, number> = {
  full: 1,
  face: 1,
  lost: 1,
  wave: 267 / 400,
}

interface XiaofangProps {
  variant?: XiaofangVariant
  size?: number
  /** 默认空串:三处接入都是"旁边已有可读文案"的装饰位;需要品牌名时显式传入。 */
  alt?: string
  className?: string
  /** 首屏关键位(空态 / 404 / 加载)置 true,避免 LCP 前才加载 */
  priority?: boolean
}

export function Xiaofang({
  variant = 'full',
  size = 96,
  alt = '',
  className,
  priority = false,
}: XiaofangProps) {
  const height = Math.round(size * XIAOFANG_ASPECT[variant])
  return (
    // eslint-disable-next-line @next/next/no-img-element -- SVG 无需图片优化;404 静态页在纯 Node 里 renderToStaticMarkup,原生 img 不依赖 Image 运行时
    <img
      src={XIAOFANG_SRC[variant]}
      alt={alt}
      width={size}
      height={height}
      draggable={false}
      decoding="async"
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      className={cn('select-none', className)}
      style={{ width: size, height }}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
