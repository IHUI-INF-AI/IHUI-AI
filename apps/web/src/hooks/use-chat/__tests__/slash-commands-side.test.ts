// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D28 /side 快速侧问单元测试(2026-09-20 立):
 * - tryHandleSideSlash:/side 前缀识别(三种前缀形态 / 空参数 / 非 side 命令不误伤)
 * - answerSideQuestion:runBestOfN(question, 1) 单副本即答,回答以 sidechat 消息入
 *   真 chat store(mock runBestOfN,store 用真实实例);失败原样抛出不吞错(与 /btw 的关键差异)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useChatStore } from '@/stores/chat'
import { answerSideQuestion, tryHandleSideSlash } from '../slash-commands'

const { mockT, mockRunBestOfN, mockToast } = vi.hoisted(() => {
  const map: Record<string, string> = {
    sideBadge: '侧问',
    btwNoAnswer: '(无回答)',
  }
  const mockT = (key: string) => map[key] ?? key
  const mockRunBestOfN = vi.fn()
  const mockToast = Object.assign(vi.fn(), {
    info: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  })
  return { mockT, mockRunBestOfN, mockToast }
})

// slash-commands 模块级 import 的重依赖全部 mock,保持单测聚焦解析与即答逻辑
vi.mock('@/api/best-of-api', () => ({ runBestOfN: mockRunBestOfN }))
vi.mock('@/components/common', () => ({ toast: mockToast }))
vi.mock('@ihui/api-client', () => ({ runCommand: vi.fn() }))
vi.mock('@/lib/api', () => ({ fetchApi: vi.fn() }))
vi.mock('@/components/ai/full-access-confirm-dialog', () => ({
  isFullAccessConfirmSuppressed: () => true,
}))
vi.mock('@/stores/agent-hooks', () => ({ emitAgentHook: vi.fn() }))
vi.mock('@/stores/mode', () => ({
  useModeStore: { getState: () => ({ currentMode: 'build', setMode: vi.fn() }) },
}))
vi.mock('@/stores/ai-panel', () => ({
  useAiPanelStore: {
    getState: () => ({
      activeWorkspace: null,
      pendingPermissionMode: null,
      setPendingFullAccess: vi.fn(),
    }),
  },
}))
vi.mock('@/stores/goal', () => ({
  useGoalStore: {
    getState: () => ({ goal: null, setGoal: vi.fn(), clear: vi.fn(), setStatus: vi.fn() }),
  },
}))
vi.mock('@/stores/ide-workspace', () => ({
  useIDEWorkspace: {
    getState: () => ({ workspacePath: null, fetchGitLog: vi.fn(), fetchDiffFiles: vi.fn() }),
  },
}))
vi.mock('@/stores/best-of', () => ({
  useBestOfStore: { getState: () => ({ setResult: vi.fn() }) },
}))

describe('D28 tryHandleSideSlash — /side 前缀识别(纯解析无副作用)', () => {
  it.each([
    ['/side', null],
    ['/side  ', null],
    ['/side\n', null],
  ] as const)('命中但空参数(%j)→ handled + question null', (text, expected) => {
    expect(tryHandleSideSlash(text, mockT)).toEqual({ handled: true, question: expected })
  })

  it('/side <问题> → 提取问题正文', () => {
    expect(tryHandleSideSlash('/side 什么是量子纠缠?', mockT)).toEqual({
      handled: true,
      question: '什么是量子纠缠?',
    })
  })

  it('/side 换行接问题 → 同样提取(含多行)', () => {
    expect(tryHandleSideSlash('/side\n第一行\n第二行', mockT)).toEqual({
      handled: true,
      question: '第一行\n第二行',
    })
  })

  it('首尾空白 + 多空格分隔 → trim 后提取', () => {
    expect(tryHandleSideSlash('   /side    压缩空格参数  ', mockT)).toEqual({
      handled: true,
      question: '压缩空格参数',
    })
  })

  it.each([
    '/sideX',
    '/sider 帮我查',
    '/Side 什么是X',
    '/sid 什么是X',
    '/btw hello',
    '普通消息 /side 混排',
    '',
  ])('未命中(%j)→ handled false 交给原链路', (text) => {
    expect(tryHandleSideSlash(text, mockT)).toEqual({ handled: false, question: null })
  })
})

describe('D28 answerSideQuestion — 即答执行器(mock runBestOfN + 真实 chat store)', () => {
  beforeEach(() => {
    mockRunBestOfN.mockReset()
    useChatStore.setState({ messages: [], currentModel: 'test-model' })
  })

  it('成功:runBestOfN(question, 1) 单副本直调,回答以 sidechat 消息入 store', async () => {
    mockRunBestOfN.mockResolvedValue({
      candidates: [{ content: '量子纠缠是双粒子态关联。', model: 'gpt-x' }],
    })
    await answerSideQuestion('什么是量子纠缠?', mockT)
    expect(mockRunBestOfN).toHaveBeenCalledWith('什么是量子纠缠?', 1)
    const msgs = useChatStore.getState().messages
    expect(msgs).toHaveLength(1)
    const m = msgs[0]
    expect(m?.role).toBe('assistant')
    expect(m?.model).toBe('gpt-x')
    expect(m?.meta).toEqual({ sidechat: true })
    expect(m?.content).toContain('什么是量子纠缠?')
    expect(m?.content).toContain('量子纠缠是双粒子态关联。')
    expect(m?.content).toContain('侧问')
  })

  it('候选空回答 → 回退 btwNoAnswer 文案仍入 store', async () => {
    mockRunBestOfN.mockResolvedValue({ candidates: [{ content: '', model: 'gpt-x' }] })
    await answerSideQuestion('无回答问题', mockT)
    expect(useChatStore.getState().messages[0]?.content).toContain('(无回答)')
  })

  it('失败:原样抛出不吞错(由调用方兜底恢复输入 / toast)', async () => {
    mockRunBestOfN.mockRejectedValue(new Error('boom'))
    await expect(answerSideQuestion('会失败的问题', mockT)).rejects.toThrow('boom')
    expect(useChatStore.getState().messages).toHaveLength(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
