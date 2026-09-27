// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 出站重试判据出口 `utils/egress-retry-safety.ts` 的回归钉(2026-09-27 立)。
// 纯静态 + 纯运行时对象,不连库、不连 Redis、不发网络请求(§5 测试隔离铁律)。
//
// 夹具取材口径(AGENTS §22c:判"形态"的判据,输入必须逐字取自真实形态,不能只复刻实现形状):
// 传输层错误一律按**本机实测的 Node/undici 真实链形**构造 —— 顶层恒为 `TypeError('fetch failed')`
// 且自身无 code,真实 errno 住在 `cause.code`(`connect ECONNREFUSED 127.0.0.1:59999` /
// `getaddrinfo ENOTFOUND <host>`);`AbortSignal.timeout(ms)` 抛的是 **DOMException
// name='TimeoutError'**,`controller.abort()` 抛的是 **DOMException name='AbortError'** ——
// 后两枚直接从运行时取(`signal.reason`),不手搓,免得夹具与真运行时同形不同名。
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  classifyEgressRetryOutcome,
  EGRESS_RETRY_DECISIONS,
  type EgressRetryVerdict,
} from '../src/utils/egress-retry-safety.js'

/** 复刻 undici 的真实包装链:顶层 TypeError('fetch failed') → cause 带 Node errno。 */
const undiciFailure = (code: string, message: string): TypeError =>
  new TypeError('fetch failed', { cause: Object.assign(new Error(message), { code }) })

/** 运行时真取一枚 TimeoutError(AbortSignal.timeout 到期时挂在 signal.reason 上的 DOMException)。 */
async function realTimeoutError(): Promise<unknown> {
  const signal = AbortSignal.timeout(5)
  await new Promise<void>((resolve) => {
    if (signal.aborted) return resolve()
    signal.addEventListener('abort', () => resolve(), { once: true })
  })
  return signal.reason
}

/** 运行时真取一枚 AbortError(controller.abort() 的 reason)。 */
function realAbortError(): unknown {
  const controller = new AbortController()
  controller.abort()
  return controller.signal.reason
}

const transport = (error: unknown, responseReceived?: boolean) =>
  classifyEgressRetryOutcome({ kind: 'transport-failure', error, responseReceived })

const http = (status: number, idempotent?: boolean) =>
  classifyEgressRetryOutcome({ kind: 'http-response', status, idempotent })

describe('retry-safe:建连阶段白名单(请求字节必未发出)', () => {
  it('ECONNREFUSED(实测 cause 消息 `connect ECONNREFUSED <host>:<port>`)⇒ retry-safe', () => {
    const verdict = transport(undiciFailure('ECONNREFUSED', 'connect ECONNREFUSED 127.0.0.1:59999'))
    expect(verdict.decision).toBe('retry-safe')
  })

  it('ENOTFOUND / EAI_AGAIN(getaddrinfo 两档,地址都没拿到)⇒ retry-safe', () => {
    expect(
      transport(undiciFailure('ENOTFOUND', 'getaddrinfo ENOTFOUND no-such-host.local')).decision,
    ).toBe('retry-safe')
    expect(
      transport(undiciFailure('EAI_AGAIN', 'getaddrinfo EAI_AGAIN ai-service.local')).decision,
    ).toBe('retry-safe')
  })

  it('happy-eyeballs 的 AggregateError:真实码藏在 errors[] 里也必须被走到', () => {
    const aggregate = new TypeError('fetch failed', {
      cause: new AggregateError(
        [undiciFailure('ECONNREFUSED', 'connect ECONNREFUSED 127.0.0.1:59999')],
        'Connections failed',
      ),
    })
    expect(transport(aggregate).decision).toBe('retry-safe')
  })
})

describe('result-unknown:超时/取消/写出后中断 ⇒ 绝不自动重放', () => {
  it('真 AbortSignal.timeout 抛的 TimeoutError ⇒ result-unknown(不重试)', async () => {
    const verdict = transport(await realTimeoutError())
    expect(verdict.decision).toBe('result-unknown')
    expect(verdict.reason).toContain('TimeoutError')
  })

  it('真 controller.abort() 抛的 AbortError ⇒ result-unknown(不重试)', () => {
    const verdict = transport(realAbortError())
    expect(verdict.decision).toBe('result-unknown')
    expect(verdict.reason).toContain('AbortError')
  })

  it('已拿到 Response 后读到一半断流 ⇒ result-unknown,与错误码无关', () => {
    const verdict = transport(undiciFailure('ECONNRESET', 'read ECONNRESET'), true)
    expect(verdict.decision).toBe('result-unknown')
  })

  it('ECONNRESET / ETIMEDOUT 无 connect 阶段证据 ⇒ result-unknown;有证据 ⇒ retry-safe', () => {
    expect(transport(undiciFailure('ECONNRESET', 'socket hang up')).decision).toBe('result-unknown')
    expect(
      transport(undiciFailure('ECONNRESET', 'connect ECONNRESET 127.0.0.1:59999')).decision,
    ).toBe('retry-safe')
    expect(transport(undiciFailure('ETIMEDOUT', 'read ETIMEDOUT')).decision).toBe('result-unknown')
    expect(
      transport(
        undiciFailure(
          'ETIMEDOUT',
          'connect ETIMEDOUT 10.0.0.1:443 (Connection attempts timed out)',
        ),
      ).decision,
    ).toBe('retry-safe')
  })

  it('TLS 握手未完成的复位 ⇒ retry-safe(证据是 connect 阶段)', () => {
    const message =
      'Client network socket disconnected before secure TLS connection was established'
    expect(transport(undiciFailure('ECONNRESET', message)).decision).toBe('retry-safe')
  })

  it('判不出即 result-unknown:任何无码无名的异常都不得被判成可重试', () => {
    for (const error of [new Error('boom'), {}, 'plain string', null, undefined]) {
      expect(transport(error).decision).toBe('result-unknown')
    }
  })

  it('环状/超长 cause 链不得让判据卡死或翻成 retry-safe(取证上限只朝保守侧失效)', () => {
    const first = undiciFailure('ECONNRESET', 'socket hang up')
    const second = new Error('wrap', { cause: first })
    Object.assign(first, { cause: second })
    expect(transport(first).decision).toBe('result-unknown')
  })
})

