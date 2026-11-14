// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AI 主动提问 · 上行答复判据锁(2026-11-13 立,随共享层下沉同批)。
 *
 * 这套判据原本只在 web 端有一份;extension / cli / miniapp-taro / mobile-rn 要接同一件事
 * 时必须各抄一份 —— 与 `ahead` 那次同型(两侧各自绿、漂移无人发现)。下沉到共享层的同批
 * 就用这把锁钉住,防它再被端内复制或被"顺手简化"。
 *
 * 三条判据逐条对应服务端真实行为,不是约定俗成:
 *  ① 404 ⇒ legacy(旧服务端没有阻塞式端点 ⇒ 必须回退旧链路)
 *  ② duplicate 优先于 accepted(同一问第二发被幂等吃掉 ⇒ 绝不能再发起新一轮)
 *  ③ accepted=false 但带终态 timeout/withdrawn ⇒ 同样 blocking(这一问已有结论)
 */
import { describe, expect, it } from 'vitest'

import {
  buildLegacyAnswerText,
  buildQuestionResponseBody,
  interpretQuestionResponse,
  isTerminalQuestionStatus,
  questionResponsePath,
  QUESTION_RESPONSE_TERMINAL_STATUSES,
  type QuestionAnswerPayload,
} from '../question-response'

describe('判据①:404 ⇒ legacy(回退旧链路)', () => {
  it('HTTP 404 无论 body 是什么都判 legacy', () => {
    expect(interpretQuestionResponse(404, { accepted: true }).kind).toBe('legacy')
    expect(interpretQuestionResponse(404, null).kind).toBe('legacy')
    expect(interpretQuestionResponse(404, undefined).kind).toBe('legacy')
  })

  it('httpStatus 缺省(网络层没拿到状态码)⇒ 不得判 blocking', () => {
    // 缺状态码说明连响应都没拿到。判 blocking 会"假装服务端收下了";
    // 这里只钉住下限:绝不 blocking。究竟是 legacy 还是 failed 由调用方
    // 依据自身网络层语义决定(本模块不假设 —— 见下方备注)。
    expect(interpretQuestionResponse(undefined, {}).kind).not.toBe('blocking')
  })
})

describe('判据②:duplicate 优先于 accepted', () => {
  it('duplicate=true 且 accepted=true ⇒ blocking 且 duplicate 标记为真', () => {
    const r = interpretQuestionResponse(200, { accepted: true, duplicate: true })
    expect(r.kind).toBe('blocking')
    if (r.kind === 'blocking') {
      expect(r.duplicate).toBe(true)
      expect(r.status).toBe('answered')
    }
  })

  it('duplicate=true 且 accepted 缺席 ⇒ 仍判 blocking(幂等副本也是认下)', () => {
    const r = interpretQuestionResponse(200, { duplicate: true })
    expect(r.kind).toBe('blocking')
    if (r.kind === 'blocking') expect(r.duplicate).toBe(true)
  })

  it('duplicate 带终态时以该终态为准', () => {
    const r = interpretQuestionResponse(200, { duplicate: true, status: 'withdrawn' })
    expect(r.kind).toBe('blocking')
    if (r.kind === 'blocking') expect(r.status).toBe('withdrawn')
  })
})

describe('判据③:accepted=false 但带终态 ⇒ 同样 blocking', () => {
  it('status=timeout ⇒ blocking(这一问已超时,不得再发起新一轮)', () => {
    const r = interpretQuestionResponse(200, { accepted: false, status: 'timeout' })
    expect(r.kind).toBe('blocking')
    if (r.kind === 'blocking') expect(r.status).toBe('timeout')
  })

  it('status=withdrawn ⇒ blocking', () => {
    const r = interpretQuestionResponse(200, { accepted: false, status: 'withdrawn' })
    expect(r.kind).toBe('blocking')
    if (r.kind === 'blocking') expect(r.status).toBe('withdrawn')
  })

  it('accepted=false 且无终态 ⇒ legacy(退回旧链路)', () => {
    expect(interpretQuestionResponse(200, { accepted: false }).kind).toBe('legacy')
    expect(interpretQuestionResponse(200, {}).kind).toBe('legacy')
  })
})

describe('响应形状防御(不假设服务端状态)', () => {
  it('body 非对象(null / 字符串 / 数字)⇒ legacy,不抛错', () => {
    for (const bad of [null, 'x', 3, undefined]) {
      expect(() => interpretQuestionResponse(200, bad)).not.toThrow()
      expect(interpretQuestionResponse(200, bad).kind).toBe('legacy')
    }
  })

  it('accepted 非布尔真值(如字符串 "true")不得被读成已接受', () => {
    // 服务端契约是 boolean;把它当 truthy 会让一次形状错误伪造"服务端收下了"
    expect(interpretQuestionResponse(200, { accepted: 'true' }).kind).toBe('legacy')
  })

  it('表外 status 不得被读成终态', () => {
    expect(isTerminalQuestionStatus('answered')).toBe(true)
    expect(isTerminalQuestionStatus('bogus')).toBe(false)
    expect(isTerminalQuestionStatus(undefined)).toBe(false)
    expect(QUESTION_RESPONSE_TERMINAL_STATUSES).toHaveLength(3)
  })
})

describe('端点路径与请求体(字段名不漂移)', () => {
  it('路径与 ai-service 路由逐字对齐', () => {
    expect(questionResponsePath('s-1')).toBe('/llm/complete/stream/s-1/question-response')
  })

  it('sessionId 必须编码(含斜杠时不得破坏路径)', () => {
    expect(questionResponsePath('a/b')).toBe('/llm/complete/stream/a%2Fb/question-response')
  })

  it('请求体键名为 questionId / action / selectedOptionIds,customText 按需带', () => {
    const payload: QuestionAnswerPayload = {
      questionId: 'q-1',
      action: 'answer',
      selectedOptionIds: ['o1', 'o2'],
    }
    expect(buildQuestionResponseBody(payload)).toEqual({
      questionId: 'q-1',
      action: 'answer',
      selectedOptionIds: ['o1', 'o2'],
    })
    // 空串 customText 不得带(避免服务端把空串当"用户输入了空")
    expect(buildQuestionResponseBody({ ...payload, customText: '' })).not.toHaveProperty('customText')
    expect(buildQuestionResponseBody({ ...payload, customText: 'hi' })).toHaveProperty('customText', 'hi')
  })
})

describe('旧链路答复文本', () => {
  const options = [
    { id: 'a', label: '选项A' },
    { id: 'b', label: '选项B' },
  ]

  it('按选项顺序拼 label(不按 selectedOptionIds 顺序)', () => {
    const t = buildLegacyAnswerText(options, {
      questionId: 'q',
      action: 'answer',
      selectedOptionIds: ['b', 'a'],
    })
    expect(t).toBe('选项A, 选项B')
  })

  it('自定义文本追加在末尾', () => {
    const t = buildLegacyAnswerText(options, {
      questionId: 'q',
      action: 'answer',
      selectedOptionIds: ['a'],
      customText: '补充',
    })
    expect(t).toBe('选项A, 补充')
  })

  it('撤回 ⇒ 空串(调用方据此不发消息)', () => {
    expect(
      buildLegacyAnswerText(options, { questionId: 'q', action: 'withdraw', selectedOptionIds: [] }),
    ).toBe('')
  })

  it('空白 customText 不得拼出前后逗号', () => {
    expect(
      buildLegacyAnswerText(options, {
        questionId: 'q',
        action: 'answer',
        selectedOptionIds: ['a'],
        customText: '   ',
      }),
    ).toBe('选项A')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
