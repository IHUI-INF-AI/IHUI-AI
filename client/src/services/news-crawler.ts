import { t } from '@/utils/i18n'

/**
 * 前端新闻抓取服务
 * 完全在浏览器中执行，不依赖后端
 */

import type { NewsSource } from '@/scripts/news-crawler/config'
import { NEWS_SOURCES } from '@/scripts/news-crawler/config'
import { saveNews } from './news-storage'
import { logger } from '@/utils/logger'

export interface NewsItem {
  title: string
  summary?: string
  content?: string
  cover_image?: string
  publish_time: string
  source: string
  source_url: string
  author?: string
  category?: string
  language?: string
}

/**
 * 错误日志接口
 */
interface ErrorLog {
  id: string
  timestamp: number
  level: 'error' | 'warning' | 'info'
  source: string
  message: string
  details?: string
  stack?: string
  metadata?: Record<string, unknown>
}

/**
 * 统计数据接口
 */
interface CrawlStatistics {
  totalCrawls: number
  successfulCrawls: number
  failedCrawls: number
  totalNewsItems: number
  averageResponseTime: number
  sourceStats: Map<string, SourceStatistics>
  proxyStats: Map<string, ProxyStatistics>
  lastCrawlTime?: number
  lastSuccessTime?: number
  lastFailureTime?: number
}

/**
 * 单个源统计
 */
interface SourceStatistics {
  name: string
  totalAttempts: number
  successfulAttempts: number
  failedAttempts: number
  totalNewsItems: number
  averageResponseTime: number
  lastSuccessTime?: number
  lastFailureTime?: number
  consecutiveFailures: number
}

/**
 * 代理统计
 */
interface ProxyStatistics {
  url: string
  priority: number
  health: number
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  averageResponseTime: number
  lastSuccessTime?: number
  lastFailureTime?: number
}

/**
 * 错误日志存储
 */
const errorLogs: ErrorLog[] = []
const MAX_ERROR_LOGS = 100

/**
 * 统计数据
 */
const statistics: CrawlStatistics = {
  totalCrawls: 0,
  successfulCrawls: 0,
  failedCrawls: 0,
  totalNewsItems: 0,
  averageResponseTime: 0,
  sourceStats: new Map(),
  proxyStats: new Map(),
}

/**
 * 记录错误日志
 */
export function logError(
  level: 'error' | 'warning' | 'info',
  source: string,
  message: string,
  details?: string,
  metadata?: Record<string, unknown>
): void {
  const errorLog: ErrorLog = {
    id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    level,
    source,
    message,
    details,
    metadata,
  }

  errorLogs.push(errorLog)

  if (errorLogs.length > MAX_ERROR_LOGS) {
    errorLogs.shift()
  }

  const timestamp = new Date(errorLog.timestamp).toLocaleString('zh-CN')
  const prefix = level === 'error' ? '❌' : level === 'warning' ? '⚠️' : 'ℹ️'
  logger.info(`[${prefix} ${timestamp}] [${source}] ${message}`)
  
  if (details) {
    logger.debug(`  Details: ${details}`)
  }
  
  if (metadata) {
    logger.debug(`  Metadata:`, metadata)
  }
}

/**
 * 获取错误日志
 */
export function getErrorLogs(level?: 'error' | 'warning' | 'info', limit?: number): ErrorLog[] {
  let logs = [...errorLogs]

  if (level) {
    logs = logs.filter(log => log.level === level)
  }

  logs.sort((a, b) => b.timestamp - a.timestamp)

  if (limit) {
    return logs.slice(0, limit)
  }

  return logs
}

/**
 * 清除错误日志
 */
export function clearErrorLogs(): void {
  errorLogs.length = 0
  logger.info('[Crawler] Error logs cleared')
}

/**
 * 更新统计数据
 */
