import { describe, expect, it } from 'vitest'
import { formatContextStats } from '../src/commands/repl.js'
import { estimateMessagesTokens } from '../src/context.js'

describe('formatContextStats', () => {
  it('空 history 返回"暂无对话历史"', () => {
    const out = formatContextStats([])
    expect(out).toContain('暂无对话历史')
  })

  it('单条消息计算 token 并显示消息数', () => {
    const history = [{ role: 'user', content: 'hello world' }]
    const out = formatContextStats(history)
    expect(out).toContain('消息数: 1')
    const expectedTokens = estimateMessagesTokens(
      history.map((m) => ({ role: m.role as 'system' | 'user' | 'assistant', content: m.content })),
    )
    expect(out).toContain(`Token 估算: ${expectedTokens} / 24000`)
  })

  it('多条消息累计 token', () => {
    const history = [
      { role: 'system', content: 'you are a helpful assistant' },
      { role: 'user', content: 'hello world' },
      { role: 'assistant', content: 'hi there' },
    ]
    const out = formatContextStats(history)
    expect(out).toContain('消息数: 3')
    const expectedTokens = estimateMessagesTokens(
      history.map((m) => ({ role: m.role as 'system' | 'user' | 'assistant', content: m.content })),
    )
    expect(out).toContain(`Token 估算: ${expectedTokens} / 24000`)
  })

  it('占用百分比 < 50% 时显示绿色 bar', () => {
    const history = [{ role: 'user', content: 'hi' }]
    const maxTokens = 20
    const out = formatContextStats(history, { maxTokens })
    const tokens = estimateMessagesTokens(
      history.map((m) => ({ role: m.role as 'system' | 'user' | 'assistant', content: m.content })),
    )
    const pct = (tokens / maxTokens) * 100
    expect(pct).toBeLessThan(50)
    expect(pct).toBeGreaterThanOrEqual(5)
    expect(out).toContain('%')
    expect(out).toContain('░')
    expect(out).toContain('█')
  })

  it('占用百分比 > 85% 时显示红色 bar(接近压缩阈值)', () => {
    const longContent = 'A'.repeat(1000)
    const history = [
      { role: 'system', content: 'sys' },
      ...Array.from({ length: 100 }, (_, i) => ({
        role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
        content: longContent + `_${i}`,
      })),
    ]
    const maxTokens = 15_000
    const out = formatContextStats(history, { maxTokens })
    const tokens = estimateMessagesTokens(
      history.map((m) => ({ role: m.role as 'system' | 'user' | 'assistant', content: m.content })),
    )
    const pct = (tokens / maxTokens) * 100
    expect(pct).toBeGreaterThan(85)
    expect(out).toContain('%')
    expect(out).toContain(`压缩阈值: ${maxTokens}`)
  })

  it('包含 Plan Mode 状态(off)', () => {
    const history = [{ role: 'user', content: 'hello' }]
    const out = formatContextStats(history, { planFirst: false })
    expect(out).toContain('附加状态')
    expect(out).toContain('Plan Mode: off')
  })

  it('包含 Plan Mode 状态(on pending)', () => {
    const history = [{ role: 'user', content: 'hello' }]
    const out = formatContextStats(history, { planFirst: true, planApproved: false })
    expect(out).toContain('Plan Mode: on (pending)')
  })

  it('包含 Plan Mode 状态(on approved)', () => {
    const history = [{ role: 'user', content: 'hello' }]
    const out = formatContextStats(history, { planFirst: true, planApproved: true })
    expect(out).toContain('Plan Mode: on (approved)')
  })

  it('包含 skills 和 memory 数量', () => {
    const history = [{ role: 'user', content: 'hello' }]
    const out = formatContextStats(history, {
      planFirst: false,
      skills: 3,
      memoryCount: 5,
    })
    expect(out).toContain('Skills: 3 个')
    expect(out).toContain('Memory: 5 条')
  })

  it('未传 opts 时不显示附加状态', () => {
    const history = [{ role: 'user', content: 'hello' }]
    const out = formatContextStats(history)
    expect(out).not.toContain('附加状态')
    expect(out).not.toContain('Plan Mode')
  })

  it('自定义 maxTokens 影响百分比', () => {
    const history = [{ role: 'user', content: 'hello world this is a test' }]
    const out = formatContextStats(history, { maxTokens: 100 })
    expect(out).toContain('/ 100')
    expect(out).toContain('压缩阈值: 100')
  })
})
