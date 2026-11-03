// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D136(2026-10-01 立,承票面第 5 栏):审批决议的**副作用断言**(RN 端)。
//
// 票面要求:mock 高危工具调用,拒绝后断言副作用(文件写/命令执行桩)未被调用,
// **不只看错误码**。可自动化的事实链:高危工具的真实执行在服务端,客户端唯一能扳动
// 它的方式是送出 `decision: 'approve'` 的决议 —— 所以副作用桩挂在 postToolApprovalResponse
// 的 approve 分支上,断言打两处:载荷键级形状 + 桩调用次数(拒绝恒 0,批准正向对照 ≠ 0)。
// 渲染与 mock 手法与 tool-approval-rn-wiring.test.tsx 同一姿势(react-native 走端内桩)。
// @vitest-environment jsdom
import { act, render } from '@testing-library/react'
import { type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ToolApprovalEvent } from '@ihui/api-client'
import { I18nProvider, messages, getValueByPath } from '../src/i18n'
import { useToolApprovalQueue } from '../src/components/ai/ToolApprovalSheet'

const h = vi.hoisted(() => ({
  calls: [] as Array<Record<string, unknown>>,
  mode: 'ok' as 'ok' | 'fail',
  /** 副作用桩(高危工具执行,如文件写/命令执行):服务端收到 approve 决议才触发。 */
  executeTool: vi.fn(),
  modal: null as Record<string, unknown> | null,
}))

vi.mock('@ihui/api-client', async (importOriginal) => {
  const mod = await importOriginal<Record<string, unknown>>()
  return {
    ...mod,
    postToolApprovalResponse: async (payload: Record<string, unknown>) => {
      h.calls.push(payload)
      if (h.mode === 'fail') throw new Error('AI 服务未接受该决策(条目不存在/已失效)')
      if (payload.decision === 'approve') h.executeTool(payload.scope)
      return { ok: true }
    },
  }
})

vi.mock('react-native', async (importOriginal) => {
  const mod = await importOriginal<Record<string, unknown>>()
  const { createElement: ce } = await import('react')
  const Modal = (props: Record<string, unknown>) => {
    h.modal = props
    return props.visible === true
      ? ce('div', { 'data-modal-open': '1' }, props.children as ReactNode)
      : null
  }
  return { ...(mod as Record<string, unknown>), Modal }
})

const event = (over: Partial<ToolApprovalEvent> = {}): ToolApprovalEvent =>
  ({
    type: 'tool-approval',
    approvalId: 'ap-risk',
    toolName: 'run_command',
    toolCallId: 'tc-risk',
    argsPreview: '{"command":"rm -rf dist"}',
    dangerLevel: 'high',
    sessionId: 'sess-risk',
    ...over,
  }) as ToolApprovalEvent

let push: ((e: ToolApprovalEvent) => void) | null = null
function Host() {
  const api = useToolApprovalQueue()
  push = api.onToolApproval
  return <>{api.host}</>
}

function mount() {
  const view = render(
    <I18nProvider>
      <Host />
    </I18nProvider>,
  )
  const send = (e: ToolApprovalEvent) => {
    act(() => {
      push?.(e)
    })
  }
  const tap = (label: string) => {
    const found = [...view.container.querySelectorAll('button')].filter(
      (b) => b.textContent === label,
    )
    expect(found, `按钮未渲染:${label}`).toHaveLength(1)
    act(() => {
      found[0]!.click()
    })
  }
  const text = () => view.container.textContent ?? ''
  return { ...view, send, tap, text }
}

/** 期望文案取自真词包(与 I18nProvider 喂给 t() 的是同一份),缺键当场喊出来。 */
function realText(key: string): string {
  const raw = getValueByPath(messages['zh-CN'] as unknown, key)
  expect(typeof raw, `真词包缺键 ${key}`).toBe('string')
  const out = String(raw).replace(/\{(\w+)\}/g, '')
  expect(out.length, `真词包 ${key} 是空串`).toBeGreaterThan(0)
  return String(raw)
}

beforeEach(() => {
  h.calls.length = 0
  h.mode = 'ok'
  h.modal = null
  h.executeTool.mockClear()
  push = null
})

