// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D48(G-56)A 层:ihui-chat 持久化 blob 的加密迁移 / 幂等 / 降级 / 零明文残留
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  createChatPersistStorage,
  createVaultBackedPersistStorage,
} from '@/lib/chat-persist-crypto'
import {
  openVaultText,
  parseVaultEnvelope,
  sealVaultText,
  type VaultEntryChannel,
} from '@/lib/local-vault'
import { ssrStorage } from '@/stores/persist-helpers'

const PERSIST_NAME = 'ihui-chat'

/** 真实消息正文样本(含中英混排 + emoji + JSON 引号,贴近 partialize 里 recentMessages.messages 的形态) */
const MESSAGE_TEXT = '请帮我复盘这份季度报表，重点看 GMV 环比 +18.6% 的原因 📊'
const DRAFT_TEXT = '草稿：把上面结论改写成三段话，别用表格'
const SIDE_QUESTION = '侧问：这个口径和上月一致吗？'

interface PersistedChatShape {
  currentModel: string
  conversationId: string | null
  draftInput: string | null
  inputHistory: string[]
  pendingDiffComments: Array<{ id: string; filePath: string; comment: string }>
  sideQueueByConversation: Record<string, string[]>
  failedDraft: string | null
  failedDraftStatus: string | null
  webSearchEnabled: boolean
  recentMessages: {
    conversationId: string
    messages: Array<{ id: string; role: string; content: string }>
  } | null
}

const SEED: PersistedChatShape = {
  currentModel: 'auto',
  conversationId: 'conv-9f2c41',
  draftInput: DRAFT_TEXT,
  inputHistory: ['第一条历史输入', '第二条历史输入'],
  pendingDiffComments: [{ id: 'c1', filePath: 'src/report.ts', comment: '这里的分母是不是写错了' }],
  sideQueueByConversation: { 'conv-9f2c41': [SIDE_QUESTION] },
  failedDraft: '发送失败后要回填的那句话',
  failedDraftStatus: 'network',
  webSearchEnabled: false,
  recentMessages: {
    conversationId: 'conv-9f2c41',
    messages: [
      { id: 'm1', role: 'user', content: '帮我看看这份报表' },
      { id: 'm2', role: 'assistant', content: MESSAGE_TEXT },
    ],
  },
}

interface SeedStore extends PersistedChatShape {
  setDraftInput: (value: string | null) => void
}

/**
 * 用**生产同款** serializer(zustand persist + ssrStorage + partialize)造夹具,
 * 而不是手写一份"看起来像"的 JSON —— 断言测的是真实落盘形态。
 */
function writeRealPersistedBlob(): string {
  const useSeedStore = create<SeedStore>()(
    persist(
      (set) => ({
        ...SEED,
        setDraftInput: (value) => set({ draftInput: value }),
      }),
      {
        name: PERSIST_NAME,
        storage: ssrStorage,
        version: 5,
        partialize: (s: SeedStore) => ({
          currentModel: s.currentModel,
          conversationId: s.conversationId,
          draftInput: s.draftInput,
          inputHistory: s.inputHistory,
          pendingDiffComments: s.pendingDiffComments,
          sideQueueByConversation: s.sideQueueByConversation,
          failedDraft: s.failedDraft,
          failedDraftStatus: s.failedDraftStatus,
          webSearchEnabled: s.webSearchEnabled,
          recentMessages: s.recentMessages,
        }),
      },
    ),
  )
  // persist 只在 set 时写盘;改一次再改回来,产出的就是 partialize 后的原样 blob
  useSeedStore.getState().setDraftInput(null)
  useSeedStore.getState().setDraftInput(DRAFT_TEXT)
  const blob = window.localStorage.getItem(PERSIST_NAME)
  expect(typeof blob).toBe('string')
  return blob as string
}

function makeFakeChannel(): {
  channel: VaultEntryChannel
  entries: Map<string, string>
  breakReads: () => void
} {
  const entries = new Map<string, string>()
  let broken = false
  return {
    entries,
    breakReads: () => {
      broken = true
    },
    channel: {
      async read(_f: string, key: string) {
        if (broken) return { status: 'error' as const }
        const value = entries.get(key)
        return { status: 'ok' as const, value: value ?? null }
      },
      async write(_f: string, key: string, value: string | null) {
        if (broken) return true
        if (value === null) entries.delete(key)
        else entries.set(key, value)
        return true
      },
    },
  }
}

