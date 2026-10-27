// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * desktop 端跨端任务接收器的行为锁(`apps/desktop/src/lib/task-receiver.ts`)。
 *
 * 这一族此前零覆盖:desktop 是 Tauri 薄壳,本地没有 React,也不在各包的 vitest
 * `tests/**` 收集面里 ⇒ 这个 424 行的协议层从未被任何判据跑过。它守的是三条用户可见语义
 * (换一台设备不该看到别人的任务 / 断线重连不该丢任务 / 审批票只给该给的那两台设备),
 * 三条都以"**没有**发生什么"为正确方向 —— 正是最容易安静失效的一类,所以断言一律盯
 * 可观察结果(发出去了哪些请求、列表里留下了哪几条),不盯内部字段。
 *
 * 跑法(cwd = 仓库根):`node --test apps/desktop/src/lib/__tests__/task-receiver.test.mjs`
 *
 * 为什么是 `.mjs` + `registerHooks` 而不是 vitest:`apps/desktop` 没有 vitest 依赖(薄壳包
 * 只装 tauri cli),而仓库里已有同形先例(`apps/cli/src/tools/__tests__/*.test.mjs` 用同一套
 * `node --test` + 解析钩子)。钩子只做两件事,且都走"盘上不存在才改写"的窄判据:
 *  ① `<dir>/x.js` 不存在而同目录 `x.ts` 存在 ⇒ 改写成 `x.ts`(TS 源码面用 .js 说明符);
 *  ② `@ihui/shared/...` ⇒ `<repo>/packages/shared/src/...`(该包在本壳的 node_modules 里没有符号链接)。
 * 钩子只在测试进程内生效,不动任何产品配置。
 */
import { after, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { registerHooks } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

function findRepoRoot() {
  let dir = path.dirname(fileURLToPath(import.meta.url))
  for (let i = 0; i < 12; i += 1) {
    if (existsSync(path.join(dir, 'pnpm-workspace.yaml')) && existsSync(path.join(dir, 'package.json'))) {
      return dir
    }
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error('找不到仓库根(往上 12 层没同时命中 package.json 与 pnpm-workspace.yaml)')
}

const REPO_ROOT = findRepoRoot()
const SHARED_SRC = path.join(REPO_ROOT, 'packages', 'shared', 'src')
const LIB_DIR = path.join(REPO_ROOT, 'apps', 'desktop', 'src', 'lib')

/** 把 `<abs>.js` 改写成同名 `.ts`;真 .js 存在就原样返回 null(不做模糊匹配)。 */
function asTs(absPath) {
  if (!absPath.endsWith('.js')) return null
  const tsPath = `${absPath.slice(0, -3)}.ts`
  return !existsSync(absPath) && existsSync(tsPath) ? tsPath : null
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.startsWith('file:')) {
      const parentDir = path.dirname(fileURLToPath(context.parentURL))
      if (specifier.startsWith('.')) {
        const ts = asTs(path.resolve(parentDir, specifier))
        if (ts) return { url: pathToFileURL(ts).href, format: 'module-typescript', shortCircuit: true }
      }
      if (specifier.startsWith('@ihui/shared/')) {
        const sub = specifier.slice('@ihui/shared/'.length)
        const abs = path.join(SHARED_SRC, sub)
        const ts = asTs(abs) ?? (existsSync(`${abs}.ts`) ? `${abs}.ts` : null)
        if (ts) return { url: pathToFileURL(ts).href, format: 'module-typescript', shortCircuit: true }
      }
    }
    return nextResolve(specifier, context)
  },
})

const receiverModule = await import(pathToFileURL(path.join(LIB_DIR, 'task-receiver.ts')).href)
const { DesktopTaskReceiver, upsertIncremental } = receiverModule

// 钩子/装载的正向凭据:导出面不在 ⇒ 后续断言全是空气。
assert.equal(typeof DesktopTaskReceiver, 'function', 'DesktopTaskReceiver 未导出 ⇒ 装载路径不对')
assert.equal(typeof upsertIncremental, 'function', 'upsertIncremental 未导出 ⇒ 装载路径不对')

// ==================== 夹具 ====================

