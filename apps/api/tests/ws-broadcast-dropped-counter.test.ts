// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ws-broadcast「丢帧专用计数器」装车回归(2026-09-26 立)。
 *
 * 缺陷本体:noteDropped() 只给 ws_disconnects_total +1,而那一格混了两件不同的事 ——
 * (a) 客户端正常关连接(ws-chat / ws-notifications 的 close 路径也给它 +1),
 * (b) 我们丢了一帧并把一条陈旧连接摘掉。运维想问的是 (b),却只能从 (a)+(b) 的总和里猜;
 * warn 是进程日志、不可查询、还被 60s 节流,不构成观测出口。
 *
 * 本文件证明的是**装车**而不是**声明**:计数器由真实插件递增、由真实 /metrics 路由读出。
 * 不连库、不监听端口 —— 把真实 metricsPlugin 挂到 Fastify 上,再把该实例 app.metrics 那份
 * **同一个对象**喂给 ws-broadcast 插件(插件写的就是 /metrics 读的那一份,不是第二份台账)。
 *
 * 判据:
 *   1 基线:一次成功广播 ⇒ 新计数器 0,且 ws_disconnects_total 不变
 *   2 失败一帧 ⇒ 新计数器恰 1,**且**断开计数同轮 +1(成对递增是判据的一部分:
 *     防"只加新计数、把断开计数悄悄摘掉"这种看起来更干净的回退)
 *   3 同批次其余健康连接照样收到帧(不抛错、不中断主流程)
 *   4 同步抛出与 callback 报错两种失败形态各自都产出 +1
 *   5 HELP/TYPE/值三行成套 + 字段在初始化块与类型声明块都在(三处缺一即红)
 *   6 断言一律按名字取值、按增量比对,不钉"当前 HEAD 有几个计数器"这类会腐烂的数字
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import Fastify, { type FastifyInstance } from 'fastify'

vi.mock('../src/plugins/ws-helpers.js', () => ({
  wsAuth: vi.fn(async () => USER_A),
  WS_CLOSE: { TOO_MANY_CONNECTIONS: 1013 },
  WsUserConnectionLimiter: class {
    acquire(): boolean {
      return true
    }
    release(): void {}
  },
}))
vi.mock('../src/plugins/ws-auto-recovery.js', () => ({
  getWsAutoRecoveryManager: () => ({ setFastify: () => {}, registerPlugin: () => {} }),
}))

import { metricsPlugin } from '../src/plugins/metrics.js'
import { wsBroadcast } from '../src/plugins/ws-broadcast.js'

const USER_A = 'aaaaaaaa-1111-4111-8111-111111111111'
const DROPPED_METRIC = 'ws_broadcast_dropped_frames_total'
const DISCONNECTS_METRIC = 'ws_disconnects_total'

/** 与 Fastify 装饰出来的那份 metrics 同一类型 —— 不抄字段清单,免得第二处真相。 */
type MetricsBag = FastifyInstance['metrics']

interface FakeSocket {
  sent: string[]
  send: (msg: string, cb?: (err?: Error) => void) => void
  on: (ev: string, cb: () => void) => void
  close: () => void
  emitClose: () => void
}

type FailMode = 'none' | 'throw' | 'callback'

/** 取 Prometheus 文本里某个指标的值行(`# HELP` / `# TYPE` 以 `#` 开头,天然不匹配)。 */
function metricValue(text: string, name: string): number {
  const line = text.split('\n').find((l) => l.startsWith(`${name} `))
  expect(line, `metrics 文本里找不到 ${name} 的值行`).toBeDefined()
  const raw = line?.slice(name.length + 1).trim()
  const value = Number(raw)
  expect(Number.isFinite(value), `${name} 的值不是数字:${String(raw)}`).toBe(true)
  return value
}

/** 一次 /metrics 读到的两枚计数器(具名键,不用 Record ⇒ 不引入"可能 undefined"的索引访问)。 */
interface Counters {
  /** ws_broadcast_dropped_frames_total:丢帧且摘线 */
  dropped: number
  /** ws_disconnects_total:连接从注册表里少了一次 */
  disconnects: number
}

async function metricValues(app: FastifyInstance): Promise<Counters> {
  const res = await app.inject({ method: 'GET', url: '/metrics' })
  expect(res.statusCode).toBe(200)
  return {
    dropped: metricValue(res.body, DROPPED_METRIC),
    disconnects: metricValue(res.body, DISCONNECTS_METRIC),
  }
}

