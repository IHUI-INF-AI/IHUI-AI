// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D30 无人值守修复闭环 —— 服务层回归(2026-09-26 立,G-36)。
// 全程注入 fake mutex / fake transport / 临时文件存储,零真实网络、零生产 Redis/PG(§5 测试隔离铁律)。
// 覆盖:认领幂等重放 / 认领互斥 / 状态机非法迁移拒绝 / 重试上限 / 迁移审计流水 /
//       App 回帖出口 fail-closed(无凭据零请求)/ App 通道成功路径(断言走 installation token)。
import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { generateKeyPairSync } from 'node:crypto'

import {
  createRepairTaskStore,
  createAutomationRepairService,
  createAppRepairReporter,
  createFailClosedClaimMutex,
  isTransitionAllowed,
  claimabilityOf,
  InvalidRepairTransitionError,
  type ClaimMutex,
  type InstallationDirectory,
} from '../src/services/automation-repair-service.js'
import type { ScanItem, FixExecutor, FixTask } from '../src/services/automations/types.js'
import type {
  GithubApiRequest,
  GithubApiResponse,
  GithubTransport,
} from '../src/services/github-app/jwt.js'
import type { RepairTaskRecord } from '@ihui/types'

// ---------------------------------------------------------------------------
// 夹具
// ---------------------------------------------------------------------------

function issueItem(n = 1): ScanItem {
  return {
    key: `issue:${n}`,
    source: 'issue',
    title: `崩溃:提交表单空指针 #${n}`,
    detail: 'TypeError: cannot read properties of undefined',
    url: `https://github.com/o/r/issues/${n}`,
    issueNumber: n,
  }
}

function alertItem(n = 7): ScanItem {
  return {
    key: `code-scanning:${n}`,
    source: 'code-scanning',
    title: '[code-scanning] SQL injection',
    detail: 'db.query(`... ${id}`)',
    url: null,
    issueNumber: null,
  }
}

/** 可控互斥锁:默认全放行;blocked 集合内的 key tryLock 返回 null(模拟他人持有/后端不可用)。 */
function makeFakeMutex(): ClaimMutex & { blocked: Set<string>; held: string[] } {
  const blocked = new Set<string>()
  const held: string[] = []
  let seq = 0
  return {
    blocked,
    held,
    async tryLock(key) {
      if (blocked.has(key)) return null
      held.push(key)
      return `tok-${++seq}`
    },
    async unlock() {
      held.pop()
    },
  }
}

function okExecutor(): FixExecutor & { tasks: FixTask[] } {
  const tasks: FixTask[] = []
  return {
    name: 'stub',
    tasks,
    async execute(task) {
      tasks.push(task)
      return { ok: true, summary: '已定位并修复空指针' }
    },
  }
}

function failingExecutor(): FixExecutor {
  return {
    name: 'stub',
    async execute() {
      return { ok: false, summary: '', error: '修复失败:测试注入' }
    },
  }
}

interface PostedComment {
  repo: string
  issueNumber: number
  body: string
}

function makeReporter(spy: PostedComment[], failPost = false) {
  return {
    readiness: async () => ({ ok: false as const, reason: 'n/a' }),
    async postIssueComment(repo: string, issueNumber: number, body: string) {
      spy.push({ repo, issueNumber, body })
      return {
        posted: !failPost,
        channel: 'issue-comment' as const,
        ...(failPost ? { reason: 'injected_failure' } : {}),
      }
    },
    async openPullRequest() {
      return { posted: false, channel: 'pull-request' as const, reason: 'not_used' }
    },
  }
}

let storePath = ''
beforeEach(() => {
  storePath = join(mkdtempSync(join(tmpdir(), 'ihui-d30-repair-')), 'tasks.json')
})

// ---------------------------------------------------------------------------
// 1. 幂等摄入 + 互斥认领
// ---------------------------------------------------------------------------

