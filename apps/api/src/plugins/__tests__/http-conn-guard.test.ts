// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeEach } from 'vitest'
import { EventEmitter } from 'node:events'
import Fastify from 'fastify'
import { httpConnGuard, __test__ } from '../http-conn-guard.js'

const {
  tryAcquireSlot,
  releaseSlot,
  attachSlotReleaseOnClose,
  resolveMaxConnections,
  reset,
  activeIpCount,
  MAX_CONN_PER_IP,
} = __test__

beforeEach(() => {
  reset()
})

describe('tryAcquireSlot', () => {
  it('未达上限时逐个放行', () => {
    expect(tryAcquireSlot('1.1.1.1', 'r1', 2)).toBe(true)
    expect(tryAcquireSlot('1.1.1.1', 'r2', 2)).toBe(true)
  })

  it('达到上限后拒绝,且不把被拒请求记进集合', () => {
    expect(tryAcquireSlot('1.1.1.1', 'r1', 1)).toBe(true)
    expect(tryAcquireSlot('1.1.1.1', 'r2', 1)).toBe(false)
    // 释放 r1 后应当能再放一个:说明被拒的 r2 没有残留占位
    releaseSlot('1.1.1.1', 'r1')
    expect(tryAcquireSlot('1.1.1.1', 'r3', 1)).toBe(true)
  })

  it('并发计数按 IP 隔离', () => {
    expect(tryAcquireSlot('1.1.1.1', 'r1', 1)).toBe(true)
    expect(tryAcquireSlot('2.2.2.2', 'r1', 1)).toBe(true)
  })

  it('默认阈值远高于浏览器正常并发', () => {
    expect(MAX_CONN_PER_IP).toBeGreaterThanOrEqual(20)
  })
})

describe('releaseSlot', () => {
  it('集合空时删键,Map 不随 IP 数无限增长', () => {
    tryAcquireSlot('3.3.3.3', 'r1', 5)
    expect(activeIpCount()).toBe(1)
    releaseSlot('3.3.3.3', 'r1')
    expect(activeIpCount()).toBe(0)
  })

  it('释放未知 IP / 未知请求 id 不抛错', () => {
    expect(() => releaseSlot('4.4.4.4', 'nope')).not.toThrow()
    tryAcquireSlot('4.4.4.5', 'r1', 5)
    expect(() => releaseSlot('4.4.4.5', 'nope')).not.toThrow()
    expect(activeIpCount()).toBe(1)
  })

  it('同一请求重复释放不会把别人的槽一起减掉', () => {
    tryAcquireSlot('5.5.5.5', 'r1', 2)
    tryAcquireSlot('5.5.5.5', 'r2', 2)
    releaseSlot('5.5.5.5', 'r1')
    releaseSlot('5.5.5.5', 'r1')
    expect(tryAcquireSlot('5.5.5.5', 'r3', 2)).toBe(true)
  })
})

/**
 * 流式/SSE 归还通道(2026-10-28 补)。
 * 这些请求走 reply.hijack()：onResponse 不来、onRequestAbort 由 req.aborted 门控也不来，
 * 只有 reply.raw 的 close 能归还槽。缺这一通道，同一 IP 攒够阈值就会被自己的守卫打成 429。
 */
describe('attachSlotReleaseOnClose — 长连接存续期占槽', () => {
  function fakeReply() {
    const raw = new EventEmitter()
    return { raw, reply: { raw } }
  }

  it('连接没关就不归还：长连接占着槽', () => {
    const { reply } = fakeReply()
    reset()
    expect(tryAcquireSlot('6.6.6.6', 'sse-1', 1)).toBe(true)
    attachSlotReleaseOnClose(reply, '6.6.6.6', 'sse-1')
    expect(tryAcquireSlot('6.6.6.6', 'sse-2', 1)).toBe(false)
  })

  it('close 一到就归还：断线后同 IP 能再占', () => {
    const { raw, reply } = fakeReply()
    reset()
    tryAcquireSlot('7.7.7.7', 'sse-1', 1)
    attachSlotReleaseOnClose(reply, '7.7.7.7', 'sse-1')
    raw.emit('close')
    expect(activeIpCount()).toBe(0)
    expect(tryAcquireSlot('7.7.7.7', 'sse-2', 1)).toBe(true)
  })

  it('与 onResponse 双通道并存：close 之后钩子再释放也不双扣', () => {
    const { raw, reply } = fakeReply()
    reset()
    tryAcquireSlot('8.8.8.8', 'r1', 2)
    tryAcquireSlot('8.8.8.8', 'r2', 2)
    attachSlotReleaseOnClose(reply, '8.8.8.8', 'r1')
    raw.emit('close')
    releaseSlot('8.8.8.8', 'r1') // onResponse 那一路再来一次
    expect(activeIpCount()).toBe(1) // 只剩 r2，没有被双扣成负/误删
    expect(tryAcquireSlot('8.8.8.8', 'r3', 2)).toBe(true)
  })

  it('只归还自己那条：close 不误伤同 IP 的其他连接', () => {
    const { raw, reply } = fakeReply()
    reset()
    for (const id of ['keep-1', 'keep-2', 'keep-3']) {
      expect(tryAcquireSlot('9.9.9.9', id, 3)).toBe(true)
    }
    attachSlotReleaseOnClose(reply, '9.9.9.9', 'keep-1')
    raw.emit('close')
    // 腾出的只有 keep-1 那一格：再放一条恰好满，再多一条就拒
    expect(tryAcquireSlot('9.9.9.9', 'keep-4', 3)).toBe(true)
    expect(tryAcquireSlot('9.9.9.9', 'keep-5', 3)).toBe(false)
    // 误伤检查：若 close 把整个集合删空，这里会掉到 0
    expect(activeIpCount()).toBe(1)
  })
})

