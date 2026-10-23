// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment happy-dom
/**
 * G-937950 + G-171a 队列拒绝原因键族 —— deniedCauseNotice + InteractionVerdict.causeKey + bar 渲染
 *
 * 覆盖:
 * - deniedCauseNotice 对全部 QUEUE_DENY_REASONS(G-171a 起六因)各返回互不相同、非空、
 *   同通道(`denied.cause.<reason>`,与 deniedNotice 同一取词族)的键串;
 * - 穷尽性:Record<QueueDenyReason, string> 编译期断言 —— QUEUE_DENY_REASONS 新增成员
 *   而本表未补 ⇒ 缺键 tsc 红;实现侧的穷尽由 input-notices.ts 穷尽 switch + assertNever 保证。
 * - bar 组件:mock 六个不同 denyReason 的 verdict(经真实 queueInteractionPerms 构造,
 *   三新因由可选输入喂入),断言六个 data-queue-denied-cause 文案互不相同、
 *   data-cause-key 正确、cause 串是**独立元素**(不与 deniedKey 合成一句)。
 * - 真实词包:五语言 queue.denied.cause.* 六键齐、非空、互不相同(文案层互异兜底;
 *   web 包三新键被他席在飞改动阻塞,本组如实红至键落地,见组内注)。
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { render, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  QUEUE_DENY_REASONS,
  deniedCauseNotice,
  queueInteractionPerms,
  type QueueInteractionContext,
} from '@ihui/shared/chat/input-notices'
import type { FollowUpMode } from '@ihui/shared/chat/queue-interactions'

import { QueueInteractionBar } from '../src/components/chat/queue-interaction-bar'

// 只断言结构与键;文案层互异由下面「读真实词包」那组用例守住(同 queue-interaction-bar.test.tsx 分工)。
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

afterEach(() => {
  cleanup()
})

const here = dirname(fileURLToPath(import.meta.url))
// tests → web(apps/web) → apps → 仓库根,共 3 级
const MESSAGES_ROOT = join(here, '../../../packages/i18n/messages/web')
const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

// ─── deniedCauseNotice 单元(键互异 / 非空 / 同通道) ──────────────
describe('G-937950 + G-171a deniedCauseNotice / 六因键串', () => {
  it('六个 reason 各返回互不相同、非空、非裸 reason 词的键串', () => {
    const keys = QUEUE_DENY_REASONS.map((reason) => deniedCauseNotice(reason))
    // 互不相同(两两比较)
    expect(new Set(keys).size).toBe(QUEUE_DENY_REASONS.length)
    for (const [reason, key] of QUEUE_DENY_REASONS.map((r) => [r, deniedCauseNotice(r)] as const)) {
      expect(key.length, reason).toBeGreaterThan(0)
      // 非裸键名:走 deniedNotice 同一条 denied.* 通道(渲染层加 queue. 前缀消费)
      expect(key, reason).toBe(`denied.cause.${reason}`)
      expect(key, reason).not.toBe(reason)
    }
  })

  it('穷尽性:Record<QueueDenyReason, string> 全覆盖(新增因未补 ⇒ 本表缺键,tsc 编译期红)', () => {
    const _exhaustive: Record<(typeof QUEUE_DENY_REASONS)[number], string> = {
      streaming: deniedCauseNotice('streaming'),
      emptyQueue: deniedCauseNotice('emptyQueue'),
      runtimeNoInterject: deniedCauseNotice('runtimeNoInterject'),
      queueChanged: deniedCauseNotice('queueChanged'),
      controlCommand: deniedCauseNotice('controlCommand'),
      awaitingApproval: deniedCauseNotice('awaitingApproval'),
    }
    expect(Object.keys(_exhaustive).sort()).toEqual([...QUEUE_DENY_REASONS].sort())
  })
})

// ─── bar 组件渲染(mock verdict:经真实 perms 构造三个不同 denyReason) ──
const items = [
  { id: 'q1', text: '第一条' },
  { id: 'q2', text: '第二条' },
]

/** 六种拒绝条件(互不相同的 denyReason;全走 D69 queueInteractionPerms 真实判定) */
const ctxOf = (over: Partial<QueueInteractionContext>): QueueInteractionContext => ({
  runtimeSupportsInterjection: true,
  streaming: false,
  hasQueuedMessages: true,
  ...over,
})
const ARMS = {
  streaming: ctxOf({ streaming: true }),
  runtimeNoInterject: ctxOf({ runtimeSupportsInterjection: false }),
  emptyQueue: ctxOf({ hasQueuedMessages: false }),
  // G-171a 三新因(经真实来源喂入可选输入:queueChanged=编辑漂移实测,
  // awaitingApproval=审批待决,controlCommand=控制命令撞运行中 Turn)
  queueChanged: ctxOf({ queueChanged: true }),
  controlCommand: ctxOf({ streaming: true, isControlCommand: true }),
  awaitingApproval: ctxOf({ streaming: true, awaitingApproval: true }),
} satisfies Record<string, QueueInteractionContext>

