// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D30 无人值守修复闭环 —— 修复任务服务层(2026-09-26 立,G-36)。
 *
 * 本文件补的是既有 automations 骨架(commit c5a61a47534)**没有覆盖的三格**,
 * 按 §12b 协作收尾路径分层叠加,不重写其主体逻辑:
 *  1. **认领幂等且互斥**:ledger 只保证单进程去重;跨 worker 互斥复用仓内既有
 *     `utils/distributed-lock.ts`(Redis SET NX + token 校验)。锁后端不可用 ⇒
 *     fail-closed(拒认领并给原因),绝不退化为"无锁直接放行"。
 *  2. **状态机**:pending → claimed → running → (fixed|failed),failed 在
 *     attempts < maxAttempts 前可再认领(重试);非法迁移一律抛错。
 *     每次迁移写审计流水(who/when/结论摘要),摘要先过 redact。
 *  3. **PR 回帖出口只经 D15 GitHub App 认证路径**(`services/github-app/jwt.ts`
 *     的 readGithubAppIdentity + createInstallationTokenProvider + pr-review 的
 *     withInstallationAuth;开 PR 复用 pr-creator 的 openPullRequestForFixWithInstallation)。
 *     App 凭据缺失 / 无活动 installation ⇒ fail-closed 并记明确原因;
 *     本模块不读取任何 PAT、不自拼 token 获取逻辑。
 *
 * 输入源归一:三源(issue / code-scanning / workflow-run)复用 automations/types.ts
 * 的 ScanItem 形态,`ingest` 幂等落为 RepairTaskRecord(同 key 重放不重置既有状态)。
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { Redis } from 'ioredis'

import type {
  RepairClaimRejection,
  RepairClaimResult,
  RepairReportResult,
  RepairRunReport,
  RepairTaskRecord,
  RepairTaskState,
  RepairTaskTransition,
} from '@ihui/types'

import { DistributedLock } from '../utils/distributed-lock.js'
import type { AuditLogger, FixExecutor, FixResult, FixTask, ScanItem } from './automations/types.js'
import { loadAutomationsConfig, validateConfig, defaultAudit } from './automations/config.js'
import { redactSecrets, makeAuditLogger } from './automations/redact.js'
import { createGitHubClient, type GitHubClient } from './automations/github-client.js'
import { createStubExecutor, createAgentExecutor } from './automations/executor.js'
import {
  readGithubAppIdentity,
  createGithubTransport,
  createInstallationTokenProvider,
  type GithubAppIdentity,
  type GithubTransport,
} from './github-app/jwt.js'
import { withInstallationAuth } from './github-app/pr-review.js'
import {
  openPullRequestForFixWithInstallation,
  toRepoCoordinates,
  type FixResultInput,
} from './github-app/pr-creator.js'
import type { GithubAppInstallationRow } from './github-app/store.js'

// ---------------------------------------------------------------------------
// 互斥认领锁(复用既有 DistributedLock;接口化以便测试注入 fake)
// ---------------------------------------------------------------------------

/** 按任务 key 的互斥认领锁。tryLock 返回 null = 未获得(他人持有/后端异常)。 */
export interface ClaimMutex {
  tryLock(key: string, owner: string, ttlMs: number): Promise<string | null>
  unlock(key: string, token: string): Promise<void>
}

const CLAIM_LOCK_PREFIX = 'ihui:automation-repair:claim:'
const CLAIM_LOCK_TTL_MS = 120_000

/** 生产实现:包一层仓内既有 DistributedLock(Redis SET NX PX + Lua 原子释放)。 */
export function createDistributedClaimMutex(redis: Redis): ClaimMutex {
  const locker = new DistributedLock(redis)
  return {
    async tryLock(key, owner, ttlMs) {
      const lock = await locker.tryLock(`${CLAIM_LOCK_PREFIX}${key}`, owner, { ttlMs })
      return lock ? lock.token : null
    },
    async unlock(key, token) {
      await locker.release(`${CLAIM_LOCK_PREFIX}${key}`, token)
    },
  }
}

