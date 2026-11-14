// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D27(2026-09-20 立):TaskDetailDialog tab 化测试。
 *
 * 覆盖:三 tab(概览/交付清单/代码变更)testid 存在、默认概览、
 * 点击切换后对应 panel 条件渲染、交付清单 tab 激活且 payload.sessionId
 * 存在时拉会话级交付端点(跨端契约 URL)、失败信封空态兜底、
 * 本地 task.result.deliverables 同步优先展示(端点仍拉取供跨会话合并)、代码变更 tab 合并列表。
 * @ihui/ui-react 用轻量替身替代 Radix Dialog,聚焦 tab 交互逻辑本身。
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import React from 'react'
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'zh-CN',
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
}))

vi.mock('@/lib/agent-kanban-api', () => ({
  transitionKanbanTask: vi.fn(),
  deleteKanbanTask: vi.fn(),
  fetchWorkspaceLock: vi.fn(() => Promise.resolve(null)),
}))

vi.mock('@/lib/api', () => ({
  fetchApi: vi.fn(),
}))

// @ihui/ui-react 轻量替身:Dialog 直接按 open 条件挂载,无需 Radix portal
vi.mock('@ihui/ui-react', () => {
  const Div = (props: React.ComponentProps<'div'>) => <div {...props} />
  return {
    Dialog: ({ open, children }: { open?: boolean; children?: React.ReactNode }) =>
      open ? <div>{children}</div> : null,
    DialogContent: Div,
    DialogHeader: Div,
    DialogTitle: Div,
    DialogDescription: Div,
    DialogFooter: Div,
    Button: (props: React.ComponentProps<'button'>) => <button {...props} />,
    Input: (props: React.ComponentProps<'input'>) => <input {...props} />,
    // 测试替身无真实表单控件关联,豁免 a11y 静态检查
    // eslint-disable-next-line jsx-a11y/label-has-associated-control
    Label: (props: React.ComponentProps<'label'>) => <label {...props} />,
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
  }
})

// Tooltip 依赖 TooltipProvider(radix),单测中直接透传 children
vi.mock('@/components/feedback', () => ({
  Tooltip: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}))

// 演示型展示组件替身(聚焦 tab 交互,不测截断细节)
vi.mock('@/components/common/CenteredText', () => ({
  CenteredText: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}))
vi.mock('@/components/common/TruncatedText', () => ({
  TruncatedText: ({ value }: { value?: string }) => <span>{value}</span>,
}))

// DeliveryReviewPanel → CitationBar 内部读取 WorkPanel store,测试环境注入空实现
vi.mock('@/stores/work-panel', () => ({
  useWorkPanelStore: (selector: (s: { openPanel: () => void }) => unknown) =>
    selector({ openPanel: () => {} }),
}))

import { TaskDetailDialog } from '../TaskDetailDialog'
import { fetchApi } from '@/lib/api'
import type { KanbanTask } from '@ihui/types'
import type { TaskDeliverables } from '@/types/agent-delivery'

/** 端点信封类型别名(mock 解析值用) */
type FetchEnvelope = Awaited<ReturnType<typeof fetchApi>>

/** 合法交付清单样本(1 条文件变更 + 1 条引用) */
const validDeliverables: TaskDeliverables = {
  citations: [{ source: 'wiki', label: '架构页', url: 'https://aizhs.top/wiki/1' }],
  filesChanged: [{ path: 'src/a.ts', kind: 'add', stepIds: ['s1'], additions: 10, deletions: 0 }],
  toolsSummary: { total: 3, byTool: { read_file: 2, grep: 1 } },
  outputSummary: '已完成交付',
  generatedAt: '2026-09-20T08:00:00.000Z',
}

/** 最小可用任务(payload.sessionId 关联会话;done 状态无合法流转避免表单干扰) */
function makeTask(overrides: Record<string, unknown> = {}): KanbanTask {
  return {
    id: 'task-1',
    agentId: 'agent-1',
    name: '实现登录页',
    description: '做一个登录页',
    status: 'done',
    priority: 2,
    payload: { sessionId: 'sess-1' },
    createdAt: '2026-09-20T07:00:00.000Z',
    updatedAt: '2026-09-20T08:00:00.000Z',
    ...overrides,
  } as unknown as KanbanTask
}

function renderDialog(task: KanbanTask) {
  return render(
    <TaskDetailDialog task={task} open onOpenChange={() => {}} onTaskChanged={() => {}} />,
  )
}

