// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D136(2026-10-01 立,承 V4 #94 / D84)RN 端工具审批装车证明。
//
// 缺陷形状本票已逐字复跑过(不是照抄票面):`git grep -lE 'tool-approval|toolApproval|approvalRequest' HEAD
// -- apps/mobile-rn/src` **零命中**,而同一帧在 web/extension/cli 都有承接面 ⇒ 手机上 agent 发起高危
// 工具调用时屏幕上一切都没有:后端在等一个永远不会来的回答,用户既不知道发生过一次决定,也不知道
// 自己拒绝过什么。这类"契约、解析、组件全在,唯独没人接"的缺陷,只测组件证不出"挂上了" —— 所以本文件两层:
//   ① 接线层(源码级):`onToolApproval` 必须**在 streamChat 的回调表里**,且回调体真的把帧交给队列。
//      本端这两个 3.8k 行的屏没有渲染级用例(D135 同批文件记过:挂 FlatList + 十余 provider 挂载即 TypeError),
//      所以"接没接上"只能按源码钉;而"名字出现在注释里"绝不算接上(最后一节对本判据自身做反向自证)。
//   ② 行为层(jsdom 渲染,期望文案一律取自**真词包**,与 I18nProvider 喂给 t() 的是同一份):
//      三档逐档同值 / 默认 once 最小特权 / 拒绝不写授权 / 关闭 ≠ 决策 / 待决项常驻人工放行入口 /
//      环境事实三态不并桶 / 决策回传失败必须响。
// 副作用断言打在 postToolApprovalResponse **实际收到的 payload** 上(键在不在、值是什么),
// 而不是"界面出现了某个词":本仓记过只断错误码、只断文案,结果"被拒渲染成完成"和"拒绝=永久禁止"都绿。
// @vitest-environment jsdom
import { act, render } from '@testing-library/react'
import { type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ToolApprovalEvent } from '@ihui/api-client'
import { I18nProvider, messages, getValueByPath } from '../src/i18n'
import { useToolApprovalQueue } from '../src/components/ai/ToolApprovalSheet'

/** 决策回传的唯一观察点:每条实收到的 payload 原样存下来,断言打在它身上。 */
const h = vi.hoisted(() => ({
  calls: [] as Array<Record<string, unknown>>,
  mode: 'ok' as 'ok' | 'fail',
  /** 组件最后一次渲染时传给 <Modal> 的 props(用来模拟 Android 返回/遮罩关闭) */
  modal: null as Record<string, unknown> | null,
}))

// 别名 '@ihui/api-client' 在 vitest.config.ts 里直指真实源码(给它写替身,测的就是替身),
// 这里只换掉"上行回传"一个出口:既拿到 payload,又不让用例依赖真实 fetch。
vi.mock('@ihui/api-client', async (importOriginal) => {
  const mod = await importOriginal<Record<string, unknown>>()
  return {
    ...mod,
    postToolApprovalResponse: async (payload: Record<string, unknown>) => {
      h.calls.push(payload)
      if (h.mode === 'fail') throw new Error('AI 服务未接受该决策(条目不存在/已失效)')
      return { ok: true }
    },
  }
})

// react-native 走端内桩(tests/__mocks__/react-native.ts);桩的 Modal 只在 visible 时渲染且
// 不暴露 onRequestClose,而"关闭 ≠ 决策"这条正好要按返回键来试 ⇒ 保留其余导出,只替 Modal 并留 props。
vi.mock('react-native', async (importOriginal) => {
  const mod = await importOriginal<Record<string, unknown>>()
  const { createElement: ce } = await import('react')
  const Modal = (props: Record<string, unknown>) => {
    h.modal = props
    return props.visible === true ? ce('div', { 'data-modal-open': '1' }, props.children as ReactNode) : null
  }
  return { ...(mod as Record<string, unknown>), Modal }
})

const HERE = dirname(fileURLToPath(import.meta.url))
const SCREEN_SRC = resolve(HERE, '../src/screens/ChatScreen.tsx')

/**
 * 取"代码面"的行(与 tests/terminal-interaction-mobile-degradation.test.tsx 同一手法,不是第二份生产实现,
 * 只服务源码断言):剥掉行注释与块注释,**保留缩进**。
 * 不能只按"行首是 //"筛:块注释的内部行不以 `*` 开头是常态 ⇒ 整块注释掉的接线会被当代码留下,
 * 判据对它失明,而这一节存在的全部理由就是让"注释里提到名字"必红。
 */
