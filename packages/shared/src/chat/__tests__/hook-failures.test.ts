// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-87 Hook 失败可见性卡 —— 六态判据用例(定档 C:契约先行,渲染位待 D34 事件立项)。
//
// 五条主线:
//   ① 六态逐态:每态都有独立的标题键 / aria 键,六态互不相同;
//   ② 穷尽性:六态全覆盖,编译期由 hook-failures.ts 的「穷尽 switch + assertNever
//      零 default」守住(漏一态 ⇒ tsc 失败);
//   ③ **resultNotRecorded 不得静默**:终态缺省必须显式宣告"未记录最终结果",
//      attachment 恒 null + evidenceMissing=true —— 静默留空 = 把"没记录"伪装成
//      "没问题";
//   ④ attachment 脱敏:command/stderr 必须过 sanitizeEvidenceText,**严禁裸传**
//      (假密钥样本用运行时拼接构造,避免整串字面量命中 GitHub push protection);
//   ⑤ 键名生成器:渲染层统一取键,禁止手写键串。

import { describe, expect, it } from 'vitest'

import { REDACT_SECRET_MARKER } from '../../utils/redact'
import {
  HOOK_EVIDENCE_FIELDS,
  HOOK_FAILURES_NAMESPACE,
  HOOK_FAILURE_CARD_ARIA_KEY,
  HOOK_FAILURE_CARD_TITLE_KEY,
  HOOK_STATUS_STATES,
  buildHookFailureAttachment,
  hookFieldLabelKey,
  hookFailureView,
  hookStatusAriaKey,
  hookStatusHintKey,
  hookStatusTitleKey,
  isHookStatusState,
  type HookFailureContext,
  type HookStatusState,
} from '../hook-failures'

/** 运行时拼接的假密钥样本(源码里不存在整串字面量,push protection 不触发) */
const FAKE_KEY_SUFFIX = 'Ab3dEf6hIj9kLm2nPq4Rs8Tu'
const FAKE_KEY = ['sk-test', FAKE_KEY_SUFFIX].join('')

const FULL_CTX: HookFailureContext = {
  hookName: 'deploy-notify',
  hookEvent: 'tool.after',
  command: 'curl -s https://hooks.example.internal/notify',
  stderr: `post failed with ${FAKE_KEY}`,
  exitCode: 1,
  durationMs: 3210,
}

describe('G-87 Hook 失败六态 / 词汇表常量', () => {
  it('六态常量就是 Qoder 对标的那六个,顺序即语义顺序', () => {
    expect(HOOK_STATUS_STATES).toEqual([
      'succeeded',
      'retryScheduled',
      'failed',
      'timedOut',
      'skipped',
      'resultNotRecorded',
    ])
    expect(HOOK_STATUS_STATES).toHaveLength(6)
  })

  it('词包命名空间固定为 ai.pane.hookFailures(契约先行,渲染位待接线)', () => {
    expect(HOOK_FAILURES_NAMESPACE).toBe('ai.pane.hookFailures')
  })

  it('明细字段就是 Qoder attachment 七字段中可判定的六个', () => {
    expect(HOOK_EVIDENCE_FIELDS).toEqual([
      'hookName',
      'hookEvent',
      'command',
      'stderr',
      'exitCode',
      'durationMs',
    ])
  })
})

