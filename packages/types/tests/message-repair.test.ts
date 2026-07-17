import { describe, expect, it } from 'vitest'
import { repairMessages, type RepairableMessage } from '../src/message-repair.js'

describe('P38 共享 repairMessages(跨端同步:CLI/API/ai-service 同源)', () => {
  describe('Rule 1: 过滤非法 role', () => {
    it('移除 tool/function/unknown role', () => {
      const msgs: RepairableMessage[] = [
        { role: 'system', content: 'sys' },
        { role: 'tool', content: 'tool result' },
        { role: 'function', content: 'fn result' },
        { role: 'unknown', content: 'bad' },
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'hello' },
      ]
      const { repaired, removed, reasons } = repairMessages(msgs)
      expect(repaired).toHaveLength(3)
      expect(repaired.map((m) => m.role)).toEqual(['system', 'user', 'assistant'])
      expect(removed).toBe(3)
      expect(reasons.some((r) => r.includes('非法 role'))).toBe(true)
    })
  })

  describe('Rule 2: 过滤空 content', () => {
    it('移除空字符串和纯空白 content', () => {
      const msgs: RepairableMessage[] = [
        { role: 'user', content: '' },
        { role: 'assistant', content: '   \n\t  ' },
        { role: 'user', content: 'q' },
        { role: 'assistant', content: 'a' },
      ]
      const { repaired, removed } = repairMessages(msgs)
      expect(removed).toBeGreaterThanOrEqual(2)
      expect(repaired.every((m) => m.content.trim().length > 0)).toBe(true)
    })
  })

  describe('Rule 3: 去重连续相同 role', () => {
    it('合并连续 user 消息(\\n\\n 连接)', () => {
      const msgs: RepairableMessage[] = [
        { role: 'user', content: 'q1' },
        { role: 'user', content: 'q2' },
        { role: 'assistant', content: 'a' },
      ]
      const { repaired } = repairMessages(msgs)
      expect(repaired).toHaveLength(2)
      expect(repaired[0]!.content).toBe('q1\n\nq2')
    })

    it('合并连续 assistant 消息', () => {
      const msgs: RepairableMessage[] = [
        { role: 'user', content: 'q' },
        { role: 'assistant', content: 'a1' },
        { role: 'assistant', content: 'a2' },
        { role: 'assistant', content: 'a3' },
      ]
      const { repaired } = repairMessages(msgs)
      expect(repaired).toHaveLength(2)
      expect(repaired[1]!.content).toBe('a1\n\na2\n\na3')
    })

    it('不合并非连续相同 role', () => {
      const msgs: RepairableMessage[] = [
        { role: 'user', content: 'q1' },
        { role: 'assistant', content: 'a1' },
        { role: 'user', content: 'q2' },
        { role: 'assistant', content: 'a2' },
      ]
      const { repaired } = repairMessages(msgs)
      expect(repaired).toHaveLength(4)
    })
  })

  describe('Rule 4: 丢弃开头的 assistant', () => {
    it('移除开头的 assistant', () => {
      const msgs: RepairableMessage[] = [
        { role: 'assistant', content: 'stale' },
        { role: 'user', content: 'q' },
        { role: 'assistant', content: 'a' },
      ]
      const { repaired, removed } = repairMessages(msgs)
      expect(repaired).toHaveLength(2)
      expect(repaired[0]!.role).toBe('user')
      expect(removed).toBe(1)
    })

    it('保留开头的 system', () => {
      const msgs: RepairableMessage[] = [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'q' },
        { role: 'assistant', content: 'a' },
      ]
      const { repaired, removed } = repairMessages(msgs)
      expect(repaired).toHaveLength(3)
      expect(removed).toBe(0)
    })
  })

  describe('Rule 5: 移除末尾无响应的 user', () => {
    it('移除末尾 user(前面有 assistant)', () => {
      const msgs: RepairableMessage[] = [
        { role: 'user', content: 'q' },
        { role: 'assistant', content: 'a' },
        { role: 'user', content: 'interjection' },
      ]
      const { repaired, removed } = repairMessages(msgs)
      expect(repaired).toHaveLength(2)
      expect(repaired[repaired.length - 1]!.role).toBe('assistant')
      expect(removed).toBe(1)
    })

    it('保留首轮 user(无 assistant)', () => {
      const msgs: RepairableMessage[] = [{ role: 'user', content: 'q' }]
      const { repaired, removed } = repairMessages(msgs)
      expect(repaired).toHaveLength(1)
      expect(removed).toBe(0)
    })
  })

  describe('不变性', () => {
    it('不修改原数组', () => {
      const original: RepairableMessage[] = [
        { role: 'user', content: 'q' },
        { role: 'user', content: 'q2' },
        { role: 'assistant', content: 'a' },
      ]
      const originalCopy = JSON.parse(JSON.stringify(original))
      repairMessages(original)
      expect(original).toEqual(originalCopy)
    })

    it('不修改原消息对象', () => {
      const msg1: RepairableMessage = { role: 'user', content: 'q1' }
      const msg2: RepairableMessage = { role: 'user', content: 'q2' }
      const { repaired } = repairMessages([msg1, msg2])
      expect(msg1.content).toBe('q1')
      expect(msg2.content).toBe('q2')
      expect(repaired[0]!.content).toBe('q1\n\nq2')
    })
  })

  describe('组合与边界', () => {
    it('空数组返回空', () => {
      const { repaired, removed } = repairMessages([])
      expect(repaired).toEqual([])
      expect(removed).toBe(0)
    })

    it('复杂混合损坏完整修复', () => {
      const msgs: RepairableMessage[] = [
        { role: 'assistant', content: 'stale' },
        { role: 'tool', content: 'residue' },
        { role: 'user', content: '' },
        { role: 'user', content: 'q1' },
        { role: 'user', content: 'q2' },
        { role: 'assistant', content: 'a1' },
        { role: 'assistant', content: 'a2' },
        { role: 'user', content: 'interjection' },
      ]
      const { repaired, removed } = repairMessages(msgs)
      expect(removed).toBeGreaterThanOrEqual(4)
      expect(repaired).toHaveLength(2)
      expect(repaired[0]!.role).toBe('user')
      expect(repaired[0]!.content).toBe('q1\n\nq2')
      expect(repaired[1]!.role).toBe('assistant')
      expect(repaired[1]!.content).toBe('a1\n\na2')
    })
  })
})