/**
 * 把真实 metricsPlugin 挂上 Fastify,并把 app.metrics 同一个对象喂给 ws-broadcast 插件。
 * 每条用例一个新 harness ⇒ 计数器从 0 起,增量断言与仓库当前状态无关。
 */
async function buildHarness(): Promise<{
  app: FastifyInstance
  metrics: MetricsBag
  values: () => Promise<Counters>
  broadcast: (event?: string, data?: unknown) => void
  connect: (failMode: FailMode) => Promise<FakeSocket>
}> {
  const app = Fastify()
  await app.register(metricsPlugin)
  await app.ready()
  const metrics = app.metrics
  expect(metrics, 'metricsPlugin 未装饰 server.metrics').toBeTruthy()

  let broadcast: ((userId: string, event: string, data: unknown) => void) | null = null
  let routeHandler: ((socket: FakeSocket, request: unknown) => Promise<void>) | null = null

  // 只 fake 插件用到的四个入口;metrics 用 app.metrics 那一份 ⇒ 写与读同一个对象。
  const server = {
    metrics,
    log: { warn: (_fields: Record<string, unknown>, _msg: string): void => {} },
    decorate(name: string, fn: unknown): void {
      if (name === 'broadcastToUser') broadcast = fn as (u: string, e: string, d: unknown) => void
    },
    get(_url: string, _opts: unknown, handler: unknown): void {
      routeHandler = handler as (socket: FakeSocket, request: unknown) => Promise<void>
    },
  }

  await (wsBroadcast as unknown as (s: unknown, o: unknown) => Promise<void>)(server, {})
  if (!broadcast || !routeHandler) throw new Error('ws-broadcast 未装饰/未注册路由')

  const makeSocket = (failMode: FailMode): FakeSocket => {
    const handlers: Record<string, Array<() => void>> = {}
    const socket: FakeSocket = {
      sent: [],
      send: (msg: string, cb?: (err?: Error) => void) => {
        // 真实 ws 在连接已关时把错误交给 callback 而非抛出 —— 两条路径都要覆盖。
        if (failMode === 'throw') throw new Error('socket is closed')
        if (failMode === 'callback') {
          cb?.(new Error('WebSocket was closed before the message was sent'))
          return
        }
        socket.sent.push(msg)
        cb?.()
      },
      on: (ev: string, cb: () => void) => {
        ;(handlers[ev] ??= []).push(cb)
      },
      close: () => {},
      emitClose: () => {
        for (const fn of handlers.close ?? []) fn()
      },
    }
    return socket
  }

  const connect = async (failMode: FailMode): Promise<FakeSocket> => {
    const socket = makeSocket(failMode)
    await routeHandler!(socket, { query: { token: 'x' } })
    return socket
  }

  return {
    app,
    metrics,
    values: () => metricValues(app),
    broadcast: (event = 'tick', data: unknown = { n: 1 }) => broadcast!(USER_A, event, data),
    connect,
  }
}

describe('ws_broadcast_dropped_frames_total:丢帧必须是可查询的独立信号', () => {
  it('① 基线:一次成功广播 ⇒ 新计数器为 0,且断开计数不变', async () => {
    const h = await buildHarness()
    const base = await h.values()
    expect(base.dropped).toBe(0)

    const healthy = await h.connect('none')
    h.broadcast()

    expect(healthy.sent).toHaveLength(1)
    const after = await h.values()
    expect(after.dropped).toBe(0)
    expect(after.disconnects).toBe(base.disconnects)
    await h.app.close()
  })

  it('② 失败一帧 ⇒ 新计数与断开计数成对各 +1(新计数在 /metrics 文本里恰为 1)', async () => {
    const h = await buildHarness()
    const base = await h.values()
    expect(base.dropped).toBe(0)
    expect(base.disconnects).toBe(0)

    await h.connect('callback')
    h.broadcast()

    const after = await h.values()
    expect(after.dropped).toBe(1)
    // 成对递增:一次摘线确实是一次断开,既有语义一个字都不改
    expect(after.disconnects).toBe(base.disconnects + 1)
    await h.app.close()
  })

  it('③ 同批次其余健康连接照样收到帧,广播主流程不抛错也不中断', async () => {
    const h = await buildHarness()
    const healthy = await h.connect('none')
    await h.connect('callback')
    await h.connect('throw')

    expect(() => h.broadcast()).not.toThrow()

    expect(healthy.sent).toHaveLength(1)
    expect((await h.values()).dropped).toBe(2)
    await h.app.close()
  })

  it('④a callback 报错形态 ⇒ 新计数 +1', async () => {
    const h = await buildHarness()
    await h.connect('callback')
    h.broadcast()
    expect((await h.values()).dropped).toBe(1)
    await h.app.close()
  })

  it('④b 同步抛出形态 ⇒ 新计数同样 +1(不得只覆盖一种)', async () => {
    const h = await buildHarness()
    await h.connect('throw')
    h.broadcast()
    expect((await h.values()).dropped).toBe(1)
    await h.app.close()
  })

  it('⑤ 已被摘掉的陈旧连接不再产生第二枚丢帧计数(注册表确实清了)', async () => {
    const h = await buildHarness()
    const dead = await h.connect('callback')
    h.broadcast()
    h.broadcast()
    expect((await h.values()).dropped).toBe(1)
    // 该 socket 的 close 事件走的是插件自己的清理路径,不应再补一刀丢帧计数
    dead.emitClose()
    h.broadcast()
    expect((await h.values()).dropped).toBe(1)
    await h.app.close()
  })
})

