import Taro from '@tarojs/taro'
import { get } from './request'
import { logger } from './logger'

/** 后端返回的推送模板结构 */
interface PushTemplate {
  id: string
  code: string
  title: string
  variables: unknown
}

interface PushTemplateList {
  list: PushTemplate[]
  total: number
}

/** 运行时缓存的模板 ID 列表(从后端拉取) */
let cachedTmplIds: string[] = []
let fetchedAt = 0
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 分钟缓存,避免每次启动都拉取

/**
 * 拉取当前可订阅的推送模板 ID 列表(带缓存)。
 * 微信小程序订阅消息机制:每个模板需用户单独授权,这里返回所有启用模板的 ID。
 */
export async function fetchPushTemplates(): Promise<string[]> {
  if (Date.now() - fetchedAt < CACHE_TTL_MS && cachedTmplIds.length > 0) {
    return cachedTmplIds
  }
  try {
    const res = await get<PushTemplateList>('/push/templates')
    if (res && Array.isArray(res.list)) {
      cachedTmplIds = res.list.map((t) => t.id).filter((id): id is string => typeof id === 'string')
      fetchedAt = Date.now()
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    logger.warn('push-init', 'fetch-templates-fail', msg || 'unknown')
  }
  return cachedTmplIds
}

/**
 * 启动时静默拉取推送模板 ID 列表(异步,不阻塞启动)。
 * 微信小程序不允许冷启动自动弹订阅,需由用户主动点击触发。
 * 此函数仅预热缓存,实际请求由业务页面按钮触发。
 */
export function initPushSubscription(): void {
  void fetchPushTemplates()
    .then((ids) => {
      if (ids.length === 0) {
        logger.info('push-init', 'no-templates', '未配置推送模板,跳过')
        return
      }
      logger.info('push-init', 'ready', `已加载 ${ids.length} 个推送模板,等待用户触发`)
    })
    .catch(() => {})
}

/**
 * 主动请求订阅(由业务按钮调用,如"开启消息通知")。
 * 返回 true 表示用户至少同意了一个模板。
 */
export async function requestPushSubscription(): Promise<boolean> {
  const tmplIds = await fetchPushTemplates()
  if (tmplIds.length === 0) return false
  try {
    const res = await new Promise<Record<string, string>>((resolve, reject) => {
      Taro.requestSubscribeMessage({
        tmplIds,
        success: (s) => resolve(s as Record<string, string>),
        fail: (e) => reject(e),
      } as Taro.requestSubscribeMessage.Option)
    })
    return tmplIds.some((id) => res[id] === 'accept')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    logger.warn('push-init', 'subscribe-fail', msg || 'unknown')
    return false
  }
}