describe('permanent-fail:没发出且重放必然同样失败', () => {
  it('URL 根本没解析开(ERR_INVALID_URL,实测 cause.code)⇒ permanent-fail', () => {
    const error = new TypeError('Failed to parse URL from not-a-url', {
      cause: Object.assign(new TypeError('Invalid URL'), { code: 'ERR_INVALID_URL' }),
    })
    expect(transport(error).decision).toBe('permanent-fail')
  })

  it('4xx 明确拒绝(400/401/403/404)⇒ permanent-fail;幂等与否都一样', () => {
    for (const status of [400, 401, 403, 404]) {
      expect(http(status).decision).toBe('permanent-fail')
      expect(http(status, true).decision).toBe('permanent-fail')
    }
  })
})

describe('http-response:状态码维(幂等安全集合按幂等性分档)', () => {
  it('408 / 425 / 429 ⇒ retry-safe(服务端明确未进入业务处理)', () => {
    for (const status of [408, 425, 429]) {
      expect(http(status).decision).toBe('retry-safe')
      expect(http(status, true).decision).toBe('retry-safe')
    }
  })

  it('5xx 对非幂等请求 ⇒ result-unknown(对侧可能已经跑完)', () => {
    for (const status of [500, 502, 503, 504]) {
      expect(http(status).decision).toBe('result-unknown')
    }
  })

  it('5xx 对幂等请求 ⇒ retry-safe(重放无副作用)', () => {
    for (const status of [500, 502, 503, 504]) {
      expect(http(status, true).decision).toBe('retry-safe')
    }
  })
})

describe('出口形状契约(reason 单行、不外带原始 message、判定落在三态闭集)', () => {
  const fixtures: unknown[] = [
    undiciFailure('ECONNREFUSED', 'connect ECONNREFUSED 127.0.0.1:59999'),
    undiciFailure('ENOTFOUND', 'getaddrinfo ENOTFOUND token:sekret@ai-service.local'),
    undiciFailure('ECONNRESET', 'socket hang up'),
    new Error('boom'),
  ]

  it('每条 fixture 的 decision 都在三态闭集内,reason 是一行且不含地址/凭据', () => {
    for (const error of fixtures) {
      const verdict: EgressRetryVerdict = transport(error)
      expect(EGRESS_RETRY_DECISIONS).toContain(verdict.decision)
      expect(verdict.reason).not.toContain('\n')
      expect(verdict.reason.length).toBeGreaterThan(0)
      // 原始 message 带对端地址与主机名(URL 里可能有 query 凭据)⇒ 一律不得外带
      expect(verdict.reason).not.toMatch(/127\.0\.0\.1|ai-service\.local|sekret/)
    }
  })

  it('三态两两可区分:同一批输入不得把"没判"折叠成"可以重试"', () => {
    const decisions = fixtures.map((error) => transport(error).decision)
    expect(decisions.filter((d) => d === 'retry-safe').length).toBeGreaterThan(0)
    expect(decisions.filter((d) => d === 'result-unknown').length).toBeGreaterThan(0)
  })
})

describe('webhooks-trigger 的重试判定必须走唯一出口(反第二真相当场锁)', () => {
  const route = readFileSync(
    fileURLToPath(new URL('../src/routes/webhooks-trigger.ts', import.meta.url)),
    'utf8',
  )
  const codeFace = route.replace(/\/\/[^\n]*/g, '')

  it('路由 import 并调用出口,重试闸门只认 retry-safe', () => {
    expect(codeFace).toContain("from '../utils/egress-retry-safety.js'")
    expect(codeFace).toContain('classifyEgressRetryOutcome(')
    expect(codeFace).toContain("=== 'retry-safe'")
  })

  it('路由侧不得再写一份错误分类(instanceof / 错误码字面量都不许出现)', () => {
    expect(codeFace).not.toMatch(/\binstanceof\b/)
    expect(codeFace).not.toMatch(/ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ECONNRESET|ETIMEDOUT/)
    expect(codeFace).not.toMatch(/TimeoutError|AbortError/)
  })

  it('守门 127 的停手登记注释必须仍在(不得被顺手删掉装作已修)', () => {
    expect(route).toContain('从未注册过')
    expect(route).toContain('/api/agents/execute')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