function updateStatistics(
  source: string,
  success: boolean,
  newsCount: number,
  responseTime: number,
  proxyUrl?: string
): void {
  statistics.totalCrawls++
  statistics.totalNewsItems += newsCount

  if (success) {
    statistics.successfulCrawls++
    statistics.lastSuccessTime = Date.now()
  } else {
    statistics.failedCrawls++
    statistics.lastFailureTime = Date.now()
  }

  statistics.lastCrawlTime = Date.now()
  statistics.averageResponseTime = Math.round(
    (statistics.averageResponseTime * (statistics.totalCrawls - 1) + responseTime) / statistics.totalCrawls
  )

  let sourceStat = statistics.sourceStats.get(source)
  if (!sourceStat) {
    sourceStat = {
      name: source,
      totalAttempts: 0,
      successfulAttempts: 0,
      failedAttempts: 0,
      totalNewsItems: 0,
      averageResponseTime: 0,
      consecutiveFailures: 0,
    }
    statistics.sourceStats.set(source, sourceStat)
  }

  sourceStat.totalAttempts++
  sourceStat.totalNewsItems += newsCount

  if (success) {
    sourceStat.successfulAttempts++
    sourceStat.lastSuccessTime = Date.now()
    sourceStat.consecutiveFailures = 0
  } else {
    sourceStat.failedAttempts++
    sourceStat.lastFailureTime = Date.now()
    sourceStat.consecutiveFailures++
  }

  sourceStat.averageResponseTime = Math.round(
    (sourceStat.averageResponseTime * (sourceStat.totalAttempts - 1) + responseTime) / sourceStat.totalAttempts
  )

  if (proxyUrl) {
    let proxyStat = statistics.proxyStats.get(proxyUrl)
    if (!proxyStat) {
      const proxy = CORS_PROXIES.find(p => p.url === proxyUrl)
      proxyStat = {
        url: proxyUrl,
        priority: proxy?.priority || 0,
        health: 100,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
      }
      statistics.proxyStats.set(proxyUrl, proxyStat)
    }

    proxyStat.totalRequests++

    if (success) {
      proxyStat.successfulRequests++
      proxyStat.lastSuccessTime = Date.now()
      proxyStat.health = Math.min(100, proxyStat.health + 2)
    } else {
      proxyStat.failedRequests++
      proxyStat.lastFailureTime = Date.now()
      proxyStat.health = Math.max(0, proxyStat.health - 10)
    }

    proxyStat.averageResponseTime = Math.round(
      (proxyStat.averageResponseTime * (proxyStat.totalRequests - 1) + responseTime) / proxyStat.totalRequests
    )
  }
}

/**
 * 获取统计数据
 */
export function getStatistics(): CrawlStatistics {
  return {
    ...statistics,
    sourceStats: new Map(statistics.sourceStats),
    proxyStats: new Map(statistics.proxyStats),
  }
}

/**
 * 生成统计报告
 */
export function generateStatisticsReport(): string {
  const stats = getStatistics()
  const lines: string[] = []

  lines.push('='.repeat(60))
  lines.push('新闻爬虫统计报告')
  lines.push('='.repeat(60))
  lines.push(`生成时间: ${new Date().toLocaleString('zh-CN')}`)
  lines.push('')

  lines.push('总体统计:')
  lines.push(`  总抓取次数: ${stats.totalCrawls}`)
  lines.push(`  成功次数: ${stats.successfulCrawls}`)
  lines.push(`  失败次数: ${stats.failedCrawls}`)
  lines.push(`  成功率: ${stats.totalCrawls > 0 ? ((stats.successfulCrawls / stats.totalCrawls) * 100).toFixed(2) : 0}%`)
  lines.push(`  总新闻数: ${stats.totalNewsItems}`)
  lines.push(`  平均响应时间: ${stats.averageResponseTime}ms`)
  lines.push('')

  if (stats.lastCrawlTime) {
    lines.push(`最后抓取时间: ${new Date(stats.lastCrawlTime).toLocaleString('zh-CN')}`)
  }
  if (stats.lastSuccessTime) {
    lines.push(`最后成功时间: ${new Date(stats.lastSuccessTime).toLocaleString('zh-CN')}`)
  }
  if (stats.lastFailureTime) {
    lines.push(`最后失败时间: ${new Date(stats.lastFailureTime).toLocaleString('zh-CN')}`)
  }
  lines.push('')

  lines.push('-'.repeat(60))
  lines.push('RSS源统计:')
  lines.push('-'.repeat(60))

  stats.sourceStats.forEach((sourceStat, _source) => {
    lines.push(`  ${sourceStat.name}:`)
    lines.push(`    总尝试次数: ${sourceStat.totalAttempts}`)
    lines.push(`    成功次数: ${sourceStat.successfulAttempts}`)
    lines.push(`    失败次数: ${sourceStat.failedAttempts}`)
    lines.push(`    成功率: ${sourceStat.totalAttempts > 0 ? ((sourceStat.successfulAttempts / sourceStat.totalAttempts) * 100).toFixed(2) : 0}%`)
    lines.push(`    总新闻数: ${sourceStat.totalNewsItems}`)
    lines.push(`    平均响应时间: ${sourceStat.averageResponseTime}ms`)
    lines.push(`    连续失败次数: ${sourceStat.consecutiveFailures}`)
    if (sourceStat.lastSuccessTime) {
      lines.push(`    最后成功: ${new Date(sourceStat.lastSuccessTime).toLocaleString('zh-CN')}`)
    }
    if (sourceStat.lastFailureTime) {
      lines.push(`    最后失败: ${new Date(sourceStat.lastFailureTime).toLocaleString('zh-CN')}`)
    }
    lines.push('')
  })

  lines.push('-'.repeat(60))
  lines.push('代理统计:')
  lines.push('-'.repeat(60))

  stats.proxyStats.forEach((proxyStat, url) => {
    const hostname = url.split('/')[2]
    lines.push(`  ${hostname}:`)
    lines.push(`    优先级: ${proxyStat.priority}`)
    lines.push(`    健康度: ${proxyStat.health}%`)
    lines.push(`    总请求次数: ${proxyStat.totalRequests}`)
    lines.push(`    成功次数: ${proxyStat.successfulRequests}`)
    lines.push(`    失败次数: ${proxyStat.failedRequests}`)
    lines.push(`    成功率: ${proxyStat.totalRequests > 0 ? ((proxyStat.successfulRequests / proxyStat.totalRequests) * 100).toFixed(2) : 0}%`)
    lines.push(`    平均响应时间: ${proxyStat.averageResponseTime}ms`)
    if (proxyStat.lastSuccessTime) {
      lines.push(`    最后成功: ${new Date(proxyStat.lastSuccessTime).toLocaleString('zh-CN')}`)
    }
    if (proxyStat.lastFailureTime) {
      lines.push(`    最后失败: ${new Date(proxyStat.lastFailureTime).toLocaleString('zh-CN')}`)
    }
    lines.push('')
  })

  lines.push('='.repeat(60))

  return lines.join('\n')
}

