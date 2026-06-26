/**
 * SEO Composables
 * 基于 Google Agentic AI IDE 理念，自动实现 SEO 最佳实践
 */

import { onMounted, watch, type Ref } from 'vue'
import { useRoute } from 'vue-router'

let _routeFallback: ReturnType<typeof useRoute> | null = null
function getSafeRoute() {
  try {
    const r = useRoute()
    _routeFallback = r
    return r
  } catch {
    return _routeFallback
  }
}

/**
 * SEO 元数据配置
 */
export interface SEOMetadata {
  title: string
  description: string
  keywords?: string
  ogTitle?: string
  ogDescription?: string
  ogImage?: string
  ogType?: string
  twitterCard?: string
  canonical?: string
}

/**
 * 使用 SEO
 * 自动管理页面的 SEO 元数据
 */
export function useSEO(metadata?: Ref<SEOMetadata> | SEOMetadata) {
  const route = getSafeRoute()

  // 更新页面标题
  const updateTitle = (title: string) => {
    document.title = title
    // 更新 og:title
    updateMetaTag('og:title', title)
    // 更新 twitter:title
    updateMetaTag('twitter:title', title)
  }

  // 更新页面描述
  const updateDescription = (description: string) => {
    updateMetaTag('description', description)
    updateMetaTag('og:description', description)
    updateMetaTag('twitter:description', description)
  }

  // 更新关键词
  const updateKeywords = (keywords: string) => {
    updateMetaTag('keywords', keywords)
  }

  // 更新 Open Graph 图片
  const updateOGImage = (image: string) => {
    updateMetaTag('og:image', image)
    updateMetaTag('twitter:image', image)
  }

  // 更新 Open Graph 类型
  const updateOGType = (type: string) => {
    updateMetaTag('og:type', type)
  }

  // 更新 Canonical URL
  const updateCanonical = (url: string) => {
    let canonical = document.querySelector('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.setAttribute('rel', 'canonical')
      document.head.appendChild(canonical)
    }
    canonical.setAttribute('href', url)
  }

  // 更新或创建 meta 标签
  const updateMetaTag = (name: string, content: string) => {
    // 处理 property 属性（Open Graph）
    if (name.startsWith('og:') || name.startsWith('twitter:')) {
      let meta = document.querySelector(`meta[property="${name}"]`)
      if (!meta) {
        meta = document.createElement('meta')
        meta.setAttribute('property', name)
        document.head.appendChild(meta)
      }
      meta.setAttribute('content', content)
    } else {
      // 处理 name 属性（标准 meta 标签）
      let meta = document.querySelector(`meta[name="${name}"]`)
      if (!meta) {
        meta = document.createElement('meta')
        meta.setAttribute('name', name)
        document.head.appendChild(meta)
      }
      meta.setAttribute('content', content)
    }
  }

  // 应用完整的 SEO 配置
  const applySEO = (config: SEOMetadata) => {
    if (config.title) {
      updateTitle(config.title)
    }
    if (config.description) {
      updateDescription(config.description)
    }
    if (config.keywords) {
      updateKeywords(config.keywords)
    }
    if (config.ogImage) {
      updateOGImage(config.ogImage)
    }
    if (config.ogType) {
      updateOGType(config.ogType)
    }
    if (config.canonical) {
      updateCanonical(config.canonical)
    }
    // 设置默认的 og:title 和 og:description（如果没有单独指定）
    if (config.ogTitle) {
      updateMetaTag('og:title', config.ogTitle)
    }
    if (config.ogDescription) {
      updateMetaTag('og:description', config.ogDescription)
    }
    // 设置 Twitter Card
    if (config.twitterCard) {
      updateMetaTag('twitter:card', config.twitterCard)
    }
  }

  // 从路由元数据获取 SEO 配置
  const getSEOFromRoute = (): SEOMetadata | null => {
    if (!route) return null
    const meta = route.meta
    if (meta && (meta.title || meta.description)) {
      return {
        title: (meta.title as string) || '',
        description: (meta.description as string) || '',
        keywords: meta.keywords as string,
        ogTitle: meta.ogTitle as string,
        ogDescription: meta.ogDescription as string,
        ogImage: meta.ogImage as string,
        ogType: (meta.ogType as string) || 'website',
        twitterCard: (meta.twitterCard as string) || 'summary_large_image',
        canonical: meta.canonical as string,
      }
    }
    return null
  }

  // 初始化 SEO
  const initSEO = () => {
    // 如果提供了 metadata，使用它
    if (metadata) {
      const config = 'value' in metadata ? metadata.value : metadata
      if (config) {
        applySEO(config)
      }
    } else {
      // 否则尝试从路由获取
      const routeSEO = getSEOFromRoute()
      if (routeSEO) {
        applySEO(routeSEO)
      }
    }
  }

  // 监听路由变化
  if (route) {
    watch(
      () => route.path,
      () => {
        initSEO()
      }
    )
  }

  // 如果 metadata 是响应式的，监听其变化
  if (metadata && 'value' in metadata) {
    watch(
      metadata,
      newConfig => {
        if (newConfig) {
          applySEO(newConfig.value)
        }
      },
      { deep: true }
    )
  }

  // 组件挂载时初始化
  onMounted(() => {
    initSEO()
  })

  return {
    updateTitle,
    updateDescription,
    updateKeywords,
    updateOGImage,
    updateOGType,
    updateCanonical,
    applySEO,
    getSEOFromRoute,
    initSEO,
  }
}

/**
 * 生成结构化数据（JSON-LD）
 */
export function generateStructuredData(data: Record<string, unknown>): void {
  // 移除已存在的结构化数据
  const existingScript = document.querySelector('script[type="application/ld+json"]')
  if (existingScript) {
    existingScript.remove()
  }

  // 创建新的结构化数据脚本
  const script = document.createElement('script')
  script.type = 'application/ld+json'
  script.textContent = JSON.stringify(data)
  document.head.appendChild(script)
}

/**
 * 生成页面结构化数据
 */
export function generatePageStructuredData(config: {
  title: string
  description: string
  url: string
  image?: string
  datePublished?: string
  dateModified?: string
  author?: string
}) {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: config.title,
    description: config.description,
    url: config.url,
    ...(config.image && { image: config.image }),
    ...(config.datePublished && { datePublished: config.datePublished }),
    ...(config.dateModified && { dateModified: config.dateModified }),
    ...(config.author && {
      author: {
        '@type': 'Person',
        name: config.author,
      },
    }),
  }

  generateStructuredData(structuredData)
}
