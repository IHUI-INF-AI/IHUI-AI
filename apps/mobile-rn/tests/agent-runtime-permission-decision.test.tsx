// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D55/G-66 取证用例:mobile-rn 运行时权限决策徽章**不得**直显英文枚举。
//
// 覆盖三层(缺一层就是假绿):
//  ① 渲染层 —— 真组件 AgentRuntimePanel + 真 I18nProvider(端内 messages 由
//     `mergeMessages(shared, mobile-rn)` 生成,词值来自 packages/i18n/messages 的**真实词包**,
//     测试内不写任何字面映射);
//  ② 取值层 —— `allow|ask|deny` 权限矩阵与 15 值步骤决策集**两条都不中时必须原样返回**
//     (审批语境把未知值猜成"已放行"会直接误导用户的授权决定);
//  ③ 回显层 —— 缺键/喷键名(`stepDecision.perm.deny`)一律拦红。
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { render } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '../src/i18n'

// vi.hoisted:工厂在模块初始化期执行,fixture 必须先于 vi.mock 工厂存在
const fixture = vi.hoisted(() => ({
  permission: null as {
    mode: string
    toolName?: string
    dangerLevel?: string
    decision: string
  } | null,
}))

vi.mock('@ihui/api-client', () => ({
  executeAgentRuntimeStream: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('react-native', () => {
  const mk = (name: string) =>
    function MockComp(props: { children?: ReactNode }) {
      return createElement(name, props, props.children)
    }
  return {
    View: mk('View'),
    Text: mk('Text'),
    TextInput: mk('TextInput'),
    Pressable: mk('Pressable'),
    ScrollView: mk('ScrollView'),
    ActivityIndicator: mk('ActivityIndicator'),
  }
})

vi.mock('@ihui/ui-native', () => ({
  Input: (props: { value?: string; placeholder?: string; [k: string]: unknown }) =>
    createElement('input', { value: props.value ?? '', placeholder: props.placeholder }),
  Loading: () => createElement('div', null, 'loading'),
}))

// '@ihui/shared' 与 '@ihui/shared/constants' 在 vitest.config 里 alias 到**同一个** mock 文件,
// 故本 mock 会一并接管常量:用 importOriginal 兜住原有导出,只替换 useAgentRuntime,
// 并用真实源码的 chat barrel(@ihui/shared/chat → packages/shared/src/chat/index.ts)覆盖
// permissionDecisionWord / toolDisplayKey —— 被测函数必须是真身,不能是 stub。
vi.mock('@ihui/shared', async (importOriginal) => {
  const base = await importOriginal<Record<string, unknown>>()
  const chat = await import('@ihui/shared/chat')
  return {
    ...base,
    ...chat,
    useAgentRuntime: () => ({
      status: 'running' as const,
      input: '',
      setInput: () => {},
      sessionId: 'sess-perm-decision',
      plan: null,
      output: '',
      error: null,
      permission: fixture.permission,
      handleSend: async () => {},
      handleStop: () => {},
      handleClear: () => {},
    }),
  }
})

// vi.mock 由 vitest 提升到文件顶部,此处静态 import 真实组件不影响 mock 生效
import { AgentRuntimePanel } from '../src/components/AgentRuntimePanel'

const wrapper = ({ children }: { children: ReactNode }) => <I18nProvider>{children}</I18nProvider>

/** 渲染带权限事件的面板,返回整棵树的可见文本 */
function renderWithDecision(decision: string): string {
  fixture.permission = {
    mode: 'default',
    toolName: 'mcp__ihui_demo__query_index', // 动态名:不走内置工具映射,不干扰本用例断言
    dangerLevel: 'high',
    decision,
  }
  const { container } = render(<AgentRuntimePanel />, { wrapper })
  return container.textContent ?? ''
}

// 真实词包(只读取,不在测试里重述词值):zh-CN 的 stepDecision.perm.deny
const sharedZhCN = JSON.parse(
  readFileSync(join(__dirname, '../../../packages/i18n/messages/shared/zh-CN.json'), 'utf8'),
) as { stepDecision: { perm: Record<string, string>; decision: Record<string, string> } }

const DENY_WORD = sharedZhCN.stepDecision.perm.deny
const AUTO_SKIP_WORD = sharedZhCN.stepDecision.decision.autoSkipApproval

describe('AgentRuntimePanel 权限决策徽章(mobile-rn):不直显英文枚举', () => {
  beforeEach(() => {
    fixture.permission = null
  })

  it('词包自检:deny / auto_skip_approval 的中文词值确实来自真实 shared 包', () => {
    expect(DENY_WORD).toBe('已拒绝')
    expect(AUTO_SKIP_WORD).toBe('自动批准(免审批)')
  })

  it('权限矩阵取值 deny → 「已拒绝」,原始枚举不出现', () => {
    const text = renderWithDecision('deny')
    expect(text).toContain(DENY_WORD)
    expect(text).not.toContain('deny')
    expect(text).not.toContain('stepDecision.')
  })

  it('步骤决策取值 auto_skip_approval → 「自动批准(免审批)」,原始枚举不出现', () => {
    const text = renderWithDecision('auto_skip_approval')
    expect(text).toContain(AUTO_SKIP_WORD)
    expect(text).not.toContain('auto_skip_approval')
    expect(text).not.toContain('stepDecision.')
  })

  it('未知取值 maybe_allow → 原样显示,且绝不猜成语义态', () => {
    const text = renderWithDecision('maybe_allow')
    expect(text).toContain('maybe_allow')
    expect(text).not.toContain('已放行') // allow 的词值 —— 猜成放行即误导授权决定
    expect(text).not.toContain('已自动批准')
    expect(text).not.toContain('stepDecision.')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
