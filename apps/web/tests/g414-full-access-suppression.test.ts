// 票 G-414 ② —— 高风险确认弹窗的"不再提醒"从永久静默改成可判、有期限、绑守卫对象的授权。
//
// 开工时现读复验(不是照抄票面):旧判据 `getItem(...) === '1'` 仍在
// `apps/web/src/components/ai/full-access-confirm-dialog.tsx`(修前 :39-46),
// 而第二个 key `ihui:full-access-acknowledged` 全仓零 `getItem` —— 两格都是"注释承诺而未兑现"。
// 本文件跑唯一出口 `@/lib/full-access-suppression`(纯模块,不拉 React)。
import { beforeEach, describe, expect, it } from 'vitest'
import {
  FULL_ACCESS_GUARD_POLICY_VERSION,
  FULL_ACCESS_GUARD_SUBJECTS,
  FULL_ACCESS_RECORD_SCHEMA,
  FULL_ACCESS_SUPPRESSION_KEY,
  FULL_ACCESS_SUPPRESSION_TTL_MS,
  SUPPRESSION_STATES,
  clearFullAccessSuppression,
  evaluateFullAccessSuppression,
  grantFullAccessSuppression,
  isFullAccessGuardSubject,
  recordFullAccessAcknowledgement,
} from '@/lib/full-access-suppression'

const DAY = 86_400_000
const NOW = Date.parse('2026-09-29T00:00:00.000Z')
const SUBJECT = 'bypass-permissions' as const

/**
 * 直接写存储,造出"读侧必须判红"的形态。
 * 刻意不经出口写 —— 用出口写再测出口,就是让实现替自己发合格证。
 */
function seed(value: unknown): void {
  window.localStorage.setItem(
    FULL_ACCESS_SUPPRESSION_KEY,
    typeof value === 'string' ? value : JSON.stringify(value),
  )
}

/** 按守卫对象分格的记录形状(与出口写出的一致,内容只由测试摆)。 */
function recordWith(grants: Record<string, unknown>): Record<string, unknown> {
  return { schema: FULL_ACCESS_RECORD_SCHEMA, grants }
}

