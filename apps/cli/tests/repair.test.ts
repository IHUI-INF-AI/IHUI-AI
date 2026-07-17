import { describe, expect, it } from 'vitest'
import {
  repairSessionHistory,
  tryRecoverSessionFromCorruptedJson,
  type ChatMessage,
  type Session,
} from '../src/commands/session.js'

describe('P1-1 repairSessionHistory 会话历史自愈', () => {
  describe('Rule 1: 过滤非法 role(只保留 system/user/assistant)', () => {
    it('移除 unknown role', () => {
      const history: ChatMessage[] = [
        { role: 'system', content: 'sys' },
        { role: 'unknown', content: 'should be removed' },
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'hello' },
      ]
      const { repaired, removed, reasons } = repairSessionHistory(history)
      expect(repaired).toHaveLength(3)
      expect(repaired.map((m) => m.role)).toEqual(['system', 'user', 'assistant'])
      expect(removed).toBe(1)
      expect(reasons.some((r) => r.includes('非法 role'))).toBe(true)
    })

    it('移除 tool role(部分协议残留)', () => {
      const history: ChatMessage[] = [
        { role: 'user', content: 'q' },
        { role: 'tool', content: 'tool result' },
        { role: 'assistant', content: 'a' },
      ]
      const { repaired, removed } = repairSessionHistory(history)
      expect(repaired).toHaveLength(2)
      expect(removed).toBe(1)
    })

    it('移除 function role', () => {
      const history: ChatMessage[] = [
        { role: 'user', content: 'q' },
        { role: 'function', content: 'fn result' },
        { role: 'assistant', content: 'a' },
      ]
      const { repaired, removed } = repairSessionHistory(history)
      expect(repaired).toHaveLength(2)
      expect(removed).toBe(1)
    })
  })

  describe('Rule 2: 过滤空 content', () => {
    it('移除空字符串 content', () => {
      const history: ChatMessage[] = [
        { role: 'user', content: '' },
        { role: 'assistant', content: 'a' },
      ]
      const { repaired, removed } = repairSessionHistory(history)
      // user 被移除后,只剩 assistant → Rule 4 也会移除开头的 assistant
      expect(removed).toBeGreaterThanOrEqual(1)
      // 验证最终 history 不含空 content
      expect(repaired.every((m) => m.content.length > 0)).toBe(true)
    })

    it('移除纯空白 content(只有空格/制表符/换行)', () => {
      const history: ChatMessage[] = [
        { role: 'user', content: '   \n\t  ' },
        { role: 'assistant', content: 'a' },
      ]
      const { repaired, removed } = repairSessionHistory(history)
      expect(removed).toBeGreaterThanOrEqual(1)
      expect(repaired.every((m) => m.content.trim().length > 0)).toBe(true)
    })

    it('保留非空 content', () => {
      const history: ChatMessage[] = [
        { role: 'user', content: 'q' },
        { role: 'assistant', content: 'a' },
      ]
      const { repaired, removed } = repairSessionHistory(history)
      expect(repaired).toHaveLength(2)
      expect(removed).toBe(0)
    })
  })

  describe('Rule 3: 去重连续相同 role(合并 content)', () => {
    it('合并连续 user 消息', () => {
      const history: ChatMessage[] = [
        { role: 'user', content: 'q1' },
        { role: 'user', content: 'q2' },
        { role: 'assistant', content: 'a' },
      ]
      const { repaired, reasons } = repairSessionHistory(history)
      expect(repaired).toHaveLength(2)
      expect(repaired[0]!.role).toBe('user')
      expect(repaired[0]!.content).toBe('q1\n\nq2')
      expect(reasons.some((r) => r.includes('合并连续'))).toBe(true)
    })

    it('合并连续 assistant 消息', () => {
      const history: ChatMessage[] = [
        { role: 'user', content: 'q' },
        { role: 'assistant', content: 'a1' },
        { role: 'assistant', content: 'a2' },
        { role: 'assistant', content: 'a3' },
      ]
      const { repaired } = repairSessionHistory(history)
      expect(repaired).toHaveLength(2)
      expect(repaired[1]!.content).toBe('a1\n\na2\n\na3')
    })

    it('不合并非连续相同 role', () => {
      const history: ChatMessage[] = [
        { role: 'user', content: 'q1' },
        { role: 'assistant', content: 'a1' },
        { role: 'user', content: 'q2' },
        { role: 'assistant', content: 'a2' },
      ]
      const { repaired } = repairSessionHistory(history)
      expect(repaired).toHaveLength(4)
    })

    it('合并后的 content 用 \\n\\n 连接', () => {
      const history: ChatMessage[] = [
        { role: 'user', content: 'A' },
        { role: 'user', content: 'B' },
        { role: 'user', content: 'C' },
      ]
      const { repaired } = repairSessionHistory(history)
      // Rule 5 会移除末尾无 assistant 响应的 user(interjection 残留),但这里前面没有 assistant,所以保留
      // 实际上前面没有 assistant 时 Rule 5 不会移除
      expect(repaired).toHaveLength(1)
      expect(repaired[0]!.content).toBe('A\n\nB\n\nC')
    })
  })

  describe('Rule 4: 确保首条是 system 或 user(丢弃开头的 assistant)', () => {
    it('移除开头的 assistant 消息', () => {
      const history: ChatMessage[] = [
        { role: 'assistant', content: 'stale response' },
        { role: 'user', content: 'q' },
        { role: 'assistant', content: 'a' },
      ]
      const { repaired, removed, reasons } = repairSessionHistory(history)
      expect(repaired).toHaveLength(2)
      expect(repaired[0]!.role).toBe('user')
      expect(removed).toBe(1)
      expect(reasons.some((r) => r.includes('开头的 assistant'))).toBe(true)
    })

    it('移除多个开头的 assistant 消息', () => {
      const history: ChatMessage[] = [
        { role: 'assistant', content: 'a1' },
        { role: 'assistant', content: 'a2' },
        { role: 'user', content: 'q' },
      ]
      const { repaired, removed } = repairSessionHistory(history)
      // a1+a2 先被 Rule 3 合并为一条,然后 Rule 4 移除开头的 assistant
      expect(repaired).toHaveLength(1)
      expect(repaired[0]!.role).toBe('user')
      expect(removed).toBeGreaterThanOrEqual(1)
    })

    it('保留开头的 system 消息', () => {
      const history: ChatMessage[] = [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'q' },
        { role: 'assistant', content: 'a' },
      ]
      const { repaired, removed } = repairSessionHistory(history)
      expect(repaired).toHaveLength(3)
      expect(repaired[0]!.role).toBe('system')
      expect(removed).toBe(0)
    })

    it('保留开头的 user 消息', () => {
      const history: ChatMessage[] = [
        { role: 'user', content: 'q' },
        { role: 'assistant', content: 'a' },
      ]
      const { repaired, removed } = repairSessionHistory(history)
      expect(repaired).toHaveLength(2)
      expect(removed).toBe(0)
    })
  })

  describe('Rule 5: 移除末尾无响应的 user 消息(interjection 残留)', () => {
    it('移除末尾无 assistant 响应的 user(前面有 assistant)', () => {
      const history: ChatMessage[] = [
        { role: 'user', content: 'q' },
        { role: 'assistant', content: 'a' },
        { role: 'user', content: 'interjection 残留' },
      ]
      const { repaired, removed, reasons } = repairSessionHistory(history)
      expect(repaired).toHaveLength(2)
      expect(repaired[repaired.length - 1]!.role).toBe('assistant')
      expect(removed).toBe(1)
      expect(reasons.some((r) => r.includes('interjection 残留') || r.includes('末尾无 assistant'))).toBe(true)
    })

    it('不移除首轮 user(前面无 assistant)', () => {
      const history: ChatMessage[] = [
        { role: 'user', content: 'q' },
      ]
      const { repaired, removed } = repairSessionHistory(history)
      expect(repaired).toHaveLength(1)
      expect(removed).toBe(0)
    })

    it('移除多个末尾 user(只保留到最后的 assistant)', () => {
      const history: ChatMessage[] = [
        { role: 'user', content: 'q1' },
        { role: 'assistant', content: 'a1' },
        { role: 'user', content: 'q2' },
        { role: 'user', content: 'q3' },
      ]
      const { repaired } = repairSessionHistory(history)
      // Rule 3 先合并 q2+q3,Rule 5 再移除末尾合并后的 user
      expect(repaired).toHaveLength(2)
      expect(repaired[repaired.length - 1]!.role).toBe('assistant')
    })
  })

  describe('组合场景', () => {
    it('空 history 返回空', () => {
      const { repaired, removed } = repairSessionHistory([])
      expect(repaired).toEqual([])
      expect(removed).toBe(0)
    })

    it('复杂混合损坏 history 完整修复', () => {
      const history: ChatMessage[] = [
        { role: 'assistant', content: 'stale' },            // Rule 4: 移除开头 assistant
        { role: 'unknown', content: 'bad role' },           // Rule 1: 移除非法 role
        { role: 'user', content: '' },                       // Rule 2: 移除空 content
        { role: 'user', content: 'q1' },                    // 保留
        { role: 'user', content: 'q2' },                    // Rule 3: 合并到 q1
        { role: 'tool', content: 'tool residue' },          // Rule 1: 移除
        { role: 'assistant', content: 'a1' },               // 保留
        { role: 'assistant', content: 'a2' },               // Rule 3: 合并到 a1
        { role: 'user', content: 'interjection 残留' },     // Rule 5: 移除末尾 user
      ]
      const { repaired, removed } = repairSessionHistory(history)
      expect(removed).toBeGreaterThanOrEqual(4)
      expect(repaired[0]!.role).toBe('user')
      expect(repaired[0]!.content).toBe('q1\n\nq2')
      expect(repaired[1]!.role).toBe('assistant')
      expect(repaired[1]!.content).toBe('a1\n\na2')
      expect(repaired).toHaveLength(2)
    })

    it('不修改原始 history 数组(返回新数组)', () => {
      const original: ChatMessage[] = [
        { role: 'user', content: 'q' },
        { role: 'user', content: 'q2' },
        { role: 'assistant', content: 'a' },
      ]
      const originalCopy = JSON.parse(JSON.stringify(original))
      repairSessionHistory(original)
      expect(original).toEqual(originalCopy)
    })

    it('不修改原消息对象(返回深拷贝)', () => {
      const msg1: ChatMessage = { role: 'user', content: 'q1' }
      const msg2: ChatMessage = { role: 'user', content: 'q2' }
      const { repaired } = repairSessionHistory([msg1, msg2])
      // 合并后 repaired[0].content = 'q1\n\nq2',但原 msg1.content 应仍是 'q1'
      expect(msg1.content).toBe('q1')
      expect(msg2.content).toBe('q2')
      expect(repaired[0]!.content).toBe('q1\n\nq2')
    })
  })
})

