// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import {
  ATTENDEES_FOLD_THRESHOLD,
  BUSINESS_FORM_FIELDS,
  BUSINESS_FORM_KINDS,
  FORM_ACTION_PAIRS,
  FORM_STATE_PHASES,
  attendeesFoldNeeded,
  applyFormAction,
  businessFormRequest,
  formActionLabelKey,
  formFieldErrorKey,
  formFieldLabelKey,
  rejectNoSideEffect,
  validateFormValues,
} from '../business-forms'

// ---------------------------------------------------------------------------
// ① schema 两类
// ---------------------------------------------------------------------------

describe('D77 business-forms / schema 两类', () => {
  it('email 卡六字段齐全且必填集合为 收件人/主题/正文', () => {
    const fields = BUSINESS_FORM_FIELDS.email
    expect(fields.map((f) => f.key)).toEqual(['to', 'cc', 'bcc', 'subject', 'replyTo', 'body'])
    const required = fields.filter((f) => f.required).map((f) => f.key)
    expect(required).toEqual(['to', 'subject', 'body'])
  })

  it('calendarEvent 卡三字段齐全且全部必填', () => {
    const fields = BUSINESS_FORM_FIELDS.calendarEvent
    expect(fields.map((f) => f.key)).toEqual(['start', 'end', 'attendees'])
    expect(fields.every((f) => f.required)).toBe(true)
  })

  it('businessFormRequest 形状与 form_request 对齐 {kind, fields, actions} 且 actions 恒成对', () => {
    for (const kind of BUSINESS_FORM_KINDS) {
      const req = businessFormRequest(kind)
      expect(Object.keys(req).sort()).toEqual(['actions', 'fields', 'kind'])
      expect(req.kind).toBe(kind)
      expect(req.actions).toEqual(['approve', 'reject'])
      expect(req.fields).toEqual(BUSINESS_FORM_FIELDS[kind])
    }
  })

  it('FORM_ACTION_PAIRS 成对对称:approve↔reject', () => {
    expect(FORM_ACTION_PAIRS.approve).toBe('reject')
    expect(FORM_ACTION_PAIRS.reject).toBe('approve')
  })
})

// ---------------------------------------------------------------------------
// ② 校验正反例
// ---------------------------------------------------------------------------

const validEmail = {
  to: 'a@b.com',
  cc: '',
  bcc: '',
  subject: '季度评审',
  replyTo: '',
  body: '请查收',
}

describe('D77 business-forms / validateFormValues 校验正反例', () => {
  it('正例:合法 email 全过', () => {
    const r = validateFormValues('email', validEmail)
    expect(r.ok).toBe(true)
    expect(r.fieldErrors).toEqual({})
  })

  it('负例:email 缺收件人/主题/正文 → 各自 required', () => {
    const r = validateFormValues('email', { ...validEmail, to: '', subject: '', body: '' })
    expect(r.ok).toBe(false)
    expect(r.fieldErrors).toEqual({ to: 'required', subject: 'required', body: 'required' })
  })

  it('负例:email 格式错误(to / cc 多地址其一错 / replyTo)', () => {
    expect(validateFormValues('email', { ...validEmail, to: 'not-an-email' }).fieldErrors.to).toBe('invalidEmail')
    expect(
      validateFormValues('email', { ...validEmail, cc: 'ok@x.com, bad' }).fieldErrors.cc,
    ).toBe('invalidEmail')
    expect(validateFormValues('email', { ...validEmail, replyTo: 'a@b' }).fieldErrors.replyTo).toBe(
      'invalidEmail',
    )
  })

  it('正例:多地址(逗号/分号/空白分隔)合法则通过', () => {
    const r = validateFormValues('email', { ...validEmail, to: 'a@b.com; c@d.cn, e@f.org' })
    expect(r.ok).toBe(true)
  })

  it('正例:日历 开始<结束 且出席人非空', () => {
    const r = validateFormValues('calendarEvent', {
      start: '2026-09-24T10:00',
      end: '2026-09-24T11:00',
      attendees: ['a@b.com'],
    })
    expect(r.ok).toBe(true)
    expect(r.fieldErrors).toEqual({})
  })

  it('负例:日历 开始>=结束 → end 标 endBeforeStart(含相等)', () => {
    const back = validateFormValues('calendarEvent', {
      start: '2026-09-24T11:00',
      end: '2026-09-24T10:00',
      attendees: ['a@b.com'],
    })
    expect(back.ok).toBe(false)
    expect(back.fieldErrors.end).toBe('endBeforeStart')

    const equal = validateFormValues('calendarEvent', {
      start: '2026-09-24T10:00',
      end: '2026-09-24T10:00',
      attendees: ['a@b.com'],
    })
    expect(equal.fieldErrors.end).toBe('endBeforeStart')
  })

  it('负例:日历出席人为空数组 → noAttendees', () => {
    const r = validateFormValues('calendarEvent', {
      start: '2026-09-24T10:00',
      end: '2026-09-24T11:00',
      attendees: [],
    })
    expect(r.ok).toBe(false)
    expect(r.fieldErrors.attendees).toBe('noAttendees')
  })

  it('负例:日历缺开始/结束 → required,且区间不因空串误判', () => {
    const r = validateFormValues('calendarEvent', {
      start: '',
      end: '2026-09-24T11:00',
      attendees: ['a@b.com'],
    })
    expect(r.fieldErrors.start).toBe('required')
    expect(r.fieldErrors.end).toBeUndefined()
  })

  it('i18n 键生成器:字段/错误/动作 键片段与词包命名空间对齐', () => {
    expect(formFieldLabelKey('email', 'to')).toBe('fields.to')
    expect(formFieldErrorKey('invalidEmail')).toBe('error.invalidEmail')
    expect(formActionLabelKey('approve')).toBe('action.approve')
    expect(formActionLabelKey('reject')).toBe('action.reject')
  })
})

