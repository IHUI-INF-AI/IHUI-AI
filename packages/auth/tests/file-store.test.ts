// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * L09 验收:文件后端的三条底线 —— 明文不落盘、缓存可清、非法名拒绝。
 * 保护器用假实现(不碰 DPAPI,保证 CI 跨平台可跑);真实 DPAPI 的可用性由
 * `WindowsDpapiProtector.isSupported()` 在平台侧判,不在单测里赌。
 */

import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { FileCredentialStore } from '../src/credentials/file-store.js'
import { CredentialStoreError, type CredentialProtector } from '../src/credentials/types.js'

function fakeProtector(counter?: { unprotect: number }): CredentialProtector {
  return {
    id: 'fake',
    async protect(plaintext) {
      return Buffer.from(`enc:${plaintext}`, 'utf8')
    },
    async unprotect(cipher) {
      if (counter) counter.unprotect += 1
      const text = cipher.toString('utf8')
      if (!text.startsWith('enc:')) throw new Error('cipher 损坏')
      return text.slice(4)
    },
  }
}

let dir = ''
let store: FileCredentialStore

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ihui-cred-'))
  store = new FileCredentialStore({ dir, protector: fakeProtector(), cacheTtlMs: 0 })
})

afterEach(async () => {
  store.clearMemoryCache()
  await rm(dir, { recursive: true, force: true })
})

describe('FileCredentialStore', () => {
  it('set → get 往返,缺失返回 null', async () => {
    expect(await store.get('mcp', 'oauth')).toBeNull()
    await store.set('mcp', 'oauth', 'refresh-token-1')
    expect(await store.get('mcp', 'oauth')).toBe('refresh-token-1')
  })

  it('落盘只有密文,明文一个字节都不出现', async () => {
    await store.set('mcp', 'oauth', 'REFRESH-TOKEN-SECRET')
    const raw = await readFile(join(dir, 'mcp.json'), 'utf8')
    expect(raw).not.toContain('REFRESH-TOKEN-SECRET')
    const parsed = JSON.parse(raw) as { accounts: Record<string, string> }
    expect(Buffer.from(parsed.accounts.oauth, 'base64').toString('utf8')).toBe(
      'enc:REFRESH-TOKEN-SECRET',
    )
    const files = await readdir(dir)
    expect(files).toEqual(['mcp.json'])
  })

  it('list 排序、delete 幂等', async () => {
    await store.set('mcp', 'b', '2')
    await store.set('mcp', 'a', '1')
    expect(await store.list('mcp')).toEqual(['a', 'b'])
    expect(await store.delete('mcp', 'a')).toBe(true)
    expect(await store.delete('mcp', 'a')).toBe(false)
    expect(await store.list('mcp')).toEqual(['b'])
  })

  it('缓存命中不再解密;clearMemoryCache 后强制重解', async () => {
    const counter = { unprotect: 0 }
    const cached = new FileCredentialStore({
      dir,
      protector: fakeProtector(counter),
      cacheTtlMs: 5_000,
    })
    await cached.set('svc', 'acct', 'secret')
    const first = counter.unprotect
    await cached.get('svc', 'acct')
    await cached.get('svc', 'acct')
    expect(counter.unprotect).toBe(first)
    cached.clearMemoryCache()
    expect(await cached.get('svc', 'acct')).toBe('secret')
    expect(counter.unprotect).toBe(first + 1)
  })

  it('非法名与空 secret 一律拒绝', async () => {
    await expect(store.get('../escape', 'a')).rejects.toBeInstanceOf(CredentialStoreError)
    await expect(store.get('ok', 'a/b')).rejects.toBeInstanceOf(CredentialStoreError)
    await expect(store.set('ok', 'a', '')).rejects.toBeInstanceOf(CredentialStoreError)
  })

  it('保护器坏掉时判 protector-failed,不静默返回空', async () => {
    const broken = new FileCredentialStore({ dir, protector: fakeProtector(), cacheTtlMs: 0 })
    await broken.set('svc', 'acct', 'secret')
    const raw = JSON.parse(await readFile(join(dir, 'svc.json'), 'utf8'))
    raw.accounts.broken = Buffer.from('plain-garbage').toString('base64')
    await writeFile(join(dir, 'svc.json'), JSON.stringify(raw), 'utf8')
    await expect(broken.get('svc', 'broken')).rejects.toBeInstanceOf(CredentialStoreError)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
