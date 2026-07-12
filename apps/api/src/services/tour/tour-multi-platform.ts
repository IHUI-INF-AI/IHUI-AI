/**
 * 旅游多平台分发服务。
 *
 * 将已发布的旅游内容分发到多个外部平台（公众号 / 小红书 / 抖音 / 微博 等）。
 *
 * 流程：
 * 1. 内容发布事件触发 → publishTourEvent('content.published', {...})
 * 2. tour-event-bus worker 拉取事件 → 调用 MultiPlatformDistributor
 * 3. 各平台 adapter 异步分发，失败重试由 event-bus 统一处理
 */

import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { tourContent } from '@ihui/database'
import { processEvents, type TourEvent, type TourEventDispatcher } from './tour-event-bus.js'
import { logger } from '../../utils/logger.js'

export type Platform = 'wechat_oa' | 'xiaohongshu' | 'douyin' | 'weibo' | 'web' | 'miniapp'

export interface PlatformAdapter {
  platform: Platform
  enabled: boolean
  distribute(content: {
    id: string
    title: string
    summary: string | null
    coverImage: string | null
    content: string
  }): Promise<{ ok: boolean; externalId?: string; error?: string }>
}

/** 已注册的平台适配器。 */
const adapters = new Map<Platform, PlatformAdapter>()

/** 注册平台适配器。 */
export function registerAdapter(adapter: PlatformAdapter): void {
  adapters.set(adapter.platform, adapter)
}

/** 列出所有已注册适配器。 */
export function listAdapters(): PlatformAdapter[] {
  return Array.from(adapters.values())
}

/** 多平台分发器：将 tour 事件分发到所有启用的平台适配器。 */
export const multiPlatformDispatcher: TourEventDispatcher = {
  async dispatch(event: TourEvent) {
    if (event.type !== 'content.published') return
    const payload = event.payload as { contentId?: string }
    if (!payload?.contentId) return

    const [content] = await db
      .select()
      .from(tourContent)
      .where(eq(tourContent.id, payload.contentId))
    if (!content) {
      logger.warn(`[tour-multi-platform] content ${payload.contentId} not found`)
      return
    }

    const failures: string[] = []
    for (const adapter of adapters.values()) {
      if (!adapter.enabled) continue
      try {
        const result = await adapter.distribute({
          id: content.id,
          title: content.title,
          summary: content.summary,
          coverImage: content.coverImage,
          content: content.content,
        })
        if (!result.ok) {
          failures.push(`${adapter.platform}: ${result.error ?? 'unknown'}`)
        }
      } catch (err) {
        failures.push(`${adapter.platform}: ${(err as Error).message}`)
      }
    }

    if (failures.length > 0) {
      throw new Error(`部分平台分发失败: ${failures.join('; ')}`)
    }
  },
}

/** 触发一次内容分发（写入事件 + 立即处理一次）。 */
export async function distributeContent(contentId: string): Promise<void> {
  const { publish } = await import('./tour-event-bus.js')
  await publish({ type: 'content.published', payload: { contentId } })
  await processEvents(multiPlatformDispatcher, { batchSize: 10 })
}

/** 控制台占位适配器（开发期使用）。 */
export const consoleAdapter: PlatformAdapter = {
  platform: 'web',
  enabled: true,
  async distribute(content) {
    console.log(`[tour-multi-platform] distribute to web: ${content.title}`)
    return { ok: true, externalId: `web-${content.id}` }
  },
}
