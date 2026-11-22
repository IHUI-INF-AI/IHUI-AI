// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D81 第⑤项连接器分组 + 第③项查询词取值入口的契约钉死。
// 立票起因:D81 尾票裁决要判 groupToolActivitiesByConnector 接线/删除、并删掉
// tool-category.ts 里那份与 tool-display.ts 重叠的查询词键表。删之前必须**机器证明**
// "没丢能力",删之后必须把留给下一位接线者的语义钉死(尤其 __none__ 桶 —— 渲染层
// 若把它当连接器名打出去就是用户可见的垃圾文案)。
import { describe, expect, it } from 'vitest'

import {
  groupToolActivitiesByConnector,
  type ConnectorActivityItem,
} from '../tool-category'
import { describeToolCall } from '../tool-display'

function item(over: Partial<ConnectorActivityItem> & { id: string }): ConnectorActivityItem {
  return { label: over.id, ...over }
}

describe('groupToolActivitiesByConnector(D81 ⑤ 分组契约)', () => {
  it('同连接器同方向合入一组,方向不同则分两组', () => {
    const groups = groupToolActivitiesByConnector([
      item({ id: 'a', connector: 'github', direction: 'read' }),
      item({ id: 'b', connector: 'github', direction: 'read' }),
      item({ id: 'c', connector: 'github', direction: 'write' }),
    ])
    expect(groups).toHaveLength(2)
    const read = groups.find((g) => g.direction === 'read')!
    const write = groups.find((g) => g.direction === 'write')!
    expect(read.items.map((i) => i.id)).toEqual(['a', 'b'])
    expect(write.items.map((i) => i.id)).toEqual(['c'])
  })

  it('连接器不同即不同组(反向对照:同方向也不得被合并)', () => {
    const groups = groupToolActivitiesByConnector([
      item({ id: 'gh', connector: 'github', direction: 'read' }),
      item({ id: 'nt', connector: 'notion', direction: 'read' }),
    ])
    expect(groups.map((g) => g.connector)).toEqual(['github', 'notion'])
    expect(groups.every((g) => g.items.length === 1)).toBe(true)
  })

  it('方向缺省 / 非 write 一律落 read —— 判据只有写类白名单能翻面', () => {
    const groups = groupToolActivitiesByConnector([
      item({ id: 'undef' }),
      item({ id: 'explicit-read', direction: 'read' }),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0]!.direction).toBe('read')
  })

  it('空 / 纯空白连接器收进同一个 __none__ 桶:渲染层禁止把它当标签文案', () => {
    const groups = groupToolActivitiesByConnector([
      item({ id: 'missing' }),
      item({ id: 'blank', connector: '   ' }),
      item({ id: 'empty', connector: '' }),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0]!.connector).toBe('__none__')
    expect(groups[0]!.items).toHaveLength(3)
  })

  it('输出顺序确定(连接器字典序 → 方向),分组头不会因入参顺序抖动', () => {
    const input = [
      item({ id: 'z1', connector: 'notion', direction: 'write' }),
      item({ id: 'z2', connector: 'github', direction: 'write' }),
      item({ id: 'z3', connector: 'github', direction: 'read' }),
    ]
    const shuffled = groupToolActivitiesByConnector([input[1]!, input[2]!, input[0]!])
    const ordered = groupToolActivitiesByConnector(input)
    expect(shuffled.map((g) => `${g.connector}/${g.direction}`)).toEqual(
      ordered.map((g) => `${g.connector}/${g.direction}`),
    )
    expect(ordered.map((g) => `${g.connector}/${g.direction}`)).toEqual([
      'github/read',
      'github/write',
      'notion/write',
    ])
  })

  it('空数组返回空组(渲染层据此整段不出现分组头)', () => {
    expect(groupToolActivitiesByConnector([])).toEqual([])
  })
})

describe('查询词取值唯一入口(D81 ③ 删除 toolActivitySearchQuery 的等价证明)', () => {
  // 被删的 SEARCH_QUERY_KEYS 全部 7 枚键。逐键喂给 describeToolCall,
  // 只要每枚都能取到 subject,就证明"删的是子集,不是能力"。
  const DELETED_KEYS = ['query', 'keyword', 'keywords', 'q', 'search_term', 'pattern', 'prompt']

  for (const key of DELETED_KEYS) {
    it(`args.${key} 经 describeToolCall 仍可取到(不丢键)`, () => {
      const view = describeToolCall({
        toolName: 'file_search',
        args: { [key]: `命中文本-${key}` },
        status: 'success',
      })
      expect(view.subject).toBe(`命中文本-${key}`)
      expect(view.subjectKind).toBe('query')
    })
  }

  it('反向对照:一枚键都取不到时 subject 为空串(证明上一条不是恒真)', () => {
    const view = describeToolCall({
      toolName: 'file_search',
      args: { unrelated: 'x' },
      status: 'success',
    })
    expect(view.subject).toBe('')
  })

  it('第二份查询词键表不得回升:toolActivitySearchQuery 必须仍不在导出面', async () => {
    const mod = (await import('../tool-category')) as Record<string, unknown>
    expect(mod.toolActivitySearchQuery).toBeUndefined()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
