// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-978066 残余格①(2026-10-10 立):web 审批门上的 `grantRule` 规则编辑器与原因输入搬到 RN 面板后,
// 这两件事必须在**上送载荷**上成立,不是"界面上出现了某个词":
//   · reason 填了就带、没填就**整键缺席**(写了空串 = 冒充"用户说了个空原因");
//   · grantRule 只在勾选 + 批准时带,形态固定为 { kind:'exec_prefix', tokens:2 };拒绝永不带;
//   · 开关只在 run_command 上出现 —— 另一条审批行(ChatDisclosure → sendToolApprovalResponse)
//     走网关,其 schema 会静默丢弃 grant_rule,在那儿摆开关才是缺陷,所以这里反向钉住"不在它身上";
//   · 高危命令勾选后必须先过二次确认,确认前一条决策都不许上送(AGENTS §30:决策面不能被绕过,
//     也不能替用户按下确认)。
// 断言全部打在 postToolApprovalResponse 实收到的 payload 上,期望文案一律取自**真词包**
// (与 I18nProvider 喂给 t() 的是同一份),测试内不手抄任何语言的中文。
// @vitest-environment jsdom
import { act, render } from '@testing-library/react'
import { type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ToolApprovalEvent } from '@ihui/api-client'
import { I18nProvider, messages, getValueByPath } from '../src/i18n'
import { useToolApprovalQueue } from '../src/components/ai/ToolApprovalSheet'

interface AlertCall {
  title: string
  message: string
  buttons: Array<{ text?: string; onPress?: () => void; style?: string }>
}

const h = vi.hoisted(() => ({
  /** 决策回传的唯一观察点:每条实收到的 payload 原样存下来 */
  calls: [] as Array<Record<string, unknown>>,
  alerts: [] as AlertCall[],
  /** 组件最后一次渲染时传给 TextInput 的 props(用来代填原因、并读回受控值) */
  input: null as Record<string, unknown> | null,
}))

// 别名 '@ihui/api-client' 在 vitest.config.ts 里直指真实源码,这里只换掉上行回传一个出口。
vi.mock('@ihui/api-client', async (importOriginal) => {
  const mod = await importOriginal<Record<string, unknown>>()
  return {
    ...mod,
    postToolApprovalResponse: async (payload: Record<string, unknown>) => {
      h.calls.push(payload)
      return { ok: true }
    },
  }
})

// react-native 走端内桩;桩里没有 Alert(原生确认框在 jsdom 不存在),TextInput 又不把
// onChangeText 交给 DOM —— 所以保留其余导出,替这三件:确认框记录到 h.alerts,
// 输入框把 props 交回给用例,Modal 只在 visible 时渲染。
vi.mock('react-native', async (importOriginal) => {
  const mod = await importOriginal<Record<string, unknown>>()
  const { createElement: ce } = await import('react')
  return {
    ...(mod as Record<string, unknown>),
    Modal: (props: Record<string, unknown>) =>
      props.visible === true
        ? ce('div', { 'data-modal-open': '1' }, props.children as ReactNode)
        : null,
    TextInput: (props: Record<string, unknown>) => {
      h.input = props
      return ce('input', { readOnly: true })
    },
    Alert: {
      alert: (title: string, message: string, buttons?: AlertCall['buttons']) => {
        h.alerts.push({ title, message, buttons: buttons ?? [] })
      },
    },
  }
})

/** 期望文案取自真词包(合并档):缺键当场喊,别把"词包没这条"读成"组件没渲染"。 */
function realText(key: string): string {
  const raw = getValueByPath(messages['zh-CN'] as unknown, key)
  expect(typeof raw, `真词包缺键 ${key}`).toBe('string')
  const text = String(raw)
  expect(text.length, `真词包 ${key} 是空串`).toBeGreaterThan(0)
  expect(text).not.toBe(key)
  return text
}

function filled(key: string, params: Record<string, string | number>): string {
  const out = realText(key).replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  )
  expect(out, `${key} 的插值位没代入:${out}`).not.toMatch(/\{\w+\}/)
  return out
}

