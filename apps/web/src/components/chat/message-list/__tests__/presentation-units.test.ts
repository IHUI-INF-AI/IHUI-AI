// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 投影行 → 渲染分组的不变量(2026-10-29 立)。
 *
 * 这一层存在的唯一理由是**保护窗口化坐标系**(一条消息 = 一个窗口行,见该文件头注 ①)。
 * 因此本文件锁的不是"分组长什么样",而是那条必须永真的不变量:
 *
 *  - I1 **窗口内每条消息恰好出现一次、顺序不变**(遍历源是消息数组,不是投影行);
 *  - I2 游离消息(用户 / system / 失败轮)永不进容器;
 *  - I3 同一容器的消息必须落在**同一个**分组(不会被中间插入的游离消息切断后重新开组);
 *  - I4 缓存失效时分组键仍稳定(容器键由投影层给,与本层遍历顺序无关);
 *  - I5 `isExploring` 由容器位与活动组位合并,任一为真即为真(不丢语义)。
 *
 * 判据不复制(§0.6):工具名 → 类目一律经生产 `turn-presentation` 的纯函数。
 */
import { describe, it, expect } from 'vitest'
import type { ChatMessage, ToolCall } from '@/stores/chat'
import { buildPresentationRows, createPresentationCache } from '../turn-presentation'
import { buildPresentationGroups, groupIsExploring } from '../presentation-units'

let seq = 0
function tool(toolName: string, status: ToolCall['status'] = 'running'): ToolCall {
  seq += 1
  return { id: `tc-${seq}`, toolName, status, args: {} }
}

function userMsg(id: string): ChatMessage {
  return { id, role: 'user', content: 'hi', createdAt: 1 }
}

function assistantMsg(id: string, patch: Partial<ChatMessage> = {}): ChatMessage {
  return { id, role: 'assistant', content: 'ok', createdAt: 2, ...patch }
}

/** 展开所有分组里的消息 id(按渲染顺序)。 */
function flatMessageIds(groups: ReturnType<typeof buildPresentationGroups>): string[] {
  return groups.flatMap((g) => g.blocks.map((b) => b.messageId))
}

describe('渲染分组不变量 · I1 每条消息恰好出现一次且保序', () => {
  it('含容器与游离消息的混合会话:展开后与输入消息数组逐项等值', () => {
    const messages = [
      userMsg('u1'),
      assistantMsg('a1', { toolCalls: [tool('read_file')] }),
      assistantMsg('a2', { toolCalls: [tool('grep')] }),
      userMsg('u2'),
      assistantMsg('a3', { content: '直接答案' }),
      userMsg('u3'),
      assistantMsg('a4', { error: true, toolCalls: [tool('read_file')] }),
    ]
    const rows = buildPresentationRows(messages)
    const groups = buildPresentationGroups(rows, messages)
    expect(flatMessageIds(groups)).toEqual(messages.map((m) => m.id))
  })

  it('被窗口切掉一半时:只渲染窗口内那几条,绝不丢、绝不重复', () => {
    const messages = [
      userMsg('u1'),
      assistantMsg('a1', { toolCalls: [tool('read_file')] }),
      assistantMsg('a2', { toolCalls: [tool('grep')] }),
      assistantMsg('a3', { toolCalls: [tool('think')] }),
    ]
    const rows = buildPresentationRows(messages)
    // 只取后两条(模拟窗口只覆盖 a2/a3)
    const windowed = messages.slice(2)
    const groups = buildPresentationGroups(rows, windowed)
    expect(flatMessageIds(groups)).toEqual(['a2', 'a3'])
    // 这两条仍属同一容器 ⇒ 一个分组(容器语义在窗口内保留)
    expect(groups).toHaveLength(1)
    expect(groups[0]?.container).not.toBeNull()
  })

  it('空输入 ⇒ 空分组(不造空容器)', () => {
    expect(buildPresentationGroups([], [])).toEqual([])
  })
})

describe('渲染分组不变量 · I2 游离消息永不进容器', () => {
  it('用户消息 / 失败轮 的 container 恒为 null', () => {
    const messages = [
      userMsg('u1'),
      assistantMsg('a1', { error: true, toolCalls: [tool('read_file')] }),
      userMsg('u2'),
    ]
    const rows = buildPresentationRows(messages)
    const groups = buildPresentationGroups(rows, messages)
    for (const group of groups) expect(group.container).toBeNull()
    expect(groups.every((g) => g.blocks.length === 1)).toBe(true)
  })
})

