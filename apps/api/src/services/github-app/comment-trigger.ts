// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * @机器人 评论触发的解析与派发(D15 / G-20)。
 *
 * GitHub 的 `issue_comment` 事件同时覆盖 issue 与 PR 讨论区,本模块负责三件事:
 * 1. 判定这条评论是否**确实**在呼叫本机器人(排除自建评论、代码块里的假 mention);
 * 2. 把 mention 之后的自然语言归成有限几类请求(白名单,不做自由指令执行);
 * 3. 复用 pr-review 的 diff 与文本模型出口,把结论作为一条回复评论写回。
 *
 * 与 pr-review.ts 一样:出网全部走注入的 `GithubTransport` / `TextCompletion`,零直连。
 */
import { z } from 'zod'

import type { GithubTransport } from './jwt.js'
import {
  fetchPrDiff,
  renderDiffForPrompt,
  type PrCoordinates,
  type PrDiff,
  type TextCompletion,
} from './pr-review.js'

/**
 * 机器人 GitHub 登录名(**显式列举**,不做前缀/模糊匹配)。
 * GitHub 用户名只允许 ASCII,`@智汇AI` 这种中文提及会走 MENTION_LOGINS 的展示名分支。
 */
export const BOT_USERNAMES = ['zhihui-ai', 'ihui-ai-bot', 'ihui-ai', 'ihui'] as const
/** 评论正文里允许出现的中文/展示形态提及名 */
export const BOT_DISPLAY_MENTIONS = ['智汇AI', '智汇ai', 'IHUI AI', 'IHUI-AI'] as const

/** 机器人自己发的评论里带的署名(防自触发死循环) */
export const BOT_COMMENT_SIGNATURE = '> 由 IHUI AI(智汇AI)GitHub App 自动生成'

export interface BotMention {
  /** 命中的提及原文,如 `@ihui-ai-bot` */
  matched: string
  /** 提及所在行剩余的指令文本(已 trim) */
  instruction: string
}

const FENCE_BLOCK_PATTERN = /```[\s\S]*?```/g
const INLINE_CODE_PATTERN = /`[^`\n]*`/g

/** 剥掉代码块与行内代码:代码里的 `@ihui` 是示例,不构成呼叫 */
export function stripCodeSegments(body: string): string {
  return body.replace(FENCE_BLOCK_PATTERN, '').replace(INLINE_CODE_PATTERN, '')
}

function mentionPattern(): RegExp {
  const names = [...BOT_USERNAMES, ...BOT_DISPLAY_MENTIONS]
    .map((name) => name.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&'))
    .join('|')
  return new RegExp(`@(?:${names})(?![\\w.-])`, 'gi')
}

/**
 * 提取机器人提及。
 * 命中多个时取**第一个**(同一条评论只处理一次,避免重复回帖)。
 */
export function extractMention(body: string): BotMention | null {
  if (typeof body !== 'string' || !body.trim()) return null
  const cleaned = stripCodeSegments(body)
  const matched = mentionPattern().exec(cleaned)
  if (!matched) return null

  const mention = matched[0] ?? ''
  const lineStart = cleaned.lastIndexOf('\n', matched.index) + 1
  const lineEnd = cleaned.indexOf('\n', matched.index)
  const line = lineEnd === -1 ? cleaned.slice(lineStart) : cleaned.slice(lineStart, lineEnd)
  const instruction = line.slice(matched.index - lineStart + mention.length).trim()
  return { matched: mention, instruction }
}

/** 归一化后的请求类型(白名单;识别不出的一律按 chat 处理,不执行任何指令) */
export type CommentRequestKind = 'review' | 'explain' | 'risk' | 'chat'

const REVIEW_WORDS = ['review', '评审', '审一下', '看看这个 pr', 'code review']
const EXPLAIN_WORDS = ['解释', '说明', '讲一下', 'explain', '做了什么']
const RISK_WORDS = ['风险', '安全', '漏洞', 'risk', '问题']

function containsAny(haystack: string, needles: readonly string[]): boolean {
  return needles.some((needle) => haystack.includes(needle.toLowerCase()))
}

/** 把自然语言指令归成有限类别 */
export function classifyRequest(instruction: string): CommentRequestKind {
  const text = instruction.toLowerCase()
  if (!text) return 'review'
  if (containsAny(text, RISK_WORDS)) return 'risk'
  if (containsAny(text, EXPLAIN_WORDS)) return 'explain'
  if (containsAny(text, REVIEW_WORDS)) return 'review'
  return 'chat'
}

export type TriggerRejection =
  'not_created_action' | 'not_discussion_on_pr' | 'author_is_bot' | 'self_mention' | 'no_mention'

export type TriggerDecision =
  { handle: true; mention: BotMention } | { handle: false; reason: TriggerRejection }

/**
 * 是否处理这条评论。判定顺序即防御顺序:
 * 只接 `created` → 只接 PR 讨论区 → 排除机器人作者(含自身 `[bot]` 尾巴)→ 要求真有提及。
 */
export function decideCommentTrigger(input: {
  action: string
  commentBody: string
  commenterLogin: string
  isPullRequestDiscussion: boolean
}): TriggerDecision {
  if (input.action !== 'created') return { handle: false, reason: 'not_created_action' }
  if (!input.isPullRequestDiscussion) return { handle: false, reason: 'not_discussion_on_pr' }

  const login = input.commenterLogin.trim().toLowerCase()
  if (!login) return { handle: false, reason: 'author_is_bot' }
  if (login.endsWith('[bot]') || (BOT_USERNAMES as readonly string[]).includes(login)) {
    return { handle: false, reason: 'author_is_bot' }
  }

  const mention = extractMention(input.commentBody)
  if (!mention) return { handle: false, reason: 'no_mention' }
  return { handle: true, mention }
}

// ---------------------------------------------------------------------------
// 回复评论
// ---------------------------------------------------------------------------

const issueCommentsPath = (coord: PrCoordinates): string =>
  `/repos/${coord.owner}/${coord.repo}/issues/${coord.pullNumber}/comments`

const createdCommentSchema = z.object({ id: z.number().int().optional() })

/** GitHub 单条评论内容上限 65536,留余量截断 */
export const MAX_COMMENT_BODY_CHARS = 60_000

export async function postIssueComment(
  transport: GithubTransport,
  coord: PrCoordinates,
  body: string,
): Promise<{ ok: boolean; status: number; commentId: number | null }> {
  const clipped =
    body.length > MAX_COMMENT_BODY_CHARS
      ? `${body.slice(0, MAX_COMMENT_BODY_CHARS)}\n\n…（内容过长已截断）`
      : body
  const response = await transport({
    method: 'POST',
    path: issueCommentsPath(coord),
    headers: {},
    body: { body: `${clipped}\n\n${BOT_COMMENT_SIGNATURE}` },
  })
  const parsed = createdCommentSchema.safeParse(response.body)
  return {
    ok: response.status >= 200 && response.status < 300,
    status: response.status,
    commentId: parsed.success ? (parsed.data.id ?? null) : null,
  }
}

// ---------------------------------------------------------------------------
// 派发
// ---------------------------------------------------------------------------

export const COMMENT_SYSTEM_PROMPT = [
  '你是 IHUI AI(智汇AI)的代码助手,正在 GitHub PR 讨论区回复开发者的提问。',
  '只依据给出的 PR 上下文回答,不得臆造未出现的文件或行号。',
  '用中文 Markdown,结论先行、简洁可执行,不要输出 JSON。',
].join('\n')

export function buildCommentPrompt(input: {
  requestKind: CommentRequestKind
  instruction: string
  prTitle: string
  prNumber: number
  diff: PrDiff | null
}): { system: string; user: string } {
  const asks: Record<CommentRequestKind, string> = {
    review: '请给出这次改动的评审意见(重点:正确性、边界、可维护性)。',
    risk: '请指出这次改动引入的安全与稳定性风险,并给出缓解措施。',
    explain: '请用一段话说明这次改动做了什么、为什么这样做。',
    chat: '请回应开发者的诉求;若诉求超出 diff 可读范围,请明确说明能力边界。',
  }
  return {
    system: COMMENT_SYSTEM_PROMPT,
    user: [
      `PR #${input.prNumber}:${input.prTitle}`,
      `开发者指令:${input.instruction || '(仅提及,未附加文字)'}`,
      asks[input.requestKind],
      '',
      input.diff ? renderDiffForPrompt(input.diff) : '(diff 不可用,请仅就已知信息回应)',
    ].join('\n'),
  }
}

