// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-816008 成对测试:待对账命令账本。
 *
 * 票面三条判据:
 * ① accepted 后刷新 ⇒ 重发提示出现,且 queue 命中该 sourceCommandId 即消失;
 * ② queue 里查不到 ⇒ 不得静默丢弃(反向锁:静默丢等于把"没送到"洗成"没这回事");
 * ③ 账本 JSON 损坏 ⇒ 聊天仍可用(不得让账本成为聊新的单点)。
 * 另钉:TTL 锚定首次登记时间,reload/reconcile 不得续期(上游 :128-129)。
 */
import { describe, it, expect } from 'vitest'
import {
  createPendingCommandLedger,
  type PendingCommandStorage,
} from '../pending-command-registry'

/** 内存 storage(各用例独立实例)。 */
function makeStorage(initial: Record<string, string> = {}): PendingCommandStorage & { data: Map<string, string> } {
  const data = new Map<string, string>(Object.entries(initial))
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value)
    },
    removeItem: (key) => {
      data.delete(key)
    },
  }
}

/** 可拨动的时钟。 */
function makeClock(start = 1_000_000) {
  let current = start
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms
    },
  }
}

describe('G-816008 待对账命令账本', () => {
  it('① register 后"刷新"(同 storage 新实例)⇒ 条目仍在;queue 命中 sourceCommandId ⇒ 结算消失', () => {
    const storage = makeStorage()
    const clock = makeClock()
    const before = createPendingCommandLedger({ storage, now: clock.now })
    before.register({ commandId: 'cmd-1', conversationId: 'conv-1', preview: '帮我查一下' })

    // 模拟刷新:同 storage 起一个新账本实例(首次登记时间锚保留)
    const after = createPendingCommandLedger({ storage, now: clock.now })
    expect(after.list()).toHaveLength(1)
    expect(after.list()[0]!.commandId).toBe('cmd-1')

    // queue 投影还没到 ⇒ 出重发提示材料
    const miss = after.reconcile([])
    expect(miss.unacknowledged).toHaveLength(1)
    expect(miss.settled).toHaveLength(0)

    // queue 投影带上该 sourceCommandId ⇒ 权威接收证据,条目即消失
    const hit = after.reconcile([{ sourceCommandId: 'cmd-1' }])
    expect(hit.settled).toEqual(['cmd-1'])
    expect(hit.unacknowledged).toHaveLength(0)
    expect(after.list()).toHaveLength(0)
  })

  it('② queue 里查不到 ⇒ 不得静默丢弃:unacknowledged 必须带出该条,且条目保留在账本', () => {
    const storage = makeStorage()
    const clock = makeClock()
    const ledger = createPendingCommandLedger({ storage, now: clock.now })
    ledger.register({ commandId: 'cmd-2', conversationId: 'conv-1', preview: '再查一遍' })

    const result = ledger.reconcile([{ sourceCommandId: '别的命令' }])
    // 反向锁:查不到必须浮出水面,不得把"没送到"洗成"没这回事"
    expect(result.unacknowledged.map((r) => r.commandId)).toEqual(['cmd-2'])
    expect(ledger.list()).toHaveLength(1)
    // 无关命中不得误结算
    expect(result.settled).toHaveLength(0)
  })

  it('③ 账本 JSON 损坏 ⇒ 清账不抛错,聊天(登记/对账)照常可用', () => {
    const storage = makeStorage({ 'ihui-pending-commands': '{not-valid-json!!' })
    const clock = makeClock()
    const ledger = createPendingCommandLedger({ storage, now: clock.now })
    // 读损坏账本:空、不抛
    expect(ledger.list()).toEqual([])
    expect(storage.data.has('ihui-pending-commands')).toBe(false)
    // 损坏清账后聊天照常:登记、对账全链路可用
    ledger.register({ commandId: 'cmd-3', conversationId: 'conv-2', preview: '继续聊' })
    expect(ledger.list()).toHaveLength(1)
    const hit = ledger.reconcile([{ sourceCommandId: 'cmd-3' }])
    expect(hit.settled).toEqual(['cmd-3'])

    // 形状损坏(数组里混入非条目)⇒ 静默清掉坏条目,好条目保留
    const mixed = makeStorage()
    mixed.setItem(
      'ihui-pending-commands',
      JSON.stringify([{ commandId: 'ok-1', conversationId: 'c', preview: 'p', firstRegisteredAt: clock.now() }, 42, null]),
    )
    const ledger2 = createPendingCommandLedger({ storage: mixed, now: clock.now })
    expect(ledger2.list().map((r) => r.commandId)).toEqual(['ok-1'])

    // 非数组 JSON 同样清账不抛
    const blob = makeStorage({ 'ihui-pending-commands': '{"commandId":"x"}' })
    const ledger3 = createPendingCommandLedger({ storage: blob, now: clock.now })
    expect(ledger3.list()).toEqual([])
  })

  it('④ TTL 锚定首次登记时间:重复登记与 reload/reconcile 都不得续期,过期即清', () => {
    const storage = makeStorage()
    const clock = makeClock()
    const ledger = createPendingCommandLedger({ storage, now: clock.now, ttlMs: 1_000 })
    ledger.register({ commandId: 'cmd-4', conversationId: 'c', preview: '第一条' })
    const anchoredAt = ledger.list()[0]!.firstRegisteredAt

    clock.advance(400)
    // 重复登记不得续期
    ledger.register({ commandId: 'cmd-4', conversationId: 'c', preview: '重复登记' })
    expect(ledger.list()[0]!.firstRegisteredAt).toBe(anchoredAt)
    // reload(新实例)+ reconcile 也不得续期
    const reloaded = createPendingCommandLedger({ storage, now: clock.now, ttlMs: 1_000 })
    reloaded.reconcile([])
    expect(reloaded.list()[0]!.firstRegisteredAt).toBe(anchoredAt)

    clock.advance(700) // 距首次登记 1100ms > TTL
    expect(ledger.list()).toEqual([])
    expect(storage.data.has('ihui-pending-commands')).toBe(false)
  })

  it('⑤ storage 写失败/读失败 ⇒ 账本静默降级,不得向聊天链路抛错', () => {
    const boom: PendingCommandStorage = {
      getItem: () => {
        throw new Error('storage broken')
      },
      setItem: () => {
        throw new Error('storage broken')
      },
      removeItem: () => {
        throw new Error('storage broken')
      },
    }
    const ledger = createPendingCommandLedger({ storage: boom, now: () => 0 })
    expect(() => ledger.register({ commandId: 'cmd-5', conversationId: 'c', preview: 'p' })).not.toThrow()
    expect(() => ledger.list()).not.toThrow()
    expect(() => ledger.reconcile([])).not.toThrow()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
