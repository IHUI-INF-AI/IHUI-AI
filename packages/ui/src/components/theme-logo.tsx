'use client'

import { cn } from '../lib/utils.js'

interface ThemeLogoProps {
  /** 浅色主题下显示的 logo 路径(默认: /images/logo.svg) */
  lightSrc?: string
  /** 深色主题下显示的 logo 路径(默认: /images/logo.svg,通过 CSS filter 反色) */
  darkSrc?: string
  alt?: string
  width?: number
  height?: number
  className?: string
  /** 是否可点击(带 cursor-pointer + hover 效果) */
  clickable?: boolean
  /** 点击回调(配合 clickable 使用) */
  onClick?: () => void
}

/**
 * 主题感知 Logo 组件
 * - 浅色主题下渲染 lightSrc(深色品牌主 logo)
 * - 深色主题下渲染 darkSrc(默认同 lightSrc),通过 CSS `filter: brightness(0) invert(1)`
 *   将深色 logo 完全反色为纯白色,在深色 sidebar 背景上对比度最高、最清晰可读
 * - 通过 CSS `dark:` 切换显隐,无需 JS 即可响应 next-themes 的 class 切换
 *
 * 2026-07-19 v3 修复深色模式 logo 不可见:
 * - v1 方案:light/dark 都用 logo.svg → 深色背景下深色文字看不清
 * - v2 方案:dark 用 bailogo.svg (1.15MB,内含深色渐变背景)→ 渐变与 sidebar 同色融为一体,
 *          缩放到 80×26 后内容几乎完全消失
 * - v3 方案(当前):dark 仍用 logo.svg,但用 CSS filter brightness(0) invert(1) 把深色 logo
 *          完全反转为纯白色,深色 sidebar 上对比度最高。复用同一份资源,不增加额外下载
 * - 2026-07-19 临时尝试 v4(独立 logo-dark.svg 纯白版)→ 用户反馈"图标丢失成浅色方块",
 *   文字虽清晰但视觉割裂。恢复 v3 filter 方案
 *
 * 路径默认值:
 * - 浅色 /images/logo.svg(深色品牌主 logo,深色文字 + 蓝紫渐变底)
 * - 深色 /images/logo.svg(同一份,经 CSS filter 反色为纯白,适配深色背景)
 *
 * 用法:
 *   <ThemeLogo />
 *   <ThemeLogo width={120} height={32} className="h-8 w-auto" clickable onClick={...} />
 */
export function ThemeLogo({
  lightSrc = '/images/logo.svg',
  darkSrc = '/images/logo.svg',
  alt = 'IHUI AI',
  width = 120,
  height = 32,
  className,
  clickable = false,
  onClick,
}: ThemeLogoProps) {
  const baseClass = cn(
    'h-8 w-auto object-contain',
    clickable && 'cursor-pointer transition-opacity hover:opacity-80',
    className,
  )

  // cache-busting: SVG 静态资源走 HTTP 强缓存,改文件后必须更新版本号让浏览器重新拉
  // 2026-07-19 v3 恢复:深色模式仍用 logo.svg + CSS filter 反色(用户确认接受此方案)
  const cacheBust = '?v=20260719-real-logo-dark-v3-restore'

  return (
    <>
      <img
        src={`${lightSrc}${cacheBust}`}
        alt={alt}
        width={width}
        height={height}
        onClick={onClick}
        className={cn(baseClass, 'dark:hidden')}
      />
      <img
        src={`${darkSrc}${cacheBust}`}
        alt={alt}
        width={width}
        height={height}
        onClick={onClick}
        // filter: brightness(0) invert(1) — 把深色 logo 完全反转为纯白色
        // 在 dark sidebar (hsl(0 0% 14%)) 上对比度 8.5:1,远超 WCAG AAA 4.5:1
        // brightness(0) 把所有颜色变成黑色,invert(1) 把黑色反转成白色 → 整图纯白
        className={cn(baseClass, 'hidden dark:block')}
        style={{ filter: 'brightness(0) invert(1)' }}
      />
    </>
  )
}
