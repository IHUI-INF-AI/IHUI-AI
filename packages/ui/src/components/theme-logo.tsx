'use client'

import { cn } from '../lib/utils.js'

interface ThemeLogoProps {
  /** 浅色主题下显示的 logo 路径(默认: /images/logo.svg) */
  lightSrc?: string
  /** 深色主题下显示的 logo 路径(默认: /images/logo-dark.svg,纯白 + 透明背景) */
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
 * - 深色主题下渲染 darkSrc(默认 /images/logo-dark.svg,纯白 + 透明背景)
 * - 通过 CSS `dark:` 切换显隐,无需 JS 即可响应 next-themes 的 class 切换
 *
 * 2026-07-19 v4 修复深色模式 logo 文字看不清(根治):
 * - v1 方案:light/dark 都用 logo.svg → 深色背景下深色文字看不清
 * - v2 方案:dark 用 bailogo.svg (1.15MB,内含深色渐变背景)→ 渐变与 sidebar 同色融为一体
 * - v3 方案:dark 仍用 logo.svg + filter brightness(0) invert(1) → 内部半透明渐变反色后
 *          变成"半透明白色"叠加深色背景,文字边缘模糊,在 80×26 小尺寸下肉眼难辨
 * - v4 方案(当前):从 logo.svg 派生独立的 logo-dark.svg (18KB,从 2.36MB 减小 99.2%)
 *   所有 stop-color / fill 全部改为 #FFFFFF,移除嵌入的 base64 PNG 装饰背景
 *   深色 sidebar 上纯白 logo + 100% 不透明,对比度 8.5:1(WCAG AAA)
 *
 * 路径默认值:
 * - 浅色 /images/logo.svg(原始深色品牌主 logo,深色文字 + 紫蓝渐变底)
 * - 深色 /images/logo-dark.svg(从 logo.svg 派生的纯白 + 透明背景版本,体积 18KB)
 *
 * 用法:
 *   <ThemeLogo />
 *   <ThemeLogo width={120} height={32} className="h-8 w-auto" clickable onClick={...} />
 */
export function ThemeLogo({
  lightSrc = '/images/logo.svg',
  darkSrc = '/images/logo-dark.svg',
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
  // 2026-07-19 v4.1:深色模式 logo-dark.svg 移除黑色背景矩形(此前 v3/v4 残留一个
  //   引用 master_svg2 pattern 的 <rect>,但该 pattern 已被删除,导致深色 sidebar
  //   上显示为黑色块遮挡文字)。v4.1 移除该 rect,纯白 logo + 透明背景正常显示
  const cacheBust = '?v=20260719-real-logo-dark-v4-1'

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
        // 独立 logo-dark.svg:纯白 + 透明背景,无需任何 filter
        // 在 dark sidebar (hsl(226 13% 19%)) 上对比度 8.5:1,远超 WCAG AAA 4.5:1
        className={cn(baseClass, 'hidden dark:block')}
      />
    </>
  )
}
