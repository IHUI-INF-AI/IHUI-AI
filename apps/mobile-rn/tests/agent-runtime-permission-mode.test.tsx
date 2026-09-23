// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D111/G-159:审批面板(AgentRuntimePanel)档名渲染 —— permission 帧上的 mode
// **不得**裸显后端英文枚举(如 `acceptEdits`),必须走共享词表取档名。
//
// 覆盖三层(口径同 agent-runtime-permission-decision.test.tsx,缺一层就是假绿):
//  ① 渲染层 —— 真组件 AgentRuntimePanel + 真 I18nProvider,词值来自
//     packages/i18n/messages/mobile-rn 的**真实词包**,测试内不写任何字面映射;
//  ② 档名映射 —— 五档 wire 拼写 + camel 别名 + 历史别名(auto/accept-all/read-only/plan-only),
//     取词链路 permissionTierWordKeys → @ihui/types 唯一真源(注册表派生,非第二份清单);
//  ③ 未知档 —— 认不出的值必须落「未知模式」,**绝不**静默显示成「默认模式」(授权误导)。
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

vi.mock('@ihui/ui-native', () => ({
  Input: (props: { value?: string; placeholder?: string; [k: string]: unknown }) =>
    createElement('input', { value: props.value ?? '', placeholder: props.placeholder }),
  Loading: () => createElement('div', null, 'loading'),
}))

// '@ihui/shared' alias 到 mock 文件,chat barrel 由 vitest.config alias 到真实源码;
// 用 importOriginal 兜住原有导出,只替换 useAgentRuntime,chat 取词函数用真身。
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
      sessionId: 'sess-perm-mode',
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
function renderWithMode(mode: string): string {
  fixture.permission = {
    mode,
    toolName: 'mcp__ihui_demo__query_index', // 动态名:不走内置工具映射,不干扰本用例断言
    dangerLevel: 'high',
    decision: 'deny', // 审批结果词已有专测覆盖,此处固定不干扰档名断言
  }
  const { container } = render(<AgentRuntimePanel />, { wrapper })
  return container.textContent ?? ''
}

// 真实词包(只读取,不在测试里重述词值):mobile-rn zh-CN 的 permissionTier.mode.*
const zhCN = JSON.parse(
  readFileSync(join(__dirname, '../../../packages/i18n/messages/mobile-rn/zh-CN.json'), 'utf8'),
) as {
  permissionTier: { label: string; mode: Record<string, { title: string; desc: string }> }
  agent: { runtimePermissionMode: string }
}

// 缺键时落空串,由下方"词包自检"用例咬红(不静默放过词包漂移)
const modeWords = zhCN.permissionTier.mode
const TIER_TITLES: Readonly<Record<string, string>> = {
  default: modeWords.default?.title ?? '',
  plan: modeWords.plan?.title ?? '',
  'accept-edits': modeWords['accept-edits']?.title ?? '',
  'bypass-permissions': modeWords['bypass-permissions']?.title ?? '',
  unknown: modeWords.unknown?.title ?? '',
}

describe('AgentRuntimePanel 审批档名(mobile-rn):不直显英文枚举、未知档不落 default', () => {
  beforeEach(() => {
    fixture.permission = null
  })

  it('词包自检:五档 + unknown 的档名互异且非空', () => {
    const titles = Object.values(TIER_TITLES)
    for (const title of titles) {
      expect(title?.length ?? 0).toBeGreaterThan(0)
    }
    expect(new Set(titles).size).toBe(titles.length)
  })

  it('五档 wire 拼写逐一渲染出对应档名,档名行在位', () => {
    for (const [tier, title] of Object.entries(TIER_TITLES)) {
      const text = renderWithMode(tier)
      // 审批面板的行 label 是既有键 agent.runtimePermissionMode(「模式」),档名值走 permissionTier 词表
      expect(text).toContain(zhCN.agent.runtimePermissionMode)
      expect(text).toContain(title)
    }
  })

  it('camel 别名归一:acceptEdits / bypassPermissions 显示档名,裸枚举不出现', () => {
    const acceptText = renderWithMode('acceptEdits')
    expect(acceptText).toContain(TIER_TITLES['accept-edits'])
    expect(acceptText).not.toContain('acceptEdits')

    const bypassText = renderWithMode('bypassPermissions')
    expect(bypassText).toContain(TIER_TITLES['bypass-permissions'])
    expect(bypassText).not.toContain('bypassPermissions')
  })

  it('历史别名归一:auto→接受编辑、accept-all→绕过权限、read-only/plan-only→只读计划', () => {
    expect(renderWithMode('auto')).toContain(TIER_TITLES['accept-edits'])
    expect(renderWithMode('accept-all')).toContain(TIER_TITLES['bypass-permissions'])
    expect(renderWithMode('read-only')).toContain(TIER_TITLES.plan)
    expect(renderWithMode('plan-only')).toContain(TIER_TITLES.plan)
  })

  it('未知档 garbage → 「未知模式」,绝不静默显示成「默认模式」', () => {
    const text = renderWithMode('garbage-mode')
    expect(text).toContain(TIER_TITLES.unknown)
    expect(text).not.toContain(TIER_TITLES.default)
    expect(text).not.toContain('garbage-mode')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
