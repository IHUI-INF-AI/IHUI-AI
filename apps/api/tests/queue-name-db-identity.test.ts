// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * BullMQ 队列名 × 数据库身份 —— **六族契约用例**(2026-10-31 立)。
 *
 * 立因:号池 7 天保活停摆(见 `src/services/relay-queue-name.ts` 头注)的同型形状,取证席在
 * `.ihui-agent/tmp/queue-proof/PROOF.md` §3b 量到其余队列族仍然成立:队列名写死字面量,
 * 而 `--stack` 隔离栈不关 ENABLE_WORKER ⇒ 隔离实例照样消费主库队列
 * (`relay-health-check-queue` 那一族 Redis 里就有 failed=500 的同族事故残留)。
 *
 * 钉住三件事:
 *  ① 主库(`dbName=ihui`、未设后缀)⇒ 六族队列名与线上现用字面量**逐字节相同**(零扰动);
 *  ② `RELAY_QUEUE_SUFFIX=slot-a` ⇒ 六族全部带 `-slot-a`,且**一个冒号都不许有**
 *     (BullMQ 的 QueueBase 对名字里的 `:` 直接抛,隔离栈会崩在 worker 启动);
 *  ③ 每一族的**生产者(new Queue)与消费者(new Worker)取到同一个名字**——两侧名字都是从
 *     真实调用里量出来的(bullmq 记录桩),不是口头保证。
 *
 * 纪律:测试不复制生产判据(§22c)——期望值只写「主库原名」这条契约字面量与后缀契约,
 * 规则表本身一律由生产实现出。零 IO:bullmq 整个换成记录桩,`src/db/index.js` 换成空桩,
 * 不建 PG 池、不建 Redis 连接(§5 测试隔离铁律)。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'

/** bullmq 记录桩:每一次 `new Queue/new Worker/new QueueEvents` 都记下 kind + 实际队列名 */
const capture = vi.hoisted(() => {
  const calls: Array<{ kind: string; name: string }> = []
  return {
    calls,
    namesOf: (kind: string) => calls.filter((c) => c.kind === kind).map((c) => c.name),
  }
})

vi.mock('bullmq', () => {
  class Queue {
    constructor(
      public readonly name: string,
      _opts?: unknown,
    ) {
      capture.calls.push({ kind: 'Queue', name })
    }
    async add() {
      return { id: 'job-1' }
    }
    async upsertJobScheduler() {
      return { id: 'scheduler-1' }
    }
    async close() {}
  }
  class Worker {
    constructor(
      public readonly name: string,
      _processor?: unknown,
      _opts?: unknown,
    ) {
      capture.calls.push({ kind: 'Worker', name })
    }
    on() {
      return this
    }
    async close() {}
  }
  class QueueEvents {
    constructor(
      public readonly name: string,
      _opts?: unknown,
    ) {
      capture.calls.push({ kind: 'QueueEvents', name })
    }
    on() {
      return this
    }
    async close() {}
  }
  return { Queue, Worker, QueueEvents }
})

// db 层换成空桩:本用例只量队列名,结构上不可能连库(生产 PG 8810 / Redis 8811 一律不碰)。
vi.mock('../src/db/index.js', () => {
  const inert: Record<string, unknown> = new Proxy({}, { get: () => inert })
  return {
    db: inert,
    dbRead: inert,
    dbClient: inert,
    dbScoped: inert,
    dbReadScoped: inert,
    poolLeakDetector: inert,
    stopPoolTracker: () => undefined,
    registerPoolTrackerCleanup: () => undefined,
    returningOne: async () => null,
  }
})

/** 主库 DSN(合成值,只为让解析层解析出库名 `ihui`;本用例不建任何连接) */
const PRIMARY_DSN = 'postgresql://u:p@127.0.0.1:5432/ihui'
/** 隔离库 DSN(命中解析规则 2 的库名特征) */
const ISOLATED_DSN = 'postgresql://u:p@127.0.0.1:5432/ihui_e2e'

