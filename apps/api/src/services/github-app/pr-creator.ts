// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「自动认领并修复」的结果 → 开一个 PR(D30②,无人值守闭环最后一段)。
 *
 * 复用而非另造:
 * - 网络一律走 `jwt.ts` 的 `GithubTransport`(REST 读写方法齐备,含 POST/PATCH),
 *   本模块自身不 import fetch、不写 baseURL、不签 JWT。
 * - 鉴权走 `pr-review.ts` 的 `withInstallationAuth` + `jwt.ts` 的 token 提供器。
 * - 仓库坐标解析走 `events.ts` 的 `splitRepoFullName`。
 *
 * 幂等是本票的核心价值:GitHub 对同一 (head, base) 的重复 open PR 会回 422,
 * 所以这里**先查再建**,并且把 422 也当作"别人已建好"的信号转为更新,而不是失败。
 *
 * 失败面一律收敛为可枚举 outcome + 只带状态码的 message。**绝不**把上游响应体
 * 拼进 error message(AGENTS §5 守门 67:非 2xx 不经 response-sanitizer,
 * 上游 body 可能含 token)。
 */
import { z } from 'zod'

import { splitRepoFullName } from './events.js'
import type { GithubApiRequest, GithubTransport, InstallationTokenProvider } from './jwt.js'
import { withInstallationAuth } from './pr-review.js'

/** 幂等查询的每页条数(同一 head 分支的 open PR 实际只会有一到数个) */
export const OPEN_PR_PER_PAGE = 20

// ---------------------------------------------------------------------------
// 坐标与输入
// ---------------------------------------------------------------------------

/** PR 归属:仓库全名拆出的 owner/repo + 用哪个 installation 的身份去写 */
export interface RepoCoordinates {
  owner: string
  repo: string
  installationId: number
}

/** 组装仓库坐标;仓库名形态不符或安装实例缺失 => null(调用方跳过,不得猜) */
export function toRepoCoordinates(
  repoFullName: string,
  installationId: number | null | undefined,
): RepoCoordinates | null {
  const ownerRepo = splitRepoFullName(repoFullName)
  if (!ownerRepo) return null
  if (installationId === null || installationId === undefined) return null
  if (!Number.isInteger(installationId) || installationId <= 0) return null
  return { owner: ownerRepo.owner, repo: ownerRepo.repo, installationId }
}

/** 一条修复结果(认领侧产出什么形状尚未定,故这里只收 PR 语义必需的最小集) */
export interface FixResultInput {
  /** 源分支(修复分支),仓库内短名,不带 owner: 前缀 */
  headRef: string
  /** 目标分支 */
  baseRef: string
  title: string
  body: string
  /** 本次修复的 commit sha(写进正文尾部,便于人工核对 PR 与提交的对应) */
  commitSha: string
  /** 是否以草稿 PR 开出,默认 false */
  draft?: boolean
  coordinates: RepoCoordinates
}

/** 输入完整性自检;返回可读原因而不是抛,方便调用方直接落日志 */
export function validateFixResult(input: FixResultInput): string | null {
  const required: Array<[string, string]> = [
    ['headRef', input.headRef],
    ['baseRef', input.baseRef],
    ['title', input.title],
    ['commitSha', input.commitSha],
  ]
  for (const [name, value] of required) {
    if (typeof value !== 'string' || value.trim() === '') return `${name} 不可为空`
  }
  if (input.title.trim().length > 256) return 'title 超过 256 字符(GitHub 上限)'
  return null
}

// ---------------------------------------------------------------------------
// 结论形状
// ---------------------------------------------------------------------------

export type PrCreationFailureStage =
  | 'invalid_input'
  | 'invalid_coordinates'
  | 'token_unavailable'
  | 'lookup_rejected'
  | 'create_rejected'
  | 'update_rejected'
  | 'malformed_response'
  | 'transport_error'

export type PrCreationOutcome =
  | {
      status: 'created'
      number: number
      htmlUrl: string
      headRef: string
      baseRef: string
      commitSha: string
    }
  | {
      status: 'updated'
      number: number
      htmlUrl: string
      headRef: string
      baseRef: string
      commitSha: string
      /** true = 建 PR 时被 422 拒、转而取既有 PR 更新(竞态路径) */
      recoveredFromConflict: boolean
    }
  | {
      status: 'failed'
      stage: PrCreationFailureStage
      /** 只含固定文案与状态码,永不含上游响应体 */
      message: string
      upstreamStatus: number | null
    }

function failed(
  stage: PrCreationFailureStage,
  message: string,
  upstreamStatus: number | null = null,
): PrCreationOutcome {
  return { status: 'failed', stage, message, upstreamStatus }
}

// ---------------------------------------------------------------------------
// GitHub 响应形态(只投影需要的字段,不整包搬运)
// ---------------------------------------------------------------------------