/**
 * 重置统计数据
 */
export function resetStatistics(): void {
  statistics.totalCrawls = 0
  statistics.successfulCrawls = 0
  statistics.failedCrawls = 0
  statistics.totalNewsItems = 0
  statistics.averageResponseTime = 0
  statistics.sourceStats.clear()
  statistics.proxyStats.clear()
  delete statistics.lastCrawlTime
  delete statistics.lastSuccessTime
  delete statistics.lastFailureTime

  logger.info('[Crawler] Statistics reset')
}

// 使用CORS代理来避免跨域问题
// 备用多个代理服务，如果某个失败可以切换
const CORS_PROXIES = [
  { url: 'https://api.allorigins.win/raw?url=', priority: 1, health: 100 },
  { url: 'https://corsproxy.io/?', priority: 2, health: 100 },
  { url: 'https://api.codetabs.com/v1/proxy?quest=', priority: 3, health: 100 },
  { url: 'https://thingproxy.freeboard.io/fetch/', priority: 4, health: 100 },
  { url: 'https://api.rss2json.com/v1/api.json?rss_url=', priority: 5, health: 100, isJson: true },
]

let currentProxyIndex = 0
const PROXY_FAILURE_THRESHOLD = 3
const PROXY_RECOVERY_TIME = 5 * 60 * 1000

interface ProxyStatus {
  url: string
  priority: number
  health: number
  isJson?: boolean
  lastFailure?: number
  consecutiveFailures: number
}

const proxyStatuses: Map<string, ProxyStatus> = new Map()

function initializeProxyStatuses(): void {
  CORS_PROXIES.forEach(proxy => {
    proxyStatuses.set(proxy.url, {
      url: proxy.url,
      priority: proxy.priority,
      health: proxy.health,
      isJson: proxy.isJson,
      consecutiveFailures: 0,
    })
  })
}

initializeProxyStatuses()

function getAvailableProxies(): ProxyStatus[] {
  const now = Date.now()
  return Array.from(proxyStatuses.values())
    .filter(proxy => {
      if (proxy.consecutiveFailures >= PROXY_FAILURE_THRESHOLD) {
        if (proxy.lastFailure && (now - proxy.lastFailure) < PROXY_RECOVERY_TIME) {
          return false
        } else {
          proxy.consecutiveFailures = 0
          proxy.health = 100
        }
      }
      return true
    })
    .sort((a, b) => {
      if (b.health !== a.health) return b.health - a.health
      return a.priority - b.priority
    })
}

function recordProxySuccess(proxyUrl: string): void {
  const proxy = proxyStatuses.get(proxyUrl)
  if (proxy) {
    proxy.consecutiveFailures = 0
    proxy.health = Math.min(100, proxy.health + 5)
    proxy.lastFailure = undefined
  }
}

function recordProxyFailure(proxyUrl: string): void {
  const proxy = proxyStatuses.get(proxyUrl)
  if (proxy) {
    proxy.consecutiveFailures++
    proxy.health = Math.max(0, proxy.health - 20)
    proxy.lastFailure = Date.now()
    logger.warn(`[Proxy] ${proxyUrl.split('/')[2]} Health degraded to ${proxy.health}%`)
  }
}

function getCurrentProxy(): ProxyStatus {
  const availableProxies = getAvailableProxies()
  if (availableProxies.length === 0) {
    throw new Error(t('error.news_crawler.所有代理都不可用1'))
  }
  return availableProxies[currentProxyIndex % availableProxies.length]
}

