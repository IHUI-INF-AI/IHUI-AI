/**
 * SEO 工具
 * 用于管理页面元标签和 SEO 相关功能
 */

import { logger } from './logger'

type HTMLMetaElement = HTMLElement & { name: string; content: string }

export interface MetaTags {
  title?: string
  description?: string
  keywords?: string
  ogTitle?: string
  ogDescription?: string
  ogImage?: string
  ogUrl?: string
  twitterCard?: string
  twitterTitle?: string
  twitterDescription?: string
  twitterImage?: string
  canonical?: string
  robots?: string
  url?: string
  type?: string
}

/**
 * 更新页面标题
 */
export function updateTitle(title: string): void {
  if (typeof window === 'undefined') return
  document.title = title
  logger.debug('[SEO] Title updated:', title)
}

/**
 * 更新元标签
 */
export function updateMetaTags(tags: MetaTags): void {
  if (typeof window === 'undefined') return

  const { title, description, keywords, ogTitle, ogDescription, ogImage, ogUrl, canonical, robots } =
    tags

  // 更新标题
  if (title) {
    updateTitle(title)
  }

  // 更新或创建 meta 标签
  if (description) {
    setMetaTag('description', description)
  }

  if (keywords) {
    setMetaTag('keywords', keywords)
  }

  if (robots) {
    setMetaTag('robots', robots)
  }

  // Open Graph 标签
  if (ogTitle) {
    setOgTag('og:title', ogTitle)
  }

  if (ogDescription) {
    setOgTag('og:description', ogDescription)
  }

  if (ogImage) {
    setOgTag('og:image', ogImage)
  }

  if (ogUrl) {
    setOgTag('og:url', ogUrl)
  }

  // Canonical 链接
  if (canonical) {
    setCanonical(canonical)
  }

  logger.debug('[SEO] Meta tags updated:', tags)
}

/**
 * 设置 meta 标签
 */
function setMetaTag(name: string, content: string): void {
  let meta = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null

  if (!meta) {
    meta = document.createElement('meta')
    meta.name = name
    document.head.appendChild(meta)
  }

  meta.content = content
}

/**
 * 设置 Open Graph 标签
 */
function setOgTag(property: string, content: string): void {
  let meta = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null

  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute('property', property)
    document.head.appendChild(meta)
  }

  meta.content = content
}

/**
 * 设置 Canonical 链接
 */
function setCanonical(url: string): void {
  let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null

  if (!link) {
    link = document.createElement('link')
    link.rel = 'canonical'
    document.head.appendChild(link)
  }

  link.href = url
}

/**
 * 设置结构化数据
 */
export function setStructuredData(data: Record<string, unknown>): void {
  if (typeof window === 'undefined') return

  let script = document.querySelector(
    'script[type="application/ld+json"]'
  ) as HTMLScriptElement | null

  if (!script) {
    script = document.createElement('script')
    script.type = 'application/ld+json'
    document.head.appendChild(script)
  }

  script.textContent = JSON.stringify(data)

  logger.debug('[SEO] Structured data updated')
}

/**
 * 生成 SEO 友好的 URL
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

/**
 * 截断描述文本
 */
export function truncateDescription(text: string, maxLength: number = 160): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength).trim() + '...'
}

/**
 * 使用 SEO
 * 组合式函数，用于管理页面 SEO
 */
export function useSEO() {
  return {
    updateTitle,
    updateMetaTags,
    setStructuredData,
    generateSlug,
    truncateDescription,
  }
}

/**
 * 生成页面结构化数据
 */
export function generatePageStructuredData(pageData: {
  title: string
  description: string
  url?: string
  image?: string
  type?: string
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': pageData.type || 'WebPage',
    name: pageData.title,
    description: pageData.description,
    url: pageData.url || (typeof window !== 'undefined' ? window.location.href : ''),
    image: pageData.image,
  }
}


