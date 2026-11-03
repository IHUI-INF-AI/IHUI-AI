// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 对标 Qoder 借鉴清单第 9 项:准入回执配对 + disposition 的判据钉。
//
// 本文件钉的是**失效方向**,不是 happy path:
// ① 回执缺席 / 形状不认 / inputId 不符 ⇒ 恒不冒充 admitted(Qoder MISMATCH 那一格);
// ② 隐式证据只能往上抬,不能把 queued 洗成 admitted、更不能把 rejected 洗白;
// ③ 失败收场且零证据 ⇒ unconfirmed(不是 admitted,也不是"没送到");
// ④ meta 回读:老消息读不到 ⇒ null,不得回落 tentative。
import { describe, expect, it } from 'vitest'

import {
  ADMISSION_DISPOSITIONS,
  ADMISSION_PHASES,
  SSE_ADMISSION_EVENT,
  createInputId,
  createSendAdmissionTracker,
  isAdmissionDisposition,
  readAdmissionPhaseFromMeta,
  readSendAdmissionReceipt,
  type AdmissionDisposition,
} from '../send-admission'

describe('readSendAdmissionReceipt:形状不认一律 null(不猜、不补默认档)', () => {
  it('合法四档全部可读', () => {
    for (const disposition of ADMISSION_DISPOSITIONS) {
      const r = readSendAdmissionReceipt({ inputId: 'in-1', disposition })
      expect(r, disposition).toEqual({ inputId: 'in-1', disposition })
    }
  })

  it('缺 inputId / 空 inputId ⇒ null(空串不是 id)', () => {
    expect(readSendAdmissionReceipt({ disposition: 'accepted' })).toBeNull()
    expect(readSendAdmissionReceipt({ inputId: '', disposition: 'accepted' })).toBeNull()
    expect(readSendAdmissionReceipt({ inputId: 42, disposition: 'accepted' })).toBeNull()
  })

  it('表外 disposition ⇒ null(不落任何已知档)', () => {
    expect(readSendAdmissionReceipt({ inputId: 'in-1', disposition: 'ok' })).toBeNull()
    expect(readSendAdmissionReceipt({ inputId: 'in-1', disposition: 'accepted ' })).toBeNull()
    expect(readSendAdmissionReceipt({ inputId: 'in-1' })).toBeNull()
  })

  it('非对象输入 ⇒ null', () => {
    for (const bad of [null, undefined, 'accepted', 1, []]) {
      expect(readSendAdmissionReceipt(bad)).toBeNull()
    }
  })

  it('可选字段缺席 = 无键(不写 undefined 键)', () => {
    const r = readSendAdmissionReceipt({ inputId: 'in-1', disposition: 'queued' })
    expect(r).not.toBeNull()
    expect(Object.keys(r ?? {})).toEqual(['inputId', 'disposition'])
  })

  it('可选字段在有值时原样带上', () => {
    const r = readSendAdmissionReceipt({
      inputId: 'in-1',
      disposition: 'queued',
      messageId: 'm-1',
      queuedTurnId: 'q-1',
      reason: 'RATE_LIMITED',
    })
    expect(r).toEqual({
      inputId: 'in-1',
      disposition: 'queued',
      messageId: 'm-1',
      queuedTurnId: 'q-1',
      reason: 'RATE_LIMITED',
    })
  })
})

describe('isAdmissionDisposition:表外取值恒 false', () => {
  it('四档为真,其余为假', () => {
    for (const d of ADMISSION_DISPOSITIONS) expect(isAdmissionDisposition(d), d).toBe(true)
    for (const bad of ['steered', 'ok', '', null, undefined, 0, {}]) {
      expect(isAdmissionDisposition(bad), String(bad)).toBe(false)
    }
  })
})

describe('createInputId:稳定且不随调用重复', () => {
  it('连续取 200 个互不相同', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 200; i += 1) seen.add(createInputId())
    expect(seen.size).toBe(200)
  })

  it('退到无 crypto 分支时仍互不相同(同毫秒也不撞)', () => {
    const holder = globalThis as { crypto?: unknown }
    const saved = holder.crypto
    try {
      // 摘掉 crypto 逼退化路径 —— 退化值必须靠进程内自增保证唯一
      Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true })
      const seen = new Set<string>()
      for (let i = 0; i < 200; i += 1) seen.add(createInputId())
      expect(seen.size).toBe(200)
      expect([...seen][0]?.startsWith('in-')).toBe(true)
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: saved, configurable: true })
    }
  })
})

