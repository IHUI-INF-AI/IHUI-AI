// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 三端联动任务调度路由(2026-07-23 立,对齐 @ihui/shared/tasks/dispatch 契约)。
 *
 * mobile-rn 下发 → api WebSocket → desktop 接收执行 → 结果回推。
 * Redis key 格式:tasks:<userId>(任务数组 JSON)
 * WS 推送频道:task-dispatch:<userId> / task-result:<userId>
 * Redis 不可用时降级为进程内 Map。
 *
 * 端点:
 *  - POST /tasks/dispatch   下发任务(创建 + WS 推送)
 *  - POST /tasks/result      回传结果(更新状态 + WS 推送)
 *  - GET  /tasks             列出用户任务
 *  - GET  /tasks/devices     返回在线设备列表
 *
 * 设备在线注册表(2026-07-23 立,P1 设备寻址闭环):
 *  - POST /tasks/register-device      desktop 启动注册 deviceId(30s 心跳刷新 lastSeen + 60s TTL)
 *  - DELETE /tasks/devices/:deviceId  设备下线清理
 *  - GET /tasks/devices               返回真实在线设备列表(过滤 lastSeen 距今 >60s 为 offline)
 * Redis key 格式:devices:<userId>(Hash 结构,field=deviceId → value=TaskDevice JSON)
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply, FastifyInstance } from 'fastify'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { checkAuth } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import type {
  TaskDispatch,
  TaskResult,
  TaskDispatchResponse,
  TaskWsMessage,
  TaskDevice,
  TaskDeviceRegisterResponse,
  TaskDeviceListResponse,
  TaskCancelResponse,
  TaskFilePayload,
  TaskApprovalResponse,
} from '@ihui/shared/tasks/dispatch'
// 2026-10-26 立:跨设备委派审批判据(纯函数,零依赖)。
// 与 nanoMuse 对比出的 P0-1 —— 通道(/tasks/dispatch)自 2026-07-23 就有,
// 缺的是"派出去的活儿要有人审、审批要送回提问的那台设备"。
import {
  openDelegationApproval,
  resolveDelegationAnswer,
  resolveDelegationStop,
  resolveTicketExpiry,
  DELEGATION_DEFAULT_TTL_MS,
} from '@ihui/shared/tasks/delegation-approval'

const dispatchSchema = z.object({
  toDevice: z.string().min(1).max(100),
  command: z.string().min(1).max(10_000),
  filePayload: z
    .object({
      filename: z.string().min(1).max(255),
      size: z.number().int().nonnegative(),
      mimeType: z.string().min(1).max(100),
      content: z.string().min(1),
    })
    .optional(),
  /**
   * 发起设备(2026-10-26 立)。此前**恒写 `'api'`**,发起设备身份丢失 ⇒ 审批无处可送。
   * 现在由调用方传真实 deviceId;缺省回落 'api' 仅为兼容存量客户端。
   */
  fromDevice: z.string().min(1).max(100).optional(),
  /** 是否要求审批(缺省 false,保持既有"下发即执行"语义不动) */
  requireApproval: z.boolean().optional(),
  /** 审批票 TTL(ms);上限 24h,缺省取判据的 5 分钟兜底 */
  approvalTtlMs: z.number().int().positive().max(86_400_000).optional(),
})

/** POST /tasks/:id/approval body(2026-10-26 立) */
const approvalSchema = z.object({
  decision: z.boolean(),
  seq: z.number().int().nonnegative(),
  deviceId: z.string().min(1).max(100),
})

/** base64 解码后最大字节数(1MB,2026-07-24 P2-c 跨端文件传输) */
const FILE_PAYLOAD_MAX_BYTES = 1_048_576

/** Node.js atob 兼容(15+ 原生支持);解码 base64 → 字节数 */
function base64DecodedBytes(b64: string): number {
  try {
    const bin = atob(b64)
    return bin.length
  } catch {
    return -1
  }
}

const resultSchema = z.object({
  taskId: z.string().min(1).max(100),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']),
  output: z.string().max(100_000).optional(),
  error: z.string().max(10_000).optional(),
})