const API = 'https://api.test/api'
const WS = 'wss://api.test/ws/notifications'

/** 内存 storage(与 localStorage 同形)。 */
function makeStorage(seed = {}) {
  const map = new Map(Object.entries(seed))
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    raw: map,
  }
}

/** 记录每一次 fetch 的调用(一个都不许漏:断言看的是"发没发",不是"返回了什么")。 */
function makeFetch(handler = () => ({ ok: true, status: 200, json: async () => ({}) })) {
  const calls = []
  const impl = async (url, init = {}) => {
    calls.push({ url, method: init.method ?? 'GET', body: init.body, headers: init.headers ?? {} })
    return handler(url, init)
  }
  impl.calls = calls
  return impl
}

/** 可编程 WebSocket:测试自己决定何时 open / message / close。 */
function makeWsClass() {
  const instances = []
  class FakeWs {
    constructor(url) {
      this.url = url
      this.closed = false
      this.onopen = null
      this.onclose = null
      this.onerror = null
      this.onmessage = null
      instances.push(this)
    }
    close() {
      this.closed = true
      this.onclose?.()
    }
    emit(obj) {
      this.onmessage?.({ data: typeof obj === 'string' ? obj : JSON.stringify(obj) })
    }
    open() {
      this.onopen?.()
    }
  }
  FakeWs.instances = instances
  return FakeWs
}

function task(id, over = {}) {
  return {
    id,
    userId: 'user-1',
    fromDevice: 'dev-a',
    toDevice: 'dev-self',
    command: 'echo hi',
    status: 'pending',
    createdAt: '2026-10-28T00:00:00.000Z',
    updatedAt: '2026-10-28T00:00:00.000Z',
    ...over,
  }
}

function approvalTicket(over = {}) {
  return {
    delegationId: 'd-1',
    originDeviceId: 'dev-a',
    targetDeviceId: 'dev-self',
    seq: 3,
    state: 'awaiting',
    createdAtMs: 0,
    ...over,
  }
}

const DEVICE_ID = 'dev-self'

function makeReceiver(over = {}) {
  const storage = over.storage ?? makeStorage({ 'ihui-device-id': DEVICE_ID })
  const fetchImpl = over.fetchImpl ?? makeFetch()
  const wsImpl = over.wsImpl ?? makeWsClass()
  const changes = { tasks: [], connection: [] }
  const receiver = new DesktopTaskReceiver({
    apiBaseUrl: API,
    wsUrl: WS,
    deviceType: 'desktop',
    storage,
    fetchImpl,
    wsImpl,
    onTasksChange: (t) => changes.tasks.push(t),
    onConnectionChange: (c) => changes.connection.push(c),
    ...over,
  })
  created.push(receiver)
  return { receiver, storage, fetchImpl, wsImpl, changes }
}

const tick = () => new Promise((r) => setTimeout(r, 0))

const created = []
after(() => { for (const r of created) r.stop() })

// ==================== upsertIncremental(纯函数) ====================

describe('upsertIncremental', () => {
  it('丢弃不属于本设备也不是 all 的任务', () => {
    const seen = new Set()
    const next = upsertIncremental([], [task('t1', { toDevice: 'dev-other' })], DEVICE_ID, seen)
    assert.deepEqual(next, [])
    assert.equal(seen.has('t1'), false, '被过滤掉的任务不得进 seenIds(否则以后真投递也会被当重复)')
  })

  it('toDevice=all 的广播任务照收', () => {
    const next = upsertIncremental([], [task('t1', { toDevice: 'all' })], DEVICE_ID, new Set())
    assert.deepEqual(next.map((t) => t.id), ['t1'])
  })

  it('无变化时返回同一个数组引用(渲染层据此避免无谓重排)', () => {
    const prev = [task('t1')]
    const same = upsertIncremental(prev, [], DEVICE_ID, new Set())
    assert.equal(same, prev)
  })

  it('同 id 且 updatedAt 更新才替换;更旧的一律保留原值', () => {
    const prev = [task('t1', { status: 'running', updatedAt: '2026-10-28T00:00:10.000Z' })]
    const newer = upsertIncremental(
      prev,
      [task('t1', { status: 'done', updatedAt: '2026-10-28T00:00:20.000Z' })],
      DEVICE_ID,
      new Set(),
    )
    assert.equal(newer[0].status, 'done')

    const older = upsertIncremental(
      prev,
      [task('t1', { status: 'stale', updatedAt: '2026-10-28T00:00:01.000Z' })],
      DEVICE_ID,
      new Set(),
    )
    assert.equal(older[0].status, 'running', '更旧的快照不得覆盖较新的状态')
  })

  it('新任务排在前、既有任务保持原序(不因补拉而重排列表)', () => {
    const prev = [task('a'), task('b')]
    const next = upsertIncremental(prev, [task('c')], DEVICE_ID, new Set())
    assert.deepEqual(next.map((t) => t.id), ['c', 'a', 'b'])
  })
})

