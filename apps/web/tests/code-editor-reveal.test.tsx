// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D06 收尾:审查 finding「点击定位到行」的编辑器侧证明(2026-10-24 立)。
// CodeEditor 经 ref 暴露 revealAt(写入既有 pendingReveal,不新建第二套跳转通道):
// ① 目标 tab 内容还在异步加载(value='')时 reveal 只登记落点,内容就绪后由 value effect
//    消费一次(setPosition + revealPositionInCenter),消费后清空不重复揭示;
// ② 当前文件已就绪时 reveal 立即消费;路径反斜杠归一后仍能匹配;
// ③ 落点文件与当前文件不同 ⇒ 不揭示(等目标文件内容加载,不会错误滚动当前文件)。
import * as React from 'react'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fetchApiMock = vi.hoisted(() => vi.fn())
// CodeEditor import 期引用 LSP 四核心(本文件 monaco mock 无 languages,实际不会调用)
const lspMocks = vi.hoisted(() => ({
  getLspDefinition: vi.fn(),
  getLspReferences: vi.fn(),
  getLspDiagnostics: vi.fn(),
  getLspHover: vi.fn(),
}))

vi.mock('@ihui/api-client', () => ({
  fetchApi: fetchApiMock,
  ...lspMocks,
}))
// 切断 stores/debug → @/lib/api/debug → @/lib/api 的加载期传染链(同 code-editor-fim.test.tsx)
vi.mock('@/lib/api/debug', () => ({
  getScopes: vi.fn(),
  getVariablesByReference: vi.fn(),
}))
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

// getValue 可变:模拟 IDE 新开 tab 时 content='' → 异步加载完成后的第二轮 value
let editorValue = ''

const mockEditor = {
  getValue: () => editorValue,
  setValue: vi.fn(),
  executeEdits: vi.fn(),
  getSelection: () => ({ startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 }),
  getModel: () => ({ getLanguageId: () => 'typescript' }),
  updateOptions: vi.fn(),
  getOption: vi.fn(),
  focus: vi.fn(),
  layout: vi.fn(),
  onDidChangeCursorSelection: vi.fn(() => ({ dispose: vi.fn() })),
  onMouseDown: vi.fn(() => ({ dispose: vi.fn() })),
  onDidChangeModelContent: vi.fn(() => ({ dispose: vi.fn() })),
  deltaDecorations: vi.fn(() => [] as string[]),
  setModelMarkers: vi.fn(),
  setPosition: vi.fn(),
  revealPositionInCenter: vi.fn(),
}

// 无 editor/languages 的 monaco 命名空间:跳过 inline completion / LSP provider 注册,
// 本用例只关心 pendingReveal 揭示链路
const mockMonaco = {}

import { CodeEditor, type CodeEditorHandle } from '../src/components/editor/CodeEditor'

function renderEditor(
  ref: React.RefObject<CodeEditorHandle | null>,
  value: string,
  filePath: string,
) {
  return render(<CodeEditor ref={ref} value={value} language="typescript" filePath={filePath} />)
}

beforeEach(() => {
  editorValue = ''
  vi.clearAllMocks()
})

afterEach(() => cleanup())

describe('CodeEditor revealAt(审查 finding 定位到行)', () => {
  it('内容加载中只登记落点,内容就绪后消费一次并清空', async () => {
    const ref = React.createRef<CodeEditorHandle>()
    const { rerender } = renderEditor(ref, '', 'src/a.ts')
    await screen.findByTestId('monaco')

    act(() => ref.current!.revealAt('src/a.ts', 42, 7))
    // 内容为空 = tab 还在异步加载,不得凭空揭示
    expect(mockEditor.setPosition).not.toHaveBeenCalled()

    editorValue = 'line1\nline2'
    rerender(<CodeEditor ref={ref} value={editorValue} language="typescript" filePath="src/a.ts" />)
    await waitFor(() =>
      expect(mockEditor.setPosition).toHaveBeenCalledWith({ lineNumber: 42, column: 7 }),
    )
    expect(mockEditor.revealPositionInCenter).toHaveBeenCalledWith({ lineNumber: 42, column: 7 })

    // 已消费:后续 value 变化不再重复揭示
    editorValue = 'line1\nline2\nline3'
    rerender(<CodeEditor ref={ref} value={editorValue} language="typescript" filePath="src/a.ts" />)
    expect(mockEditor.setPosition).toHaveBeenCalledTimes(1)
  })

  it('当前文件已就绪即刻揭示,列缺省 1,反斜杠路径归一后仍匹配', async () => {
    const ref = React.createRef<CodeEditorHandle>()
    editorValue = 'a\nb\nc'
    renderEditor(ref, editorValue, 'src/a.ts')
    await screen.findByTestId('monaco')

    act(() => ref.current!.revealAt('src\\a.ts', 3))
    expect(mockEditor.setPosition).toHaveBeenCalledWith({ lineNumber: 3, column: 1 })
    expect(mockEditor.revealPositionInCenter).toHaveBeenCalledWith({ lineNumber: 3, column: 1 })
  })

  it('落点文件与当前文件不同 ⇒ 不揭示当前文件(等目标 tab 加载)', async () => {
    const ref = React.createRef<CodeEditorHandle>()
    editorValue = 'a\nb\nc'
    renderEditor(ref, editorValue, 'src/a.ts')
    await screen.findByTestId('monaco')

    act(() => ref.current!.revealAt('src/other.ts', 9, 1))
    expect(mockEditor.setPosition).not.toHaveBeenCalled()
    expect(mockEditor.revealPositionInCenter).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