const pullSummarySchema = z.object({
  number: z.number().int(),
  /** 缺省时由 `fallbackPrHtmlUrl` 按坐标构造,不因此判失败 */
  html_url: z.string().optional(),
  state: z.string().optional(),
  base: z.object({ ref: z.string() }).optional(),
  head: z.object({ ref: z.string() }).optional(),
})
const pullListSchema = z.array(z.unknown())

type PullSummary = z.infer<typeof pullSummarySchema>

function toPullSummary(body: unknown): PullSummary | null {
  const parsed = pullSummarySchema.safeParse(body)
  return parsed.success ? parsed.data : null
}

/** 把 sha 追加到正文尾部;已有同一 sha 时不重复追加(保证幂等更新的 body 稳定) */
export function renderPrBody(body: string, commitSha: string): string {
  const text = body.trimEnd()
  const marker = commitSha.trim()
  if (!marker || text.includes(marker)) return text
  return text ? `${text}\n\n---\n自动修复提交:${marker}` : `自动修复提交:${marker}`
}

// ---------------------------------------------------------------------------
// REST 路径
// ---------------------------------------------------------------------------

function pullsCollectionPath(coord: RepoCoordinates): string {
  return `/repos/${coord.owner}/${coord.repo}/pulls`
}

function openPrForHeadPath(coord: RepoCoordinates, headRef: string): string {
  const head = `${coord.owner}:${headRef}`
  return `${pullsCollectionPath(coord)}?state=open&head=${encodeURIComponent(head)}&per_page=${OPEN_PR_PER_PAGE}`
}

function singlePrPath(coord: RepoCoordinates, pullNumber: number): string {
  return `${pullsCollectionPath(coord)}/${pullNumber}`
}

function is2xx(status: number): boolean {
  return status >= 200 && status < 300
}

// ---------------------------------------------------------------------------
// 幂等核心:先查 → 有则更新 → 无则创建 → 创建撞 422 再回落到更新
// ---------------------------------------------------------------------------

interface PrCreatorDeps {
  transport: GithubTransport
}

/** 查同一 head 分支上已 open 且 base 匹配的 PR;查不到(null)与查失败(抛)是两回事 */
async function findOpenPr(
  deps: PrCreatorDeps,
  coord: RepoCoordinates,
  headRef: string,
  baseRef: string,
): Promise<
  { kind: 'found'; pull: PullSummary } | { kind: 'none' } | { kind: 'rejected'; status: number }
> {
  const response = await deps.transport({
    method: 'GET',
    path: openPrForHeadPath(coord, headRef),
    headers: {},
  })
  if (!is2xx(response.status)) return { kind: 'rejected', status: response.status }

  const parsed = pullListSchema.safeParse(response.body)
  if (!parsed.success) return { kind: 'rejected', status: response.status }

  for (const item of parsed.data) {
    const pull = toPullSummary(item)
    if (!pull) continue
    // head 已由查询参数过滤,base 必须在这里再核对:同 head 不同 base 属另一条 PR,
    // 猜哪条是"该被更新的"等于替人决定合并目标。
    if ((pull.base?.ref ?? baseRef) === baseRef) return { kind: 'found', pull }
  }
  return { kind: 'none' }
}

async function updatePr(
  deps: PrCreatorDeps,
  coord: RepoCoordinates,
  pullNumber: number,
  input: FixResultInput,
): Promise<{ ok: true; pull: PullSummary } | { ok: false; status: number | null }> {
  const response = await deps.transport({
    method: 'PATCH',
    path: singlePrPath(coord, pullNumber),
    headers: {},
    body: {
      title: input.title.trim(),
      body: renderPrBody(input.body, input.commitSha),
    },
  })
  if (!is2xx(response.status)) return { ok: false, status: response.status }
  const pull = toPullSummary(response.body) ?? { number: pullNumber, html_url: '' }
  return { ok: true, pull }
}

async function createPr(
  deps: PrCreatorDeps,
  coord: RepoCoordinates,
  input: FixResultInput,
): Promise<{ ok: true; pull: PullSummary } | { ok: false; status: number; conflict: boolean }> {
  const response = await deps.transport({
    method: 'POST',
    path: pullsCollectionPath(coord),
    headers: {},
    body: {
      title: input.title.trim(),
      body: renderPrBody(input.body, input.commitSha),
      head: input.headRef.trim(),
      base: input.baseRef.trim(),
      ...(input.draft === undefined ? {} : { draft: input.draft }),
    },
  })
  if (is2xx(response.status)) {
    const pull = toPullSummary(response.body)
    // 2xx 但形态解不出 => 宁判失败也不猜一个号回去
    if (!pull) return { ok: false, status: response.status, conflict: false }
    return { ok: true, pull }
  }
  return { ok: false, status: response.status, conflict: response.status === 422 }
}