describe('P1-1 tryRecoverSessionFromCorruptedJson 损坏 JSON 恢复', () => {
  it('完整 JSON 正常 parse', () => {
    const session: Session = {
      id: 'sess_test_1',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      workspacePath: '/tmp',
      modelId: 'test-model',
      history: [
        { role: 'user', content: 'q' },
        { role: 'assistant', content: 'a' },
      ],
    }
    const raw = JSON.stringify(session, null, 2)
    const recovered = tryRecoverSessionFromCorruptedJson(raw)
    expect(recovered).not.toBeNull()
    expect(recovered!.id).toBe('sess_test_1')
    expect(recovered!.history).toHaveLength(2)
  })

  it('截断的 JSON 从最后一个 } 恢复', () => {
    const session: Session = {
      id: 'sess_test_2',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      workspacePath: '/tmp',
      modelId: 'test-model',
      history: [
        { role: 'user', content: 'q' },
        { role: 'assistant', content: 'a' },
      ],
    }
    const full = JSON.stringify(session, null, 2)
    // 模拟写入中途被截断(末尾不完整)
    const truncated = full.slice(0, full.length - 20) + '\n  // 截断的尾巴'
    const recovered = tryRecoverSessionFromCorruptedJson(truncated)
    expect(recovered).not.toBeNull()
    expect(recovered!.id).toBe('sess_test_2')
  })

  it('无 } 的内容返回 null', () => {
    const recovered = tryRecoverSessionFromCorruptedJson('not a json at all')
    expect(recovered).toBeNull()
  })

  it('parse 成功但缺 id 返回 null', () => {
    const malformed = '{"history":[]}'  // 缺 id 字段
    const recovered = tryRecoverSessionFromCorruptedJson(malformed)
    expect(recovered).toBeNull()
  })

  it('parse 成功但 history 不是数组返回 null', () => {
    const malformed = '{"id":"sess_x","history":"not array"}'
    const recovered = tryRecoverSessionFromCorruptedJson(malformed)
    expect(recovered).toBeNull()
  })

  it('恢复后的 history 经过 repairSessionHistory 清理', () => {
    const session: Session = {
      id: 'sess_test_3',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      workspacePath: '/tmp',
      modelId: 'test-model',
      history: [
        { role: 'user', content: 'q' },
        { role: 'assistant', content: 'a' },
        { role: 'unknown', content: 'bad role' },  // 应被 repair 移除
        { role: 'user', content: 'interjection 残留' },  // 应被 Rule 5 移除
      ],
    }
    const raw = JSON.stringify(session, null, 2)
    const recovered = tryRecoverSessionFromCorruptedJson(raw)
    expect(recovered).not.toBeNull()
    expect(recovered!.history).toHaveLength(2)
    expect(recovered!.history.every((m) => ['system', 'user', 'assistant'].includes(m.role))).toBe(true)
  })
})
