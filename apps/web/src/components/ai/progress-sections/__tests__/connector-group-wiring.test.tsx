// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment happy-dom
/**
 * D81 ⑤ 连接器读写分组 · web 生产接线锁(2026-10-29 立)。
 *
 * 立因:`groupToolActivitiesByConnector`(共享层 `packages/shared/src/chat/tool-category.ts`)
 * 判据与契约用例早就存在,但**生产侧零消费者** —— 原注释如实登记过这一状态。
 * 本件咬三件事,且全部经生产出口断言、不复制任何判据:
 *  ① 分组键与顺序来自共享层函数本身(同连接器同方向合一组、连接器不同不合并);
 *  ② 读/写方向由共享层 `FILE_WRITE_TOOLS` 决定(写类工具落 write、其余落 read);
 *  ③ 无连接器来源的调用不进本段 —— 共享层内部的 `__none__` 兜底桶**绝不**被当标签打出去。
 * 另加一对反向对照:没有带来源的调用时整段不出现(不渲染空壳分组头)。
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FILE_WRITE_TOOLS } from '@ihui/shared/chat'

vi.mock('next-intl', () => ({
  useTranslations:
    () =>
    (key: string, params?: Record<string, string | number>): string =>
      params && 'connector' in params ? `[${key}:${String(params['connector'])}]` : `[${key}]`,
  useLocale: () => 'zh-CN',
}))

vi.mock('@/hooks/use-analytics', () => ({
  useAnalytics: () => ({ track: vi.fn() }),
}))

import {
  ConnectorGroupSection,
  toConnectorActivityItems,
  type ConnectorCallLike,
} from '@/components/ai/progress-sections/connector-group-section'
import { ToolCallSummaryCard } from '@/components/ai/progress-sections/tool-call-summary-card'
import { TooltipProvider } from '@/components/feedback'

type Call = ConnectorCallLike & { status?: string }

function call(over: Partial<Call> & { toolName: string }): Call {
  return { status: 'success', ...over }
}

afterEach(() => {
  cleanup()
})

describe('D81 ⑤ 连接器分组 · 输入映射(方向判据取共享层)', () => {
  it('mcp / plugin 才带来源;其余(含 builtin / 未标)一律不进分组', () => {
    const items = toConnectorActivityItems([
      call({ id: 'a', toolName: 'read_file', serverSource: 'mcp', serverName: 'github' }),
      call({ id: 'b', toolName: 'read_file', serverSource: 'builtin' }),
      call({ id: 'c', toolName: 'read_file' }),
      call({ id: 'd', toolName: 'read_file', serverSource: 'plugin', serverId: 'notion' }),
    ])
    expect(items.map((i) => i.id)).toEqual(['a', 'd'])
    expect(items.map((i) => i.connector)).toEqual(['github', 'notion'])
  })

  it('方向由共享层 FILE_WRITE_TOOLS 决定,端内零名单', () => {
    // 写类白名单逐枚取真值来构造,证明用的是同一把尺子(而不是抄来的名字)
    const writeTools = [...FILE_WRITE_TOOLS]
    expect(writeTools.length).toBeGreaterThan(0)
    const items = toConnectorActivityItems([
      ...writeTools.map((toolName, i) =>
        call({ id: `w${i}`, toolName, serverSource: 'mcp', serverName: 'gh' }),
      ),
      call({ id: 'r', toolName: 'read_file', serverSource: 'mcp', serverName: 'gh' }),
    ])
    expect(items.filter((i) => i.direction === 'write')).toHaveLength(writeTools.length)
    expect(items.find((i) => i.id === 'r')?.direction).toBe('read')
  })

  it('空白连接器名被剔除(不会把 __none__ 兜底桶带进渲染)', () => {
    const items = toConnectorActivityItems([
      call({ id: 'x', toolName: 'read_file', serverSource: 'mcp', serverName: '   ' }),
      call({ id: 'y', toolName: 'read_file', serverSource: 'mcp', serverId: '' }),
    ])
    expect(items).toEqual([])
  })
})

describe('D81 ⑤ 连接器分组 · 独立挂载渲染', () => {
  it('同连接器同方向合一组、方向不同分两组,分组头文案走 taskStatus 词包', () => {
    render(
      <ConnectorGroupSection
        toolCalls={[
          call({ id: '1', toolName: 'read_file', serverSource: 'mcp', serverName: 'github' }),
          call({ id: '2', toolName: 'search_codebase', serverSource: 'mcp', serverName: 'github' }),
          call({ id: '3', toolName: 'write_file', serverSource: 'mcp', serverName: 'github' }),
        ]}
      />,
    )
    // 一组读(github) + 一组写(github)
    const readGroup = screen.getByTestId('connector-group-read-github')
    const writeGroup = screen.getByTestId('connector-group-write-github')
    expect(readGroup).toBeTruthy()
    expect(writeGroup).toBeTruthy()
    // 组内条目数:读 2、写 1
    expect(readGroup.querySelectorAll('[data-testid^="connector-group-item-"]')).toHaveLength(2)
    expect(writeGroup.querySelectorAll('[data-testid^="connector-group-item-"]')).toHaveLength(1)
    // 分组头键:read→readingConnector / write→writingConnector(五语言词包里的既有键)
    expect(readGroup.textContent).toContain('readingConnector')
    expect(writeGroup.textContent).toContain('writingConnector')
  })

  it('连接器不同即不同组(反向对照:同方向也不得被合并)', () => {
    render(
      <ConnectorGroupSection
        toolCalls={[
          call({ id: 'g', toolName: 'read_file', serverSource: 'mcp', serverName: 'github' }),
          call({ id: 'n', toolName: 'read_file', serverSource: 'mcp', serverName: 'notion' }),
        ]}
      />,
    )
    expect(screen.getByTestId('connector-group-read-github')).toBeTruthy()
    expect(screen.getByTestId('connector-group-read-notion')).toBeTruthy()
  })

  it('反向对照:无带来源调用 ⇒ 整段不出现(不渲染空壳分组头)', () => {
    const { container } = render(
      <ConnectorGroupSection
        toolCalls={[
          call({ id: 'a', toolName: 'read_file' }),
          call({ id: 'b', toolName: 'write_file', serverSource: 'builtin' }),
        ]}
      />,
    )
    expect(container.querySelector('[data-testid="connector-group-section"]')).toBeNull()
    expect(container.querySelectorAll('[data-testid^="connector-group-"]')).toHaveLength(0)
  })

  it('空入参同样整段不出现(不抛错)', () => {
    const { container } = render(<ConnectorGroupSection toolCalls={[]} />)
    expect(container.querySelector('[data-testid="connector-group-section"]')).toBeNull()
  })
})

describe('D81 ⑤ 连接器分组 · 经 ToolCallSummaryCard 的生产接线', () => {
  function renderCard(toolCalls: Call[]) {
    render(
      <TooltipProvider>
        <ToolCallSummaryCard toolCalls={toolCalls} isStreaming={false} />
      </TooltipProvider>,
    )
  }

  it('卡片展开后出现连接器分组段,且分组头按连接器名渲染', () => {
    renderCard([
      call({ id: '1', toolName: 'read_file', serverSource: 'mcp', serverName: 'github' }),
      call({ id: '2', toolName: 'write_file', serverSource: 'mcp', serverName: 'github' }),
    ])
    // 汇总卡默认折叠(FoldableSection defaultOpen=false),先展开
    const header = screen.getByTestId('tool-call-summary-card').querySelector('button')
    expect(header).toBeTruthy()
    fireEvent.click(header!)
    const section = screen.getByTestId('connector-group-section')
    expect(section).toBeTruthy()
    expect(section.textContent).toContain('github')
    expect(section.textContent).toContain('readingConnector')
    expect(section.textContent).toContain('writingConnector')
  })

  it('全部为内置工具时卡片内不出现分组段(与独立挂载同判据)', () => {
    renderCard([call({ id: '1', toolName: 'read_file' }), call({ id: '2', toolName: 'bash' })])
    const header = screen.getByTestId('tool-call-summary-card').querySelector('button')
    fireEvent.click(header!)
    expect(screen.queryByTestId('connector-group-section')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
