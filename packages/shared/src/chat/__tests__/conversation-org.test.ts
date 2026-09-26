// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D20 会话文件夹/标签纯逻辑层用例:归一化 / 增删查 / 分组 / 筛选 / 置顶稳定排序。

import { describe, expect, it } from 'vitest'

import {
  ORG_TAG_MAX_COUNT,
  ORG_TAG_MAX_LENGTH,
  filterByFolder,
  getOrgMeta,
  groupByFolder,
  listFolderNames,
  listTagNames,
  normalizeOrgName,
  normalizeTagList,
  sortPinnedFirst,
  withFolderMeta,
  withTagAdded,
  withTagRemoved,
  withTagsMeta,
} from '../conversation-org'

describe('normalizeOrgName / normalizeTagList', () => {
  it('去控制字符 + trim + 按上限截断', () => {
    expect(normalizeOrgName('  工作\n\n ', 10)).toBe('工作')
    expect(normalizeOrgName('ab', ORG_TAG_MAX_LENGTH)).toBe('ab')
    expect(normalizeOrgName('a'.repeat(50), 10)).toBe('a'.repeat(10))
  })

  it('标签列表去空白项 + 去重 + 数量上限', () => {
    expect(normalizeTagList([' a ', 'a', '', 'b'])).toEqual(['a', 'b'])
    const many = Array.from({ length: 20 }, (_, i) => `t${i}`)
    expect(normalizeTagList(many)).toHaveLength(ORG_TAG_MAX_COUNT)
  })
})

describe('withFolderMeta / withTagsMeta(不可变 + 空元数据回收)', () => {
  it('设置文件夹后可读回;原 map 不被改写', () => {
    const base = { c1: { tags: ['x'] } }
    const next = withFolderMeta(base, 'c2', ' 工作 ')
    expect(getOrgMeta(next, 'c2').folder).toBe('工作')
    expect(getOrgMeta(base, 'c2').folder).toBeUndefined()
    expect(base.c1.tags).toEqual(['x'])
  })

  it('folder=null 清除文件夹;整条变空时键被回收', () => {
    let map = withFolderMeta({}, 'c1', '工作')
    map = withTagsMeta(map, 'c1', ['a'])
    map = withFolderMeta(map, 'c1', null)
    expect(map.c1).toEqual({ tags: ['a'] })
    map = withTagsMeta(map, 'c1', [])
    expect('c1' in map).toBe(false)
  })

  it('整条为空且键不存在时返回原引用(幂等)', () => {
    const map = { c1: { folder: 'f' } }
    expect(withFolderMeta(map, 'c9', null)).toBe(map)
  })

  it('标签覆盖 + 保留文件夹', () => {
    const map = withFolderMeta({}, 'c1', '工作')
    const next = withTagsMeta(map, 'c1', ['a', 'a', ' b '])
    expect(next.c1).toEqual({ folder: '工作', tags: ['a', 'b'] })
  })
})

describe('withTagAdded / withTagRemoved', () => {
  it('追加去重;重复时返回原引用', () => {
    let map = withTagAdded({}, 'c1', '重要')
    map = withTagAdded(map, 'c1', ' 重要 ')
    expect(map).toEqual({ c1: { tags: ['重要'] } })
    const again = withTagAdded(map, 'c1', '重要')
    expect(again).toBe(map)
  })

  it('移除不存在的标签返回原引用;移除后空键回收', () => {
    const map = withTagAdded({}, 'c1', 'a')
    expect(withTagRemoved(map, 'c1', 'zzz')).toBe(map)
    const after = withTagRemoved(map, 'c1', 'a')
    expect('c1' in after).toBe(false)
  })
})

describe('listFolderNames / listTagNames', () => {
  it('去重 + 字典序;空值不计入', () => {
    const map: Record<string, { folder?: string | null; tags?: string[] }> = {
      c1: { folder: '工作', tags: ['b', 'a'] },
      c2: { folder: null },
      c3: { folder: '工作', tags: ['a'] },
      c4: {},
    }
    expect(listFolderNames(map)).toEqual(['工作'])
    expect(listTagNames(map)).toEqual(['a', 'b'])
  })
})

describe('groupByFolder / filterByFolder', () => {
  const map = {
    c1: { folder: '工作' },
    c2: { folder: '工作' },
    c3: { folder: '生活' },
    c4: {},
  }
  const items = [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }, { id: 'c4' }]

  it('命名文件夹字典序在前,未分组恒最后,组内保序', () => {
    const groups = groupByFolder(items, map)
    expect(groups.map((g) => g.folder)).toEqual(['工作', '生活', null])
    expect(groups[0]?.items.map((i) => i.id)).toEqual(['c1', 'c2'])
    expect(groups[2]?.items.map((i) => i.id)).toEqual(['c4'])
  })

  it('无文件夹使用时只有未分组一组', () => {
    const groups = groupByFolder([{ id: 'c4' }], {})
    expect(groups).toEqual([{ folder: null, items: [{ id: 'c4' }] }])
  })

  it('filterByFolder:undefined 不过滤 / null 只看未分组 / 字符串指定文件夹', () => {
    expect(filterByFolder(items, map, undefined).map((i) => i.id)).toEqual(['c1', 'c2', 'c3', 'c4'])
    expect(filterByFolder(items, map, null).map((i) => i.id)).toEqual(['c4'])
    expect(filterByFolder(items, map, '工作').map((i) => i.id)).toEqual(['c1', 'c2'])
  })
})

describe('sortPinnedFirst', () => {
  it('置顶在前且稳定(非置顶保持原相对顺序)', () => {
    const items = [
      { id: 'a', pinned: false },
      { id: 'b', pinned: true },
      { id: 'c', pinned: undefined },
      { id: 'd', pinned: true },
      { id: 'e' },
    ]
    expect(sortPinnedFirst(items).map((i) => i.id)).toEqual(['b', 'd', 'a', 'c', 'e'])
  })

  it('空数组安全;原数组不被改写', () => {
    expect(sortPinnedFirst([])).toEqual([])
    const src = [{ id: 'x', pinned: false }]
    sortPinnedFirst(src)
    expect(src).toEqual([{ id: 'x', pinned: false }])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
