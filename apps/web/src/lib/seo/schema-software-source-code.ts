/**
 * SoftwareSourceCode JSON-LD schema 生成器(2026-07-26 立,GEO 强化)。
 *
 * 适配 AI 引擎对"开源代码仓库"类内容的结构化抓取,SoftwareSourceCode
 * schema 会被 GitHub、Google Code Search、Claude/GPT 编程摘要器优先引用。
 *
 * 用法:
 * ```ts
 * const repo = generateSoftwareSourceCodeSchema({
 *   name: 'ihui/ihui-ai',
 *   description: '智汇 AI 全栈 AI 操作系统',
 *   url: 'https://github.com/ihui/ihui-ai',
 *   codeRepository: 'https://github.com/ihui/ihui-ai',
 *   programmingLanguage: 'TypeScript',
 *   license: 'Apache-2.0',
 *   stars: 1800,
 *   forks: 240,
 * })
 * ```
 */
export interface SoftwareSourceCodeData {
  /** 仓库/项目名称(必填,例如 'ihui/ihui-ai') */
  name: string
  /** 仓库描述(必填) */
  description: string
  /** 项目主页 URL(必填) */
  url: string
  /** 代码仓库 URL(必填,通常 GitHub) */
  codeRepository: string
  /** 主语言,例如 'TypeScript' */
  programmingLanguage: string
  /** 许可证,例如 'Apache-2.0' / 'MIT' */
  license: string
  /** Star 数(可选) */
  stars?: number
  /** Fork 数(可选) */
  forks?: number
  /** 关注者数(可选) */
  subscribers?: number
  /** 仓库创建日期 ISO 8601(可选) */
  dateCreated?: string
  /** 最近推送日期 ISO 8601(可选) */
  dateModified?: string
  /** 仓库所有 issues/PRs(可选) */
  issueTracker?: string
  /** 贡献者列表(可选,只填名称) */
  contributors?: string[]
  /** 主题标签(可选) */
  keywords?: string[]
  /** 关联组织(默认:智汇 AI) */
  authorName?: string
  /** 关联组织 URL(默认 https://ihui.ai) */
  authorUrl?: string
}

export interface SoftwareSourceCodeSchema {
  '@context': 'https://schema.org'
  '@type': 'SoftwareSourceCode'
  '@id': string
  name: string
  description: string
  url: string
  codeRepository: string
  programmingLanguage: string
  license: string
  dateCreated?: string
  dateModified?: string
  issueTracker?: string
  keywords?: string
  interactionStatistic?:
    | {
        '@type': 'InteractionCounter'
        interactionType: { '@type': 'EntryPoint' | 'LikeAction'; name: string }
        userInteractionCount: number
      }
    | Array<{
        '@type': 'InteractionCounter'
        interactionType: { '@type': 'EntryPoint' | 'LikeAction'; name: string }
        userInteractionCount: number
      }>
  contributor?:
    | { '@type': 'Person'; name: string }
    | Array<{ '@type': 'Person'; name: string }>
  author: {
    '@type': 'Organization'
    name: string
    url: string
  }
  isPartOf: { '@id': string }
}

const DEFAULT_AUTHOR_NAME = '智汇 AI'
const DEFAULT_AUTHOR_URL = 'https://ihui.ai'
const SITE_WEBSITE_ID = 'https://ihui.ai/#website'

/**
 * 生成 SoftwareSourceCode JSON-LD 对象。
 * 返回结构与 schema.org SoftwareSourceCode 兼容,直接 JSON.stringify 注入 <head>。
 */
export function generateSoftwareSourceCodeSchema(
  repo: SoftwareSourceCodeData
): SoftwareSourceCodeSchema {
  const result: SoftwareSourceCodeSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareSourceCode',
    '@id': `${repo.codeRepository}#software-source-code`,
    name: repo.name,
    description: repo.description,
    url: repo.url,
    codeRepository: repo.codeRepository,
    programmingLanguage: repo.programmingLanguage,
    license: repo.license,
    author: {
      '@type': 'Organization',
      name: repo.authorName ?? DEFAULT_AUTHOR_NAME,
      url: repo.authorUrl ?? DEFAULT_AUTHOR_URL,
    },
    isPartOf: { '@id': SITE_WEBSITE_ID },
  }

  if (repo.dateCreated) {
    result.dateCreated = repo.dateCreated
  }
  if (repo.dateModified) {
    result.dateModified = repo.dateModified
  }
  if (repo.issueTracker) {
    result.issueTracker = repo.issueTracker
  }
  if (repo.keywords && repo.keywords.length > 0) {
    result.keywords = repo.keywords.join(', ')
  }

  // 统计数组:Stars / Forks / Subscribers
  const stats: Array<{
    '@type': 'InteractionCounter'
    interactionType: { '@type': 'EntryPoint' | 'LikeAction'; name: string }
    userInteractionCount: number
  }> = []
  if (typeof repo.stars === 'number') {
    stats.push({
      '@type': 'InteractionCounter',
      interactionType: { '@type': 'LikeAction', name: 'stars' },
      userInteractionCount: repo.stars,
    })
  }
  if (typeof repo.forks === 'number') {
    stats.push({
      '@type': 'InteractionCounter',
      interactionType: { '@type': 'EntryPoint', name: 'forks' },
      userInteractionCount: repo.forks,
    })
  }
  if (typeof repo.subscribers === 'number') {
    stats.push({
      '@type': 'InteractionCounter',
      interactionType: { '@type': 'EntryPoint', name: 'subscribers' },
      userInteractionCount: repo.subscribers,
    })
  }
  if (stats.length === 1) {
    const first = stats[0]
    if (first) {
      result.interactionStatistic = first
    }
  } else if (stats.length > 1) {
    result.interactionStatistic = stats
  }

  if (repo.contributors && repo.contributors.length > 0) {
    const contributors = repo.contributors.map((c) => ({
      '@type': 'Person' as const,
      name: c,
    }))
    if (contributors.length === 1) {
      const first = contributors[0]
      if (first) {
        result.contributor = first
      }
    } else {
      result.contributor = contributors
    }
  }

  return result
}