function readStored(): Record<string, unknown> | null {
  const raw = window.localStorage.getItem(FULL_ACCESS_SUPPRESSION_KEY)
  return raw === null ? null : (JSON.parse(raw) as Record<string, unknown>)
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('每一种"必须重新问人"都有自己的名字(三态不并桶)', () => {
  it('读数封闭集齐备,granted 与"判不出"不得混成一个读数', () => {
    expect([...SUPPRESSION_STATES]).toEqual([
      'granted',
      'absent',
      'acknowledged_once',
      'expired',
      'policy_stale',
      'subject_unregistered',
      'malformed',
      'undetermined',
    ])
  })

  it('旧版裸 "1"(没有绑档、没有期限)⇒ 重新问一次,而不是当成永久有效', () => {
    // 阳性对照:修前这一格是 suppressed=true,即票面那句"永久压制安全确认弹窗"
    seed('1')
    const d = evaluateFullAccessSuppression(SUBJECT, NOW)
    expect(d.suppressed).toBe(false)
    expect(d.state).toBe('malformed')
  })

  it('静默到期 ⇒ 必须重新问人,并在结论里点名到期时刻', () => {
    grantFullAccessSuppression(SUBJECT, NOW)
    expect(evaluateFullAccessSuppression(SUBJECT, NOW + FULL_ACCESS_SUPPRESSION_TTL_MS - 1).suppressed).toBe(true)
    const expired = evaluateFullAccessSuppression(SUBJECT, NOW + FULL_ACCESS_SUPPRESSION_TTL_MS)
    expect(expired.suppressed).toBe(false)
    expect(expired.state).toBe('expired')
    expect(expired.expiresAt).toBe(NOW + FULL_ACCESS_SUPPRESSION_TTL_MS)
  })

  it('风险说明换版(policyVersion 不符)⇒ 旧静默不是永久白名单', () => {
    seed(
      recordWith({
        [SUBJECT]: {
          policyVersion: FULL_ACCESS_GUARD_POLICY_VERSION + 1,
          acknowledgedAt: NOW,
          expiresAt: NOW + 30 * DAY,
        },
      }),
    )
    const d = evaluateFullAccessSuppression(SUBJECT, NOW)
    expect(d.suppressed).toBe(false)
    expect(d.state).toBe('policy_stale')
  })

  it('只勾"我了解"没勾"不再提醒" ⇒ 确认这件事被记着,但下次照问', () => {
    recordFullAccessAcknowledgement(SUBJECT, NOW)
    const d = evaluateFullAccessSuppression(SUBJECT, NOW + 1)
    expect(d.state).toBe('acknowledged_once')
    expect(d.suppressed).toBe(false)
    // 确认时刻真的被读回来了(不是写了没人看 —— 本票另一格的同型)
    expect(d.acknowledgedAt).toBe(NOW)
  })

  it('存储判不出 ⇒ fail-closed 照问,但单独落 undetermined(不冒充"没静默过")', () => {
    const store = window.localStorage
    const getItem = store.getItem.bind(store)
    Object.defineProperty(store, 'getItem', {
      value: () => {
        throw new Error('SecurityError: storage unavailable')
      },
      configurable: true,
    })
    try {
      const d = evaluateFullAccessSuppression(SUBJECT, NOW)
      expect(d.suppressed).toBe(false)
      expect(d.state).toBe('undetermined')
    } finally {
      Object.defineProperty(store, 'getItem', { value: getItem, configurable: true })
    }
  })

  it('未登记的守卫对象既不放行,也不冒用别档的授权', () => {
    grantFullAccessSuppression(SUBJECT, NOW)
    const other = evaluateFullAccessSuppression('plan' as typeof SUBJECT, NOW)
    expect(other.suppressed).toBe(false)
    expect(other.state).toBe('subject_unregistered')
    expect(isFullAccessGuardSubject(SUBJECT)).toBe(true)
    expect(isFullAccessGuardSubject('plan')).toBe(false)
    expect(FULL_ACCESS_GUARD_SUBJECTS).toEqual([SUBJECT])
  })

  it('别档的授权不算这一档的授权(单值记录在长出第二档那天就会静默放行)', () => {
    seed(
      recordWith({
        'some-future-tier': { policyVersion: FULL_ACCESS_GUARD_POLICY_VERSION, acknowledgedAt: NOW, expiresAt: NOW + 30 * DAY },
      }),
    )
    const d = evaluateFullAccessSuppression(SUBJECT, NOW)
    expect(d.suppressed).toBe(false)
    expect(d.state).toBe('absent')
  })

  it('写一格不得抹掉另一格;一格形状坏也不该撤销别格的同意', () => {
    seed(
      recordWith({
        [SUBJECT]: { policyVersion: FULL_ACCESS_GUARD_POLICY_VERSION, acknowledgedAt: NOW, expiresAt: NOW + 30 * DAY },
        'other-tier': { policyVersion: FULL_ACCESS_GUARD_POLICY_VERSION, acknowledgedAt: NOW, expiresAt: null },
      }),
    )
    // 出口写入 SUBJECT 那一格后,另一格必须原样在
    grantFullAccessSuppression(SUBJECT, NOW + DAY)
    const stored = readStored() as { grants: Record<string, unknown> }
    expect(Object.keys(stored.grants).sort()).toEqual([SUBJECT, 'other-tier'])
    expect(evaluateFullAccessSuppression(SUBJECT, NOW + 2 * DAY).suppressed).toBe(true)

    // 形状坏的那一格等价于没授权(fail-closed),但不把整条记录判废
    seed({ schema: FULL_ACCESS_RECORD_SCHEMA, grants: { 'broken-tier': 42 } })
    const d = evaluateFullAccessSuppression(SUBJECT, NOW)
    expect(d.suppressed).toBe(false)
    expect(d.state).toBe('absent')
  })

  it('整条记录的结构版本不认 ⇒ malformed(照问,而不是按空记录悄悄放行)', () => {
    seed({ schema: 99, grants: { [SUBJECT]: { policyVersion: 1, acknowledgedAt: NOW, expiresAt: NOW + 30 * DAY } } })
    const d = evaluateFullAccessSuppression(SUBJECT, NOW)
    expect(d.suppressed).toBe(false)
    expect(d.state).toBe('malformed')
  })
})

describe('正当路径逐字未变(收紧不等于每次必问)', () => {
  it('勾了"不再提醒"⇒ 有效期内静默,写入的是分档的版本化记录', () => {
    grantFullAccessSuppression(SUBJECT, NOW)
    const d = evaluateFullAccessSuppression(SUBJECT, NOW + DAY)
    expect(d.suppressed).toBe(true)
    expect(d.state).toBe('granted')
    expect(readStored()).toEqual({
      schema: FULL_ACCESS_RECORD_SCHEMA,
      grants: {
        [SUBJECT]: {
          policyVersion: FULL_ACCESS_GUARD_POLICY_VERSION,
          acknowledgedAt: NOW,
          expiresAt: NOW + FULL_ACCESS_SUPPRESSION_TTL_MS,
        },
      },
    })
  })

  it('重复授权只更新自己那一格,不长出第二条记录', () => {
    grantFullAccessSuppression(SUBJECT, NOW)
    grantFullAccessSuppression(SUBJECT, NOW + DAY)
    const stored = readStored() as { grants: Record<string, { acknowledgedAt: number; expiresAt: number }> }
    expect(stored.grants[SUBJECT]).toMatchObject({
      acknowledgedAt: NOW + DAY,
      expiresAt: NOW + DAY + FULL_ACCESS_SUPPRESSION_TTL_MS,
    })
    expect(Object.keys(stored.grants)).toEqual([SUBJECT])
    expect(evaluateFullAccessSuppression(SUBJECT, NOW + 2 * DAY).suppressed).toBe(true)
  })

  it('"重新提醒我"立刻撤销静默(历史面板那条出口的语义未变)', () => {
    grantFullAccessSuppression(SUBJECT, NOW)
    clearFullAccessSuppression()
    expect(window.localStorage.getItem(FULL_ACCESS_SUPPRESSION_KEY)).toBeNull()
    const d = evaluateFullAccessSuppression(SUBJECT, NOW)
    expect(d.state).toBe('absent')
    expect(d.suppressed).toBe(false)
  })

  it('静默必须有期限:不允许"没有到期时刻的永久授权"这一档', () => {
    expect(Number.isFinite(FULL_ACCESS_SUPPRESSION_TTL_MS)).toBe(true)
    expect(FULL_ACCESS_SUPPRESSION_TTL_MS).toBeGreaterThan(0)
    grantFullAccessSuppression(SUBJECT, NOW)
    const stored = readStored() as { grants: Record<string, { expiresAt: unknown }> }
    expect(typeof stored.grants[SUBJECT]?.expiresAt).toBe('number')
  })
})