function switchProxy(): void {
  const availableProxies = getAvailableProxies()
  if (availableProxies.length > 0) {
    currentProxyIndex = (currentProxyIndex + 1) % availableProxies.length
    const proxy = availableProxies[currentProxyIndex]
    logger.info(`[Proxy] Switched to proxy: ${proxy.url.split('/')[2]} (health: ${proxy.health})`)
  }
}

/**
 * RSS2JSON 返回的新闻项结构
 */
interface RSS2JSONItem {
  title?: string
  link?: string
  pubDate?: string
  description?: string
  content?: string
  author?: string
  enclosure?: { type?: string; url?: string }
  'media:content'?: { '@'?: { url?: string } } | Array<{ '@'?: { url?: string } }> | string
  'media:thumbnail'?: { '@'?: { url?: string } } | Array<{ '@'?: { url?: string } }>
  thumbnail?: string
  image?: string | { url?: string }
}

/**
 * 解析rss2json返回的新闻项
 */
function parseRSS2JSONItems(items: RSS2JSONItem[], source: NewsSource): NewsItem[] {
  const newsItems: NewsItem[] = []

  for (const item of items.slice(0, 20)) {
    try {
      const title = item.title || ''
      const link = item.link || ''
      const pubDate = item.pubDate || ''
      const description = item.description || item.content || ''
      const author = item.author || ''

      // 提取摘要（移除HTML标签）
      let summary = description.replace(/<[^>]*>/g, '').trim()
      if (summary.length > 300) {
        summary = summary.substring(0, 300) + '...'
      }

      // 提取图片 - 增强的图片提取逻辑
      let coverImage: string | undefined

      // 1. 优先检查RSS标准的enclosure标签（用于图片）
      if (item.enclosure && item.enclosure.type && item.enclosure.type.startsWith('image/')) {
        coverImage = item.enclosure.url
      }

      // 2. 检查media:content标签（用于媒体内容）
      if (!coverImage && item['media:content']) {
        const mediaContent = item['media:content']
        if (typeof mediaContent === 'string') {
          coverImage = mediaContent
        } else if (Array.isArray(mediaContent) && mediaContent[0]?.['@']?.url) {
          coverImage = mediaContent[0]['@'].url
        } else if (!Array.isArray(mediaContent) && mediaContent['@']?.url) {
          coverImage = mediaContent['@'].url
        }
      }

      // 3. 检查media:thumbnail标签
      if (!coverImage && item['media:thumbnail']) {
        const mediaThumbnail = item['media:thumbnail']
        if (Array.isArray(mediaThumbnail) && mediaThumbnail[0]?.['@']?.url) {
          coverImage = mediaThumbnail[0]['@'].url
        } else if (!Array.isArray(mediaThumbnail) && mediaThumbnail['@']?.url) {
          coverImage = mediaThumbnail['@'].url
        }
      }

      // 4. 检查thumbnail字段
      if (!coverImage && item.thumbnail) {
        coverImage = item.thumbnail
      }

      // 5. 检查image字段
      if (!coverImage && item.image) {
        if (typeof item.image === 'string') {
          coverImage = item.image
        } else if (item.image.url) {
          coverImage = item.image.url
        }
      }

      // 6. 从description中提取第一张图片
      if (!coverImage) {
        const imgMatch = description.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i)
        if (imgMatch && imgMatch[1]) {
          coverImage = imgMatch[1]
        }
      }

      // 7. 从content中提取第一张图片（如果description中没有）
      if (!coverImage && item.content) {
        const imgMatch = item.content.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i)
        if (imgMatch && imgMatch[1]) {
          coverImage = imgMatch[1]
        }
      }

      // 8. 检查og:image等社交媒体图片
      if (!coverImage) {
        const ogImageMatch = description.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i)
        if (ogImageMatch && ogImageMatch[1]) {
          coverImage = ogImageMatch[1]
        }
      }

      // 9. 检查twitter:image
      if (!coverImage) {
        const twitterImageMatch = description.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["'][^>]*>/i)
        if (twitterImageMatch && twitterImageMatch[1]) {
          coverImage = twitterImageMatch[1]
        }
      }

      // 10. 检查link标签中的image
      if (!coverImage && item.link) {
        // 尝试从新闻页面URL推断可能的图片URL
        try {
          const urlObj = new URL(item.link)
          // 对于某些网站，图片URL可能有特定模式
          if (urlObj.hostname.includes('medium.com')) {
            // Medium文章通常有特定的图片格式
            const mediumImageMatch = description.match(/https:\/\/miro\.medium\.com\/[^"'\s]+/i)
            if (mediumImageMatch) {
              coverImage = mediumImageMatch[0]
            }
          }
        } catch (_e) {
          // 忽略URL解析错误
        }
      }

      // 处理相对URL
      if (coverImage) {
        // 如果是相对路径，转换为绝对路径
        if (!coverImage.startsWith('http://') && !coverImage.startsWith('https://')) {
          try {
            const baseUrl = new URL(link || source.url)
            if (coverImage.startsWith('//')) {
              coverImage = 'https:' + coverImage
            } else if (coverImage.startsWith('/')) {
              coverImage = baseUrl.origin + coverImage
            } else {
              coverImage = baseUrl.origin + '/' + coverImage
            }
          } catch (e) {
            logger.warn('[RSS] Failed to process image URL:', e)
            coverImage = undefined
          }
        }
      }

      // 解析日期
      let publishTime = new Date().toISOString()
      if (pubDate) {
        const parsedDate = new Date(pubDate)
        if (!isNaN(parsedDate.getTime())) {
          publishTime = parsedDate.toISOString()
        }
      }

      newsItems.push({
        title: title.trim() || '无标题',
        summary: summary || undefined,
        content: description || undefined,
        cover_image: coverImage,
        publish_time: publishTime,
        source: source.name,
        source_url: link || source.url,
        author: author || undefined,
        category: source.category,
        language: source.language,
      })
    } catch (error) {
      logger.warn(`[RSS] Failed to process rss2json news item:`, error)
    }
  }

  return newsItems
}