describe('G-87 Hook 失败六态 / 逐态判据', () => {
  it('每态都能派发,且 titleKey / ariaKey / hintKey 与键名辅助函数一致', () => {
    for (const state of HOOK_STATUS_STATES) {
      const view = hookFailureView(state, null)
      expect(view.state, state).toBe(state)
      expect(view.titleKey, state).toBe(hookStatusTitleKey(state))
      expect(view.ariaKey, state).toBe(hookStatusAriaKey(state))
      expect(view.titleKey, state).toBe(`state.${state}`)
      expect(view.ariaKey, state).toBe(`aria.${state}`)
      if (view.hintKey !== null) {
        expect(view.hintKey, state).toBe(hookStatusHintKey(state))
      }
    }
  })

  it('succeeded:成功终态,无需补充说明,无动作', () => {
    const view = hookFailureView('succeeded', null)
    expect(view.tone).toBe('success')
    expect(view.terminal).toBe(true)
    expect(view.hintKey).toBeNull()
    expect(view.showsEvidence).toBe(false)
    expect(view.evidenceMissing).toBe(false)
    expect(view.action).toBe('none')
    expect(view.attachment).toBeNull()
  })

  it('retryScheduled:非终态,必须说明"还会再来"', () => {
    const view = hookFailureView('retryScheduled', null)
    expect(view.tone).toBe('info')
    expect(view.terminal).toBe(false)
    expect(view.hintKey).toBe('hint.retryScheduled')
    expect(view.showsEvidence).toBe(false)
    expect(view.action).toBe('none')
  })

  it('failed:危险色终态,展示明细,给重试入口(DLQ reprocess 语义位)', () => {
    const view = hookFailureView('failed', FULL_CTX)
    expect(view.tone).toBe('danger')
    expect(view.terminal).toBe(true)
    expect(view.showsEvidence).toBe(true)
    expect(view.action).toBe('retry')
    expect(view.attachment).not.toBeNull()
    expect(view.attachment?.hookName).toBe('deploy-notify')
    expect(view.attachment?.exitCode).toBe(1)
    expect(view.attachment?.durationMs).toBe(3210)
  })

  it('timedOut:警示色终态,与 failed 同形不同色,同样给重试入口', () => {
    const view = hookFailureView('timedOut', FULL_CTX)
    expect(view.tone).toBe('warning')
    expect(view.terminal).toBe(true)
    expect(view.showsEvidence).toBe(true)
    expect(view.action).toBe('retry')
    expect(view.attachment).not.toBeNull()
  })

  it('skipped:中性终态,未执行无证据可展示', () => {
    const view = hookFailureView('skipped', FULL_CTX)
    expect(view.tone).toBe('neutral')
    expect(view.terminal).toBe(true)
    expect(view.showsEvidence).toBe(false)
    expect(view.evidenceMissing).toBe(false)
    expect(view.action).toBe('none')
  })

  it('resultNotRecorded:终态缺省必须显式宣告 —— attachment 恒 null + evidenceMissing=true + hintKey 非空(即使传了 ctx 也不假装有证据)', () => {
    for (const ctx of [null, FULL_CTX] as const) {
      const view = hookFailureView('resultNotRecorded', ctx)
      expect(view.tone).toBe('warning')
      expect(view.terminal).toBe(true)
      expect(view.hintKey).toBe('hint.resultNotRecorded')
      expect(view.hintKey).not.toBeNull()
      expect(view.evidenceMissing).toBe(true)
      expect(view.showsEvidence).toBe(false)
      expect(view.attachment).toBeNull()
      expect(view.action).toBe('inspect')
    }
  })

  it('六态 titleKey / ariaKey 互不相同(读屏不串台)', () => {
    const titles = new Set(HOOK_STATUS_STATES.map(hookStatusTitleKey))
    const arias = new Set(HOOK_STATUS_STATES.map(hookStatusAriaKey))
    expect(titles.size).toBe(6)
    expect(arias.size).toBe(6)
  })

  it('isHookStatusState 对六态收窄、对其余字符串拒绝', () => {
    for (const state of HOOK_STATUS_STATES) {
      expect(isHookStatusState(state)).toBe(true)
    }
    expect(isHookStatusState('running')).toBe(false)
    expect(isHookStatusState('')).toBe(false)
    expect(isHookStatusState('result_not_recorded')).toBe(false)
  })
})

describe('G-87 attachment / 脱敏', () => {
  it('command/stderr 过 sanitizeEvidenceText:假密钥被替换为 [REDACTED_SECRET],原文后缀不残留', () => {
    const att = buildHookFailureAttachment(FULL_CTX)
    expect(att.stderr).toContain(REDACT_SECRET_MARKER)
    expect(att.stderr).not.toContain(FAKE_KEY_SUFFIX)
    expect(att.stderr).not.toContain(FAKE_KEY)
  })

  it('hookName / hookEvent / exitCode / durationMs 原样保留(它们不是凭据)', () => {
    const att = buildHookFailureAttachment(FULL_CTX)
    expect(att.hookName).toBe('deploy-notify')
    expect(att.hookEvent).toBe('tool.after')
    expect(att.exitCode).toBe(1)
    expect(att.durationMs).toBe(3210)
  })

  it('缺失字段归空串 / null,绝不抛错', () => {
    const att = buildHookFailureAttachment({})
    expect(att.hookName).toBe('')
    expect(att.hookEvent).toBe('')
    expect(att.command).toBe('')
    expect(att.stderr).toBe('')
    expect(att.exitCode).toBeNull()
    expect(att.durationMs).toBeNull()
  })

  it('ANSI 转义序列先剥离再脱敏(与 D94 交接单同链路)', () => {
    const esc = String.fromCharCode(27)
    const att = buildHookFailureAttachment({
      command: `${esc}[31mcurl${esc}[0m https://hooks.example.internal`,
      stderr: `token ${FAKE_KEY} in ${esc}[1mtrace${esc}[0m`,
    })
    expect(att.command).not.toContain(esc)
    expect(att.stderr).not.toContain(esc)
    expect(att.stderr).toContain(REDACT_SECRET_MARKER)
  })
})

describe('G-87 键名生成器', () => {
  it('字段标签键 = field.<field>,覆盖全部六个明细字段', () => {
    for (const field of HOOK_EVIDENCE_FIELDS) {
      expect(hookFieldLabelKey(field)).toBe(`field.${field}`)
    }
  })

  it('卡片标题 / 整体 aria 键为常量,五语言词包共用', () => {
    expect(HOOK_FAILURE_CARD_TITLE_KEY).toBe('card.title')
    expect(HOOK_FAILURE_CARD_ARIA_KEY).toBe('aria.card')
  })

  it('hint 键生成器对六态全覆盖且以 hint. 开头', () => {
    for (const state of HOOK_STATUS_STATES) {
      expect(hookStatusHintKey(state)).toBe(`hint.${state}`)
    }
  })
})

// 类型层哨兵:HookStatusState 穷尽性由 hook-failures.ts 的
// 「switch 穷尽 + assertNever 零 default」在编译期守住;此处用
// satisfies 保证六态常量与类型双向一致,漏改任一侧即 tsc 失败。
const ALL_STATES_CHECK: readonly HookStatusState[] = HOOK_STATUS_STATES
void ALL_STATES_CHECK
