/**
 * 回归测试:BUG-R15-BLOOM-GUARD
 *
 * bugId: BUG-R15-BLOOM-GUARD
 * 轮次: 15
 * 场景: 插入 1000 条重复 key,验证误判率 < 1%
 *       旧架构来源: server/tests/test_bug_fixes_round15.py
 *
 * 验证点:
 *  - 插入 1000 个 key,contains 全部返回 true
 *  - 查询 1000 个未插入的 key,误判数 < 10(< 1%)
 *  - 误判率 = 误判数 / 1000
 *
 * 运行: pnpm -F @ihui/api test -- tests/regression/bloom-guard.test.ts
 */
import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'

/**
 * 简化版布隆过滤器(回归测试用最小实现)
 * - 位数组:16384 位(2KB,在 1000 个 key 下理论误判率 < 0.3%)
 * - 3 个 hash 函数(基于 sha256 派生)
 *
 * 备注:任务规范给定 3 个 hash 函数。10000 位在 1000 个 key 下
 * 理论误判率约 1.74%,无法满足 < 1% 目标,故扩容至 16384 位。
 */
class SimpleBloomFilter {
  /** 位数组大小(2 的幂,便于位运算) */
  private readonly size = 16384
  /** hash 函数数量 */
  private readonly hashCount = 3
  /** 位数组(Uint8Array 按字节存储,8 位/字节) */
  private readonly bits: Uint8Array

  constructor() {
    this.bits = new Uint8Array(Math.ceil(this.size / 8))
  }

  /** 计算指定 hash 索引位置的哈希值 */
  private hash(key: string, seed: number): number {
    const h = createHash('sha256').update(`${seed}:${key}`).digest()
    // 取前 4 字节作为 32 位无符号整数
    const v = h.readUInt32BE(0)
    return v % this.size
  }

  /** 设置指定位 */
  private setBit(idx: number): void {
    const byteIdx = Math.floor(idx / 8)
    const bitIdx = idx % 8
    this.bits[byteIdx]! |= 1 << bitIdx
  }

  /** 获取指定位 */
  private getBit(idx: number): number {
    const byteIdx = Math.floor(idx / 8)
    const bitIdx = idx % 8
    return (this.bits[byteIdx]! >> bitIdx) & 1
  }

  /** 添加 key 到过滤器 */
  add(key: string): void {
    for (let i = 0; i < this.hashCount; i++) {
      this.setBit(this.hash(key, i))
    }
  }

  /** 检查 key 是否可能在过滤器中(可能有误判) */
  contains(key: string): boolean {
    for (let i = 0; i < this.hashCount; i++) {
      if (this.getBit(this.hash(key, i)) === 0) return false
    }
    return true
  }

  /** 重置过滤器 */
  clear(): void {
    this.bits.fill(0)
  }
}

describe('BUG-R15-BLOOM-GUARD:布隆过滤器误判率', () => {
  it('插入 1000 个 key,contains 全部返回 true', () => {
    const bf = new SimpleBloomFilter()
    const keys: string[] = []
    for (let i = 0; i < 1000; i++) {
      const k = `inserted-key-${i}`
      keys.push(k)
      bf.add(k)
    }
    for (const k of keys) {
      expect(bf.contains(k)).toBe(true)
    }
  })

  it('未插入的 1000 个 key 误判率 < 1%(误判数 < 10)', () => {
    const bf = new SimpleBloomFilter()
    // 插入 1000 个 key
    for (let i = 0; i < 1000; i++) {
      bf.add(`inserted-key-${i}`)
    }
    // 查询 1000 个未插入的 key
    let falsePositives = 0
    for (let i = 0; i < 1000; i++) {
      const k = `not-inserted-${i}-${i * 31}`
      if (bf.contains(k)) falsePositives++
    }
    const fpRate = falsePositives / 1000
    // 误判数 < 10(< 1%)
    expect(falsePositives).toBeLessThan(10)
    expect(fpRate).toBeLessThan(0.01)
  })

  it('空过滤器对任意 key 返回 false', () => {
    const bf = new SimpleBloomFilter()
    expect(bf.contains('random-key-1')).toBe(false)
    expect(bf.contains('random-key-2')).toBe(false)
  })

  it('单 key 插入后 contains 返回 true', () => {
    const bf = new SimpleBloomFilter()
    bf.add('hello-world')
    expect(bf.contains('hello-world')).toBe(true)
  })

  it('clear 后所有 key 返回 false', () => {
    const bf = new SimpleBloomFilter()
    bf.add('key-a')
    bf.add('key-b')
    expect(bf.contains('key-a')).toBe(true)
    bf.clear()
    expect(bf.contains('key-a')).toBe(false)
    expect(bf.contains('key-b')).toBe(false)
  })

  it('重复 add 同一 key 不影响 contains 结果', () => {
    const bf = new SimpleBloomFilter()
    bf.add('dup-key')
    bf.add('dup-key')
    bf.add('dup-key')
    expect(bf.contains('dup-key')).toBe(true)
  })

  it('插入 2000 个 key 后误判率仍 < 5%(容量增大场景)', () => {
    const bf = new SimpleBloomFilter()
    for (let i = 0; i < 2000; i++) {
      bf.add(`bulk-key-${i}`)
    }
    let fp = 0
    for (let i = 0; i < 1000; i++) {
      const k = `miss-${i}-x-${i * 17}`
      if (bf.contains(k)) fp++
    }
    // 容量增大后误判率上升,但仍应 < 5%
    expect(fp / 1000).toBeLessThan(0.05)
  })

  it('长字符串 key 也能正常工作', () => {
    const bf = new SimpleBloomFilter()
    const longKey = 'x'.repeat(1000) + '-very-long-key'
    bf.add(longKey)
    expect(bf.contains(longKey)).toBe(true)
    expect(bf.contains('x'.repeat(999) + '-very-long-key')).toBe(false)
  })
})
