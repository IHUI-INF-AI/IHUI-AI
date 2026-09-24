// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * GitHub App 自动 PR review 编排(D15 / G-20):取 diff → 交 LLM → 回写 review。
 *
 * 两个注入点把"会出网的部分"隔在外面,使本模块可被完全离线单测:
 * - `GithubTransport`(pr-review.ts 只认接口,不认 fetch)
 * - `TextCompletion`(LLM 原语;review 结构只是它输出的一段 JSON)
 *
 * 失败面一律收敛为可枚举的 outcome,**不抛穿到路由**(抛穿会变成 500,GitHub 会持续重投)。
 */
import { z } from 'zod'

import type { GithubApiRequest, GithubTransport, InstallationTokenProvider } from './jwt.js'
import { splitRepoFullName } from './events.js'

/** 单次最多拉取的改动文件数(GitHub 分页上限 100) */
export const MAX_REVIEW_FILES = 100
/** 单文件 patch 送入模型前的截断长度(防超大 PR 打爆上下文) */
export const MAX_PATCH_CHARS_PER_FILE = 4000
/** 整份 diff 的总预算 */
export const MAX_DIFF_TOTAL_CHARS = 40_000

// ---------------------------------------------------------------------------
// 坐标
// ---------------------------------------------------------------------------

export interface PrCoordinates {
  owner: string
  repo: string
  pullNumber: number
  installationId: number
}

/** 组装 PR 坐标;repoFullName 形态不符或安装实例缺失 => null(调用方跳过,不得猜) */
export function toPrCoordinates(
  repoFullName: string,
  pullNumber: number,
  installationId: number | null,
): PrCoordinates | null {
  const ownerRepo = splitRepoFullName(repoFullName)
  if (!ownerRepo) return null
  if (!Number.isInteger(pullNumber) || pullNumber <= 0) return null
  if (installationId === null || !Number.isInteger(installationId) || installationId <= 0) {
    return null
  }
  return { owner: ownerRepo.owner, repo: ownerRepo.repo, pullNumber, installationId }
}

function filesPath(coord: PrCoordinates): string {
  return `/repos/${coord.owner}/${coord.repo}/pulls/${coord.pullNumber}/files?per_page=${MAX_REVIEW_FILES}`
}

function reviewsPath(coord: PrCoordinates): string {
  return `/repos/${coord.owner}/${coord.repo}/pulls/${coord.pullNumber}/reviews`
}

/** 给 transport 自动挂上 installation token 的包装器 */
export function withInstallationAuth(
  transport: GithubTransport,
  provider: InstallationTokenProvider,
  installationId: number,
): GithubTransport {
  return async (request: GithubApiRequest) => {
    const { token } = await provider.get(installationId)
    return transport({
      ...request,
      headers: { ...request.headers, Authorization: `Bearer ${token}` },
    })
  }
}

// ---------------------------------------------------------------------------
// diff 获取
// ---------------------------------------------------------------------------

export interface PrFileChange {
  filename: string
  status: string
  additions: number
  deletions: number
  changes: number
  patch: string | null
}

export interface PrDiff {
  files: PrFileChange[]
  additions: number
  deletions: number
  /** 因文件数或字符预算被裁掉时为 true(模型须知,避免它以为看到了全貌) */
  truncated: boolean
}

const prFileSchema = z.object({
  filename: z.string(),
  status: z.string().default('modified'),
  additions: z.number().int().nonnegative().default(0),
  deletions: z.number().int().nonnegative().default(0),
  changes: z.number().int().nonnegative().default(0),
  patch: z.string().optional(),
})
const prFilesSchema = z.array(prFileSchema)

/**
 * 拉取 PR 改动文件与 patch。
 * 响应形态不符 => 抛错(由 runPrReview 收敛为 stage='diff'),不带上游内容。
 */