/** fail-closed 锁:后端不可用时的缺省档 —— 永远拿不到,认领必被拒。 */
export function createFailClosedClaimMutex(): ClaimMutex {
  return {
    async tryLock() {
      return null
    },
    async unlock() {
      /* 从未持锁,无状态可清 */
    },
  }
}

// ---------------------------------------------------------------------------
// 状态机迁移表(唯一判据,别处不得再抄一份)
// ---------------------------------------------------------------------------

/**
 * 合法迁移:
 * pending → claimed(认领) | claimed → running(开工) | claimed → pending(释放回队列)
 * running → fixed | running → failed | failed → claimed(重试,受 maxAttempts 约束)
 * fixed 为终态。表外迁移一律拒绝。
 */
const ALLOWED_TRANSITIONS: Readonly<Partial<Record<RepairTaskState, readonly RepairTaskState[]>>> =
  {
    pending: ['claimed'],
    claimed: ['running', 'pending'],
    running: ['fixed', 'failed'],
    failed: ['claimed'],
    fixed: [],
  }

export class InvalidRepairTransitionError extends Error {
  constructor(
    readonly key: string,
    readonly from: RepairTaskState,
    readonly to: RepairTaskState,
  ) {
    super(`非法状态迁移 ${key}: ${from} → ${to}`)
    this.name = 'InvalidRepairTransitionError'
  }
}

/** 纯判据:迁移是否合法(供 store 与测试共用一份实现)。 */
export function isTransitionAllowed(from: RepairTaskState, to: RepairTaskState): boolean {
  return (ALLOWED_TRANSITIONS[from] ?? []).includes(to)
}

/** 认领资格判定(不含互斥锁):pending 或 未达上限的 failed 可认领。 */
export function claimabilityOf(
  task: RepairTaskRecord,
): { claimable: true } | { claimable: false; reason: RepairClaimRejection } {
  if (task.state === 'pending') return { claimable: true }
  if (task.state === 'failed') {
    return task.attempts < task.maxAttempts
      ? { claimable: true }
      : { claimable: false, reason: 'retry_limit' }
  }
  if (task.state === 'fixed') return { claimable: false, reason: 'already_fixed' }
  return { claimable: false, reason: 'in_progress' }
}

// ---------------------------------------------------------------------------
// 任务存储(内存 + 文件双保险;形态与 automations/ledger.ts 同族)
// ---------------------------------------------------------------------------

export interface RepairTaskStore {
  get(key: string): RepairTaskRecord | null
  list(state?: RepairTaskState): RepairTaskRecord[]
  /** 幂等摄入:已存在的 key 不重置、不覆盖,返回既有记录(created=false)。 */
  ingest(
    item: ScanItem,
    repo: string,
    maxAttempts: number,
    by: string,
  ): { task: RepairTaskRecord; created: boolean }
  /** 校验状态机后落迁移;非法迁移抛 InvalidRepairTransitionError。 */
  transition(key: string, to: RepairTaskState, by: string, note?: string): RepairTaskRecord
}

interface StoreFileShape {
  tasks: Record<string, RepairTaskRecord>
}

function nowIso(): string {
  return new Date().toISOString()
}