/** POST /tasks/:id/cancel body:可空或 { reason?: string }(2026-07-23 立) */
const cancelSchema = z.object({
  reason: z.string().max(1_000).optional(),
  /**
   * 发起取消的设备(2026-10-26 立)。用于 Stop 审批票时的越权判定;
   * 不传回落 `task.fromDevice`(取消权归发起方),故存量客户端无需改造。
   */
  deviceId: z.string().min(1).max(100).optional(),
})

/** GET /tasks?since=<timestamp> 查询参数(2026-07-23 立) */
const sinceSchema = z.object({
  since: z.coerce.number().int().nonnegative().optional(),
})

const deviceTypeSchema = z.enum(['desktop', 'web', 'mobile', 'cloud', 'extension', 'cli'])

const registerSchema = z.object({
  deviceId: z.string().min(1).max(100),
  name: z.string().min(1).max(100),
  type: deviceTypeSchema,
})

/** 设备在线判定阈值:lastSeen 距今超过此值视为 offline(毫秒) */
const DEVICE_ONLINE_TTL_MS = 60_000

/** Redis 不可用时的进程内降级存储:userId → tasks[] */
const tasksFallback = new Map<string, TaskDispatch[]>()

/** Redis 不可用时的设备注册表降级存储:userId → (deviceId → TaskDevice) */
const devicesFallback = new Map<string, Map<string, TaskDevice>>()

/**
 * per-user 互斥锁(2026-08-01 立,P0 并发竞态修复)。
 * 原代码 dispatch/result/cancel 三个端点都遵循 `readTasks → 修改 → writeTasks` 模式,
 * 两个并发请求各读到旧数组,后写覆盖前写,丢失任务/状态更新。
 * 此锁保证同一 userId 的 read-modify-write 序列串行执行,单实例下消除竞态。
 * 多实例部署需引入 Redis 分布式锁(留作后续 P1 优化)。
 */
const userLocks = new Map<string, Promise<unknown>>()
async function withUserLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  const prev = userLocks.get(userId) ?? Promise.resolve()
  let release!: () => void
  const next = new Promise<void>((resolve) => {
    release = resolve
  })
  userLocks.set(
    userId,
    prev.then(() => next),
  )
  await prev
  try {
    return await fn()
  } finally {
    release()
    if (userLocks.get(userId) === next) userLocks.delete(userId)
  }
}

function userKey(userId: string): string {
  return `tasks:${userId}`
}

async function readTasks(
  redis: { get: (k: string) => Promise<string | null> },
  key: string,
): Promise<TaskDispatch[]> {
  try {
    const raw = await redis.get(key)
    if (!raw) return []
    return JSON.parse(raw) as TaskDispatch[]
  } catch {
    return tasksFallback.get(key) ?? []
  }
}

async function writeTasks(
  redis: { set: (k: string, v: string) => Promise<unknown> },
  key: string,
  tasks: TaskDispatch[],
): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(tasks))
  } catch {
    tasksFallback.set(key, tasks)
  }
}

function deviceKey(userId: string): string {
  return `devices:${userId}`
}

/** 读取用户全部设备(从 Redis Hash);Redis 不可用时降级进程内 Map。 */
async function readDevices(
  redis: {
    hgetall: (k: string) => Promise<Record<string, string>>
  },
  key: string,
): Promise<Map<string, TaskDevice>> {
  try {
    const raw = await redis.hgetall(key)
    const map = new Map<string, TaskDevice>()
    for (const [deviceId, json] of Object.entries(raw)) {
      try {
        map.set(deviceId, JSON.parse(json) as TaskDevice)
      } catch {
        /* 单个设备 JSON 损坏,跳过 */
      }
    }
    return map
  } catch {
    return devicesFallback.get(key) ?? new Map<string, TaskDevice>()
  }
}

