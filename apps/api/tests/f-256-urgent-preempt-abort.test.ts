// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-256 回归锁(2026-11-13)。
 *
 * 病灶:`_tryPreempt()` 抢占只把被抢任务写成 `preempted`,既不 abort 在途调用,也不阻止
 * 执行器回写;容量判据只看 `dispatch.status` ⇒ `preempted` 被当成已释放,urgent 立刻开跑,
 * 实际并发突破上限(token 双耗),被抢任务跑完又把 `preempted` 覆写成 `completed`。
 *
 * 本文件钉住:
 *  ① 抢占必须真正中止执行:被抢任务的在途调用收到 abort(AbortSignal 已触发);
 *  ② 被抢任务回写不得覆盖:底层「迟到成功」返回后仍是 `preempted`,不写 result/completed 日志;
 *  ③ 并发计数不被抢占绕过:被抢任务仍在本进程 inFlight ⇒ 槽位不放行,urgent 落 queued;
 *     只有执行器真正退出(释放 inFlight)后,队列才补位开跑。
 *
 * 只 mock db / ai-service fetch / SSE / 工作区锁,不触达真实 PG、Redis、ai-service。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }))

vi.mock('../src/utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('../src/utils/ai-service-fetch.js', () => ({
  aiServiceSystemFetch: mockFetch,
}))

vi.mock('../src/services/agent-sse-bus.js', () => ({
  broadcastSSEEvent: vi.fn(),
}))

vi.mock('../src/db/index.js', () => ({
  db: { insert: vi.fn(), update: vi.fn(), select: vi.fn() },
  dbRead: {},
}))

vi.mock('@ihui/database', () => ({
  agentTasks: { id: 'agent_tasks_id', status: 'agent_tasks_status' },
  chatConversations: { id: 'chat_conversations_id' },
}))

vi.mock('../src/services/workspace-lock-heartbeat.js', () => {
  const LOCK_RELEASE_OUTCOME_TABLE = [
    'completed',
    'failed',
    'cancelled',
    'preempted',
    'quota_exceeded',
    'triage',
    'todo',
    'ready',
    'blocked',
    'done',
    'deleted',
  ] as const
  return {
    LOCK_HEARTBEAT_INTERVAL_MS: 30_000,
    startLockHeartbeat: vi.fn(),
    stopLockHeartbeat: vi.fn(),
    releaseTaskLockByTaskId: vi.fn().mockResolvedValue(undefined),
    toLockReleaseOutcome: (status: string) =>
      (LOCK_RELEASE_OUTCOME_TABLE as readonly string[]).includes(status)
        ? (status as (typeof LOCK_RELEASE_OUTCOME_TABLE)[number])
        : null,
  }
})

import { SubagentDispatchService } from '../src/services/subagent-dispatch-service.js'

type DispatchPriority = 'low' | 'normal' | 'high' | 'urgent'

interface RuntimeLike {
  dispatch: {
    id: string
    goal: string
    status: string
    result?: string
    ownerUserId?: string
    affectedFiles: string[]
    createdAt: string
    updatedAt: string
  }
  priority: DispatchPriority
  steps: unknown[]
  logs: Array<{ event?: string }>
  hasFailed: boolean
  checkpoints: Map<string, unknown>
  messages: unknown[]
  dagNodeStatus: Map<string, unknown>
  abortController: AbortController
  outbox?: unknown
  startedAt?: number
  completedAt?: number
}

const baseInput = (priority: DispatchPriority, goal: string) => ({
  goal,
  affectedFiles: [] as string[],
  forbidden: [] as string[],
  verifyCommands: [] as string[],
  constraints: '',
  deliverables: '',
  agentRole: 'coder' as const,
  orchestration: 'parallel' as const,
  priority,
  ownerUserId: 'tenant-a',
})

const okResponse = (output: string): Response =>
  new Response(JSON.stringify({ code: 0, data: { final_output: output, steps: [] } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

/** 在途请求:只有我们手动 resolve 才返回(模拟「底层照常跑完」,不理会 abort) */
function controllableFetch(): { resolve: (res: Response) => void } {
  let resolveFn!: (res: Response) => void
  mockFetch.mockImplementationOnce(
    () =>
      new Promise<Response>((resolve) => {
        resolveFn = resolve
      }),
  )
  return { resolve: (res) => resolveFn(res) }
}

/** 在途请求:收到 AbortSignal 立即 reject(模拟真实 fetch 的中止语义) */
function abortableFetch(): { aborted: () => boolean } {
  let aborted = false
  mockFetch.mockImplementationOnce(
    (_url: unknown, init?: { signal?: AbortSignal }) =>
      new Promise<Response>((_resolve, reject) => {
        const onAbort = (): void => {
          aborted = true
          reject(new Error('The operation was aborted'))
        }
        if (init?.signal?.aborted) onAbort()
        else init?.signal?.addEventListener('abort', onAbort, { once: true })
      }),
  )
  return { aborted: () => aborted }
}

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 10))

async function waitFor(cond: () => boolean, timeoutMs = 2000): Promise<void> {
  const start = Date.now()
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor 超时')
    await new Promise((r) => setTimeout(r, 5))
  }
}