export function createRepairTaskStore(filePath: string, audit?: AuditLogger): RepairTaskStore {
  let state: StoreFileShape | null = null

  const ensureLoaded = (): StoreFileShape => {
    if (state) return state
    try {
      if (existsSync(filePath)) {
        const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as Partial<StoreFileShape>
        state =
          parsed && typeof parsed === 'object' && parsed.tasks && typeof parsed.tasks === 'object'
            ? { tasks: parsed.tasks }
            : { tasks: {} }
      } else {
        state = { tasks: {} }
      }
    } catch (err) {
      // 文件损坏:降级为空存储并大声告警(内存去重仍有效;绝不让一个坏文件洗掉判定)
      audit?.warn('[automation-repair] 任务存储读取失败,按空存储降级', {
        path: filePath,
        err: String(err),
      })
      state = { tasks: {} }
    }
    return state
  }

  const persist = (): void => {
    try {
      mkdirSync(dirname(filePath), { recursive: true })
      writeFileSync(filePath, JSON.stringify(ensureLoaded(), null, 2), 'utf8')
    } catch (err) {
      // 落盘失败不回滚内存态:回滚反而会造成重复认领/重复回帖
      audit?.warn('[automation-repair] 任务存储落盘失败,本轮仅内存生效', {
        path: filePath,
        err: String(err),
      })
    }
  }

  return {
    get(key) {
      return ensureLoaded().tasks[key] ?? null
    },
    list(filter) {
      const all = Object.values(ensureLoaded().tasks)
      return filter ? all.filter((t) => t.state === filter) : all
    },
    ingest(item, repo, maxAttempts, by) {
      const s = ensureLoaded()
      const existing = s.tasks[item.key]
      if (existing) return { task: existing, created: false }
      const created: RepairTaskRecord = {
        key: item.key,
        source: item.source,
        repo,
        title: item.title,
        goal: buildRepairGoal(item, repo),
        url: item.url,
        issueNumber: item.issueNumber,
        state: 'pending',
        attempts: 0,
        maxAttempts,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        history: [{ from: 'pending', to: 'pending', at: nowIso(), by, note: '摄入(初始 pending)' }],
      }
      s.tasks[item.key] = created
      persist()
      audit?.info('[automation-repair] 任务摄入', { key: item.key, source: item.source })
      return { task: created, created: true }
    },
    transition(key, to, by, note) {
      const s = ensureLoaded()
      const task = s.tasks[key]
      if (!task) throw new Error(`修复任务不存在:${key}`)
      if (!isTransitionAllowed(task.state, to)) {
        throw new InvalidRepairTransitionError(key, task.state, to)
      }
      const from = task.state
      const entry: RepairTaskTransition = { from, to, at: nowIso(), by, ...(note ? { note } : {}) }
      const next: RepairTaskRecord = {
        ...task,
        state: to,
        attempts: to === 'running' ? task.attempts + 1 : task.attempts,
        updatedAt: entry.at,
        history: [...task.history, entry],
      }
      s.tasks[key] = next
      persist()
      // 每次迁移都进审计流水(who/when/结论摘要);摘要已由调用方脱敏,这里再兜底洗一遍
      audit?.info('[automation-repair] 状态迁移', {
        key,
        from,
        to,
        by,
        note: redactSecrets(note ?? '', []),
      })
      return next
    },
  }
}

/** goal 组装(与 orchestrator 的 buildFixGoal 同信息量,但落进持久化记录)。 */
export function buildRepairGoal(item: ScanItem, repo: string): string {
  return [
    '【D30 无人值守修复任务】',
    `仓库:${repo}`,
    `来源:${item.source}`,
    `条目:${item.key}`,
    `标题:${item.title}`,
    item.url ? `链接:${item.url}` : '链接:(无)',
    '',
    '详情(问题正文/告警栈/失败日志线索):',
    item.detail || '(无详情,请根据标题与链接自行排查)',
    '',
    '要求:定位根因并实施修复;修复改动提交到独立分支,回帖由服务层经 GitHub App 通道发出。',
  ]
    .join('\n')
    .slice(0, 4000)
}

// ---------------------------------------------------------------------------
// GitHub App 回帖/开 PR 出口(fail-closed;复用 D15 既有认证路径)
// ---------------------------------------------------------------------------

/** 安装实例目录(store.listInstallations 的窄接口,测试注入 fake)。 */
export interface InstallationDirectory {
  listInstallations(): Promise<GithubAppInstallationRow[]>
}

export interface AppRepairReporterDeps {
  env?: NodeJS.ProcessEnv
  /** D15 安装映射表;null/缺省 = 目录不可用 ⇒ 一切出口 fail-closed */
  installations: InstallationDirectory | null
  /** 注入式未鉴权 transport(测试用);生产缺省 createGithubTransport() */
  transport?: GithubTransport
  audit?: AuditLogger
}

type Ready = {
  identity: GithubAppIdentity
  installationId: number
  authed: GithubTransport
}
type NotReady = { ok: false; reason: string }

