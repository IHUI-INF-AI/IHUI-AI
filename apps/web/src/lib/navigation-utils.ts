/**
 * 导航工具集（合并版）
 *
 * 合并自旧架构 utils/ 下的 4 个文件：
 * - navigation / scroll-to / responsiveEnhancement / progressiveEnhancement
 *
 * 新架构基于纯 TypeScript + Web API，无 Vue 依赖。
 * 兼容 Next.js App Router（使用 history / IntersectionObserver 等通用 API）。
 */

/* ------------------------------------------------------------------ */
/* 导航（navigation）                                                  */
/* ------------------------------------------------------------------ */

export interface NavItem {
  label: string
  href: string
  icon?: string
  children?: NavItem[]
  external?: boolean
  badge?: string | number
  disabled?: boolean
}

/** 查找当前激活的导航项 */
export function findActiveItem(items: NavItem[], pathname: string): NavItem | null {
  for (const item of items) {
    if (item.href === pathname) return item
    if (item.children) {
      const child = findActiveItem(item.children, pathname)
      if (child) return child
    }
  }
  return null
}

/** 获取面包屑路径 */
export function getBreadcrumbs(items: NavItem[], pathname: string): NavItem[] {
  for (const item of items) {
    if (item.href === pathname) return [item]
    if (item.children) {
      const childCrumbs = getBreadcrumbs(item.children, pathname)
      if (childCrumbs.length > 0) return [item, ...childCrumbs]
    }
  }
  return []
}

/** 展平导航树 */
export function flattenNavItems(items: NavItem[]): NavItem[] {
  const result: NavItem[] = []
  for (const item of items) {
    result.push(item)
    if (item.children) result.push(...flattenNavItems(item.children))
  }
  return result
}

/** 判断是否为外部链接 */
export function isExternalLink(href: string): boolean {
  return /^https?:\/\//.test(href) || href.startsWith('mailto:') || href.startsWith('tel:')
}

/** 安全跳转（防止 javascript: 协议） */
export function safeNavigate(href: string): void {
  if (typeof window === 'undefined') return
  if (!isSafeHref(href)) return
  window.location.href = href
}

export function isSafeHref(href: string): boolean {
  if (!href) return false
  if (href.startsWith('/') && !href.startsWith('//')) return true
  if (href.startsWith('#')) return true
  return /^https?:\/\//.test(href)
}

/* ------------------------------------------------------------------ */
/* 平滑滚动（scroll-to）                                              */
/* ------------------------------------------------------------------ */

export interface ScrollOptions {
  behavior?: 'auto' | 'smooth'
  block?: ScrollLogicalPosition
  inline?: ScrollLogicalPosition
  offset?: number
}

export function scrollToElement(selector: string, options: ScrollOptions = {}): boolean {
  if (typeof document === 'undefined') return false
  const el = document.querySelector(selector)
  if (!el) return false
  if (options.offset) {
    const top = el.getBoundingClientRect().top + window.scrollY - options.offset
    window.scrollTo({ top, behavior: options.behavior ?? 'smooth' })
  } else {
    el.scrollIntoView({
      behavior: options.behavior ?? 'smooth',
      block: options.block ?? 'start',
      inline: options.inline ?? 'nearest',
    })
  }
  return true
}

export function scrollToTop(behavior: ScrollBehavior = 'smooth'): void {
  if (typeof window === 'undefined') return
  window.scrollTo({ top: 0, behavior })
}

export function scrollToBottom(behavior: ScrollBehavior = 'smooth'): void {
  if (typeof window === 'undefined') return
  window.scrollTo({
    top: document.documentElement.scrollHeight,
    behavior,
  })
}

/** 监听滚动位置 */
export function onScroll(handler: (scrollY: number, direction: 'up' | 'down') => void): () => void {
  if (typeof window === 'undefined') return () => {}
  let lastY = window.scrollY
  let ticking = false
  const onScrollEvent = () => {
    if (ticking) return
    ticking = true
    requestAnimationFrame(() => {
      const y = window.scrollY
      const dir = y > lastY ? 'down' : 'up'
      handler(y, dir)
      lastY = y
      ticking = false
    })
  }
  window.addEventListener('scroll', onScrollEvent, { passive: true })
  return () => window.removeEventListener('scroll', onScrollEvent)
}

/** 是否滚动到接近底部（用于无限滚动） */
export function isNearBottom(threshold = 200): boolean {
  if (typeof window === 'undefined') return false
  const { scrollY, innerHeight } = window
  const { scrollHeight } = document.documentElement
  return scrollY + innerHeight >= scrollHeight - threshold
}

/* ------------------------------------------------------------------ */
/* 响应式增强（responsiveEnhancement）                                 */
/* ------------------------------------------------------------------ */

export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'

export const BREAKPOINTS: Record<Breakpoint, number> = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
}

export function getCurrentBreakpoint(): Breakpoint {
  if (typeof window === 'undefined') return 'md'
  const w = window.innerWidth
  if (w < BREAKPOINTS.sm) return 'xs'
  if (w < BREAKPOINTS.md) return 'sm'
  if (w < BREAKPOINTS.lg) return 'md'
  if (w < BREAKPOINTS.xl) return 'lg'
  if (w < BREAKPOINTS['2xl']) return 'xl'
  return '2xl'
}

export function isBreakpointUp(bp: Breakpoint): boolean {
  if (typeof window === 'undefined') return false
  return window.innerWidth >= BREAKPOINTS[bp]
}

