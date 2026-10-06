// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  createChatDraftStorage,
  type ChatDraftStorage,
  type DraftKvStore,
} from '@/lib/chat-draft-storage'
import { parseVaultEnvelope, type VaultEntryChannel } from '@/lib/local-vault'

// O59⑤:`chat:draft*` 过去走裸 localStorage,桌面端明文落盘(盘上证据:键 `chat:draft`
// 值 `请将以下内容翻译为英文`)。本测试锁住"改完不许再回明文"以及四条硬要求。

/** 内存 kv:能直接看盘上形态,用来断言"盘上有没有明文" */
function makeKv(): DraftKvStore & { dump(): Record<string, string> } {
  const m = new Map<string, string>()
  return {
    getItem: (k) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    dump: () => Object.fromEntries(m),
  }
}

/** 内存密钥通道:真跑 WebCrypto(HKDF + AES-GCM),只是把 Tauri store 换成 Map */
function makeRealChannel(): VaultEntryChannel {
  const entries = new Map<string, string>()
  return {
    async read(_f: string, key: string) {
      const value = entries.get(key)
      if (typeof value === 'string' && value.length > 0) return { status: 'ok' as const, value }
      return { status: 'ok' as const, value: null }
    },
    async write(_f: string, key: string, value: string | null) {
      if (value === null) entries.delete(key)
      else entries.set(key, value)
      return true
    },
  }
}

function makeBrokenChannel(): VaultEntryChannel {
  return {
    async read() {
      return { status: 'error' as const }
    },
    async write() {
      return false
    },
  }
}

const KEY = 'chat:draft:conv-a'
/** 真实用户会打进去的中文草稿 */
const SECRET = '请将以下内容翻译为英文，不要用表格'

describe('chat:draft 加密通道(桌面端)', () => {
  let kv: ReturnType<typeof makeKv>
  let store: ChatDraftStorage

  beforeEach(() => {
    kv = makeKv()
    store = createChatDraftStorage({ kv, isDesktop: true, channel: makeRealChannel() })
  })

  it('写入后盘上是信封不是明文,且读回原值', async () => {
    await store.write(KEY, SECRET)
    const raw = kv.getItem(KEY)
    expect(raw).not.toBeNull()
    expect(raw).not.toContain('翻译')
    expect(raw).not.toContain(SECRET)
    // 结构级判据:必须是合规信封
    expect(parseVaultEnvelope(raw as string)).not.toBeNull()
    expect(await store.read(KEY)).toBe(SECRET)
  })

  it('明文一次性迁移:存量明文被读时 seal 回写,且原文仍可用', async () => {
    kv.setItem(KEY, SECRET) // 改造前的存量形态
    expect(await store.read(KEY)).toBe(SECRET)
    // 迁移后盘上必须已是密文(下次启动不再有明文)
    const raw = kv.getItem(KEY) as string
    expect(raw).not.toContain('翻译')
    expect(parseVaultEnvelope(raw)).not.toBeNull()
  })

  it('迁移幂等:已是密文时读不应再叠一层', async () => {
    await store.write(KEY, SECRET)
    const once = kv.getItem(KEY) as string
    await store.read(KEY)
    expect(kv.getItem(KEY)).toBe(once) // 逐字不变 ⇒ 没多包一层
  })

  it('密钥通道不可用:写明文兜底,绝不静默丢草稿', async () => {
    const fallback = createChatDraftStorage({ kv, isDesktop: true, channel: makeBrokenChannel() })
    await fallback.write(KEY, SECRET)
    expect(kv.getItem(KEY)).toBe(SECRET) // 退回改造前行为
    expect(await fallback.read(KEY)).toBe(SECRET)
  })

  it('密文解不开:降级空态 + 现场留旁路键(不抛错)', async () => {
    const broken = createChatDraftStorage({ kv, isDesktop: true, channel: makeBrokenChannel() })
    await broken.write(KEY, SECRET) // 通道坏 ⇒ 落明文
    // 现在把盘上内容换成"解不开的密文"形态
    kv.setItem(
      KEY,
      JSON.stringify({
        ihuiVaultV1: { alg: 'A256GCM', kid: 'deadbeefdeadbeef', iv: 'AA', ct: 'BB' },
      }),
    )
    expect(await broken.read(KEY)).toBe('')
    expect(kv.getItem(`${KEY}.unreadable`)).not.toBeNull()
  })

  it('写序:连续两次写入,后写覆盖先写(不得旧值复活)', async () => {
    await store.write(KEY, '第一版')
    await store.write(KEY, '第二版')
    expect(await store.read(KEY)).toBe('第二版')
  })

  it('remove 必须入队:已入队的旧写入不得在删除后把草稿复活', async () => {
    // 这是本轮刻意防的数据复活 bug:写入排队中 → remove 同步删 → 队列落盘 → 草稿复活。
    // 断言口径是"remove 之后最终盘上必须空",而 remove 故意不 await(见 clearDraft 注释)。
    const inflight = store.write(KEY, SECRET)
    const removed = store.remove(KEY)
    await Promise.all([inflight, removed])
    expect(kv.getItem(KEY)).toBeNull()
    expect(await store.read(KEY)).toBe('')
  })

  it('空串写入等价于清桶', async () => {
    await store.write(KEY, SECRET)
    await store.write(KEY, '')
    expect(kv.getItem(KEY)).toBeNull()
  })

  it('桌面端 peekSync 恒为 null(密文同步解不开)', () => {
    void store.write(KEY, SECRET)
    expect(store.peekSync(KEY)).toBeNull()
  })

  it('缺桶 / 非字符串一律空态,不抛错', async () => {
    expect(await store.read('chat:draft:不存在')).toBe('')
  })
})