/**
 * 从RSS源抓取新闻（前端版本）
 */
async function fetchFromRSS(source: NewsSource): Promise<NewsItem[]> {
  const startTime = Date.now()
  
  try {
    logError('info', 'RSS', `开始抓取: ${source.name}`, `URL: ${source.url}`)

    let lastError: Error | null = null
    const availableProxies = getAvailableProxies()
    const maxAttempts = Math.min(availableProxies.length, 5)

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const proxy = getCurrentProxy()
        let proxyUrl: string
        
        if (proxy.isJson) {
          proxyUrl = proxy.url + encodeURIComponent(source.url)
        } else {
          proxyUrl = proxy.url + encodeURIComponent(source.url)
        }
        
        logError('info', 'RSS', `尝试代理 ${attempt + 1}/${maxAttempts}`, 
          `代理: ${proxy.url.split('/')[2]} (health: ${proxy.health})`)
        
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 45000)

        try {
          const response = await fetch(proxyUrl, {
            method: 'GET',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'application/rss+xml, application/xml, text/xml, application/json, */*',
            },
            signal: controller.signal,
          })

          clearTimeout(timeoutId)

          if (response.status === 426) {
            throw new Error(`代理服务返回426错误，尝试切换代理`)
          }

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
          }

          const responseText = await response.text()
          
          if (proxy.isJson) {
            try {
              const jsonData = JSON.parse(responseText)
              if (jsonData.status === 'ok' && jsonData.items) {
                const newsItems = parseRSS2JSONItems(jsonData.items, source)
                const responseTime = Date.now() - startTime
                updateStatistics(source.name, true, newsItems.length, responseTime, proxy.url)
                recordProxySuccess(proxy.url)
                logError('info', 'RSS', `成功抓取 ${newsItems.length} 条新闻: ${source.name}`, 
                  `response time: ${responseTime}ms`)
                return newsItems
              } else {
                throw new Error(t('error.news_crawler.rss2json2'))
              }
            } catch (e) {
              throw new Error(t('error.news_crawler.rss2jsonPa') + (e instanceof Error ? e.message : String(e)))
            }
          }

          const parser = new DOMParser()
          const xmlDoc = parser.parseFromString(responseText, 'text/xml')

          const parseError = xmlDoc.querySelector('parsererror')
          if (parseError) {
            throw new Error(t('error.news_crawler.XML解析失败3'))
          }

          const items = xmlDoc.querySelectorAll('item')
          const newsItems: NewsItem[] = []

          for (const item of Array.from(items).slice(0, 20)) {
            try {
              const title = item.querySelector('title')?.textContent || ''
              const link = item.querySelector('link')?.textContent || ''
              const pubDate = item.querySelector('pubDate')?.textContent || ''
              const description = item.querySelector('description')?.textContent || ''
              const author = item.querySelector('author')?.textContent || item.querySelector('dc\\:creator')?.textContent || ''

              let summary = description.replace(/<[^>]*>/g, '').trim()
              if (summary.length > 300) {
                summary = summary.substring(0, 300) + '...'
              }

              let coverImage: string | undefined

              const enclosure = item.querySelector('enclosure')
              if (enclosure) {
                const type = enclosure.getAttribute('type')
                const url = enclosure.getAttribute('url')
                if (type && type.startsWith('image/') && url) {
                  coverImage = url
                }
              }

              if (!coverImage) {
                const mediaContent = item.querySelector('media\\:content')
                if (mediaContent) {
                  const url = mediaContent.getAttribute('url')
                  if (url) {
                    coverImage = url
                  }
                }
              }

              if (!coverImage) {
                const mediaThumbnail = item.querySelector('media\\:thumbnail')
                if (mediaThumbnail) {
                  const url = mediaThumbnail.getAttribute('url')
                  if (url) {
                    coverImage = url
                  }
                }
              }

              if (!coverImage) {
                const imageTag = item.querySelector('image')
                if (imageTag) {
                  const url = imageTag.querySelector('url')?.textContent
                  if (url) {
                    coverImage = url
                  }
                }
              }

              if (!coverImage) {
                const imgMatch = description.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i)
                if (imgMatch && imgMatch[1]) {
                  coverImage = imgMatch[1]
                }
              }

              if (!coverImage) {
                const content = item.querySelector('content\\:encoded')?.textContent || ''
                if (content) {
                  const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i)
                  if (imgMatch && imgMatch[1]) {
                    coverImage = imgMatch[1]
                  }
                }
              }

              if (!coverImage) {
                const ogImageMatch = description.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i)
                if (ogImageMatch && ogImageMatch[1]) {
                  coverImage = ogImageMatch[1]
                }
              }

              if (!coverImage) {
                const twitterImageMatch = description.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["'][^>]*>/i)
                if (twitterImageMatch && twitterImageMatch[1]) {
                  coverImage = twitterImageMatch[1]
                }
              }

              if (!coverImage && link && link.includes('medium.com')) {
                const mediumImageMatch = description.match(/https:\/\/miro\.medium\.com\/[^"'\s]+/i)
                if (mediumImageMatch) {
                  coverImage = mediumImageMatch[0]
                }
              }

              if (!coverImage && link) {
                try {
                  const urlObj = new URL(link)
                  if (urlObj.hostname.includes('techcrunch.com')) {
                    const tcImageMatch = description.match(/https:\/\/techcrunch\.com\/wp-content\/uploads\/[^"'\s]+\.(jpg|jpeg|png|webp)/i)
                    if (tcImageMatch) {
                      coverImage = tcImageMatch[0]
                    }
                  }
                } catch (_e) {
                  // ignore
                }
              }

              if (coverImage) {
                if (!coverImage.startsWith('http://') && !coverImage.startsWith('https://')) {
                  try {
                    const baseUrl = new URL(link || source.url)
                    if (coverImage.startsWith('//')) {
                      coverImage = 'https:' + coverImage
                    } else if (coverImage.startsWith('/')) {
                      coverImage = baseUrl.origin + coverImage
                    } else {
                      coverImage = baseUrl.origin + '/' + coverImage
                    }
                  } catch (e) {
                    logError('warning', 'RSS', 'Failed to process image URL', e instanceof Error ? e.message : String(e))
                    coverImage = undefined
                  }
                }
              }

              let publishTime = new Date().toISOString()
              if (pubDate) {
                const parsedDate = new Date(pubDate)
                if (!isNaN(parsedDate.getTime())) {
                  publishTime = parsedDate.toISOString()
                }
              }

              newsItems.push({
                title: title.trim() || '无标题',
                summary: summary || undefined,
                content: description || undefined,
                cover_image: coverImage,
                publish_time: publishTime,
                source: source.name,
                source_url: link || source.url,
                author: author || undefined,
                category: source.category,
                language: source.language,
              })
            } catch (error) {
              logError('warning', 'RSS', '处理新闻项失败', 
                error instanceof Error ? error.message : String(error))
            }
          }

          if (newsItems.length > 0) {
            const responseTime = Date.now() - startTime
            updateStatistics(source.name, true, newsItems.length, responseTime, proxy.url)
            recordProxySuccess(proxy.url)
            logError('info', 'RSS', `成功抓取 ${newsItems.length} 条新闻: ${source.name}`, 
              `response time: ${responseTime}ms`)
            return newsItems
          } else {
            throw new Error(t('error.news_crawler.未找到任何新闻项4'))
          }
        } catch (fetchError) {
          clearTimeout(timeoutId)
          recordProxyFailure(proxy.url)
          lastError = fetchError instanceof Error ? fetchError : new Error(String(fetchError))
          logError('warning', 'RSS', `代理 ${proxy.url.split('/')[2]} 失败`, 
            lastError.message, { attempt: attempt + 1, maxAttempts })
          throw lastError
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        
        if (attempt < maxAttempts - 1) {
          switchProxy()
          const backoffTime = Math.min(1000 * Math.pow(2, attempt), 5000)
          logError('info', 'RSS', `等待 ${backoffTime}ms 后重试...`)
          await new Promise(resolve => setTimeout(resolve, backoffTime))
        }
      }
    }

    throw lastError || new Error('所有代理都失败了')
  } catch (error) {
    const responseTime = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)
    updateStatistics(source.name, false, 0, responseTime)
    logError('error', 'RSS', `抓取失败 ${source.name}`, errorMessage, 
      { responseTime, url: source.url })
    return []
  }
}