export async function fetchPrDiff(
  transport: GithubTransport,
  coord: PrCoordinates,
  limits: { maxFiles?: number; maxPatchChars?: number; maxTotalChars?: number } = {},
): Promise<PrDiff> {
  const response = await transport({
    method: 'GET',
    path: filesPath(coord),
    headers: {},
  })
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`拉取 PR diff 失败(status=${response.status})`)
  }
  const parsed = prFilesSchema.safeParse(response.body)
  if (!parsed.success) {
    throw new Error('拉取 PR diff 失败(响应形态不符)')
  }

  const maxFiles = Math.min(limits.maxFiles ?? MAX_REVIEW_FILES, MAX_REVIEW_FILES)
  const maxPatchChars = limits.maxPatchChars ?? MAX_PATCH_CHARS_PER_FILE
  const maxTotalChars = limits.maxTotalChars ?? MAX_DIFF_TOTAL_CHARS

  const files: PrFileChange[] = []
  let budget = maxTotalChars
  let truncated = parsed.data.length > maxFiles

  for (const item of parsed.data.slice(0, maxFiles)) {
    let patch = item.patch ?? null
    if (patch && patch.length > maxPatchChars) {
      patch = `${patch.slice(0, maxPatchChars)}\n…(patch 已截断)`
      truncated = true
    }
    if (patch && patch.length > budget) {
      patch = `${patch.slice(0, Math.max(budget, 0))}\n…(diff 预算已用尽,后续文件省略)`
      truncated = true
    }
    budget -= patch?.length ?? 0
    files.push({
      filename: item.filename,
      status: item.status,
      additions: item.additions,
      deletions: item.deletions,
      changes: item.changes,
      patch,
    })
    if (budget <= 0) {
      truncated = true
      break
    }
  }

  return {
    files,
    additions: files.reduce((sum, file) => sum + file.additions, 0),
    deletions: files.reduce((sum, file) => sum + file.deletions, 0),
    truncated,
  }
}

// ---------------------------------------------------------------------------
// 提示词与模型输出
// ---------------------------------------------------------------------------

export interface ReviewPrompt {
  system: string
  user: string
}

export type ReviewFindingLevel = 'COMMENT' | 'WARNING' | 'CRITICAL'

export interface ReviewFinding {
  path: string
  line: number
  level: ReviewFindingLevel
  body: string
}

export interface ReviewDraft {
  event: 'APPROVE' | 'COMMENT' | 'REQUEST_CHANGES'
  body: string
  comments: ReviewFinding[]
  /** true 表示模型没给出可解析的结构化结果,body 是其原文 */
  degraded: boolean
}

/** LLM 原语:给一段提示词,回一段文本。review / 评论回复共用这一条出口 */
export type TextCompletion = (prompt: ReviewPrompt) => Promise<string>

/** 把 diff 渲染成给模型看的文本块 */
export function renderDiffForPrompt(diff: PrDiff): string {
  if (diff.files.length === 0) return '(无改动文件)'
  return diff.files
    .map((file) => {
      const header = `### ${file.filename} [${file.status}] +${file.additions}/-${file.deletions}`
      return file.patch
        ? `${header}\n\`\`\`diff\n${file.patch}\n\`\`\``
        : `${header}\n(无 patch 内容)`
    })
    .join('\n\n')
}

export const REVIEW_SYSTEM_PROMPT = [
  '你是 IHUI AI(智汇AI)的代码评审助手。',
  '只依据给出的 diff 评审,不得臆造未在 diff 中出现的文件或行号。',
  '输出**严格 JSON**,不要输出解释性前后缀、不要包裹 markdown 代码块:',
  '{"event":"APPROVE|COMMENT|REQUEST_CHANGES","body":"总体结论(中文,<=200字)",',
  '"comments":[{"path":"文件路径","line":行号,"level":"COMMENT|WARNING|CRITICAL","body":"问题说明与修改建议"}]}',
  '没有问题时 comments 为空数组、event 用 APPROVE。',
].join('\n')

/** 组装 review 提示词 */
export function buildReviewPrompt(input: {
  title: string
  description?: string | null
  baseRef: string
  headRef: string
  diff: PrDiff
}): ReviewPrompt {
  const user = [
    `PR 标题:${input.title}`,
    `分支:${input.baseRef} ← ${input.headRef}`,
    `改动:${input.diff.files.length} 个文件,+${input.diff.additions}/-${input.diff.deletions}${
      input.diff.truncated ? '(diff 已被截断,结论需注明覆盖面不完整)' : ''
    }`,
    `描述:${(input.description ?? '').trim() || '(无)'}`,
    '',
    renderDiffForPrompt(input.diff),
  ].join('\n')
  return { system: REVIEW_SYSTEM_PROMPT, user }
}