function encryptedStorage(channel: VaultEntryChannel) {
  const storage = createVaultBackedPersistStorage<unknown>({
    base: ssrStorage,
    kv: window.localStorage,
    isDesktop: true,
    channel,
  })
  if (!storage) throw new Error('桌面端路径必须返回 storage 实例')
  return storage
}

const PLAINTEXT_MARKERS = [
  MESSAGE_TEXT,
  DRAFT_TEXT,
  SIDE_QUESTION,
  '帮我看看这份报表',
  '这里的分母是不是写错了',
  'conv-9f2c41',
  // 整个 {state,version} 都被封进 ct ⇒ 字段名同样不得残留
  'conversationId',
  'recentMessages',
  'pendingDiffComments',
]

beforeEach(() => {
  window.localStorage.clear()
})

describe('D48 · 存量明文一次性加密迁移', () => {
  it('夹具基线:改造前 ihui-chat 是可直接读出的明文 JSON', () => {
    const blob = writeRealPersistedBlob()
    expect(JSON.parse(blob)).toMatchObject({ version: 5 })
    expect(blob).toContain(MESSAGE_TEXT)
    expect(blob).toContain('conversationId')
  })

  it('首次读即迁移:返回正确的 state,同时把 kv 换成信封', async () => {
    const blob = writeRealPersistedBlob()
    const { channel } = makeFakeChannel()
    const storage = encryptedStorage(channel)

    const value = await storage.getItem(PERSIST_NAME)
    expect(value).not.toBeNull()
    expect(value?.state).toMatchObject({ conversationId: 'conv-9f2c41', draftInput: DRAFT_TEXT })
    expect((value?.state as PersistedChatShape).recentMessages?.messages[1]?.content).toBe(
      MESSAGE_TEXT,
    )
    expect(value?.version).toBe(5)

    const after = window.localStorage.getItem(PERSIST_NAME)
    expect(after).not.toBe(blob)
    expect(parseVaultEnvelope(after ?? '')).not.toBeNull()
  })

  it('迁移后零明文残留:kv 里 grep 不到任何一段会话正文/字段名', async () => {
    writeRealPersistedBlob()
    const { channel } = makeFakeChannel()
    const storage = encryptedStorage(channel)
    await storage.getItem(PERSIST_NAME)

    const stored = window.localStorage.getItem(PERSIST_NAME) ?? ''
    for (const marker of PLAINTEXT_MARKERS) {
      expect(stored).not.toContain(marker)
    }
    // 整条 localStorage(含旁路键)都不得残留正文
    const everything = Object.keys(window.localStorage)
      .map((k) => `${k}=${window.localStorage.getItem(k) ?? ''}`)
      .join('\n')
    for (const marker of PLAINTEXT_MARKERS) {
      expect(everything).not.toContain(marker)
    }
  })

  it('迁移失败(密钥通道不可用)⇒ 原文照旧可读,不丢用户数据', async () => {
    writeRealPersistedBlob()
    const { channel, breakReads } = makeFakeChannel()
    breakReads()
    const storage = encryptedStorage(channel)

    const value = await storage.getItem(PERSIST_NAME)
    expect(value?.state).toMatchObject({ conversationId: 'conv-9f2c41' })
    // 仍是明文,没被半截加密覆盖
    expect(window.localStorage.getItem(PERSIST_NAME)).toContain(MESSAGE_TEXT)
  })
})

