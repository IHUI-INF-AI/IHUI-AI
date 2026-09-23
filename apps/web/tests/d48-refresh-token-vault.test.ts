// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D48(G-56)B 层:auth.json 里的 refresh_token 静态加密 + 存量明文兼容 + 降级
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseVaultEnvelope } from '@/lib/local-vault'

/** 假 plugin-store:内存版"文件 → 键值",供 load() 返回 */
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
      get: async (key: string) => entries.get(key),
      set: async (key: string, value: unknown) => {
        entries.set(key, value)
      },
      delete: async (key: string) => entries.delete(key),
      save: async () => {},
    }
  },
}))

const AUTH_FILE = 'auth.json'
const TOKEN_SAMPLE = 'rt_9f2c41e7b0-this-is-a-refresh-token-do-not-leave-it-in-plaintext'

async function importVault() {
  const mod = await import('@/lib/desktop-token-vault')
  return mod
}

function rawTokenInStore(): unknown {
  return files.get(AUTH_FILE)?.get('refresh_token')
}

beforeAll(() => {
  // 桌面端运行时标识:isDesktopEnv() 据此判定(定义已收敛到 local-vault)
  ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {}
})

beforeEach(() => {
  files.clear()
  storeMode.broken = false
})

describe('D48 · refresh token 静态加密', () => {
  it('写入即密文化:auth.json 里读不到 token 明文,取回仍一字不差', async () => {
    const { setDesktopRefreshToken, getDesktopRefreshToken } = await importVault()
    await setDesktopRefreshToken(TOKEN_SAMPLE)

    const stored = rawTokenInStore()
    expect(typeof stored).toBe('string')
    const text = stored as string
    expect(text).not.toContain(TOKEN_SAMPLE)
    expect(parseVaultEnvelope(text)).not.toBeNull()
    expect(await getDesktopRefreshToken()).toBe(TOKEN_SAMPLE)
  })

  it('存量明文照旧可读(不因升级而登出),下一次写入自动变成密文', async () => {
    files.set(AUTH_FILE, new Map([['refresh_token', TOKEN_SAMPLE]]))
    const { getDesktopRefreshToken, setDesktopRefreshToken } = await importVault()
    expect(await getDesktopRefreshToken()).toBe(TOKEN_SAMPLE)

    await setDesktopRefreshToken(TOKEN_SAMPLE)
    expect(parseVaultEnvelope(rawTokenInStore() as string)).not.toBeNull()
  })

  it('删除语义不变:null 写入即移除该键', async () => {
    const { setDesktopRefreshToken, getDesktopRefreshToken } = await importVault()
    await setDesktopRefreshToken(TOKEN_SAMPLE)
    await setDesktopRefreshToken(null)
    expect(rawTokenInStore()).toBeUndefined()
    expect(await getDesktopRefreshToken()).toBeNull()
  })

  it('密文被篡改(GCM 校验失败)⇒ 返回 null 走 cookie 链路,不抛错', async () => {
    const { setDesktopRefreshToken, getDesktopRefreshToken } = await importVault()
    await setDesktopRefreshToken(TOKEN_SAMPLE)
    const sealed = rawTokenInStore() as string
    // 只动 ct,结构仍是合法信封 —— 必须靠 AEAD 标签判死,而不是靠"看起来像密文"
    const tampered = sealed.replace(/"ct":"([^"]{6})/, '"ct":"AAAAAAAA')
    expect(tampered).not.toBe(sealed)
    files.set(AUTH_FILE, new Map([['refresh_token', tampered]]))
    expect(await getDesktopRefreshToken()).toBeNull()
  })

  it('通道不可用(store 被拒)⇒ 空操作且不抛错,浏览器/非授权 origin 行为同改造前', async () => {
    storeMode.broken = true
    const { setDesktopRefreshToken, getDesktopRefreshToken, isDesktopEnv } = await importVault()
    expect(isDesktopEnv()).toBe(true)
    await expect(setDesktopRefreshToken(TOKEN_SAMPLE)).resolves.toBeUndefined()
    expect(await getDesktopRefreshToken()).toBeNull()
    expect(files.size).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
