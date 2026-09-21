// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
/**
 * D28 /side 快速侧问 · useMessageSend.submit 分流回归测试(2026-09-20 立)
 * mock runBestOfN + useChatStore,保留真实 tryHandleSideSlash 前缀解析:
 * - 空闲:直调 runBestOfN(question, 1) 即答 + addMessage(sidechat) + 清空输入(等同 /btw)
 * - 流式中:入当前会话侧问队列(enqueueSideQuestion)+ sideEnqueued 提示 + 清空输入
 * - 流式中且会话未持久化:保留输入 + sideNoConversation 错误提示,不入队
 * - 空参数:sideUsage 用法提示 + 清空输入
 * - 即答失败:sideAnswerFailed toast + 输入恢复为 /side <问题> 供重试
 * - 非 /side 文本不拦截,照常走 onSend 主链路
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { renderHook, act } from '@testing-library/react'

// ─── Mocks ────────────────────────────────────────────────────────
const { mockT, mockRunBestOfN, mockToast, chatStoreState } = vi.hoisted(() => {
  const map: Record<string, string> = {
    sideBadge: '侧问',
    btwNoAnswer: '(无回答)',
    sideUsage: '快速侧问用法提示',
    sideEnqueued: '侧问已排队',
    sideNoConversation: '会话尚未持久化无法排队',
    sideAnswerFailed: '侧问回答失败: {error}',
  }
  const mockT = (key: string, vars?: Record<string, string>) => {
    let out = map[key] ?? key
    for (const [k, v] of Object.entries(vars ?? {})) {
      out = out.replaceAll(`{${k}}`, v)
    }
    return out
  }
  const mockRunBestOfN = vi.fn()
  const mockToast = Object.assign(vi.fn(), {
    info: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  })
  const chatStoreState = {
    messages: [] as unknown[],
    subAgentActivities: [] as unknown[],
    conversationId: 'conv-1' as string | null,
    currentModel: 'test-model',
    draftInput: null,
    selectedTools: [] as unknown[],
    addMessage: vi.fn(),
    enqueueSideQuestion: vi.fn(),
    // W27 输入历史(主链路 doSend 成功后调用,本测试仅防未定义)
    pushInputHistory: () => {},
  }
  return { mockT, mockRunBestOfN, mockToast, chatStoreState }
})

vi.mock('next-intl', () => ({
  useTranslations: () => mockT,
}))

// chat store mock(getState 静态方法为 zustand 真实 store 自带,mock 必须提供)
vi.mock('@/stores/chat', () => ({
  useChatStore: Object.assign(
    (selector: (s: typeof chatStoreState) => unknown) =>
      selector ? selector(chatStoreState) : chatStoreState,
    { getState: () => chatStoreState },
  ),
}))

// D28 即答通道 mock(真实 answerSideQuestion 内部调用,保留其 addMessage 组装逻辑)
vi.mock('@/api/best-of-api', () => ({ runBestOfN: mockRunBestOfN }))

// toast 整桶替换(保留桶内其余导出,仅注入可断言的 mock toast)
vi.mock('@/components/common', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, toast: mockToast }
})

vi.mock('@/lib/tauri-bridge', () => ({
  isTauri: () => false,
  checkForUpdates: () => Promise.resolve(null),
  installUpdate: () => Promise.resolve(),
}))

// WebInputCore mock(displayName 通过 Object.assign 显式设置)
vi.mock('@/components/chat/web-input-core', () => ({
  WebInputCore: Object.assign(
    // eslint-disable-next-line react/display-name
    React.forwardRef<
      { resize: () => void; focus: () => void; setSelectionRange: () => void },
      {
        text: string
        placeholder: string
        isStreaming: boolean
        onTextChange: (v: string) => void
        onSend: () => void
        onStop: () => void
        onClear: () => void
        t: (k: string) => string
        sendLabel: string
        stopLabel: string
        onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
        onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
        onPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void
      }
    >((props, ref) => {
      React.useImperativeHandle(ref, () => ({
        resize: () => {},
        focus: () => {},
        setSelectionRange: () => {},
      }))
      return (
        <textarea
          data-testid="web-input-core"
          value={props.text}
          placeholder={props.placeholder}
          disabled={props.isStreaming}
          onChange={(e) => {
            props.onChange(e)
            props.onTextChange(e.target.value)
          }}
          onKeyDown={props.onKeyDown}
          onPaste={props.onPaste}
        />
      )
    }),
    { displayName: 'WebInputCoreMock' },
  ),
  MAX_LENGTH: 10000,
}))

vi.mock('@/components/ai/permission-mode-popover', () => ({
  PermissionModePopover: () => null,
  isHighRiskPermissionMode: () => false,
}))
vi.mock('@/hooks/use-permission-auto-revert', () => ({
  usePermissionAutoRevert: () => ({
    isActive: false,
    remainingMs: 0,
  }),
  formatRemaining: () => '0s',
}))
vi.mock('@/hooks/use-slash-commands', () => ({
  useSlashCommands: () => [],
}))
vi.mock('@/hooks/use-slash-action', () => ({
  useSlashAction: () => ({
    promptTemplates: [],
    handleCommandSelect: () => {},
    handleCommandArgsSelect: () => {},
  }),
}))
vi.mock('@/hooks/use-permission-mode-cycle', () => ({
  usePermissionModeCycle: () => ({
    shortcutsOpen: false,
    closeShortcuts: () => {},
    cyclePermissionMode: () => {},
  }),
}))
vi.mock('@/hooks/use-message-references', () => ({
  useMessageReferences: () => ({
    references: [],
    addFileReference: () => {},
    addTextReference: () => {},
    removeReference: () => {},
    resetReferences: () => {},
  }),
}))
vi.mock('@/hooks/use-lazy-resource-hooks', () => ({
  useMentionFiles: () => [],
  useAiSkills: () => [[], false],
}))
vi.mock('@/components/ai/permission-shortcuts-modal', () => ({
  PermissionShortcutsModal: () => null,
}))
vi.mock('@/components/ai/permission-mode-info-modal', () => ({
  PermissionModeInfoModal: () => null,
}))
vi.mock('@/components/ai/agent-progress-trigger', () => ({
  AgentProgressTrigger: () => null,
}))
vi.mock('@/components/chat/full-access-confirm-bridge', () => ({
  FullAccessConfirmBridge: () => null,
}))
vi.mock('@/components/chat/high-risk-warning-banner', () => ({
  HighRiskWarningBanner: () => null,
}))
vi.mock('@/components/chat/add-menu-popover', () => ({
  AddMenuPopover: () => null,
}))
vi.mock('@/components/chat/voice-input', () => ({
  VoiceInput: () => null,
}))
vi.mock('@/components/chat/model-selector', () => ({
  ModelSelector: () => null,
}))
vi.mock('@/components/ai/context-usage-ring', () => ({
  ContextUsageRing: () => null,
}))
vi.mock('@/components/ai/slash-command-palette', () => ({
  SlashCommandPalette: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('@/components/chat/mention-popover', () => ({
  MentionChips: () => null,
}))
vi.mock('@/components/ai/file-mention-popover', () => ({
  FileMentionPopover: () => null,
}))
vi.mock('@/components/chat/selected-tools-panel', () => ({
  SelectedToolsPanel: () => null,
}))
vi.mock('@/components/feedback', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/components/feedback')
  return {
    ...actual,
    Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  }
})
vi.mock('@/lib/nav-styles', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/lib/nav-styles')
  return {
    ...actual,
    INPUT_ATTACHMENT_BAR_CLASS: '',
  }
})

vi.mock('@plugins-data', () => ({
  __esModule: true,
  MARKET_PLUGINS: [],
  PROJECT_PLUGINS: [],
  getPluginIntegration: () => null,
}))

import { useMessageSend } from '../src/hooks/use-message-send'

/** 渲染 useMessageSend 的公共辅助:setValue 经闭包同步 currentValue,供清空/恢复断言 */
function renderSendHook(params: {
  isStreaming: boolean
  initial: string
  onSend?: (content: string) => Promise<boolean> | boolean
}) {
  let currentValue = params.initial
  const setValueMock = vi.fn((v: React.SetStateAction<string>) => {
    currentValue = typeof v === 'function' ? (v as (p: string) => string)(currentValue) : v
  })
  const inputCoreRef: React.RefObject<{
    resize: () => void
    focus: () => void
    setSelectionRange: () => void
  }> = {
    current: { resize: () => {}, focus: () => {}, setSelectionRange: () => {} },
  }
  const { result } = renderHook(() =>
    useMessageSend({
      value: currentValue,
      setValue: setValueMock,
      isStreaming: params.isStreaming,
      isHighRisk: false,
      references: [],
      resetReferences: () => {},
      addFileReference: () => {},
      addTextReference: () => {},
      onSend: params.onSend ?? vi.fn().mockResolvedValue(true),
      inputCoreRef,
      draftKey: 'chat:draft',
    }),
  )
  return { result, getValue: () => currentValue, setValueMock }
}