// ==================== DesktopTaskReceiver ====================

describe('DesktopTaskReceiver: 设备身份', () => {
  it('同一 storage 复用同一 deviceId(刷新页面不该变成"新设备")', () => {
    const storage = makeStorage()
    const first = new DesktopTaskReceiver({ apiBaseUrl: API, wsUrl: WS, deviceType: 'desktop', storage })
    const second = new DesktopTaskReceiver({ apiBaseUrl: API, wsUrl: WS, deviceType: 'desktop', storage })
    assert.equal(first.deviceId, second.deviceId)
    assert.equal(storage.getItem('ihui-device-id'), first.deviceId)
  })

  it('无 token 时不联网:一个请求都不发、一条 WS 都不建', async () => {
    const { receiver, fetchImpl, wsImpl } = makeReceiver()
    receiver.start(null)
    await tick()
    assert.equal(fetchImpl.calls.length, 0)
    assert.equal(wsImpl.instances.length, 0)
  })
})

describe('DesktopTaskReceiver: 注册与连接', () => {
  it('start(token) 注册设备:带 Bearer 头,body 里是本机身份', async () => {
    const { receiver, fetchImpl } = makeReceiver()
    receiver.start('tok-1')
    await tick()
    const reg = fetchImpl.calls.find((c) => c.url.endsWith('/tasks/register-device'))
    assert.ok(reg, '未发出注册请求')
    assert.equal(reg.method, 'POST')
    assert.equal(reg.headers.Authorization, 'Bearer tok-1')
    const body = JSON.parse(reg.body)
    assert.equal(body.deviceId, DEVICE_ID)
    assert.equal(body.type, 'desktop')
    assert.equal(body.name, `Desktop-${DEVICE_ID.slice(0, 8)}`)
    receiver.stop()
  })

  it('WS 地址带经 URL 编码的 token(令牌里的特殊字符不许破坏查询串)', async () => {
    const { receiver, wsImpl } = makeReceiver()
    receiver.start('a b&c=d')
    await tick()
    assert.equal(wsImpl.instances.length, 1)
    assert.equal(wsImpl.instances[0].url, `${WS}?token=${encodeURIComponent('a b&c=d')}`)
    receiver.stop()
  })

  it('onopen 置连接态,onclose 复位;连接态只在变化时回调一次', async () => {
    const { receiver, wsImpl, changes } = makeReceiver()
    receiver.start('tok')
    await tick()
    const ws = wsImpl.instances[0]
    ws.open()
    ws.onopen?.()
    assert.equal(receiver.getState().isConnected, true)
    ws.close()
    assert.equal(receiver.getState().isConnected, false)
    assert.deepEqual(changes.connection, [true, false], '同一状态的重复 set 不得重复回调')
  })
})