/**
 * 全局硬顶取值。核心是第 3 条：运维设 0 想关掉这道闸，必须真的关掉。
 * 写成 `Number(env) || DEFAULT` 的话 0 会被静默换成默认值 —— 配置读不出真实意图，
 * 而且没人会去查一个"看起来生效"的数字。
 */
describe('resolveMaxConnections', () => {
  it('未设 → 默认 20000', () => {
    expect(resolveMaxConnections(undefined)).toBe(20000)
  })

  it('空串与纯空白都按未设处理，不当成 0', () => {
    expect(resolveMaxConnections('')).toBe(20000)
    expect(resolveMaxConnections('   ')).toBe(20000)
  })

  it('0 是明确关闭，必须原样返回 0(不许被默认值顶掉)', () => {
    expect(resolveMaxConnections('0')).toBe(0)
    expect(resolveMaxConnections('0')).not.toBe(20000)
  })

  it('正常数字按值取', () => {
    expect(resolveMaxConnections('512')).toBe(512)
  })

  it('负数/非数字/Infinity 一律回落默认，不拧成 0 或 NaN', () => {
    expect(resolveMaxConnections('-1')).toBe(20000)
    expect(resolveMaxConnections('abc')).toBe(20000)
    expect(resolveMaxConnections('Infinity')).toBe(20000)
  })

  it('默认值可显式覆盖(供不同部署形态复用同一判据)', () => {
    expect(resolveMaxConnections(undefined, 1000)).toBe(1000)
    expect(resolveMaxConnections('bad', 1000)).toBe(1000)
  })
})

/**
 * onResponse 链存续(2026-10-29 立)。
 *
 * 上面各例全是纯函数判据 —— 它们全绿的同时,线上整条 onResponse 链已被本插件冻死约 6 小时:
 * metrics 的 by_status/by_method/by_route 与响应时间桶、business_api_call_total、api_logs 落库
 * 全部为零样本,而 active_connections 恒等于 requests_total(只加不减)。
 * 成因形态:Fastify 5.12.3 lib/hooks.js 的 hookRunnerGenerator 只在"返回值是 thenable"
 * 或"处理器自己调用 next"时才推进链;同步箭头函数两者都不满足 ⇒ 永不推进,
 * 而请求照常返回 200、一行日志都不留。本插件注册位(server.ts:623)排在全部 onResponse
 * 消费者之前,所以它一 stall 就把下游 11 个钩子一起按住。
 * 因此存续性必须按"真 Fastify 实例 + 真注册顺序"判,纯函数判据看不见这一格。
 */
describe('onResponse 链存续 —— 本插件不得冻住下游钩子', () => {
  it('真插件挂在下游 onResponse 之前,下游仍必须被调用,且槽同时归还', async () => {
    const app = Fastify()
    const seen: string[] = []
    await app.register(httpConnGuard)
    // 镜像生产顺序:conn-guard(623) → metrics/api-logger/business-metrics(817/821/824)
    app.addHook('onResponse', async () => {
      seen.push('downstream')
    })
    app.get('/probe', async () => ({ ok: 1 }))
    await app.ready()

    const res = await app.inject({ method: 'GET', url: '/probe' })
    expect(res.statusCode).toBe(200)
    expect(seen, '下游 onResponse 没跑 ⇒ 链被本插件冻住').toEqual(['downstream'])
    expect(activeIpCount()).toBe(0)

    await app.close()
  })

  it('变异自证:同步形态确实会冻住同一条链(把 release 的 async 摘掉即回到坏态)', async () => {
    const app = Fastify()
    const seen: string[] = []
    // 与修法唯一差别 = async 这个词;它必须能单独决定下游跑不跑,否则上面那条锁是假的
    app.addHook('onResponse', (request) => {
      void request
      seen.push('sync-first')
    })
    app.addHook('onResponse', async () => {
      seen.push('downstream')
    })
    app.get('/probe', async () => ({ ok: 1 }))
    await app.ready()

    const res = await app.inject({ method: 'GET', url: '/probe' })
    expect(res.statusCode).toBe(200) // 请求不报错 —— 所以这个失效型才是静默的
    expect(seen).toEqual(['sync-first'])

    await app.close()
  })

  // 形态判据(全 src 扫描)不在这里复算 —— 它住在守门 258 scripts/check-ddos-guard-wiring.mjs 的
  // W4(§0.6 单一真相源;那一档每次提交都跑,本文件只在 CI/手动 vitest 跑)。
  // 上面两条行为锁留在这里,因为它们必须有真 Fastify 实例才成立。
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
