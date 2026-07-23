/**
 * InterjectionBuffer 单元测试 — 覆盖优先级排序、maxSize、maxAgeMs、consumed 标记等。
 */
import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest'
import { InterjectionBuffer } from '../src/interjection.js'

describe('InterjectionBuffer', () => {
  let buffer: InterjectionBuffer

  beforeEach(() => {
    buffer = new InterjectionBuffer()
  })

  describe('push + pop FIFO 同优先级', () => {
    it('同优先级 normal 按 push 顺序 FIFO pop', () => {
      buffer.push('first', 'normal')
      buffer.push('second', 'normal')
      buffer.push('third', 'normal')

      expect(buffer.pop()?.content).toBe('first')
      expect(buffer.pop()?.content).toBe('second')
      expect(buffer.pop()?.content).toBe('third')
      expect(buffer.pop()).toBeNull()
    })

    it('同优先级 low 也按 FIFO', () => {
      buffer.push('a', 'low')
      buffer.push('b', 'low')
      expect(buffer.pop()?.content).toBe('a')
      expect(buffer.pop()?.content).toBe('b')
    })
  })

  describe('不同优先级 pop 顺序', () => {
    it('critical > high > normal > low', () => {
      buffer.push('low1', 'low')
      buffer.push('normal1', 'normal')
      buffer.push('critical1', 'critical')
      buffer.push('high1', 'high')

      expect(buffer.pop()?.content).toBe('critical1')
      expect(buffer.pop()?.content).toBe('high1')
      expect(buffer.pop()?.content).toBe('normal1')
      expect(buffer.pop()?.content).toBe('low1')
    })

    it('同优先级 FIFO + 高优先级插队', () => {
      buffer.push('n1', 'normal')
      buffer.push('n2', 'normal')
      buffer.push('h1', 'high')
      buffer.push('n3', 'normal')
      buffer.push('c1', 'critical')

      expect(buffer.pop()?.content).toBe('c1')
      expect(buffer.pop()?.content).toBe('h1')
      expect(buffer.pop()?.content).toBe('n1')
      expect(buffer.pop()?.content).toBe('n2')
      expect(buffer.pop()?.content).toBe('n3')
    })

    it('默认优先级为 normal', () => {
      buffer.push('default')
      const peeked = buffer.peek()
      expect(peeked?.priority).toBe('normal')
    })
  })

  describe('formatForLLM 格式', () => {
    it('包含起止标记和按优先级排序的条目', () => {
      buffer.push('请先处理登录 bug', 'critical')
      buffer.push('记得运行测试', 'normal')

      const formatted = buffer.formatForLLM()
      expect(formatted).toContain('[用户中途插入指令]')
      expect(formatted).toContain('[/用户中途插入指令]')
      expect(formatted).toContain('[critical]')
      expect(formatted).toContain('请先处理登录 bug')
      expect(formatted).toContain('[normal]')
      expect(formatted).toContain('记得运行测试')
      expect(formatted.indexOf('critical')).toBeLessThan(formatted.indexOf('normal'))
    })

    it('条目带序号和时间戳', () => {
      buffer.push('hello', 'high')
      const formatted = buffer.formatForLLM()
      expect(formatted).toMatch(/1\. \[high\] \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} — "hello"/)
    })

    it('空 buffer 返回空字符串', () => {
      expect(buffer.formatForLLM()).toBe('')
    })

    it('不消费 buffer 内容', () => {
      buffer.push('a', 'normal')
      buffer.formatForLLM()
      expect(buffer.size()).toBe(1)
      expect(buffer.hasPending()).toBe(true)
    })

    it('consumed 条目不出现在格式化输出中', () => {
      buffer.push('a', 'normal')
      buffer.push('b', 'high')
      buffer.pop()
      const formatted = buffer.formatForLLM()
      expect(formatted).toContain('a')
      expect(formatted).not.toContain('b')
    })
  })

  describe('maxSize 上限剔除最老', () => {
    it('超过 maxSize 时剔除最老的未 consumed 条目', () => {
      const small = new InterjectionBuffer({ maxSize: 3 })
      small.push('a', 'normal')
      small.push('b', 'normal')
      small.push('c', 'normal')
      small.push('d', 'normal')

      expect(small.size()).toBe(3)
      expect(small.pop()?.content).toBe('b')
      expect(small.pop()?.content).toBe('c')
      expect(small.pop()?.content).toBe('d')
    })

    it('剔除时优先移除 consumed 条目', () => {
      const small = new InterjectionBuffer({ maxSize: 2 })
      small.push('a', 'normal')
      small.push('b', 'normal')
      small.pop()
      small.push('c', 'normal')

      expect(small.size()).toBe(2)
      expect(small.pop()?.content).toBe('b')
      expect(small.pop()?.content).toBe('c')
    })
  })

  describe('maxAgeMs 过期清除', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('超过 maxAgeMs 的条目在下次操作时被清除', () => {
      const now = Date.now()
      vi.setSystemTime(now)

      const buf = new InterjectionBuffer({ maxAgeMs: 1000 })
      buf.push('old', 'normal')

      vi.setSystemTime(now + 2000)
      buf.push('new', 'normal')

      expect(buf.size()).toBe(1)
      expect(buf.pop()?.content).toBe('new')
    })

    it('未过期的条目保留', () => {
      const now = Date.now()
      vi.setSystemTime(now)

      const buf = new InterjectionBuffer({ maxAgeMs: 5000 })
      buf.push('a', 'normal')

      vi.setSystemTime(now + 3000)
      buf.push('b', 'normal')

      expect(buf.size()).toBe(2)
    })

    it('hasPending 也触发过期清除', () => {
      const now = Date.now()
      vi.setSystemTime(now)

      const buf = new InterjectionBuffer({ maxAgeMs: 1000 })
      buf.push('old', 'normal')

      vi.setSystemTime(now + 2000)
      expect(buf.hasPending()).toBe(false)
    })
  })

  describe('clear 清空', () => {
    it('清空所有条目', () => {
      buffer.push('a', 'normal')
      buffer.push('b', 'high')
      expect(buffer.size()).toBe(2)

      buffer.clear()
      expect(buffer.size()).toBe(0)
      expect(buffer.hasPending()).toBe(false)
      expect(buffer.pop()).toBeNull()
      expect(buffer.peek()).toBeNull()
    })
  })

  describe('size + hasPending', () => {
    it('初始为空', () => {
      expect(buffer.size()).toBe(0)
      expect(buffer.hasPending()).toBe(false)
    })

    it('push 后递增', () => {
      buffer.push('a', 'normal')
      expect(buffer.size()).toBe(1)
      expect(buffer.hasPending()).toBe(true)

      buffer.push('b', 'high')
      expect(buffer.size()).toBe(2)
    })

    it('pop 后递减', () => {
      buffer.push('a', 'normal')
      buffer.push('b', 'high')

      buffer.pop()
      expect(buffer.size()).toBe(1)
      expect(buffer.hasPending()).toBe(true)

      buffer.pop()
      expect(buffer.size()).toBe(0)
      expect(buffer.hasPending()).toBe(false)
    })
  })

  describe('consumed 标记', () => {
    it('pop 后标记 consumed,size 减 1', () => {
      buffer.push('a', 'normal')
      buffer.push('b', 'high')

      const popped = buffer.pop()
      expect(popped?.content).toBe('b')
      expect(popped?.consumed).toBe(true)
      expect(buffer.size()).toBe(1)
    })

    it('pop 不会重复返回已 consumed 的条目', () => {
      buffer.push('a', 'normal')
      buffer.pop()
      expect(buffer.pop()).toBeNull()
    })

    it('peek 不标记 consumed', () => {
      buffer.push('a', 'normal')
      const peeked = buffer.peek()
      expect(peeked?.consumed).toBe(false)
      expect(buffer.size()).toBe(1)

      const popped = buffer.pop()
      expect(popped?.content).toBe('a')
    })
  })

  describe('push 返回 id', () => {
    it('返回非空字符串 id', () => {
      const id = buffer.push('a', 'normal')
      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)
    })

    it('每次 push 返回唯一 id', () => {
      const id1 = buffer.push('a', 'normal')
      const id2 = buffer.push('b', 'normal')
      expect(id1).not.toBe(id2)
    })
  })

  describe('peek 行为', () => {
    it('返回最高优先级且最早的条目', () => {
      buffer.push('n1', 'normal')
      buffer.push('h1', 'high')
      buffer.push('c1', 'critical')

      expect(buffer.peek()?.content).toBe('c1')
      expect(buffer.peek()?.content).toBe('c1')
    })

    it('空 buffer 返回 null', () => {
      expect(buffer.peek()).toBeNull()
    })
  })
})
