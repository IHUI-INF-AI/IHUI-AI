// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 变更请求台账(Change Request Registry)—— F-Forge,2026-11-13 立
 *
 * 对标 DSH 的 Forge:provider-neutral 的「变更请求注册表」+ 会话侧栏面板。
 * 此前 `GitStatusSnapshot.pullRequest` 只表达**当前分支的一条 PR**,仓库里其他进行中的
 * 变更请求在端内完全不可见;本契约把"一次拉全 + 统一状态"独立成跨端形状。
 *
 * 纪律:
 *  - provider-neutral:`github / gitee / gitlab / other` 四值,`supported=false` 时
 *    `unsupportedReason` 必须给出如实原因(禁把"没适配器"说成"没有变更请求");
 *  - CI 聚合态复用 `@ihui/shared/chat` 的六态判定,本文件只做**字面量镜像**
 *    (types 不依赖 shared,与 `ide-workspace.ts` 的 `pullRequest.checks` 同款处理);
 *  - 纯函数(`findCurrentBranchChangeRequest` / `deriveChangeRequestCounts` /
 *    `canCreateChangeRequest`)是面板与测试的唯一判据,端内不得另写一套。
 */

export const CHANGE_REQUEST_PROVIDERS = ['github', 'gitee', 'gitlab', 'other'] as const
export type ChangeRequestProvider = (typeof CHANGE_REQUEST_PROVIDERS)[number]

export const CHANGE_REQUEST_STATES = ['open', 'draft', 'merged', 'closed'] as const
export type ChangeRequestState = (typeof CHANGE_REQUEST_STATES)[number]

/**
 * 不支持/不可用的如实原因:
 *  - no-remote             当前工作区没有配置 git remote
 *  - provider-unsupported  托管平台没有适配器(如 gitee/gitlab),不是"没有变更请求"
 *  - credentials-missing   平台可支持但本机没有凭据(前端给「连接 GitHub」动作)
 */
export const CHANGE_REQUEST_UNSUPPORTED_REASONS = [
  'no-remote',
  'provider-unsupported',
  'credentials-missing',
] as const
export type ChangeRequestUnsupportedReason = (typeof CHANGE_REQUEST_UNSUPPORTED_REASONS)[number]

export const CHANGE_REQUEST_LIMITS = {
  /** 单次快照最多返回的变更请求条数 */
  maxItems: 30,
  /** 单次快照最多拉取 CI 明细的条数(其余条只给 checks=null,不阻塞列表) */
  maxCheckedItems: 5,
} as const

/** CI 聚合态(与 `@ihui/shared/chat` 的 `CiChecksSummary` 同值;此处字面量镜像避免 types → shared 依赖) */
export type ChangeRequestChecksSummary = 'failing' | 'pending' | 'successful' | 'none'

/** CI 单条六态(与 `@ihui/shared/chat` 的 `CiCheckState` 同值;同上,字面量镜像) */
export const CHANGE_REQUEST_CI_STATES = [
  'failed',
  'passed',
  'pending',
  'skipped',
  'neutral',
  'unknown',
] as const
export type ChangeRequestCiState = (typeof CHANGE_REQUEST_CI_STATES)[number]

/**
 * GitHub check-run(status + conclusion)→ 六态。**唯一映射点**,api 与 web 同读。
 *
 *   - `status !== 'completed'`(queued / in_progress / waiting / requested)→ pending;
 *   - completed 时认 conclusion:成功/失败/取消/跳过/中性按语义归并,
 *     GitHub 专有的 `timed_out` / `action_required` / `startup_failure` 归 failed;
 *   - completed 却无 conclusion 或形态未知 → unknown(**状态未知不得宣称成功**)。
 */
