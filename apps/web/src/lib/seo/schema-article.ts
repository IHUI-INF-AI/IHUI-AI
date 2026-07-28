/**
 * Article JSON-LD schema 生成器(2026-07-26 立,GEO 强化)。
 *
 * 适配 AI 引擎(GPTBot/ClaudeBot/PerplexityBot)对"AI 资讯/技术博客"类
 * 长文本内容的结构化抓取,Article schema 会被搜索引擎和 AI 摘要器优先引用。
 *
 * 用法:
 * ```ts
 * const article = generateArticleSchema({
 *   headline: 'GPT-5 正式发布',
 *   description: '...',
 *   url: 'https://aizhs.top/ai-news/gpt5-release',
 *   datePublished: '2026-07-26',
 *   authorName: '智汇 AI 编辑部',
 *   keywords: ['GPT-5', 'OpenAI', '大模型'],
 *   articleBody: '...',
 * })
 * // 注入: <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(article) }} />
 * ```
 */
export interface ArticleData {
  /** 文章标题(必填,<=110 字符) */
  headline: string
  /** 文章摘要(必填,<=160 字符) */
  description: string
  /** 文章 URL(必填,绝对路径) */
  url: string
  /** ISO 8601 发布日期,例如 '2026-07-26' 或 '2026-07-26T10:30:00+08:00' */
  datePublished: string
  /** ISO 8601 修改日期(可选) */
  dateModified?: string
  /** 作者姓名 */
  authorName: string
  /** 作者主页 URL(可选) */
  authorUrl?: string
  /** 关联组织(默认:智汇 AI) */
  publisherName?: string
  /** 关键词数组(<=10 个) */
  keywords: string[]
  /** 文章正文(纯文本,可选) */
  articleBody?: string
  /** 主图 URL(可选) */
  imageUrl?: string
  /** 所属板块/分类(可选,例如 'AI 模型') */
  articleSection?: string
  /** 文章语言 BCP-47,例如 'zh-CN' */
  inLanguage: string
}

export interface ArticleSchema {
  '@context': 'https://schema.org'
  '@type': 'Article'
  '@id': string
  headline: string
  description: string
  url: string
  datePublished: string
  dateModified?: string
  author: { '@type': 'Person'; name: string; url?: string }
  publisher: {
    '@type': 'Organization'
    name: string
    logo: { '@type': 'ImageObject'; url: string }
  }
  keywords: string
  articleBody?: string
  image?: string
  articleSection?: string
  inLanguage: string
  isPartOf: { '@id': string }
  mainEntityOfPage: { '@type': 'WebPage'; '@id': string }
}

const DEFAULT_PUBLISHER_NAME = '智汇 AI'
const DEFAULT_PUBLISHER_LOGO = 'https://aizhs.top/images/logo.png'
const DEFAULT_AUTHOR_URL = 'https://aizhs.top/about'
const SITE_WEBSITE_ID = 'https://aizhs.top/#website'

/**
 * 生成 Article JSON-LD 对象。
 * 返回结构与 schema.org Article 兼容,可直接 JSON.stringify 注入页面 <head>。
 */
export function generateArticleSchema(article: ArticleData): ArticleSchema {
  const result: ArticleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${article.url}#article`,
    headline: article.headline,
    description: article.description,
    url: article.url,
    datePublished: article.datePublished,
    author: {
      '@type': 'Person',
      name: article.authorName,
      ...(article.authorUrl ? { url: article.authorUrl } : {}),
    },
    publisher: {
      '@type': 'Organization',
      name: article.publisherName ?? DEFAULT_PUBLISHER_NAME,
      logo: {
        '@type': 'ImageObject',
        url: DEFAULT_PUBLISHER_LOGO,
      },
    },
    keywords: article.keywords.join(', '),
    inLanguage: article.inLanguage,
    isPartOf: { '@id': SITE_WEBSITE_ID },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': article.url,
    },
  }

  if (article.dateModified) {
    result.dateModified = article.dateModified
  }
  if (article.articleBody) {
    result.articleBody = article.articleBody
  }
  if (article.imageUrl) {
    result.image = article.imageUrl
  }
  if (article.articleSection) {
    result.articleSection = article.articleSection
  }

  return result
}

/** 默认作者信息(用于未指定作者的资讯条目) */
export const DEFAULT_ARTICLE_AUTHOR = {
  name: DEFAULT_PUBLISHER_NAME,
  url: DEFAULT_AUTHOR_URL,
}