function splitRepo(repo: string): { owner: string; name: string } | null {
  const [owner, name] = repo.split('/')
  if (!owner || !name) return null
  return { owner, name }
}

export interface AppRepairReporter {
  /** 回帖就绪性判定(纯读,零写请求);不 ready 时 reason 必可审计。 */
  readiness(repo: string): Promise<Ready | NotReady>
  /** 在 issue/PR 下回帖;任何不就绪/被拒都收敛为 {posted:false, reason},绝不抛出凭证。 */
  postIssueComment(repo: string, issueNumber: number, body: string): Promise<RepairReportResult>
  /** 以 App 身份开修复 PR(复用 pr-creator 的幂等开单:同 head/base 更新而非新建)。 */
  openPullRequest(
    repo: string,
    input: Omit<FixResultInput, 'coordinates'>,
  ): Promise<RepairReportResult>
}

export function createAppRepairReporter(deps: AppRepairReporterDeps): AppRepairReporter {
  const env = deps.env ?? process.env
  const audit = deps.audit
  const baseTransport: GithubTransport = deps.transport ?? createGithubTransport()

  async function readiness(repo: string): Promise<Ready | NotReady> {
    // 1) App 身份:唯一取凭据出口是 D15 的 readGithubAppIdentity(env),本模块不读 PAT、不自拼
    const identity = readGithubAppIdentity(env)
    if (!identity) {
      return { ok: false, reason: 'github_app_credentials_missing' }
    }
    // 2) 安装目录缺失 = 无法确定 installation ⇒ 不发任何写请求
    if (!deps.installations) {
      return { ok: false, reason: 'installation_directory_missing' }
    }
    const repoParts = splitRepo(repo)
    if (!repoParts) return { ok: false, reason: 'repo_name_invalid' }
    let rows: GithubAppInstallationRow[]
    try {
      rows = await deps.installations.listInstallations()
    } catch (err) {
      audit?.warn('[automation-repair] 安装目录查询失败', { err: String(err) })
      return { ok: false, reason: 'installation_lookup_failed' }
    }
    const active = rows.find(
      (r) =>
        r.status === 'active' &&
        (r.accountLogin ?? '').toLowerCase() === repoParts.owner.toLowerCase(),
    )
    if (!active) return { ok: false, reason: 'no_active_installation' }
    const authed = withInstallationAuth(
      baseTransport,
      createInstallationTokenProvider(identity, baseTransport),
      active.installationId,
    )
    return { identity, installationId: active.installationId, authed }
  }

  return {
    readiness,
    async postIssueComment(repo, issueNumber, body) {
      const ready = await readiness(repo)
      if ('ok' in ready && ready.ok === false) {
        audit?.warn('[automation-repair] 回帖 fail-closed(未发任何请求)', {
          repo,
          reason: ready.reason,
        })
        return { posted: false, channel: 'issue-comment', reason: ready.reason }
      }
      const authed = (ready as Ready).authed
      let resp: { status: number; body: unknown }
      try {
        resp = await authed({
          method: 'POST',
          path: `/repos/${repo}/issues/${issueNumber}/comments`,
          headers: {},
          body: { body },
        })
      } catch (err) {
        // token 换取失败等通道异常:收敛为原因,不外抛(错误消息不含凭证)
        audit?.warn('[automation-repair] 回帖通道异常', { repo, err: String(err) })
        return { posted: false, channel: 'issue-comment', reason: 'comment_channel_error' }
      }
      if (resp.status < 200 || resp.status >= 300) {
        // 只投影 status;响应体不整包搬运(GitHub 错误体可能回显请求头摘要)
        audit?.warn('[automation-repair] 回帖被拒', { repo, issueNumber, status: resp.status })
        return { posted: false, channel: 'issue-comment', reason: `github_http_${resp.status}` }
      }
      const htmlUrl =
        typeof (resp.body as { html_url?: unknown } | null)?.html_url === 'string'
          ? (resp.body as { html_url: string }).html_url
          : undefined
      return { posted: true, channel: 'issue-comment', ...(htmlUrl ? { url: htmlUrl } : {}) }
    },
    async openPullRequest(repo, input) {
      const ready = await readiness(repo)
      if ('ok' in ready && ready.ok === false) {
        return { posted: false, channel: 'pull-request', reason: ready.reason }
      }
      const coordinates = toRepoCoordinates(repo, (ready as Ready).installationId)
      if (!coordinates)
        return { posted: false, channel: 'pull-request', reason: 'repo_name_invalid' }
      const outcome = await openPullRequestForFixWithInstallation(
        {
          transport: baseTransport,
          tokenProvider: createInstallationTokenProvider((ready as Ready).identity, baseTransport),
        },
        { ...input, coordinates },
      )
      if (outcome.status === 'failed') {
        return { posted: false, channel: 'pull-request', reason: `pr_${outcome.stage}` }
      }
      return { posted: true, channel: 'pull-request', url: outcome.htmlUrl }
    },
  }
}