describe('域隔离(防共用子密钥)', () => {
  // 这组用例的由来:work-panel 那张票的初版域隔离断言**与入口函数解耦** ——
  // 只测 `openVaultText(域A, 域B的密文)`,而入口函数实际指向哪个域它测不出来,
  // 变异「把入口的 domain 改成别的域」首次跑存活。本组用例逐个试**全部**已知域,
  // 直接绑定入口函数,让那种变异必红。
  const DOMAINS = [
    'chat-draft',
    'chat-prompt-history',
    'chat-persist',
    'goal-persist',
    'auth-persist',
    'work-panel-persist',
    'refresh-token',
  ] as const

  it('每个域写出的密文,只有本域的通道能读出来', async () => {
    const channel = makeRealChannel()
    const kvA = makeKv()
    const kvB = makeKv()
    await createChatDraftStorage({ kv: kvA, isDesktop: true, channel, domain: 'chat-draft' }).write(
      KEY,
      SECRET,
    )
    for (const d of DOMAINS) {
      if (d === 'chat-draft') continue
      const other = createChatDraftStorage({ kv: kvB, isDesktop: true, channel, domain: d })
      // 把密文搬进对方域的存储里读
      kvB.setItem(KEY, kvA.getItem(KEY) as string)
      expect(await other.read(KEY), `${d} 域竟解开了 chat-draft 的密文:子密钥被共用`).toBe('')
    }
  })

  // 「DOMAIN_INFO 漏一项」这条不写运行期断言:该常量是模块私有的,取不到;
  // 真正的保障是 (a) 上面那条逐域互解测试(漏配 info 会让两域派生出同一把钥匙 ⇒必红),
  // (b) 静态层`DOMAIN_INFO: Record<VaultDomain, string>` 类型标注(漏一项 tsc 就红)。
  // 硬凑一条 `expect(7).toBe(7)` 式的自证断言只会给人"已覆盖"的错觉。

  it('getChatDraftStorage 按域返回不同实例(队列与域都分开)', async () => {
    const { getChatDraftStorage, __resetChatDraftStorageForTest } =
      await import('@/lib/chat-draft-storage')
    __resetChatDraftStorageForTest()
    const a = getChatDraftStorage('chat-draft')
    const b = getChatDraftStorage('chat-prompt-history')
    expect(a).not.toBe(b)
    expect(getChatDraftStorage('chat-draft')).toBe(a) // 同一域仍复用(队列才有效)
    __resetChatDraftStorageForTest()
  })
})

describe('chat:draft 通道(浏览器路径零行为变更)', () => {
  it('非桌面端:明文同步读写,peekSync 给出真值', async () => {
    const kv = makeKv()
    const store = createChatDraftStorage({ kv, isDesktop: false })
    await store.write(KEY, SECRET)
    expect(kv.getItem(KEY)).toBe(SECRET)
    expect(store.peekSync(KEY)).toBe(SECRET)
    expect(await store.read(KEY)).toBe(SECRET)
  })

  it('非桌面端:空串清桶', async () => {
    const kv = makeKv()
    const store = createChatDraftStorage({ kv, isDesktop: false })
    await store.write(KEY, SECRET)
    await store.write(KEY, '')
    expect(kv.getItem(KEY)).toBeNull()
  })

  it('无 kv(SSR/隐私模式):全部退化为空态,不抛错', async () => {
    const store = createChatDraftStorage({ kv: null, isDesktop: true })
    expect(await store.read(KEY)).toBe('')
    await expect(store.write(KEY, SECRET)).resolves.toBeUndefined()
    await expect(store.remove(KEY)).resolves.toBeUndefined()
  })

  it('kv 抛异常(隐私模式):降级不崩', async () => {
    const throwing: DraftKvStore = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('SecurityError')
      },
      removeItem: () => {
        throw new Error('SecurityError')
      },
    }
    const store = createChatDraftStorage({ kv: throwing, isDesktop: false })
    expect(await store.read(KEY)).toBe('')
    await expect(store.write(KEY, SECRET)).resolves.toBeUndefined()
    expect(store.peekSync(KEY)).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
