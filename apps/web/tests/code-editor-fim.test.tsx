// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, cleanup, waitFor } from '@testing-library/react'

const fetchApiMock = vi.hoisted(() => vi.fn())

vi.mock('@ihui/api-client', () => ({ fetchApi: fetchApiMock }))
vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }))
vi.mock('@monaco-editor/react', () => ({
  loader: { config: vi.fn() },
  default: ({ onMount }: { onMount?: (editor: unknown, monaco: unknown) => void }) => (
    <MockMonacoEditor onMount={onMount} />
  ),
}))

function MockMonacoEditor({ onMount }: { onMount?: (editor: unknown, monaco: unknown) => void }) {
  React.useEffect(() => {
    onMount?.(mockEditor, mockMonaco)
  }, [onMount])
  return <div data-testid="monaco" />
}

import { CodeEditor } from '../src/components/editor/CodeEditor'

type MonacoToken = {
  readonly isCancellationRequested: boolean
  onCancellationRequested(cb: () => void): { dispose(): void }
}

const mockEditor = {
  getValue: () => 'const total = 1 + 2',
  setValue: vi.fn(),
  executeEdits: vi.fn(),
  getSelection: () => ({ startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 }),
  getModel: () => ({ getLanguageId: () => 'typescript' }),
  updateOptions: vi.fn(),
  getOption: vi.fn(),
  focus: vi.fn(),
  layout: vi.fn(),
  onDidChangeCursorSelection: vi.fn(() => ({ dispose: vi.fn() })),
}

const providerRef: { current: { provideInlineCompletions: (model: unknown, position: unknown, context: unknown, token: MonacoToken) => Promise<{ items: unknown[] }>; freeInlineCompletions: () => void } | null } = { current: null }
const mockMonaco = {
  editor: {
    DefineTheme: vi.fn(),
    registerInlineCompletionsProvider: (_language: string, provider: NonNullable<typeof providerRef.current>) => {
      providerRef.current = provider
      return { dispose: vi.fn() }
    },
  },
}

const token = {
  isCancellationRequested: false,
  onCancellationRequested: vi.fn(() => ({ dispose: vi.fn() })),
}
const model = {
  getLanguageId: () => 'typescript',
  getLineContent: () => 'const total = ',
  getWordUntilPosition: () => ({ startColumn: 1, endColumn: 13 }),
  getOffsetAt: () => 13,
}

async function renderEditor() {
  render(<CodeEditor value="const total = 1 + 2" language="typescript" />)
  await waitFor(() => expect(providerRef.current).not.toBeNull())
}

beforeEach(() => {
  fetchApiMock.mockReset()
  providerRef.current = null
  delete window.__ihuiFimMetrics
})

afterEach(() => cleanup())

describe('CodeEditor AI inline completion', () => {
  it('requests FIM and returns a ghost completion', async () => {
    fetchApiMock.mockResolvedValueOnce({ success: true, data: { completion: '3' } })
    await renderEditor()
    const result = await providerRef.current!.provideInlineCompletions(model, { lineNumber: 1, column: 13 }, { triggerKind: 'Automatic' }, token)
    expect(fetchApiMock).toHaveBeenCalledTimes(1)
    expect(result.items[0]).toMatchObject({ insertText: '3' })
    expect(window.__ihuiFimMetrics?.suggestionCount).toBe(1)
  })

  it('uses cache for identical prefix and suffix', async () => {
    fetchApiMock.mockResolvedValue({ success: true, data: { completion: '3' } })
    await renderEditor()
    await providerRef.current!.provideInlineCompletions(model, { lineNumber: 1, column: 13 }, { triggerKind: 'Automatic' }, token)
    await providerRef.current!.provideInlineCompletions(model, { lineNumber: 1, column: 13 }, { triggerKind: 'Automatic' }, token)
    expect(fetchApiMock).toHaveBeenCalledTimes(1)
  })

  it('returns no items when FIM fails silently', async () => {
    fetchApiMock.mockResolvedValueOnce({ success: false, error: 'unauthorized' })
    await renderEditor()
    const result = await providerRef.current!.provideInlineCompletions(model, { lineNumber: 1, column: 13 }, { triggerKind: 'Automatic' }, token)
    expect(result.items).toEqual([])
    expect(window.__ihuiFimMetrics?.failureCount).toBe(1)
  })

  it('aborts a previous request when a new completion starts', async () => {
    let firstSignal: AbortSignal | undefined
    fetchApiMock.mockImplementationOnce(async (_url: string, options: RequestInit) => {
      firstSignal = options.signal
      return new Promise((resolve) => {
        options.signal?.addEventListener('abort', () => resolve({ success: false, error: '请求已取消' }), { once: true })
      })
    })
    fetchApiMock.mockResolvedValueOnce({ success: true, data: { completion: 'second' } })
    await renderEditor()
    const first = providerRef.current!.provideInlineCompletions(model, { lineNumber: 1, column: 13 }, { triggerKind: 'Automatic' }, token)
    const firstStarted = vi.waitFor(() => expect(fetchApiMock).toHaveBeenCalledTimes(1))
    await firstStarted
    const second = providerRef.current!.provideInlineCompletions(model, { lineNumber: 1, column: 13 }, { triggerKind: 'Automatic' }, token)
    await vi.waitFor(() => expect(firstSignal?.aborted).toBe(true))
    await second
    await first.catch(() => undefined)
  })
})
