// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * fetchApi 行为基线对账(2026-09-25 立,起因:`setUnauthorizedHandler` 补能力票)。
 *
 * 本票的等价性底线是「**未注册钩子时,`fetchApi` 的行为与改动前逐字节一致**」。
 * "测试跑绿"不等于"行为没变" —— 所以这里不写"期望值由人脑补"的断言,而是把改动
 * **之前**(HEAD 版 client.ts,尚无任何 unauthorized 钩子)实测到的四情形快照原样
 * 钉成 `BASELINE`,改动后重新采集并逐字比。
 *
 * 采集/复核方式(可复现,零人工转录):
 *   CAPTURE_BASELINE=1 pnpm --filter @ihui/api-client exec vitest run tests/fetch-api-baseline.test.ts
 * 输出的 `@@BASELINE@@<场景>@@{…}` 行即快照,与下方 `BASELINE` 逐字对照即可。
 *
 * 快照覆盖面(缺一面就测不出"副作用被顺手改了"):
 *   - `result`         调用方拿到的 ApiResult(含 status / errorCode 等可选键)
 *   - `transportCalls` 每次真正发出的请求(url / method / headers),含重试次数与
 *                      重试时携带的 Authorization(续期成功应换新 token)
 *   - `refreshCalls`   401 续期被调用了几次
 * `undefined` 键显式序列化为 `<<undefined>>`:JSON.stringify 默认会丢掉值为 undefined
 * 的键,"新增一个值为 undefined 的可选字段"这种形态变化就检不出来。
 */

import { describe, it, expect, afterEach } from 'vitest'
import {
  fetchApi,
  setTokenProvider,
  setUnauthorizedHandler,
  getUnauthorizedHandler,
  __resetRefreshStateForTest,
} from '../src/client.js'
import { setTransport, type Transport, type TransportResponse } from '../src/transport.js'

type Scenario = 'ok200' | 'refresh-then-ok' | 'refresh-fails' | 'network-error'

interface Snapshot {
  /** ApiResult 的稳定序列化(字符串,使比对是逐字比对而非"对象松比对") */
  result: string
  /** 实际发出的每个请求(含重试) */
  transportCalls: string
  /** refreshAccessToken 被调用的次数 */
  refreshCalls: number
}

/** 稳定序列化:显式保留值为 undefined 的键,使"新增可选字段"也能被逐字比出来 */
function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) => (v === undefined ? '<<undefined>>' : v))
}

function jsonResponse(status: number, body: unknown): TransportResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    text: async () => JSON.stringify(body),
    json: async () => body,
  } as unknown as TransportResponse
}

/**
 * 采集一个场景的行为快照。
 * `capture()` 本身只走 fetchApi + transport + tokenProvider 三件套,不注册任何钩子 ——
 * 所以同一份采集器在改动前后都能跑,基线才不是"改动后自己写的期望值"。
 */
async function capture(scenario: Scenario): Promise<Snapshot> {
  const calls: Array<{ url: string; method: string | undefined; headers: Record<string, string> }> =
    []
  let refreshCalls = 0

  const transport: Transport = async (url, init) => {
    // headers 在重试时被就地改写(续期成功后换 Authorization),必须逐次浅拷贝才看得到差异
    calls.push({ url, method: init.method, headers: { ...(init.headers as Record<string, string>) } })
    if (scenario === 'ok200') return jsonResponse(200, { code: 0, message: 'ok', data: { id: 'x' } })
    if (scenario === 'network-error') throw new Error('boom')
    // 两个 401 场景:首发必 401
    if (calls.length === 1) return jsonResponse(401, { code: 40101, message: '登录已过期' })
    return jsonResponse(200, { code: 0, message: 'ok', data: { id: 'retry' } })
  }
  setTransport(transport)

  setTokenProvider({
    getToken: () => 'expired-token',
    refreshAccessToken: async () => {
      refreshCalls++
      if (scenario === 'refresh-fails') return null
      return 'fresh-token'
    },
  })

  const result = await fetchApi<{ id: string }>('/things', { method: 'POST' })

  return {
    result: stableStringify(result),
    transportCalls: stableStringify(calls),
    refreshCalls,
  }
}

const SCENARIOS: Scenario[] = ['ok200', 'refresh-then-ok', 'refresh-fails', 'network-error']

/**
 * 改动前(HEAD 版 client.ts)实测采集的四情形快照 —— 由
 * `CAPTURE_BASELINE=1` 那趟运行原样导出,非手写。
 * 若本票改动让任意一格发生变化,下面的用例会变红并逐字指出差异。
 */
const BASELINE: Record<Scenario, Snapshot> = {
  'ok200': {
    result: '{"success":true,"data":{"id":"x"},"status":200}',
    transportCalls:
      '[{"url":"/api/things","method":"POST","headers":{"Authorization":"Bearer expired-token","X-Requested-With":"XMLHttpRequest"}}]',
    refreshCalls: 0,
  },
  'refresh-then-ok': {
    result: '{"success":true,"data":{"id":"retry"},"status":200}',
    transportCalls:
      '[{"url":"/api/things","method":"POST","headers":{"Authorization":"Bearer expired-token","X-Requested-With":"XMLHttpRequest"}},{"url":"/api/things","method":"POST","headers":{"Authorization":"Bearer fresh-token","X-Requested-With":"XMLHttpRequest"}}]',
    refreshCalls: 1,
  },
  'refresh-fails': {
    result:
      '{"success":false,"error":"登录已过期","status":401,"errorCode":"<<undefined>>","retryAfter":"<<undefined>>"}',
    transportCalls:
      '[{"url":"/api/things","method":"POST","headers":{"Authorization":"Bearer expired-token","X-Requested-With":"XMLHttpRequest"}}]',
    refreshCalls: 1,
  },
  'network-error': {
    result: '{"success":false,"error":"boom"}',
    transportCalls:
      '[{"url":"/api/things","method":"POST","headers":{"Authorization":"Bearer expired-token","X-Requested-With":"XMLHttpRequest"}},{"url":"/api/things","method":"POST","headers":{"Authorization":"Bearer expired-token","X-Requested-With":"XMLHttpRequest"}}]',
    refreshCalls: 0,
  },
}

describe('fetchApi 四情形行为基线(未注册 unauthorized 钩子时必须逐字相等)', () => {
  afterEach(() => {
    setTransport(undefined as unknown as Transport)
    setTokenProvider({ getToken: () => null })
    setUnauthorizedHandler(null)
    __resetRefreshStateForTest()
  })

  for (const scenario of SCENARIOS) {
    it(`${scenario}: 返回 / 请求副作用 / 续期次数 与基线逐字相等`, async () => {
      // 前提自证:本用例测的是"未注册"这一档 —— 处理器此刻必须确实为 null,
      // 否则它就是在替 unauthorized-handler.test.ts 的残留状态背书。
      expect(getUnauthorizedHandler()).toBeNull()
      const captured = await capture(scenario)
      if (process.env.CAPTURE_BASELINE === '1') {
        console.info(`@@BASELINE@@${scenario}@@${stableStringify(captured)}`)
      }
      expect(captured).toEqual(BASELINE[scenario])
    })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
