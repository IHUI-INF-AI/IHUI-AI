// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * DBG-31:小程序 refreshToken 不得明文落盘。
 *
 * 平台没有 Keychain/Keystore。本文件钉三件事:
 * 1. 存量明文读进内存后立刻从 storage 抹掉(阳性对照:导入前盘上确有原文);
 * 2. 之后的写入与轮换都不再把 refresh 原文送进 setStorageSync,且抹旧发生在写 access 之前;
 * 3. 读失败不删盘(读失败不等于凭据不在)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { REFRESH_TOKEN_STORAGE_KEY, TOKEN_STORAGE_KEY } from '@ihui/shared/constants'
import type * as ApiClientModule from '@ihui/api-client'

const { taroStorage, ops, state, fetchApiMock, REFRESH_KEY, TOKEN_KEY } = vi.hoisted(() => {
  const REFRESH_KEY = 'ihui_refresh_token'
  const TOKEN_KEY = 'ihui_token'
  return {
    taroStorage: {} as Record<string, unknown>,
    ops: [] as string[],
    state: { refreshReadError: null as Error | null },
    fetchApiMock: vi.fn(),
    REFRESH_KEY,
    TOKEN_KEY,
  }
})

vi.mock('@tarojs/taro', () => ({
  getStorageSync: (key: string) => {
    if (state.refreshReadError && key === REFRESH_KEY) throw state.refreshReadError
    return taroStorage[key] ?? ''
  },
  setStorageSync: (key: string, val: unknown) => {
    ops.push(`set:${key}:${typeof val === 'string' ? val : typeof val}`)
    taroStorage[key] = val
  },
  removeStorageSync: (key: string) => {
    ops.push(`del:${key}`)
    delete taroStorage[key]
  },
  switchTab: vi.fn(),
  getCurrentPages: () => [],
}))

vi.mock('@ihui/api-client', async () => {
  const actual = await vi.importActual<typeof ApiClientModule>('@ihui/api-client')
  return { ...actual, fetchApi: fetchApiMock }
})

const LEGACY = 'legacy-rt-plaintext'
const ROTATED = 'rt-rotated-secret'

function storageText(): string {
  return Object.entries(taroStorage)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join('\n')
}

async function loadAuth() {
  vi.resetModules()
  return import('../auth')
}

beforeEach(() => {
  for (const key of Object.keys(taroStorage)) delete taroStorage[key]
  ops.length = 0
  state.refreshReadError = null
  fetchApiMock.mockReset()
})

describe('refreshToken 不明文落盘', () => {
  it('存量明文读入内存后抹掉;轮换先抹 refresh 再写 access,且原文不进 storage', async () => {
    expect(REFRESH_TOKEN_STORAGE_KEY).toBe(REFRESH_KEY)
    expect(TOKEN_STORAGE_KEY).toBe(TOKEN_KEY)
    taroStorage[REFRESH_KEY] = LEGACY
    expect(storageText()).toContain(LEGACY)

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const auth = await loadAuth()

    expect(auth.getRefreshToken()).toBe(LEGACY)
    expect(taroStorage[REFRESH_KEY]).toBeUndefined()
    expect(storageText()).not.toContain(LEGACY)
    expect(warn.mock.calls.map((call) => String(call[0])).join('\n')).toContain('memory only')

    auth.setRefreshToken('rt-next')
    expect(auth.getRefreshToken()).toBe('rt-next')
    expect(storageText()).not.toContain('rt-next')
    expect(taroStorage[REFRESH_KEY]).toBeUndefined()

    ops.length = 0
    fetchApiMock.mockResolvedValueOnce({
      success: true,
      data: { accessToken: 'at-new', refreshToken: ROTATED },
    })
    await expect(auth.refreshAccessToken()).resolves.toBe('at-new')
    expect(auth.getRefreshToken()).toBe(ROTATED)
    expect(auth.getToken()).toBe('at-new')
    expect(taroStorage[TOKEN_KEY]).toBe('at-new')
    expect(storageText()).not.toContain(ROTATED)
    expect(ops.some((op) => op.startsWith(`set:${REFRESH_KEY}:`))).toBe(false)

    const erasedAt = ops.findIndex((op) => op === `del:${REFRESH_KEY}`)
    const accessAt = ops.findIndex((op) => op === `set:${TOKEN_KEY}:at-new`)
    expect(erasedAt).toBeGreaterThanOrEqual(0)
    expect(accessAt).toBeGreaterThan(erasedAt)
    warn.mockRestore()
  })

  it('非字符串残留不进内存,并从盘上抹掉', async () => {
    taroStorage[REFRESH_KEY] = { leaked: 'nope' }
    const auth = await loadAuth()
    expect(auth.getRefreshToken()).toBe('')
    expect(taroStorage[REFRESH_KEY]).toBeUndefined()
    expect(storageText()).not.toContain('nope')
  })

  it('读失败不删盘,内存按没有 refresh 处理', async () => {
    taroStorage[REFRESH_KEY] = LEGACY
    state.refreshReadError = new Error('storage down')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const auth = await loadAuth()
    expect(auth.getRefreshToken()).toBe('')
    expect(taroStorage[REFRESH_KEY]).toBe(LEGACY)
    expect(ops.filter((op) => op === `del:${REFRESH_KEY}`)).toEqual([])
    expect(warn.mock.calls.map((call) => String(call[0])).join('\n')).toContain(
      'leaving the disk copy untouched',
    )
    warn.mockRestore()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