const FENCE_PATTERN = /```(?:json)?\s*([\s\S]*?)```/i
const reviewDraftSchema = z.object({
  event: z.enum(['APPROVE', 'COMMENT', 'REQUEST_CHANGES']).default('COMMENT'),
  body: z.string().default(''),
  comments: z
    .array(
      z.object({
        path: z.string(),
        line: z.number().int().positive(),
        level: z.enum(['COMMENT', 'WARNING', 'CRITICAL']).default('COMMENT'),
        body: z.string(),
      }),
    )
    .default([]),
})

/**
 * 容错解析模型输出:优先 JSON(允许被 ``` 包裹),解不出来时降级为
 * COMMENT + 原文 body —— 宁可给出不可定位的评论,也不让整轮 review 静默消失。
 */
export function parseReviewDraft(text: string): ReviewDraft {
  const candidates: string[] = []
  const trimmed = text.trim()
  const fenced = trimmed.match(FENCE_PATTERN)
  if (fenced?.[1]) candidates.push(fenced[1].trim())
  candidates.push(trimmed)

  for (const candidate of candidates) {
    let json: unknown
    try {
      json = JSON.parse(candidate) as unknown
    } catch {
      continue
    }
    const parsed = reviewDraftSchema.safeParse(json)
    if (parsed.success) {
      return {
        event: parsed.data.event,
        body: parsed.data.body || '（无总体结论）',
        comments: parsed.data.comments.map((item) => ({
          path: item.path,
          line: item.line,
          level: item.level,
          body: item.body,
        })),
        degraded: false,
      }
    }
  }

  return {
    event: 'COMMENT',
    body: trimmed || '（模型未返回内容）',
    comments: [],
    degraded: true,
  }
}

/** review 模型 = 文本模型 + 结构化解析 */
export type ReviewModel = (prompt: ReviewPrompt) => Promise<ReviewDraft>

export function createReviewModelFromText(complete: TextCompletion): ReviewModel {
  return async (prompt) => parseReviewDraft(await complete(prompt))
}

// ---------------------------------------------------------------------------
// 接项目内 ai-service 的文本模型(唯一出网点,经注入的 call 隔离)
// ---------------------------------------------------------------------------

export interface LlmResponseLike {
  ok: boolean
  status: number
  json: () => Promise<unknown>
}

export interface AiServiceCall {
  (
    path: string,
    init: { method: 'POST'; headers: Record<string, string>; body: string },
  ): Promise<LlmResponseLike>
}

const llmCompleteResponseSchema = z.object({
  content: z.string().optional(),
  error: z.boolean().optional(),
  error_message: z.string().optional(),
})

export const LLM_COMPLETE_PATH = '/api/llm/complete'

/**
 * 用 ai-service `/api/llm/complete` 实现文本模型。
 * `call` 由外部注入(运行期是 aiServiceFetch,测试里是假实现),本模块不直接 import fetch。
 */
export function createAiServiceTextModel(deps: {
  call: AiServiceCall
  temperature?: number
}): TextCompletion {
  return async (prompt) => {
    const response = await deps.call(LLM_COMPLETE_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ],
        ...(deps.temperature === undefined ? {} : { temperature: deps.temperature }),
      }),
    })
    if (!response.ok) {
      // 只带状态码,绝不把上游响应体拼进 message(守门 67:非 2xx 不经 response-sanitizer)
      throw new Error(`ai-service /llm/complete 调用失败(status=${response.status})`)
    }
    const parsed = llmCompleteResponseSchema.safeParse(await response.json())
    if (!parsed.success) throw new Error('ai-service /llm/complete 响应形态不符')
    if (parsed.data.error) {
      throw new Error(
        `ai-service /llm/complete 返回错误(${parsed.data.error_message ?? 'unknown'})`,
      )
    }
    const content = parsed.data.content
    if (!content) throw new Error('ai-service /llm/complete 返回空内容')
    return content
  }
}

// ---------------------------------------------------------------------------
// 回写 review
// ---------------------------------------------------------------------------

export interface SubmitReviewResult {
  status: number
  reviewId: number | null
  ok: boolean
}

async function postReview(
  transport: GithubTransport,
  coord: PrCoordinates,
  payload: Record<string, unknown>,
): Promise<SubmitReviewResult> {
  const response = await transport({
    method: 'POST',
    path: reviewsPath(coord),
    headers: {},
    body: payload,
  })
  const parsed = z.object({ id: z.number().int().optional() }).safeParse(response.body)
  return {
    status: response.status,
    reviewId: parsed.success ? (parsed.data.id ?? null) : null,
    ok: response.status >= 200 && response.status < 300,
  }
}