describe('认领幂等与互斥', () => {
  it('同 key 重放摄入不产生第二条记录、不重置状态', async () => {
    const store = createRepairTaskStore(storePath)
    const mutex = makeFakeMutex()
    const service = createAutomationRepairService({
      repo: 'o/r',
      store,
      mutex,
      itemsProvider: async () => [issueItem(1)],
      executor: okExecutor(),
      reporter: makeReporter([]),
      owner: 'w1',
    })
    expect(await service.ingestPending()).toBe(1)
    // 先推进到 claimed,再重放摄入:既有状态不得被"再摄入"洗回 pending
    expect((await service.claim('issue:1')).ok).toBe(true)
    expect(await service.ingestPending()).toBe(0)
    expect(store.get('issue:1')?.state).toBe('claimed')
    expect(service.listTasks()).toHaveLength(1)
  })

  it('互斥锁被持有时认领被拒(locked_by_other),释放后可认领;重复认领判 in_progress', async () => {
    const store = createRepairTaskStore(storePath)
    const mutex = makeFakeMutex()
    const svc = createAutomationRepairService({
      repo: 'o/r',
      store,
      mutex,
      itemsProvider: async () => [issueItem(2)],
      executor: okExecutor(),
      reporter: makeReporter([]),
      owner: 'w1',
    })
    await svc.ingestPending()
    mutex.blocked.add('issue:2')
    const denied = await svc.claim('issue:2')
    expect(denied).toEqual({ ok: false, reason: 'locked_by_other' })
    mutex.blocked.delete('issue:2')
    expect((await svc.claim('issue:2')).ok).toBe(true)
    const again = await svc.claim('issue:2')
    expect(again).toEqual({ ok: false, reason: 'in_progress' })
  })

  it('锁后端缺失 ⇒ fail-closed:永远认领不到,也不落 claimed 状态', async () => {
    const store = createRepairTaskStore(storePath)
    await (async () => store.ingest(issueItem(3), 'o/r', 3, 'system:ingest'))()
    const svc = createAutomationRepairService({
      repo: 'o/r',
      store,
      mutex: createFailClosedClaimMutex(),
      itemsProvider: async () => [],
      executor: okExecutor(),
      reporter: makeReporter([]),
      owner: 'w1',
    })
    expect(await svc.claim('issue:3')).toEqual({ ok: false, reason: 'locked_by_other' })
    expect(store.get('issue:3')?.state).toBe('pending')
  })
})

// ---------------------------------------------------------------------------
// 2. 状态机与审计流水
// ---------------------------------------------------------------------------

