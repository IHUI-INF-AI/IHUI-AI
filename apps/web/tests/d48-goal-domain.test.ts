// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D48(G-56)残余收口:ihui-goal 加密 + HKDF 域隔离(跨域密文互不可解)
import { describe, expect, it } from 'vitest'
import {
  createGoalPersistStorage,
  createVaultBackedPersistStorage,
  type VaultKvStore,
} from '@/lib/chat-persist-crypto'
import {
  openVaultText,
  parseVaultEnvelope,
  sealVaultText,
  type VaultEntryChannel,
} from '@/lib/local-vault'

const GOAL_TEXT = '本季目标：把对话流对标 Qoder 做到元素级一致，阻塞项是评测台未接'

function makeKv(): VaultKvStore & { map: Map<string, string> } {
  const map = new Map<string, string>()
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v)
    },
    removeItem: (k) => {
      map.delete(k)
    },
  }
}

function makeChannel(): VaultEntryChannel {
  const entries = new Map<string, string>()
  return {
    async read(_f: string, key: string) {
      return { status: 'ok', value: entries.get(key) ?? null }
    },
    async write(_f: string, key: string, value: string | null) {
      if (value === null) entries.delete(key)
      else entries.set(key, value)
      return true
    },
  }
}

function goalStorage(kv: VaultKvStore, channel: VaultEntryChannel) {
  return createVaultBackedPersistStorage<{ goal: string }>({
    base: undefined,
    kv,
    isDesktop: true,
    channel,
    domain: 'goal-persist',
  })!
}

describe('D48 goal 域加密', () => {
  it('浏览器(非桌面)路径原样返回 base,行为零变更', () => {
    const base = { getItem: () => null, setItem: () => {}, removeItem: () => {} } as never
    expect(createGoalPersistStorage(base)).toBe(base)
  })

  it('桌面端:落盘是信封且不含目标明文', async () => {
    const kv = makeKv()
    const st = goalStorage(kv, makeChannel())
    await st.setItem('ihui-goal', { state: { goal: GOAL_TEXT }, version: 0 })
    const stored = kv.map.get('ihui-goal')!
    expect(stored).not.toContain(GOAL_TEXT)
    expect(stored).not.toContain('对话流')
    expect(parseVaultEnvelope(stored)).not.toBeNull()
  })

  it('读回与原值逐字段相同', async () => {
    const kv = makeKv()
    const st = goalStorage(kv, makeChannel())
    const value = { state: { goal: GOAL_TEXT }, version: 0 }
    await st.setItem('ihui-goal', value)
    expect(await st.getItem('ihui-goal')).toEqual(value)
  })

  it('反复读写不会叠层(幂等判据是层数,不是"存在密文")', async () => {
    const kv = makeKv()
    const channel = makeChannel()
    const st = goalStorage(kv, channel)
    await st.setItem('ihui-goal', { state: { goal: GOAL_TEXT }, version: 0 })
    for (let i = 0; i < 3; i++) {
      await st.getItem('ihui-goal')
      await st.setItem('ihui-goal', { state: { goal: GOAL_TEXT + '·' + i }, version: 0 })
    }
    const opened = await openVaultText('goal-persist', kv.map.get('ihui-goal')!, channel)
    expect(opened.kind).toBe('sealed')
    if (opened.kind === 'sealed') {
      expect(opened.layers).toBe(1)
      expect((JSON.parse(opened.text) as { state: { goal: string } }).state.goal).toBe(
        GOAL_TEXT + '·2',
      )
    }
  })

  it('HKDF 域隔离:chat 密文在 goal 域读不出,反之亦然(不得共用子密钥)', async () => {
    const channel = makeChannel()
    const chatSealed = await sealVaultText('chat-persist', GOAL_TEXT, channel)
    expect(chatSealed).not.toBeNull()
    const kv = makeKv()
    kv.setItem('ihui-goal', chatSealed!)
    const goalSt = goalStorage(kv, channel)
    expect(await goalSt.getItem('ihui-goal')).toBeNull()
    // 原密文进旁路键,不得被静默丢弃
    expect(kv.getItem('ihui-goal.unreadable')).toBe(chatSealed!)

    const goalSealed = await sealVaultText('goal-persist', GOAL_TEXT, channel)
    const kv2 = makeKv()
    kv2.setItem('ihui-chat', goalSealed!)
    const chatSt = createVaultBackedPersistStorage<{ recentMessages: null }>({
      base: undefined,
      kv: kv2,
      isDesktop: true,
      channel,
      // domain 缺省即 'chat-persist'
    })!
    expect(await chatSt.getItem('ihui-chat')).toBeNull()
    expect(kv2.getItem('ihui-chat.unreadable')).toBe(goalSealed!)
  })

  it('无键时返回 null 而非抛错(解锁失败降级可读空态)', async () => {
    const st = goalStorage(makeKv(), makeChannel())
    expect(await st.getItem('ihui-goal')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
