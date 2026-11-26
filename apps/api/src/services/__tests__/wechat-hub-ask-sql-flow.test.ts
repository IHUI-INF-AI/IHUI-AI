// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ask-sql 的流程测试：证明「模型写坏了也不会把库里东西弄坏」，
 * 以及「模型写对了，答案里的数字确实来自查询结果而不是模型嘴」。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const executeMock = vi.fn()
const askMessagesMock = vi.fn()
const fetchMock = vi.fn()

vi.mock('../../db/index.js', () => ({ dbRead: { execute: executeMock } }))
vi.mock('../wechat-hub/guards.js', () => ({ assertAccountForUser: async () => ({ id: 'acc' }) }))
vi.mock('../wechat-hub/ask.js', () => ({ askMessages: askMessagesMock }))
vi.mock('../../utils/ai-service-fetch.js', () => ({ aiServiceSystemFetch: fetchMock }))

const ACCOUNT = '0f9c2a7e-1111-4c22-9d33-abcdefabcdef'

function modelAnswers(content: string) {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ choices: [{ message: { content } }] }),
  })
}

describe('askWithSql', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    askMessagesMock.mockResolvedValue({
      answer: '回落答案',
      citations: [],
      plan: { keywords: [] },
      generatedBy: 'local',
    })
  })

  it('模型写了写操作 → 不执行，回落关键词检索并说明原因', async () => {
    modelAnswers('delete from m')
    const { askWithSql } = await import('../wechat-hub/ask-sql')
    const result = await askWithSql('user-1', ACCOUNT, '把上周的记录删了')
    expect(executeMock).not.toHaveBeenCalled()
    expect(result.generatedBy).toBe('local')
    expect(result.answer).toBe('回落答案')
    expect(result.note).toContain('未通过安全校验')
    expect(askMessagesMock).toHaveBeenCalledOnce()
  })

  it('模型写对了 → 执行一次，答案直接取自结果行', async () => {
    modelAnswers('select count(*) as cnt from m')
    executeMock.mockResolvedValue([{ cnt: '37' }])
    const { askWithSql } = await import('../wechat-hub/ask-sql')
    const result = await askWithSql('user-1', ACCOUNT, '一共多少条消息')
    expect(executeMock).toHaveBeenCalledOnce()
    expect(result.answer).toBe('结果：37')
    expect(result.rowCount).toBe(1)
    expect(result.sql).toBe('select count(*) as cnt from m')
    expect(result.note).toBeNull()
    expect(askMessagesMock).not.toHaveBeenCalled()
  })

  it('查询报错 → 不抛 500，回落并说明', async () => {
    modelAnswers('select count(*) from m')
    executeMock.mockRejectedValue(new Error('boom'))
    const { askWithSql } = await import('../wechat-hub/ask-sql')
    const result = await askWithSql('user-1', ACCOUNT, '一共多少条')
    expect(result.answer).toBe('回落答案')
    expect(result.note).toBe('查询执行失败，已改用关键词检索')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