describe('tracker:回执配对是唯一能把 tentative 抬成 admitted 的正规路径', () => {
  const make = () => createSendAdmissionTracker({ inputId: 'in-A', messageId: 'm-A' })

  it('初始恒为 tentative(乐观上屏只证明按下了发送)', () => {
    const t = make()
    expect(t.phase).toBe('tentative')
    expect(t.read()).toMatchObject({ matched: true, phase: 'tentative', changed: false })
  })

  it('accepted 回执 ⇒ admitted,且 changed 只在真迁移时为 true', () => {
    const t = make()
    const first = t.accept({ inputId: 'in-A', disposition: 'accepted' })
    expect(first).toMatchObject({ matched: true, phase: 'admitted', changed: true })
    const again = t.accept({ inputId: 'in-A', disposition: 'accepted' })
    expect(again.changed).toBe(false)
  })

  it('queued 回执 ⇒ queued(已收下但不在回答,不得显示成 admitted)', () => {
    const t = make()
    const r = t.accept({ inputId: 'in-A', disposition: 'queued', queuedTurnId: 'q-1' })
    expect(r.phase).toBe('queued')
    expect(r.receipt?.queuedTurnId).toBe('q-1')
  })

  it('rejected 回执 ⇒ rejected(终态)', () => {
    const t = make()
    expect(t.accept({ inputId: 'in-A', disposition: 'rejected', reason: 'BAD_PARAMS' }).phase).toBe(
      'rejected',
    )
  })

  it('duplicate 回执 ⇒ admitted(副作用已发生,但不得据此再发一次)', () => {
    const t = make()
    const r = t.accept({ inputId: 'in-A', disposition: 'duplicate' })
    expect(r.phase).toBe('admitted')
    expect(r.receipt?.disposition).toBe('duplicate')
  })

  it('inputId 不符 ⇒ matched:false 且 phase 原地不动(Qoder MISMATCH 那一格)', () => {
    const t = make()
    const r = t.accept({ inputId: 'in-OTHER', disposition: 'accepted' })
    expect(r).toEqual({ matched: false, phase: 'tentative', changed: false })
    expect(t.phase).toBe('tentative')
  })

  it('形状不认 ⇒ matched:false 且不改状态(未判定不猜)', () => {
    const t = make()
    for (const bad of [null, {}, { inputId: 'in-A' }, { inputId: 'in-A', disposition: 'x' }]) {
      const r = t.accept(bad)
      expect(r.matched).toBe(false)
      expect(r.phase).toBe('tentative')
    }
  })

  it('乱序回执:queued 之后来 accepted 不被拒(服务端确实执行了)', () => {
    const t = make()
    t.accept({ inputId: 'in-A', disposition: 'queued' })
    const r = t.accept({ inputId: 'in-A', disposition: 'accepted' })
    expect(r.phase).toBe('admitted')
  })

  it('rejected 是终态:后续 accepted 不得洗白(一条流不能证明被拒的请求成功)', () => {
    const t = make()
    t.accept({ inputId: 'in-A', disposition: 'rejected' })
    const r = t.accept({ inputId: 'in-A', disposition: 'accepted' })
    expect(r.phase).toBe('rejected')
    expect(r.changed).toBe(false)
  })
})

describe('tracker:隐式证据只往上抬,不改写已知结论', () => {
  const make = () => createSendAdmissionTracker({ inputId: 'in-A', messageId: 'm-A' })

  it.each(['stream-open', 'delta', 'done'] as const)('%s 把 tentative 抬成 admitted', (ev) => {
    const t = make()
    expect(t.noteEvidence(ev).phase).toBe('admitted')
  })

  it('已 admitted 后再来证据 ⇒ changed:false(不制造无谓写盘)', () => {
    const t = make()
    t.noteEvidence('delta')
    expect(t.noteEvidence('done').changed).toBe(false)
  })

  it('queued 不被证据洗成 admitted(排队不等于正在回答)', () => {
    const t = make()
    t.accept({ inputId: 'in-A', disposition: 'queued' })
    expect(t.noteEvidence('delta').phase).toBe('queued')
  })

  it('rejected 不被证据洗白', () => {
    const t = make()
    t.accept({ inputId: 'in-A', disposition: 'rejected' })
    expect(t.noteEvidence('done').phase).toBe('rejected')
  })
})