// ---------------------------------------------------------------------------
// 认领 + 执行编排服务
// ---------------------------------------------------------------------------

export interface AutomationRepairServiceDeps {
  repo: string
  store: RepairTaskStore
  mutex: ClaimMutex
  /** 三源条目提供器(issue/code-scanning/workflow-run 归一为 ScanItem[]) */
  itemsProvider: () => Promise<ScanItem[]>
  executor: FixExecutor
  reporter: AppRepairReporter
  /** 本 worker 标识(进认领锁与审计流水) */
  owner: string
  /** 单轮最多新认领数(防突发风暴) */
  batchLimit?: number
  /** 每任务重试上限(默认 3) */
  maxAttempts?: number
  /** 额外需从摘要/错误中洗掉的秘密(如扫描侧 PAT);绝不落日志 */
  secrets?: string[]
  audit?: AuditLogger
}

export interface AutomationRepairService {
  readonly repo: string
  /** 三源 → 修复任务记录(幂等)。返回本轮新建数。 */
  ingestPending(): Promise<number>
  /** 认领指定任务(互斥 + 资格判定)。 */
  claim(key: string): Promise<RepairClaimResult>
  /** 认领并执行一个 pending/可重试任务;无可认领任务返回 null。 */
  runNext(): Promise<RepairRunReport | null>
  /** 完整一轮:摄入 → 逐个执行至 batchLimit。 */
  runCycle(): Promise<{ ingested: number; results: RepairRunReport[] }>
  listTasks(state?: RepairTaskState): RepairTaskRecord[]
  getTask(key: string): RepairTaskRecord | null
}

