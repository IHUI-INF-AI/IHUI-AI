// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `ihui-work-panel` 桌面端加密落盘(D48 同批收口,2026-10-06)
 *
 * 缺陷:work-panel store 过去用 `createPersistConfig` 的**默认 storage**,整块明文躺在
 * WebView localStorage;其中 `tabs[].title` / `favorites[].title` 是**用户自己起的
 * 工作区标签名**(盘上实测有中文残留),属用户可见个人数据。
 *
 * 本文件对四条硬要求逐条上牙:
 *  1. 浏览器路径:对象同一、盘上仍是明文 JSON(零行为变更)
 *  2. 桌面端:盘上是合法信封且不含任何中文明文
 *  3. 明文存量:读到即seal 回写,且不叠层
 *  4. HKDF 域:work-panel-persist 与 chat/goal/auth 互不可解
 *外加两条纪律项:降级不崩(通道拒/IPC 失败不抛错)、DOMAIN_INFO 不得漏项。
 *
 * 关键:桌面端那一组是**真跑 useWorkPanelStore**(真 localStorage + 真 WebCrypto +
 * mock 掉的 Tauri store通道),不是只测storage 函数 —— 否则store 少接一次线测试照样绿。
 */

// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createJSONStorage } from 'zustand/middleware'

vi.mock('@ihui/api-client', () => ({
  probeEmbed: vi.fn().mockResolvedValue({ success: true, data: { canEmbed: true } }),
  takeScreenshot: vi.fn().mockResolvedValue({ success: true, data: { screenshot: '' } }),
  browserHubBack: vi.fn().mockResolvedValue({ success: true, data: {} }),
  browserHubForward: vi.fn().mockResolvedValue({ success: true, data: {} }),
  browserHubReload: vi.fn().mockResolvedValue({ success: true, data: {} }),
  closeBrowserSession: vi.fn().mockResolvedValue({ success: true, data: {} }),
  createBrowserSession: vi.fn().mockResolvedValue({ success: true, data: {} }),
  buildEmbedProxyUrl: (targetUrl: string) =>
    `/api/embed-proxy/raw?url=${encodeURIComponent(targetUrl)}`,
}))

// Tauri 侧密钥通道:真跑 WebCrypto(HKDF + AES-GCM),只把 tauri-plugin-store 换成内存 Map
const tauriFiles = vi.hoisted(() => new Map<string, Map<string, unknown>>())
const storeMode = vi.hoisted(() => ({ broken: false }))

vi.mock('@tauri-apps/plugin-store', () => ({
  load: async (path: string) => {
    if (storeMode.broken) throw new Error('IPC denied: origin not in capability list')
    let entries = tauriFiles.get(path)
    if (!entries) {
      entries = new Map<string, unknown>()
      tauriFiles.set(path, entries)
    }
    return {
      get: async (key: string) => entries!.get(key),
      set: async (key: string, value: unknown) => {
        entries!.set(key, value)
      },
      delete: async (key: string) => {
        entries!.delete(key)
      },
      save: async () => {},
    }
  },
}))

import {
  createVaultBackedPersistStorage,
  createWorkPanelPersistStorage,
  type VaultKvStore,
} from '@/lib/chat-persist-crypto'
import {
  openVaultText,
  parseVaultEnvelope,
  sealVaultText,
  type VaultEntryChannel,
} from '@/lib/local-vault'

const KEY = 'ihui-work-panel'
/** 盘上实测过的形态:用户自己起的中文工作区标签名(巡检门 CJK 判据就是盯这个) */
const CJK_TITLE = '思否逆向登录页'
const CJK_URL = 'https://example.com/docs'

/* ------------------------------------------------------------------ 夹具 */

function makeKv(): VaultKvStore & { map: Map<string, string> } {
  const map = new Map<string, string>()
  return {
    map,
    getItem: (k) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  }
}