export function githubCheckRunState(
  status: string | null | undefined,
  conclusion: string | null | undefined,
): ChangeRequestCiState {
  const st = (status ?? '').trim().toLowerCase()
  if (st && st !== 'completed') return 'pending'
  const cj = (conclusion ?? '').trim().toLowerCase()
  if (!cj) return 'unknown'
  if (cj === 'success' || cj === 'succeeded' || cj === 'passed') return 'passed'
  if (cj === 'failure' || cj === 'errored' || cj === 'error') return 'failed'
  if (cj === 'timed_out' || cj === 'action_required' || cj === 'startup_failure') return 'failed'
  if (cj === 'queued' || cj === 'in_progress' || cj === 'running' || cj === 'pending')
    return 'pending'
  if (cj === 'cancelled' || cj === 'canceled' || cj === 'skipped') return 'skipped'
  if (cj === 'neutral' || cj === 'stale') return 'neutral'
  return (CHANGE_REQUEST_CI_STATES as readonly string[]).includes(cj)
    ? (cj as ChangeRequestCiState)
    : 'unknown'
}

export interface ChangeRequestChecks {
  summary: ChangeRequestChecksSummary
  passed: number
  failed: number
  total: number
}

export interface ChangeRequestItem {
  /** 平台内编号(PR/MR number) */
  number: number
  title: string
  url: string
  state: ChangeRequestState
  /** 是否为 Draft(与 state='draft' 同义冗余保留,便于平台态与草稿态分开消费) */
  draft: boolean
  author: string | null
  headBranch: string | null
  baseBranch: string | null
  /** ISO 时间串;平台缺省为 null */
  updatedAt: string | null
  /** 该变更请求的源分支是否就是当前工作区分支 */
  isCurrentBranch: boolean
  /** CI 检查汇总;未拉取/平台无此概念为 null(不等于"通过") */
  checks: ChangeRequestChecks | null
}

export interface ChangeRequestRepo {
  owner: string
  repo: string
}

export interface ChangeRequestSnapshot {
  provider: ChangeRequestProvider
  /** provider 是否有适配器(不等同于凭据就绪) */
  supported: boolean
  /** supported=false 或凭据缺失时的如实原因;一切正常为 null */
  unsupportedReason: ChangeRequestUnsupportedReason | null
  repo: ChangeRequestRepo | null
  currentBranch: string | null
  defaultBranch: string | null
  /** 凭据是否就绪(字段名刻意不含 token 子串,避免响应脱敏规则误伤) */
  credentialsReady: boolean
  /** 平台查询失败(与"查到 0 条"严格区分;失败时 items 为空且不得显示"无变更请求") */
  fetchFailed: boolean
  items: ChangeRequestItem[]
  fetchedAt: string
}

/** 当前分支对应的变更请求(没有则为 null) */
export function findCurrentBranchChangeRequest(
  items: readonly ChangeRequestItem[] | null | undefined,
): ChangeRequestItem | null {
  for (const item of items ?? []) if (item.isCurrentBranch) return item
  return null
}

/** 四态计数(缺失态记 0,便于断言与展示) */
export function deriveChangeRequestCounts(
  items: readonly ChangeRequestItem[] | null | undefined,
): Record<ChangeRequestState, number> {
  const counts: Record<ChangeRequestState, number> = { open: 0, draft: 0, merged: 0, closed: 0 }
  for (const item of items ?? []) counts[item.state] += 1
  return counts
}

/**
 * 是否应当展示「创建变更请求」入口。
 *
 * 六个条件全部成立才给 —— 任一缺失都宁可不出入口,也不给一个点了会失败/建错 base 的按钮:
 *   supported && credentialsReady && repo && currentBranch && defaultBranch
 *   && currentBranch !== defaultBranch && 当前分支尚无变更请求
 */
export function canCreateChangeRequest(
  snapshot: ChangeRequestSnapshot | null | undefined,
): boolean {
  if (!snapshot) return false
  if (!snapshot.supported || !snapshot.credentialsReady) return false
  if (!snapshot.repo) return false
  if (!snapshot.currentBranch || !snapshot.defaultBranch) return false
  if (snapshot.currentBranch === snapshot.defaultBranch) return false
  return findCurrentBranchChangeRequest(snapshot.items) === null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
