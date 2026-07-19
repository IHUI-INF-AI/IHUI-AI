'use client'

import { cn } from '../lib/utils.js'

interface ThemeLogoProps {
  /** 浅色主题下显示的 logo 路径(默认: /images/logo.svg) */
  lightSrc?: string
  /** 深色主题下显示的 logo 路径(默认: /images/logo.svg) */
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
 * - 浅色主题下渲染 lightSrc(通常为黑色 logo)
 * - 深色主题下渲染 darkSrc(通常为白色 logo)
 * - 通过 CSS `dark:` 切换显隐,无需 JS 即可响应 next-themes 的 class 切换
 *
 * 路径默认值与项目一致:
 * - 浅色 /images/logo.svg(项目主 logo,带文字+蓝紫渐变底+智字)
 * - 深色 /images/logo.svg(同一文件,SVG 自带主题适配)
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
  // 2026-07-19 恢复用户提供的真实品牌 Logo(从 commit 674fc938 还原 2.36MB 完整版)
  const cacheBust = '?v=20260719-real-logo'

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
        className={cn(baseClass, 'hidden dark:block')}
      />
    </>
  )
}