describe('tracker.settle:零证据的失败收场必须落 unconfirmed', () => {
  const make = () => createSendAdmissionTracker({ inputId: 'in-A', messageId: 'm-A' })

  it('answered ⇒ admitted(有回答就是最强证据)', () => {
    const t = make()
    expect(t.settle('answered').phase).toBe('admitted')
  })

  it.each(['failed', 'aborted'] as const)('%s 且零证据 ⇒ unconfirmed', (outcome) => {
    const t = make()
    expect(t.settle(outcome).phase).toBe('unconfirmed')
  })

  it('已 admitted 的收场不改变准入归属(答没答完是另一维)', () => {
    const t = make()
    t.accept({ inputId: 'in-A', disposition: 'accepted' })
    expect(t.settle('failed').phase).toBe('admitted')
  })

  it('rejected 的收场不改变终态', () => {
    const t = make()
    t.accept({ inputId: 'in-A', disposition: 'rejected' })
    expect(t.settle('answered').phase).toBe('rejected')
  })
})

describe('metaPatch / readAdmissionPhaseFromMeta:落盘与回读对称', () => {
  it('patch 带 inputId + phase,回执存在时附 disposition', () => {
    const t = createSendAdmissionTracker({ inputId: 'in-A', messageId: 'm-A' })
    expect(t.metaPatch()).toEqual({ admission: { inputId: 'in-A', phase: 'tentative' } })
    t.accept({ inputId: 'in-A', disposition: 'queued', queuedTurnId: 'q-1' })
    expect(t.metaPatch()).toEqual({
      admission: {
        inputId: 'in-A',
        phase: 'queued',
        disposition: 'queued',
        queuedTurnId: 'q-1',
      },
    })
  })

  it('rejected 的 reason 一并落盘(排障要看码)', () => {
    const t = createSendAdmissionTracker({ inputId: 'in-A', messageId: 'm-A' })
    t.accept({ inputId: 'in-A', disposition: 'rejected', reason: 'BAD_PARAMS' })
    const meta = t.metaPatch()
    expect((meta.admission as Record<string, unknown>).reason).toBe('BAD_PARAMS')
    expect(readAdmissionPhaseFromMeta(meta)).toBe('rejected')
  })

  it('五态回读全部成立', () => {
    for (const phase of ADMISSION_PHASES) {
      expect(readAdmissionPhaseFromMeta({ admission: { inputId: 'x', phase } }), phase).toBe(phase)
    }
  })

  it('老消息(无该格)⇒ null,不得回落 tentative', () => {
    expect(readAdmissionPhaseFromMeta(undefined)).toBeNull()
    expect(readAdmissionPhaseFromMeta({})).toBeNull()
    expect(readAdmissionPhaseFromMeta({ admission: null })).toBeNull()
    expect(readAdmissionPhaseFromMeta({ admission: { inputId: 'x' } })).toBeNull()
    expect(readAdmissionPhaseFromMeta({ admission: { phase: 'unknown' } })).toBeNull()
  })
})

describe('wire 声明:事件名不得与本仓既有事件撞', () => {
  it('SSE_ADMISSION_EVENT 是 snake/单段小写形态(与 steer / budget 同族)', () => {
    expect(SSE_ADMISSION_EVENT).toBe('admission')
    expect(/^[a-z][a-z0-9_]*$/.test(SSE_ADMISSION_EVENT)).toBe(true)
  })

  it('四档与五态是两个独立词表(不得互换)', () => {
    const dispositions = new Set<string>(ADMISSION_DISPOSITIONS)
    const phases = new Set<string>(ADMISSION_PHASES)
    // 允许重叠的只有语义真同名的两档:queued(排队)/ rejected(被拒)
    const overlap = [...dispositions].filter((d) => phases.has(d)).sort()
    expect(overlap).toEqual(['queued', 'rejected'])
    // 两表各自独有的档不得串门
    expect(dispositions.has('tentative')).toBe(false)
    expect(dispositions.has('unconfirmed')).toBe(false)
    expect(phases.has('duplicate')).toBe(false)
    expect(phases.has('accepted')).toBe(false)
  })
})

describe('类型面:disposition 是闭集(编译期 + 运行期双钉)', () => {
  it('联合类型成员数 = 常量数组长度', () => {
    const all: AdmissionDisposition[] = ['accepted', 'queued', 'rejected', 'duplicate']
    expect(all.length).toBe(ADMISSION_DISPOSITIONS.length)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