const internals = (
  service: SubagentDispatchService,
): { runtimes: Map<string, RuntimeLike>; inFlight: Set<string> } =>
  service as unknown as { runtimes: Map<string, RuntimeLike>; inFlight: Set<string> }

function runtimeOf(service: SubagentDispatchService, id: string): RuntimeLike | undefined {
  return internals(service).runtimes.get(id)
}

/** 直接注入「他租户在跑」记录,把全局 6 槽顶满(不经过派单准入,与既有服务测试同款) */
function fillGlobalCapacity(service: SubagentDispatchService): void {
  for (let i = 0; i < 5; i += 1) {
    internals(service).runtimes.set(`tenant-b-${i}`, {
      dispatch: {
        id: `tenant-b-${i}`,
        goal: `goal-${i}`,
        status: 'running',
        ownerUserId: 'tenant-b',
        affectedFiles: [],
        createdAt: '2026-11-13T00:00:00.000Z',
        updatedAt: '2026-11-13T00:00:00.000Z',
      },
      priority: 'normal',
      steps: [],
      logs: [],
      hasFailed: false,
      checkpoints: new Map(),
      messages: [],
      dagNodeStatus: new Map(),
      abortController: new AbortController(),
    })
  }
}

/** 建一条本租户 low 任务并等它真正进入 running(执行器已持有 inFlight) */
async function startLowTask(service: SubagentDispatchService): Promise<string> {
  const { dispatch } = await service.dispatch(baseInput('low', 'low-priority task'))
  const id = dispatch!.id
  await waitFor(() => service.findById(id)?.status === 'running')
  return id
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFetch.mockReset()
  mockFetch.mockResolvedValue(okResponse('默认完成结果'))
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('F-256 urgent 抢占必须真正中止执行', () => {
  it('① 抢占后在途调用收到 abort,被抢占任务状态为 preempted', async () => {
    const service = new SubagentDispatchService(null)
    const pending = abortableFetch()
    const id = await startLowTask(service)
    fillGlobalCapacity(service)

    const result = await service.dispatch(baseInput('urgent', 'urgent task'))
    expect(result.outcome).toBe('ok')

    const target = runtimeOf(service, id)!
    expect(target.dispatch.status).toBe('preempted')
    // 只改状态不算中止:这里要求执行链真正收到 abort
    expect(target.abortController.signal.aborted).toBe(true)
    await waitFor(() => pending.aborted())
  })

  it('② 被抢占任务「迟到成功」回写不得覆盖 preempted', async () => {
    const service = new SubagentDispatchService(null)
    const pending = controllableFetch()
    const id = await startLowTask(service)
    fillGlobalCapacity(service)

    await service.dispatch(baseInput('urgent', 'urgent task'))
    const target = runtimeOf(service, id)!
    expect(target.dispatch.status).toBe('preempted')

    // 底层调用「照常跑完」—— 这正是本票的触发路径
    pending.resolve(okResponse('迟到的完成结果'))
    await flush()

    expect(service.findById(id)?.status).toBe('preempted')
    expect(service.findById(id)?.result).toBeUndefined()
    expect(target.logs.some((l) => l.event === 'dispatch_completed')).toBe(false)
  })

  it('③ 并发计数不被抢占绕过:被抢占任务仍在飞 ⇒ urgent 落 queued,退出后才补位', async () => {
    const service = new SubagentDispatchService(null)
    const pending = controllableFetch()
    const id = await startLowTask(service)
    fillGlobalCapacity(service)

    const urgent = await service.dispatch(baseInput('urgent', 'urgent task'))
    const urgentId = urgent.dispatch!.id

    // 抢占已发生,但执行器还没退出 ⇒ 槽位仍被真实占用,urgent 不得开跑
    expect(runtimeOf(service, id)!.dispatch.status).toBe('preempted')
    expect(internals(service).inFlight.has(id)).toBe(true)
    expect(service.findById(urgentId)?.status).toBe('queued')

    // 迟到结果返回、执行器真正退出后释放槽位 ⇒ 队列补位开跑
    pending.resolve(okResponse('迟到的完成结果'))
    await waitFor(() => service.findById(urgentId)?.status === 'completed')
  })
})