/**
 * 抓取单个新闻源
 */
async function crawlSource(source: NewsSource): Promise<NewsItem[]> {
  if (!source.enabled) {
    logger.debug(`[Skipped] ${source.name} - disabled`)
    return []
  }

  switch (source.type) {
    case 'rss':
      return await fetchFromRSS(source)
    default:
      logger.warn(`[Unknown type] ${source.name} - type: ${source.type}`)
      return []
  }
}

/**
 * 抓取所有启用的新闻源
 */
export async function crawlAllSources(sources: NewsSource[] = NEWS_SOURCES): Promise<NewsItem[]> {
  const allNews: NewsItem[] = []
  const enabledSources = sources.filter(s => s.enabled)

  logger.info(`[Started] fetching ${enabledSources.length} news sources`)

  // 串行抓取，避免并发过多
  for (const source of enabledSources) {
    try {
      const news = await crawlSource(source)
      allNews.push(...news)

      // 延迟，避免请求过快
      await new Promise(resolve => setTimeout(resolve, 1000))
    } catch (error) {
      logger.error(`[Error] fetching ${source.name} failed:`, error)
    }
  }

  logger.info(`[Completed] collected ${allNews.length} news items`)
  return allNews
}

/**
 * 执行完整的抓取和保存流程
 */
