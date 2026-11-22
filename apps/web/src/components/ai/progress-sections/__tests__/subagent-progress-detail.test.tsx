// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// 改进A/B(2026-11-17):活跃渲染路径 SubAgentTaskTree 消费 progressPhase/progressIteration/progressTool
// + useLiveElapsed 实时计时。钉住:① 运行中显示实时秒表;② 细粒度进度行(阶段/轮次/工具名)按条件出现;
// ③ 无 progressPhase 时不渲染进度行;④ 阶段文案映射正确。
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// overlay-stack 依赖浏览器层栈,jsdom 下剪成 no-op
vi.mock('@/lib/overlay-stack', () => ({
  pushOverlay: vi.fn(),
  popOverlay: vi.fn(),
  isTopOverlay: vi.fn(() => true),
}))

// useLiveElapsed 依赖 rAF/interval 计时,直接桩成固定值以断言渲染
vi.mock('@/components/chat/stream/stream-ui', () => ({
  useLiveElapsed: vi.fn(() => 65000),
}))

// Checklist 内部用 next-intl(返回 key 即可,不崩就够;本测试不断言 i18n 文案)
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

// 深化E tools 回退用例会渲染嵌套 Checklist,其依赖 store/stream 状态非本测试关注点 → 剪成空壳
vi.mock('../checklist', () => ({
  Checklist: () => null,
}))

import { SubAgentTaskTree } from '../sub-agent-task-tree'
import type { Subagent } from '@/hooks/use-agent-progress'

afterEach(() => cleanup())

/** 构造一个运行中的子代理(含改进A/B 新字段) */
function makeRunning(overrides: Partial<Subagent> = {}): Subagent {
  return {
    id: 'sa-1',
    threadId: 'sa-1',
    nickname: 'worker',
    handle: '@worker',
    color: 'cyan',
    status: 'running',
    spawnedAt: '2026-11-17T01:00:00.000Z',
    currentTask: '分析代码结构',
    tools: [],
    ...overrides,
  }
}

describe('SubAgentTaskTree 改进A:实时计时', () => {
  it('运行中渲染 useLiveElapsed 的秒表(liveElapsedMs)', () => {
    const sa = makeRunning()
    render(<SubAgentTaskTree subagent={sa} />)
    // useLiveElapsed 桩成 65000ms → formatDuration 渲染成 1m5s 类似形态;断言存在 tabular-nums 计时块
    const timing = document.querySelector('[data-subagent-id="sa-1"]')
    expect(timing).toBeTruthy()
    expect(timing!.textContent).toContain('1m')
  })
})

describe('SubAgentTaskTree 改进B:细粒度进度行', () => {
  it('运行中显示 阶段/轮次/工具 三字段', () => {
    const sa = makeRunning({
      progressPhase: 'tool_call',
      progressIteration: 5,
      progressTool: 'search_files',
    })
    render(<SubAgentTaskTree subagent={sa} />)
    // 进度行默认展开(defaultCollapsed=false):阶段标签同时出现在折叠行(深化L内联徽章)与展开进度行
    expect(screen.getAllByText('调用工具').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('5')).toBeTruthy()
    expect(screen.getByText('search_files')).toBeTruthy()
  })

  it('progressPhase=thinking 显示"思考中"', () => {
    const sa = makeRunning({ progressPhase: 'thinking', progressIteration: 2 })
    render(<SubAgentTaskTree subagent={sa} />)
    // 深化L:折叠行内联徽章 + 展开进度行,两处同文案;折叠状态也至少有一处
    expect(screen.getAllByText('思考中').length).toBeGreaterThanOrEqual(1)
  })

  it('progressPhase=output_ready 显示"输出就绪"', () => {
    const sa = makeRunning({ progressPhase: 'output_ready' })
    render(<SubAgentTaskTree subagent={sa} />)
    expect(screen.getAllByText('输出就绪').length).toBeGreaterThanOrEqual(1)
  })

  it('无 progressPhase 时折叠行不造阶段残标', () => {
    const sa = makeRunning()
    render(<SubAgentTaskTree subagent={sa} />)
    expect(screen.queryByText('调用工具')).toBeNull()
    expect(screen.queryByText('输出就绪')).toBeNull()
  })

  // 深化L:折叠行内联阶段徽章 —— 默认折叠时依然能看到当前阶段(不展开详情)
  it('深化L:默认折叠时折叠行仍显示阶段徽章', () => {
    const sa = makeRunning({ progressPhase: 'tool_call' })
    render(<SubAgentTaskTree subagent={sa} defaultCollapsed />)
    // 折叠态下只有折叠行的内联徽章(详细进度行未渲染)
    expect(screen.getAllByText('调用工具').length).toBeGreaterThanOrEqual(1)
  })

  it('折叠行 currentTask 保留原 task 摘要(不被 phase 文案覆盖)', () => {
    const sa = makeRunning({
      currentTask: '分析代码结构',
      progressPhase: 'tool_call',
      progressTool: 'grep',
    })
    render(<SubAgentTaskTree subagent={sa} />)
    // currentTask 在折叠行 + 详情区各渲染一次 → 用 getAllByText
    expect(screen.getAllByText('分析代码结构').length).toBeGreaterThanOrEqual(1)
  })
})