describe('D48 · 幂等(判据是"恰一份",不是"存在密文")', () => {
  it('重复读 N 次 + 写一次,层数恒为 1(不叠加)', async () => {
    writeRealPersistedBlob()
    const { channel } = makeFakeChannel()
    const storage = encryptedStorage(channel)

    for (let i = 0; i < 5; i++) await storage.getItem(PERSIST_NAME)
    let stored = window.localStorage.getItem(PERSIST_NAME) ?? ''
    expect((await openVaultText('chat-persist', stored, channel)).kind).toBe('sealed')
    expect(parseVaultEnvelope(stored)?.kid).toBeTruthy()

    await storage.setItem(PERSIST_NAME, { state: { hello: 'world' }, version: 5 })
    stored = window.localStorage.getItem(PERSIST_NAME) ?? ''
    const opened = await openVaultText('chat-persist', stored, channel)
    expect(opened).toEqual({
      kind: 'sealed',
      text: JSON.stringify({ state: { hello: 'world' }, version: 5 }),
      layers: 1,
    })
    expect(stored.match(/ihuiVaultV1/g) ?? []).toHaveLength(1)
  })

  it('预先双重包裹的历史产物:读一次即归正为恰一份(不是变三层)', async () => {
    const plaintext = JSON.stringify({ state: SEED, version: 5 })
    const { channel } = makeFakeChannel()
    const once = (await sealVaultText('chat-persist', plaintext, channel)) as string
    const twice = (await sealVaultText('chat-persist', once, channel)) as string
    window.localStorage.setItem(PERSIST_NAME, twice)
    expect((await openVaultText('chat-persist', twice, channel)).kind).toBe('sealed')

    const storage = encryptedStorage(channel)
    const value = await storage.getItem(PERSIST_NAME)
    expect(value?.state).toMatchObject({ conversationId: 'conv-9f2c41' })

    const normalized = window.localStorage.getItem(PERSIST_NAME) ?? ''
    const opened = await openVaultText('chat-persist', normalized, channel)
    expect(opened.kind).toBe('sealed')
    if (opened.kind === 'sealed') expect(opened.layers).toBe(1)
    expect(opened.kind === 'sealed' ? opened.text : null).toBe(plaintext)
    expect(normalized.match(/ihuiVaultV1/g) ?? []).toHaveLength(1)
  })

  it('迁移只在"恰无信封"那一支发生:同一份明文不会被二次改写', async () => {
    writeRealPersistedBlob()
    const { channel } = makeFakeChannel()
    const storage = encryptedStorage(channel)
    await storage.getItem(PERSIST_NAME)
    const migrated = window.localStorage.getItem(PERSIST_NAME)
    await storage.getItem(PERSIST_NAME)
    await storage.getItem(PERSIST_NAME)
    expect(window.localStorage.getItem(PERSIST_NAME)).toBe(migrated)
  })
})

describe('D48 · 解锁失败降级(可读空态,不崩)', () => {
  it('密文解不开:getItem 返回 null 且不抛错,原密文进旁路键', async () => {
    const { channel } = makeFakeChannel()
    const sealed = (await sealVaultText(
      'chat-persist',
      JSON.stringify({ state: SEED, version: 5 }),
      channel,
    )) as string
    window.localStorage.setItem(PERSIST_NAME, sealed)

    // 密钥换了一把(模拟重装/主密钥丢失后重新引导)⇒ 旧密文不可解
    const other = makeFakeChannel()
    const storage = encryptedStorage(other.channel)
    let value: unknown = 'not-called'
    await expect(storage.getItem(PERSIST_NAME)).resolves.toBeNull()
    value = await storage.getItem(PERSIST_NAME)
    expect(value).toBeNull()
    expect(window.localStorage.getItem(`${PERSIST_NAME}.unreadable`)).toBe(sealed)
  })

  it('降级后仍可写新数据,并顺手清掉旁路残留', async () => {
    const { channel } = makeFakeChannel()
    const sealed = (await sealVaultText(
      'chat-persist',
      JSON.stringify({ state: SEED, version: 5 }),
      channel,
    )) as string
    window.localStorage.setItem(PERSIST_NAME, sealed)
    const storage = encryptedStorage(makeFakeChannel().channel)

    await storage.getItem(PERSIST_NAME)
    expect(window.localStorage.getItem(`${PERSIST_NAME}.unreadable`)).not.toBeNull()
    await storage.setItem(PERSIST_NAME, { state: { fresh: true }, version: 5 })
    expect(window.localStorage.getItem(`${PERSIST_NAME}.unreadable`)).toBeNull()
    expect(window.localStorage.getItem(PERSIST_NAME)).not.toContain('"fresh":true')
  })

  it('kv 读抛错 / 空 kv:一律 null,不冒泡到渲染路径', async () => {
    const { channel } = makeFakeChannel()
    const throwing = createVaultBackedPersistStorage<unknown>({
      base: ssrStorage,
      kv: {
        getItem: () => {
          throw new Error('SecurityError: localStorage 被禁用')
        },
        setItem: () => {},
        removeItem: () => {},
      },
      isDesktop: true,
      channel,
    })
    await expect(throwing?.getItem(PERSIST_NAME)).resolves.toBeNull()
    await expect(
      throwing?.setItem(PERSIST_NAME, { state: {}, version: 5 }),
    ).resolves.toBeUndefined()
  })

  it('解出来不是合法 JSON ⇒ 按"无缓存"处理(不抛)', async () => {
    const { channel } = makeFakeChannel()
    const sealed = (await sealVaultText('chat-persist', 'not-json-at-all', channel)) as string
    window.localStorage.setItem(PERSIST_NAME, sealed)
    const storage = encryptedStorage(channel)
    await expect(storage.getItem(PERSIST_NAME)).resolves.toBeNull()
  })
})