describe('D136 ⑥ 副作用:拒绝 ⇒ 高危工具执行桩零调用(不只看错误码)', () => {
  it('拒绝:桩零调用;载荷键级断言 decision=reject 且无 scope/grantRule;上行恰一条', async () => {
    const { send, tap } = mount()
    send(event())
    tap(realText('toolApproval.reject'))
    await act(async () => {})
    expect(h.executeTool).not.toHaveBeenCalled()
    expect(h.calls).toHaveLength(1)
    expect(h.calls[0]!.decision).toBe('reject')
    expect('scope' in h.calls[0]!, '拒绝不得携带授权作用域').toBe(false)
    expect('grantRule' in h.calls[0]!, '拒绝不得顺手写授权规则').toBe(false)
    expect(h.calls[0]).toMatchObject({ approvalId: 'ap-risk', sessionId: 'sess-risk' })
  })

  it('先选 always 再拒绝:授权档根本不进载荷(不是"忘了带",是"带不上"),桩恒零', async () => {
    const { send, tap } = mount()
    send(event())
    tap(realText('toolApproval.scopeAlways'))
    tap(realText('toolApproval.reject'))
    await act(async () => {})
    expect(h.executeTool).not.toHaveBeenCalled()
    expect('scope' in h.calls[0]!).toBe(false)
    expect(h.calls.filter((c) => c.decision === 'approve')).toHaveLength(0)
  })

  it('回传失败:桩零调用(没送出去的决议扳不动服务端执行),条目仍待决', async () => {
    h.mode = 'fail'
    const { send, tap, text } = mount()
    send(event({ approvalId: 'ap-nope' }))
    tap(realText('toolApproval.approve'))
    await act(async () => {})
    expect(h.executeTool).not.toHaveBeenCalled()
    expect(h.calls).toHaveLength(1)
    // 不静默当"已处理":失败文案在,条目仍在待决队列(面板还开着)
    expect(text()).toContain(realText('toolApproval.sendFailed'))
  })

  it('正向对照:批准 ⇒ 桩按所选档恰好执行一次(证明桩不是死的,拒绝路径的 0 是真 0)', async () => {
    const { send, tap } = mount()
    send(event({ approvalId: 'ap-ok' }))
    tap(realText('toolApproval.scopeSession'))
    tap(realText('toolApproval.approve'))
    await act(async () => {})
    expect(h.executeTool).toHaveBeenCalledTimes(1)
    expect(h.executeTool).toHaveBeenCalledWith('session')
    expect(h.calls[0]).toMatchObject({ decision: 'approve', scope: 'session' })
  })
})

// 批准这一档必须被"送到服务端"证成:上面那条只证 session 落得下去,这里逐名钉 once / always
// 两档的 wire 载荷,并钉"批准只结自己那一条"——队列里另一条既不能被顺手标成已回答,
// 也不能继承上一条的 always 授权(两条同时待决是 D136④ 那条"先后到达"没覆盖的形态)。
describe('D136 ⑦ 正向对照:批准的 wire 形状(scope 逐档送达 + 只结自己那条)', () => {
  it('不动档位直接批准:载荷 scope=once(最小特权显式送出,不留给后端缺省放大)', async () => {
    const { send, tap } = mount()
    send(event({ approvalId: 'ap-once' }))
    tap(realText('toolApproval.approve'))
    await act(async () => {})
    expect(h.calls).toHaveLength(1)
    expect(h.calls[0]).toMatchObject({
      decision: 'approve',
      scope: 'once',
      approvalId: 'ap-once',
      sessionId: 'sess-risk',
    })
    expect(h.executeTool).toHaveBeenCalledTimes(1)
    expect(h.executeTool).toHaveBeenCalledWith('once')
  })

  it('选 always 后批准:载荷 scope=always(授权档真的回传到底,不是只换个高亮)', async () => {
    const { send, tap } = mount()
    send(event({ approvalId: 'ap-always', toolName: 'write_file' }))
    tap(realText('toolApproval.scopeAlways'))
    tap(realText('toolApproval.approve'))
    await act(async () => {})
    expect(h.calls).toHaveLength(1)
    expect(h.calls[0]).toMatchObject({
      decision: 'approve',
      scope: 'always',
      approvalId: 'ap-always',
    })
    expect(h.executeTool).toHaveBeenCalledTimes(1)
    expect(h.executeTool).toHaveBeenCalledWith('always')
  })

  it('两条同时待决:批准第一条只送出第一条的决议,第二条仍待决且不继承 always', async () => {
    const { send, tap, text } = mount()
    send(event({ approvalId: 'ap-x', toolName: 'run_command' }))
    send(event({ approvalId: 'ap-y', toolName: 'write_file' }))
    tap(realText('toolApproval.scopeAlways'))
    tap(realText('toolApproval.approve'))
    await act(async () => {})

    // 服务端此刻只收到一条决议,且 approvalId 是被批的那条
    expect(h.calls).toHaveLength(1)
    expect(h.calls[0]).toMatchObject({ approvalId: 'ap-x', decision: 'approve', scope: 'always' })
    expect(h.executeTool).toHaveBeenCalledTimes(1)
    // 已回答记录卡只点名 ap-x;ap-y 没被顺手结掉(它成为当前待决项,记录里没有它的"批准"行)
    expect(text()).toContain(`run_command · ${realText('toolApproval.approve')}`)
    expect(text()).not.toContain(`write_file · ${realText('toolApproval.approve')}`)
    expect(text()).toContain('write_file')

    tap(realText('toolApproval.approve'))
    await act(async () => {})
    expect(h.calls).toHaveLength(2)
    expect(h.calls[1]).toMatchObject({ approvalId: 'ap-y', decision: 'approve', scope: 'once' })
    expect(h.executeTool).toHaveBeenLastCalledWith('once')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