function codeLines(src: string): string[] {
  const out: string[] = []
  let inBlock = false
  for (const raw of src.split('\n')) {
    let line = ''
    let str: '' | '"' | "'" | '`' = ''
    for (let i = 0; i < raw.length; i += 1) {
      const c = raw[i]!
      const n = raw[i + 1] ?? ''
      if (inBlock) {
        if (c === '*' && n === '/') {
          inBlock = false
          i += 1
        }
        continue
      }
      if (str !== '') {
        line += c
        if (c === '\\') {
          line += n
          i += 1
        } else if (c === str) {
          str = ''
        }
        continue
      }
      if (c === '/' && n === '/') break
      if (c === '/' && n === '*') {
        inBlock = true
        i += 1
        continue
      }
      if (c === '"' || c === "'" || c === '`') str = c
      line += c
    }
    out.push(line)
  }
  return out
}

/** 括号配平取 `await streamChat({ … })` 整段(不靠行号:行号每次 append 都会挪)。 */
function streamChatBlock(src: string): string {
  const start = src.indexOf('await streamChat({')
  if (start < 0) throw new Error('找不到 streamChat 调用点')
  let depth = 0
  let index = src.indexOf('{', start)
  for (; index < src.length; index += 1) {
    const char = src[index]
    if (char === '{') depth += 1
    else if (char === '}') {
      depth -= 1
      if (depth === 0) break
    }
  }
  return src.slice(start, index + 1)
}

/** 某个 options 属性体(按缩进认同级,缩进回退即结束)。 */
function optionBody(lines: string[], name: string): string[] {
  const start = lines.findIndex((l) => new RegExp(`^\\s+${name}:`).test(l))
  if (start < 0) return []
  const indent = lines[start]!.search(/\S/)
  const body: string[] = []
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i]!
    if (line.trim() === '') continue
    if (line.search(/\S/) <= indent && /^\s+\w+:/.test(line)) break
    body.push(line)
  }
  return body
}

/** 期望文案取自真词包(合并档),缺键当场喊出来:回退成键名会让"词包没这条"读起来像"组件没渲染"。 */
function realText(key: string): string {
  const raw = getValueByPath(messages['zh-CN'] as unknown, key)
  expect(typeof raw, `真词包缺键 ${key}`).toBe('string')
  const text = String(raw)
  expect(text.length, `真词包 ${key} 是空串`).toBeGreaterThan(0)
  expect(text).not.toBe(key)
  return text
}

/** 带插值位的文案:本端词包用单花括号 ICU 位({count} 等),按同名实参代入。 */
function filled(key: string, params: Record<string, string | number>): string {
  const raw = realText(key)
  const out = raw.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  )
  // 插值位没被认出来(比如词包被改成 ICU plural)时,期望串里会留下花括号 ⇒ 当场喊,不要静默比不过
  expect(out, `${key} 的插值位没代入:${out}`).not.toMatch(/\{\w+\}/)
  return out
}

const event = (over: Partial<ToolApprovalEvent> = {}): ToolApprovalEvent =>
  ({
    type: 'tool-approval',
    approvalId: 'ap-1',
    toolName: 'run_command',
    toolCallId: 'tc-1',
    argsPreview: 'rm -rf dist',
    dangerLevel: 'high',
    sessionId: 'sess-9',
    ...over,
  }) as ToolApprovalEvent

/** 挂进屏里的形态:组件自己就是 host + 一个入口回调。 */
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
  const buttonsByText = (label: string): HTMLButtonElement[] =>
    [...view.container.querySelectorAll('button')].filter((b) => b.textContent === label)
  const tap = (label: string) => {
    const found = buttonsByText(label)
    expect(found, `按钮文案未在真词包渲染出:${label}`).toHaveLength(1)
    act(() => {
      found[0]!.click()
    })
  }
  const text = () => view.container.textContent ?? ''
  return { ...view, send, tap, text, buttonsByText }
}

beforeEach(() => {
  h.calls.length = 0
  h.mode = 'ok'
  h.modal = null
  push = null
})