describe('useMessageSend — D28 /side submit 分流', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    chatStoreState.conversationId = 'conv-1'
    if (typeof window !== 'undefined') {
      window.localStorage.clear()
    }
  })

  it('空闲即答:runBestOfN(question,1) 单副本直调 + sidechat 消息入流 + 清空输入,不入队', async () => {
    mockRunBestOfN.mockResolvedValue({
      candidates: [{ content: '量子纠缠是双粒子态关联。', model: 'gpt-x' }],
    })
    const { result, getValue } = renderSendHook({
      isStreaming: false,
      initial: '/side 什么是量子纠缠?',
    })

    await act(async () => {
      await result.current.submit()
    })

    expect(mockRunBestOfN).toHaveBeenCalledWith('什么是量子纠缠?', 1)
    expect(chatStoreState.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'assistant',
        model: 'gpt-x',
        meta: { sidechat: true },
      }),
    )
    expect(chatStoreState.enqueueSideQuestion).not.toHaveBeenCalled()
    expect(getValue()).toBe('')
    // 即答成功不弹 toast(回答立即可见)
    expect(mockToast.error).not.toHaveBeenCalled()
    expect(mockToast.info).not.toHaveBeenCalled()
  })

  it('流式中:入当前会话侧问队列 + sideEnqueued 提示 + 清空输入,不直调 runBestOfN', async () => {
    const { result, getValue } = renderSendHook({
      isStreaming: true,
      initial: '/side 帮我看看这段报错',
    })

    await act(async () => {
      await result.current.submit()
    })

    expect(chatStoreState.enqueueSideQuestion).toHaveBeenCalledWith('conv-1', '帮我看看这段报错')
    expect(mockToast.info).toHaveBeenCalledWith('侧问已排队')
    expect(mockRunBestOfN).not.toHaveBeenCalled()
    expect(chatStoreState.addMessage).not.toHaveBeenCalled()
    expect(getValue()).toBe('')
  })

  it('流式中且会话未持久化:保留输入 + sideNoConversation 错误提示,不入队', async () => {
    chatStoreState.conversationId = null
    const { result, getValue } = renderSendHook({
      isStreaming: true,
      initial: '/side 极罕见流中无会话',
    })

    await act(async () => {
      await result.current.submit()
    })

    expect(mockToast.error).toHaveBeenCalledWith('会话尚未持久化无法排队')
    expect(chatStoreState.enqueueSideQuestion).not.toHaveBeenCalled()
    expect(mockRunBestOfN).not.toHaveBeenCalled()
    expect(getValue()).toBe('/side 极罕见流中无会话')
  })

  it('空参数(/side 无正文):sideUsage 用法提示 + 清空输入,不发请求不入队', async () => {
    const { result, getValue } = renderSendHook({ isStreaming: false, initial: '/side' })

    await act(async () => {
      await result.current.submit()
    })

    expect(mockToast.info).toHaveBeenCalledWith('快速侧问用法提示')
    expect(mockRunBestOfN).not.toHaveBeenCalled()
    expect(chatStoreState.enqueueSideQuestion).not.toHaveBeenCalled()
    expect(getValue()).toBe('')
  })

  it('即答失败:sideAnswerFailed toast + 输入恢复为 /side <问题> 供重试', async () => {
    mockRunBestOfN.mockRejectedValueOnce(new Error('boom'))
    const { result, getValue } = renderSendHook({
      isStreaming: false,
      initial: '/side 会失败的问题',
    })

    await act(async () => {
      await result.current.submit()
    })

    expect(mockToast.error).toHaveBeenCalledWith('侧问回答失败: boom')
    expect(getValue()).toBe('/side 会失败的问题')
    expect(chatStoreState.enqueueSideQuestion).not.toHaveBeenCalled()
  })

  it('非 /side 文本不拦截:照常走 onSend 主链路', async () => {
    const onSend = vi.fn().mockResolvedValue(true)
    const { result } = renderSendHook({ isStreaming: false, initial: '普通问题', onSend })

    await act(async () => {
      await result.current.submit()
    })

    expect(onSend).toHaveBeenCalledWith('普通问题')
    expect(mockRunBestOfN).not.toHaveBeenCalled()
    expect(chatStoreState.enqueueSideQuestion).not.toHaveBeenCalled()
  })

  it('前导空格的 /side 依旧命中(text 先 trim 再识别)', async () => {
    mockRunBestOfN.mockResolvedValue({ candidates: [{ content: 'ok', model: 'm' }] })
    const { result, getValue } = renderSendHook({
      isStreaming: false,
      initial: '   /side  前导空格  ',
    })

    await act(async () => {
      await result.current.submit()
    })

    expect(mockRunBestOfN).toHaveBeenCalledWith('前导空格', 1)
    expect(getValue()).toBe('')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
