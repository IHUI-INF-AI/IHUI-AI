// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D20 会话组织规则的单测。
//
// 断言取向(防"只复读实现"):
//   · 每条**语义**成对给正反例(筛得到 / 筛不到、去重 / 不误删异名);
//   · 三条"引用稳定性"用例钉的是**渲染层后果**(orgMap/meta 进 useMemo/useEffect 依赖),
//     这类缺陷不影响单次取值,只表现为"输入被重置""每帧重算",纯取值断言抓不到;
//   · 不改入参这条用 frozen 数组喂,任何就地修改都会直接抛。

import { describe, expect, it } from 'vitest'

import {
  EMPTY_CONVERSATION_ORG_META,
  ORG_FOLDER_MAX_LENGTH,
  ORG_TAG_MAX_COUNT,
  ORG_TAG_MAX_LENGTH,
  filterByFolder,
  getOrgFolder,
  getOrgMeta,
  listFolderNames,
  normalizeOrgName,
  normalizeTagList,
  sortPinnedFirst,
  withFolderMeta,
  withTagsMeta,
  type ConversationOrgMap,
} from '../conversation-org'

describe('normalizeOrgName', () => {
  it('去首尾空白并把换行/制表折成单空格', () => {
    expect(normalizeOrgName('  工作\n  项目 ')).toBe('工作 项目')
    expect(normalizeOrgName('a\t\tb')).toBe('a b')
  })

  it('按上限截断,且上限来自常量而非另抄数字', () => {
    const long = '名'.repeat(ORG_FOLDER_MAX_LENGTH + 10)
    expect(normalizeOrgName(long)).toHaveLength(ORG_FOLDER_MAX_LENGTH)
    // 显式传更小 max 时以传入为准(调用方不给第二个上限)
    expect(normalizeOrgName('abcdef', 3)).toBe('abc')
  })

  it('空 / 只有空白 / 非字符串都归零成空串', () => {
    expect(normalizeOrgName('')).toBe('')
    expect(normalizeOrgName('   \n  ')).toBe('')
    expect(normalizeOrgName(null)).toBe('')
    expect(normalizeOrgName(undefined)).toBe('')
    expect(normalizeOrgName(123 as unknown as string)).toBe('')
  })
})

describe('normalizeTagList', () => {
  it('丢空、按小写去重并保留首次出现的书写', () => {
    expect(normalizeTagList(['工作', ' 工作 ', 'personal', 'Personal'])).toEqual([
      '工作',
      'personal',
    ])
  })

  it('单条按 ORG_TAG_MAX_LENGTH 截断,条数按 ORG_TAG_MAX_COUNT 封顶', () => {
    const one = normalizeTagList(['x'.repeat(ORG_TAG_MAX_LENGTH + 20)])
    expect(one[0]).toHaveLength(ORG_TAG_MAX_LENGTH)
    expect(normalizeTagList(Array.from({ length: 30 }, (_, i) => `t${i}`))).toHaveLength(
      ORG_TAG_MAX_COUNT,
    )
  })

  it('不改入参(用 frozen 数组喂,就地修改会抛)', () => {
    const input = Object.freeze(['a', 'b', 'a']) as string[]
    expect(() => normalizeTagList(input)).not.toThrow()
    expect(input).toEqual(['a', 'b', 'a'])
  })

  it('非数组 / 含非字符串项都安全降级成空表', () => {
    expect(normalizeTagList(null)).toEqual([])
    expect(normalizeTagList(undefined)).toEqual([])
    expect(normalizeTagList([1, 'ok', null] as unknown as string[])).toEqual(['ok'])
  })
})

describe('getOrgMeta / getOrgFolder', () => {
  const map: ConversationOrgMap = {
    c1: { folder: ' 工作 ', tags: ['a'] },
    c2: { folder: null },
  }

  it('未命中的会话返回同一个模块级空对象(引用稳定性 = 渲染层不被重置)', () => {
    const a = getOrgMeta(map, 'nope')
    const b = getOrgMeta(map, 'nope')
    expect(a).toBe(EMPTY_CONVERSATION_ORG_META)
    expect(a).toBe(b)
    // 空 id / 空 map 同样不得新建对象
    expect(getOrgMeta(map, null)).toBe(EMPTY_CONVERSATION_ORG_META)
    expect(getOrgMeta(undefined, 'c1')).toBe(EMPTY_CONVERSATION_ORG_META)
  })

  it('命中时返回存储里那一份本体', () => {
    expect(getOrgMeta(map, 'c1')).toBe(map.c1)
  })

  it('getOrgFolder 读的是归一化之后的值', () => {
    expect(getOrgFolder(map, 'c1')).toBe('工作')
    expect(getOrgFolder(map, 'c2')).toBe('')
    expect(getOrgFolder(map, 'missing')).toBe('')
  })
})

describe('listFolderNames', () => {
  it('去重、剔除未分组,并按码位确定排序', () => {
    const map: ConversationOrgMap = {
      a: { folder: '工作' },
      b: { folder: '  工作' },
      c: { folder: '个人' },
      d: { folder: null },
      e: { tags: ['x'] },
    }
    expect(listFolderNames(map)).toEqual(['个人', '工作'])
  })

  it('空 map / 非对象都返回空表而不是崩', () => {
    expect(listFolderNames({})).toEqual([])
    expect(listFolderNames(null)).toEqual([])
    expect(listFolderNames(undefined)).toEqual([])
  })
})

