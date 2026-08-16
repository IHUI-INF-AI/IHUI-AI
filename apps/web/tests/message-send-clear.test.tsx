// @vitest-environment jsdom
/**
 * useMessageSend 发送即清空回归测试(2026-08-15)
 *
 * 直接测试 hook 行为,避免 MessageInput 庞大的子组件树 mock。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { renderHook, act } from '@testing-library/react'

// ─── Mocks ────────────────────────────────────────────────────────
const { mockT } = vi.hoisted(() => {
  const map: Record<string, string> = {
    send: '发送',
    stop: '停止',
    cancel: '取消',
  }
  const mockT = (key: string) => map[key] ?? key
  return { mockT }
})

vi.mock('next-intl', () => ({
  useTranslations: () => mockT,
}))

// chat store mock
const chatStoreState = {
  messages: [],
  subAgentActivities: [],
  conversationId: 'conv-1',
  draftInput: null,
  selectedTools: [],
}
vi.mock('@/stores/chat', () => ({
  useChatStore: (selector: (s: typeof chatStoreState) => unknown) =>
    selector ? selector(chatStoreState) : chatStoreState,
}))

// ai-panel store mock
const aiPanelStoreState = {
  activeWorkspace: null,
}
vi.mock('@/stores/ai-panel', () => ({
  useAiPanelStore: (selector: (s: typeof aiPanelStoreState) => unknown) =>
    selector ? selector(aiPanelStoreState) : aiPanelStoreState,
}))

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
vi.mock('@/components/ai/voice-input', () => ({
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

describe('useMessageSend — 发送即清空回归', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 重置 localStorage
    if (typeof window !== 'undefined') {
      window.localStorage.clear()
    }
  })

  it('submit 后应立即清空 value,不等 onSend 返回', async () => {
    const onSend = vi.fn().mockResolvedValue(true)
    const setValueMock = vi.fn((v: React.SetStateAction<string>) => v)
    const inputCoreRef: React.RefObject<{ resize: () => void; focus: () => void; setSelectionRange: () => void }> = {
      current: { resize: () => {}, focus: () => {}, setSelectionRange: () => {} },
    }

    let currentValue = 'hello'
    const { result } = renderHook(() =>
      useMessageSend({
        value: currentValue,
        setValue: (v: React.SetStateAction<string>) => {
          currentValue = typeof v === 'function' ? v(currentValue) : v
          setValueMock(currentValue)
        },
        isStreaming: false,
        isHighRisk: false,
        references: [],
        resetReferences: () => {},
        addFileReference: () => {},
        onSend,
        inputCoreRef,
        draftKey: 'chat:draft',
      }),
    )

    // 执行 submit
    await act(async () => {
      result.current.submit()
    })

    // value 应立即清空,不等 onSend resolve
    expect(currentValue).toBe('')
    expect(onSend).toHaveBeenCalledWith('hello')
  })
})
