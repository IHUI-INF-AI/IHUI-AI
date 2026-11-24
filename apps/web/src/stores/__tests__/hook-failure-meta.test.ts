// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-87 补链(2026-10-29):hook 执行失败记录的**落桶**与**读回**端到端测试。
 *
 * 覆盖 store 动作(`appendMessageHookFailure`)与渲染层读出口
 * (`hookFailureRecordsFromMeta`)之间那一格 —— 这两头此前各自都有实现、中间没有
 * 落点,于是判定层 2026-09-24 交付后一直是死代码。
 *
 * 三条硬约束逐条钉住(票面要求):
 *   ① 追加不覆盖:只重写 `meta.hookFailures` 一个键,`meta` 其余键逐字保留;
 *   ② 幂等:同一条失败重复到达(重连/重放)不得重复追加,键 = `record.id`;
 *   ③ 没有稳定 id 的记录不落桶(用下标当键会把"重放的同一帧"算成新的一条)。
 *
 * 另有一条**链路**断言:落桶后的 meta 真能被 `hookFailureRecordsFromMeta` 读出六态记录
 * (不是"store 里有个数组"就算通 —— 渲染层的收窄会丢弃认不出的 state)。
 */

import { describe, it, expect, beforeEach } from 'vitest'

import { useChatStore } from '../chat'
import { hookFailureRecordsFromMeta } from '@/components/chat/message-list/hook-failure-card'

const MSG_ID = 'm-hook-1'

function seed(): void {
  useChatStore.setState({
    messages: [
      {
        id: MSG_ID,
        role: 'assistant',
        content: '',
        createdAt: Date.now(),
        // meta 里先放两个"别人的键":本动作不得把它们抹掉
        meta: { usage: { totalTokens: 42 }, fallbackNotice: 'from-primary' },
      },
    ],
    currentModel: 'gpt-4o-mini',
    isStreaming: false,
    error: null,
    conversationId: null,
  })
}

function record(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    state: 'failed',
    hookName: 'lint 检查',
    hookEvent: 'tool.after',
    command: 'npm run lint',
    stderr: '3 problems',
    exitCode: 2,
    durationMs: 1234,
    failedAt: '2026-10-29T10:00:00Z',
    ...over,
  }
}

describe('appendMessageHookFailure(G-87 落桶)', () => {
  beforeEach(seed)

  it('追加到 meta.hookFailures,且 meta 里其余键逐字保留', () => {
    useChatStore.getState().appendMessageHookFailure(MSG_ID, record('hk-1::t::tool.after'))
    const msg = useChatStore.getState().messages[0]!
    const meta = msg.meta as Record<string, unknown>
    expect(Array.isArray(meta.hookFailures)).toBe(true)
    expect(meta.hookFailures).toHaveLength(1)
    // 关键:整体替换 meta 会顺手抹掉这两个键(usage 是高频写入位)
    expect(meta.usage).toEqual({ totalTokens: 42 })
    expect(meta.fallbackNotice).toBe('from-primary')
  })

  it('多条不同 id ⇒ 按到达顺序追加(不是覆盖)', () => {
    useChatStore.getState().appendMessageHookFailure(MSG_ID, record('a::t1::tool.after'))
    useChatStore.getState().appendMessageHookFailure(MSG_ID, record('b::t2::tool.before'))
    const list = (useChatStore.getState().messages[0]!.meta as Record<string, unknown>)
      .hookFailures as Array<{ id: string }>
    expect(list.map((x) => x.id)).toEqual(['a::t1::tool.after', 'b::t2::tool.before'])
  })

  it('同 id 重复到达 ⇒ 幂等丢弃(重连/重放不重复追加)', () => {
    const rec = record('hk-1::t::tool.after')
    useChatStore.getState().appendMessageHookFailure(MSG_ID, rec)
    useChatStore.getState().appendMessageHookFailure(MSG_ID, rec)
    useChatStore.getState().appendMessageHookFailure(MSG_ID, rec)
    const list = (useChatStore.getState().messages[0]!.meta as Record<string, unknown>)
      .hookFailures as unknown[]
    expect(list).toHaveLength(1)
  })

  it('同 id 再次到达 ⇒ 连 messages 数组引用都不重建(值等价即不写)', () => {
    const rec = record('hk-1::t::tool.after')
    useChatStore.getState().appendMessageHookFailure(MSG_ID, rec)
    const before = useChatStore.getState().messages
    useChatStore.getState().appendMessageHookFailure(MSG_ID, rec)
    expect(useChatStore.getState().messages).toBe(before)
  })

  it('空 id / 纯空白 id ⇒ 不落桶(不许用下标当键)', () => {
    useChatStore.getState().appendMessageHookFailure(MSG_ID, record(''))
    useChatStore.getState().appendMessageHookFailure(MSG_ID, record('   '))
    const meta = useChatStore.getState().messages[0]!.meta as Record<string, unknown>
    expect(meta.hookFailures).toBeUndefined()
  })

  it('消息不存在 ⇒ no-op(不抛、不凭空造消息)', () => {
    const before = useChatStore.getState().messages
    expect(() =>
      useChatStore.getState().appendMessageHookFailure('no-such-msg', record('x::t::e')),
    ).not.toThrow()
    expect(useChatStore.getState().messages).toBe(before)
  })

  it('meta 原本没有 hookFailures ⇒ 从空数组起算(不是 undefined 崩)', () => {
    useChatStore.setState({
      messages: [{ id: MSG_ID, role: 'assistant', content: '', createdAt: 1 }],
    })
    useChatStore.getState().appendMessageHookFailure(MSG_ID, record('z::t::e'))
    const meta = useChatStore.getState().messages[0]!.meta as Record<string, unknown>
    expect(meta.hookFailures).toHaveLength(1)
  })
})

