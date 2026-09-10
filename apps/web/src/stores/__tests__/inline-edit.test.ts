// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { describe, it, expect, beforeEach } from 'vitest'

import { useInlineEditStore, type InlineEditSelection } from '@/stores/inline-edit'

const selection: InlineEditSelection = {
  tabId: 'tab-1',
  filePath: '/a/b.ts',
  language: 'typescript',
  startLineNumber: 1,
  startColumn: 1,
  endLineNumber: 2,
  endColumn: 5,
  selectedText: 'const a = 1',
}

describe('inline-edit store 多轮迭代(1-6)', () => {
  beforeEach(() => {
    // zustand 单例 store:显式重置跨测试泄漏的 history/turns(close 不会清历史)
    useInlineEditStore.setState({ history: [], turns: [] })
    useInlineEditStore.getState().close()
  })

  it('open 重置 turns', () => {
    useInlineEditStore.getState().open(selection)
    useInlineEditStore.getState().commitTurn({ instruction: '加注释', patch: '// x' })
    useInlineEditStore.getState().open(selection)
    expect(useInlineEditStore.getState().turns).toEqual([])
  })

  it('commitTurn 追加轮次,保持顺序', () => {
    useInlineEditStore.getState().open(selection)
    useInlineEditStore.getState().commitTurn({ instruction: '加注释', patch: '// x' })
    useInlineEditStore.getState().commitTurn({ instruction: '改名', patch: 'const b = 1' })
    expect(useInlineEditStore.getState().turns).toEqual([
      { instruction: '加注释', patch: '// x' },
      { instruction: '改名', patch: 'const b = 1' },
    ])
  })

  it('acceptPatch 历史记录指令为全轮次指令链', () => {
    useInlineEditStore.getState().open(selection)
    useInlineEditStore.getState().commitTurn({ instruction: '加注释', patch: '// x' })
    useInlineEditStore.getState().commitTurn({ instruction: '改名', patch: 'const b = 1' })
    useInlineEditStore.getState().setGeneratedPatch('const b = 1')
    useInlineEditStore.getState().acceptPatch()

    const s = useInlineEditStore.getState()
    expect(s.history).toHaveLength(1)
    expect(s.history[0]!.instruction).toBe('加注释 → 改名')
    expect(s.history[0]!.accepted).toBe(true)
    expect(s.turns).toEqual([])
    expect(s.isOpen).toBe(false)
  })

  it('rejectPatch 同样记录指令链且关闭', () => {
    useInlineEditStore.getState().open(selection)
    useInlineEditStore.getState().commitTurn({ instruction: '加注释', patch: '// x' })
    useInlineEditStore.getState().setGeneratedPatch('// x')
    useInlineEditStore.getState().rejectPatch()

    const s = useInlineEditStore.getState()
    expect(s.history).toHaveLength(1)
    expect(s.history[0]!.instruction).toBe('加注释')
    expect(s.history[0]!.accepted).toBe(false)
    expect(s.turns).toEqual([])
  })

  it('无轮次时历史指令回退到 instruction 字段', () => {
    useInlineEditStore.getState().open(selection)
    useInlineEditStore.getState().setInstruction('直接改')
    useInlineEditStore.getState().setGeneratedPatch('const c = 1')
    useInlineEditStore.getState().acceptPatch()

    expect(useInlineEditStore.getState().history[0]!.instruction).toBe('直接改')
  })
})