describe('SubAgentTaskTree 深化C:角色/审批/输出预览', () => {
  it('有 role 时折叠行显示角色徽章', () => {
    const sa = makeRunning({ role: 'validator' })
    render(<SubAgentTaskTree subagent={sa} />)
    expect(screen.getByText('validator')).toBeTruthy()
  })

  it('无 role 时不显示角色徽章', () => {
    const sa = makeRunning()
    render(<SubAgentTaskTree subagent={sa} />)
    // 折叠行只有 handle,无角色徽章;handle 仍显示
    expect(screen.getByText('@worker')).toBeTruthy()
  })

  it('pendingApproval=true 时显示"待审批"高亮', () => {
    const sa = makeRunning({ pendingApproval: true })
    render(<SubAgentTaskTree subagent={sa} />)
    expect(screen.getByText('待审批')).toBeTruthy()
  })

  it('pendingApproval=false/缺席 时不显示"待审批"', () => {
    const sa = makeRunning({ pendingApproval: false })
    render(<SubAgentTaskTree subagent={sa} />)
    expect(screen.queryByText('待审批')).toBeNull()
  })

  it('有 outputPreview 时详情区显示输出预览文本', () => {
    const sa = makeRunning({ outputPreview: '已定位到 3 个候选文件,正在逐一核对' })
    render(<SubAgentTaskTree subagent={sa} />)
    expect(screen.getByText('已定位到 3 个候选文件,正在逐一核对')).toBeTruthy()
  })

  it('无 outputPreview 时不渲染预览块', () => {
    const sa = makeRunning()
    render(<SubAgentTaskTree subagent={sa} />)
    expect(screen.queryByText('已定位到 3 个候选文件,正在逐一核对')).toBeNull()
  })
})

describe('SubAgentTaskTree 深化D:失败归因分类', () => {
  it('rate_limited 桶显示"限流"徽章 + 可重试提示', () => {
    const sa = makeRunning({
      status: 'failed',
      failureReason: 'HTTP 429 Too Many Requests',
      failureKind: 'rate_limited',
    })
    render(<SubAgentTaskTree subagent={sa} />)
    expect(screen.getByText('限流')).toBeTruthy()
    expect(screen.getByText(/窗口滑过后重发可能成功/)).toBeTruthy()
  })

  it('credentials_rejected 桶显示"凭据被拒" + 必须换路提示', () => {
    const sa = makeRunning({
      status: 'failed',
      failureReason: 'HTTP 401 Unauthorized',
      failureKind: 'credentials_rejected',
    })
    render(<SubAgentTaskTree subagent={sa} />)
    expect(screen.getByText('凭据被拒')).toBeTruthy()
    expect(screen.getByText(/同路重发必败/)).toBeTruthy()
  })

  it('unknown/未登记 failureKind 时不显示归因徽章(不造残标)', () => {
    const sa = makeRunning({
      status: 'failed',
      failureReason: 'some weird error',
      failureKind: 'some_unknown_kind',
    })
    render(<SubAgentTaskTree subagent={sa} />)
    // 原始失败文案仍显示,但无分类徽章/处置提示
    expect(screen.getByText('some weird error')).toBeTruthy()
    expect(screen.queryByText('限流')).toBeNull()
    expect(screen.queryByText('凭据被拒')).toBeNull()
  })

  it('failureKind 缺席时只显示原始文案,无归因块', () => {
    const sa = makeRunning({
      status: 'failed',
      failureReason: 'generic failure',
    })
    render(<SubAgentTaskTree subagent={sa} />)
    expect(screen.getByText('generic failure')).toBeTruthy()
    // 处置提示文案不出现(注意:详情区 currentTask 行首有静态 "→" 箭头,不能用 /→/ 匹配)
    expect(screen.queryByText(/窗口滑过后重发/)).toBeNull()
    expect(screen.queryByText(/同路重发必败/)).toBeNull()
  })
})

