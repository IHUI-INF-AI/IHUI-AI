// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).

/**
 * 站内消息详情 —— 跨端唯一的数据投影与纯逻辑(零平台依赖)。
 *
 * 详情不另开接口:通知列表行本身就带全文 `content`(列表页只是用 CSS 截断展示)。
 * 三端各自把行投影成本文件的 `NoticeDetailData`,再用端内壳渲染同一份字段,
 * 避免 Web / RN / 小程序对"标题怎么兜底、深链 id 从哪读"各写一版而漂移。
 */
import type { NoticeDetailData } from '@ihui/types'

/** 通知行(或任意消息列表行)里详情需要的字段;各端字段名不同形,这里一次收口。 */
export interface NoticeDetailSource {
  id: string
  title?: string | null
  content?: string | null
  /** 原始通知类型(system / order / course / comment / follow / automation …) */
  type?: string | null
  /** 视觉严重档(Web 的 NoticeItem.type 就是这一维;RN/小程序拿不到时缺省 info) */
  level?: 'info' | 'success' | 'warning' | 'error'
  createdAt?: string | null
  /** Web 侧栏 / RN 卡片的已读字段 */
  read?: boolean
  /** 服务端通知行的已读字段(REST 用 isRead;WS 用 isRead) */
  isRead?: boolean
  /** 已解析出的深链会话 id(调用方先算好时可直传) */
  sessionId?: string | null
  /** 通知业务载荷(notifications.data jsonb 的透传对象;读不到 sessionId 时用不到) */
  payload?: unknown
}

/** 从通知载荷里读会话深链 id;字段缺失/形态不对一律 null(不制造假入口)。 */
export function readNoticeSessionId(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  const sid = (payload as Record<string, unknown>).sessionId
  return typeof sid === 'string' && sid.length > 0 ? sid : null
}

/** 标题兜底:空标题取正文首行前 40 字,再空就留空由各端按类型文案兜底。 */
function fallbackTitle(content: string): string {
  const firstLine = content.split(/\r?\n/).find((line) => line.trim().length > 0) ?? ''
  return firstLine.trim().slice(0, 40)
}

/**
 * 通知行 → 详情数据。所有三端入口都走这里,不在端内重写兜底规则。
 * 纯函数:不读时钟、不碰 DOM、不发请求。
 */
export function buildNoticeDetail(source: NoticeDetailSource): NoticeDetailData {
  const content = source.content ?? ''
  const title = (source.title ?? '').trim() || fallbackTitle(content)
  return {
    id: source.id,
    title,
    content,
    type: source.type ?? 'system',
    level: source.level ?? 'info',
    createdAt: source.createdAt ?? '',
    read: source.read ?? source.isRead ?? true,
    sessionId: source.sessionId ?? readNoticeSessionId(source.payload),
  }
}

/** 复制到剪贴板的正文本:标题 + 全文;空段不占位。 */
export function noticeDetailCopyText(detail: NoticeDetailData): string {
  const title = detail.title.trim()
  const content = detail.content.trim()
  if (!title) return content
  // 标题是空标题时由正文首行兜底出来的 ⇒ 再拼一次会让复制结果出现两遍正文。
  if (content.startsWith(title)) return content
  return `${title}\n\n${content}`
}

/**
 * 详情里的类型文案 key(各端用同一套 messageCenter.type.* 词条)。
 * 社交互动族(comment/mention/follow/project/automation)统一归「互动」档,
 * 与消息中心四档 tab 的口径一致;未知类型回落系统档。
 */
export function noticeTypeLabelKey(type: string): string {
  if (type === 'order') return 'messageCenter.type.order'
  if (type === 'course') return 'messageCenter.type.course'
  if (
    type === 'comment' ||
    type === 'mention' ||
    type === 'follow' ||
    type === 'project' ||
    type === 'social'
  ) {
    return 'messageCenter.type.social'
  }
  return 'messageCenter.type.system'
}
