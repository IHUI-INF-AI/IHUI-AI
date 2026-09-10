// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​‌​‍‍​‌​‌​‌‌‍‍​‌‌​‌​‌​‍‍​‌‌​​‌​‌​‍‍‌​‌​‌​‌​‍‍​‌‌​‌​‌​‍‍​‌​​​‌​‌‍‍‌‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​​​‌‌​‌‍‍​‌​‌​‌​‌‍‍‌‌​‌​​‌​‍‍​‌‌​‌‌​‌‌‌‍‍​‌‌​‌​​​‌​‌‌​‌‌​‌​‍‍​‌​​‌​​‌‍‍​‌​​‌‌​‌​‌‍‍​‌​​‌​‌‍‍​‌‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​​‌​‌‍‍​‌​​‌‌​‍‍​‌‌​‌​‌​‍‍​‌​​‌​‌‌​‌‍‍​‌​‌​‌​‍‍​‌​​​‌‌​‌‍‍​‌​‌​‌‌​‌​‍‍​‌​​​‌‌​‍‍​‌​‌​‌​‌​‍‍​‌​​‌​‌‌​‍‍​‌​‌​‌​‌​‍‍​‌​​‌​‌‌​‍‍​‌​​​‌‌​‌‌​‍‍​‌​​‌​‌​‍‍​‌​‌​‌‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‍‍​‌‌​‌​​​‌​‌​‍‍​‌​​‌​‌​‌‌​‍‍​‌​‌​‌​‌​‍‍​‌‌​‌​‌​‌‍‍​‌​‌​‌​‌​‍‍​‌​​​‌‍‍​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌‌​‌‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​​‌​‌​‌​‌‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌‌​‌​‌​‌‍‍​‌​​​‌‌​‌‍‍​‌‌​‌​‌​‌​‍‍​‌‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌‌​‌‍‍‌‌​‌​‌​‌‍‍‌‌​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‍‍‌‌​‌​‌​‌‌​‍‍​‌‌​‌​‌​‍‍‌‌​‌​‌​‌​‌‍‍​‌​‌​‌​‌​‍‍‌​‌​‌​‌​‍‍​‌​​‌​‌​‍‍​‌​​‌​‌​‍‍​‌​​‌​‌​‍‍​‌​​‌​‌​‍‍​‌‌​‌​‌​‍‍‌‌​‌​‌​‌​‍‍​‌‌​‌‌​‍‍​‌​​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌‌​‌​‌​‍‍​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌‌​‌​‌​‍‍​‌‌​‌​‌​‍‍​‌‌​‌​‌​‌​‍‍​‌​‌​‌‌​‍‍​‌​‌​‌‌​‌‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​​‌​‌​‌​‍‍​‌​​‌​‌‍‍​‌​​​‌‌​‌‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​​‌​‌‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‍‍​‌‌​‌​‌​‌‌​‍‍​‌‌​‌​‌​‌‍‍‌‌​‌​​​‌​‌‍‍​‌​‌​‌​‍‍​‌‌​‌​‌​‌‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‍‍​‌‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍‌‌​‌​‌​‌​‍‍​‌​‌​‌‌​‌‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌‌​‌​‌​‍‍​‌​‌​‌​‍‍​‌​​‌​‌‍‍​‌​​‌​‌​‍‍​‌​​​‌‌​‌‍‍‌‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌‌​‌‌‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​​‌​‌​‍‍​‌​​‌​‌‌​‌‍‍​‌​​​‌​‍‍​‌​​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‍‍‌​‌​‌​‌​‌‍‍‌‌​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​​‌​‌​‌‍‍​‌​​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​​‌​‌​‍‍​‌​‌​‌​‍‍​‌​‌​‌‌​‍‍​‌‌​‌​​​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍‌​‌​‌​‌‍‍​‌​​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍‌‌​‌​‌‌​‍‍​‌​‌​‌‌​‍‍‌‌​‌​‌​‌‍‍‌‌​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‍‍‌‌​‌​‌​‌‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‍‍​‌​‌​‌​‍‍​‌​‌​‌‌​‌‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​​‌​‌​‌​‍‍​‌​​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​​​‌​‌‍‍​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​​‌​‌‌​‍‍​‌​​​‌‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌‌​‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍‌‌​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌‌​⁠

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as React from 'react'
import { render, screen, act, cleanup } from '@testing-library/react'

