// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D48′ 收口两件事(2026-09-24)：
 * A. `ihui-auth` 接进同一加密通道(该 store 按 2026-07-21 审计不含 token,
 *    但 `user` 里有手机号与昵称 —— 明文留在 WebView Local Storage 仍属个人数据落盘)。
 * B. auth.json 的 refresh_token **读时即封**：旧行为要等下一次轮转(最长 15 分钟,且要求
 *    页面跑过新代码)才改写,盘上那颗能解出手机号的裸 JWT 因此长期存活。
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseVaultEnvelope } from '@/lib/local-vault'
import { createAuthPersistStorage } from '@/lib/chat-persist-crypto'

const files = vi.hoisted(() => new Map<string, Map<string, unknown>>())
const storeMode = vi.hoisted(() => ({ broken: false }))

vi.mock('@tauri-apps/plugin-store', () => ({
  load: async (path: string) => {
    if (storeMode.broken) throw new Error('IPC denied: origin not in capability list')
    let entries = files.get(path)
    if (!entries) {
      entries = new Map<string, unknown>()
      files.set(path, entries)
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

const AUTH_FILE = 'auth.json'
const TOKEN_SAMPLE = 'rt_7b3d90aa-c1f4-4a6e-8b21-plaintext-should-not-survive-a-read'

function rawToken(): unknown {
  return files.get(AUTH_FILE)?.get('refresh_token')
}
function seedPlaintextToken(): void {
  files.set(AUTH_FILE, new Map<string, unknown>([['refresh_token', TOKEN_SAMPLE]]))
}

beforeAll(() => {
  ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {}
})

beforeEach(() => {
  files.clear()
  storeMode.broken = false
})

describe('D48′ B：auth.json 读时即封', () => {
  it('读到明文 ⇒ 同一次读取内改写为恰一封信封，且返回的仍是原 token', async () => {
    seedPlaintextToken()
    const { getDesktopRefreshToken } = await import('@/lib/desktop-token-vault')
    expect(await getDesktopRefreshToken()).toBe(TOKEN_SAMPLE)

    const stored = rawToken()
    expect(typeof stored).toBe('string')
    expect(stored).not.toContain(TOKEN_SAMPLE) // 明文不再留在盘上
    expect(parseVaultEnvelope(stored as string)).not.toBeNull() // 且是合法信封
  })

  it('反复读不叠层(幂等判据是层数，不是"存在密文")', async () => {
    seedPlaintextToken()
    const { getDesktopRefreshToken } = await import('@/lib/desktop-token-vault')
    const { openVaultText } = await import('@/lib/local-vault')
    for (let i = 0; i < 3; i++) expect(await getDesktopRefreshToken()).toBe(TOKEN_SAMPLE)
    const opened = await openVaultText('refresh-token', rawToken() as string)
    expect(opened.kind).toBe('sealed')
    if (opened.kind === 'sealed') expect(opened.layers).toBe(1)
  })

  it('通道不可用(IPC 被拒)⇒ 退回 null 让调用方走 cookie，绝不抛错也不清数据', async () => {
    seedPlaintextToken()
    storeMode.broken = true
    const { getDesktopRefreshToken } = await import('@/lib/desktop-token-vault')
    expect(await getDesktopRefreshToken()).toBeNull()
    expect(rawToken()).toBe(TOKEN_SAMPLE) // 读不到就不动：明文 blob 保持原样可用
  })

  it('解不开的信封(拿另一域的密文当样本)⇒ null 退回 cookie，且绝不把解不开的 blob 再套一层', async () => {
    const { sealVaultText } = await import('@/lib/local-vault')
    // 形态合法但本域解不开 —— 等价"密钥换代/跨域错投"，是 unreadable 的真实成因
    const wrongDomain = await sealVaultText('chat-persist', TOKEN_SAMPLE)
    expect(typeof wrongDomain).toBe('string')
    files.set(AUTH_FILE, new Map<string, unknown>([['refresh_token', wrongDomain]]))
    const { getDesktopRefreshToken } = await import('@/lib/desktop-token-vault')
    expect(await getDesktopRefreshToken()).toBeNull()
    expect(rawToken()).toBe(wrongDomain) // 现场原样保留供取证，不得二次封装
  })
})

describe('D48′ A：ihui-auth 走同一加密通道', () => {
  it('浏览器(非桌面)路径原样返回 base —— 对象同一，零行为变更', () => {
    const base = { getItem: () => null, setItem: () => {}, removeItem: () => {} } as never
    const w = window as unknown as Record<string, unknown>
    const saved = w.__TAURI_INTERNALS__
    delete w.__TAURI_INTERNALS__ // 本文件为 B 组挂了桌面标识，此处必须还原成浏览器态
    try {
      expect(createAuthPersistStorage(base)).toBe(base)
    } finally {
      if (saved !== undefined) w.__TAURI_INTERNALS__ = saved
    }
  })

  it('桌面端落盘是信封：手机号与中文昵称都不在盘上，读回逐字段相同', async () => {
    const { createVaultBackedPersistStorage } = await import('@/lib/chat-persist-crypto')
    const map = new Map<string, string>()
    const kv = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => {
        map.set(k, v)
      },
      removeItem: (k: string) => {
        map.delete(k)
      },
    }
    const entries = new Map<string, string>()
    const channel = {
      async read(_f: string, key: string) {
        return { status: 'ok' as const, value: entries.get(key) ?? null }
      },
      async write(_f: string, key: string, value: string | null) {
        if (value === null) entries.delete(key)
        else entries.set(key, value)
        return true
      },
    }
    const st = createVaultBackedPersistStorage<{
      isAuthenticated: boolean
      user: { phone: string; nickname: string } | null
    }>({
      base: undefined,
      kv,
      isDesktop: true,
      channel,
      domain: 'auth-persist',
    })!
    const value = {
      state: { isAuthenticated: true, user: { phone: '18643389808', nickname: '李春川' } },
      version: 0,
    }
    await st.setItem('ihui-auth', value)
    const stored = map.get('ihui-auth')!
    expect(stored).not.toContain('18643389808')
    expect(stored).not.toContain('李春川')
    expect(parseVaultEnvelope(stored)).not.toBeNull()
    expect(await st.getItem('ihui-auth')).toEqual(value)
  })

  it('HKDF 域隔离：auth 域密文在 chat 域解不开(不得共用子密钥)', async () => {
    const { openVaultText, sealVaultText } = await import('@/lib/local-vault')
    const entries = new Map<string, string>()
    const channel = {
      async read(_f: string, key: string) {
        return { status: 'ok' as const, value: entries.get(key) ?? null }
      },
      async write(_f: string, key: string, value: string | null) {
        if (value === null) entries.delete(key)
        else entries.set(key, value)
        return true
      },
    }
    const sealed = await sealVaultText('auth-persist', '手机号：18643389808', channel)
    expect(sealed).not.toBeNull()
    const wrong = await openVaultText('chat-persist', sealed as string, channel)
    expect(wrong.kind).toBe('unreadable')
    const right = await openVaultText('auth-persist', sealed as string, channel)
    expect(right.kind === 'sealed' && right.text).toBe('手机号：18643389808')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