describe('DesktopTaskReceiver: WS 消息分流', () => {
  it('task-dispatch 只收本机或 all 的任务', async () => {
    const { receiver, wsImpl } = makeReceiver()
    receiver.start('tok')
    await tick()
    const ws = wsImpl.instances[0]
    ws.emit({ type: 'task-dispatch', taskId: 't1', payload: task('t1') })
    ws.emit({ type: 'task-dispatch', taskId: 't2', payload: task('t2', { toDevice: 'dev-other' }) })
    assert.deepEqual(receiver.getState().tasks.map((t) => t.id), ['t1'])
    receiver.stop()
  })

  it('未知消息类型与非 JSON 文本一律忽略(不许把坏帧当任务)', async () => {
    const { receiver, wsImpl } = makeReceiver()
    receiver.start('tok')
    await tick()
    const ws = wsImpl.instances[0]
    ws.emit({ type: 'something-else', taskId: 'x', payload: task('x') })
    ws.emit('{not json')
    assert.deepEqual(receiver.getState().tasks, [])
    receiver.stop()
  })

  it('task-cancelled 把既有任务改成 cancelled', async () => {
    const { receiver, wsImpl } = makeReceiver()
    receiver.start('tok')
    await tick()
    const ws = wsImpl.instances[0]
    ws.emit({ type: 'task-dispatch', taskId: 't1', payload: task('t1') })
    ws.emit({
      type: 'task-cancelled',
      taskId: 't1',
      payload: task('t1', { updatedAt: '2026-10-28T00:01:00.000Z' }),
    })
    assert.equal(receiver.getState().tasks[0].status, 'cancelled')
    receiver.stop()
  })

  it('task-approval 不做 toDevice 过滤,但只在 audience 内的设备可见', async () => {
    const { receiver, wsImpl } = makeReceiver()
    receiver.start('tok')
    await tick()
    const ws = wsImpl.instances[0]
    // 票的两端都不是本机 ⇒ 本机不该看见
    ws.emit({
      type: 'task-approval',
      taskId: 't1',
      payload: task('t1', { toDevice: 'dev-other', approval: approvalTicket({ originDeviceId: 'dev-a', targetDeviceId: 'dev-b' }) }),
    })
    assert.deepEqual(receiver.getState().tasks, [])
    // 本机是 target,但 toDevice 指向别处 ⇒ 仍必须看见(审批跟人,不跟设备标签)
    ws.emit({
      type: 'task-approval',
      taskId: 't2',
      payload: task('t2', { toDevice: 'dev-other', approval: approvalTicket({ delegationId: 'd-2' }) }),
    })
    assert.deepEqual(receiver.getState().tasks.map((t) => t.id), ['t2'])
    receiver.stop()
  })
})

describe('DesktopTaskReceiver: 待审批与答票', () => {
  async function withApprovalTask(over = {}) {
    const ctx = makeReceiver(over)
    ctx.receiver.start('tok')
    await tick()
    ctx.wsImpl.instances[0].emit({
      type: 'task-approval',
      taskId: 't1',
      payload: task('t1', { approval: approvalTicket() }),
    })
    return ctx
  }

  it('pendingApprovals 只含 awaiting 且在 audience 内的票', async () => {
    const ctx = await withApprovalTask()
    assert.deepEqual(ctx.receiver.pendingApprovals().map((t) => t.id), ['t1'])
    ctx.receiver.stop()
  })

  it('没有审批票的任务:如实拒绝,且不发出任何请求', async () => {
    const ctx = makeReceiver()
    ctx.receiver.start('tok')
    await tick()
    const before = ctx.fetchImpl.calls.length
    const res = await ctx.receiver.answerApproval('nope', true)
    assert.equal(res.ok, false)
    assert.equal(res.message, '该委派没有待审的票')
    assert.equal(ctx.fetchImpl.calls.length, before, '没有票就不该发审批请求')
    ctx.receiver.stop()
  })

  it('未登录时拒绝提交(不许发出无凭据的审批请求)', async () => {
    const ctx = await withApprovalTask()
    const anonymous = new DesktopTaskReceiver({
      apiBaseUrl: API,
      wsUrl: WS,
      deviceType: 'desktop',
      storage: makeStorage({ 'ihui-device-id': DEVICE_ID }),
      fetchImpl: ctx.fetchImpl,
    })
    assert.equal((await anonymous.answerApproval('t1', true)).ok, false, '空列表下应报"没有票"')
    ctx.receiver.stop()
  })

  it('提交体带本机票面 seq 与 deviceId(先答者胜由服务端裁定,本端只如实上报)', async () => {
    const ctx = await withApprovalTask()
    const res = await ctx.receiver.answerApproval('t1', true)
    const post = ctx.fetchImpl.calls.find((c) => c.url.endsWith('/tasks/t1/approval'))
    assert.ok(post, '未发出审批请求')
    assert.equal(post.method, 'POST')
    assert.equal(post.headers.Authorization, 'Bearer tok')
    assert.deepEqual(JSON.parse(post.body), { decision: true, seq: 3, deviceId: DEVICE_ID })
    assert.deepEqual(res, { ok: true, message: '已放行' })
    ctx.receiver.stop()
  })

  it('服务端未生效时把原因透出来,不谎报成功', async () => {
    const ctx = await withApprovalTask({
      fetchImpl: makeFetch(() => ({
        ok: true,
        status: 200,
        json: async () => ({ verdict: 'stale', reason: '票已被别人先答' }),
      })),
    })
    const res = await ctx.receiver.answerApproval('t1', false)
    assert.deepEqual(res, { ok: false, message: '票已被别人先答' })
    ctx.receiver.stop()
  })

  it('HTTP 非 2xx 时报出状态码', async () => {
    const ctx = await withApprovalTask({
      fetchImpl: makeFetch(() => ({ ok: false, status: 409, json: async () => ({}) })),
    })
    assert.deepEqual(await ctx.receiver.answerApproval('t1', true), {
      ok: false,
      message: '审批提交失败(409)',
    })
    ctx.receiver.stop()
  })

  it('网络异常被收敛成结果对象,不向上抛(调用方是 UI 点击)', async () => {
    const ctx = await withApprovalTask({
      fetchImpl: makeFetch(() => {
        throw new Error('socket hang up')
      }),
    })
    const res = await ctx.receiver.answerApproval('t1', true)
    assert.equal(res.ok, false)
    assert.match(res.message, /socket hang up/)
    ctx.receiver.stop()
  })
})