/** 可注入的内存密钥通道(与生产 Tauri store 同形,含"通道拒"模式) */
function makeChannel(): VaultEntryChannel {
  const entries = new Map<string, string>()
  return {
    async read(_f: string, key: string) {
      if (storeMode.broken) return { status: 'error' as const }
      const value = entries.get(key)
      if (typeof value === 'string' && value.length > 0) return { status: 'ok' as const, value }
      return { status: 'ok' as const, value: null }
    },
    async write(_f: string, key: string, value: string | null) {
      if (storeMode.broken) return false
      if (value === null) entries.delete(key)
      else entries.set(key, value)
      return true
    },
  }
}

/** 复刻 zustand persist 的真实序列化产物:`{state, version}` */
function persistedBlob(title: string, url: string) {
  return JSON.stringify({
    state: {
      tabs: [
        {
          id: 'tab-1',
          type: 'browser',
          title,
          url,
          history: [url],
          historyIndex: 0,
          state: { status: 'loading', url, mode: 'iframe' },
          closable: true,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      activeTabId: 'tab-1',
      favorites: [{ url, title, addedAt: 1 }],
      recentUrls: [{ url, title, visitedAt: 1 }],
    },
    version: 0,
  })
}

function workPanelStorage(kv: VaultKvStore, channel?: VaultEntryChannel) {
  return createVaultBackedPersistStorage<Record<string, unknown>>({
    base: undefined,
    kv,
    isDesktop: true,
    channel: channel ?? makeChannel(),
    domain: 'work-panel-persist',
  })!
}

async function waitFor(predicate: () => boolean, label: string, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (predicate()) return
    await new Promise((r) => setTimeout(r, 5))
  }
  throw new Error(`等待超时:${label}`)
}

/* ================================ 要求 1:浏览器路径明文 / 零行为变更 == */

describe('ihui-work-panel 加密 · 要求1 浏览器路径', () => {
  it('非桌面端原样返回 base(对象同一)', () => {
    const base = { getItem: () => null, setItem: () => {}, removeItem: () => {} } as never
    const w = window as unknown as Record<string, unknown>
    expect('__TAURI_INTERNALS__' in w).toBe(false)
    expect(createWorkPanelPersistStorage(base)).toBe(base)
  })

  it('非桌面端盘上是可读明文 JSON,不是信封', async () => {
    // 显式走浏览器路径:createWorkPanelPersistStorage 在无 __TAURI_INTERNALS__ 时
    // 原样返回 base,写入落到 base 自己的 kv —— 这里用真 ssrStorage 同形的 base
    // (createJSONStorage) 才能证明"浏览器端盘上就是明文 JSON"这条不变量。
    const st = createWorkPanelPersistStorage<{ tabs: { title: string }[] }>(
      createJSONStorage(() => window.localStorage),
    )!
    await st.setItem(KEY, { state: { tabs: [{ title: CJK_TITLE }] }, version: 0 })
    const stored = window.localStorage.getItem(KEY)!
    expect(parseVaultEnvelope(stored)).toBeNull()
    expect(stored).toContain(CJK_TITLE)
    expect(JSON.parse(stored).state.tabs[0].title).toBe(CJK_TITLE)
    window.localStorage.clear()
  })
})

/* ================================ 要求 2:桌面端盘上是信封 == */

describe('ihui-work-panel 加密 · 要求2 桌面端信封', () => {
  beforeEach(() => {
    storeMode.broken = false
  })

  it('写入后盘上是合法信封,中文标签名不落盘', async () => {
    const kv = makeKv()
    const st = workPanelStorage(kv)
    await st.setItem(KEY, JSON.parse(persistedBlob(CJK_TITLE, CJK_URL)))
    const stored = kv.map.get(KEY)!
    expect(parseVaultEnvelope(stored)).not.toBeNull()
    expect(stored).not.toContain(CJK_TITLE)
    expect(stored).not.toContain('工作区')
    // 键名本身也确认:别把别的键的密文写到这个键上
    expect(kv.map.has(KEY)).toBe(true)
  })

  it('读回逐字段相同(加密不改变 zustand 的 {state,version} 形态)', async () => {
    const kv = makeKv()
    const st = workPanelStorage(kv)
    const value = JSON.parse(persistedBlob(CJK_TITLE, CJK_URL))
    await st.setItem(KEY, value)
    expect(await st.getItem(KEY)).toEqual(value)
  })

  it('重复读不叠层(幂等判据是层数)', async () => {
    const kv = makeKv()
    const channel = makeChannel()
    const st = workPanelStorage(kv, channel)
    await st.setItem(KEY, JSON.parse(persistedBlob(CJK_TITLE, CJK_URL)))
    for (let i = 0; i < 3; i++) await st.getItem(KEY)
    const opened = await openVaultText('work-panel-persist', kv.map.get(KEY)!, channel)
    expect(opened.kind).toBe('sealed')
    if (opened.kind === 'sealed') expect(opened.layers).toBe(1)
  })
})

/* ================================ 要求 3:明文存量一次性迁移 == */

describe('ihui-work-panel 加密 · 要求3 明文存量迁移', () => {
  beforeEach(() => {
    storeMode.broken = false
  })

  it('读到明文存量 ⇒ 同一次读取内 seal 回写,且返回值仍是原状态', async () => {
    const kv = makeKv()
    kv.setItem(KEY, persistedBlob(CJK_TITLE, CJK_URL))
    const st = workPanelStorage(kv)

    const read = await st.getItem(KEY)
    expect(read).not.toBeNull()
    expect((read!.state as { tabs: { title: string }[] }).tabs[0]!.title).toBe(CJK_TITLE)

    const stored = kv.map.get(KEY)!
    expect(stored).not.toContain(CJK_TITLE) // 明文已离开盘面
    expect(parseVaultEnvelope(stored)).not.toBeNull()
    //迁移后的 blob 必须仍能读回同一状态(不得"迁移"成空态)
    expect(await st.getItem(KEY)).toEqual(read)
  })

  it('反复读存量不会叠层(只恰一份)', async () => {
    const kv = makeKv()
    const channel = makeChannel()
    kv.setItem(KEY, persistedBlob(CJK_TITLE, CJK_URL))
    const st = workPanelStorage(kv, channel)
    await st.getItem(KEY)
    const opened = await openVaultText('work-panel-persist', kv.map.get(KEY)!, channel)
    expect(opened.kind).toBe('sealed')
    if (opened.kind === 'sealed') expect(opened.layers).toBe(1)
  })
})

/* ================================ 要求 4:HKDF 域隔离 == */

/** 除本域外的全部既有域 —— 逐个试,才能咬住"入口函数指向了别的域"这种变异 */
const OTHER_DOMAINS = [
  'chat-persist',
  'goal-persist',
  'auth-persist',
  'chat-draft',
  'refresh-token',
] as const

describe('ihui-work-panel 加密 · 要求4 HKDF 域隔离', () => {
  /**
   * 绑定**入口函数**与本域:真跑 createWorkPanelPersistStorage(桌面端),
   * 把其它每一个域的密文喂到 ihui-work-panel 键上,必须全部读不出。
   *
   * 这条是"单开HKDF 域"的真判据。只测 `openVaultText('work-panel-persist', chat密文)`
   * 是不够的:那种写法与入口函数解耦,把 createWorkPanelPersistStorage 的 domain
   * 参数改成任意别的域(子密钥共用)测试照样绿 —— 本条会以 `unreadable` 落空而变红。
   */
  it('入口函数用的是本域:其它每一个域的密文都读不出(逐个试,防共用子密钥)', async () => {
    const w = window as unknown as Record<string, unknown>
    w.__TAURI_INTERNALS__ = {}
    try {
      const { createWorkPanelPersistStorage: fresh } = await import('@/lib/chat-persist-crypto')
      for (const domain of OTHER_DOMAINS) {
        const sealed = await sealVaultText(domain, persistedBlob(CJK_TITLE, CJK_URL))
        expect(sealed, `${domain} 域 seal 失败`).not.toBeNull()
        localStorage.setItem(KEY, sealed!)
        const st = fresh<Record<string, unknown>>(undefined)!
        expect(st, `${domain} 密文竞态`).toBeTruthy()
        expect(
          await st.getItem(KEY),
          `${domain} 域的密文被 work-panel 入口解开了 ⇒ 子密钥被共用`,
        ).toBeNull()
        localStorage.clear()
      }
    } finally {
      delete w.__TAURI_INTERNALS__
      localStorage.clear()
    }
  })

  it('入口函数写出的密文只有 work-panel-persist 域能解开', async () => {
    const w = window as unknown as Record<string, unknown>
    w.__TAURI_INTERNALS__ = {}
    try {
      const { createWorkPanelPersistStorage: fresh } = await import('@/lib/chat-persist-crypto')
      const st = fresh<Record<string, unknown>>(undefined)!
      await st.setItem(KEY, JSON.parse(persistedBlob(CJK_TITLE, CJK_URL)))
      const stored = localStorage.getItem(KEY)!
      expect(stored).not.toBeNull()
      // 其它域一律解不开
      for (const domain of OTHER_DOMAINS) {
        const opened = await openVaultText(domain, stored)
        expect(opened.kind, `${domain} 域竟解开了 work-panel 的密文`).toBe('unreadable')
      }
      // 本域能解开,且解出来就是原状态(证明上面不是"全都解不开"的假通过)
      const right = await openVaultText('work-panel-persist', stored)
      expect(right.kind).toBe('sealed')
      if (right.kind === 'sealed') {
        expect(right.layers).toBe(1)
        expect(JSON.parse(right.text).state.tabs[0].title).toBe(CJK_TITLE)
      }
    } finally {
      delete w.__TAURI_INTERNALS__
      localStorage.clear()
    }
  })

  it('chat 域密文在 work-panel 域解不开(不得共用子密钥)', async () => {
    const channel = makeChannel()
    const chatSealed = await sealVaultText('chat-persist', CJK_TITLE, channel)
    expect(chatSealed).not.toBeNull()
    const wrong = await openVaultText('work-panel-persist', chatSealed!, channel)
    expect(wrong.kind).toBe('unreadable')

    // 反向:work-panel 密文在 chat 域也解不开
    const wpSealed = await sealVaultText('work-panel-persist', CJK_TITLE, channel)
    const back = await openVaultText('chat-persist', wpSealed!, channel)
    expect(back.kind).toBe('unreadable')

    // 本域能解开(证明上面两断言不是"全都解不开"的假通过)
    const right = await openVaultText('work-panel-persist', wpSealed!, channel)
    expect(right.kind === 'sealed' && right.text).toBe(CJK_TITLE)
  })

  it('work-panel 域密文落到 chat 键上 ⇒ chat 读回空态且不抛错', async () => {
    const channel = makeChannel()
    const wpSealed = await sealVaultText('work-panel-persist', CJK_TITLE, channel)
    const kv = makeKv()
    kv.setItem('ihui-chat', wpSealed!)
    const chatSt = createVaultBackedPersistStorage<Record<string, unknown>>({
      base: undefined,
      kv,
      isDesktop: true,
      channel,
      domain: 'chat-persist',
    })!
    expect(await chatSt.getItem('ihui-chat')).toBeNull()
    expect(kv.getItem('ihui-chat.unreadable')).toBe(wpSealed!) // 现场保留,不静默丢弃
  })

  it('DOMAIN_INFO 与 VaultDomain 逐项对齐(漏一项 ⇒ HKDF info 变 undefined)', () => {
    const src = readFileSync(join(process.cwd(), 'src/lib/local-vault.ts'), 'utf8')
    const union = src.match(/export type VaultDomain =([\s\S]*?)\n\nconst DOMAIN_INFO/)?.[1] ?? ''
    const members = [...union.matchAll(/'([^']+)'/g)].map((m) => m[1]!)
    expect(members.length).toBeGreaterThanOrEqual(5)
    const table = src.match(/const DOMAIN_INFO[^=]*= \{([\s\S]*?)\n\}/)?.[1] ?? ''
    for (const domain of members) {
      expect(table, `DOMAIN_INFO 漏了 ${domain}`).toContain(`'${domain}':`)
    }
    // 反向:表里不得有联合之外的野条目(typo 会静默变垃圾 info)
    const keys = [...table.matchAll(/^\s*'([^']+)':/gm)].map((m) => m[1]!)
    expect(keys.sort()).toEqual([...members].sort())

    // 每域的 HKDF info 必须两两不同 —— 抄错成同一个字符串等于共用子密钥,
    // 且运行时完全静默(deriveKey 不会报错),只能靠这条静态比对咬住。
    const infos = [...table.matchAll(/^\s*'[^']+':\s*'([^']+)'/gm)].map((m) => m[1]!)
    expect(infos.length).toBe(members.length)
    expect(new Set(infos).size).toBe(members.length)
    for (const info of infos) expect(info).not.toContain('undefined')
  })
})

/* ================================ 纪律项:降级不崩 == */

describe('ihui-work-panel 加密 · 降级不崩', () => {
  beforeEach(() => {
    storeMode.broken = false
  })

  it('密钥通道拒(IPC 失败)⇒ 退回明文写入,不抛错、不丢数据', async () => {
    storeMode.broken = true
    const kv = makeKv()
    const st = workPanelStorage(kv)
    await expect(
      st.setItem(KEY, JSON.parse(persistedBlob(CJK_TITLE, CJK_URL))),
    ).resolves.toBeUndefined()
    expect(kv.map.get(KEY)).toContain(CJK_TITLE) // 退回改造前行为
  })

  it('通道拒时读明文存量⇒ 仍能读回原状态(不因迁移失败而丢数据)', async () => {
    const kv = makeKv()
    kv.setItem(KEY, persistedBlob(CJK_TITLE, CJK_URL))
    storeMode.broken = true
    const st = workPanelStorage(kv)
    const read = await st.getItem(KEY)
    expect((read!.state as { tabs: { title: string }[] }).tabs[0]!.title).toBe(CJK_TITLE)
    expect(kv.map.get(KEY)).toContain(CJK_TITLE) // 明文保持原样可用
  })

  it('无键时返回 null 而非抛错', async () => {
    const st = workPanelStorage(makeKv())
    expect(await st.getItem(KEY)).toBeNull()
  })

  it('盘上是垃圾 ⇒ 返回 null 当无缓存,不抛错打断渲染', async () => {
    const kv = makeKv()
    kv.setItem(KEY, 'not-json-at-all')
    const st = workPanelStorage(kv)
    expect(await st.getItem(KEY)).toBeNull()
  })

  it('kv 读写抛错(隐私模式/配额)⇒ 静默,不冒泡到渲染路径', async () => {
    const st = workPanelStorage({
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
      removeItem: () => {
        throw new Error('SecurityError')
      },
    })
    expect(await st.getItem(KEY)).toBeNull()
    await expect(st.setItem(KEY, { state: {}, version: 0 })).resolves.toBeUndefined()
    expect(() => st.removeItem(KEY)).not.toThrow()
  })
})

/* ============ 真跑 store:证明 work-panel.ts 那一行真的接上了加密 ============ */

describe('ihui-work-panel 加密 · 真跑 useWorkPanelStore(桌面端)', () => {
  const w = window as unknown as Record<string, unknown>

  beforeEach(() => {
    localStorage.clear()
    tauriFiles.clear()
    storeMode.broken = false
    w.__TAURI_INTERNALS__ = {}
    vi.resetModules()
  })

  afterEach(() => {
    delete w.__TAURI_INTERNALS__
    vi.resetModules()
  })

  it('store 写盘后 localStorage 里是信封,不是明文 JSON', async () => {
    const { useWorkPanelStore } = await import('@/stores/work-panel')
    useWorkPanelStore.setState({ tabs: [], activeTabId: null, favorites: [], recentUrls: [] })
    useWorkPanelStore.getState().addFavorite(CJK_URL, CJK_TITLE)

    await waitFor(
      () => (localStorage.getItem(KEY) ?? '').length > 0,
      'zustand persist 写入 localStorage',
    )
    const stored = localStorage.getItem(KEY)!
    expect(parseVaultEnvelope(stored)).not.toBeNull()
    expect(stored).not.toContain(CJK_TITLE)
    expect(stored).not.toContain('ihui-work-panel')
  })

  it('明文存量启动 ⇒ 被迁移为信封,且 store 状态照常hydrate', async () => {
    // 改造前形态的落盘:明文 JSON 直接躺在 localStorage
    localStorage.setItem(KEY, persistedBlob(CJK_TITLE, CJK_URL))

    const { useWorkPanelStore } = await import('@/stores/work-panel')
    await waitFor(() => useWorkPanelStore.getState().tabs.length > 0, 'store 从存量 hydrate 出 tab')
    const s = useWorkPanelStore.getState()
    expect(s.tabs[0]!.title).toBe(CJK_TITLE)
    expect(s.tabs[0]!.url).toBe(CJK_URL)
    expect(s.activeTabId).toBe(s.tabs[0]!.id)
    // 会话桶字段也在(证明读的是完整存量,不是空态)
    expect(s.favorites.map((f) => f.title)).toContain(CJK_TITLE)

    await waitFor(
      () => parseVaultEnvelope(localStorage.getItem(KEY) ?? '') !== null,
      '存量明文被 seal 回写',
    )
    const stored = localStorage.getItem(KEY)!
    expect(stored).not.toContain(CJK_TITLE)
    expect(stored).not.toContain(CJK_URL)
  })
})
// ⁠‌‌‌‍‍‌‌‍‍‌‌‌‌‍‍‌‌‌‍‍‌‌‌‌‌‍‍‌‌‌‍‍‌‌‌‍‍‌‍‌‌‌‌‍‌‌‍‍‌‌‌‌‌‌‌‌‍‍‍‌‍‌‌‌‌‌‌‌‍‍‌‌‌‍‍‌‍‍‍‌‌‌‍‍‌‌‌‌‌‌‌‍‍‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‍‌‍‍‍‍‌‍‍‍‌‍‍‌‌‌‌‌‍‍‌‌‌‌‍‍‌‌‍‌‍‍‌‌‌‌‍‍‌‌‌‍‍‌‍‍‌‍‍‌‌‌‍‍‍‌‍‍‌‍‍‍‌‍‍‍‌‍‍‌‌‍‍‍‌‍‍‍‌‍‍‍‌‍‍‍‍‌‍‍‍‌‍‍‌‌‍‍‍‍‌‬‍‌‍‌‌‌‌‍‍‍‌‌‍‍‍‌‌‍‌‌‍‌‌‍‌‌‍‍‍‌‌‍‍‌‌‍‍‍‌‌‍‍‍‍‌‌‍‍‌‍‍‌‌‌‌‍‌‍‌‌‍‌‍‍‌‌‍‍‌‌‌‌‌‍‌‌‌‌‌‍‌‍‍‍‌‍‍‌‌‌‌‌‍‍‌‍‍‍‌‍‍‌‍‌‍﻿‍‌‍‌‌‍‌‌‌‌‍‌��‍‌‌‍‍‌‍‌‌‍‌‍‍‌‍‌‌‌‌‍‌‍‌‍‌‌‌‍‍‍‌‌‌‍‌‍‍‌‌‌‍‍‌‌‍‌‌‌‌‍‍‍‍‌‍‍‍‌‍‍‍‌‍‍‍‌‍‍‍‌‌‌‌‍‍‌‌‌‌‌‍‍‍‌‍‍‬‌‍‌‍‍‌‌‍‌‍‌‍‍‌‍‍‍‌‌‍‍‌‍‍⁠
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
