// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D117 /diff 会话级改动聚合(collectSessionFileChanges)行为测试 —— 纯函数无网络。
import { describe, expect, it } from 'vitest'
import { collectSessionFileChanges } from '../session-file-changes'

const msgWith = (
  diffInfo: {
    file_path?: string
    old_content?: string
    new_content?: string
    is_new_file?: boolean
    applyStatus?: 'pending' | 'applied' | 'rejected'
  } | null,
) => ({
  toolCalls: [{ toolName: 'edit_file', status: 'success', diffInfo }],
})

describe('collectSessionFileChanges — 会话文件改动聚合', () => {
  it('空消息流 / 无 diffInfo 的工具调用 → 空数组(纯问答会话零噪音)', () => {
    expect(collectSessionFileChanges([])).toEqual([])
    expect(
      collectSessionFileChanges([{ toolCalls: [{ toolName: 'read_file', status: 'success' }] }]),
    ).toEqual([])
    expect(collectSessionFileChanges([{ toolCalls: undefined }])).toEqual([])
  })

  it('单文件单次编辑:路径/新旧内容/工具名如实透传', () => {
    const changes = collectSessionFileChanges([
      msgWith({
        file_path: 'src/a.ts',
        old_content: 'const a = 1',
        new_content: 'const a = 2',
        is_new_file: false,
      }),
    ])
    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({
      filePath: 'src/a.ts',
      isNewFile: false,
      toolName: 'edit_file',
      changedCount: 1,
      oldContent: 'const a = 1',
      newContent: 'const a = 2',
    })
  })

  it('同文件多次编辑合并为一条:changedCount 计次,diff 取最后一次', () => {
    const changes = collectSessionFileChanges([
      msgWith({ file_path: 'src/a.ts', old_content: 'v1', new_content: 'v2' }),
      msgWith({ file_path: 'src/a.ts', old_content: 'v2', new_content: 'v3' }),
    ])
    expect(changes).toHaveLength(1)
    expect(changes[0]!.changedCount).toBe(2)
    expect(changes[0]!.oldContent).toBe('v2')
    expect(changes[0]!.newContent).toBe('v3')
  })

  it('多文件保持首次出现顺序;is_new_file / applyStatus 透传', () => {
    const changes = collectSessionFileChanges([
      msgWith({
        file_path: 'b.ts',
        old_content: '',
        new_content: 'b',
        is_new_file: true,
        applyStatus: 'applied',
      }),
      msgWith({ file_path: 'a.ts', old_content: 'x', new_content: 'y' }),
      msgWith({ file_path: 'b.ts', old_content: 'b', new_content: 'b2' }),
    ])
    expect(changes.map((c) => c.filePath)).toEqual(['b.ts', 'a.ts'])
    expect(changes[0]!.isNewFile).toBe(true)
    expect(changes[0]!.applyStatus).toBe('applied')
    expect(changes[0]!.changedCount).toBe(2)
    expect(changes[1]!.applyStatus).toBeUndefined()
  })

  it('diffInfo 缺 file_path 或为 null 的调用不计入(形状判据的负例)', () => {
    const changes = collectSessionFileChanges([
      msgWith(null),
      msgWith({ old_content: 'x', new_content: 'y' }),
      msgWith({ file_path: '', old_content: 'x', new_content: 'y' }),
    ])
    expect(changes).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
