// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 微信智联分析基线：没配模型也必须给出可用的本地结果。
 *
 * 钉住四件事：
 *  1. 统计/参与者/待办/风险从消息本身算出来，不依赖外部服务；
 *  2. 关键词与关系图不是空壳；
 *  3. inputHash 对同一消息集稳定、对消息集变化敏感（缓存键不能误命中）；
 *  4. 未配置 WECHAT_HUB_LLM_URL 时 generatedBy 必须是 local。
 */
import { afterEach, describe, expect, it } from 'vitest'
import type { WechatMessageView } from '@ihui/types'
import { analyzeMessages, hashAnalysisInput } from '../wechat-hub/analysis'

const ORIGINAL_ENV = {
  url: process.env.WECHAT_HUB_LLM_URL,
  key: process.env.WECHAT_HUB_LLM_KEY,
  model: process.env.WECHAT_HUB_LLM_MODEL,
}

afterEach(() => {
  if (ORIGINAL_ENV.url === undefined) delete process.env.WECHAT_HUB_LLM_URL
  else process.env.WECHAT_HUB_LLM_URL = ORIGINAL_ENV.url
  if (ORIGINAL_ENV.key === undefined) delete process.env.WECHAT_HUB_LLM_KEY
  else process.env.WECHAT_HUB_LLM_KEY = ORIGINAL_ENV.key
  if (ORIGINAL_ENV.model === undefined) delete process.env.WECHAT_HUB_LLM_MODEL
  else process.env.WECHAT_HUB_LLM_MODEL = ORIGINAL_ENV.model
})

function message(
  id: string,
  senderName: string,
  content: string,
  minutes: number,
): WechatMessageView {
  return {
    id,
    accountId: 'acc',
    conversationId: 'conv',
    direction: 'inbound',
    kind: 'text',
    content,
    mediaUrl: null,
    senderId: `wxid-${senderName}`,
    senderName,
    platformMessageId: `pm-${id}`,
    sentAt: new Date(Date.UTC(2026, 10, 23, 1, minutes)).toISOString(),
    createdAt: new Date(Date.UTC(2026, 10, 23, 1, minutes)).toISOString(),
    rawPayload: {},
  }
}

const MESSAGES: WechatMessageView[] = [
  message('m1', '张三', '明天上午把方案发我，记得截止时间是十点', 1),
  message('m2', '李四', '收到，我马上安排。客户投诉的退款问题需要今天处理', 2),
  message('m3', '张三', '好的，退款流程请协助确认一下', 3),
  message('m4', '王五', '下周巡店安排已经发群里了', 4),
]

describe('wechat hub analysis', () => {
  it('在没有模型配置时给出完整本地结果', async () => {
    delete process.env.WECHAT_HUB_LLM_URL
    delete process.env.WECHAT_HUB_LLM_KEY
    const run = await analyzeMessages('summary', '运营群', MESSAGES)
    expect(run.result.generatedBy).toBe('local')
    expect(run.result.stats.messageCount).toBe(4)
    expect(run.result.stats.participantCount).toBe(3)
    expect(run.result.summary.length).toBeGreaterThan(0)
    expect(run.result.participants.map((item) => item.name)).toEqual(
      expect.arrayContaining(['张三', '李四', '王五']),
    )
    expect(run.result.todos.length).toBeGreaterThan(0)
    expect(run.result.risks.length).toBeGreaterThan(0)
    expect(run.result.keywords.length).toBeGreaterThan(0)
    const relations = await analyzeMessages('relations', '运营群', MESSAGES)
    expect(relations.result.relations?.length).toBeGreaterThan(0)
  })

  it('todo 与风险按规则落项，而不是只给一段摘要', async () => {
    delete process.env.WECHAT_HUB_LLM_URL
    const run = await analyzeMessages('todos', null, MESSAGES)
    const todoText = run.result.todos.map((item) => item.text).join(' ')
    expect(todoText).toContain('截止')
    expect(run.result.risks.join(' ')).toContain('投诉')
    expect(run.result.stats.startAt).not.toBeNull()
    expect(run.result.stats.endAt).not.toBeNull()
  })

  it('占位语音（[语音]）不进关键词语料，但仍算一条消息', async () => {
    delete process.env.WECHAT_HUB_LLM_URL
    const withVoice: WechatMessageView[] = [
      ...MESSAGES,
      { ...message('m5', '张三', '[语音]', 5), kind: 'voice' },
      { ...message('m6', '李四', '[语音]', 6), kind: 'voice' },
    ]
    const run = await analyzeMessages('summary', '运营群', withVoice)
    // 消息条数照算：语音也是会话里发生过的事。
    expect(run.result.stats.messageCount).toBe(6)
    // 但没有任何一段真实文本来自占位词，所以「语音」不该成为关键词。
    expect(run.result.keywords.map((item) => item.word)).not.toContain('语音')
    expect(run.result.keywords.map((item) => item.word)).not.toContain('[语音]')
  })

  it('inputHash 对同一集合稳定、对集合变化敏感', () => {
    const ids = MESSAGES.map((item) => item.id)
    const first = hashAnalysisInput('summary', 'conv', ids)
    const second = hashAnalysisInput('summary', 'conv', ids)
    expect(first).toBe(second)
    expect(first).toHaveLength(64)
    expect(hashAnalysisInput('summary', 'conv', ids.slice(0, 3))).not.toBe(first)
    expect(hashAnalysisInput('daily', 'conv', ids)).not.toBe(first)
    expect(hashAnalysisInput('summary', null, ids)).not.toBe(first)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