export async function executeCrawlAndSave(): Promise<{ crawled: number; saved: number }> {
  const startTime = Date.now()
  logger.info(`[Crawl task started - ${new Date().toLocaleString('zh-CN')}`)

  try {
    // 抓取新闻
    const newsItems = await crawlAllSources()

    if (newsItems.length > 0) {
      // 保存到本地存储
      const savedCount = await saveNews(newsItems)
      logger.info(`[Crawl task saved successfully ${savedCount} news items`)

      const duration = ((Date.now() - startTime) / 1000).toFixed(2)
      logger.info(`[Crawl task execution completed - duration: ${duration}s`)

      return {
        crawled: newsItems.length,
        saved: savedCount,
      }
    } else {
      logger.info(`[Crawl task got no news`)
      return {
        crawled: 0,
        saved: 0,
      }
    }
  } catch (error) {
    logger.error(`[Crawl task execution failed:`, error)
    return {
      crawled: 0,
      saved: 0,
    }
  }
}

/**
 * RSS源健康状态接口
 */
interface RSSSourceHealth {
  url: string
  name: string
  isHealthy: boolean
  lastCheck: number
  lastSuccess?: number
  lastFailure?: number
  consecutiveFailures: number
  averageResponseTime?: number
  itemCount?: number
  errorMessage?: string
}

/**
 * RSS源健康检查结果
 */
interface HealthCheckResult {
  totalSources: number
  healthySources: number
  unhealthySources: number
  sources: RSSSourceHealth[]
}

/**
 * RSS源健康状态存储
 */
const sourceHealthStatus: Map<string, RSSSourceHealth> = new Map()

/**
 * 检查单个RSS源的健康状态
 */
