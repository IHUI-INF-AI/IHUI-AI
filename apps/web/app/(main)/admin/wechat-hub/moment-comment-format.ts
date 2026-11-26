// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 朋友圈展示文案纯函数（无 React 依赖，便于单测直连）：评论结构化行、正文折叠截断、
 * 点赞昵称去重。
 *
 * 评论契约：每条输出为「昵称：内容」；昵称缺失回退 wxid，两者都空用「匿名」。
 * refCommentId 能在同组数据里命中对应 commentId 时，前缀升级为
 * 「昵称 回复 被回复者昵称：内容」；找不到被回复条目时退回普通格式，不报错、不拼空昵称。
 * lines 最多 4 条，total 为有效评论总条数；正文换行原样保留，由调用方以
 * whitespace-pre-wrap 在展示层还原，不在结构化阶段吃掉。
 */
import type { WechatMomentCommentView } from '@ihui/types'

/** 卡片评论预览上限；归档面板需要更少条数时在视图层自行截取。 */
const MAX_PREVIEW_LINES = 4
/** 昵称与 wxid 都缺失时的兜底署名。 */
const ANONYMOUS_NAME = '匿名'

/** 兼容运行时脏值：只接受普通对象，null / 数组 / 原始值一律退回 null。 */
function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** 昵称 → wxid → 匿名 的回退链；空白串视为缺失。 */
function displayName(item: Record<string, unknown>): string {
  const nickname = asString(item.nickname).trim()
  if (nickname) return nickname
  const wxid = asString(item.username).trim()
  if (wxid) return wxid
  return ANONYMOUS_NAME
}

/** 评论正文；非字符串按空串处理，换行原样留给展示层。 */
function commentContent(item: Record<string, unknown>): string {
  return asString(item.content)
}

export interface MomentCommentFormatResult {
  /** 最多 MAX_PREVIEW_LINES 条已拼好署名与回复关系的展示行。 */
  lines: string[]
  /** 有效评论总条数，供视图层判断是否需要「等 N 条」超出提示。 */
  total: number
}

/**
 * 把后端返回的 commentsData 整理成可直接渲染的评论行。
 * 入参为空、undefined、元素缺字段或正文空白都不会抛异常，对应条目被剔除；
 * 整组不可用时返回空结果，由调用方决定是否渲染评论区。
 */
export function formatMomentComments(
  commentsData: WechatMomentCommentView[] | null | undefined,
): MomentCommentFormatResult {
  if (!Array.isArray(commentsData)) return { lines: [], total: 0 }

  const entries: Record<string, unknown>[] = []
  for (const raw of commentsData) {
    const record = asRecord(raw)
    if (record === null) continue
    if (commentContent(record).trim().length === 0) continue
    entries.push(record)
  }

  // 被回复条目可能正文为空但仍带署名，索引按整组原始数据建立，避免漏掉回复对象。
  const byCommentId = new Map<string, Record<string, unknown>>()
  for (const raw of commentsData) {
    const record = asRecord(raw)
    if (record === null) continue
    const commentId = asString(record.commentId).trim()
    if (commentId) byCommentId.set(commentId, record)
  }

  const lines = entries.slice(0, MAX_PREVIEW_LINES).map((item) => {
    const from = displayName(item)
    const refCommentId = asString(item.refCommentId).trim()
    if (refCommentId) {
      const target = byCommentId.get(refCommentId)
      if (target) {
        return `${from} 回复 ${displayName(target)}：${commentContent(item)}`
      }
    }
    return `${from}：${commentContent(item)}`
  })

  return { lines, total: entries.length }
}

/** 正文折叠字数上限：超过则先出截断预览，展开后再显示全文。 */
const BODY_PREVIEW_LIMIT = 120

export interface MomentBodyFormatResult {
  /** 截断态展示文本（末尾带省略号）；未超限时为原始正文，换行原样保留。 */
  text: string
  /** 是否超过折叠上限，需要渲染展开/收起按钮。 */
  collapsed: boolean
}

/**
 * 长正文折叠预览：未超上限原样返回；超过则截取前 limit 字并补省略号。
 * 非字符串入参按空串处理；截断只切字符，不在结构化阶段吞掉换行。
 */
export function formatMomentBody(
  content: string | null | undefined,
  limit: number = BODY_PREVIEW_LIMIT,
): MomentBodyFormatResult {
  const raw = typeof content === 'string' ? content : ''
  if (raw.length <= limit) return { text: raw, collapsed: false }
  return { text: `${raw.slice(0, limit)}…`, collapsed: true }
}

/**
 * 点赞昵称去重：先 trim，空串剔除，同一昵称只保留首次出现的顺序。
 * 非数组入参返回空数组，供视图层直接判空渲染。
 */
export function dedupeMomentLikeUsers(
  likeUsers: string[] | null | undefined,
): string[] {
  if (!Array.isArray(likeUsers)) return []
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of likeUsers) {
    const name = typeof raw === 'string' ? raw.trim() : ''
    if (!name || seen.has(name)) continue
    seen.add(name)
    result.push(name)
  }
  return result
}