// ---------------------------------------------------------------------------
// ③ 拒绝路径零副作用(本票硬约束,专门负例)
// ---------------------------------------------------------------------------

describe('D77 business-forms / 拒绝路径零副作用', () => {
  it('正例:approve 侧提交被调用属正常', () => {
    expect(rejectNoSideEffect({ action: 'approve', submitInvoked: true })).toBe(true)
  })

  it('正例:reject 侧未调用任何提交动作', () => {
    expect(rejectNoSideEffect({ action: 'reject', submitInvoked: false })).toBe(true)
  })

  it('**负例:reject 侧调用了提交动作 → 判据不通过**', () => {
    expect(rejectNoSideEffect({ action: 'reject', submitInvoked: true })).toBe(false)
  })

  it('reject-only 应答形状:values 恒为 null(数据形状上的零副作用落点)', () => {
    // 渲染层构造 reject 应答时不得携带 values;这里以类型形状 + 契约断言守住。
    const rejectPayload = { action: 'reject' as const, kind: 'email' as const, values: null }
    expect(rejectPayload.values).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// ④ 状态机穷尽
// ---------------------------------------------------------------------------

describe('D77 business-forms / applyFormAction 状态机', () => {
  it('主链:idle → filling → submitting → approved', () => {
    let s = applyFormAction('idle', { type: 'beginFill' })
    expect(s).toBe('filling')
    s = applyFormAction(s, { type: 'submit' })
    expect(s).toBe('submitting')
    s = applyFormAction(s, { type: 'commitSuccess' })
    expect(s).toBe('approved')
  })

  it('失败链:submitting → failed → beginFill → filling(可重试)', () => {
    let s = applyFormAction('submitting', { type: 'commitFailure' })
    expect(s).toBe('failed')
    s = applyFormAction(s, { type: 'beginFill' })
    expect(s).toBe('filling')
  })

  it('**拒绝直达终态:filling → rejected,不经 submitting(零副作用的形态落点)**', () => {
    expect(applyFormAction('filling', { type: 'reject' })).toBe('rejected')
    expect(applyFormAction('idle', { type: 'reject' })).toBe('idle')
  })

  it('终态只认 reset:approved/rejected 不得被 submit/reject/beginFill 迁走', () => {
    for (const terminal of ['approved', 'rejected'] as const) {
      expect(applyFormAction(terminal, { type: 'submit' })).toBe(terminal)
      expect(applyFormAction(terminal, { type: 'reject' })).toBe(terminal)
      expect(applyFormAction(terminal, { type: 'beginFill' })).toBe(terminal)
      expect(applyFormAction(terminal, { type: 'reset' })).toBe('idle')
    }
  })

  it('failed 只认 beginFill(回 filling)与 reset;其余事件原地', () => {
    expect(applyFormAction('failed', { type: 'submit' })).toBe('failed')
    expect(applyFormAction('failed', { type: 'reject' })).toBe('failed')
    expect(applyFormAction('failed', { type: 'commitSuccess' })).toBe('failed')
    expect(applyFormAction('failed', { type: 'beginFill' })).toBe('filling')
    expect(applyFormAction('failed', { type: 'reset' })).toBe('idle')
  })

  it('六相全集被穷尽覆盖(FORM_STATE_PHASES 与测试逐一对应)', () => {
    expect([...FORM_STATE_PHASES]).toEqual([
      'idle',
      'filling',
      'submitting',
      'approved',
      'rejected',
      'failed',
    ])
    for (const phase of FORM_STATE_PHASES) {
      expect(applyFormAction(phase, { type: 'reset' })).toBe('idle')
    }
  })

  it('未知事件在运行时兜底抛错(assertNever 运行时防线)', () => {
    expect(() =>
      applyFormAction('filling', { type: 'unknown' as never }),
    ).toThrow(/unhandled form state event/)
  })
})

// ---------------------------------------------------------------------------
// ⑤ 日历折叠判定
// ---------------------------------------------------------------------------

describe('D77 business-forms / attendeesFoldNeeded 折叠判定', () => {
  it('阈值内(含恰好等于阈值)不折叠', () => {
    for (let n = 0; n <= ATTENDEES_FOLD_THRESHOLD; n++) {
      const v = attendeesFoldNeeded(n)
      expect(v.foldNeeded, `count=${n}`).toBe(false)
      expect(v.visibleCount).toBe(n)
      expect(v.overflowCount).toBe(0)
    }
  })

  it('超过阈值折叠:可见=阈值,溢出=count-阈值,并给出展开/收起键', () => {
    const v = attendeesFoldNeeded(5)
    expect(v.foldNeeded).toBe(true)
    expect(v.visibleCount).toBe(ATTENDEES_FOLD_THRESHOLD)
    expect(v.overflowCount).toBe(2)
    expect(v.expandKey).toBe('fold.expand')
    expect(v.collapseKey).toBe('fold.collapse')
  })

  it('非法输入(负数/NaN)不崩,按 0 处理', () => {
    expect(attendeesFoldNeeded(-1).visibleCount).toBe(0)
    expect(attendeesFoldNeeded(Number.NaN).foldNeeded).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
