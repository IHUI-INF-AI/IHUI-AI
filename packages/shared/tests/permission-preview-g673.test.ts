// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-673 权限预览(键别名族 + input/rawInput 双承载层 + 显示预算)专测。
 *
 * 票面验收两条都在这里钉死,外加防回归的三组:
 *   成对①(正例)只写 `file_path` 的 Edit ⇒ 预览含该路径 —— 别名族漏了 `file_path`
 *          这一型就是立项成因,必须逐字命中。
 *   成对②(反例)完全无别名的入参 ⇒ hasContent=false(渲染层据此显示"无可预览内容",
 *          而不是空白标题)。
 *   成对③(核心)同一份参数经 `input` / `rawInput` / 裸 args / JSON 串四种承载形态进来,
 *          预览结论**必须逐字等值** —— "双承载层同判"只有这一种有效证明。
 *   词元匹配:归一后精确相等,`hashtags`/`has`/`pathExists`/`pathCount` 都不得误命中
 *          (子串匹配会满天假阳,反例组整体判 false 才算有牙)。
 *   预算:超预算条目从返回值截断,但 hidden*Count 必须报出被隐去的数量(静默截断=撒谎)。
 */
import { describe, expect, it } from 'vitest'

import {
  buildToolPermissionPreview,
  normalizePermissionPreviewKey,
  PERMISSION_PREVIEW_CARRIER_KEYS,
  PERMISSION_PREVIEW_DEFAULT_MAX_ITEMS,
  PERMISSION_PREVIEW_KEY_ALIASES,
  resolvePermissionPreviewArgs,
  type ToolPermissionPreview,
} from '../src/permission/preview'

describe('G-673 成对③ 双承载层同判(票面验收核心)', () => {
  const args = { file_path: 'src/a.ts', old_string: 'x', new_string: 'y' }

  it('input / rawInput / 裸 args / JSON 串四形态结论逐字等值', () => {
    const viaInput = buildToolPermissionPreview({ input: args })
    const viaRawInput = buildToolPermissionPreview({ rawInput: args })
    const viaBare = buildToolPermissionPreview(args)
    const viaJsonString = buildToolPermissionPreview({ rawInput: JSON.stringify(args) })
    // 承载层键清单必须是票面点名的这两个,顺序即优先级(供反向核对)
    expect(PERMISSION_PREVIEW_CARRIER_KEYS).toEqual(['input', 'rawInput'])
    expect(viaInput).toEqual(viaRawInput)
    expect(viaInput).toEqual(viaBare)
    expect(viaInput).toEqual(viaJsonString)
  })

  it('两承载层同时在场时取 input(优先级唯一、可判读)', () => {
    const p = buildToolPermissionPreview({
      input: { command: 'ls' },
      rawInput: { command: 'pwd' },
    })
    expect(p.command).toBe('ls')
  })

  it('正例:只写 file_path 的 Edit ⇒ filePaths 含该路径', () => {
    const p = buildToolPermissionPreview({ toolCallId: 't1', input: { file_path: 'src/only.ts' } })
    expect(p.filePaths).toEqual(['src/only.ts'])
    expect(p.hasContent).toBe(true)
  })

  it('反例:完全无别名的入参 ⇒ hasContent=false 且四维全空', () => {
    const p = buildToolPermissionPreview({ input: { question: 'what', answer: 42 } })
    expect(p).toEqual<ToolPermissionPreview>({
      command: null,
      commandTruncated: false,
      filePaths: [],
      scope: null,
      fileChanges: [],
      hiddenFileCount: 0,
      hiddenChangeCount: 0,
      hasContent: false,
    })
  })
})

describe('G-673 键名归一与词元匹配(防同词不同义误命中)', () => {
  it('归一:file_path / filePath / File-Path 收敛同串', () => {
    expect(normalizePermissionPreviewKey('file_path')).toBe('filepath')
    expect(normalizePermissionPreviewKey('filePath')).toBe('filepath')
    expect(normalizePermissionPreviewKey('File-Path ')).toBe('filepath')
  })

  it('别名表成员必须已是归一形态(表的书写形式本身进判据)', () => {
    for (const group of Object.values(PERMISSION_PREVIEW_KEY_ALIASES)) {
      for (const alias of group) {
        expect(alias).toBe(normalizePermissionPreviewKey(alias))
      }
    }
  })

  it('子串不误命中:hashtags/has/pathExists/pathCount 全不成立 ⇒ 整体判无内容', () => {
    const p = buildToolPermissionPreview({
      hashtags: '#a',
      has: true,
      pathExists: false,
      pathCount: 3,
    })
    expect(p.filePaths).toEqual([])
    expect(p.hasContent).toBe(false)
  })

  it('path 与 files 两键同值时保序去重', () => {
    const p = buildToolPermissionPreview({ path: 'a.ts', files: ['a.ts', 'b.ts'] })
    expect(p.filePaths).toEqual(['a.ts', 'b.ts'])
  })
})