export function isBreakpointDown(bp: Breakpoint): boolean {
  if (typeof window === 'undefined') return false
  const next = nextBreakpoint(bp)
  if (!next) return true
  return window.innerWidth < BREAKPOINTS[next]
}

function nextBreakpoint(bp: Breakpoint): Breakpoint | null {
  const order: Breakpoint[] = ['xs', 'sm', 'md', 'lg', 'xl', '2xl']
  const idx = order.indexOf(bp)
  if (idx < 0 || idx === order.length - 1) return null
  return order[idx + 1] ?? null
}

export function onBreakpointChange(handler: (bp: Breakpoint) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  let current = getCurrentBreakpoint()
  return onViewportResize(() => {
    const next = getCurrentBreakpoint()
    if (next !== current) {
      current = next
      handler(next)
    }
  })
}

/** matchMedia 监听 */
export function matchMedia(query: string): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia(query).matches
}

export function onMediaQueryChange(query: string, handler: (matches: boolean) => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const mql = window.matchMedia(query)
  const onChange = (e: MediaQueryListEvent) => handler(e.matches)
  mql.addEventListener('change', onChange)
  handler(mql.matches)
  return () => mql.removeEventListener('change', onChange)
}

/* ------------------------------------------------------------------ */
/* 渐进增强（progressiveEnhancement）                                  */
/* ------------------------------------------------------------------ */

/** 特性检测 */
export interface FeatureSupport {
  serviceWorker: boolean
  webgl: boolean
  websocket: boolean
  intersectionObserver: boolean
  resizeObserver: boolean
  webp: boolean
  avif: boolean
  indexedDB: boolean
  clipboard: boolean
  notification: boolean
  geolocation: boolean
  mediaDevices: boolean
  crypto: boolean
  performanceObserver: boolean
}

export function detectFeatures(): FeatureSupport {
  if (typeof window === 'undefined') {
    return {
      serviceWorker: false,
      webgl: false,
      websocket: false,
      intersectionObserver: false,
      resizeObserver: false,
      webp: false,
      avif: false,
      indexedDB: false,
      clipboard: false,
      notification: false,
      geolocation: false,
      mediaDevices: false,
      crypto: false,
      performanceObserver: false,
    }
  }
  return {
    serviceWorker: 'serviceWorker' in navigator,
    webgl: supportsWebgl(),
    websocket: 'WebSocket' in window,
    intersectionObserver: 'IntersectionObserver' in window,
    resizeObserver: 'ResizeObserver' in window,
    webp: supportsImageFormat('webp'),
    avif: supportsImageFormat('avif'),
    indexedDB: 'indexedDB' in window,
    clipboard: 'clipboard' in navigator,
    notification: 'Notification' in window,
    geolocation: 'geolocation' in navigator,
    mediaDevices: !!navigator.mediaDevices,
    crypto: 'crypto' in window && 'subtle' in window.crypto,
    performanceObserver: 'PerformanceObserver' in window,
  }
}

function supportsWebgl(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
  } catch {
    return false
  }
}

function supportsImageFormat(format: string): boolean {
  if (typeof document === 'undefined') return false
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  return canvas.toDataURL(`image/${format}`).indexOf(`image/${format}`) === 0
}

interface NetworkInformation {
  effectiveType?: string
  downlink?: number
  rtt?: number
  saveData?: boolean
}

interface NavigatorExtended extends Navigator {
  connection?: NetworkInformation
  deviceMemory?: number
}

/** 检测连接质量 */
export function detectConnectionQuality(): {
  effectiveType: 'slow-2g' | '2g' | '3g' | '4g' | 'unknown'
  downlink: number
  rtt: number
  saveData: boolean
} {
  const nav = typeof navigator !== 'undefined' ? (navigator as NavigatorExtended) : undefined
  if (!nav?.connection) {
    return {
      effectiveType: 'unknown',
      downlink: 0,
      rtt: 0,
      saveData: false,
    }
  }
  const conn = nav.connection
  return {
    effectiveType: (conn.effectiveType as 'slow-2g' | '2g' | '3g' | '4g') ?? 'unknown',
    downlink: conn.downlink ?? 0,
    rtt: conn.rtt ?? 0,
    saveData: conn.saveData ?? false,
  }
}

/** 判断是否为低端设备 */
export function isLowEndDevice(): boolean {
  const features = detectFeatures()
  if (!features.webgl) return true
  const conn = detectConnectionQuality()
  if (conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g') return true
  if (conn.saveData) return true
  // 内存小于 2GB
  if (typeof navigator !== 'undefined') {
    const mem = (navigator as NavigatorExtended).deviceMemory
    if (typeof mem === 'number' && mem <= 2) return true
  }
  return false
}

/** 根据能力加载资源 */
export function adaptiveLoad<T>(loader: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
  if (isLowEndDevice() && fallback) return fallback()
  return loader()
}

/* ------------------------------------------------------------------ */
/* 内部依赖                                                            */
/* ------------------------------------------------------------------ */

/** 复用 device-utils 的 onViewportResize（避免循环依赖，内部简化实现） */
function onViewportResize(handler: (width: number, height: number) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  let ticking = false
  const onResize = () => {
    if (ticking) return
    ticking = true
    requestAnimationFrame(() => {
      handler(window.innerWidth, window.innerHeight)
      ticking = false
    })
  }
  window.addEventListener('resize', onResize, { passive: true })
  return () => window.removeEventListener('resize', onResize)
}
