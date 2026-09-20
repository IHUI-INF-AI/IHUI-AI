// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D27(2026-09-20 立):交付清单类型/解析纯函数单测。
 *
 * 覆盖三条解析与合并链路(调用方一律"解析失败 → null → 空态兜底",不抛错):
 *   1. normalizeTaskDeliverables — 契约字段逐一宽松守卫;
 *   2. extractSessionDeliverables — session_end wire 二次提取(string→parse、
 *      顶层 deliverables 包装/自身形如 TaskDeliverables 双形态兼容);
 *   3. mergeFilesChanged — 跨会话回溯合并(generatedAt 新在前 + 同路径去重)。
 */
import { describe, expect, it } from 'vitest'
import {
  extractSessionDeliverables,
  mergeFilesChanged,
  normalizeTaskDeliverables,
} from '@/types/agent-delivery'
import type { TaskDeliverables } from '@/types/agent-delivery'

/** 合法基线样本(字段齐全、类型正确) */
const valid = {
  citations: [{ source: 'wiki', label: '架构页', url: 'https://aizhs.top/wiki/1' }],
  filesChanged: [{ path: 'a.ts', kind: 'add', stepIds: ['s1'], additions: 10, deletions: 0 }],
  toolsSummary: { total: 3, byTool: { read_file: 2, grep: 1 } },
  outputSummary: '已完成交付',
  generatedAt: '2026-09-20T08:00:00.000Z',
}

describe('normalizeTaskDeliverables(宽松守卫)', () => {
  it('合法完整对象返回规范化结果(字段逐项透传)', () => {
    expect(normalizeTaskDeliverables(valid)).toEqual(valid)
  })

  it('非对象输入(null/字符串/数组元素级坏值)返回 null 不抛错', () => {
    expect(normalizeTaskDeliverables(null)).toBeNull()
    expect(normalizeTaskDeliverables('nope')).toBeNull()
    expect(normalizeTaskDeliverables(42)).toBeNull()
  })

  it('顶层契约数组字段缺失/非数组返回 null', () => {
    expect(normalizeTaskDeliverables({ ...valid, citations: undefined })).toBeNull()
    expect(normalizeTaskDeliverables({ ...valid, filesChanged: 'x' })).toBeNull()
  })

  it('toolsSummary.total 非有限数字 / byTool 值非数字返回 null', () => {
    expect(
      normalizeTaskDeliverables({ ...valid, toolsSummary: { total: '3', byTool: {} } }),
    ).toBeNull()
    expect(
      normalizeTaskDeliverables({ ...valid, toolsSummary: { total: Infinity, byTool: {} } }),
    ).toBeNull()
    expect(
      normalizeTaskDeliverables({ ...valid, toolsSummary: { total: 1, byTool: { grep: '2' } } }),
    ).toBeNull()
  })

  it('citation 的 url 类型不符/空串视为无链接,条目保留(宽松化)', () => {
    const bad = { ...valid, citations: [{ source: 'wiki', label: 'L', url: 1 }] }
    const parsed = normalizeTaskDeliverables(bad)
    expect(parsed).not.toBeNull()
    expect(parsed!.citations).toEqual([{ source: 'wiki', label: 'L' }])
    expect(parsed!.citations[0]).not.toHaveProperty('url')
  })

  it('file 变更坏条目(kind 白名单外/additions 非数字)跳过而非整体拒绝,好条目保留', () => {
    const badKind = {
      ...valid,
      filesChanged: [{ path: 'a.ts', kind: 'rename', stepIds: [], additions: 1, deletions: 0 }],
    }
    const parsedKind = normalizeTaskDeliverables(badKind)
    expect(parsedKind).not.toBeNull()
    expect(parsedKind!.filesChanged).toEqual([])
    const badCount = {
      ...valid,
      filesChanged: [{ path: 'a.ts', kind: 'add', stepIds: [], additions: NaN, deletions: 0 }],
    }
    expect(normalizeTaskDeliverables(badCount)!.filesChanged).toEqual([])
    // 混合好坏条目:坏条目剔除,好条目原样保留
    const mixed = {
      ...valid,
      filesChanged: [
        { path: 'bad.ts', kind: 'rename', stepIds: [], additions: 1, deletions: 0 },
        { path: 'good.ts', kind: 'add', stepIds: ['s1'], additions: 3, deletions: 1 },
        { path: 'nan.ts', kind: 'update', stepIds: [], additions: NaN, deletions: 0 },
      ],
    }
    const parsedMixed = normalizeTaskDeliverables(mixed)
    expect(parsedMixed!.filesChanged.map((f) => f.path)).toEqual(['good.ts'])
  })
})

