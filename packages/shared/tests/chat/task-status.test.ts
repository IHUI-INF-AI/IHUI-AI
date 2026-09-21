// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 任务进度状态条派生层测试(2026-09-21 立)。
 *
 * 这条状态条是各端聊天输入框上方的"唯一实时信息位",一旦推导错误,用户看到的就是
 * 错误的进度(步骤数虚高、行数算错、空闲时留一条空壳占位)。因此空态与边界与正向
 * 用例同等重要 —— 特别是"什么时候必须返回 null"。
 */
import { describe, it, expect } from 'vitest'
import type { PlanStep } from '@ihui/types/ai'
import type { ToolCall } from '@ihui/types/chat'
import {
  computeFileChanges,
  computeFileChangesFromDiff,
  deriveTaskStatusBar,
  fileBasename,
  pickFilePath,
  summarizeFileChanges,
} from '../../src/chat/task-status'

function step(over: Partial<PlanStep> & { step: string }): PlanStep {
  return { id: over.id ?? over.step, status: 'pending', ...over }
}

function toolCall(over: Partial<ToolCall> & { toolName: string }): ToolCall {
  return { id: over.id ?? over.toolName, status: 'success', args: {}, ...over }
}

describe('fileBasename / pickFilePath', () => {
  it('统一 Windows 反斜杠后取末段', () => {
    expect(fileBasename('D:\\IHUI-AI\\apps\\web\\src\\a.ts')).toBe('a.ts')
    expect(fileBasename('apps/web/src/a.ts')).toBe('a.ts')
    expect(fileBasename('a.ts')).toBe('a.ts')
  })

  it('多键名兼容,空白值不算命中', () => {
    expect(pickFilePath({ file_path: 'x/y.ts' })).toBe('x/y.ts')
    expect(pickFilePath({ filename: ' z.ts ' })).toBe('z.ts')
    expect(pickFilePath({ path: '   ' })).toBe('')
    expect(pickFilePath(undefined)).toBe('')
  })
})

describe('computeFileChanges - 从工具调用折叠', () => {
  it('只统计写类工具的成功调用', () => {
    const out = computeFileChanges([
      toolCall({ toolName: 'read_file', args: { path: 'a.ts' } }),
      toolCall({ toolName: 'write_file', args: { path: 'b.ts', content: 'l1\nl2\nl3' } }),
      toolCall({ toolName: 'edit_file', args: { path: 'c.ts' }, status: 'error', error: 'boom' }),
    ])
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ path: 'b.ts', name: 'b.ts', added: 3 })
  })

  it('同一路径多次写入只保留首次', () => {
    const out = computeFileChanges([
      toolCall({ toolName: 'write_file', args: { path: 'd.ts', content: 'x\ny' } }),
      toolCall({ toolName: 'edit_file', args: { path: 'd.ts', content: 'x' } }),
    ])
    expect(out).toHaveLength(1)
    expect(out[0]?.added).toBe(2)
  })

  it('无内容时从 result 的 unified diff 取增删行,并排除 +++/--- 文件头', () => {
    const diff = [
      '--- a/e.ts',
      '+++ b/e.ts',
      '@@ -1,2 +1,3 @@',
      ' ctx',
      '-gone',
      '+one',
      '+two',
    ].join('\n')
    const out = computeFileChanges([
      toolCall({ toolName: 'apply_diff', args: { path: 'e.ts' }, result: diff }),
    ])
    expect(out[0]).toMatchObject({ added: 2, removed: 1 })
  })

  it('既无内容也无 diff → 行数记 -1(未知),不得当成 0', () => {
    const out = computeFileChanges([toolCall({ toolName: 'patch', args: { path: 'f.ts' } })])
    expect(out[0]).toMatchObject({ added: -1, removed: -1 })
  })

  it('undefined 入参返回空数组', () => {
    expect(computeFileChanges(undefined)).toEqual([])
  })
})

