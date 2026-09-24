// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D58 工具类目聚合层 · 纯函数与类目表断言。
 * 覆盖:类目表齐全 + order 单调、工具名→类目映射、同类连续聚合 / 不连续不聚合、
 * countable 语义、无顺序聚合(summarize)。
 */
import { describe, expect, it } from 'vitest'
import {
  CATEGORY_TABLE,
  aggregateCategoryRuns,
  resolveToolCategory,
  summarizeCategoriesByTool,
  type CategoryKey,
} from '../tool-category'

// D58 原文逐字枚举的 18 个具名类目(计划标注"20 类"但仅枚举 18;差 2 待主会话确认)。
const EXPECTED_KEYS: CategoryKey[] = [
  'file_read',
  'file_write',
  'file_modify',
  'file_delete',
  'file_search',
  'command',
  'preview',
  'web_search',
  'mcp',
  'skill',
  'task_management',
  'thinking',
  'user_interaction',
  'image_gen',
  'video_gen',
  'env_init',
  'end',
  'other',
]

describe('D58 类目表', () => {
  it('18 个具名类目齐全(逐字对齐 D58 原文枚举)', () => {
    const keys = CATEGORY_TABLE.map((d) => d.key)
    expect(keys).toEqual(EXPECTED_KEYS)
    expect(CATEGORY_TABLE).toHaveLength(EXPECTED_KEYS.length)
  })

  it('order 单调递增且从 1 连续(1..18 无重复无缺口)', () => {
    const orders = CATEGORY_TABLE.map((d) => d.order)
    const sorted = [...orders].sort((a, b) => a - b)
    expect(orders).toEqual(sorted)
    expect(orders).toEqual(EXPECTED_KEYS.map((_, i) => i + 1))
    expect(new Set(orders).size).toBe(orders.length)
  })

  it('每个类目都带 labelKey / countable / expandStrategy 三要素', () => {
    for (const d of CATEGORY_TABLE) {
      expect(typeof d.labelKey).toBe('string')
      expect(typeof d.countable).toBe('boolean')
      expect(['auto', 'collapse', 'expand']).toContain(d.expandStrategy)
    }
  })
})

describe('D58 工具名 → 类目映射(resolveToolCategory)', () => {
  it('已知工具名精确命中对应类目', () => {
    expect(resolveToolCategory('read_file')).toBe('file_read')
    expect(resolveToolCategory('search_codebase')).toBe('file_search')
    expect(resolveToolCategory('write_file')).toBe('file_write')
    expect(resolveToolCategory('edit_file')).toBe('file_modify')
    expect(resolveToolCategory('file_edit')).toBe('file_modify')
    expect(resolveToolCategory('delete_file')).toBe('file_delete')
    expect(resolveToolCategory('run_command')).toBe('command')
    expect(resolveToolCategory('web_search')).toBe('web_search')
    expect(resolveToolCategory('use_skill')).toBe('skill')
    expect(resolveToolCategory('todo_write')).toBe('task_management')
    expect(resolveToolCategory('think')).toBe('thinking')
    expect(resolveToolCategory('ask_user')).toBe('user_interaction')
    expect(resolveToolCategory('image_gen')).toBe('image_gen')
    expect(resolveToolCategory('video_gen')).toBe('video_gen')
    expect(resolveToolCategory('env_init')).toBe('env_init')
    expect(resolveToolCategory('finish')).toBe('end')
  })

  it('MCP 命名约定识别为 mcp 类目', () => {
    expect(resolveToolCategory('mcp__github__create_issue')).toBe('mcp')
    expect(resolveToolCategory('server_mcp_tool')).toBe('mcp')
  })

  it('未知 / 插件 / 动态名一律归 other(绝不臆造类目)', () => {
    expect(resolveToolCategory('some_unknown_tool')).toBe('other')
    expect(resolveToolCategory('plugin::xyz')).toBe('other')
    expect(resolveToolCategory('')).toBe('other')
  })
})