describe('D48 · 端隔离', () => {
  it('浏览器路径:createChatPersistStorage 原样返回 base(对象同一)', () => {
    expect('__TAURI_INTERNALS__' in window).toBe(false)
    expect(createChatPersistStorage(ssrStorage)).toBe(ssrStorage)
  })

  it('桌面端:整条 blob 走 zustand 的异步 hydration 仍能预填充(生产链路可用)', async () => {
    writeRealPersistedBlob()
    const { channel } = makeFakeChannel()
    const storage = createVaultBackedPersistStorage<PersistedChatShape>({
      base: undefined,
      kv: window.localStorage,
      isDesktop: true,
      channel,
    })
    if (!storage) throw new Error('桌面端必须返回加密 storage')

    const useRestored = create<PersistedChatShape>()(
      persist(() => ({ ...SEED }), {
        name: PERSIST_NAME,
        storage,
        version: 5,
        partialize: (s: PersistedChatShape) => s,
      }),
    )
    // getItem 现在是异步的:zustand 会 await;等到值到位即证明 async transport 接得上
    await vi.waitFor(() => {
      expect(useRestored.getState().draftInput).toBe(DRAFT_TEXT)
    })
    expect(useRestored.getState().recentMessages?.messages[1]?.content).toBe(MESSAGE_TEXT)
  })

  it('localStorage 属性访问就抛(受限站点)⇒ 初始化不得冒泡,退回 base', () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage')
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError: localStorage 被禁用')
      },
    })
    try {
      expect(() => createChatPersistStorage(ssrStorage)).not.toThrow()
      expect(createChatPersistStorage(ssrStorage)).toBe(ssrStorage)
    } finally {
      if (descriptor) Object.defineProperty(window, 'localStorage', descriptor)
    }
  })
})

describe('D48 · 异步写入仍保序(后写覆盖先写)', () => {
  it('第一次写要等密钥引导,慢于第二次 ⇒ 最终落盘的仍是第二次', async () => {
    const entries = new Map<string, string>()
    let firstRead = true
    const channel: VaultEntryChannel = {
      async read(_f, key) {
        if (firstRead) {
          firstRead = false
          await new Promise((r) => setTimeout(r, 30)) // 慢通道:模拟首次 load() 走 IPC
        }
        return { status: 'ok', value: entries.get(key) ?? null }
      },
      async write(_f, key, value) {
        if (value === null) entries.delete(key)
        else entries.set(key, value)
        return true
      },
    }
    const storage = encryptedStorage(channel)

    // 故意不 await:两次写在同一 tick 排队(流式期间 zustand 就是这个形态)
    const first = storage.setItem(PERSIST_NAME, { state: { seq: '第一次' }, version: 5 })
    const second = storage.setItem(PERSIST_NAME, { state: { seq: '第二次' }, version: 5 })
    await Promise.all([first, second])

    const opened = await openVaultText(
      'chat-persist',
      window.localStorage.getItem(PERSIST_NAME) ?? '',
      channel,
    )
    expect(opened.kind).toBe('sealed')
    expect(opened.kind === 'sealed' ? opened.text : '').toContain('第二次')
    expect(opened.kind === 'sealed' ? opened.text : '').not.toContain('第一次')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