describe('SubAgentTaskTree 深化K:失败来源标签(failureSource 与 failureKind 正交)', () => {
  it('failureSource=provider 时显示"上游模型"标签', () => {
    const sa = makeRunning({
      status: 'failed',
      failureReason: 'HTTP 429 Too Many Requests',
      failureKind: 'rate_limited',
      failureSource: 'provider',
    })
    render(<SubAgentTaskTree subagent={sa} />)
    // 来源标签(上游模型)与失败模式标签(限流)并存 —— 两维正交
    expect(screen.getByText('上游模型')).toBeTruthy()
    expect(screen.getByText('限流')).toBeTruthy()
  })

  it('failureSource=network 时显示"网络"标签', () => {
    const sa = makeRunning({
      status: 'failed',
      failureReason: 'ECONNRESET',
      failureKind: 'transient',
      failureSource: 'network',
    })
    render(<SubAgentTaskTree subagent={sa} />)
    expect(screen.getByText('网络')).toBeTruthy()
  })

  it('failureSource 缺席/空串时不造残标,仅显示失败模式', () => {
    const sa = makeRunning({
      status: 'failed',
      failureReason: 'HTTP 429 Too Many Requests',
      failureKind: 'rate_limited',
    })
    render(<SubAgentTaskTree subagent={sa} />)
    expect(screen.getByText('限流')).toBeTruthy()
    expect(screen.queryByText('上游模型')).toBeNull()
    expect(screen.queryByText('网络')).toBeNull()
  })

  it('failureSource=unknown 值不在非空四桶时不造残标', () => {
    const sa = makeRunning({
      status: 'failed',
      failureReason: 'HTTP 429 Too Many Requests',
      failureKind: 'rate_limited',
      failureSource: 'some_unknown_source' as never,
    })
    render(<SubAgentTaskTree subagent={sa} />)
    expect(screen.getByText('限流')).toBeTruthy()
    expect(screen.queryByText('上游模型')).toBeNull()
  })
})

describe('SubAgentTaskTree 深化E:工具调用累计次数', () => {
  it('toolCalls 权威值 > 0 时折叠行显示"N次"', () => {
    const sa = makeRunning({ toolCalls: 7 })
    render(<SubAgentTaskTree subagent={sa} />)
    expect(screen.getByText('7次')).toBeTruthy()
  })

  it('toolCalls 缺席时回退 tools.length', () => {
    const sa = makeRunning({
      tools: [
        { id: 't1', toolName: 'a', status: 'success', startedAt: 'x' },
        { id: 't2', toolName: 'b', status: 'success', startedAt: 'y' },
      ] as never,
    })
    render(<SubAgentTaskTree subagent={sa} />)
    expect(screen.getByText('2次')).toBeTruthy()
  })

  it('toolCalls=0 且无 tools 时不显示计数', () => {
    const sa = makeRunning()
    render(<SubAgentTaskTree subagent={sa} />)
    expect(screen.queryByText('0次')).toBeNull()
  })
})

describe('SubAgentTaskTree 深化F:弱证据失败标记', () => {
  it('failureAttributionStrong=false 时显示"待确认"提示', () => {
    const sa = makeRunning({
      status: 'failed',
      failureReason: 'looks like a timeout',
      failureAttributionStrong: false,
    })
    render(<SubAgentTaskTree subagent={sa} />)
    expect(screen.getByText(/归因来自间接线索/)).toBeTruthy()
  })

  it('failureAttributionStrong=true(强证据)时不显示弱证据提示', () => {
    const sa = makeRunning({
      status: 'failed',
      failureReason: 'HTTP 429',
      failureKind: 'rate_limited',
      failureAttributionStrong: true,
    })
    render(<SubAgentTaskTree subagent={sa} />)
    expect(screen.queryByText(/归因来自间接线索/)).toBeNull()
  })
})

