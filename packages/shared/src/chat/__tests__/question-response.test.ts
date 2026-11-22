// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import {
  interpretQuestionResponse,
  buildLegacyAnswerText,
  questionResponsePath,
  type QuestionAnswerPayload,
} from '../question-response'

describe('interpretQuestionResponse / 响应形状处置', () => {
  it('404 → legacy(这不是阻塞式提问,回退旧链路)', () => {
    expect(interpretQuestionResponse(404, undefined)).toEqual({ kind: 'legacy' })
    expect(interpretQuestionResponse(404, { accepted: true })).toEqual({ kind: 'legacy' })
  })

  it('accepted=true → blocking/answered(duplicate=false)', () => {
    expect(interpretQuestionResponse(200, { accepted: true, status: 'answered' })).toEqual({
      kind: 'blocking',
      status: 'answered',
      duplicate: false,
    })
    // status 缺省兜底 answered
    expect(interpretQuestionResponse(200, { accepted: true })).toEqual({
      kind: 'blocking',
      status: 'answered',
      duplicate: false,
    })
  })

  it('duplicate=true 优先:幂等副本绝不再发新一轮', () => {
    expect(
      interpretQuestionResponse(200, { accepted: false, duplicate: true, status: 'answered' }),
    ).toEqual({
      kind: 'blocking',
      status: 'answered',
      duplicate: true,
    })
  })

  it('accepted=false 但带终态(timeout/withdrawn)→ blocking,不发起新一轮', () => {
    expect(interpretQuestionResponse(200, { accepted: false, status: 'timeout' })).toEqual({
      kind: 'blocking',
      status: 'timeout',
      duplicate: false,
    })
    expect(interpretQuestionResponse(200, { accepted: false, status: 'withdrawn' })).toEqual({
      kind: 'blocking',
      status: 'withdrawn',
      duplicate: false,
    })
  })

  it('200 但无 accepted/无终态 → legacy(旧服务端形状)', () => {
    expect(interpretQuestionResponse(200, {})).toEqual({ kind: 'legacy' })
    expect(interpretQuestionResponse(200, undefined)).toEqual({ kind: 'legacy' })
    // interrupted 不在终态集合,不认
    expect(interpretQuestionResponse(200, { accepted: false, status: 'interrupted' })).toEqual({
      kind: 'legacy',
    })
  })

  it('网络失败(status 缺省)→ failed;defined 非终态 status 走 legacy(5xx 在编排层判 failed)', () => {
    expect(interpretQuestionResponse(undefined, undefined)).toEqual({
      kind: 'failed',
      message: 'network error',
    })
    // 5xx 带 defined status:纯判据不认它为终态,编排层(postQuestionResponse 的 !success 分支)判 failed
    expect(interpretQuestionResponse(500, { accepted: false })).toEqual({ kind: 'legacy' })
  })
})

describe('buildLegacyAnswerText / 旧链路答复文本', () => {
  const question = {
    options: [
      { id: 'a', label: '选项 A' },
      { id: 'b', label: '选项 B' },
      { id: 'c', label: '选项 C' },
    ],
  }

  it('撤回 → 空文本(不产用户消息)', () => {
    const r: QuestionAnswerPayload = {
      questionId: 'q',
      action: 'withdraw',
      selectedOptionIds: [],
    }
    expect(buildLegacyAnswerText(question, r)).toBe('')
  })

  it('单选 + 自由输入 → label 与自定义逗号合并(按 id 顺序)', () => {
    const r: QuestionAnswerPayload = {
      questionId: 'q',
      action: 'answer',
      selectedOptionIds: ['b'],
      customText: ' 我的补充 ',
    }
    expect(buildLegacyAnswerText(question, r)).toBe('选项 B, 我的补充')
  })

  it('多选按 options 定义顺序(非选择顺序)拼', () => {
    const r: QuestionAnswerPayload = {
      questionId: 'q',
      action: 'answer',
      selectedOptionIds: ['c', 'a'],
    }
    expect(buildLegacyAnswerText(question, r)).toBe('选项 A, 选项 C')
  })

  it('空选项 + 空自定义 → 空串(filter Boolean 兜底)', () => {
    const r: QuestionAnswerPayload = {
      questionId: 'q',
      action: 'answer',
      selectedOptionIds: [],
      customText: '   ',
    }
    expect(buildLegacyAnswerText(question, r)).toBe('')
  })
})

describe('questionResponsePath / 端点路径', () => {
  it('拼出阻塞式答复端点,sessionId 走 encodeURIComponent', () => {
    expect(questionResponsePath('s-1')).toBe('/llm/complete/stream/s-1/question-response')
    expect(questionResponsePath('a/b c')).toBe('/llm/complete/stream/a%2Fb%20c/question-response')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
