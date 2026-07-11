'use client'

import * as React from 'react'

export interface SeoOptions {
  title?: string
  description?: string
  keywords?: string
  image?: string
  url?: string
  type?: string
}

/**
 * SEO Hook
 *
 * 在客户端动态更新 document.title 与 meta 标签（description/keywords/og:*）。
 * SSR 场景下建议配合 Next.js Metadata API 使用，本 Hook 侧重客户端补丁。
 */
export function useSeo(options: SeoOptions): void {
  const { title, description, keywords, image, url, type } = options

  React.useEffect(() => {
    if (typeof document === 'undefined') return
    if (title) {
      document.title = title
      setMeta('property', 'og:title', title)
    }
    if (description) {
      setMeta('name', 'description', description)
      setMeta('property', 'og:description', description)
    }
    if (keywords) {
      setMeta('name', 'keywords', keywords)
    }
    if (image) setMeta('property', 'og:image', image)
    if (url) setMeta('property', 'og:url', url)
    if (type) setMeta('property', 'og:type', type)
  }, [title, description, keywords, image, url, type])
}

/** 设置或更新一个 meta 标签，不存在则创建 */
function setMeta(attr: 'name' | 'property', key: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}