const event = (over: Partial<ToolApprovalEvent> = {}): ToolApprovalEvent =>
  ({
    type: 'tool-approval',
    approvalId: 'ap-1',
    toolName: 'run_command',
    toolCallId: 'tc-1',
    argsPreview: 'pnpm test',
    dangerLevel: 'high',
    sessionId: 'sess-1',
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
  const send = (e: ToolApprovalEvent): void => {
    act(() => {
      push?.(e)
    })
  }
  const text = (): string => view.container.textContent ?? ''
  const tap = (label: string): void => {
    const found = [...view.container.querySelectorAll('button')].filter(
      (b) => b.textContent === label,
    )
    expect(found, `按钮文案未在真词包渲染出:${label}`).toHaveLength(1)
    act(() => {
      found[0]!.click()
    })
  }
  /** 代填原因:走组件自己的 onChangeText(受控输入的唯一合法入口) */
  const typeReason = (value: string): void => {
    const input = h.input as { onChangeText?: (v: string) => void } | null
    expect(input, '原因输入框未渲染').not.toBeNull()
    expect(typeof input!.onChangeText, '原因输入框不是受控输入').toBe('function')
    act(() => {
      input!.onChangeText!(value)
    })
  }
  const inputValue = (): unknown => (h.input as { value?: unknown } | null)?.value
  const pressAlert = (label: string): void => {
    const alert = h.alerts[h.alerts.length - 1]
    expect(alert, '二次确认没有弹出').toBeTruthy()
    const button = alert!.buttons.find((b) => b.text === label)
    expect(button, `确认框没有文案为「${label}」的按钮`).toBeTruthy()
    act(() => {
      button!.onPress?.()
    })
  }
  return { ...view, send, text, tap, typeReason, inputValue, pressAlert }
}

beforeEach(() => {
  h.calls.length = 0
  h.alerts.length = 0
  h.input = null
  push = null
})

describe('G-978066 ① 原因输入:填了带上送,没填整键缺席', () => {
  it('输入框装车:标签与占位文案来自词包,长度上限与 web 同值', () => {
    const { send, text } = mount()
    send(event())
    expect(text()).toContain(realText('editor.toolApproval.reasonLabel'))
    expect(h.input!.placeholder).toBe(realText('editor.toolApproval.reasonPlaceholder'))
    expect(h.input!.maxLength).toBe(500)
  })

  it('填了原因再拒绝 ⇒ payload 带 trim 后的原因,且仍不带 scope', async () => {
    const { send, tap, typeReason } = mount()
    send(event({ approvalId: 'ap-r' }))
    typeReason('  参数不对,先回滚  ')
    tap(realText('toolApproval.reject'))
    await act(async () => {})
    expect(h.calls).toHaveLength(1)
    expect(h.calls[0]!.reason).toBe('参数不对,先回滚')
    expect('scope' in h.calls[0]!).toBe(false)
  })

  it('未填原因 ⇒ payload 里根本没有 reason 键(空串等于冒充"用户说了个空原因")', async () => {
    const { send, tap } = mount()
    send(event({ approvalId: 'ap-blank' }))
    tap(realText('toolApproval.approve'))
    await act(async () => {})
    expect(h.calls).toHaveLength(1)
    expect(h.calls[0]).toMatchObject({ approvalId: 'ap-blank', decision: 'approve', scope: 'once' })
    expect('reason' in h.calls[0]!, '没填原因时不得出现 reason 键').toBe(false)
  })

  it('只填空白字符 ⇒ 同样不带 reason 键', async () => {
    const { send, tap, typeReason } = mount()
    send(event({ approvalId: 'ap-space' }))
    typeReason('   ')
    tap(realText('toolApproval.approve'))
    await act(async () => {})
    expect(h.calls).toHaveLength(1)
    expect('reason' in h.calls[0]!, '空白原因按未填处理').toBe(false)
  })

  it('批准路径同样带原因(scope 与 reason 各自独立,不互相顶掉)', async () => {
    const { send, tap, typeReason } = mount()
    send(event({ approvalId: 'ap-a' }))
    typeReason('用户已口头确认')
    tap(realText('toolApproval.scopeSession'))
    tap(realText('toolApproval.approve'))
    await act(async () => {})
    expect(h.calls[0]).toMatchObject({
      decision: 'approve',
      scope: 'session',
      reason: '用户已口头确认',
    })
  })

  it('换到下一条待决项时原因被清空(上一条的原因不得串到下一条)', async () => {
    const { send, tap, typeReason, inputValue } = mount()
    send(event({ approvalId: 'ap-1' }))
    send(event({ approvalId: 'ap-2', toolName: 'write_file' }))
    typeReason('这条的理由')
    tap(realText('toolApproval.reject'))
    await act(async () => {})
    expect(h.calls[0]!.reason).toBe('这条的理由')
    expect(inputValue(), '第二条必须从空原因开始').toBe('')
    tap(realText('toolApproval.approve'))
    await act(async () => {})
    expect(h.calls).toHaveLength(2)
    expect(h.calls[1]).toMatchObject({ approvalId: 'ap-2', decision: 'approve' })
    expect('reason' in h.calls[1]!, '上一条的原因串进第二条 = 给用户编了一句他没说的话').toBe(false)
  })
})

describe('G-978066 ② grantRule 规则编辑器:与 web 同判据、同形态', () => {
  it('开关只在 run_command 上出现;write_file 不出现(网关会静默丢弃 grant_rule)', () => {
    const cmd = mount()
    cmd.send(event({ approvalId: 'ap-cmd' }))
    expect(cmd.text()).toContain(realText('toolApproval.grantRuleToggle'))
    expect(cmd.text()).toContain(filled('toolApproval.grantRuleDesc', { prefix: 'pnpm test' }))

    const file = mount()
    file.send(event({ approvalId: 'ap-file', toolName: 'write_file', argsPreview: 'src/a.ts' }))
    expect(file.text()).not.toContain(realText('toolApproval.grantRuleToggle'))
  })

  it('前缀取 argv 前 2 个 token:JSON argv 形态与原文形态都同值,第三个 token 不进前缀', () => {
    const json = mount()
    json.send(
      event({ approvalId: 'ap-j', argsPreview: '{"argv":["git","push","-u","origin","main"]}' }),
    )
    expect(json.text()).toContain(filled('toolApproval.grantRuleDesc', { prefix: 'git push' }))
    expect(json.text()).not.toContain(
      filled('toolApproval.grantRuleDesc', { prefix: 'git push -u' }),
    )

    const raw = mount()
    raw.send(event({ approvalId: 'ap-r', argsPreview: 'docker compose up -d' }))
    expect(raw.text()).toContain(filled('toolApproval.grantRuleDesc', { prefix: 'docker compose' }))
  })

  it('默认未勾选 ⇒ 批准载荷不含 grantRule 键(开关不是装饰品)', async () => {
    const { send, tap } = mount()
    send(event({ approvalId: 'ap-off' }))
    tap(realText('toolApproval.approve'))
    await act(async () => {})
    expect(h.calls).toHaveLength(1)
    expect('grantRule' in h.calls[0]!, '未勾选却上送规则 = 替用户放行了一类命令').toBe(false)
    expect(h.alerts).toHaveLength(0)
  })

  it('勾选 + 非高危命令 ⇒ 批准直接带上 grantRule:{kind:"exec_prefix",tokens:2}', async () => {
    const { send, tap } = mount()
    send(event({ approvalId: 'ap-rule', argsPreview: 'pnpm test' }))
    tap(realText('toolApproval.grantRuleToggle'))
    tap(realText('toolApproval.approve'))
    await act(async () => {})
    expect(h.alerts, '非高危命令不该拦一道二次确认').toHaveLength(0)
    expect(h.calls).toHaveLength(1)
    expect(h.calls[0]).toMatchObject({
      approvalId: 'ap-rule',
      decision: 'approve',
      scope: 'once',
      grantRule: { kind: 'exec_prefix', tokens: 2 },
    })
  })

  it('勾选后取消勾选 ⇒ 不带 grantRule(勾选态必须真被读出来)', async () => {
    const { send, tap } = mount()
    send(event({ approvalId: 'ap-twice', argsPreview: 'pnpm test' }))
    tap(realText('toolApproval.grantRuleToggle'))
    tap(realText('toolApproval.grantRuleToggle'))
    tap(realText('toolApproval.approve'))
    await act(async () => {})
    expect(h.calls).toHaveLength(1)
    expect('grantRule' in h.calls[0]!).toBe(false)
  })

  it('高危命令勾选后批准 ⇒ 先弹二次确认,确认前一条决策都不上送;点确认才带规则', async () => {
    const { send, tap, pressAlert } = mount()
    send(event({ approvalId: 'ap-danger', argsPreview: 'rm -rf build' }))
    tap(realText('toolApproval.grantRuleToggle'))
    tap(realText('toolApproval.approve'))
    expect(h.calls, '确认之前不得把决策送出去').toHaveLength(0)
    expect(h.alerts).toHaveLength(1)
    expect(h.alerts[0]!.title).toBe(realText('toolApproval.grantRuleConfirmTitle'))
    expect(h.alerts[0]!.message).toBe(
      filled('toolApproval.grantRuleConfirmContent', { prefix: 'rm -rf' }),
    )
    expect(h.alerts[0]!.buttons.map((b) => b.text)).toEqual([
      realText('common.cancel'),
      realText('toolApproval.approve'),
    ])
    pressAlert(realText('toolApproval.approve'))
    await act(async () => {})
    expect(h.calls).toHaveLength(1)
    expect(h.calls[0]).toMatchObject({
      approvalId: 'ap-danger',
      decision: 'approve',
      grantRule: { kind: 'exec_prefix', tokens: 2 },
    })
  })

  it('二次确认里点取消 ⇒ 零上送,该条仍留在待决队列', () => {
    const { send, tap, pressAlert, text } = mount()
    send(event({ approvalId: 'ap-no', argsPreview: 'shutdown now' }))
    tap(realText('toolApproval.grantRuleToggle'))
    tap(realText('toolApproval.approve'))
    pressAlert(realText('common.cancel'))
    expect(h.calls).toHaveLength(0)
    expect(text()).toContain(realText('toolApproval.title'))
  })

  it('拒绝永不携带 grantRule(勾选也一样:拒绝不落任何授权)', async () => {
    const { send, tap, typeReason } = mount()
    send(event({ approvalId: 'ap-rej', argsPreview: 'pnpm test' }))
    tap(realText('toolApproval.grantRuleToggle'))
    typeReason('不该放行这类命令')
    tap(realText('toolApproval.reject'))
    await act(async () => {})
    expect(h.calls).toHaveLength(1)
    expect(h.calls[0]).toMatchObject({ decision: 'reject', reason: '不该放行这类命令' })
    expect('grantRule' in h.calls[0]!, '拒绝顺手写授权规则 = 把拒绝变成放行').toBe(false)
    expect('scope' in h.calls[0]!).toBe(false)
  })

  it('规则勾选不跨条目残留(与 scope/reason 同一条重置语义)', async () => {
    const { send, tap } = mount()
    send(event({ approvalId: 'ap-x', argsPreview: 'pnpm test' }))
    send(event({ approvalId: 'ap-y', argsPreview: 'pnpm build' }))
    tap(realText('toolApproval.grantRuleToggle'))
    tap(realText('toolApproval.approve'))
    await act(async () => {})
    expect(h.calls[0]).toMatchObject({
      approvalId: 'ap-x',
      grantRule: { kind: 'exec_prefix', tokens: 2 },
    })
    tap(realText('toolApproval.approve'))
    await act(async () => {})
    expect(h.calls).toHaveLength(2)
    expect(h.calls[1]).toMatchObject({ approvalId: 'ap-y', decision: 'approve', scope: 'once' })
    expect('grantRule' in h.calls[1]!, '第二条又拿到放行规则 = 串档放大权限').toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
