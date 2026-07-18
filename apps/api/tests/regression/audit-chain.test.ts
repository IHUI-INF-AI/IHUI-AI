/**
 * 回归测试:BUG-R13-AUDIT-CHAIN
 *
 * bugId: BUG-R13-AUDIT-CHAIN
 * 轮次: 13
 * 场景: 执行 5 次操作,验证审计日志连续无断点
 *       旧架构来源: server/tests/test_bug_fixes_round13.py
 *
 * 验证点:
 *  - 写入 5 条审计日志,sequence 连续 1-5
 *  - 中间缺失 sequence=3 时 detectGap 返回 true
 *  - 全连续时 detectGap 返回 false
 *
 * 运行: pnpm -F @ihui/api test -- tests/regression/audit-chain.test.ts
 */
import { describe, it, expect } from 'vitest'

/** 审计日志条目 */
interface AuditEntry {
  sequence: number
  userId: string
  action: string
  timestamp: number
}

/**
 * 审计日志链管理器
 * - record 写入日志并自增 sequence
 * - detectGap 检测 sequence 是否连续
 */
class AuditChain {
  private entries: AuditEntry[] = []
  private nextSeq = 1

  /** 写入一条审计日志 */
  record(userId: string, action: string): AuditEntry {
    const entry: AuditEntry = {
      sequence: this.nextSeq,
      userId,
      action,
      timestamp: Date.now(),
    }
    this.entries.push(entry)
    this.nextSeq += 1
    return entry
  }

  /** 获取所有日志条目(按 sequence 升序) */
  getAll(): AuditEntry[] {
    return [...this.entries].sort((a, b) => a.sequence - b.sequence)
  }

  /**
   * 检测 sequence 是否存在断点
   * - 连续从 1 开始 → false
   * - 缺失任意 sequence → true
   */
  detectGap(): boolean {
    if (this.entries.length === 0) return false
    const sorted = this.getAll()
    // 第一条必须为 1
    if (sorted[0]!.sequence !== 1) return true
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!.sequence
      const curr = sorted[i]!.sequence
      if (curr !== prev + 1) return true
    }
    return false
  }

  /**
   * 模拟断点:跳过指定数量的 sequence(用于测试 detectGap)
   * 例如 skipNext(1) 表示下一条 record 会跳过一个 sequence
   */
  skipNext(skipCount: number): void {
    if (skipCount > 0) this.nextSeq += skipCount
  }

  /** 清空日志(用于测试间重置) */
  reset(): void {
    this.entries = []
    this.nextSeq = 1
  }
}

describe('BUG-R13-AUDIT-CHAIN:审计日志链连续性', () => {
  it('写入 5 条日志后 sequence 连续 1-5', () => {
    const chain = new AuditChain()
    for (let i = 1; i <= 5; i++) {
      chain.record(`user-${i}`, `action-${i}`)
    }
    const entries = chain.getAll()
    expect(entries).toHaveLength(5)
    expect(entries.map((e) => e.sequence)).toEqual([1, 2, 3, 4, 5])
  })

  it('5 条连续日志 → detectGap 返回 false', () => {
    const chain = new AuditChain()
    for (let i = 1; i <= 5; i++) {
      chain.record('user-a', `action-${i}`)
    }
    expect(chain.detectGap()).toBe(false)
  })

  it('中间缺失 sequence=3 → detectGap 返回 true', () => {
    const chain = new AuditChain()
    chain.record('user-a', 'action-1') // seq=1
    chain.record('user-a', 'action-2') // seq=2
    chain.skipNext(1) // 跳过 seq=3
    chain.record('user-a', 'action-4') // seq=4
    chain.record('user-a', 'action-5') // seq=5
    expect(chain.detectGap()).toBe(true)
  })

  it('首条日志不是 sequence=1 → detectGap 返回 true', () => {
    const chain = new AuditChain()
    chain.skipNext(2) // 从 seq=3 开始
    chain.record('user-a', 'action-3')
    chain.record('user-a', 'action-4')
    expect(chain.detectGap()).toBe(true)
  })

  it('空审计链 → detectGap 返回 false(无断点)', () => {
    const chain = new AuditChain()
    expect(chain.detectGap()).toBe(false)
  })

  it('单条日志(seq=1) → detectGap 返回 false', () => {
    const chain = new AuditChain()
    chain.record('user-a', 'action-1')
    expect(chain.detectGap()).toBe(false)
  })

  it('末尾缺失(sequence 跳跃) → detectGap 返回 true', () => {
    const chain = new AuditChain()
    chain.record('user-a', 'action-1') // 1
    chain.record('user-a', 'action-2') // 2
    chain.record('user-a', 'action-3') // 3
    chain.skipNext(1) // 跳过 4
    chain.record('user-a', 'action-5') // 5
    expect(chain.detectGap()).toBe(true)
  })

  it('record 返回的条目包含完整字段', () => {
    const chain = new AuditChain()
    const entry = chain.record('user-x', 'login')
    expect(entry.sequence).toBe(1)
    expect(entry.userId).toBe('user-x')
    expect(entry.action).toBe('login')
    expect(typeof entry.timestamp).toBe('number')
    expect(entry.timestamp).toBeGreaterThan(0)
  })
})