describe('G-673 显示预算', () => {
  it('默认预算 8:50 个路径 ⇒ 显示 8、hiddenFileCount 42(不静默截断)', () => {
    const many = Array.from({ length: 50 }, (_, i) => `f/${i}.ts`)
    const p = buildToolPermissionPreview({ files: many })
    expect(p.filePaths.length).toBe(PERMISSION_PREVIEW_DEFAULT_MAX_ITEMS)
    expect(p.hiddenFileCount).toBe(42)
  })

  it('maxItems 可覆盖;非法值(负数/小数)回落默认', () => {
    const many = Array.from({ length: 50 }, (_, i) => `f/${i}.ts`)
    expect(buildToolPermissionPreview({ files: many }, { maxItems: 3 }).filePaths.length).toBe(3)
    expect(
      buildToolPermissionPreview({ files: many }, { maxItems: -2 }).filePaths.length,
    ).toBe(PERMISSION_PREVIEW_DEFAULT_MAX_ITEMS)
    expect(
      buildToolPermissionPreview({ files: many }, { maxItems: 1.5 }).filePaths.length,
    ).toBe(PERMISSION_PREVIEW_DEFAULT_MAX_ITEMS)
  })

  it('命令超字符预算 ⇒ 截前缀并如实标 commandTruncated', () => {
    const long = 'x'.repeat(100)
    const p = buildToolPermissionPreview({ command: long }, { maxCommandChars: 10 })
    expect(p.command).toBe('x'.repeat(10))
    expect(p.commandTruncated).toBe(true)
  })
})

describe('G-673 文件变更类别(fileChanges)', () => {
  it('write_file 形态 {path, content} ⇒ 一条 create 变更(路径并进 filePaths)', () => {
    const p = buildToolPermissionPreview({ path: 'n.ts', content: 'hello' })
    expect(p.fileChanges).toEqual([{ path: 'n.ts', kind: 'create' }])
    expect(p.filePaths).toEqual(['n.ts'])
  })

  it('edit 形态 {file_path, old_string, new_string} ⇒ modify;仅 old ⇒ delete', () => {
    expect(
      buildToolPermissionPreview({ file_path: 'e.ts', old_string: 'a', new_string: 'b' }).fileChanges,
    ).toEqual([{ path: 'e.ts', kind: 'modify' }])
    expect(
      buildToolPermissionPreview({ file_path: 'e.ts', old_string: 'a' }).fileChanges,
    ).toEqual([{ path: 'e.ts', kind: 'delete' }])
  })

  it('批量数组 changes:[{path,new_string}] ⇒ 逐项分类;files 的字符串元素并进路径', () => {
    const p = buildToolPermissionPreview({
      changes: [
        { path: 'a.ts', new_string: '1', is_new_file: true },
        { path: 'b.ts', old_string: '1', new_string: '2' },
      ],
      files: ['c.ts'],
    })
    expect(p.fileChanges).toEqual([
      { path: 'a.ts', kind: 'create' },
      { path: 'b.ts', kind: 'modify' },
    ])
    expect(p.filePaths).toEqual(['c.ts'])
  })

  it('无路径但有内容键 ⇒ 一条 path:null 变更(不编造路径,类别仍给出)', () => {
    const p = buildToolPermissionPreview({ new_string: '只给了新内容' })
    expect(p.fileChanges).toEqual([{ path: null, kind: 'create' }])
    expect(p.hasContent).toBe(true)
  })
})

describe('G-673 scope 维与坏输入鲁棒性', () => {
  it('scope 族别名:cwd / working_directory 都进 scope 维', () => {
    expect(buildToolPermissionPreview({ cwd: '/repo' }).scope).toBe('/repo')
    expect(buildToolPermissionPreview({ working_directory: '/srv' }).scope).toBe('/srv')
  })

  it('null/undefined/字符串/数组载荷 ⇒ 不抛异常、判无内容', () => {
    for (const payload of [null, undefined, 'not-an-object', 42, [1, 2]]) {
      expect(buildToolPermissionPreview(payload).hasContent).toBe(false)
    }
    expect(resolvePermissionPreviewArgs(null)).toBeNull()
    expect(resolvePermissionPreviewArgs([])).toBeNull()
  })

  it('承载层在场但不是对象/JSON 对象串 ⇒ 回落把载荷本身当参数(浏览器 input 文本型入参不误炸)', () => {
    const p = buildToolPermissionPreview({ toolName: 'browser_type', input: '要输入的文本' })
    // input 的值解析不出参数对象 ⇒ 载荷整体当参数;而载荷里没有四维别名键 ⇒ 诚实判无内容
    expect(p.hasContent).toBe(false)
    expect(resolvePermissionPreviewArgs({ toolName: 'x', input: 'plain text' })).toEqual({
      toolName: 'x',
      input: 'plain text',
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