export function createAutomationRepairService(
  deps: AutomationRepairServiceDeps,
): AutomationRepairService {
  const { repo, store, mutex, itemsProvider, executor, reporter } = deps
  const owner = deps.owner
  const batchLimit = deps.batchLimit ?? 5
  const maxAttempts = deps.maxAttempts ?? 3
  const audit = deps.audit
  const secrets = deps.secrets ?? []
  /** 兜底脱敏:执行摘要/错误可能带环境变量派生秘密,落盘/审计前统一洗 */
  const safe = (text: string): string => redactSecrets(text, secrets)

  async function claim(key: string): Promise<RepairClaimResult> {
    const task = store.get(key)
    if (!task) return { ok: false, reason: 'not_found' }
    const pre = claimabilityOf(task)
    if (!pre.claimable) return { ok: false, reason: pre.reason }

    const token = await mutex.tryLock(key, owner, CLAIM_LOCK_TTL_MS)
    if (!token) {
      // 互斥未获得(他人持有 / 锁后端不可用)⇒ fail-closed,不降级为无锁认领
      return { ok: false, reason: 'locked_by_other' }
    }
    try {
      // 拿锁后二次校验:check→lock 窗口内可能已被别的 worker 认领完并释放
      const fresh = store.get(key)
      if (!fresh) return { ok: false, reason: 'not_found' }
      const recheck = claimabilityOf(fresh)
      if (!recheck.claimable) return { ok: false, reason: recheck.reason }
      const claimed = store.transition(key, 'claimed', owner, '认领(互斥锁内二次校验通过)')
      return { ok: true, task: claimed }
    } finally {
      await mutex.unlock(key, token)
    }
  }

  async function runNext(): Promise<RepairRunReport | null> {
    const candidates = [...store.list('pending'), ...store.list('failed')]
    for (const candidate of candidates) {
      const claimed = await claim(candidate.key)
      if (!claimed.ok || !claimed.task) continue
      return await executeClaimed(claimed.task)
    }
    return null
  }

  async function executeClaimed(task: RepairTaskRecord): Promise<RepairRunReport> {
    const running = store.transition(task.key, 'running', owner, '开始执行')
    const fixTask: FixTask = {
      key: running.key,
      source: running.source,
      repo: running.repo,
      title: running.title,
      goal: running.goal,
      url: running.url,
      issueNumber: running.issueNumber,
    }
    let result: FixResult
    try {
      result = await executor.execute(fixTask)
    } catch (err) {
      result = { ok: false, summary: '', error: safe(String(err)) }
    }
    let summary = safe(result.summary || (result.ok ? '执行成功' : '执行失败'))
    if (!result.ok && result.error) summary = `${summary} ${safe(result.error)}`.trim()
    const finalState: RepairTaskState = result.ok ? 'fixed' : 'failed'
    store.transition(task.key, finalState, owner, summary.slice(0, 300))

    // ---- 回帖出口(仅 App 通道;issueNumber=null 的告警/失败 run 面无 issue ⇒ 不回帖)----
    let report: RepairReportResult | null = null
    if (running.issueNumber !== null) {
      const body = [
        result.ok ? '✅ D30 修复任务已执行:' : '❌ D30 修复任务执行失败(可重试将自动进行):',
        '',
        summary,
      ].join('\n')
      report = await reporter.postIssueComment(running.repo, running.issueNumber, body)
      if (!report.posted) {
        audit?.warn('[automation-repair] 结果回帖未送达', {
          key: running.key,
          reason: report.reason,
        })
      }
    }
    return { key: running.key, ok: result.ok, summary, report }
  }

  return {
    repo,
    async ingestPending() {
      const items = await itemsProvider().catch((err) => {
        audit?.warn('[automation-repair] 三源扫描失败,本轮摄入跳过', { err: safe(String(err)) })
        return [] as ScanItem[]
      })
      let created = 0
      for (const item of items) {
        const r = store.ingest(item, repo, maxAttempts, 'system:ingest')
        if (r.created) created++
      }
      return created
    },
    claim,
    runNext,
    async runCycle() {
      const ingested = await this.ingestPending()
      const results: RepairRunReport[] = []
      for (let i = 0; i < batchLimit; i++) {
        const r = await runNext()
        if (!r) break
        results.push(r)
      }
      return { ingested, results }
    },
    listTasks: (state) => store.list(state),
    getTask: (key) => store.get(key),
  }
}

// ---------------------------------------------------------------------------
// 生产装配(env 门控;任何一环不齐 ⇒ null,调用方拒启而不是硬撑)
// ---------------------------------------------------------------------------

export interface BuildRepairServiceInput {
  env?: NodeJS.ProcessEnv
  /** 既有 server.redis(缺省 ⇒ fail-closed 锁) */
  redis?: Redis | null
  /** D15 安装目录;缺省经 resolveGithubAppStore 动态解析(仅真实运行时加载 db) */
  installations?: InstallationDirectory | null
  /** 注入式 transport(测试);生产缺省 createGithubTransport() */
  transport?: GithubTransport
  /** 注入式执行器(测试);缺省按 config.executor 选 stub/agent */
  executor?: FixExecutor
  owner?: string
}

/**
 * 装配默认修复闭环服务。返回 null 的情况(全部拒启,fail-closed):
 * - IHUI_AUTOMATIONS_ENABLED !== 'true'(总闸关闭);
 * - 既有 automations 配置校验失败(repo 缺失等);
 * - 装配期间任何一环抛错(记 warn)。
 */