describe('TaskDetailDialog tab 化(D27 交付审查视图)', () => {
  beforeEach(() => {
    vi.mocked(fetchApi).mockReset()
  })
  afterEach(() => cleanup())

  it('默认渲染三 tab 与概览面板,交付/变更面板不出现', () => {
    renderDialog(makeTask())
    expect(screen.getByTestId('task-detail-tab-overview')).toBeTruthy()
    expect(screen.getByTestId('task-detail-tab-delivery')).toBeTruthy()
    expect(screen.getByTestId('task-detail-tab-changes')).toBeTruthy()
    expect(screen.getByTestId('task-detail-panel-overview')).toBeTruthy()
    expect(screen.queryByTestId('task-detail-panel-delivery')).toBeNull()
    expect(screen.queryByTestId('task-detail-panel-changes')).toBeNull()
  })

  it('点击交付清单 tab:条件渲染 + 有 sessionId 时拉端点并渲染交付面板', async () => {
    vi.mocked(fetchApi).mockResolvedValue({
      success: true,
      data: validDeliverables,
    } as unknown as FetchEnvelope)
    renderDialog(makeTask())
    fireEvent.click(screen.getByTestId('task-detail-tab-delivery'))
    expect(screen.getByTestId('task-detail-panel-delivery')).toBeTruthy()
    expect(fetchApi).toHaveBeenCalledTimes(1)
    expect(fetchApi).toHaveBeenCalledWith('/api/v1/ai/agents/sessions/sess-1/deliverables')
    await waitFor(() => expect(screen.getByTestId('delivery-review-panel')).toBeTruthy())
    // 加载态已退场
    expect(screen.queryByTestId('delivery-review-loading')).toBeNull()
  })

  it('端点拉取中展示加载态,resolve 后切换为面板', async () => {
    let resolveFetch!: (v: FetchEnvelope) => void
    vi.mocked(fetchApi).mockImplementation(
      () => new Promise<FetchEnvelope>((res) => (resolveFetch = res)),
    )
    renderDialog(makeTask())
    fireEvent.click(screen.getByTestId('task-detail-tab-delivery'))
    expect(await screen.findByTestId('delivery-review-loading')).toBeTruthy()
    resolveFetch({ success: true, data: validDeliverables } as FetchEnvelope)
    await waitFor(() => expect(screen.getByTestId('delivery-review-panel')).toBeTruthy())
  })

  it('失败信封(success=false)→ 交付面板空态兜底,不抛错', async () => {
    vi.mocked(fetchApi).mockResolvedValue({ success: false } as unknown as FetchEnvelope)
    renderDialog(makeTask())
    fireEvent.click(screen.getByTestId('task-detail-tab-delivery'))
    await waitFor(() => expect(screen.getByTestId('delivery-review-empty')).toBeTruthy())
    expect(screen.queryByTestId('delivery-review-panel')).toBeNull()
  })

  it('本地 task.result.deliverables 同步渲染面板优先展示;端点仍并行拉取一次供跨会话合并', () => {
    vi.mocked(fetchApi).mockResolvedValue({
      success: true,
      data: validDeliverables,
    } as unknown as FetchEnvelope)
    renderDialog(makeTask({ result: { deliverables: validDeliverables } }))
    fireEvent.click(screen.getByTestId('task-detail-tab-delivery'))
    // 端点拉取不因本地数据跳过(changes tab 的 mergeFilesChanged 跨会话合并依赖它)
    expect(fetchApi).toHaveBeenCalledTimes(1)
    // 本地数据即时渲染面板,不等端点 resolve
    expect(screen.getByTestId('delivery-review-panel')).toBeTruthy()
    expect(screen.getByTestId('delivery-review-file-0')).toBeTruthy()
  })

  it('点击代码变更 tab:跨会话合并列表渲染,概览面板常驻 hidden 不卸载', () => {
    renderDialog(makeTask({ result: { deliverables: validDeliverables } }))
    fireEvent.click(screen.getByTestId('task-detail-tab-changes'))
    expect(screen.getByTestId('task-detail-panel-changes')).toBeTruthy()
    expect(screen.getByTestId('delivery-review-file-0')).toBeTruthy()
    expect(screen.getByTestId('task-detail-panel-changes').textContent).toContain('(1)')
    // 概览内容常驻挂载(非激活时 hidden,保留表单态)
    expect(screen.queryByTestId('task-detail-panel-overview')).toBeTruthy()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