// 捕获传给 mock MonacoEditor 的 props(onMount 待测试手动调用以触发真实 handleMount)
const monacoCaptured = vi.hoisted(() => ({
  propsList: [] as Array<Record<string, unknown>>,
}))

// mock @monaco-editor/react:loader.config 为 no-op;default 组件只记录 props
vi.mock('@monaco-editor/react', async () => {
  const ReactMod = await import('react')
  return {
    loader: { config: vi.fn() },
    default: (props: Record<string, unknown>) => {
      monacoCaptured.propsList.push(props)
      return ReactMod.createElement('div', { 'data-testid': 'monaco-mock' })
    },
  }
})

// mock next/dynamic:用 React.lazy + Suspense 同构替代(避免 next 动态机制在测试环境的不确定性)。
// loadMonacoEditor 返回裸组件而非 module,需归一化为 {default} 形态,否则 React.lazy 报
// "Expected the result of a dynamic import() call" 警告并偶发 unhandled error。
vi.mock('next/dynamic', async () => {
  const ReactMod = await import('react')
  return {
    default: (loader: () => Promise<unknown>) => {
      const Lazy = ReactMod.lazy(async () => {
        const m = await loader()
        const Comp = (
          m && typeof m === 'object' && 'default' in (m as object)
            ? (m as { default: React.ComponentType }).default
            : m
        ) as React.ComponentType
        return { default: Comp }
      })
      return (props: Record<string, unknown>) =>
        ReactMod.createElement(
          ReactMod.Suspense,
          { fallback: ReactMod.createElement('div', null, 'loading') },
          ReactMod.createElement(Lazy, props),
        )
    },
  }
})

vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'dark' }) }))
// CodeEditor 直接使用 fetchApi + LSP 四核心(0-4c);mock 之避免真实网络
const lspMocks = vi.hoisted(() => ({
  getLspDefinition: vi.fn(),
  getLspReferences: vi.fn(),
  getLspDiagnostics: vi.fn(),
  getLspHover: vi.fn(),
}))
vi.mock('@ihui/api-client', () => ({
  fetchApi: vi.fn(),
  ...lspMocks,
}))
// 切断 stores/debug → @/lib/api/debug → @/lib/api 传染链(@/lib/api 模块加载期调用 4 个 @ihui/api-client 导出)
vi.mock('@/lib/api/debug', () => ({
  getScopes: vi.fn(),
  getVariablesByReference: vi.fn(),
}))

import { CodeEditor } from '../CodeEditor'
import { useDebugStore } from '@/stores/debug'

/** 构造满足 MonacoEditorInstance 最小契约的 fake editor(vi.fn 记录调用) */
function createFakeEditor() {
  return {
    getValue: vi.fn(() => 'let x = 1'),
    setValue: vi.fn(),
    executeEdits: vi.fn(() => true),
    getSelection: vi.fn(() => ({
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: 1,
      endColumn: 1,
    })),
    getModel: vi.fn(() => ({
      getLanguageId: () => 'typescript',
      uri: { toString: () => 'file:///src/a.ts' },
    })),
    updateOptions: vi.fn(),
    getOption: vi.fn(),
    onDidChangeCursorSelection: vi.fn(() => ({ dispose: vi.fn() })),
    onMouseDown: vi.fn((_cb: (e: unknown) => void) => ({ dispose: vi.fn() })),
    deltaDecorations: vi.fn((_oldIds: string[], decos: unknown[]) =>
      decos.map((_, i) => `dec-${i}`),
    ),
    // LSP 四核心(0-4c)
    setModelMarkers: vi.fn(),
    onDidChangeModelContent: vi.fn((_cb: (e: unknown) => void) => ({ dispose: vi.fn() })),
    setPosition: vi.fn(),
    revealPositionInCenter: vi.fn(),
    focus: vi.fn(),
    layout: vi.fn(),
  }
}

const fakeMonaco = {
  editor: {
    registerInlineCompletionsProvider: vi.fn(() => ({ dispose: vi.fn() })),
  },
  // LSP 四核心注册入口(0-4c)
  languages: {
    registerHoverProvider: vi.fn(
      (
        _selector: string,
        provider: { provideHover: (model: unknown, position: unknown, token: unknown) => unknown },
      ) => {
        hoverProviderRef.current = provider
        return { dispose: vi.fn() }
      },
    ),
    registerDefinitionProvider: vi.fn(
      (
        _selector: string,
        provider: {
          provideDefinition: (model: unknown, position: unknown, token: unknown) => unknown
        },
      ) => {
        definitionProviderRef.current = provider
        return { dispose: vi.fn() }
      },
    ),
    registerReferenceProvider: vi.fn(
      (
        _selector: string,
        provider: {
          provideReferences: (
            model: unknown,
            position: unknown,
            context: unknown,
            token: unknown,
          ) => unknown
        },
      ) => {
        referenceProviderRef.current = provider
        return { dispose: vi.fn() }
      },
    ),
  },
  MarkerSeverity: { Hint: 1, Info: 2, Warning: 4, Error: 8 },
}