describe('computeFileChangesFromDiff / summarizeFileChanges', () => {
  it('按新旧内容行数统计并去重', () => {
    const out = computeFileChangesFromDiff([
      { path: 'g.ts', oldContent: 'a\nb', newContent: 'a\nb\nc' },
      { path: 'g.ts', oldContent: 'a', newContent: 'a' },
    ])
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ added: 3, removed: 2 })
  })

  it('全部行数未知时 linesKnown=false', () => {
    const summary = summarizeFileChanges([{ path: 'h', name: 'h', added: -1, removed: -1 }])
    expect(summary).toEqual({ files: 1, added: 0, removed: 0, linesKnown: false })
  })

  it('部分已知时只累加已知项', () => {
    const summary = summarizeFileChanges([
      { path: 'i', name: 'i', added: 5, removed: 2 },
      { path: 'j', name: 'j', added: -1, removed: -1 },
    ])
    expect(summary).toEqual({ files: 2, added: 5, removed: 2, linesKnown: true })
  })
})

describe('deriveTaskStatusBar - 空态门槛', () => {
  it('无步骤、无变更、非流式 → null(输入框上方零占位)', () => {
    expect(deriveTaskStatusBar({ planSteps: [], isStreaming: false })).toBeNull()
  })

  it('空闲但已有历史变更 → 仍显示(结果需要被看到)', () => {
    const view = deriveTaskStatusBar({
      planSteps: [],
      isStreaming: false,
      fileChanges: [{ path: 'k.ts', name: 'k.ts', added: 1, removed: 0 }],
    })
    expect(view).not.toBeNull()
    expect(view?.changedFiles).toBe(1)
    expect(view?.active).toBe(false)
  })

  it('流式中但还没有任何步骤 → 显示活动态空壳', () => {
    const view = deriveTaskStatusBar({ planSteps: [], isStreaming: true })
    expect(view?.kind).toBe('running')
    expect(view?.stepTotal).toBe(0)
    expect(view?.hasDetail).toBe(false)
  })
})

describe('deriveTaskStatusBar - 进度推导', () => {
  const steps: PlanStep[] = [
    step({ step: '读代码', status: 'completed' }),
    step({ step: '改代码', status: 'in_progress' }),
    step({ step: '跑测试', status: 'pending' }),
  ]

  it('stepCurrent 取 in_progress 序号,percent 按完成数', () => {
    const view = deriveTaskStatusBar({ planSteps: steps, isStreaming: true })
    expect(view?.stepCurrent).toBe(2)
    expect(view?.stepTotal).toBe(3)
    expect(view?.percent).toBe(33)
    expect(view?.headline).toBe('改代码')
  })

  it('currentTaskLabel 优先于步骤标题作为主标题', () => {
    const view = deriveTaskStatusBar({
      planSteps: steps,
      isStreaming: true,
      currentTaskLabel: '调用 web_search',
    })
    expect(view?.headline).toBe('调用 web_search')
  })

  it('全部完成 → completed,stepCurrent 等于总数', () => {
    const done = steps.map((s) => ({ ...s, status: 'completed' as const }))
    const view = deriveTaskStatusBar({ planSteps: done, isStreaming: false })
    expect(view?.kind).toBe('completed')
    expect(view?.stepCurrent).toBe(3)
    expect(view?.percent).toBe(100)
  })

  it('error 标记视同失败态(后端旧事件兼容)', () => {
    const withError = [step({ step: 'a', status: 'completed' }), step({ step: 'b', error: true })]
    const view = deriveTaskStatusBar({ planSteps: withError, isStreaming: false })
    expect(view?.kind).toBe('failed')
  })

  it('overviewStatus 优先于本地推断', () => {
    const view = deriveTaskStatusBar({
      planSteps: steps,
      isStreaming: false,
      overviewStatus: 'interrupted',
    })
    expect(view?.kind).toBe('interrupted')
  })

  it('新一轮流式开始时,不被上一轮遗留的 completed 终态压住', () => {
    const view = deriveTaskStatusBar({
      planSteps: steps,
      isStreaming: true,
      overviewStatus: 'completed',
    })
    expect(view?.kind).toBe('running')
  })

  it('steps 视图项带 1 起序号与稳定 id', () => {
    const view = deriveTaskStatusBar({ planSteps: steps, isStreaming: true })
    expect(view?.steps[1]).toMatchObject({ index: 2, title: '改代码', status: 'in_progress' })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
