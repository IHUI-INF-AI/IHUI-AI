// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 变更请求台账服务(F-Forge,2026-11-13 立)
 *
 * 对标 DSH `dsh-experimental-forge`(provider-neutral 变更请求注册表)+
 * `dsh-experimental-forge-github`(GitHub provider)。与既有 `git/status` 的差异:
 *  - `git/status` 只回答「**当前分支**有没有一条 PR」,不看仓库里其他进行中的变更请求;
 *  - 本服务一次拉全(默认 open),并给出四态、当前分支命中、CI 聚合;
 *  - provider 维度显式建模:`supported=false` 必须带**如实原因**,禁止把「平台没适配器」
 *    渲染成「没有变更请求」。
 *
 * 数据面纪律:
 *  - 依赖注入(deps),单测不碰网络也不跑 git;
 *  - CI 六态/聚合复用 `@ihui/shared/chat`,本文件不另写判定;
 *  - 单条 CI 拉取失败只让该条 `checks=null`,不拖垮整张表;列表失败必须 `fetchFailed=true`
 *    (与「查到 0 条」严格区分);
 *  - 条数上限与 CI 拉取上限取 `CHANGE_REQUEST_LIMITS`(契约层单一真相源)。
 */

import { deriveChecksSummary, type CiCheck } from '@ihui/shared/chat'
import type {
  ChangeRequestChecks,
  ChangeRequestItem,
  ChangeRequestProvider,
  ChangeRequestSnapshot,
  ChangeRequestState,
  ChangeRequestUnsupportedReason,
} from '@ihui/types'
import { CHANGE_REQUEST_LIMITS, githubCheckRunState } from '@ihui/types'

export interface ChangeRequestDeps {
  /** 工作区首个 remote URL(无 remote 时 null) */
  readRemoteUrl: () => Promise<string | null>
  /** 从工作区解析 owner/repo(仅 GitHub 有实现;其他平台返回 null) */
  detectRepo: () => Promise<{ owner: string; repo: string } | null>
  /** 读当前分支与默认分支 */
  readBranches: () => Promise<{ currentBranch: string | null; defaultBranch: string | null }>
  /** 本机是否已配置 GitHub 凭据(字段名刻意不含 token 子串) */
  hasCredentials: () => boolean
  /** 列进行中的 PR(GitHub REST `/pulls?state=open`) */
  listPullRequests: (repo: { owner: string; repo: string }) => Promise<unknown>
  /** 列某 commit 的 check-runs(GitHub REST `/commits/{ref}/check-runs`) */
  listCheckRuns: (params: { owner: string; repo: string; ref: string }) => Promise<unknown>
}

/** remote URL → 托管平台(纯函数,单测直接覆盖) */
export function detectChangeRequestProvider(remoteUrl: string | null | undefined): ChangeRequestProvider {
  const url = (remoteUrl ?? '').trim().toLowerCase()
  if (!url) return 'other'
  if (url.includes('github.com')) return 'github'
  if (url.includes('gitee.com')) return 'gitee'
  if (url.includes('gitlab')) return 'gitlab'
  return 'other'
}

/** GitHub PR 四态归并(merged > closed > draft > open;顺序反了会把已合并显示成 open) */
export function resolvePullRequestState(raw: {
  state?: unknown
  draft?: unknown
  merged_at?: unknown
}): ChangeRequestState {
  if (typeof raw.merged_at === 'string' && raw.merged_at.length > 0) return 'merged'
  if (raw.state === 'closed') return 'closed'
  if (raw.draft === true) return 'draft'
  return 'open'
}

/** GitHub check-runs 响应 → CiCheck[](认不出的字段不编造,交由共享层归 unknown) */
export function mapGithubCheckRuns(raw: unknown): CiCheck[] {
  const runs =
    raw && typeof raw === 'object' && Array.isArray((raw as { check_runs?: unknown }).check_runs)
      ? ((raw as { check_runs: unknown[] }).check_runs ?? [])
      : []
  const out: CiCheck[] = []
  for (const run of runs) {
    if (!run || typeof run !== 'object') continue
    const row = run as Record<string, unknown>
    const name = typeof row.name === 'string' ? row.name : null
    if (!name) continue
    const state = githubCheckRunState(
      typeof row.status === 'string' ? row.status : null,
      typeof row.conclusion === 'string' ? row.conclusion : null,
    )
    const url = typeof row.html_url === 'string' ? row.html_url : undefined
    out.push(url ? { name, state, url } : { name, state })
  }
  return out
}

/** CiCheck[] → 面板用的 checks 汇总(passed/failed/total + 聚合态) */
function summarizeChecks(checks: readonly CiCheck[]): ChangeRequestChecks {
  let passed = 0
  let failed = 0
  for (const check of checks) {
    if (check.state === 'passed') passed += 1
    if (check.state === 'failed') failed += 1
  }
  return {
    summary: deriveChecksSummary(checks),
    passed,
    failed,
    total: checks.length,
  }
}

