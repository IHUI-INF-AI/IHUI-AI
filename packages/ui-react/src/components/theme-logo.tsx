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
 * - 浅色主题下渲染 lightSrc(深色品牌主 logo,深色文字 + 蓝紫渐变底图标)
 * - 深色主题下渲染 darkSrc(图标保留原色 + 文字改为白色,无需 CSS filter),
 *   在深色 sidebar 上图标品牌色不丢失、文字保持可读
 * - 通过 CSS `dark:` 切换显隐,无需 JS 即可响应 next-themes 的 class 切换
 *
 * 2026-07-20 修复深色模式 logo 左侧图标全变白 + 小字 IHUI INF.AI 不可见:
 * - 旧方案 v3:dark 用 logo.svg + CSS `filter: brightness(0) invert(1)` 把整图反色为纯白,
 *   图标品牌色(蓝紫渐变)被完全丢失,在深色 sidebar 上变成纯白方块,视觉割裂
 * - 旧方案 v4:dark 用独立 logo-dark.svg 但图标内容与浅色 logo 一致被反相后丢失
 * - 新方案(当前):dark 用独立生成的 logo-dark.svg,内容 = 原 logo.svg:
 *     1) 文字 fill #343434 → #ffffff(大"智汇AI社区"白色可读)
 *     2) 渐变 master_svg0_1937_38746 stop 颜色 #000/#373737/#000 → #fff/#e5e5e5/#fff
 *        (小"IHUI INF.AI"原本用此渐变,在深色 sidebar 上几乎不可见,改后变白色可读)
 *     3) 图标 path 的 url(#master_svg0_1937_38746) 渐变与 base64 嵌入的蝴蝶结图标
 *        全部保留原色
 *   生成脚本见 apps/web/scripts/gen-logo-dark.ps1 (从 logo.svg 派生 logo-dark.svg)
 *
 * 路径默认值:
 * - 浅色 /images/logo.svg(深色品牌主 logo,深色文字 + 蓝紫渐变底图标)
 * - 深色 /images/logo-dark.svg(同一份,文字改白、图标保留品牌色)
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
  // 2026-07-20 v2:渐变 stop 也改了(图标小字 IHUI INF.AI 用 master_svg0_1937_38746 渐变,
  // 原 #000/#373737/#000 在深色 sidebar 上几乎不可见 → 改成 #fff/#e5e5e5/#fff)
  const cacheBust = '?v=20260720-logo-dark-v2-gradient-white'

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
        // 2026-07-20 修复:不再用 filter: brightness(0) invert(1) 反色整图
        // 改用独立 logo-dark.svg,深色模式自然显示品牌色图标 + 白色文字
        className={cn(baseClass, 'hidden dark:block')}
      />
    </>
  )
}
