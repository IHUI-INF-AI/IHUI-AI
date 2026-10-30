// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 分享问答快照还原(承接 255fa96933 摘除的端内手写页的 `?souce=share` 能力)。
 *
 * 参数名 souce 是被摘页(及其对标源 pages/tools/ai_assistant.vue)的历史拼写,
 * 已扩散的分享链接靠它识别,不得"顺手改正拼写"——改了就接不住旧链接(§12f:
 * 出路必须真跑得通)。新链接同样只产这一形态。
 *
 * 语义 = 带 ?souce=share&question=<编码问题>&content=<编码回答> 进入聊天页时,
 * 把这一问一答直接铺成两条消息(助手回答同批抽媒资),**不请求后端**、
 * 不叠加本机历史恢复/服务端回放(它们会覆盖快照)。
 */
import type { ChatMessage } from '@/api'
import { safeDecodeURIComponent } from '@ihui/shared'
import { applyAnswerMedia, extractAnswerMedia, hasAnyMedia } from './answer-media-extract'

/** 快照链参数名(历史拼写,见头注) */
export const SHARE_SNAPSHOT_PARAM = 'souce'
/** 快照还原的承载页 = AI 聊天页(被摘页路由已让位给智能体列表共享屏) */
const CHAT_PAGE_PATH = '/pkg-ai/ai/chat'

export interface ShareSnapshot {
  question: string
  content: string
}

/** 从路由参数判读分享快照;非快照链或缺 question ⇒ null(不猜,§0.3) */
export function shareSnapshotFromParams(
  params: Record<string, string | undefined> | undefined,
): ShareSnapshot | null {
  if (!params || params[SHARE_SNAPSHOT_PARAM] !== 'share') return null
  const question = params.question
  if (!question) return null
  return {
    question: safeDecodeURIComponent(question),
    content: safeDecodeURIComponent(params.content ?? ''),
  }
}

/** 铺成两条消息(user 问 + assistant 答),回答正文同批抽图/视频/音频 */
export function buildShareSnapshotMessages(snapshot: ShareSnapshot): ChatMessage[] {
  const now = Date.now()
  const userMsg: ChatMessage = { role: 'user', content: snapshot.question, timestamp: now }
  const assistantMsg: ChatMessage = { role: 'assistant', content: snapshot.content, timestamp: now }
  const media = extractAnswerMedia(snapshot.content)
  return [userMsg, hasAnyMedia(media) ? applyAnswerMedia(assistantMsg, media) : assistantMsg]
}

/**
 * 生成分享 path(与被摘页 useShareAppMessage 的产出形态逐字同键:souce/question/content,
 * 值 encodeURIComponent)。回答过长由调用侧不必再裁 —— 微信 path 有上限,
 * 这里保守截断正文到 1000 字并保留问题全文(超出即分享摘要而非全文,方向是多带一次说明)。
 */
export function buildShareSnapshotPath(snapshot: ShareSnapshot): string {
  const cappedContent =
    snapshot.content.length > 1000 ? `${snapshot.content.slice(0, 1000)}…` : snapshot.content
  return `${CHAT_PAGE_PATH}?${SHARE_SNAPSHOT_PARAM}=share&question=${encodeURIComponent(
    snapshot.question,
  )}&content=${encodeURIComponent(cappedContent)}`
}

/**
 * 从消息列表为待分享消息配对快照:assistant 回答 ⇒ 向前找最近的 user 提问;
 * user 提问 ⇒ 只带问题(回答缺席,还原侧 content 为空即一条问句)。
 */
export function shareSnapshotForMessage(
  messages: readonly ChatMessage[],
  msg: ChatMessage | null,
): ShareSnapshot | null {
  if (!msg) return null
  if (msg.role === 'user') {
    return { question: msg.content, content: '' }
  }
  const idx = messages.indexOf(msg)
  let question = ''
  for (let i = (idx >= 0 ? idx : messages.length) - 1; i >= 0; i--) {
    const prev = messages[i]
    if (prev && prev.role === 'user') {
      question = prev.content
      break
    }
  }
  return { question, content: msg.content }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