/** 单个原始 PR → 行(字段缺失一律降级为 null/false,不抛错) */
function mapPullRequest(
  raw: unknown,
  currentBranch: string | null,
): (ChangeRequestItem & { headSha: string | null }) | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const number = typeof row.number === 'number' ? row.number : null
  const url = typeof row.html_url === 'string' ? row.html_url : null
  if (number === null || !url) return null
  const head = row.head && typeof row.head === 'object' ? (row.head as Record<string, unknown>) : {}
  const base = row.base && typeof row.base === 'object' ? (row.base as Record<string, unknown>) : {}
  const user = row.user && typeof row.user === 'object' ? (row.user as Record<string, unknown>) : {}
  const headBranch = typeof head.ref === 'string' ? head.ref : null
  const state = resolvePullRequestState(row)
  return {
    number,
    title: typeof row.title === 'string' ? row.title : '',
    url,
    state,
    draft: state === 'draft',
    author: typeof user.login === 'string' ? user.login : null,
    headBranch,
    baseBranch: typeof base.ref === 'string' ? base.ref : null,
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null,
    isCurrentBranch: headBranch !== null && currentBranch !== null && headBranch === currentBranch,
    checks: null,
    headSha: typeof head.sha === 'string' ? head.sha : null,
  }
}

function emptySnapshot(
  provider: ChangeRequestProvider,
  fetchedAt: string,
): ChangeRequestSnapshot {
  return {
    provider,
    supported: provider === 'github',
    unsupportedReason: null,
    repo: null,
    currentBranch: null,
    defaultBranch: null,
    credentialsReady: false,
    fetchFailed: false,
    items: [],
    fetchedAt,
  }
}

async function safe<T>(fn: () => Promise<T>, fallback: T, onError?: (e: unknown) => void): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    onError?.(e)
    return fallback
  }
}

/**
 * 构建一次变更请求快照。
 *
 * 分支顺序(全部短路,绝不越权谎报):
 *   无 remote → no-remote;平台非 github → provider-unsupported;
 *   无凭据 → credentials-missing(仍 supported=true,前端给「连接 GitHub」);
 *   列表失败 → fetchFailed=true + items=[];成功但 0 条 → fetchFailed=false + items=[]。
 */
export async function buildChangeRequestSnapshot(
  deps: ChangeRequestDeps,
): Promise<ChangeRequestSnapshot> {
  const fetchedAt = new Date().toISOString()
  const remoteUrl = await safe(() => deps.readRemoteUrl(), null)
  const provider = detectChangeRequestProvider(remoteUrl)
  const branches = await safe(() => deps.readBranches(), {
    currentBranch: null as string | null,
    defaultBranch: null as string | null,
  })

  if (!remoteUrl) {
    return {
      ...emptySnapshot('other', fetchedAt),
      supported: false,
      unsupportedReason: 'no-remote' satisfies ChangeRequestUnsupportedReason,
      currentBranch: branches.currentBranch,
      defaultBranch: branches.defaultBranch,
    }
  }

  const repo = await safe(() => deps.detectRepo(), null)
  if (provider !== 'github') {
    return {
      ...emptySnapshot(provider, fetchedAt),
      supported: false,
      unsupportedReason: 'provider-unsupported' satisfies ChangeRequestUnsupportedReason,
      repo,
      currentBranch: branches.currentBranch,
      defaultBranch: branches.defaultBranch,
    }
  }

  const credentialsReady = deps.hasCredentials()
  const base: ChangeRequestSnapshot = {
    provider,
    supported: true,
    unsupportedReason: null,
    repo,
    currentBranch: branches.currentBranch,
    defaultBranch: branches.defaultBranch,
    credentialsReady,
    fetchFailed: false,
    items: [],
    fetchedAt,
  }
  if (!credentialsReady) {
    return { ...base, unsupportedReason: 'credentials-missing' satisfies ChangeRequestUnsupportedReason }
  }
  if (!repo) {
    // 有 remote 但解析不出 owner/repo:按"平台不可用"如实报,不谎称空列表
    return { ...base, supported: false, unsupportedReason: 'provider-unsupported' }
  }

  let rawList: unknown
  try {
    rawList = await deps.listPullRequests(repo)
  } catch {
    return { ...base, fetchFailed: true }
  }
  const rows = Array.isArray(rawList) ? rawList : []
  const mapped = rows
    .map((row) => mapPullRequest(row, branches.currentBranch))
    .filter((row): row is ChangeRequestItem & { headSha: string | null } => row !== null)
    .sort((a, b) => {
      // 当前分支永远第一;其余按更新时间降序(无时间的排后面)
      if (a.isCurrentBranch !== b.isCurrentBranch) return a.isCurrentBranch ? -1 : 1
      const at = a.updatedAt ? Date.parse(a.updatedAt) : 0
      const bt = b.updatedAt ? Date.parse(b.updatedAt) : 0
      return bt - at
    })
    .slice(0, CHANGE_REQUEST_LIMITS.maxItems)

  // 只给前 N 条拉 CI(当前分支优先已由排序保证);单条失败只让该条 checks=null
  const checkTargets = mapped.slice(0, CHANGE_REQUEST_LIMITS.maxCheckedItems)
  await Promise.all(
    checkTargets.map(async (item) => {
      if (!item.headSha) return
      try {
        const raw = await deps.listCheckRuns({ ...repo, ref: item.headSha })
        item.checks = summarizeChecks(mapGithubCheckRuns(raw))
      } catch {
        item.checks = null
      }
    }),
  )

  const items: ChangeRequestItem[] = mapped.map(({ headSha: _headSha, ...item }) => item)
  return { ...base, items }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