describe('D136 ① 接线:ChatScreen 真的把 onToolApproval 接进 streamChat', () => {
  const lines = codeLines(readFileSync(SCREEN_SRC, 'utf8'))
  const block = streamChatBlock(readFileSync(SCREEN_SRC, 'utf8'))

  it('options 回调表里有 onToolApproval 属性行(删掉或注释成 // 即红)', () => {
    expect(/^\s{6}onToolApproval:/m.test(block)).toBe(true)
    expect(lines.some((l) => /^\s+onToolApproval:/.test(l))).toBe(true)
  })

  it('该回调体把帧交给审批队列(不是空壳,也没有在端内另写一份解析)', () => {
    const body = optionBody(lines, 'onToolApproval')
    expect(body.length).toBeGreaterThan(0)
    expect(body.some((l) => l.includes('toolApproval.onToolApproval('))).toBe(true)
    // 反向锁:端内自己 parseEnvelope / 挑字段 = 第二份真相(票面规则 1 要根治的那一型)
    expect(lines.some((l) => /parseToolApprovalEvent\(|parseEnvelope\(/.test(l) && !l.trim().startsWith('import'))).toBe(
      false,
    )
  })

  it('组件确实装车:import + hook 调用 + host 渲染三处都是代码行', () => {
    const src = readFileSync(SCREEN_SRC, 'utf8')
    expect(src).toMatch(/import \{ useToolApprovalQueue \} from '\.\.\/components\/ai\/ToolApprovalSheet'/)
    expect(lines.some((l) => /const toolApproval = useToolApprovalQueue\(\)/.test(l))).toBe(true)
    expect(lines.some((l) => l.includes('{toolApproval.host}'))).toBe(true)
  })

  it('判据自证:整块注释掉的同名接线一行都不剩(否则上面三条没牙)', () => {
    const commented = [
      'await streamChat({',
      '  model: m,',
      '  /* onToolApproval: (event) => {',
      '    toolApproval.onToolApproval(event)',
      '  }, */',
      '  // onToolApproval: (event) => toolApproval.onToolApproval(event),',
      '})',
    ].join('\n')
    const cl = codeLines(commented)
    expect(cl.some((l) => /^\s+onToolApproval:/.test(l))).toBe(false)
    expect(cl.some((l) => l.includes('toolApproval.onToolApproval('))).toBe(false)
    // 去掉注释符后同一份文本必须命中(证明不是恒假)
    const live = codeLines(commented.replace(/\/\*|\*\//g, '').replace(/^  \/\//gm, '  '))
    expect(live.some((l) => /^\s+onToolApproval:/.test(l))).toBe(true)
  })
})

describe('D136 ② 三档与 web 逐档同值(禁止移动端偷偷只给两档)', () => {
  it('once / session / always 三档都渲染,且各档文案来自真词包', () => {
    const { send, text, buttonsByText } = mount()
    send(event())
    for (const key of ['toolApproval.scopeOnce', 'toolApproval.scopeSession', 'toolApproval.scopeAlways']) {
      expect(text(), `缺档 ${key}`).toContain(realText(key))
    }
    // 档位数量精确为 3:多于 3 是加了 web 没有的档,少于 3 就是本票禁掉的降级
    const tiers = ['toolApproval.scopeOnce', 'toolApproval.scopeSession', 'toolApproval.scopeAlways'].map(
      (k) => realText(k),
    )
    expect(buttonsByText(tiers[0]!).length + buttonsByText(tiers[1]!).length + buttonsByText(tiers[2]!).length).toBe(3)
  })

  it('默认档 = once(最小特权):不动档位直接批准,payload 里 scope 就是 once', () => {
    const { send, tap } = mount()
    send(event())
    tap(realText('toolApproval.approve'))
    expect(h.calls).toHaveLength(1)
    expect(h.calls[0]).toMatchObject({ approvalId: 'ap-1', sessionId: 'sess-9', decision: 'approve', scope: 'once' })
  })

  it('选 session / always 后批准 ⇒ 逐档同值送到底(不是只换个高亮)', async () => {
    for (const [key, value] of [
      ['toolApproval.scopeSession', 'session'],
      ['toolApproval.scopeAlways', 'always'],
    ] as const) {
      h.calls.length = 0
      const { send, tap } = mount()
      send(event({ approvalId: `ap-${value}` }))
      tap(realText(key))
      tap(realText('toolApproval.approve'))
      await act(async () => {})
      expect(h.calls.map((c) => c.scope), value).toEqual([value])
      expect(h.calls[0]).toMatchObject({ approvalId: `ap-${value}`, decision: 'approve' })
    }
  })

  it('拒绝不回传 scope(拒绝是一次判定,不落任何授权),且只发这一条请求', async () => {
    const { send, tap, text } = mount()
    send(event())
    tap(realText('toolApproval.scopeAlways'))
    tap(realText('toolApproval.reject'))
    await act(async () => {})
    expect(h.calls).toHaveLength(1)
    expect(h.calls[0]!.decision).toBe('reject')
    expect('scope' in h.calls[0]!, '拒绝不得携带作用域(更不得留下 always 授权)').toBe(false)
    expect('grantRule' in h.calls[0]!, '拒绝不得顺手写授权规则').toBe(false)
    expect(h.calls.filter((c) => c.decision === 'approve')).toHaveLength(0)
    // 被拒记录仍在,且写明下次仍会询问(不是"以后都不问了")
    expect(text()).toContain(realText('toolApproval.rejectedBadge'))
    expect(text()).toContain(realText('toolApproval.rejectedNextNote'))
  })

  it('拒绝后不得出现"完成/已执行"类终态文案,且记录常驻在面板外(AGENTS §30)', async () => {
    const { send, tap, text } = mount()
    send(event())
    tap(realText('toolApproval.reject'))
    await act(async () => {})
    // 无待决项 ⇒ 面板自动收起;此时屏幕上仍必须留有一条"我拒绝过"的记录(不是"完成")
    expect(h.modal!.visible).toBe(false)
    const rendered = text()
    expect(rendered).toContain(realText('toolApproval.trayTitle'))
    expect(rendered).toContain(realText('toolApproval.rejectedBadge'))
    // 期望缺席串取自真词包(端内在用的终态措辞),不在测试里手抄中文
    expect(rendered).not.toContain(realText('aiAssistantN8n.planStatusCompleted'))
    expect(rendered, '面板已收起,批准按钮不应还挂在屏上').not.toContain(realText('toolApproval.approve'))
  })
})

describe('D136 ③ 关闭 ≠ 决策,待决项必须留人工放行入口(AGENTS §30)', () => {
  it('按返回/遮罩关闭:不回传任何 decision,条目仍在待决队列,常驻入口可再点开', () => {
    const { send, tap, text } = mount()
    send(event())
    const modal = h.modal as { onRequestClose?: () => void } | null
    expect(modal?.onRequestClose, '面板没挂 onRequestClose 就等于安卓返回键直接吞掉一次决定').toBeTypeOf('function')
    act(() => modal!.onRequestClose!())
    expect(h.calls, '关闭从不等于拒绝/批准').toHaveLength(0)
    expect(h.modal!.visible).toBe(false)
    // 收起后必须有常驻入口,且点名还剩几个待决
    expect(text()).toContain(filled('toolApproval.openPanel', { count: 1 }))
    tap(filled('toolApproval.openPanel', { count: 1 }))
    expect(h.modal!.visible).toBe(true)
    expect(h.calls).toHaveLength(0)
  })

  it('两个待决项:第二条排队可见(pendingCount),关闭后入口点名 2 个', () => {
    const { send, text } = mount()
    send(event({ approvalId: 'ap-1' }))
    send(event({ approvalId: 'ap-2', toolName: 'write_file' }))
    expect(text()).toContain(filled('toolApproval.pendingCount', { count: 1 }))
    const modal = h.modal as { onRequestClose?: () => void }
    act(() => modal.onRequestClose!())
    expect(text()).toContain(filled('toolApproval.openPanel', { count: 2 }))
  })

  it('同一 approvalId 重复入帧只算一条(重复帧不得造出第二张卡,更不能各答一次)', () => {
    const { send } = mount()
    send(event({ approvalId: 'ap-dup' }))
    send(event({ approvalId: 'ap-dup' }))
    expect(h.modal!.visible).toBe(true)
    const modal = h.modal as { onRequestClose?: () => void }
    act(() => modal.onRequestClose!())
    expect(h.modal!.visible).toBe(false)
    expect([...h.calls]).toEqual([])
  })

  it('没有 approvalId 的帧整条丢弃(不造无主卡片,也不留无法回传的待决项)', () => {
    const { send, text } = mount()
    send(event({ approvalId: '' }))
    expect(h.modal!.visible).toBe(false)
    expect(text()).not.toContain(realText('toolApproval.title'))
  })
})

describe('D136 ④ 队列切换不得串档(上一条的授权范围不能带进下一条)', () => {
  it('第一条选 always 批准后,第二条默认回到 once', async () => {
    const { send, tap } = mount()
    send(event({ approvalId: 'ap-a' }))
    tap(realText('toolApproval.scopeAlways'))
    tap(realText('toolApproval.approve'))
    await act(async () => {})
    expect(h.calls[0]).toMatchObject({ approvalId: 'ap-a', scope: 'always' })

    send(event({ approvalId: 'ap-b', toolName: 'write_file' }))
    tap(realText('toolApproval.approve'))
    await act(async () => {})
    expect(h.calls[1]).toMatchObject({ approvalId: 'ap-b', decision: 'approve', scope: 'once' })
    expect(h.calls[1]!.scope, '第二条又拿到 always 授权 = 串档放大权限').not.toBe('always')
  })

  it('正向对照:批准成功后该条出待决队列(否则待决计数会永久挂住)', async () => {
    const { send, tap, text } = mount()
    send(event({ approvalId: 'ap-ok' }))
    tap(realText('toolApproval.approve'))
    await act(async () => {})
    expect(h.calls).toHaveLength(1)
    const modal = h.modal as { visible?: boolean }
    expect(modal.visible, '已答复且无待决 ⇒ 面板不该继续拦人').toBe(false)
    expect(text()).not.toContain(filled('toolApproval.openPanel', { count: 1 }))
  })
})

describe('D136 ⑤ 环境事实三态绝不并桶(字段缺席 ≠ 未上报)', () => {
  it('execEnvironment.available === false ⇒ 必须响"未上报"', () => {
    const { send, text } = mount()
    send(event({ execEnvironment: { available: false } as never }))
    expect(text()).toContain(realText('toolApproval.envLabel'))
    expect(text()).toContain(realText('toolApproval.envUnknown'))
    expect(text()).not.toContain(realText('toolApproval.envInSandbox'))
    expect(text()).not.toContain(realText('toolApproval.envOutsideSandbox'))
  })

  it('整字段缺席 ⇒ 环境那一块整体不渲染(把两态折叠成一个,就是把"没判"写成"判过了")', () => {
    const { send, text } = mount()
    send(event())
    expect(text()).toContain(realText('toolApproval.title'))
    expect(text()).toContain(realText('toolApproval.argsPreview'))
    expect(text()).not.toContain(realText('toolApproval.envLabel'))
    expect(text()).not.toContain(realText('toolApproval.envUnknown'))
  })

  it('available 为真 ⇒ 沙箱/隔离方式/网络三行按实际取值给出,被拦截目标逐条点名', () => {
    const { send, text } = mount()
    send(
      event({
        execEnvironment: { available: true, inSandbox: false, backend: 'docker', degraded: true } as never,
        networkTarget: { protocol: 'https', display: 'api.example.com:443' } as never,
        blockedNetworkTargets: [{ host: '10.0.0.9', port: 22, reason: '内网禁用' }] as never,
      }),
    )
    expect(text()).toContain(realText('toolApproval.envOutsideSandbox'))
    expect(text()).toContain(filled('toolApproval.envBackend', { backend: 'docker' }))
    expect(text()).toContain(realText('toolApproval.envDegraded'))
    expect(text()).toContain(realText('toolApproval.envNetworkOpen'))
    expect(text()).toContain('https://api.example.com:443')
    expect(text()).toContain(realText('toolApproval.envNetworkBlocked'))
    expect(text()).toContain(
      filled('toolApproval.envNetworkBlockedOne', { host: '10.0.0.9', port: 22, reason: '内网禁用' }),
    )
  })

  it('无 networkTarget ⇒ 明确说"本次不开放网络",不留下含糊', () => {
    const { send, text } = mount()
    send(event({ execEnvironment: { available: true, inSandbox: true } as never }))
    expect(text()).toContain(realText('toolApproval.envInSandbox'))
    expect(text()).toContain(realText('toolApproval.envNetworkOff'))
    expect(text()).not.toContain(realText('toolApproval.envNetworkOpen'))
  })
})

describe('D136 ⑥ 决策回传失败必须响,不得静默当"已处理"', () => {
  it('上游不收(条目失效)⇒ 点名失败,条目留在待决队列,面板没有变成已完成', async () => {
    h.mode = 'fail'
    const { send, tap, text } = mount()
    send(event({ approvalId: 'ap-nope' }))
    tap(realText('toolApproval.approve'))
    await act(async () => {})
    expect(h.calls).toHaveLength(1)
    expect(text()).toContain(realText('toolApproval.sendFailed'))
    expect(text()).not.toContain(realText('aiAssistantN8n.planStatusCompleted'))
    // 仍在待决:收起后入口点名它
    const modal = h.modal as { onRequestClose?: () => void }
    act(() => modal.onRequestClose!())
    expect(text()).toContain(filled('toolApproval.openPanel', { count: 1 }))
  })

  it('sessionId 缺席时把"回传不成"写在脸上,而不是给一个静默失败的按钮', () => {
    const { send, text } = mount()
    send(event({ sessionId: undefined }))
    expect(text()).toContain(realText('toolApproval.noSession'))
  })

  it('参数预览/危险档来自帧本身(不是端内造默认值):空字段用占位符,危险档按实参插值', () => {
    const { send, text } = mount()
    send(event({ argsPreview: '', toolName: '', dangerLevel: 'medium' }))
    expect(text()).toContain(filled('toolApproval.dangerLevel', { level: 'medium' }))
    expect(text()).toContain('—')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
