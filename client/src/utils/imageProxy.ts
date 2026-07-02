/**
 * 图片代理工具
 * 用于解决跨域图片加载问题（CORB/ORB错误）
 */

import { logger } from '@/utils/logger'

// 离线/占位模式：默认启用, 所有外部图片走本地占位图, 避免外部服务不可用导致的加载失败
// 关闭方式：VITE_IMAGE_PLACEHOLDER=false
const FORCE_PLACEHOLDER = import.meta.env.VITE_IMAGE_PLACEHOLDER !== 'false'
const PLACEHOLDER_IMAGE = '/images/common/empty.svg'

// 图片代理服务列表（按可靠性排序）
// weserv.nl 是最可靠的图片代理，支持图片格式转换和缓存
const IMAGE_PROXIES = [
  // weserv.nl - 最可靠，支持图片处理参数
  {
    prefix: 'https://images.weserv.nl/?url=',
    encode: true,
    // 添加额外参数确保返回正确的图片格式
    suffix: '&default=1'
  },
  // wsrv.nl - weserv.nl 的备用域名
  {
    prefix: 'https://wsrv.nl/?url=',
    encode: true,
    suffix: '&default=1'
  },
]

let currentProxyIndex = 0

// 已知的允许跨域访问的图片域名（不需要代理）
const CORS_ALLOWED_DOMAINS = [
  'images.unsplash.com',
  'source.unsplash.com',
  'plus.unsplash.com',
  'picsum.photos',
  'via.placeholder.com',
  'placehold.co',
  'dummyimage.com',
  'placekitten.com',
  'loremflickr.com',
  // CDN 服务通常支持 CORS
  'cdn.jsdelivr.net',
  'cdnjs.cloudflare.com',
  'unpkg.com',
]

/**
 * 检查域名是否允许跨域访问
 */
function isCorsAllowedDomain(url: string): boolean {
  try {
    const urlObj = new URL(url)
    return CORS_ALLOWED_DOMAINS.some(domain => urlObj.hostname.includes(domain))
  } catch {
    return false
  }
}

/**
 * 获取图片代理URL
 * @param imageUrl 原始图片URL
 * @param forceProxy 强制使用代理（即使域名在白名单中）
 * @returns 代理后的图片URL
 */
export function getProxiedImageUrl(imageUrl: string, forceProxy: boolean = false): string {
  if (!imageUrl) {
    return imageUrl
  }

  // 占位模式：所有外部图片直接返回本地默认图
  if (FORCE_PLACEHOLDER && /^https?:\/\//.test(imageUrl)) {
    return PLACEHOLDER_IMAGE
  }

  // 如果是相对路径，不需要代理
  if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
    return imageUrl
  }

  // 如果是 data URL，不需要代理
  if (imageUrl.startsWith('data:')) {
    return imageUrl
  }

  // 如果是 blob URL，不需要代理
  if (imageUrl.startsWith('blob:')) {
    return imageUrl
  }

  // 检查是否是本地图片
  if (typeof window !== 'undefined') {
    if (imageUrl.startsWith(window.location.origin) || imageUrl.startsWith('/')) {
      return imageUrl
    }
  }

  // 如果域名在白名单中且不强制代理，直接返回
  // 注意：即使域名在白名单中，如果强制代理也使用代理（解决ORB问题）
  if (!forceProxy && isCorsAllowedDomain(imageUrl)) {
    return imageUrl
  }

  // 使用代理
  const proxyConfig = IMAGE_PROXIES[currentProxyIndex]
  const encodedUrl = proxyConfig.encode ? encodeURIComponent(imageUrl) : imageUrl
  return proxyConfig.prefix + encodedUrl + (proxyConfig.suffix || '')
}

/**
 * 切换到下一个代理
 */
export function switchImageProxy(): void {
  currentProxyIndex = (currentProxyIndex + 1) % IMAGE_PROXIES.length
  logger.info(`[ImageProxy] Switched to proxy: ${currentProxyIndex + 1}/${IMAGE_PROXIES.length}`)
}