describe('filterByFolder', () => {
  type Row = { id: string; title: string }
  const rows: Row[] = [
    { id: 'a', title: 'A' },
    { id: 'b', title: 'B' },
    { id: 'c', title: 'C' },
  ]
  const map: ConversationOrgMap = { a: { folder: '工作' }, b: { folder: '个人' } }
  const ids = (list: Row[]) => list.map((x) => x.id)

  it('undefined = 不过滤,全部返回', () => {
    expect(ids(filterByFolder(rows, map, undefined))).toEqual(['a', 'b', 'c'])
  })

  it('null = 只要未分组', () => {
    expect(ids(filterByFolder(rows, map, null))).toEqual(['c'])
  })

  it('指定名字 = 只要该文件夹,存储侧的多余空白不影响命中', () => {
    const messy: ConversationOrgMap = { a: { folder: '  工作  ' } }
    expect(ids(filterByFolder(rows, messy, '工作'))).toEqual(['a'])
  })

  it('传进一个归一化后为空的字符串,按"未分组"处理(与 null 同义)', () => {
    expect(ids(filterByFolder(rows, map, '   '))).toEqual(['c'])
  })

  it('不改入参', () => {
    const input = Object.freeze(rows) as Row[]
    const out = filterByFolder(input, map, undefined)
    expect(out).not.toBe(input)
    expect(ids(out)).toEqual(['a', 'b', 'c'])
  })

  it('空 map 下按任何文件夹筛都得到空表(未登录/无元数据的真实形态)', () => {
    expect(filterByFolder(rows, undefined, '工作')).toEqual([])
  })
})

describe('sortPinnedFirst', () => {
  type Row = { id: string; pinned?: boolean }
  const rows: Row[] = [
    { id: 'a' },
    { id: 'b', pinned: true },
    { id: 'c' },
    { id: 'd', pinned: true },
  ]

  it('置顶整体前移,两组各自保持原有相对顺序(稳定)', () => {
    expect(sortPinnedFirst(rows).map((x) => x.id)).toEqual(['b', 'd', 'a', 'c'])
  })

  it('pinned 为 false / 缺失都算未置顶,不被当成 truthy 混进前段', () => {
    expect(sortPinnedFirst([{ id: 'x', pinned: false }, { id: 'y' }]).map((v) => v.id)).toEqual([
      'x',
      'y',
    ])
  })

  it('不改入参', () => {
    const input = Object.freeze(rows) as Row[]
    const out = sortPinnedFirst(input)
    expect(out).not.toBe(input)
    expect(input.map((x) => x.id)).toEqual(['a', 'b', 'c', 'd'])
  })
})

describe('withFolderMeta / withTagsMeta(写入侧)', () => {
  it('值没有真正变化时返回入参本体 —— store 靠这一条短路 set()', () => {
    const map: ConversationOrgMap = { c1: { folder: '工作', tags: [] } }
    // 同一含义的不同书写(前后空白)不算变化
    expect(withFolderMeta(map, 'c1', '  工作 ')).toBe(map)
    expect(withTagsMeta(map, 'c1', [])).toBe(map)
    expect(withFolderMeta(map, 'c1', '个人')).not.toBe(map)
  })

  it('只动一栏:改文件夹不丢标签,改标签不丢文件夹', () => {
    const start: ConversationOrgMap = { c1: { folder: '工作', tags: ['重要'] } }
    const afterFolder = withFolderMeta(start, 'c1', '个人')
    expect(afterFolder.c1).toEqual({ folder: '个人', tags: ['重要'] })
    const afterTags = withTagsMeta(start, 'c1', ['紧急'])
    expect(afterTags.c1).toEqual({ folder: '工作', tags: ['紧急'] })
    // 入参不被就地修改
    expect(start.c1).toEqual({ folder: '工作', tags: ['重要'] })
  })

  it('两栏都空才整条回收;只清标签时条目仍留着文件夹', () => {
    let map: ConversationOrgMap = {}
    map = withFolderMeta(map, 'c1', '工作')
    map = withTagsMeta(map, 'c1', ['a'])
    map = withTagsMeta(map, 'c1', [])
    expect(map.c1).toEqual({ folder: '工作', tags: [] })
    map = withFolderMeta(map, 'c1', null)
    expect(map).toEqual({})
  })

  it('写入即归一化:换行/连续空白/超长都在这一处收口', () => {
    const map = withFolderMeta({}, 'c1', '  工作\n\n项目   ')
    expect(map.c1?.folder).toBe('工作 项目')
    const tagged = withTagsMeta({}, 'c1', ['x'.repeat(40), '  ', 'a', 'A'])
    expect(tagged.c1?.tags).toEqual(['x'.repeat(ORG_TAG_MAX_LENGTH), 'a'])
  })

  it('conversationId 为空时不动表(未就绪的行不该被写进存储)', () => {
    const map: ConversationOrgMap = { c1: { folder: '工作' } }
    expect(withFolderMeta(map, '', '个人')).toBe(map)
    expect(withTagsMeta(map, '', ['x'])).toBe(map)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