/** 六族 + 号池族的**线上现用字面量**(①的对照值 = 契约本身,不是第二份规则表) */
const FAMILY_BASES = {
  email: 'email',
  notification: 'notification',
  aiCallback: 'ai-callback',
  notificationDispatch: 'notification-dispatch',
  registrySync: 'registry-sync-queue',
  registryCleanup: 'registry-cleanup-queue',
  scheduler: 'scheduler',
  batch: 'batch-queue',
  usdtPayment: 'usdt-payment-queue',
  relayHealthCheck: 'relay-health-check-queue',
  relayAccountPool: 'relay-account-pool-queue',
} as const

type FamilyKey = keyof typeof FAMILY_BASES

/** 六族(本次推广的射程)+ 号池族(修法已在册,这里只作回归对照) */
const IN_SCOPE_FAMILIES: FamilyKey[] = [
  'email',
  'notification',
  'aiCallback',
  'notificationDispatch',
  'registrySync',
  'registryCleanup',
  'scheduler',
  'batch',
  'usdtPayment',
  'relayHealthCheck',
]

/** 起一个只记录不联调的假 fastify server(queue.ts 插件与 worker 启动函数只用到这几样) */
function fakeServer(): FastifyInstance {
  const log = { info() {}, warn() {}, error() {}, debug() {}, trace() {}, fatal() {} }
  return {
    log,
    redisForQueue: {} as never,
    redis: {} as never,
    decorate: () => undefined,
    addHook: () => undefined,
    startBizTimer: () => ({ end: () => undefined }),
  } as unknown as FastifyInstance
}

const savedEnv: Record<string, string | undefined> = {
  DATABASE_URL: undefined,
  RELAY_QUEUE_SUFFIX: undefined,
  RELAY_PRIMARY_DB_NAME: undefined,
}

function applyEnv(databaseUrl: string, suffix?: string): void {
  process.env.DATABASE_URL = databaseUrl
  if (suffix === undefined) delete process.env.RELAY_QUEUE_SUFFIX
  else process.env.RELAY_QUEUE_SUFFIX = suffix
  delete process.env.RELAY_PRIMARY_DB_NAME
}