describe('metrics.ts 三处成套(HELP / TYPE / 值行 / 初始化块 / 类型声明块)', () => {
  const source = readFileSync(
    fileURLToPath(new URL('../src/plugins/metrics.ts', import.meta.url)),
    'utf8',
  )

  it('输出块三行成套且顺序为 HELP → TYPE → 值', () => {
    const help = `# HELP ${DROPPED_METRIC} `
    const type = `# TYPE ${DROPPED_METRIC} counter`
    // 值行写成一行或被 prettier 折行都算在位(判据是内容不是排版)
    const valueRe = new RegExp(
      `lines\\.push\\(\\s*` +
        '`' +
        `${DROPPED_METRIC} \\$\\{metrics\\.wsBroadcastDroppedFramesTotal\\}` +
        '`' +
        `\\s*\\)`,
    )
    const iHelp = source.indexOf(help)
    const iType = source.indexOf(type)
    const iValue = source.search(valueRe)

    expect(iHelp, `缺 ${help}(HELP 行被摘)`).toBeGreaterThan(-1)
    expect(iType, `缺 ${type}(TYPE 行被摘)`).toBeGreaterThan(-1)
    expect(iValue, `缺值行 lines.push(\`${DROPPED_METRIC} …\`)`).toBeGreaterThan(-1)
    expect(iHelp).toBeLessThan(iType)
    expect(iType).toBeLessThan(iValue)
    // HELP 必须是英文一句话且写清"每一枚递增同时摘掉那条连接",不能是空占位
    const helpLine = source.slice(iHelp, source.indexOf('\n', iHelp))
    expect(helpLine).toContain('socket was already dead')
    expect(helpLine).toContain('each increment also removes that connection')
    expect(helpLine).not.toMatch(/[一-鿿]/)
  })

  it('字段在 metrics 初始化块与 server.decorate 类型声明块都在位', () => {
    const initStart = source.indexOf('const metrics = {')
    const initEnd = source.indexOf("server.addHook('onRequest'")
    expect(initStart).toBeGreaterThan(-1)
    expect(initEnd).toBeGreaterThan(initStart)
    const initBlock = source.slice(initStart, initEnd)
    expect(initBlock).toContain('wsBroadcastDroppedFramesTotal: 0,')

    const typeStart = source.indexOf('metrics: {')
    const typeEnd = source.indexOf('setWebsocketConnections', typeStart)
    expect(typeStart).toBeGreaterThan(-1)
    expect(typeEnd).toBeGreaterThan(typeStart)
    const typeBlock = source.slice(typeStart, typeEnd)
    expect(typeBlock).toContain('wsBroadcastDroppedFramesTotal: number')
  })

  it('计数器是"真被调用"的:插件源码里两处 += 1 同时在场', () => {
    const plugin = readFileSync(
      fileURLToPath(new URL('../src/plugins/ws-broadcast.ts', import.meta.url)),
      'utf8',
    )
    expect(plugin).toContain('server.metrics.wsBroadcastDroppedFramesTotal += 1')
    // 既有语义不得被悄悄摘掉(成对递增)
    expect(plugin).toContain('server.metrics.wsDisconnectsTotal += 1')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
