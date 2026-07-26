/**
 * Product JSON-LD schema 生成器(2026-07-26 立,GEO 强化)。
 *
 * 适配 AI 引擎对"SaaS 产品/订阅套餐"类内容的结构化抓取,Product + Offer
 * schema 会被 Google Shopping、Claude/GPT 商业摘要器优先引用。
 *
 * 用法:
 * ```ts
 * const product = generateProductSchema({
 *   name: '智汇 AI 充值套餐',
 *   description: '...',
 *   url: 'https://ihui.ai/models/billing',
 *   brand: '智汇 AI',
 *   offers: [
 *     { name: '入门包', price: 9.9, priceCurrency: 'CNY' },
 *     { name: '专业包', price: 99, priceCurrency: 'CNY' },
 *   ],
 * })
 * ```
 */
export interface ProductOffer {
  /** 套餐/规格名称,例如 '入门包' */
  name: string
  /** 价格(必填) */
  price: number
  /** 货币 ISO 4217,例如 'CNY' / 'USD' */
  priceCurrency: string
  /** 套餐描述 */
  description?: string
  /** 套餐包含的功能/特性列表 */
  features?: string[]
  /** 是否推荐套餐 */
  recommended?: boolean
  /** 价格有效期(ISO 8601) */
  priceValidUntil?: string
  /** 库存可用性 URL(默认 InStock) */
  availability?: 'InStock' | 'OutOfStock' | 'PreOrder' | 'Discontinued'
}

export interface ProductData {
  /** 产品名称(必填) */
  name: string
  /** 产品描述(必填) */
  description: string
  /** 产品详情页 URL(必填) */
  url: string
  /** 品牌名称,默认 '智汇 AI' */
  brand?: string
  /** 产品主图 URL(可选) */
  imageUrl?: string
  /** 产品 SKU(可选) */
  sku?: string
  /** 产品 GTIN/UPC/EAN(可选) */
  gtin?: string
  /** 套餐/规格列表(>=1 个) */
  offers: ProductOffer[]
  /** 所属分类,例如 'Software > AI Development Platform' */
  category?: string
  /** 产品语言 BCP-47 */
  inLanguage: string
}

export interface ProductSchema {
  '@context': 'https://schema.org'
  '@type': 'Product'
  '@id': string
  name: string
  description: string
  url: string
  brand: { '@type': 'Brand'; name: string }
  image?: string
  sku?: string
  gtin?: string
  category?: string
  offers?: {
    '@type': 'AggregateOffer' | 'Offer'
    name?: string
    priceCurrency: string
    price: number | string
    description?: string
    priceValidUntil?: string
    availability: string
    url: string
    itemOffered?: { '@type': 'Service'; name: string; description?: string }
  } & {
    lowPrice?: number
    highPrice?: number
    offerCount?: number
  }
  inLanguage: string
  isPartOf: { '@id': string }
}

const DEFAULT_BRAND = '智汇 AI'
const SITE_WEBSITE_ID = 'https://ihui.ai/#website'

/**
 * 生成 Product JSON-LD 对象(包含 AggregateOffer 多档套餐)。
 * 返回结构与 schema.org Product 兼容,直接 JSON.stringify 注入 <head>。
 */
export function generateProductSchema(product: ProductData): ProductSchema {
  if (product.offers.length === 0) {
    throw new Error('generateProductSchema: at least one offer is required')
  }

  const brandName = product.brand ?? DEFAULT_BRAND
  const prices = product.offers.map((o) => o.price)
  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)
  const isMultiOffer = product.offers.length > 1

  const result: ProductSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${product.url}#product`,
    name: product.name,
    description: product.description,
    url: product.url,
    brand: {
      '@type': 'Brand',
      name: brandName,
    },
    inLanguage: product.inLanguage,
    isPartOf: { '@id': SITE_WEBSITE_ID },
  }

  if (product.imageUrl) {
    result.image = product.imageUrl
  }
  if (product.sku) {
    result.sku = product.sku
  }
  if (product.gtin) {
    result.gtin = product.gtin
  }
  if (product.category) {
    result.category = product.category
  }

  if (isMultiOffer) {
    // 多档套餐:用 AggregateOffer 包装,价格区间 + 数量
    const firstOffer = product.offers[0]
    if (!firstOffer) {
      throw new Error('generateProductSchema: first offer is undefined')
    }
    result.offers = {
      '@type': 'AggregateOffer',
      priceCurrency: firstOffer.priceCurrency,
      lowPrice: minPrice,
      highPrice: maxPrice,
      offerCount: product.offers.length,
      price: `${minPrice}-${maxPrice}`,
      availability: 'https://schema.org/InStock',
      url: product.url,
    }
  } else {
    // 单档:Offer 直接挂载
    const single = product.offers[0]
    if (!single) {
      throw new Error('generateProductSchema: single offer is undefined')
    }
    result.offers = {
      '@type': 'Offer',
      name: single.name,
      priceCurrency: single.priceCurrency,
      price: single.price,
      availability: `https://schema.org/${single.availability ?? 'InStock'}`,
      url: product.url,
      ...(single.description
        ? {
            itemOffered: {
              '@type': 'Service',
              name: single.name,
              description: single.description,
            },
          }
        : {}),
    }
  }

  return result
}