export type CommentTriggerOutcome =
  | { status: 'skipped'; reason: string }
  | { status: 'replied'; commentId: number | null; requestKind: CommentRequestKind }
  | { status: 'failed'; stage: 'diff' | 'model' | 'post'; message: string }

export interface CommentTriggerDeps {
  transport: GithubTransport
  /** null 表示模型未接线 => 明确跳过,不静默 */
  complete: TextCompletion | null
}

/** 处理一条 @机器人 评论:取上下文 → 问模型 → 回帖。diff 取不到仍可继续(降级为无 diff 回答) */
export async function handleIssueComment(
  deps: CommentTriggerDeps,
  input: {
    coordinates: PrCoordinates
    prTitle: string
    instruction: string
    mention: BotMention
    isDraft: boolean
    log?: (level: 'info' | 'warn', message: string, fields?: Record<string, unknown>) => void
  },
): Promise<CommentTriggerOutcome> {
  if (!deps.complete) return { status: 'skipped', reason: 'comment_handler_not_configured' }

  const requestKind = classifyRequest(input.instruction)

  let diff: PrDiff | null = null
  try {
    diff = await fetchPrDiff(deps.transport, input.coordinates)
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误'
    input.log?.('warn', `[github-app] 评论触发的 diff 获取失败,降级为无 diff 回答:${message}`)
    diff = null
  }

  let answer: string
  try {
    answer = await deps.complete(
      buildCommentPrompt({
        requestKind,
        instruction: input.instruction,
        prTitle: input.prTitle,
        prNumber: input.coordinates.pullNumber,
        diff,
      }),
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误'
    input.log?.('warn', `[github-app] ${message}`)
    return { status: 'failed', stage: 'model', message }
  }

  const posted = await postIssueComment(deps.transport, input.coordinates, answer)
  if (!posted.ok) {
    return { status: 'failed', stage: 'post', message: `回帖被拒(status=${posted.status})` }
  }
  return { status: 'replied', commentId: posted.commentId, requestKind }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