/**
 * 提交 review。
 *
 * 行级评论要求 line 落在 diff 的 hunk 内,模型给出的行号越界会被 GitHub 拒成 422。
 * 这里对 422 做一次**只保留总体结论**的降级重试:宁可少给逐行意见,也不整轮静默失败。
 */
export async function submitPrReview(
  transport: GithubTransport,
  coord: PrCoordinates,
  draft: ReviewDraft,
  commitSha: string,
): Promise<SubmitReviewResult & { degraded: boolean }> {
  const comments = draft.comments.map((finding) => ({
    path: finding.path,
    line: finding.line,
    side: 'RIGHT' as const,
    body: `[${finding.level}] ${finding.body}`,
  }))

  const first = await postReview(
    transport,
    coord,
    comments.length > 0
      ? { commit_id: commitSha, body: draft.body, event: draft.event, comments }
      : { commit_id: commitSha, body: draft.body, event: draft.event },
  )
  if (first.ok || first.status !== 422) return { ...first, degraded: false }

  const fallback = await postReview(transport, coord, {
    commit_id: commitSha,
    body: `${draft.body}\n\n> 逐行评论因超出 diff 范围被 GitHub 拒收,本轮仅提交总体结论。`,
    event: 'COMMENT',
  })
  return { ...fallback, degraded: true }
}

// ---------------------------------------------------------------------------
// 编排
// ---------------------------------------------------------------------------

export type PrReviewStage = 'diff' | 'model' | 'submit'

export type PrReviewOutcome =
  | { status: 'skipped'; reason: string }
  | { status: 'posted'; reviewId: number | null; findings: number; degraded: boolean }
  | { status: 'failed'; stage: PrReviewStage; message: string }

export interface PrReviewDeps {
  transport: GithubTransport
  /** null 表示模型未接线 —— 明确跳过,不得假装成功 */
  reviewModel: ((prompt: ReviewPrompt) => Promise<ReviewDraft>) | null
}

export interface PrReviewInput {
  title: string
  description?: string | null
  baseRef: string
  headRef: string
  commitSha: string
  coordinates: PrCoordinates
  isDraft: boolean
  log?: (level: 'info' | 'warn', message: string, fields?: Record<string, unknown>) => void
}

/** 一轮自动 review:取 diff → 出结论 → 回写。任一环节失败都收敛为 outcome */
export async function runPrReview(
  deps: PrReviewDeps,
  input: PrReviewInput,
): Promise<PrReviewOutcome> {
  if (input.isDraft) return { status: 'skipped', reason: 'pull_request_is_draft' }
  if (!deps.reviewModel) return { status: 'skipped', reason: 'review_model_not_configured' }

  let diff: PrDiff
  try {
    diff = await fetchPrDiff(deps.transport, input.coordinates)
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误'
    input.log?.('warn', `[github-app] ${message}`)
    return { status: 'failed', stage: 'diff', message }
  }
  if (diff.files.length === 0) return { status: 'skipped', reason: 'no_changed_files' }

  let draft: ReviewDraft
  try {
    draft = await deps.reviewModel(
      buildReviewPrompt({
        title: input.title,
        description: input.description,
        baseRef: input.baseRef,
        headRef: input.headRef,
        diff,
      }),
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误'
    input.log?.('warn', `[github-app] ${message}`)
    return { status: 'failed', stage: 'model', message }
  }

  // 拦掉模型臆造的路径:diff 里没有的文件名不可能挂上行级评论
  const known = new Set(diff.files.map((file) => file.filename))
  const grounded: ReviewDraft = {
    ...draft,
    comments: draft.comments.filter((finding) => known.has(finding.path)),
  }

  try {
    const submitted = await submitPrReview(
      deps.transport,
      input.coordinates,
      grounded,
      input.commitSha,
    )
    if (!submitted.ok) {
      return {
        status: 'failed',
        stage: 'submit',
        message: `提交 review 被拒(status=${submitted.status})`,
      }
    }
    return {
      status: 'posted',
      reviewId: submitted.reviewId,
      findings: grounded.comments.length,
      degraded: submitted.degraded || draft.degraded,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误'
    return { status: 'failed', stage: 'submit', message }
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