/**
 * 让一次修复结果成为 PR:同 (head, base) 已有 open PR 时**更新而非新建**。
 *
 * 不抛穿:任何环节失败都收敛为 `{status:'failed', stage, message}`,
 * 调用方(认领侧 / 定时任务)可以据此决定重试还是喊人。
 */
export async function openPullRequestForFix(
  deps: PrCreatorDeps,
  input: FixResultInput,
): Promise<PrCreationOutcome> {
  const invalid = validateFixResult(input)
  if (invalid) return failed('invalid_input', `修复结果不完整:${invalid}`)

  const coord = input.coordinates
  const headRef = input.headRef.trim()
  const baseRef = input.baseRef.trim()

  const lookup = await findOpenPr(deps, coord, headRef, baseRef)
  if (lookup.kind === 'rejected') {
    return failed(
      'lookup_rejected',
      `查询既有 PR 失败(status=${lookup.status}),不新建以免产生重复 PR`,
      lookup.status,
    )
  }

  if (lookup.kind === 'found') {
    const updated = await updatePr(deps, coord, lookup.pull.number, input)
    if (!updated.ok) {
      return failed(
        'update_rejected',
        `更新既有 PR #${lookup.pull.number} 被拒(status=${updated.status ?? 'unknown'})`,
        updated.status,
      )
    }
    return {
      status: 'updated',
      number: updated.pull.number || lookup.pull.number,
      htmlUrl: updated.pull.html_url || fallbackPrHtmlUrl(coord, lookup.pull.number),
      headRef,
      baseRef,
      commitSha: input.commitSha.trim(),
      recoveredFromConflict: false,
    }
  }

  const created = await createPr(deps, coord, input)
  if (created.ok) {
    return {
      status: 'created',
      number: created.pull.number,
      htmlUrl: created.pull.html_url || fallbackPrHtmlUrl(coord, created.pull.number),
      headRef,
      baseRef,
      commitSha: input.commitSha.trim(),
    }
  }

  // 422 在这里的语义是"已存在同 head/base 的 open PR"(查建之间的竞态),
  // 不是失败:回落去取那条 PR 并更新它。
  if (created.conflict) {
    const retry = await findOpenPr(deps, coord, headRef, baseRef)
    if (retry.kind === 'found') {
      const updated = await updatePr(deps, coord, retry.pull.number, input)
      if (updated.ok) {
        return {
          status: 'updated',
          number: updated.pull.number || retry.pull.number,
          htmlUrl: updated.pull.html_url || fallbackPrHtmlUrl(coord, retry.pull.number),
          headRef,
          baseRef,
          commitSha: input.commitSha.trim(),
          recoveredFromConflict: true,
        }
      }
      return failed(
        'update_rejected',
        `PR 已存在(#${retry.pull.number})但更新被拒(status=${updated.status ?? 'unknown'})`,
        updated.status,
      )
    }
    return failed(
      'create_rejected',
      `创建 PR 被拒(status=422)且回查不到可复用的 open PR,不重复重试`,
      created.status,
    )
  }

  return failed('create_rejected', `创建 PR 失败(status=${created.status})`, created.status)
}

/** 上游没给 html_url 时的兜底构造(纯字符串拼接,不含任何凭据) */
function fallbackPrHtmlUrl(coord: RepoCoordinates, pullNumber: number): string {
  return `https://github.com/${coord.owner}/${coord.repo}/pull/${pullNumber}`
}

// ---------------------------------------------------------------------------
// 运行期装配(唯一需要真凭据的一层;测试不经过这里)
// ---------------------------------------------------------------------------

export interface OpenPullRequestWithIdentityDeps {
  /** 未鉴权的 GitHub transport(`createGithubTransport()` 的产物) */
  transport: GithubTransport
  tokenProvider: InstallationTokenProvider
}

/**
 * 带 installation 鉴权的入口:先取 token(缺凭据在此**早失败**,不发任何写请求),
 * 再把 token 挂到 transport 上走幂等开 PR 流程。
 */
export async function openPullRequestForFixWithInstallation(
  deps: OpenPullRequestWithIdentityDeps,
  input: FixResultInput,
): Promise<PrCreationOutcome> {
  const invalid = validateFixResult(input)
  if (invalid) return failed('invalid_input', `修复结果不完整:${invalid}`)

  const authed = withInstallationAuth(
    deps.transport,
    deps.tokenProvider,
    input.coordinates.installationId,
  )
  const signed: GithubTransport = (request: GithubApiRequest) => authed(request)

  try {
    // provider 有缓存,这次预取不会多打一次 token 接口
    await deps.tokenProvider.get(input.coordinates.installationId)
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误'
    return failed('token_unavailable', `无法取得 GitHub installation 凭据:${message}`)
  }

  return openPullRequestForFix({ transport: signed }, input)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