afterEach(() => {
  for (const key of Object.keys(savedEnv)) {
    const value = savedEnv[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

/**
 * 在指定 env 下重新加载各队列族模块,并**真的调用**每族的生产者与消费者构造点,
 * 返回「族 → { producer, consumer }」的实测队列名。
 *
 * 必须重新 import:队列名常量在模块加载时求值(同一进程内生产者与消费者只能听同一个名字),
 * 换 env 验证就得换一次模块实例。
 */
async function driveFamilies(
  databaseUrl: string,
  suffix?: string,
): Promise<Record<FamilyKey, { producer: string; consumer: string }>> {
  applyEnv(databaseUrl, suffix)
  vi.resetModules()
  capture.calls.length = 0

  const queuePlugin = await import('../src/plugins/queue.js')
  const registryQueue = await import('../src/plugins/registry-queue.js')
  const schedulerPlugin = await import('../src/plugins/scheduler.js')
  const batchQueue = await import('../src/queue/batch-queue.js')
  const batchIndex = await import('../src/queue/index.js')
  const batchWorker = await import('../src/workers/batch-worker.js')
  const registrySyncWorker = await import('../src/workers/registry-sync-worker.js')
  const usdtWorker = await import('../src/workers/usdt-payment-worker.js')
  const healthWorker = await import('../src/workers/relay-health-check-worker.js')
  const emailWorker = await import('../src/workers/email-worker.js')
  const notificationWorker = await import('../src/workers/notification-worker.js')
  const aiCallbackWorker = await import('../src/workers/ai-callback-worker.js')
  const dispatchWorker = await import('../src/workers/notification-dispatch-worker.js')
  const poolName = await import('../src/services/relay-queue-name.js')

  /** 只跑一段调用,取它期间新产生的 Queue/Worker 名(两侧都是实测,不是口头保证) */
  function once(fn: () => unknown, kind: 'Queue' | 'Worker'): string {
    capture.calls.length = 0
    fn()
    const names = capture.namesOf(kind)
    if (names.length === 0) throw new Error(`未量到 ${kind} 名(调用点没建实例?)`)
    if (names.length > 1) throw new Error(`${kind} 名不唯一:${names.join(', ')}`)
    return names[0] as string
  }

  // 生产者:queue.ts 插件一次建 4 张队列(源码顺序 = email, notification, aiCallback, notificationDispatch)
  capture.calls.length = 0
  await (queuePlugin.queue as unknown as (s: FastifyInstance, o: object) => Promise<void>)(
    fakeServer(),
    {},
  )
  const pluginQueues = capture.namesOf('Queue')
  const pluginQueueEvents = capture.namesOf('QueueEvents')

  // 生产者:scheduler 插件建 1 张队列
  capture.calls.length = 0
  await (schedulerPlugin.scheduler as unknown as (s: FastifyInstance, o: object) => Promise<void>)(
    fakeServer(),
    {},
  )
  const schedulerProducer = capture.namesOf('Queue')[0] as string

  const out: Record<FamilyKey, { producer: string; consumer: string }> = {
    email: {
      producer: pluginQueues[0] as string,
      consumer: once(() => emailWorker.startEmailWorker(fakeServer()), 'Worker'),
    },
    notification: {
      producer: pluginQueues[1] as string,
      consumer: once(() => notificationWorker.startNotificationWorker(fakeServer()), 'Worker'),
    },
    aiCallback: {
      producer: pluginQueues[2] as string,
      consumer: once(() => aiCallbackWorker.startAiCallbackWorker(fakeServer()), 'Worker'),
    },
    notificationDispatch: {
      producer: pluginQueues[3] as string,
      consumer: once(() => dispatchWorker.startNotificationDispatchWorker(fakeServer()), 'Worker'),
    },
    registrySync: {
      producer: once(() => registryQueue.getRegistrySyncQueue({} as never), 'Queue'),
      consumer: once(() => registrySyncWorker.startRegistrySyncWorker(fakeServer()), 'Worker'),
    },
    registryCleanup: {
      producer: once(() => registryQueue.getRegistryCleanupQueue({} as never), 'Queue'),
      consumer: once(() => registryQueue.startRegistryCleanupWorker({} as never), 'Worker'),
    },
    scheduler: {
      producer: schedulerProducer,
      // 消费者真实调用点在 workers/scheduler-worker.ts:走的就是 plugins/queue.ts 的 createWorker
      consumer: once(
        () =>
          queuePlugin.createWorker(fakeServer(), schedulerPlugin.SCHEDULER_QUEUE_NAME, async () =>
            Promise.resolve(null),
          ),
        'Worker',
      ),
    },
    batch: {
      producer: once(() => batchIndex.getBatchQueue({} as never), 'Queue'),
      consumer: once(() => batchWorker.startBatchWorker(fakeServer()), 'Worker'),
    },
    usdtPayment: {
      producer: once(() => usdtWorker.startUsdtPaymentWorker(fakeServer()), 'Queue'),
      consumer: once(() => usdtWorker.startUsdtPaymentWorker(fakeServer()), 'Worker'),
    },
    relayHealthCheck: {
      producer: once(() => healthWorker.startRelayHealthCheckWorker(fakeServer()), 'Queue'),
      consumer: once(() => healthWorker.startRelayHealthCheckWorker(fakeServer()), 'Worker'),
    },
    relayAccountPool: {
      producer: poolName.relayAccountPoolQueueName(),
      consumer: poolName.relayAccountPoolQueueName(),
    },
  }

  // QueueEvents(email 队列的全局失败监听)也必须与生产者同名,否则失败日志静默丢失
  expect(pluginQueueEvents).toEqual([out.email.producer])

  // 解析后的常量面与实测调用面必须一致(常量是两侧共同的取值来源)
  expect(queuePlugin.QUEUE_NAMES).toEqual({
    email: out.email.producer,
    notification: out.notification.producer,
    aiCallback: out.aiCallback.producer,
    notificationDispatch: out.notificationDispatch.producer,
  })
  expect(registryQueue.REGISTRY_SYNC_QUEUE_NAME).toBe(out.registrySync.producer)
  expect(registryQueue.REGISTRY_CLEANUP_QUEUE_NAME).toBe(out.registryCleanup.producer)
  expect(schedulerPlugin.SCHEDULER_QUEUE_NAME).toBe(out.scheduler.producer)
  expect(batchQueue.BATCH_QUEUE_NAME).toBe(out.batch.producer)
  expect(usdtWorker.USDT_PAYMENT_QUEUE_NAME).toBe(out.usdtPayment.producer)
  expect(healthWorker.RELAY_HEALTH_CHECK_QUEUE_NAME).toBe(out.relayHealthCheck.producer)

  // 任务中心(观测面)喂给 `new Queue(queue, …)` 的名字同样必须解析
  const taskCenter = await import('../src/services/relay-task-center.js')
  const queueFieldOf = (taskId: string): string => {
    const hit = taskCenter.RELAY_POOL_TASKS.find((t) => t.id === taskId)
    if (!hit?.queue) throw new Error(`任务中心缺 ${taskId} 的 queue 字段`)
    return hit.queue
  }
  expect(queueFieldOf('relay-pool-sweep')).toBe(out.relayAccountPool.producer)
  expect(queueFieldOf('relay-pool-gauge')).toBe(out.scheduler.producer)
  expect(queueFieldOf('relay-key-pool-health')).toBe(out.relayHealthCheck.producer)

  return out
}

describe('六族队列名 · 主库零扰动(契约①)', () => {
  it('主库 ihui、未设后缀 ⇒ 每族名字与线上现用字面量逐字节相同', async () => {
    const families = await driveFamilies(PRIMARY_DSN)
    for (const key of IN_SCOPE_FAMILIES) {
      expect({ [key]: families[key].producer }).toEqual({ [key]: FAMILY_BASES[key] })
      expect(families[key].consumer).toBe(FAMILY_BASES[key])
    }
    // 号池族(修法在册的那一族)一起对照,防推广时把已接正的面改坏
    expect(families.relayAccountPool.producer).toBe(FAMILY_BASES.relayAccountPool)
  })
})

describe('六族队列名 · 显式后缀隔离(契约②)', () => {
  it('RELAY_QUEUE_SUFFIX=slot-a ⇒ 六族全部带 -slot-a', async () => {
    const families = await driveFamilies(PRIMARY_DSN, 'slot-a')
    for (const key of IN_SCOPE_FAMILIES) {
      expect(families[key].producer).toBe(`${FAMILY_BASES[key]}-slot-a`)
      expect(families[key].consumer).toBe(`${FAMILY_BASES[key]}-slot-a`)
    }
    expect(families.relayAccountPool.producer).toBe(`${FAMILY_BASES.relayAccountPool}-slot-a`)
  })

  it('隔离库 ihui_e2e(不设显式后缀)⇒ 六族带库名后缀(与号池族同一条规则)', async () => {
    const families = await driveFamilies(ISOLATED_DSN)
    for (const key of IN_SCOPE_FAMILIES) {
      expect(families[key].producer).toBe(`${FAMILY_BASES[key]}-ihui_e2e`)
    }
  })

  it('任何一档产出都不许出现冒号(BullMQ QueueBase 见冒号即抛,启动会崩)', async () => {
    for (const [dsn, suffix] of [
      [PRIMARY_DSN, undefined],
      [PRIMARY_DSN, 'slot-a'],
      [ISOLATED_DSN, undefined],
      [ISOLATED_DSN, 'slot:2'],
    ] as const) {
      const families = await driveFamilies(dsn, suffix)
      for (const key of [...IN_SCOPE_FAMILIES, 'relayAccountPool'] as FamilyKey[]) {
        expect(families[key].producer.includes(':')).toBe(false)
        expect(families[key].consumer.includes(':')).toBe(false)
      }
    }
  })
})

describe('六族队列名 · 生产者与消费者同源(契约③)', () => {
  it('每族 new Queue 与 new Worker 取到同一个名字', async () => {
    for (const [dsn, suffix] of [
      [PRIMARY_DSN, undefined],
      [ISOLATED_DSN, 'slot-a'],
    ] as const) {
      const families = await driveFamilies(dsn, suffix)
      for (const key of [...IN_SCOPE_FAMILIES, 'relayAccountPool'] as FamilyKey[]) {
        expect({ family: key, ...families[key] }).toEqual({
          family: key,
          producer: families[key].producer,
          consumer: families[key].producer,
        })
      }
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