export async function buildRepairService(
  input: BuildRepairServiceInput = {},
): Promise<AutomationRepairService | null> {
  const env = input.env ?? process.env
  const cfg = loadAutomationsConfig(env)
  if (!cfg.enabled) return null
  const reject = validateConfig(cfg)
  if (reject) return null

  try {
    // 审计日志经既有 redact 层:即使别人误传,扫描侧 PAT 也不会落日志(§5e/守门 67 同族)
    const audit = makeAuditLogger([cfg.pat], defaultAudit())
    const storePath =
      (env.IHUI_AUTOMATIONS_REPAIR_STORE_PATH ?? '').trim() ||
      join(process.cwd(), '.ihui-agent', 'tmp', 'automation-repair-tasks.json')
    const store = createRepairTaskStore(storePath, audit)
    const mutex = input.redis
      ? createDistributedClaimMutex(input.redis)
      : createFailClosedClaimMutex()

    // 三源扫描仍复用既有 PAT 只读面(读不产生写副作用);写出口一律 App(见 reporter)
    const github: GitHubClient = createGitHubClient({
      pat: cfg.pat,
      repo: cfg.repo,
      transport: (url, init) => fetch(url, init),
      audit,
    })
    const itemsProvider = async (): Promise<ScanItem[]> => {
      const [issues, alerts, runs] = await Promise.all([
        github.scanIssues(cfg.label).catch(() => [] as ScanItem[]),
        github.scanCodeScanningAlerts().catch(() => [] as ScanItem[]),
        github.scanFailedRuns(cfg.maxRuns).catch(() => [] as ScanItem[]),
      ])
      return [...issues, ...alerts, ...runs]
    }

    let installations = input.installations
    if (installations === undefined) {
      try {
        const mod = await import('./github-app/store.js')
        const resolved = await mod.resolveGithubAppStore({
          warn: (msg: string) => console.warn(msg),
        })
        installations = resolved ?? null
      } catch {
        installations = null
      }
    }
    const reporter = createAppRepairReporter({
      env,
      installations,
      transport: input.transport,
      audit,
    })

    const executor =
      input.executor ??
      (cfg.executor === 'agent'
        ? createAgentExecutor({ agentId: cfg.agentId })
        : createStubExecutor())

    return createAutomationRepairService({
      repo: cfg.repo,
      store,
      mutex,
      itemsProvider,
      executor,
      reporter,
      owner: input.owner ?? `api-${process.pid}`,
      batchLimit: cfg.batchLimit,
      audit,
    })
  } catch (err) {
    console.warn('[automation-repair] 装配失败(拒启,fail-closed):', String(err))
    return null
  }
}

let repairTimer: NodeJS.Timeout | null = null
let repairCycleRunning = false

/**
 * D30 定时认领环:与 `startAutomationsScheduler` 同一 env 门控、同一单飞形态。
 * 返回 true 仅表示"门控通过并已发起装配",定时器在装配成功后才登记
 * (`buildRepairService` 拒启 = 永不启动,零定时器零网络)。
 */
export function startRepairCycleScheduler(
  getRedis: () => Redis | undefined,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (repairTimer) return true
  const cfg = loadAutomationsConfig(env)
  if (!cfg.enabled) return false
  const reject = validateConfig(cfg)
  if (reject) {
    defaultAudit().warn(`[automation-repair] 门控已开启但配置不完整,拒绝启动:${reject}`)
    return false
  }
  void buildRepairService({ redis: getRedis(), env })
    .then((service) => {
      if (!service) return
      if (repairTimer) return
      repairTimer = setInterval(() => {
        if (repairCycleRunning) return
        repairCycleRunning = true
        service
          .runCycle()
          .catch((err: unknown) => defaultAudit().warn(`[automation-repair] 轮次失败:${String(err)}`))
          .finally(() => {
            repairCycleRunning = false
          })
      }, cfg.intervalMs)
      repairTimer.unref()
    })
    .catch((err: unknown) => defaultAudit().warn(`[automation-repair] 装配未完成:${String(err)}`))
  return true
}

export function stopRepairCycleScheduler(): void {
  if (repairTimer) {
    clearInterval(repairTimer)
    repairTimer = null
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