describe('SubAgentTaskTree 深化H:工具调用成功率', () => {
  it('全部成功时显示绿色成功率 100%', () => {
    const sa = makeRunning({
      tools: [
        { id: 't1', toolName: 'a', status: 'success', startedAt: 'x' },
        { id: 't2', toolName: 'b', status: 'success', startedAt: 'y' },
        { id: 't3', toolName: 'c', status: 'success', startedAt: 'z' },
      ] as never,
    })
    render(<SubAgentTaskTree subagent={sa} defaultCollapsed={false} />)
    const rate = screen.getByTestId(`subagent-tool-success-rate-${sa.id}`)
    expect(rate).toBeTruthy()
    expect(rate.textContent).toContain('100%')
    expect(rate.className).toContain('emerald')
  })

  it('有失败时显示红色成功率', () => {
    const sa = makeRunning({
      tools: [
        { id: 't1', toolName: 'a', status: 'success', startedAt: 'x' },
        { id: 't2', toolName: 'b', status: 'error', startedAt: 'y' },
      ] as never,
    })
    render(<SubAgentTaskTree subagent={sa} defaultCollapsed={false} />)
    const rate = screen.getByTestId(`subagent-tool-success-rate-${sa.id}`)
    expect(rate).toBeTruthy()
    expect(rate.textContent).toContain('50%')
    expect(rate.className).toContain('red')
  })

  it('所有工具都 running 时（无终态）不显示成功率', () => {
    const sa = makeRunning({
      tools: [
        { id: 't1', toolName: 'a', status: 'running', startedAt: 'x' },
      ] as never,
    })
    render(<SubAgentTaskTree subagent={sa} defaultCollapsed={false} />)
    expect(screen.queryByTestId(`subagent-tool-success-rate-${sa.id}`)).toBeNull()
  })

  it('tools 为空时不显示成功率', () => {
    const sa = makeRunning()
    render(<SubAgentTaskTree subagent={sa} defaultCollapsed={false} />)
    expect(screen.queryByTestId(`subagent-tool-success-rate-${sa.id}`)).toBeNull()
  })
})

// ─── 深化S:折叠行工具失败预警 ──
// 深化H 的成功率只在展开后可见;折叠态看不到某个子代理工具大面积失败。
// 深化S 钉住:有工具失败(error>0)时折叠行亮红色"工具 N/M 失败"预警,免展开;无失败/无工具不造残标。
describe('SubAgentTaskTree 深化S:折叠行工具失败预警', () => {
  it('折叠态有工具失败时显示红色预警"工具 1/2 失败"', () => {
    const sa = makeRunning({
      tools: [
        { id: 't1', toolName: 'a', status: 'success', startedAt: 'x' },
        { id: 't2', toolName: 'b', status: 'error', startedAt: 'y' },
      ] as never,
    })
    render(<SubAgentTaskTree subagent={sa} defaultCollapsed />)
    const flag = screen.getByTestId(`subagent-tool-fail-flag-${sa.id}`)
    expect(flag).toBeTruthy()
    expect(flag.textContent).toContain('工具 1/2 失败')
    expect(flag.className).toContain('red')
  })

  it('折叠态全部成功时不造失败预警残标', () => {
    const sa = makeRunning({
      tools: [
        { id: 't1', toolName: 'a', status: 'success', startedAt: 'x' },
        { id: 't2', toolName: 'b', status: 'success', startedAt: 'y' },
      ] as never,
    })
    render(<SubAgentTaskTree subagent={sa} defaultCollapsed />)
    expect(screen.queryByTestId(`subagent-tool-fail-flag-${sa.id}`)).toBeNull()
  })

  it('工具全 running(无终态)时不造失败预警', () => {
    const sa = makeRunning({
      tools: [{ id: 't1', toolName: 'a', status: 'running', startedAt: 'x' }] as never,
    })
    render(<SubAgentTaskTree subagent={sa} defaultCollapsed />)
    expect(screen.queryByTestId(`subagent-tool-fail-flag-${sa.id}`)).toBeNull()
  })

  it('tools 为空时不造失败预警', () => {
    const sa = makeRunning()
    render(<SubAgentTaskTree subagent={sa} defaultCollapsed />)
    expect(screen.queryByTestId(`subagent-tool-fail-flag-${sa.id}`)).toBeNull()
  })
})

// ─── 深化K:失败来源标签表完整性(防漂移) ──
// ErrorAttributionSource 非空四桶 = 'provider'|'runtime'|'network'|'tool'(空串=unknown 不造标)。
// 本测试钉住:共享标签表 FAILURE_SOURCE_LABEL 必须覆盖四桶且不多不少,防止与后端来源枚举漂移
// 导致"后端发了 source 但前端查不到标签"或"表里有后端已废弃的 source"两类静默失配。
describe('failure-kind-meta FAILURE_SOURCE_LABEL 防漂移', () => {
  it('标签表恰好覆盖 ErrorAttributionSource 非空四桶', async () => {
    const { KNOWN_FAILURE_SOURCES, FAILURE_SOURCE_LABEL } = await import('../failure-kind-meta')
    // 恰好四桶,不多不少(空串不算 source)
    expect([...KNOWN_FAILURE_SOURCES].sort()).toEqual(
      ['network', 'provider', 'runtime', 'tool'].sort(),
    )
    // 每个已知来源都有非空中文标签
    for (const src of KNOWN_FAILURE_SOURCES) {
      const label = FAILURE_SOURCE_LABEL[src]
      expect(typeof label).toBe('string')
      expect(label?.length).toBeGreaterThan(0)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