async function checkRSSSourceHealth(source: NewsSource): Promise<RSSSourceHealth> {
  const startTime = Date.now()
  const existingStatus = sourceHealthStatus.get(source.url)

  try {
    logger.debug(`[Health check started: ${source.name}`)

    let lastError: Error | null = null
    const availableProxies = getAvailableProxies()
    const maxAttempts = Math.min(availableProxies.length, 3)

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const proxy = getCurrentProxy()
        let proxyUrl: string
        
        if (proxy.isJson) {
          proxyUrl = proxy.url + encodeURIComponent(source.url)
        } else {
          proxyUrl = proxy.url + encodeURIComponent(source.url)
        }

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 15000)

        try {
          const response = await fetch(proxyUrl, {
            method: 'GET',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'application/rss+xml, application/xml, text/xml, application/json, */*',
            },
            signal: controller.signal,
          })

          clearTimeout(timeoutId)

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`)
          }

          const responseText = await response.text()
          let itemCount = 0

          if (proxy.isJson) {
            try {
              const jsonData = JSON.parse(responseText)
              if (jsonData.status === 'ok' && jsonData.items) {
                itemCount = jsonData.items.length
              } else {
                throw new Error(t('error.news_crawler.无效的JSON响5'))
              }
            } catch (_e) {
              throw new Error(t('error.news_crawler.JSON解析失败6'))
            }
          } else {
            const parser = new DOMParser()
            const xmlDoc = parser.parseFromString(responseText, 'text/xml')

            const parseError = xmlDoc.querySelector('parsererror')
            if (parseError) {
              throw new Error(t('error.news_crawler.XML解析失败7'))
            }

            const items = xmlDoc.querySelectorAll('item')
            itemCount = items.length

            if (itemCount === 0) {
              throw new Error(t('error.news_crawler.未找到新闻项8'))
            }
          }

          const responseTime = Date.now() - startTime
          const healthStatus: RSSSourceHealth = {
            url: source.url,
            name: source.name,
            isHealthy: true,
            lastCheck: Date.now(),
            lastSuccess: Date.now(),
            consecutiveFailures: 0,
            averageResponseTime: existingStatus?.averageResponseTime 
              ? Math.round((existingStatus.averageResponseTime + responseTime) / 2)
              : responseTime,
            itemCount,
          }

          sourceHealthStatus.set(source.url, healthStatus)
          logger.info(`[Health check] ✓ ${source.name} - ${itemCount} news items, response time: ${responseTime}ms`)

          return healthStatus
        } catch (fetchError) {
          clearTimeout(timeoutId)
          lastError = fetchError instanceof Error ? fetchError : new Error(String(fetchError))
          logger.warn(`[Health check failed:`, lastError.message)
          
          if (attempt < maxAttempts - 1) {
            switchProxy()
            await new Promise(resolve => setTimeout(resolve, 500))
          }
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
      }
    }

    throw lastError || new Error('所有代理都失败了')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const consecutiveFailures = (existingStatus?.consecutiveFailures || 0) + 1

    const healthStatus: RSSSourceHealth = {
      url: source.url,
      name: source.name,
      isHealthy: false,
      lastCheck: Date.now(),
      lastFailure: Date.now(),
      consecutiveFailures,
      averageResponseTime: existingStatus?.averageResponseTime,
      itemCount: existingStatus?.itemCount,
      errorMessage,
    }

    sourceHealthStatus.set(source.url, healthStatus)
    logger.error(`[Health check failed: ${consecutiveFailures})`)

    return healthStatus
  }
}

/**
 * 检查所有RSS源的健康状态
 */
export async function checkAllRSSSourcesHealth(sources: NewsSource[] = NEWS_SOURCES): Promise<HealthCheckResult> {
  logger.info(`[Health check started ${sources.length} RSS sources`)

  const enabledSources = sources.filter(s => s.enabled)
  const healthResults: RSSSourceHealth[] = []

  for (const source of enabledSources) {
    const health = await checkRSSSourceHealth(source)
    healthResults.push(health)

    await new Promise(resolve => setTimeout(resolve, 500))
  }

  const healthyCount = healthResults.filter(h => h.isHealthy).length
  const unhealthyCount = healthResults.filter(h => !h.isHealthy).length

  logger.info(`[Health check] completed - healthy: ${healthyCount}, unhealthy: ${unhealthyCount}`)

  return {
    totalSources: enabledSources.length,
    healthySources: healthyCount,
    unhealthySources: unhealthyCount,
    sources: healthResults,
  }
}

/**
 * 获取不健康的RSS源
 */
export function getUnhealthySources(): RSSSourceHealth[] {
  return Array.from(sourceHealthStatus.values()).filter(h => !h.isHealthy)
}

/**
 * 获取RSS源健康统计
 */
export function getHealthStats(): {
  total: number
  healthy: number
  unhealthy: number
  averageResponseTime: number
} {
  const statuses = Array.from(sourceHealthStatus.values())
  const healthy = statuses.filter(h => h.isHealthy).length
  const unhealthy = statuses.filter(h => !h.isHealthy).length

  const responseTimes = statuses
    .map(h => h.averageResponseTime)
    .filter((time): time is number => time !== undefined)

  const averageResponseTime = responseTimes.length > 0
    ? Math.round(responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length)
    : 0

  return {
    total: statuses.length,
    healthy,
    unhealthy,
    averageResponseTime,
  }
}

/**
 * 清除RSS源健康状态缓存
 */
export function clearHealthStatusCache(): void {
  sourceHealthStatus.clear()
  logger.info('[Health status cache cleared')
}

/**
 * 验证RSS源URL格式
 */
export function validateRSSURL(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url)

    if (!parsed.protocol.startsWith('http')) {
      return { valid: false, error: 'URL必须使用HTTP或HTTPS协议' }
    }

    if (!parsed.hostname) {
      return { valid: false, error: 'URL缺少主机名' }
    }

    return { valid: true }
  } catch (error) {
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : t('api.news_crawler.无效的URL格式') 
    }
  }
}