// provider 捕获(测试手动调用以驱动 LSP provider 逻辑)
const hoverProviderRef: {
  current: { provideHover: (model: unknown, position: unknown, token: unknown) => unknown } | null
} = { current: null }
const definitionProviderRef: {
  current: {
    provideDefinition: (model: unknown, position: unknown, token: unknown) => unknown
  } | null
} = { current: null }
const referenceProviderRef: {
  current: {
    provideReferences: (
      model: unknown,
      position: unknown,
      context: unknown,
      token: unknown,
    ) => unknown
  } | null
} = { current: null }

/** 渲染 CodeEditor 并手动触发 Monaco onMount(挂载 fake editor),返回编辑器实例与渲染工具 */
async function mountEditor(props: Partial<React.ComponentProps<typeof CodeEditor>> = {}) {
  const utils = render(<CodeEditor value="let x = 1" language="typescript" {...props} />)
  await screen.findByTestId('monaco-mock')
  const lastProps = monacoCaptured.propsList[monacoCaptured.propsList.length - 1]!
  const onMount = lastProps.onMount as (editor: unknown, monaco: unknown) => void
  const editor = createFakeEditor()
  act(() => {
    onMount(editor, fakeMonaco)
  })
  return { editor, ...utils }
}

/** 取 fake editor.onMouseDown 注册的回调并模拟一次点击 */
function clickGutter(
  editor: ReturnType<typeof createFakeEditor>,
  opts: { type: number; lineNumber?: number },
) {
  const cb = editor.onMouseDown.mock.calls[0]?.[0] as
    | ((e: {
        target: { type: number; position: { lineNumber: number; column: number } | null }
      }) => void)
    | undefined
  if (!cb) throw new Error('onMouseDown 未注册')
  act(() => {
    cb({
      target: {
        type: opts.type,
        position: opts.lineNumber === undefined ? null : { lineNumber: opts.lineNumber, column: 1 },
      },
    })
  })
}