/** 写入/刷新单个设备(Redis HSET + EXPIRE 60s);Redis 不可用时降级进程内 Map。 */
async function writeDevice(
  redis: {
    hset: (k: string, field: string, value: string) => Promise<unknown>
    expire: (k: string, ttl: number) => Promise<unknown>
  },
  key: string,
  device: TaskDevice,
): Promise<void> {
  try {
    await redis.hset(key, device.deviceId, JSON.stringify(device))
    await redis.expire(key, 60)
  } catch {
    let inner = devicesFallback.get(key)
    if (!inner) {
      inner = new Map<string, TaskDevice>()
      devicesFallback.set(key, inner)
    }
    inner.set(device.deviceId, device)
  }
}

/**
 * 删除单个设备(Redis HDEL);Redis 不可用时降级进程内 Map delete。
 * 2026-09-27 修「删掉 0 个也回成功」:返回值由 void 改为**存储侧真正删掉的 field 数**
 * —— HDEL 的回复本身就是计数,降级档的 Map#delete() 本身就是真布尔,两者都是唯一状态源的答复。
 * 回复形态取不到数值时按 0 计(宁可少报,不得把"没有证据"读成"删成功了")。
 */
async function removeDevice(
  redis: { hdel: (k: string, ...fields: string[]) => Promise<unknown> },
  key: string,
  deviceId: string,
): Promise<number> {
  try {
    const replied = await redis.hdel(key, deviceId)
    const n = typeof replied === 'number' ? replied : Number(replied)
    return Number.isFinite(n) && n > 0 ? n : 0
  } catch {
    return devicesFallback.get(key)?.delete(deviceId) ? 1 : 0
  }
}

/**
 * 推送 WS 消息:publish 到专用 Redis 频道 + 调用 pushNotification 直推在线客户端。
 * 参考 agent-control.ts 的 server.pushNotification 模式。
 */
function publishTaskWs(
  server: FastifyInstance,
  userId: string,
  channel: 'task-dispatch' | 'task-result' | 'task-cancelled' | 'task-approval',
  message: TaskWsMessage,
): void {
  const fullChannel = `${channel}:${userId}`
  try {
    void server.redis.publish(fullChannel, JSON.stringify(message))
  } catch {
    /* Redis publish 失败,忽略(降级模式下 WS 直推兜底) */
  }
  try {
    server.pushNotification(userId, message)
  } catch {
    /* WS 推送失败,忽略 */
  }
}

