/**
 * Course JSON-LD schema 生成器(2026-07-26 立,GEO 强化)。
 *
 * 适配 AI 引擎对"AI 教育/在线课程"类内容的结构化抓取,Course schema
 * 会被 Google Course Rich Results、Claude/GPT 学习类摘要器优先引用。
 *
 * 用法:
 * ```ts
 * const course = generateCourseSchema({
 *   name: 'AI Agent 开发实战',
 *   description: '...',
 *   url: 'https://aizhs.top/use-cases/ai-edu',
 *   providerName: '智汇 AI',
 *   courseMode: 'online',
 *   hasCourseInstance: { startDate: '2026-08-01', endDate: '2026-12-31' },
 *   priceCurrency: 'CNY',
 *   price: 0,
 * })
 * ```
 */
export interface CourseInstance {
  /** 课程开始日期 ISO 8601 */
  startDate: string
  /** 课程结束日期 ISO 8601(可选) */
  endDate?: string
  /** 课程模式(在线/线下/混合),'online' | 'onsite' | 'blended' */
  courseMode: 'online' | 'onsite' | 'blended'
  /** 课程时长(ISO 8601 duration,例如 'PT8H' 表示 8 小时) */
  courseWorkload?: string
  /** 授课语言 BCP-47,例如 'zh-CN' */
  inLanguage: string
}

export interface CourseData {
  /** 课程名称(必填) */
  name: string
  /** 课程描述(必填) */
  description: string
  /** 课程详情页 URL(必填) */
  url: string
  /** 提供方名称,默认 '智汇 AI' */
  providerName?: string
  /** 提供方 URL */
  providerUrl?: string
  /** 课程实例(开课时间/模式) */
  hasCourseInstance: CourseInstance
  /** 货币 ISO 4217(可选,例如 'CNY' / 'USD') */
  priceCurrency?: string
  /** 价格数值(0 表示免费) */
  price: number
  /** 课程涵盖主题/关键词 */
  about: string[]
  /** 课程要求(可选) */
  coursePrerequisites?: string[]
  /** 课程达成能力/学习目标 */
  teaches?: string[]
  /** 课程等级(beginner/intermediate/advanced) */
  educationalLevel?: 'beginner' | 'intermediate' | 'advanced'
  /** 课程语言 BCP-47 */
  inLanguage: string
}

export interface CourseSchema {
  '@context': 'https://schema.org'
  '@type': 'Course'
  '@id': string
  name: string
  description: string
  url: string
  provider: {
    '@type': 'Organization'
    name: string
    url: string
    sameAs: string
  }
  hasCourseInstance: {
    '@type': 'CourseInstance'
    courseMode: string
    startDate: string
    endDate?: string
    courseWorkload?: string
    inLanguage: string
  }
  offers?: {
    '@type': 'Offer'
    price: number
    priceCurrency: string
    availability: 'https://schema.org/InStock'
    url: string
  }
  about: string[]
  coursePrerequisites?: string
  teaches?: string
  educationalLevel?: string
  inLanguage: string
  isPartOf: { '@id': string }
}

const DEFAULT_PROVIDER_NAME = '智汇 AI'
const DEFAULT_PROVIDER_URL = 'https://aizhs.top'
const SITE_WEBSITE_ID = 'https://aizhs.top/#website'

/**
 * 生成 Course JSON-LD 对象。
 * 返回结构与 schema.org Course 兼容,直接 JSON.stringify 注入 <head>。
 */
export function generateCourseSchema(course: CourseData): CourseSchema {
  const result: CourseSchema = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    '@id': `${course.url}#course`,
    name: course.name,
    description: course.description,
    url: course.url,
    provider: {
      '@type': 'Organization',
      name: course.providerName ?? DEFAULT_PROVIDER_NAME,
      url: course.providerUrl ?? DEFAULT_PROVIDER_URL,
      sameAs: course.providerUrl ?? DEFAULT_PROVIDER_URL,
    },
    hasCourseInstance: {
      '@type': 'CourseInstance',
      courseMode: `https://schema.org/${course.hasCourseInstance.courseMode === 'onsite' ? 'Onsite' : course.hasCourseInstance.courseMode === 'blended' ? 'Blended' : 'Online'}`,
      startDate: course.hasCourseInstance.startDate,
      inLanguage: course.hasCourseInstance.inLanguage,
    },
    about: course.about,
    inLanguage: course.inLanguage,
    isPartOf: { '@id': SITE_WEBSITE_ID },
  }

  if (course.hasCourseInstance.endDate) {
    result.hasCourseInstance.endDate = course.hasCourseInstance.endDate
  }
  if (course.hasCourseInstance.courseWorkload) {
    result.hasCourseInstance.courseWorkload = course.hasCourseInstance.courseWorkload
  }

  if (course.priceCurrency) {
    result.offers = {
      '@type': 'Offer',
      price: course.price,
      priceCurrency: course.priceCurrency,
      availability: 'https://schema.org/InStock',
      url: course.url,
    }
  }

  if (course.coursePrerequisites && course.coursePrerequisites.length > 0) {
    result.coursePrerequisites = course.coursePrerequisites.join(', ')
  }
  if (course.teaches && course.teaches.length > 0) {
    result.teaches = course.teaches.join(', ')
  }
  if (course.educationalLevel) {
    result.educationalLevel = `https://schema.org/${course.educationalLevel.charAt(0).toUpperCase()}${course.educationalLevel.slice(1)}`
  }

  return result
}
