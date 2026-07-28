/**
 * Review JSON-LD schema 生成器(2026-07-26 立,GEO 强化)。
 *
 * 适配 AI 引擎对"客户评价/产品评测"类内容的结构化抓取,Review + Rating
 * schema 会被 Google Stars Rich Results、Claude/GPT 商业摘要器优先引用。
 *
 * 用法:
 * ```ts
 * const review = generateReviewSchema({
 *   itemReviewedName: '智汇 AI 智能客服',
 *   reviewBody: '...',
 *   ratingValue: 4.8,
 *   bestRating: 5,
 *   authorName: '张磊',
 *   url: 'https://aizhs.top/use-cases/customer-support',
 * })
 * ```
 */
export interface ReviewData {
  /** 被评价对象名称(必填,例如产品/服务名) */
  itemReviewedName: string
  /** 被评价对象的 URL(必填) */
  itemReviewedUrl: string
  /** 评价正文(必填,纯文本) */
  reviewBody: string
  /** 评分(必填,1-5) */
  ratingValue: number
  /** 评分上限,默认 5 */
  bestRating?: number
  /** 评分下限,默认 1 */
  worstRating?: number
  /** 评价作者姓名(必填) */
  authorName: string
  /** 评价作者职位/头衔(可选) */
  authorJobTitle?: string
  /** 评价作者公司(可选) */
  authorAffiliation?: string
  /** 评价发布日期 ISO 8601 */
  datePublished: string
  /** 评价语言 BCP-47 */
  inLanguage: string
}

export interface ReviewSchema {
  '@context': 'https://schema.org'
  '@type': 'Review'
  '@id': string
  reviewBody: string
  reviewRating: {
    '@type': 'Rating'
    ratingValue: number
    bestRating: number
    worstRating: number
  }
  author: {
    '@type': 'Person'
    name: string
    jobTitle?: string
    affiliation?: string
  }
  datePublished: string
  itemReviewed: {
    '@type': 'Service' | 'Product'
    name: string
    url: string
  }
  inLanguage: string
  isPartOf: { '@id': string }
}

const SITE_WEBSITE_ID = 'https://aizhs.top/#website'
const DEFAULT_BEST = 5
const DEFAULT_WORST = 1

/**
 * 生成 Review JSON-LD 对象(包含 Rating 子结构)。
 * 返回结构与 schema.org Review 兼容,直接 JSON.stringify 注入 <head>。
 */
export function generateReviewSchema(review: ReviewData): ReviewSchema {
  const bestRating = review.bestRating ?? DEFAULT_BEST
  const worstRating = review.worstRating ?? DEFAULT_WORST

  // 校验评分范围
  if (review.ratingValue < worstRating || review.ratingValue > bestRating) {
    throw new Error(
      `generateReviewSchema: ratingValue (${String(review.ratingValue)}) must be within [${String(worstRating)}, ${String(bestRating)}]`
    )
  }

  const author: ReviewSchema['author'] = {
    '@type': 'Person',
    name: review.authorName,
  }
  if (review.authorJobTitle) {
    author.jobTitle = review.authorJobTitle
  }
  if (review.authorAffiliation) {
    author.affiliation = review.authorAffiliation
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'Review',
    '@id': `${review.itemReviewedUrl}#review-${review.datePublished}`,
    reviewBody: review.reviewBody,
    reviewRating: {
      '@type': 'Rating',
      ratingValue: review.ratingValue,
      bestRating,
      worstRating,
    },
    author,
    datePublished: review.datePublished,
    itemReviewed: {
      '@type': 'Service',
      name: review.itemReviewedName,
      url: review.itemReviewedUrl,
    },
    inLanguage: review.inLanguage,
    isPartOf: { '@id': SITE_WEBSITE_ID },
  }
}
