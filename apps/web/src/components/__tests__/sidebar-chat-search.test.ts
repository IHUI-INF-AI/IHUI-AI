// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import { filterConversationsByKeyword } from '../sidebar-chat-history'
import type { ConversationOrgMap } from '@ihui/shared'

/**
 * V3 #62:侧栏会话搜索过滤单测。
 * 被测对象是 sidebar-chat-history.tsx 导出的纯函数 filterConversationsByKeyword,
 * 匹配面以侧栏真实数据结构为准:会话标题 + 文件夹名 + 标签名(D20 客户端元数据 orgMap)。
 */

const orgMap: ConversationOrgMap = {
  c1: { folder: '工作', tags: ['重要', '周报'] },
  c2: { folder: '个人', tags: [] },
  c3: {},
}

const items = [
  { id: 'c1', title: 'Q3 销售复盘' },
  { id: 'c2', title: 'Weekend Plan' },
  { id: 'c3', title: 'API 设计讨论' },
]

describe('filterConversationsByKeyword', () => {
  it('空关键词返回原列表的副本(内容一致,引用不同)', () => {
    const out = filterConversationsByKeyword(items, '', orgMap)
    expect(out).toEqual(items)
    expect(out).not.toBe(items)
  })

  it('空白关键词(仅空格)等价于空关键词,不过滤', () => {
    expect(filterConversationsByKeyword(items, '   ', orgMap)).toEqual(items)
  })

  it('按会话标题匹配,大小写不敏感', () => {
    expect(filterConversationsByKeyword(items, 'q3', orgMap)).toEqual([items[0]])
    expect(filterConversationsByKeyword(items, 'WEEKEND', orgMap)).toEqual([items[1]])
  })

  it('按文件夹名匹配(D20 客户端元数据)', () => {
    // "工作" 是 c1 的文件夹名,非任何标题字面量
    expect(filterConversationsByKeyword(items, '工作', orgMap)).toEqual([items[0]])
  })

  it('按标签名匹配(D20 客户端元数据)', () => {
    // "周报" 是 c1 的标签,非任何标题/文件夹字面量
    expect(filterConversationsByKeyword(items, '周报', orgMap)).toEqual([items[0]])
  })

  it('无匹配返回空数组(搜索空态)', () => {
    expect(filterConversationsByKeyword(items, '不存在的词', orgMap)).toEqual([])
  })

  it('关键词两侧空白被忽略(trim)', () => {
    expect(filterConversationsByKeyword(items, '  q3  ', orgMap)).toEqual([items[0]])
  })

  it('未传 orgMap 时仅匹配标题,不误伤也不崩溃', () => {
    expect(filterConversationsByKeyword(items, '工作')).toEqual([])
    expect(filterConversationsByKeyword(items, 'api')).toEqual([items[2]])
  })

  it('清空关键词(从有匹配到空串)恢复完整列表', () => {
    const searched = filterConversationsByKeyword(items, 'q3', orgMap)
    expect(searched).toEqual([items[0]])
    // 模拟用户清空输入框:回到未过滤全集(渲染层据此恢复分组视图)
    const restored = filterConversationsByKeyword(items, '', orgMap)
    expect(restored).toEqual(items)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