describe('渲染分组不变量 · I3 同一容器的消息落在同一分组', () => {
  it('两条助手消息聚成一个分组,分组键 = 容器 id(不是消息 id)', () => {
    const messages = [
      userMsg('u1'),
      assistantMsg('a1', { toolCalls: [tool('read_file')] }),
      assistantMsg('a2', { toolCalls: [tool('grep')] }),
    ]
    const rows = buildPresentationRows(messages)
    const groups = buildPresentationGroups(rows, messages)
    expect(groups).toHaveLength(2) // [u1] + [a1,a2]
    expect(groups[0]?.key).toBe('u1')
    expect(groups[1]?.key).toBe('thinking-agent:u1:0')
    expect(groups[1]?.blocks.map((b) => b.messageId)).toEqual(['a1', 'a2'])
  })

  it('两个不同轮次各成一个容器分组(不跨轮合并)', () => {
    const messages = [
      userMsg('u1'),
      assistantMsg('a1', { toolCalls: [tool('read_file')] }),
      assistantMsg('a2', { toolCalls: [tool('grep')] }),
      userMsg('u2'),
      assistantMsg('a3', { toolCalls: [tool('web_search')] }),
      assistantMsg('a4', { toolCalls: [tool('think')] }),
    ]
    const rows = buildPresentationRows(messages)
    const groups = buildPresentationGroups(rows, messages)
    const containerKeys = groups.filter((g) => g.container !== null).map((g) => g.key)
    expect(containerKeys).toEqual(['thinking-agent:u1:0', 'thinking-agent:u2:0'])
  })
})

describe('渲染分组不变量 · I4 流式追加时容器键稳定', () => {
  it('只改最后一条内容 ⇒ 容器键不变、**前缀段**的容器引用不变', () => {
    const cache = createPresentationCache()
    const u1 = userMsg('u1')
    const a1 = assistantMsg('a1', { toolCalls: [tool('read_file')], content: '' })
    const u2 = userMsg('u2')
    const a2 = assistantMsg('a2', { toolCalls: [tool('grep')], content: '' })

    const first = buildPresentationGroups(cache.project([u1, a1, u2, a2]).rows, [u1, a1, u2, a2])
    // 流式追加只替换最后一条消息对象(store 的真实形态)
    const a2Next: ChatMessage = { ...a2, content: 'ok' }
    const second = buildPresentationGroups(cache.project([u1, a1, u2, a2Next]).rows, [
      u1,
      a1,
      u2,
      a2Next,
    ])

    // 键集合一字不动 ⇒ React 侧不会因 key 变化重挂 DOM
    expect(second.map((g) => g.key)).toEqual(first.map((g) => g.key))
    // 前缀段(第一轮那个容器)的对象引用保持 —— 这正是"每帧只重算最后一行"的可观测凭据。
    // 尾段的容器引用会变(该段确实变了),这是段级复用的定义,不是缺陷。
    const firstPrefix = first.find((g) => g.key === 'thinking-agent:u1:0')
    const secondPrefix = second.find((g) => g.key === 'thinking-agent:u1:0')
    expect(firstPrefix).toBeTruthy()
    expect(secondPrefix?.container).toBe(firstPrefix?.container)
    const firstTail = first.find((g) => g.key === 'thinking-agent:u2:0')
    const secondTail = second.find((g) => g.key === 'thinking-agent:u2:0')
    expect(secondTail?.container).not.toBe(firstTail?.container)
  })
})

describe('渲染分组不变量 · I5 isExploring 合并语义', () => {
  it('容器位为真 ⇒ 分组为真', () => {
    const messages = [
      userMsg('u1'),
      assistantMsg('a1', { toolCalls: [tool('read_file')] }),
      assistantMsg('a2', { toolCalls: [tool('grep')] }),
    ]
    const groups = buildPresentationGroups(buildPresentationRows(messages), messages)
    const containerGroup = groups.find((g) => g.container !== null)
    expect(containerGroup).toBeTruthy()
    expect(groupIsExploring(containerGroup!)).toBe(true)
  })

  it('非探索(思考型)⇒ 分组为假(成对,防判据恒真)', () => {
    const messages = [userMsg('u1'), assistantMsg('a1', { toolCalls: [tool('think')] })]
    const groups = buildPresentationGroups(buildPresentationRows(messages), messages)
    const containerGroup = groups.find((g) => g.container !== null)
    expect(containerGroup).toBeTruthy()
    expect(groupIsExploring(containerGroup!)).toBe(false)
  })

  it('游离消息的分组恒为假(不臆造探索态)', () => {
    const messages = [userMsg('u1')]
    const groups = buildPresentationGroups(buildPresentationRows(messages), messages)
    expect(groups.every((g) => groupIsExploring(g) === false)).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