describe('extractSessionDeliverables(session_end 二次提取)', () => {
  it('raw JSON 字符串含顶层 deliverables 包装 → 解析内层', () => {
    const wire = JSON.stringify({ session_id: 'sess-1', deliverables: valid })
    expect(extractSessionDeliverables(wire)).toEqual(valid)
  })

  it('入参对象自身形如 TaskDeliverables(无包装)→ 按自身解析(端点 data 路径)', () => {
    expect(extractSessionDeliverables(valid)).toEqual(valid)
  })

  it('已是 parse 过的 {deliverables:…} 对象同样解析内层', () => {
    expect(extractSessionDeliverables({ deliverables: valid })).toEqual(valid)
  })

  it('非 JSON 字符串 / 非对象输入返回 null 不抛错', () => {
    expect(extractSessionDeliverables('{not-json')).toBeNull()
    expect(extractSessionDeliverables(123)).toBeNull()
    expect(extractSessionDeliverables(null)).toBeNull()
  })

  it('内层字段不合契约 → null(调用方空态兜底)', () => {
    const wire = JSON.stringify({ deliverables: { outputSummary: '缺一半字段' } })
    expect(extractSessionDeliverables(wire)).toBeNull()
  })
})

describe('mergeFilesChanged(跨会话回溯合并)', () => {
  // 显式标注:防止对象字面量内 kind 字面量被拓宽为 string 而不合契约类型
  const older: TaskDeliverables = {
    ...valid,
    generatedAt: '2026-09-20T08:00:00.000Z',
    filesChanged: [{ path: 'old.ts', kind: 'add', stepIds: [], additions: 1, deletions: 0 }],
  }
  const newer: TaskDeliverables = {
    ...valid,
    generatedAt: '2026-09-20T09:00:00.000Z',
    filesChanged: [{ path: 'new.ts', kind: 'update', stepIds: [], additions: 2, deletions: 1 }],
  }

  it('generatedAt 新的一组排在前(回溯视角:最近交付优先展示)', () => {
    const merged = mergeFilesChanged(older, newer)
    expect(merged.map((f) => f.path)).toEqual(['new.ts', 'old.ts'])
  })

  it('同路径去重:保留更新一组的记录', () => {
    const dupNewer: TaskDeliverables = {
      ...newer,
      filesChanged: [{ path: 'same.ts', kind: 'delete', stepIds: [], additions: 0, deletions: 9 }],
    }
    const olderSame: TaskDeliverables = {
      ...older,
      filesChanged: [{ path: 'same.ts', kind: 'add', stepIds: [], additions: 1, deletions: 0 }],
    }
    const merged = mergeFilesChanged(olderSame, dupNewer)
    expect(merged).toHaveLength(1)
    expect(merged[0]!.kind).toBe('delete')
  })

  it('任一入参为 null 时返回另一组列表;双 null 返回空数组', () => {
    expect(mergeFilesChanged(older, null).map((f) => f.path)).toEqual(['old.ts'])
    expect(mergeFilesChanged(null, newer).map((f) => f.path)).toEqual(['new.ts'])
    expect(mergeFilesChanged(null, null)).toEqual([])
  })

  it('generatedAt 非法(不可解析)按 0 处理,不抛错', () => {
    const badTime: TaskDeliverables = { ...valid, generatedAt: 'not-a-date', filesChanged: [] }
    expect(() => mergeFilesChanged(older, badTime)).not.toThrow()
    expect(mergeFilesChanged(older, badTime).map((f) => f.path)).toEqual(['old.ts'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
