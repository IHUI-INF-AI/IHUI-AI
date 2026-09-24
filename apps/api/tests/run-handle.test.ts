// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import {
  DEFAULT_RUN_HANDLE_TTL_SECONDS,
  RUN_HANDLE_REJECT_STATUS,
  RUN_HANDLE_PREFIX,
  issueRunHandle,
  parseRunHandle,
  type RunHandleReject,
} from '../src/services/run-handle.js'
import { CURSOR_PREFIX, isCursorToken } from '../src/services/cursor-pagination.js'

/**
 * O10② 外部 run 句柄:签发/解析 + 失败分类。
 * 重点是"解析失败必须区分格式非法与存在但无权",且两条都不是 500。
 */

const SECRET = 'unit-handle-secret'
const OWNER = 'user:42'
const RUN_ID = 'run_2f1c3d4e-5b6a-4c7d-8e9f-0a1b2c3d4e5f'

function issue(
  over: Partial<{ runId: string; ownerKey: string; nowSeconds: number; ttlSeconds: number }> = {},
): string {
  return issueRunHandle({
    runId: over.runId ?? RUN_ID,
    ownerKey: over.ownerKey ?? OWNER,
    secret: SECRET,
    ...(over.nowSeconds === undefined ? {} : { nowSeconds: over.nowSeconds }),
    ...(over.ttlSeconds === undefined ? {} : { ttlSeconds: over.ttlSeconds }),
  })
}

/** 把联合类型的 `reason` 取值收在一处,免得每个用例都做一次窄化。 */
function outcomeOf(token: unknown, ownerKey: string = OWNER): 'ok' | RunHandleReject {
  const parsed = parseRunHandle(token, { ownerKey, secret: SECRET })
  return parsed.ok ? 'ok' : parsed.reason
}

describe('issueRunHandle / parseRunHandle', () => {
  it('往返:解出的正是内部 runId;同输入同输出(重放等值的前提)', () => {
    const handle = issue()
    expect(handle.startsWith(`${RUN_HANDLE_PREFIX}_`)).toBe(true)
    expect(parseRunHandle(handle, { ownerKey: OWNER, secret: SECRET })).toEqual({
      ok: true,
      runId: RUN_ID,
    })
    expect(issue()).toBe(handle)
  })

  it('句柄里读不出内部 runId,也不含 session 字样,长度有界', () => {
    const handle = issue()
    expect(handle).not.toContain(RUN_ID)
    expect(handle.toLowerCase()).not.toContain('session')
    expect(handle.length).toBeLessThan(512)
  })

  it('A 的句柄在 B 的请求里判 foreign-owner(无权,而非读到别人的东西)', () => {
    expect(outcomeOf(issue(), 'user:43')).toBe('foreign-owner')
  })

  it('篡改 body 一个字符 → signature', () => {
    const handle = issue()
    const dot = handle.lastIndexOf('.')
    const body = handle.slice(RUN_HANDLE_PREFIX.length + 1, dot)
    const suffix = handle.slice(dot)
    const flipped = body.startsWith('A') ? `B${body.slice(1)}` : `A${body.slice(1)}`
    expect(outcomeOf(`${RUN_HANDLE_PREFIX}_${flipped}${suffix}`)).toBe('signature')
  })

  it('过期 → expired;缺省 TTL 是 7 天', () => {
    const handle = issue({ nowSeconds: 1_000, ttlSeconds: 100 })
    const parsed = parseRunHandle(handle, { ownerKey: OWNER, secret: SECRET, nowSeconds: 1_200 })
    expect(parsed).toEqual({ ok: false, reason: 'expired' })
    expect(DEFAULT_RUN_HANDLE_TTL_SECONDS).toBe(7 * 24 * 3600)
  })

  it('换密钥解不开(签名密钥是唯一信任根)', () => {
    const parsed = parseRunHandle(issue(), { ownerKey: OWNER, secret: 'other-secret' })
    expect(parsed).toEqual({ ok: false, reason: 'signature' })
  })

  it('格式非法的五种形态都判 malformed', () => {
    for (const token of [
      undefined,
      42,
      'runh_nodothere',
      'runh_.sig',
      `${RUN_HANDLE_PREFIX}_${'y'.repeat(600)}.sig`,
    ]) {
      expect(outcomeOf(token)).toBe('malformed')
    }
  })

  it('跨类型不可替换:游标不是句柄,句柄也不是游标', () => {
    const handle = issue()
    expect(isCursorToken(handle)).toBe(false)
    expect(handle.startsWith(`${CURSOR_PREFIX}_`)).toBe(false)
    expect(outcomeOf(`${CURSOR_PREFIX}_YWJj.sig`)).toBe('malformed')
  })

  it('HTTP 映射:格式类 400 / 无权类 404,两类都不是 500', () => {
    expect(RUN_HANDLE_REJECT_STATUS.malformed).toBe(400)
    expect(RUN_HANDLE_REJECT_STATUS.signature).toBe(400)
    expect(RUN_HANDLE_REJECT_STATUS.expired).toBe(400)
    expect(RUN_HANDLE_REJECT_STATUS['foreign-owner']).toBe(404)
  })

  it('相邻 runId 产出的句柄完全不同(不可靠观察推下一个)', () => {
    const bodyOf = (token: string): string =>
      token.slice(RUN_HANDLE_PREFIX.length + 1, token.lastIndexOf('.'))
    const a = issue({ runId: 'run_00000000-0000-4000-8000-000000000001' })
    const b = issue({ runId: 'run_00000000-0000-4000-8000-000000000002' })
    // 前 8 字符**必然相同** —— 那是 base64url(`["run_`) 的固定前缀,拿它当"不可预测"是错的尺子。
    // 真正防遍历的是签名段:同一密钥下不同 runId 必须产出不同签名,且整枚句柄不同。
    expect(bodyOf(a)).not.toBe(bodyOf(b))
    expect(a.slice(a.lastIndexOf('.') + 1)).not.toBe(b.slice(b.lastIndexOf('.') + 1))
    expect(a).not.toBe(b)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