export const tasksRoutes: FastifyPluginAsync = async (server) => {
  // POST /tasks/dispatch — 下发任务(创建 + WS 推送到 task-dispatch 频道)
  server.post('/tasks/dispatch', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!

    const parsed = dispatchSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    const { toDevice, command, filePayload, fromDevice, requireApproval, approvalTtlMs } =
      parsed.data

    // 审批前置校验(2026-10-26):要审批却不说自己是哪台设备 ⇒ 审批卡无处可送。
    // 失效方向是"多要一次定向说明",不是"静默造一张没人能答的票"。
    if (requireApproval && !fromDevice) {
      return reply
        .status(400)
        .send(error(400, 'requireApproval=true 时必须传 fromDevice(审批卡要送回提问的那台设备)'))
    }

    // 二次校验:base64 解码后字节数 >1MB 返回 413(2026-07-24 P2-c 跨端文件传输)
    if (filePayload) {
      const bytes = base64DecodedBytes(filePayload.content)
      if (bytes < 0) {
        return reply.status(400).send(error(400, '附件 base64 解码失败'))
      }
      if (bytes > FILE_PAYLOAD_MAX_BYTES) {
        return reply.status(413).send(error(413, `文件过大(限制 1MB,当前 ${bytes} 字节)`))
      }
    }

    const now = new Date().toISOString()
    const task: TaskDispatch = {
      id: randomUUID(),
      // P0 修复(2026-08-01):原 `Number(userId)` 对 UUID 字符串返回 NaN,
      // 导致所有用户的任务都写入 `tasks:NaN` 同一 Redis key,严重数据泄露 + 串台。
      // 改为保留 string UUID,与 TaskDispatch.userId 类型(已同步改为 string)一致。
      userId: userId,
      // 2026-10-26 修正:原恒写 'api' 导致发起设备身份丢失,审批无法"跟人"。
      fromDevice: fromDevice ?? 'api',
      toDevice,
      command,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    }
    if (filePayload) {
      task.filePayload = filePayload as TaskFilePayload
    }
    // 审批票(2026-10-26):**只在 requireApproval 时存在**。
    // 票未 approved 前,本路由**不推 task-dispatch** ⇒ 执行端根本看不到这条委派 ⇒ 不会开跑。
    if (requireApproval && fromDevice) {
      task.approval = openDelegationApproval({
        delegationId: task.id,
        originDeviceId: fromDevice,
        targetDeviceId: toDevice,
        ttlMs: approvalTtlMs ?? DELEGATION_DEFAULT_TTL_MS,
      })
    }

    const key = userKey(userId)
    // P0 并发竞态修复:用 per-user Mutex 串行化 read-modify-write,避免后写覆盖前写丢任务
    await withUserLock(userId, async () => {
      const tasks = await readTasks(server.redis, key)
      tasks.push(task)
      await writeTasks(server.redis, key, tasks)
    })

    // 审批期间只推 task-approval(两端同示、先答者胜);
    // 免审委派照旧推 task-dispatch —— 既有执行端零改动。
    publishTaskWs(
      server,
      userId,
      task.approval ? 'task-approval' : 'task-dispatch',
      task.approval
        ? { type: 'task-approval', taskId: task.id, payload: task, deviceId: fromDevice }
        : { type: 'task-dispatch', taskId: task.id, payload: task },
    )

    const response: TaskDispatchResponse = { task }
    return reply.status(201).send(success(response))
  })

  // POST /tasks/result — 回传结果(更新状态 + WS 推送到 task-result 频道)
  server.post('/tasks/result', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!

    const parsed = resultSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    const { taskId, status, output, error: taskError } = parsed.data
    const key = userKey(userId)
    // P0 并发竞态修复:per-user Mutex 保护 read-modify-write
    const task = await withUserLock(userId, async () => {
      const tasks = await readTasks(server.redis, key)
      const idx = tasks.findIndex((t) => t.id === taskId)
      if (idx < 0) {
        return null
      }
      const finishedAt = new Date().toISOString()
      const result: TaskResult = {
        taskId,
        status,
        output,
        error: taskError,
        finishedAt,
      }
      const t = tasks[idx]!
      t.status = status
      t.result = result
      t.updatedAt = finishedAt
      await writeTasks(server.redis, key, tasks)
      return t
    })
    if (!task) {
      return reply.status(404).send(error(404, '任务不存在'))
    }

    publishTaskWs(server, userId, 'task-result', {
      type: 'task-result',
      taskId,
      payload: {
        taskId,
        status,
        output,
        error: taskError,
        finishedAt: task.updatedAt,
      } as TaskResult,
    })

    return reply.send(success({ task }))
  })

  // GET /tasks — 列出用户任务(支持 ?since=<timestamp> 增量拉取,2026-07-23 立)
  // 不传 since 时返回全量;传 since 时返回 updatedAt > since 的任务(用于 WS 重连后补拉断线期间错过的任务)
  server.get('/tasks', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!

    const parsed = sinceSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const since = parsed.data.since

    const key = userKey(userId)
    const allTasks = await readTasks(server.redis, key)
    const tasks =
      since !== undefined ? allTasks.filter((t) => Date.parse(t.updatedAt) > since) : allTasks
    return reply.send(success({ tasks, total: tasks.length }))
  })

  // POST /tasks/:id/approval — 回答委派审批票(2026-10-26 立,**先答者胜**)
  //
  // 这是与 nanoMuse 对比出的 P0-1 的落点:此前 `/tasks/dispatch` 下发即执行,
  // 把活儿派到别人机器上跑之前没有任何一道人审。此处补上,且刻意复用既有通道:
  //   - **审批期间不推 task-dispatch** ⇒ 执行端看不到 ⇒ 票未 approved 前绝不开跑
  //     (执行端零改动,沿用 2026-07-23 那套 toDevice 过滤);
  //   - 放行后才补推 task-dispatch,此刻执行端才开跑;
  //   - 拒绝 / 过期 ⇒ status=cancelled 并推 task-cancelled,永不推 dispatch;
  //   - 只有 origin(提问方)/ target(执行方)能答,第三台设备 rejected;
  //   - 先答者胜:票一旦 closed,后来者一律 duplicate,不翻案(否则双端各点一次跑两遍);
  //   - 过期不静默放行:读票自带的 createdAtMs/ttlMs,缺字段即未判定,不猜。
  server.post<{ Params: { id: string } }>('/tasks/:id/approval', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!
    const { id: taskId } = request.params

    const parsed = approvalSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { decision, seq, deviceId } = parsed.data
    const key = userKey(userId)

    const outcome = await withUserLock(userId, async () => {
      const tasks = await readTasks(server.redis, key)
      const idx = tasks.findIndex((t) => t.id === taskId)
      if (idx < 0) return { kind: 'missing' as const }
      const t = tasks[idx]!
      if (!t.approval) return { kind: 'no_approval' as const, task: t }

      // 过期优先于回答:票自带时钟为准,过期一律落 expired + cancelled
      const expiry = resolveTicketExpiry(t.approval, Date.now())
      if (expiry && expiry.verdict === 'applied') {
        t.approval = expiry.ticket
        t.status = 'cancelled'
        t.updatedAt = new Date().toISOString()
        await writeTasks(server.redis, key, tasks)
        return { kind: 'expired' as const, task: t }
      }

      const r = resolveDelegationAnswer(t.approval, { deviceId, decision, seq })
      if (r.verdict === 'applied') {
        t.approval = r.ticket
        t.updatedAt = new Date().toISOString()
        if (!decision) t.status = 'cancelled'
        await writeTasks(server.redis, key, tasks)
      }
      return { kind: 'resolved' as const, task: t, verdict: r.verdict, reason: r.reason }
    })

    if (outcome.kind === 'missing') {
      return reply.status(404).send(error(404, '任务不存在'))
    }
    if (outcome.kind === 'no_approval') {
      return reply.status(409).send(error(409, '该委派未开启审批,无可答之票'))
    }

    const task = outcome.task
    if (outcome.kind === 'resolved' && outcome.verdict === 'applied') {
      if (decision) {
        // 放行 ⇒ 此刻才让执行端看到这条委派
        publishTaskWs(server, userId, 'task-dispatch', {
          type: 'task-dispatch',
          taskId,
          payload: task,
        })
      } else {
        publishTaskWs(server, userId, 'task-cancelled', {
          type: 'task-cancelled',
          taskId,
          deviceId,
          payload: task,
        })
      }
    } else if (outcome.kind === 'expired') {
      publishTaskWs(server, userId, 'task-cancelled', {
        type: 'task-cancelled',
        taskId,
        payload: task,
      })
    }

    // 无论生效与否都回推最新票面,让 origin/target 两端 UI 收敛到同一张票
    publishTaskWs(server, userId, 'task-approval', {
      type: 'task-approval',
      taskId,
      deviceId,
      payload: task,
    })

    const response: TaskApprovalResponse = {
      task,
      verdict:
        outcome.kind === 'resolved' ? outcome.verdict : outcome.kind === 'expired' ? 'applied' : '',
      reason:
        outcome.kind === 'resolved'
          ? outcome.reason
          : outcome.kind === 'expired'
            ? '审批票已过期'
            : '',
    }
    return reply.send(success(response))
  })

  // POST /tasks/:id/cancel — 取消任务(2026-07-23 立,P0 跨端任务取消)
  // 鉴权:复用 authenticate preHandler。
  // 校验:task 存在 + 属于当前用户 + 状态 ∈ {pending, running}(否则 409)。
  // 执行:更新 status=cancelled + updatedAt=now + WS 推送 task-cancelled:<userId> 消息。
  server.post<{ Params: { id: string } }>('/tasks/:id/cancel', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!
    const { id: taskId } = request.params

    const parsed = cancelSchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const deviceIdForStop = parsed.data.deviceId

    const key = userKey(userId)
    // P0 并发竞态修复:per-user Mutex 保护 read-modify-write
    const cancelResult = await withUserLock(userId, async () => {
      const tasks = await readTasks(server.redis, key)
      const idx = tasks.findIndex((t) => t.id === taskId)
      if (idx < 0) return { kind: 'not_found' as const }
      const task = tasks[idx]!
      // 仅 pending / running 可取消;completed/failed/cancelled 返回 409
      if (task.status !== 'pending' && task.status !== 'running') {
        return { kind: 'conflict' as const, status: task.status }
      }
      // 2026-10-26:取消即 Stop —— 若该委派还挂着未终态的审批票,一并转 stopped。
      // 少了这一步会出现"任务已取消、审批票还挂着 awaiting,两端 UI 仍显示待你批准"的分叉。
      if (task.approval) {
        const stopped = resolveDelegationStop(task.approval, {
          deviceId: deviceIdForStop ?? task.fromDevice,
          seq: task.approval.seq,
        })
        if (stopped.verdict === 'applied') task.approval = stopped.ticket
      }
      const now = new Date().toISOString()
      task.status = 'cancelled'
      task.updatedAt = now
      await writeTasks(server.redis, key, tasks)
      return { kind: 'ok' as const, task }
    })

    if (cancelResult.kind === 'not_found') {
      return reply.status(404).send(error(404, '任务不存在'))
    }
    if (cancelResult.kind === 'conflict') {
      return reply.status(409).send(error(409, `任务已处于 ${cancelResult.status} 状态,无法取消`))
    }

    const task = cancelResult.task
    // WS 推送 task-cancelled:<userId> 消息:taskId + 携带发起方设备标识(fromDevice)
    publishTaskWs(server, userId, 'task-cancelled', {
      type: 'task-cancelled',
      taskId,
      deviceId: task.fromDevice,
      payload: task,
    })

    const response: TaskCancelResponse = { task }
    return reply.send(success(response))
  })

  // POST /tasks/register-device — 设备上线注册/心跳刷新(Hash 结构 + 60s TTL)
  server.post('/tasks/register-device', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!

    const parsed = registerSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    const { deviceId, name, type } = parsed.data
    const now = new Date().toISOString()
    const device: TaskDevice = {
      deviceId,
      name,
      type,
      lastSeen: now,
      online: true,
    }

    const key = deviceKey(userId)
    await writeDevice(server.redis, key, device)

    const response: TaskDeviceRegisterResponse = { device }
    return reply.status(201).send(success(response))
  })

  // DELETE /tasks/devices/:deviceId — 设备下线清理
  server.delete(
    '/tasks/devices/:deviceId',
    async (request: FastifyRequest<{ Params: { deviceId: string } }>, reply: FastifyReply) => {
      if (!(await checkAuth(request, reply))) return
      const userId = request.userId!

      const { deviceId } = request.params
      const key = deviceKey(userId)
      // ack 由存储侧答复派生(HDEL 的删除计数 / 降级 Map 的 delete() 真布尔):
      // 删一个不存在的 deviceId 从此回 removed:false,不再与删成功同形。键名与状态码逐字不变。
      const removedCount = await removeDevice(server.redis, key, deviceId)

      return reply.send(success({ removed: removedCount > 0 }))
    },
  )

  // GET /tasks/devices — 返回真实在线设备列表(lastSeen >60s 标记为 offline 但仍返回)
  server.get('/tasks/devices', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!

    const key = deviceKey(userId)
    const deviceMap = await readDevices(server.redis, key)
    const now = Date.now()
    const devices: TaskDevice[] = []
    for (const device of deviceMap.values()) {
      const lastSeenMs = Date.parse(device.lastSeen)
      const isOnline = !Number.isNaN(lastSeenMs) && now - lastSeenMs <= DEVICE_ONLINE_TTL_MS
      devices.push({ ...device, online: isOnline })
    }

    const response: TaskDeviceListResponse = {
      devices,
      total: devices.length,
    }
    return reply.send(success(response))
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