describe('CodeEditor 断点 gutter(1-7c:glyphMargin + deltaDecorations + store 同步)', () => {
  beforeEach(() => {
    localStorage.clear()
    monacoCaptured.propsList.length = 0
    useDebugStore.setState({ breakpoints: [] })
  })
  afterEach(() => cleanup())
  it('传入 filePath 时启用 glyphMargin 选项,未传时不启用', async () => {
    await mountEditor({ filePath: 'src/a.ts' })
    const withPath = monacoCaptured.propsList[monacoCaptured.propsList.length - 1]!
    expect((withPath.options as Record<string, unknown>).glyphMargin).toBe(true)

    cleanup()
    monacoCaptured.propsList.length = 0
    await mountEditor()
    const withoutPath = monacoCaptured.propsList[monacoCaptured.propsList.length - 1]!
    expect((withoutPath.options as Record<string, unknown>).glyphMargin).toBe(false)
  })

  it('点击 glyph margin 槽位(t.type===2)写入断点并同步红点 decoration', async () => {
    const { editor } = await mountEditor({ filePath: 'src/a.ts' })
    // 挂载时同步一次(空断点)
    expect(editor.deltaDecorations).toHaveBeenCalledTimes(1)
    expect(editor.deltaDecorations).toHaveBeenLastCalledWith([], [])

    clickGutter(editor, { type: 2, lineNumber: 5 })
    // store 写入
    expect(useDebugStore.getState().breakpoints).toEqual([
      { id: 'src/a.ts:5', file: 'src/a.ts', line: 5, enabled: true },
    ])
    // store 订阅触发 decoration 增量同步
    expect(editor.deltaDecorations).toHaveBeenCalledTimes(2)
    expect(editor.deltaDecorations).toHaveBeenLastCalledWith(
      [],
      [
        {
          range: { startLineNumber: 5, startColumn: 1, endLineNumber: 5, endColumn: 1 },
          options: { isWholeLine: true, glyphMarginClassName: 'ihui-breakpoint-glyph' },
        },
      ],
    )
  })

  it('再次点击同槽位移除断点(decoration 清空)', async () => {
    const { editor } = await mountEditor({ filePath: 'src/a.ts' })
    clickGutter(editor, { type: 2, lineNumber: 5 })
    clickGutter(editor, { type: 2, lineNumber: 5 })
    expect(useDebugStore.getState().breakpoints).toEqual([])
    // 上次同步返回 ['dec-0'],本次以它为旧 ids 全量移除
    expect(editor.deltaDecorations).toHaveBeenLastCalledWith(['dec-0'], [])
  })

  it('点击编辑区正文(t.type!==2)不产生断点', async () => {
    const { editor } = await mountEditor({ filePath: 'src/a.ts' })
    clickGutter(editor, { type: 1, lineNumber: 5 })
    expect(useDebugStore.getState().breakpoints).toEqual([])
    expect(editor.deltaDecorations).toHaveBeenCalledTimes(1) // 仅挂载时那次
  })

  it('未传 filePath 时点击 gutter 不产生断点', async () => {
    const { editor } = await mountEditor()
    clickGutter(editor, { type: 2, lineNumber: 5 })
    expect(useDebugStore.getState().breakpoints).toEqual([])
    // syncBreakpointDecorations 直接 return,不调用 deltaDecorations
    expect(editor.deltaDecorations).not.toHaveBeenCalled()
  })

  it('面板侧(store)断点变化实时同步红点;禁用断点不渲染', async () => {
    const { editor } = await mountEditor({ filePath: 'src/a.ts' })
    act(() => {
      useDebugStore.setState({
        breakpoints: [
          { id: 'src/a.ts:7', file: 'src/a.ts', line: 7, enabled: true },
          { id: 'src/a.ts:9', file: 'src/a.ts', line: 9, enabled: false },
        ],
      })
    })
    expect(editor.deltaDecorations).toHaveBeenLastCalledWith(
      [],
      [
        {
          range: { startLineNumber: 7, startColumn: 1, endLineNumber: 7, endColumn: 1 },
          options: { isWholeLine: true, glyphMarginClassName: 'ihui-breakpoint-glyph' },
        },
      ],
    )
  })

  it('卸载后取消 store 订阅(store 变化不再触发 deltaDecorations)', async () => {
    const { editor, unmount } = await mountEditor({ filePath: 'src/a.ts' })
    const baseline = editor.deltaDecorations.mock.calls.length
    unmount()
    act(() => {
      useDebugStore.setState({
        breakpoints: [{ id: 'src/a.ts:7', file: 'src/a.ts', line: 7, enabled: true }],
      })
    })
    expect(editor.deltaDecorations.mock.calls.length).toBe(baseline)
  })
})

