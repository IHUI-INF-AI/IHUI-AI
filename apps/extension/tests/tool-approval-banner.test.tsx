// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment happy-dom

/**
 * V3 #58 扩展端审批位:ToolApprovalBanner 的取证。
 *
 * 本端 vitest environment 为 node(未接 jsdom),`renderToStaticMarkup` 点不了真按钮,
 * 所以「哪一枚按钮对应哪一组回传参数」这条判定**必须**住在导出的纯函数里 —— 留在
 * JSX 事件里就等于判不到。沿用本端既有姿势(见 message-content-partial-diff.test.tsx):
 * react-dom/server 静态渲染 + 桩掉 useI18n 让 `t` 回显键名,于是断言直接打在键名上。
 *
 * 三层判定,缺一层就是假绿:
 *  ① 渲染层 —— 空 event 不出框、缺 sessionId 只出技术态、正常 event 出全要素;
 *  ② 判定层 —— resolveApprovalAction / isApprovalResolvable 的行为对子(含未知档不得猜);
 *  ③ 接线层 —— 组件体内必须真的调用这两个纯函数(把调用摘掉即红),
 *     这是本仓防「函数在而无人调」的标准做法(守门 70/76/81 同族)。
 */
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ToolApprovalEvent } from '@ihui/api-client'

vi.mock('../src/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: 'zh-CN',
    setLocale: () => {},
  }),
}))

const {
  ToolApprovalBanner,
  APPROVAL_BUTTON_KINDS,
  APPROVAL_NO_SESSION,
  isApprovalResolvable,
  resolveApprovalAction,
} = await import('../entrypoints/sidepanel/components/ToolApprovalBanner')

/** 一条完整的可回传审批帧(sessionId 在,按钮才该出现) */
const RESOLVABLE_EVENT: ToolApprovalEvent = {
  type: 'tool-approval',
  approvalId: 'ap-1',
  toolName: 'run_command',
  toolCallId: 'tc-1',
  argsPreview: 'rm -rf apps/extension/.output',
  dangerLevel: 'high',
  sessionId: 'sess-1',
}

function render(event: ToolApprovalEvent | null): string {
  return renderToStaticMarkup(<ToolApprovalBanner event={event} onResolve={vi.fn()} />)
}

// ==================== 源码取材与遮罩(接线层判据的地基) ====================

const COMPONENT_PATH = resolve(
  __dirname,
  '../entrypoints/sidepanel/components/ToolApprovalBanner.tsx',
)
const RAW_SOURCE = readFileSync(COMPONENT_PATH, 'utf-8')

/**
 * 剥注释、**保留字符串**:界面文案就活在字符串里,连字符串一起抹会让
 * 「硬编码中文」与 `title=` 两条反向锁双双假绿(与守门 131 的遮罩取向同理)。
 */
function stripComments(src: string): string {
  let out = ''
  let mode: 'code' | 'line' | 'block' | 'string' = 'code'
  let quote = ''
  let i = 0
  while (i < src.length) {
    const c = src[i] ?? ''
    const n = src[i + 1] ?? ''
    if (mode === 'code') {
      if (c === '/' && n === '/') {
        mode = 'line'
        i += 2
        continue
      }
      if (c === '/' && n === '*') {
        mode = 'block'
        i += 2
        continue
      }
      if (c === '"' || c === "'" || c === '`') {
        mode = 'string'
        quote = c
      }
      out += c
      i += 1
      continue
    }
    if (mode === 'line') {
      if (c === '\n') {
        mode = 'code'
        out += c
      }
      i += 1
      continue
    }
    if (mode === 'block') {
      if (c === '*' && n === '/') {
        mode = 'code'
        i += 2
        continue
      }
      if (c === '\n') out += '\n'
      i += 1
      continue
    }
    if (c === '\\') {
      out += c + n
      i += 2
      continue
    }
    out += c
    if (c === quote) mode = 'code'
    i += 1
  }
  return out
}

const CODE = stripComments(RAW_SOURCE)

/**
 * 汉字 + CJK 标点 + 半/全角形式。区间一律写 \u 转义 —— 直接把这些字符打进字面量里,
 * 下一个读的人(和下一个改判据的人)都无从核对区间边界到底是什么。
 */
const CJK_RE = /[\u3000-\u303f\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]/