describe('落桶 → 渲染层读回(整链)', () => {
  beforeEach(seed)

  it('store 落好的 meta ⇒ hookFailureRecordsFromMeta 读得出六态记录', () => {
    useChatStore.getState().appendMessageHookFailure(MSG_ID, record('hk-1::t::tool.after'))
    const meta = useChatStore.getState().messages[0]!.meta
    const records = hookFailureRecordsFromMeta(meta)

    expect(records).toHaveLength(1)
    expect(records[0]!.state).toBe('failed')
    expect(records[0]!.id).toBe('hk-1::t::tool.after')
    expect(records[0]!.context).toMatchObject({
      hookName: 'lint 检查',
      hookEvent: 'tool.after',
      command: 'npm run lint',
      stderr: '3 problems',
      exitCode: 2,
      durationMs: 1234,
    })
  })

  it('timedOut 那一档同样读得出(且 exitCode/stderr 为 null = "没有",不是 0)', () => {
    useChatStore.getState().appendMessageHookFailure(
      MSG_ID,
      record('hk-2::t::tool.before', {
        state: 'timedOut',
        command: 'sleep 60',
        stderr: undefined,
        exitCode: undefined,
      }),
    )
    const records = hookFailureRecordsFromMeta(useChatStore.getState().messages[0]!.meta)
    expect(records).toHaveLength(1)
    expect(records[0]!.state).toBe('timedOut')
    expect(records[0]!.context?.exitCode).toBeNull()
    expect(records[0]!.context?.stderr).toBeNull()
    expect(records[0]!.context?.command).toBe('sleep 60')
  })

  it('渲染层收窄生效:store 里混进表外 state ⇒ 该条被丢弃,合法那条仍出现', () => {
    useChatStore.getState().appendMessageHookFailure(MSG_ID, record('good::t::e'))
    // 直写一条伪造状态(模拟"远端送了个我们没登记的状态")
    const msg = useChatStore.getState().messages[0]!
    const meta = msg.meta as Record<string, unknown>
    const withBad = {
      ...meta,
      hookFailures: [...(meta.hookFailures as unknown[]), { id: 'bad::t::e', state: 'exploded' }],
    }
    const records = hookFailureRecordsFromMeta(withBad)
    expect(records).toHaveLength(1)
    expect(records[0]!.id).toBe('good::t::e')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