describe('状态机', () => {
  it('迁移表:仅登记的边合法', () => {
    expect(isTransitionAllowed('pending', 'claimed')).toBe(true)
    expect(isTransitionAllowed('claimed', 'running')).toBe(true)
    expect(isTransitionAllowed('running', 'fixed')).toBe(true)
    expect(isTransitionAllowed('running', 'failed')).toBe(true)
    expect(isTransitionAllowed('failed', 'claimed')).toBe(true)
    expect(isTransitionAllowed('pending', 'running')).toBe(false)
    expect(isTransitionAllowed('fixed', 'claimed')).toBe(false)
    expect(isTransitionAllowed('pending', 'fixed')).toBe(false)
  })

  it('非法迁移抛 InvalidRepairTransitionError 且不落盘', () => {
    const store = createRepairTaskStore(storePath)
    store.ingest(issueItem(4), 'o/r', 3, 'system:ingest')
    expect(() => store.transition('issue:4', 'running', 'w1')).toThrow(InvalidRepairTransitionError)
    expect(store.get('issue:4')?.state).toBe('pending')
    expect(store.get('issue:4')?.history).toHaveLength(1)
  })

  it('每次迁移写审计条目(who/when/摘要),attempts 在进入 running 时 +1', async () => {
    const store = createRepairTaskStore(storePath)
    store.ingest(issueItem(5), 'o/r', 3, 'system:ingest')
    const t1 = store.transition('issue:5', 'claimed', 'w1')
    const t2 = store.transition('issue:5', 'running', 'w1', 'executor=stub')
    expect(t1.history.map((h) => h.to)).toEqual(['pending', 'claimed'])
    expect(t2.attempts).toBe(1)
    expect(t2.history.at(-1)).toMatchObject({
      from: 'claimed',
      to: 'running',
      by: 'w1',
      note: 'executor=stub',
    })
    expect(Date.parse(t2.history.at(-1)!.at)).not.toBeNaN()
  })

  it('failed 重试到上限后终态:claimability 判 retry_limit', () => {
    const store = createRepairTaskStore(storePath)
    store.ingest(issueItem(6), 'o/r', 2, 'system:ingest')
    store.transition('issue:6', 'claimed', 'w1')
    store.transition('issue:6', 'running', 'w1')
    store.transition('issue:6', 'failed', 'w1', '第一次失败')
    expect(claimabilityOf(store.get('issue:6')!)).toEqual({ claimable: true })
    store.transition('issue:6', 'claimed', 'w1')
    store.transition('issue:6', 'running', 'w1')
    store.transition('issue:6', 'failed', 'w1', '第二次失败')
    expect(claimabilityOf(store.get('issue:6')!)).toEqual({
      claimable: false,
      reason: 'retry_limit',
    })
    const t: RepairTaskRecord = store.get('issue:6')!
    expect(t.attempts).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// 3. 一轮执行:认领 → running → fixed → App 回帖
// ---------------------------------------------------------------------------

describe('runNext 闭环', () => {
  it('成功路径:任务到 fixed,issue 源回一帖,报告含回帖结果', async () => {
    const store = createRepairTaskStore(storePath)
    const posted: PostedComment[] = []
    const executor = okExecutor()
    const svc = createAutomationRepairService({
      repo: 'o/r',
      store,
      mutex: makeFakeMutex(),
      itemsProvider: async () => [issueItem(8), alertItem(9)],
      executor,
      reporter: makeReporter(posted),
      owner: 'w1',
    })
    await svc.ingestPending()
    const r1 = await svc.runNext()
    expect(r1).toMatchObject({ key: 'issue:8', ok: true })
    expect(r1?.report).toMatchObject({ posted: true, channel: 'issue-comment' })
    expect(posted).toHaveLength(1)
    expect(store.get('issue:8')?.state).toBe('fixed')
    // code-scanning 源无 issue 回帖面:执行后不发评论
    const r2 = await svc.runNext()
    expect(r2?.key).toBe('code-scanning:9')
    expect(r2?.report).toBeNull()
    expect(posted).toHaveLength(1)
    expect(executor.tasks[0]?.goal).toContain('issue:8')
    // 无更多可认领任务
    expect(await svc.runNext()).toBeNull()
  })

  it('执行失败 → failed(可重试),摘要入审计', async () => {
    const store = createRepairTaskStore(storePath)
    const svc = createAutomationRepairService({
      repo: 'o/r',
      store,
      mutex: makeFakeMutex(),
      itemsProvider: async () => [issueItem(10)],
      executor: failingExecutor(),
      reporter: makeReporter([]),
      owner: 'w1',
    })
    await svc.ingestPending()
    const r = await svc.runNext()
    expect(r?.ok).toBe(false)
    expect(store.get('issue:10')?.state).toBe('failed')
    expect(store.get('issue:10')?.history.at(-1)?.note).toContain('修复失败')
  })
})

// ---------------------------------------------------------------------------
// 4. GitHub App 出口:fail-closed 与成功通道
// ---------------------------------------------------------------------------

describe('AppRepairReporter', () => {
  const EMPTY_ENV: NodeJS.ProcessEnv = { PATH: '' }

  function recordingTransport(): { transport: GithubTransport; calls: GithubApiRequest[] } {
    const calls: GithubApiRequest[] = []
    return {
      calls,
      transport: async (req): Promise<GithubApiResponse> => {
        calls.push(req)
        return { status: 200, body: {} }
      },
    }
  }

  it('无 App 凭据 ⇒ fail-closed:不发帖、零网络请求、给出可审计原因', async () => {
    const t = recordingTransport()
    const installations: InstallationDirectory = { listInstallations: async () => [] }
    const reporter = createAppRepairReporter({
      env: EMPTY_ENV,
      installations,
      transport: t.transport,
    })
    const r = await reporter.postIssueComment('o/r', 1, 'hello')
    expect(r).toEqual({
      posted: false,
      channel: 'issue-comment',
      reason: 'github_app_credentials_missing',
    })
    expect(t.calls).toHaveLength(0)
  })

  it('凭据在但无活动 installation ⇒ fail-closed 零请求', async () => {
    const { privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    })
    const t = recordingTransport()
    const installations: InstallationDirectory = {
      listInstallations: async () => [
        {
          installationId: 1,
          accountLogin: 'someone-else',
          targetType: 'User',
          installedByUserId: null,
          status: 'removed',
          createdAt: '',
          updatedAt: '',
        },
      ],
    }
    const reporter = createAppRepairReporter({
      env: { GITHUB_APP_ID: '123', GITHUB_APP_PRIVATE_KEY: privateKey, PATH: '' },
      installations,
      transport: t.transport,
    })
    const r = await reporter.postIssueComment('o/r', 1, 'hello')
    expect(r.posted).toBe(false)
    expect(r.reason).toBe('no_active_installation')
    expect(t.calls).toHaveLength(0)
  })

  it('成功路径:先换 installation token 再回帖,请求头带短期 token(非 PAT)', async () => {
    const { privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    })
    const calls: GithubApiRequest[] = []
    const transport: GithubTransport = async (req) => {
      calls.push(req)
      if (req.path.endsWith('/access_tokens')) {
        return {
          status: 201,
          body: {
            token: 'ghs_installation_token',
            expires_at: new Date(Date.now() + 3600_000).toISOString(),
          },
        }
      }
      return { status: 201, body: { html_url: 'https://github.com/o/r/issues/1#issuecomment-1' } }
    }
    const installations: InstallationDirectory = {
      listInstallations: async () => [
        {
          installationId: 42,
          accountLogin: 'o',
          targetType: 'Organization',
          installedByUserId: null,
          status: 'active',
          createdAt: '',
          updatedAt: '',
        },
      ],
    }
    const reporter = createAppRepairReporter({
      env: { GITHUB_APP_ID: '123', GITHUB_APP_PRIVATE_KEY: privateKey, PATH: '' },
      installations,
      transport,
    })
    const r = await reporter.postIssueComment('o/r', 1, 'done')
    expect(r).toEqual({
      posted: true,
      channel: 'issue-comment',
      url: 'https://github.com/o/r/issues/1#issuecomment-1',
    })
    // 第一发是 token 交换(42 = 目录里的 installationId),第二发才是评论
    expect(calls.map((c) => c.path)).toEqual([
      '/app/installations/42/access_tokens',
      '/repos/o/r/issues/1/comments',
    ])
    expect(calls[1]?.headers.Authorization).toBe('Bearer ghs_installation_token')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
