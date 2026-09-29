// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D154(2026-09-30 立)`mcp:status` 帧的构造与解析回归。
 * 权威口径:`docs/AI_CHAT_BENCHMARK_ANALYSIS_V4.md` §11.3(载体同 D153)+ §十 D154 第 3/6 栏。
 *
 * 钉住的四格,每一格都对应一个"账面绿而用户看不见"的失效:
 *  A **构造点在位且拒坏值**:未知 state / 空 server / 只给 attempt 不给 maxAttempts
 *    都必须抛。放过去,端上拿到的是渲染不出句子的一帧(词表按 state 取词)。
 *  B **载荷里没有主体**:带 `userId` / `user_id` 的一律判不合法(AGENTS §5「认证不等于授权」)。
 *    收信人由承载层决定,发帧方自报的身份结构上无处可去。
 *  C **解析侧与构造侧同一套规则**:`parseUserBroadcastFrame` 必须认这一帧,
 *    且把构造侧放过的坏值同样拦下 —— 两侧两套标准 = 生产面绿、消费面红。
 *  D **未知事件名不得被静默吞掉**:不认识的那一帧必须走 `__undetermined`
 *    (D154 之后事件清单扩到两档,而"扩档时把旧的判据挤没了"正是这类回归的入口)。
 */
import { describe, it, expect } from 'vitest'

import {
  MCP_CONNECTION_STATES,
  USER_BROADCAST_EVENT_NAMES,
  isMcpConnectionState,
  mcpStatusEvent,
  parseUserBroadcastFrame,
} from '../src/user-broadcast'

describe('D154 A 构造出口在位且拒坏值', () => {
  it('封闭集恰为四档(connecting / connected / failed / reconnecting)', () => {
    expect([...MCP_CONNECTION_STATES].sort()).toEqual(
      ['connected', 'connecting', 'failed', 'reconnecting'].sort(),
    )
    for (const s of MCP_CONNECTION_STATES) expect(isMcpConnectionState(s)).toBe(true)
    // 票明确 OAuth completed 本票不做:它不许被顺手当成第五档塞进封闭集
    expect(isMcpConnectionState('oauth_completed')).toBe(false)
  })

  it('正向:最小合法帧逐字成形', () => {
    const evt = mcpStatusEvent({ server: 'github', state: 'failed', reason: '进程已退出' })
    expect(evt).toEqual({
      event: 'mcp:status',
      data: { server: 'github', state: 'failed', reason: '进程已退出' },
    })
  })

  it('反向:未知 state / 空 server / 只有分子的 attempt 都抛(不产出渲染不出的帧)', () => {
    expect(() => mcpStatusEvent({ server: 'a', state: 'exploded' as never })).toThrow(/未知状态/)
    expect(() => mcpStatusEvent({ server: '   ', state: 'failed' })).toThrow(/不得为空/)
    expect(() => mcpStatusEvent({ server: 'a', state: 'reconnecting', attempt: 2 })).toThrow(
      /maxAttempts/,
    )
    expect(() =>
      mcpStatusEvent({ server: 'a', state: 'reconnecting', attempt: 0, maxAttempts: 3 }),
    ).toThrow(/attempt 非法/)
  })

  it('给了 tools 但全被滤空 ⇒ 丢掉该键(留着会被端上读成"这次用不到")', () => {
    const evt = mcpStatusEvent({ server: 'a', state: 'connected', tools: ['  ', ''] })
    expect('tools' in evt.data).toBe(false)
  })
})

describe('D154 B 主体不得从载荷进来', () => {
  it('载荷里出现 userId / user_id ⇒ 整帧判不合法(parse 返回 null)', () => {
    const base = { event: 'mcp:status', data: { server: 'a', state: 'failed' } }
    expect(parseUserBroadcastFrame({ ...base, data: { ...base.data, userId: 'u' } })).toBeNull()
    expect(parseUserBroadcastFrame({ ...base, data: { ...base.data, user_id: 'u' } })).toBeNull()
    // 阳性对照:同一帧去掉那两个键必须被认出 —— 否则上面两条是因为"整个函数不认 mcp:status"而绿
    expect(parseUserBroadcastFrame(base)).not.toBeNull()
  })
})

describe('D154 C 解析侧与构造侧同一套规则', () => {
  it('正向:合法帧被认出,且 payload 形状原样', () => {
    const evt = mcpStatusEvent({ server: 'fs', state: 'reconnecting', attempt: 1, maxAttempts: 3 })
    const parsed = parseUserBroadcastFrame(evt)
    expect(parsed).not.toBeNull()
    expect(parsed?.event).toBe('mcp:status')
    if (parsed && parsed.event === 'mcp:status') expect(parsed.data.attempt).toBe(1)
  })

  it('反向:未知 state / 半对 attempt / 非字符串 tools / 空 server 都拒', () => {
    const bad = (data: Record<string, unknown>): unknown =>
      parseUserBroadcastFrame({ event: 'mcp:status', data })
    expect(bad({ server: 'fs', state: 'nope' })).toBeNull()
    expect(bad({ server: 'fs', state: 'reconnecting', attempt: 2 })).toBeNull()
    expect(bad({ server: 'fs', state: 'failed', tools: [1, 2] })).toBeNull()
    expect(bad({ server: '', state: 'failed' })).toBeNull()
    // 同一批数据里"合法那一帧"必须解析得出来 —— 防止判据整体失明(空扫不等于通过)
    expect(bad({ server: 'fs', state: 'failed', tools: ['read_file'] })).not.toBeNull()
  })
})

describe('D154 D 事件清单与未知事件名', () => {
  it('权威清单含两档,且 mcp:status 真在里面(扩档不得把 D153 那一档挤掉)', () => {
    expect(USER_BROADCAST_EVENT_NAMES).toContain('conversation:updated')
    expect(USER_BROADCAST_EVENT_NAMES).toContain('mcp:status')
  })

  it('不认识的事件名不静默通过(parse 返回 null)', () => {
    expect(parseUserBroadcastFrame({ event: 'mcp:oauth-completed', data: { server: 'a' } })).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
