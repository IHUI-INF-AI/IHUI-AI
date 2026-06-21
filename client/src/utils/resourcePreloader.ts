/**
 * 资源预加载器
 * 用于预连接和预加载关键资源
 */

import { logger } from './logger'

/**
 * 资源预加载器类
 */
class ResourcePreloader {
  private preconnectedHosts: Set<string> = new Set()
  private prefetchedResources: Set<string> = new Set()

  /**
   * 预连接到指定域名
   * @param url 目标 URL
   * @param crossOrigin 是否跨域
   */
  preconnect(url: string, crossOrigin: boolean = false): void {
    if (typeof window === 'undefined') return
    if (this.preconnectedHosts.has(url)) return

    const link = document.createElement('link')
    link.rel = 'preconnect'
    link.href = url
    if (crossOrigin) {
      link.crossOrigin = 'anonymous'
    }

    document.head.appendChild(link)
    this.preconnectedHosts.add(url)

    logger.debug('[ResourcePreloader] Preconnect:', url)
  }

  /**
   * DNS 预解析
   * @param url 目标 URL
   */
  dnsPrefetch(url: string): void {
    if (typeof window === 'undefined') return
    if (this.preconnectedHosts.has(url)) return

    const link = document.createElement('link')
    link.rel = 'dns-prefetch'
    link.href = url

    document.head.appendChild(link)
    this.preconnectedHosts.add(url)

    logger.debug('[ResourcePreloader] DNS prefetch:', url)
  }

  /**
   * 预加载资源
   * @param url 资源 URL
   * @param as 资源类型
   */
  preload(url: string, as: string): void {
    if (typeof window === 'undefined') return
    if (this.prefetchedResources.has(url)) return

    const link = document.createElement('link')
    link.rel = 'preload'
    link.href = url
    link.as = as

    document.head.appendChild(link)
    this.prefetchedResources.add(url)

    logger.debug('[ResourcePreloader] Preload:', url, 'as', as)
  }

  /**
   * 预获取资源（低优先级）
   * @param url 资源 URL
   */
  prefetch(url: string): void {
    if (typeof window === 'undefined') return
    if (this.prefetchedResources.has(url)) return

    const link = document.createElement('link')
    link.rel = 'prefetch'
    link.href = url

    document.head.appendChild(link)
    this.prefetchedResources.add(url)

    logger.debug('[ResourcePreloader] Prefetch:', url)
  }

  /**
   * 预渲染页面
   * @param url 页面 URL
   */
  prerender(url: string): void {
    if (typeof window === 'undefined') return

    const link = document.createElement('link')
    link.rel = 'prerender'
    link.href = url

    document.head.appendChild(link)

    logger.debug('[ResourcePreloader] Prerender:', url)
  }
}

// 导出单例实例
export const resourcePreloader = new ResourcePreloader()

export default resourcePreloader