/** 各臂下携带目标 cause 的拒绝提示位置(哪个动作被同一拒因拦下) */
const ARM_TARGET: Record<keyof typeof ARMS, string> = {
  streaming: 'reorder',
  runtimeNoInterject: 'interruptAndRun',
  emptyQueue: 'undo',
  queueChanged: 'reorder',
  controlCommand: 'interruptAndRun',
  awaitingApproval: 'interruptAndRun',
}

describe('G-937950 bar 渲染 / cause 串独立渲染 + data 属性', () => {
  const renderArm = (arm: keyof typeof ARMS) => {
    const base = queueInteractionPerms(ARMS[arm])
    const { container } = render(
      <QueueInteractionBar
        items={items}
        perms={base}
        mode={'queue' as FollowUpMode}
        runtimeSupportsInterjection={ARMS[arm].runtimeSupportsInterjection}
      />,
    )
    const hint = container.querySelector(`[data-queue-denied="${ARM_TARGET[arm]}"]`)
    expect(hint, `arm=${arm} 应显式渲染拒绝提示`).not.toBeNull()
    const cause = hint?.querySelector('[data-queue-denied-cause]')
    return {
      hint,
      cause,
      causeText: cause?.getAttribute('data-queue-denied-cause') ?? null,
      causeKey: cause?.getAttribute('data-cause-key') ?? null,
    }
  }

  it('六个不同拒绝条件:causeKey 各自正确(denied.cause.<reason>)', () => {
    for (const arm of Object.keys(ARMS) as (keyof typeof ARMS)[]) {
      const { causeKey } = renderArm(arm)
      expect(causeKey, `arm=${arm}`).toBe(`denied.cause.${arm}`)
    }
  })

  it('六臂 data-queue-denied-cause 文案互不相同(G-171a 起含三新因)', () => {
    const texts = (Object.keys(ARMS) as (keyof typeof ARMS)[]).map(
      (arm) => renderArm(arm).causeText,
    )
    for (const [i, text] of texts.entries())
      expect(text?.length ?? 0, `臂 ${Object.keys(ARMS)[i]} cause 文案不得为空`).toBeGreaterThan(0)
    expect(new Set(texts).size, `六臂文案应互不相同,实际:${JSON.stringify(texts)}`).toBe(6)
  })

  it('cause 串是独立元素(不与 deniedKey 合成一句"当前不可用")', () => {
    const { hint, cause, causeText, causeKey } = renderArm('streaming')
    expect(cause).not.toBe(hint) // cause 是 hint 的子元素,不是同一节点
    // 拒绝动作键与 cause 键各自独立存在
    expect(hint?.getAttribute('data-denied-key')).toBe('denied.reorder')
    expect(causeText).toBe(`queue.${causeKey}`)
    // mock 取词(返回键)下,cause 子串不吞掉动作键:两段文本各在各的节点里
    expect(cause?.textContent).toBe(causeText)
  })
})

// ─── 真实词包(不 mock):文案层互异兜底 ──────────────────────
describe('G-937950 真实词包 / queue.denied.cause.* 五语言', () => {
  const readDeniedCause = (locale: string): Record<string, string> => {
    const parsed = JSON.parse(readFileSync(join(MESSAGES_ROOT, `${locale}.json`), 'utf8')) as {
      ai?: { pane?: { inputNotices?: { queue?: { denied?: { cause?: Record<string, string> } } } } }
    }
    const cause = parsed.ai?.pane?.inputNotices?.queue?.denied?.cause
    expect(cause, `${locale} inputNotices.queue.denied.cause`).toBeTruthy()
    return cause as Record<string, string>
  }

  // G-171a:键集与枚举一致 ⇒ 本组断言随 QUEUE_DENY_REASONS 扩到六键。
  // web 包内三新键(denied.cause.queueChanged / .controlCommand / .awaitingApproval)
  // 被他席在飞改动阻塞(packages/i18n/messages/web/*.json),键落地前本组如实红;
  // 文案本体已先行落 shared 五语包(web 运行时经 mergeMessages(shared ⊕ web) 可解析)。
  it('五语言六键齐、非空、键集与 QUEUE_DENY_REASONS 一致', () => {
    for (const locale of LOCALES) {
      const cause = readDeniedCause(locale)
      expect(Object.keys(cause).sort(), locale).toEqual([...QUEUE_DENY_REASONS].sort())
      for (const reason of QUEUE_DENY_REASONS) {
        expect(cause[reason]?.trim().length ?? 0, `${locale} ${reason}`).toBeGreaterThan(0)
      }
    }
  })

  it('同一语言内六条文案互不相同(设计意图:不同拒绝条件的文案不得重合)', () => {
    for (const locale of LOCALES) {
      const cause = readDeniedCause(locale)
      const texts = QUEUE_DENY_REASONS.map((reason) => cause[reason])
      expect(new Set(texts).size, `${locale} 六条文案应互不相同`).toBe(QUEUE_DENY_REASONS.length)
    }
  })
})
