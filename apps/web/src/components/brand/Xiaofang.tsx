// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Xiaofang — 品牌吉祥物「小方」统一出口(2026-11-15 立)
 *
 * 四态资产(唯一源 = 运营侧外挂 public/images/xiaofang-assets/,不入 git):
 *  - full:/images/xiaofang-assets/xiaofang.png        全身,用于空态 / 加载 / banner
 *  - face:/images/xiaofang-assets/xiaofang-face.png   笑脸头像,用于 24–96px 小尺寸位
 *  - lost:/images/xiaofang-assets/xiaofang-lost.png   疑问表情,用于 404
 *  - wave:/images/xiaofang-assets/xiaofang-wave.webp  招手动图(动态 WebP),用于需要"打招呼"的空态
 *
 * 2026-11-26 wave 由 GIF 改动态 WebP:原 xiaofang-wave.gif 在"62 帧/918KB 过入库门"那步
 * 压扁了透明通道(黑底不透明,全片仅 0.04% 像素透明),空态上直接显出一块纯黑底。
 * 现改为从原图「动图透明底压缩/招手.gif」(400×267,124 帧)重出:288×192(=144px 展示位 2x)、
 * 120 帧/40ms/无限循环、8-bit alpha(半透明边缘 1.5%),1.0MB。GIF 只支持 1-bit 透明,
 * 边缘会出硬锯齿,故不再回退 GIF。
 *
 * 2026-11-25 外挂化:位图从 git 跟踪移到 git 外目录,经 www.aizhs.top 的
 * TencentEdgeOne CDN 网络加载(Cache-Control: public, max-age=86400),不再占仓库空间。
 * 运行时由 next start 直读 public/(不进 next build);部署 ff-only 只动被跟踪文件,
 * 该外挂目录从未入库且被 .gitignore 忽略,故任何部署都不会删除它。
 *
 * 资产取自百度网盘共享空间 `AI设计部/logo、小方/小方表情包/`:
 *  - full/face 源自「微笑.png」(全身 + 头部裁切);
 *  - lost 源自「疑问.png」;
 *  - wave 源自「动图透明底压缩/招手.gif」(400×267,124 帧;按展示位等比重采样为 288×192 的动态 WebP)。
 * 全部保留设计原图的 3D 渲染质感与透明底,不做矢量描摹(trace 会掉质感),
 * 造型与配色以设计原图为准,不做手绘改形。
 *
 * 用原生 img 而非 next/image:静态位图已按展示尺寸裁好,且 404 静态页由
 * scripts/build-brand-404.mts 在纯 Node 里 renderToStaticMarkup 渲染,
 * 原生 img 不依赖 Next Image 运行时配置。调用方只管尺寸与位置。
 */
import * as React from 'react'

import { cn } from '@/lib/utils'

type XiaofangVariant = 'full' | 'face' | 'lost' | 'wave'

const XIAOFANG_SRC: Record<XiaofangVariant, string> = {
  full: '/images/xiaofang-assets/xiaofang.png?v=20261125b',
  face: '/images/xiaofang-assets/xiaofang-face.png?v=20261125b',
  lost: '/images/xiaofang-assets/xiaofang-lost.png?v=20261125b',
  wave: '/images/xiaofang-assets/xiaofang-wave.webp?v=20261126a',
}

/** 动图是 400×267 横版(成品 288×192,比例一致),其余为方形;size 统一表示宽度。 */
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
    // eslint-disable-next-line @next/next/no-img-element -- 静态位图已按展示尺寸裁好;404 静态页在纯 Node 里 renderToStaticMarkup,原生 img 不依赖 Image 运行时
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