describe('CodeEditor LSP 四核心(0-4c:hover/definition/references/diagnostics + 失败静默降级)', () => {
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    localStorage.clear()
    monacoCaptured.propsList.length = 0
    useDebugStore.setState({ breakpoints: [] })
    hoverProviderRef.current = null
    definitionProviderRef.current = null
    referenceProviderRef.current = null
    lspMocks.getLspHover.mockReset()
    lspMocks.getLspDefinition.mockReset()
    lspMocks.getLspReferences.mockReset()
    lspMocks.getLspDiagnostics.mockReset()
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
  })
  afterEach(() => {
    consoleInfoSpy.mockRestore()
    cleanup()
  })

  const MODEL = { uri: { toString: () => 'file:///src/a.ts' } }
  const TOKEN = {
    isCancellationRequested: false,
    onCancellationRequested: vi.fn(() => ({ dispose: vi.fn() })),
  }

  it('传入 filePath+workspacePath 时注册 hover/definition/references 三 provider + 内容订阅', async () => {
    lspMocks.getLspDiagnostics.mockResolvedValue({
      success: true,
      data: { count: 0, errors: 0, warnings: 0, diagnostics: [] },
    })
    const { editor } = await mountEditor({ filePath: 'src/a.ts', workspacePath: 'G:/ws' })
    expect(fakeMonaco.languages.registerHoverProvider).toHaveBeenCalledWith('*', expect.anything())
    expect(fakeMonaco.languages.registerDefinitionProvider).toHaveBeenCalledWith(
      '*',
      expect.anything(),
    )
    expect(fakeMonaco.languages.registerReferenceProvider).toHaveBeenCalledWith(
      '*',
      expect.anything(),
    )
    expect(editor.onDidChangeModelContent).toHaveBeenCalled()
    expect(hoverProviderRef.current).not.toBeNull()
    expect(definitionProviderRef.current).not.toBeNull()
    expect(referenceProviderRef.current).not.toBeNull()
  })

  it('未传 workspacePath 时 LSP provider 仍注册但位置请求短路(不调后端)', async () => {
    lspMocks.getLspDiagnostics.mockResolvedValue({
      success: true,
      data: { count: 0, errors: 0, warnings: 0, diagnostics: [] },
    })
    await mountEditor({ filePath: 'src/a.ts' })
    // handleMount 走 languages 分支(注册一次性 provider);无 workspacePath 时不请 diagnostics
    lspMocks.getLspHover.mockResolvedValue({ success: true, data: { hover: 'x' } })
    const res = (await hoverProviderRef.current!.provideHover(
      MODEL,
      { lineNumber: 2, column: 5 },
      TOKEN,
    )) as null
    expect(lspMocks.getLspHover).not.toHaveBeenCalled()
    expect(res).toBeNull()
  })

  it('hover:成功返回 markdown contents', async () => {
    lspMocks.getLspDiagnostics.mockResolvedValue({
      success: true,
      data: { count: 0, errors: 0, warnings: 0, diagnostics: [] },
    })
    await mountEditor({ filePath: 'src/a.ts', workspacePath: 'G:/ws' })
    lspMocks.getLspHover.mockResolvedValue({
      success: true,
      data: { hover: '```typescript\nconst x: number\n```' },
    })
    const res = (await hoverProviderRef.current!.provideHover(
      MODEL,
      { lineNumber: 2, column: 5 },
      TOKEN,
    )) as {
      contents: Array<{ value: string }>
    }
    expect(lspMocks.getLspHover).toHaveBeenCalledWith({
      workspacePath: 'G:/ws',
      file: 'src/a.ts',
      line: 2,
      column: 5,
    })
    // [0]! 非空断言:noUncheckedIndexedAccess 下索引访问为 T|undefined;
    // 若 contents 为空此处抛 TypeError,测试响亮失败(与 TagsView.test.tsx 惯例一致)
    expect(res.contents[0]!.value).toContain('const x: number')
  })

  it('definition:同文件落点返回 Monaco 跳转数组', async () => {
    lspMocks.getLspDiagnostics.mockResolvedValue({
      success: true,
      data: { count: 0, errors: 0, warnings: 0, diagnostics: [] },
    })
    await mountEditor({ filePath: 'src/a.ts', workspacePath: 'G:/ws' })
    lspMocks.getLspDefinition.mockResolvedValue({
      success: true,
      data: {
        count: 1,
        locations: [
          { file: 'src/a.ts', line: 10, column: 3, endLine: 10, endColumn: 8, text: 'foo' },
        ],
      },
    })
    const res = (await definitionProviderRef.current!.provideDefinition(
      MODEL,
      { lineNumber: 2, column: 5 },
      TOKEN,
    )) as Array<{
      uri: { toString(): string }
      range: { startLineNumber: number; startColumn: number }
    }>
    expect(res).toHaveLength(1)
    // 上行 toHaveLength(1) 已守卫,[0]! 断言有依据(noUncheckedIndexedAccess 惯例,同上)
    expect(res[0]!.range).toMatchObject({
      startLineNumber: 10,
      startColumn: 3,
      endLineNumber: 10,
      endColumn: 8,
    })
    expect(res[0]!.uri.toString()).toBe('file:///src/a.ts')
  })

  it('definition:跨文件落点回调 onOpenLocation 且返回空数组', async () => {
    lspMocks.getLspDiagnostics.mockResolvedValue({
      success: true,
      data: { count: 0, errors: 0, warnings: 0, diagnostics: [] },
    })
    const onOpenLocation = vi.fn()
    await mountEditor({ filePath: 'src/a.ts', workspacePath: 'G:/ws', onOpenLocation })
    lspMocks.getLspDefinition.mockResolvedValue({
      success: true,
      data: { count: 1, locations: [{ file: 'src/b.ts', line: 20, column: 4 }] },
    })
    const res = await definitionProviderRef.current!.provideDefinition(
      MODEL,
      { lineNumber: 2, column: 5 },
      TOKEN,
    )
    expect(res).toEqual([])
    expect(onOpenLocation).toHaveBeenCalledWith({ file: 'src/b.ts', line: 20, column: 4 })
  })

  it('references:仅返回同文件引用(跨文件过滤)', async () => {
    lspMocks.getLspDiagnostics.mockResolvedValue({
      success: true,
      data: { count: 0, errors: 0, warnings: 0, diagnostics: [] },
    })
    await mountEditor({ filePath: 'src/a.ts', workspacePath: 'G:/ws' })
    lspMocks.getLspReferences.mockResolvedValue({
      success: true,
      data: {
        count: 2,
        includeDeclaration: true,
        locations: [
          { file: 'src/a.ts', line: 30, column: 1 },
          { file: 'src/b.ts', line: 9, column: 2 },
        ],
      },
    })
    const res = (await referenceProviderRef.current!.provideReferences(
      MODEL,
      { lineNumber: 2, column: 5 },
      { includeDeclaration: true },
      TOKEN,
    )) as unknown[]
    expect(lspMocks.getLspReferences).toHaveBeenCalledWith({
      workspacePath: 'G:/ws',
      file: 'src/a.ts',
      line: 2,
      column: 5,
      includeDeclaration: true,
    })
    expect(res).toHaveLength(1)
  })

  it('LSP 不可用(success:false + lsp-unavailable)静默降级:返回 null + console.info 一次性提示 codegraph 兜底', async () => {
    lspMocks.getLspDiagnostics.mockResolvedValue({
      success: true,
      data: { count: 0, errors: 0, warnings: 0, diagnostics: [] },
    })
    await mountEditor({ filePath: 'src/a.ts', workspacePath: 'G:/ws' })
    lspMocks.getLspHover.mockResolvedValue({
      success: false,
      error: 'LSP 不可用: 未安装',
      errorCode: 'lsp-unavailable',
    })
    const res = await hoverProviderRef.current!.provideHover(
      MODEL,
      { lineNumber: 2, column: 5 },
      TOKEN,
    )
    expect(res).toBeNull()
    // 同一挂载周期第二次失败不再刷屏
    await hoverProviderRef.current!.provideHover(MODEL, { lineNumber: 3, column: 5 }, TOKEN)
    expect(consoleInfoSpy).toHaveBeenCalledTimes(1)
    expect(consoleInfoSpy.mock.calls[0][0]).toContain('codegraph')
  })

  it('diagnostics:请求成功渲染 setModelMarkers(severity 映射 Error→8)', async () => {
    lspMocks.getLspDiagnostics.mockResolvedValue({
      success: true,
      data: {
        count: 2,
        errors: 1,
        warnings: 1,
        diagnostics: [
          {
            line: 3,
            column: 5,
            endLine: 3,
            endColumn: 9,
            severity: 'Error',
            message: 'Type not assignable',
            source: 'ts',
          },
          { line: 8, column: 1, severity: 'Warning', message: 'Unused variable' },
        ],
      },
    })
    const { editor } = await mountEditor({ filePath: 'src/a.ts', workspacePath: 'G:/ws' })
    await vi.waitFor(() => expect(editor.setModelMarkers).toHaveBeenCalled())
    expect(lspMocks.getLspDiagnostics).toHaveBeenCalledWith({
      workspacePath: 'G:/ws',
      file: 'src/a.ts',
    })
    const [model, owner, markers] = editor.setModelMarkers.mock.calls[0] as [
      unknown,
      string,
      Array<{ severity: number; message: string; startLineNumber: number }>,
    ]
    expect(owner).toBe('ihui-lsp')
    expect(markers).toHaveLength(2)
    expect(markers[0]).toMatchObject({
      severity: 8,
      message: 'Type not assignable',
      startLineNumber: 3,
      startColumn: 5,
    })
    expect(markers[1]).toMatchObject({ severity: 4, startLineNumber: 8 })
    expect(model).toBeTruthy()
  })

  it('diagnostics:失败静默降级不渲染 markers', async () => {
    lspMocks.getLspDiagnostics.mockResolvedValue({
      success: false,
      error: 'LSP 不可用',
      errorCode: 'lsp-unavailable',
    })
    const { editor } = await mountEditor({ filePath: 'src/a.ts', workspacePath: 'G:/ws' })
    await vi.waitFor(() => expect(lspMocks.getLspDiagnostics).toHaveBeenCalled())
    expect(editor.setModelMarkers).not.toHaveBeenCalled()
  })
})