/** 本组件允许使用的词键(任务书钉死的四枚;加键属另一票) */
const ALLOWED_I18N_KEYS = [
  'agent.permission',
  'agent.permissionDecision',
  'agent.approve',
  'agent.reject',
] as const

describe('ToolApprovalBanner 渲染层', () => {
  it('event 为 null ⇒ 什么都不渲染(不造空态框)', () => {
    const html = render(null)
    expect(html).toBe('')
    expect(html).not.toContain('agent.permissionDecision')
    expect(html).not.toContain('tool-approval-approve')
    expect(html).not.toContain('tool-approval-reject')
  })

  it('正常 event ⇒ 标题走既有键,toolName 与 dangerLevel 按技术原值显示,参数预览原文可见', () => {
    const html = render(RESOLVABLE_EVENT)
    expect(html).toContain('data-testid="tool-approval-banner"')
    expect(html).toContain('agent.permissionDecision')
    expect(html).toContain('run_command')
    expect(html).toContain('high')
    expect(html).toContain('rm -rf apps/extension/.output')
    expect(html).toContain('data-testid="tool-approval-approve"')
    expect(html).toContain('data-testid="tool-approval-reject"')
    expect(html).toContain('agent.approve')
    expect(html).toContain('agent.reject')
  })

  it('三枚按钮各渲染一次,testid 与封闭档集逐字对齐,且没有 always 档', () => {
    const html = render(RESOLVABLE_EVENT)
    // 逐档对齐:档集与渲染必须同形(加档没配样式 / 配了样式没进档集,都会在这里红)
    expect(APPROVAL_BUTTON_KINDS).toEqual(['approve', 'approve-session', 'reject'])
    for (const kind of APPROVAL_BUTTON_KINDS) {
      const marker = `data-testid="tool-approval-${kind}"`
      expect(html.split(marker).length - 1).toBe(1)
    }
    // 第三档的词键必须真在 HEAD 的五语言包里(键到位才准出按钮,顺序不得颠倒)
    expect(html).toContain('chat.approveForSession')
    // always 仍然不出:比 session 又大一档,且至今没有逐字等义词
    expect(html).not.toContain('tool-approval-always')
  })

  it('参数预览靠 CSS 截断,不引入 title 属性', () => {
    const html = render(RESOLVABLE_EVENT)
    expect(html).toContain('line-clamp')
    expect(html).not.toMatch(/(^|[\s<])title="/)
  })
})

describe('ToolApprovalBanner 判定层:决策装配', () => {
  it('三档装配:approve⇒once、approve-session⇒session、reject 不带作用域', () => {
    expect(resolveApprovalAction('approve')).toEqual({ decision: 'approve', scope: 'once' })
    expect(resolveApprovalAction('approve-session')).toEqual({
      decision: 'approve',
      scope: 'session',
    })
    expect(resolveApprovalAction('reject')).toEqual({ decision: 'reject' })
    // 显式断「没有」:reject 若被顺手带上 scope,后端会收到无意义的作用域字段
    expect(resolveApprovalAction('reject')?.scope).toBeUndefined()
  })

  it('认不出的档返回 null,绝不猜一个默认决策', () => {
    // 改判记录:2026-09-28 之前 'approve-session' 是刻意不可达的(词键没到位);
    // 词键随提交 3a8726494e 落包后本档已可达(见上一条用例),这里只留"仍然不存在"的档。
    expect(resolveApprovalAction('always' as never)).toBeNull()
    expect(resolveApprovalAction('approve-always' as never)).toBeNull()
    // 空串/undefined 也不能被读成"默认 once"—— 那会让一次误点变成放行
    expect(resolveApprovalAction('' as never)).toBeNull()
  })

  it('最小特权反向锁:任何档的装配结果都不得是 scope=always', () => {
    for (const kind of APPROVAL_BUTTON_KINDS) {
      const a = resolveApprovalAction(kind)
      expect(a?.scope).not.toBe('always')
      // 批准档只能是 once / session 两种,拒绝档不带作用域
      if (a?.decision === 'approve') expect(['once', 'session']).toContain(a.scope)
    }
    // 源码面同锁:组件里连该字面量都不许出现(写了就是给未来的"顺手加一档"留门)
    expect(CODE).not.toMatch(/['"]always['"]/)
  })
})

describe('ToolApprovalBanner 判定层:缺 sessionId 不得静默', () => {
  it('null / 缺字段 / 空串 ⇒ 不可回传;非空串 ⇒ 可回传', () => {
    expect(isApprovalResolvable(null)).toBe(false)
    const { sessionId: _drop, ...withoutSession } = RESOLVABLE_EVENT
    expect(isApprovalResolvable(withoutSession)).toBe(false)
    expect(isApprovalResolvable({ ...RESOLVABLE_EVENT, sessionId: '' })).toBe(false)
    expect(isApprovalResolvable({ ...RESOLVABLE_EVENT, sessionId: undefined })).toBe(false)
    expect(isApprovalResolvable(RESOLVABLE_EVENT)).toBe(true)
  })

  it('不可回传时只渲技术态:出 no-session,不出标题、不出任何决策按钮', () => {
    const { sessionId: _drop, ...withoutSession } = RESOLVABLE_EVENT
    const html = render(withoutSession)
    expect(html).toContain(APPROVAL_NO_SESSION)
    expect(html).toContain('data-approval-resolvable="false"')
    expect(html).not.toContain('agent.permissionDecision')
    for (const kind of APPROVAL_BUTTON_KINDS) {
      expect(html).not.toContain(`data-testid="tool-approval-${kind}"`)
    }
  })

  it('静态渲染点不了按钮,所以「不触发 onResolve」这条判据住在纯函数 + 接线锁里(此处只锁零调用)', () => {
    const spy = vi.fn()
    const { sessionId: _drop, ...withoutSession } = RESOLVABLE_EVENT
    renderToStaticMarkup(<ToolApprovalBanner event={withoutSession} onResolve={spy} />)
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('ToolApprovalBanner 接线层:组件必须真的调用这两个纯函数', () => {
  const componentStart = CODE.indexOf('export function ToolApprovalBanner(')

  it('组件存在且定义在两个纯函数之后(否则下面的切片会白含定义而恒绿)', () => {
    expect(componentStart).toBeGreaterThanOrEqual(0)
    expect(CODE.indexOf('export function resolveApprovalAction(')).toBeLessThan(componentStart)
    expect(CODE.indexOf('export function isApprovalResolvable(')).toBeLessThan(componentStart)
  })

  it('组件体内调用 resolveApprovalAction / isApprovalResolvable / onResolve(摘掉任一即红)', () => {
    const body = CODE.slice(componentStart)
    expect(body).toContain('resolveApprovalAction(')
    expect(body).toContain('isApprovalResolvable(')
    expect(body).toContain('onResolve(')
  })
})

describe('ToolApprovalBanner 界面卫生反向锁', () => {
  it('剥注释后的源码不含中文界面串(文案一律走 t)', () => {
    expect(CODE).not.toMatch(CJK_RE)
  })

  it('反向对照:CJK 判据对代码面中文真的会红(不是恒绿)', () => {
    expect(CJK_RE.test('const a = "确认删除"')).toBe(true)
    expect(CJK_RE.test('return <div>ok</div>')).toBe(false)
    // 注释里的中文必须被遮掉,否则本门的说明文字会把自己判红(守门 131 同型)
    expect(stripComments('const a = 1 // 中文说明')).not.toMatch(CJK_RE)
  })

  it('出现的 agent.* 词键全部在白名单内(未新增键、未借档)', () => {
    const keys = [...CODE.matchAll(/['"](agent\.[A-Za-z0-9_.]+)['"]/g)]
      .map((m) => m[1] as string)
      .sort()
    expect(keys.length).toBeGreaterThan(0)
    for (const key of keys) {
      expect(ALLOWED_I18N_KEYS).toContain(key)
    }
  })

  it('源码面禁原生提示窗与 title 属性', () => {
    expect(CODE).not.toMatch(/(^|[\s(<])title=/)
    expect(CODE).not.toMatch(/\balert\s*\(/)
    expect(CODE).not.toMatch(/\bconfirm\s*\(/)
    expect(CODE).not.toMatch(/\bprompt\s*\(/)
  })

  it('圆角只取档位类名,无任意值圆角', () => {
    expect(CODE).not.toMatch(/rounded-\[/)
    expect(CODE).not.toMatch(/rounded-full/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