describe('DesktopTaskReceiver: 断线重连补拉', () => {
  it('上次落盘 lastSeenTs 存在时,重连即按 since 补拉,并吞掉不属于本机的任务', async () => {
    const storage = makeStorage({
      'ihui-device-id': DEVICE_ID,
      'task-last-seen-ts': '1761600000000',
    })
    const fetchImpl = makeFetch((url) => {
      if (url.includes('/tasks?since=')) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            task('t1', { updatedAt: '2026-10-28T00:00:05.000Z' }),
            task('t2', { toDevice: 'dev-other' }),
          ],
        }
      }
      return { ok: true, status: 200, json: async () => ({}) }
    })
    const { receiver, wsImpl } = makeReceiver({ storage, fetchImpl })
    receiver.start('tok')
    await tick()
    wsImpl.instances[0].open()
    await tick()
    const refill = fetchImpl.calls.find((c) => c.url.includes('/tasks?since='))
    assert.ok(refill, '重连未触发增量补拉')
    assert.ok(refill.url.endsWith('since=1761600000000'))
    assert.deepEqual(receiver.getState().tasks.map((t) => t.id), ['t1'])
    assert.ok(Number(storage.getItem('task-last-seen-ts')) >= Date.parse('2026-10-28T00:00:05.000Z'))
    receiver.stop()
  })

  it('没有 lastSeenTs 时不做全量补拉(避免首次连上就把历史任务灌进来)', async () => {
    const { receiver, fetchImpl, wsImpl } = makeReceiver()
    receiver.start('tok')
    await tick()
    wsImpl.instances[0].open()
    await tick()
    assert.equal(fetchImpl.calls.some((c) => c.url.includes('/tasks?since=')), false)
    receiver.stop()
  })
})

describe('DesktopTaskReceiver: stop()', () => {
  it('注销设备并断开 WS', async () => {
    const { receiver, fetchImpl, wsImpl } = makeReceiver()
    receiver.start('tok')
    await tick()
    receiver.stop()
    await tick()
    const unregister = fetchImpl.calls.find((c) => c.url.endsWith(`/tasks/devices/${DEVICE_ID}`))
    assert.ok(unregister, 'stop 未注销设备')
    assert.equal(unregister.method, 'DELETE')
    assert.equal(wsImpl.instances[0].closed, true)
  })
})