describe('D58 同类连续聚合(aggregateCategoryRuns)', () => {
  it('同类连续步骤合并进同一张卡(一张卡,totalCount 求和)', () => {
    const runs = aggregateCategoryRuns([
      { toolName: 'read_file', count: 1 },
      { toolName: 'read_file', count: 1 },
      { toolName: 'read_file', count: 2 },
    ])
    expect(runs).toHaveLength(1)
    expect(runs[0].categoryKey).toBe('file_read')
    expect(runs[0].totalCount).toBe(4)
    expect(runs[0].tools).toHaveLength(3)
  })

  it('被其他类目打断则不聚合(断成两张卡,且保持时序)', () => {
    const runs = aggregateCategoryRuns([
      { toolName: 'read_file', count: 1 },
      { toolName: 'read_file', count: 1 },
      { toolName: 'edit_file', count: 1 }, // 文件改,打断
      { toolName: 'read_file', count: 1 }, // 再次文件读,但已不连续 → 新卡
    ])
    expect(runs).toHaveLength(3)
    // 时序优先:file_read → file_modify → file_read(全局按 order 重排会破坏此语义)
    expect(runs.map((r) => r.categoryKey)).toEqual(['file_read', 'file_modify', 'file_read'])
    expect(runs[0].totalCount).toBe(2)
    expect(runs[2].totalCount).toBe(1)
  })

  it('不同工具的同类连续同样合并(edit_file 与 file_edit 同属 file_modify)', () => {
    const runs = aggregateCategoryRuns([
      { toolName: 'edit_file', count: 1 },
      { toolName: 'file_edit', count: 3 },
    ])
    expect(runs).toHaveLength(1)
    expect(runs[0].categoryKey).toBe('file_modify')
    expect(runs[0].totalCount).toBe(4)
    expect(runs[0].tools).toHaveLength(2)
  })

  it('跨类目多段混合:run 数等于同类连续段数(且保持时序)', () => {
    const runs = aggregateCategoryRuns([
      { toolName: 'web_search', count: 1 },
      { toolName: 'read_file', count: 1 },
      { toolName: 'read_file', count: 1 },
      { toolName: 'web_search', count: 1 },
      { toolName: 'bash', count: 1 },
      { toolName: 'bash', count: 1 },
    ])
    // web_search / (read_file,read_file) / web_search / (bash,bash) = 4 段(保留输入时序)
    expect(runs).toHaveLength(4)
    expect(runs.map((r) => r.categoryKey)).toEqual([
      'web_search',
      'file_read',
      'web_search',
      'command',
    ])
  })

  it('aggregateCategoryRuns 保留输入时序(不做全局 order 重排)', () => {
    const runs = aggregateCategoryRuns([
      { toolName: 'web_search', count: 1 },
      { toolName: 'read_file', count: 1 },
      { toolName: 'edit_file', count: 1 },
    ])
    // 输入顺序即输出顺序,不因 order 字段被重排
    expect(runs.map((r) => r.categoryKey)).toEqual(['web_search', 'file_read', 'file_modify'])
  })
})

describe('D58 countable 语义', () => {
  it('阶段/标记型类目(countable=false):thinking 与 end', () => {
    const thinking = CATEGORY_TABLE.find((d) => d.key === 'thinking')!
    const end = CATEGORY_TABLE.find((d) => d.key === 'end')!
    expect(thinking.countable).toBe(false)
    expect(end.countable).toBe(false)
  })

  it('动作型类目(countable=true):文件类/命令/搜索等', () => {
    for (const k of [
      'file_read',
      'file_write',
      'file_modify',
      'file_delete',
      'file_search',
      'command',
      'preview',
      'web_search',
      'mcp',
      'skill',
      'task_management',
      'user_interaction',
      'image_gen',
      'video_gen',
      'env_init',
      'other',
    ] as CategoryKey[]) {
      expect(CATEGORY_TABLE.find((d) => d.key === k)!.countable).toBe(true)
    }
  })

  it('countable=false 的 run 在卡片上不展示 ×N(以 count 字段为契约)', () => {
    // 纯函数侧:只断言聚合结果携带正确的 countable 标记,渲染侧据此决定是否显示 ×N
    const runs = aggregateCategoryRuns([{ toolName: 'think', count: 3 }])
    expect(runs[0].categoryKey).toBe('thinking')
    expect(runs[0].countable).toBe(false)
    expect(runs[0].totalCount).toBe(3)
  })
})

describe('D58 无顺序聚合(summarizeCategoriesByTool)', () => {
  it('无顺序信息时每类目合并为单一 run(不臆造连续关系)', () => {
    const runs = summarizeCategoriesByTool({
      read_file: 2,
      edit_file: 1,
      search_codebase: 3,
      unknown_thing: 1,
    })
    const byKey = Object.fromEntries(runs.map((r) => [r.categoryKey, r.totalCount]))
    expect(byKey.file_read).toBe(2)
    expect(byKey.file_modify).toBe(1)
    expect(byKey.file_search).toBe(3)
    expect(byKey.other).toBe(1)
    // 每类目仅一个 run
    expect(runs.filter((r) => r.categoryKey === 'file_read')).toHaveLength(1)
  })

  it('summarizeCategoriesByTool 按类目 order 排序(无顺序信息时的兜底展示顺序)', () => {
    const runs = summarizeCategoriesByTool({
      web_search: 1,
      read_file: 1,
      edit_file: 1,
    })
    // web_search(order 8) 应排在 file_read(1) / file_modify(3) 之后
    expect(runs.map((r) => r.categoryKey)).toEqual(['file_read', 'file_modify', 'web_search'])
    expect(runs.map((r) => r.order)).toEqual([1, 3, 8])
  })

  it('summarize 与 aggregate 同一映射入口(禁止第二套分组逻辑)', () => {
    const agg = aggregateCategoryRuns([{ toolName: 'read_file', count: 2 }])
    const sum = summarizeCategoriesByTool({ read_file: 2 })
    expect(sum[0].categoryKey).toBe(agg[0].categoryKey)
    expect(sum[0].totalCount).toBe(agg[0].totalCount)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
