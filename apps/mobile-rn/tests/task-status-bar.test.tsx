// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * TaskStatusBar(mobile-rn)最小组件测试
 *
 * 覆盖三条核心链路:
 * 1. 空闲(无步骤/无变更/非流式)→ 整体不挂载(返回 null)
 * 2. 有 planSteps → 步骤文本渲染 + kind testID(running)
 * 3. 展开切换:非流式默认收起,点击 toggle 后明细展开
 *
 * 注:'@ihui/shared' 在 vitest 中被 alias 到 tests/__mocks__/ihui-shared.ts(无
 * deriveTaskStatusBar),此处用 vi.mock 工厂把真实共享实现
 * (packages/shared/src/chat/task-status.ts,零平台依赖)注入,保证测的是真相源。
 */
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'

vi.mock('@ihui/shared', async () => {
  const actual = await import('../../../packages/shared/src/chat/task-status')
  const toolDisplay = await import('../../../packages/shared/src/chat/tool-display')
  return {
    deriveTaskStatusBar: actual.deriveTaskStatusBar,
    humanizeToolText: toolDisplay.humanizeToolText,
    toolDisplayKey: toolDisplay.toolDisplayKey,
  }
})

vi.mock('../src/i18n', () => {
  const t = (key: string) => key
  return { useI18n: () => ({ t, locale: 'zh-CN', setLocale: async () => {} }) }
})

import { TaskStatusBar } from '../src/components/ai/TaskStatusBar'
import type { PlanStepItem } from '../src/utils/chat-render-model'

const STEPS: PlanStepItem[] = [
  { id: 's1', step: '读取配置文件', status: 'completed' },
  { id: 's2', step: '修改入口逻辑', status: 'in_progress' },
  { id: 's3', step: '运行验证脚本', status: 'pending' },
]

describe('TaskStatusBar (mobile-rn)', () => {
  // 注:react-native 测试 mock 把 Pressable/TouchableOpacity 渲染成 <button>,
  // 且 React DOM 会丢弃 testID 这类未知 camelCase 属性,故 DOM 断言用结构/文本查询;
  // testID 语义(test-status-bar / task-status-bar-kind-* / -toggle)在真实 RN 端生效。
  it('空闲(无步骤/无变更/非流式)不挂载', () => {
    const { container } = render(<TaskStatusBar planSteps={[]} isStreaming={false} />)
    expect(container.querySelector('button')).toBeNull()
    expect(container.textContent).toBe('')
  })

  it('有步骤时渲染步骤文本;流式默认展开明细', () => {
    const { getAllByText, getByText, container } = render(
      <TaskStatusBar planSteps={STEPS} isStreaming={true} />,
    )
    // running 步骤同时出现在 headline 与明细中,故用 getAllByText
    expect(getAllByText('修改入口逻辑').length).toBeGreaterThan(0)
    // 流式默认展开:pending 步骤"运行验证脚本"只在明细列表出现
    expect(getByText('运行验证脚本')).toBeTruthy()
    expect(container.querySelector('button')).toBeTruthy()
  })

  it('非流式默认收起,点击 toggle 展开明细,再点收起', () => {
    const { getByText, queryByText, container } = render(
      <TaskStatusBar planSteps={STEPS} isStreaming={false} />,
    )
    // 组件内仅一个可点行(Pressable→mock 的 button),即展开/收起 toggle
    const toggle = () => container.querySelector('button')
    // 收起态:headline 是最后一个步骤,但明细列表不可见(pending 步骤"运行验证脚本"只出现在明细里)
    expect(queryByText('运行验证脚本')).toBeNull()
    fireEvent.click(toggle()!)
    expect(getByText('运行验证脚本')).toBeTruthy()
    fireEvent.click(toggle()!)
    expect(queryByText('运行验证脚本')).toBeNull()
  })

  it('步骤标题含英文工具码名(read_file)时替换为功能名 i18n 键(t 直返键名验证链路)', () => {
    const steps: PlanStepItem[] = [
      { id: 's1', step: 'read_file: src/app.ts', status: 'in_progress' },
    ]
    // 测试 t 恒返键名,故期望 headline/步骤文本为 "taskStatus.toolReadFile: src/app.ts"
    const { getAllByText } = render(<TaskStatusBar planSteps={steps} isStreaming={true} />)
    expect(getAllByText('taskStatus.toolReadFile: src/app.ts').length).toBeGreaterThan(0)
    // 原始英文码名不得直显
    expect(() => getAllByText('read_file: src/app.ts')).toThrow()
  })

  it('映射表外的动态工具名(MCP/插件)原样保留不误替换', () => {
    const steps: PlanStepItem[] = [
      { id: 's1', step: 'mcp_search: 天气查询', status: 'in_progress' },
    ]
    const { getAllByText } = render(<TaskStatusBar planSteps={steps} isStreaming={true} />)
    expect(getAllByText('mcp_search: 天气查询').length).toBeGreaterThan(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
