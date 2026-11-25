// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { randomBytes } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { CredentialVault, InMemoryKeyProtector } from '../src/credential-vault'
import { OAuthCheckpointStore } from '../src/oauth-checkpoint'
import type { OAuthTokenSet } from '../src/oauth-checkpoint'

const tempDirs: string[] = []

function checkpointPath(): string {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-vault-'))
  tempDirs.push(dir)
  return join(dir, 'checkpoint.json')
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('RP-4/L09 凭据保险库', () => {
  it('1. set/get 往返正确，checkpoint 不含明文', () => {
    const path = checkpointPath()
    const vault = new CredentialVault({
      protector: new InMemoryKeyProtector(),
      checkpointPath: path,
    })
    const secret = `sk-${randomBytes(16).toString('hex')}`
    vault.set('provider:token', secret)
    expect(vault.get('provider:token')).toBe(secret)

    const raw = readFileSync(path, 'utf8')
    expect(raw).not.toContain(secret)
    expect(raw).toContain('ciphertext')
    expect(raw).toContain('protectedKey')
    vault.dispose()
  })

  it('2. dispose 后内存副本清空，同密钥可从 checkpoint 恢复', () => {
    const path = checkpointPath()
    const protector = new InMemoryKeyProtector()
    const secret = 'checkpoint-only-secret'
    const first = new CredentialVault({ protector, checkpointPath: path })
    first.set('oauth:refresh', secret)
    first.dispose()
    expect(first.get('oauth:refresh')).toBeNull()

    const second = new CredentialVault({ protector, checkpointPath: path })
    expect(second.get('oauth:refresh')).toBe(secret)
    second.clearCheckpoint()
  })

  it('3. delete 会同步移除 checkpoint 条目', () => {
    const path = checkpointPath()
    const vault = new CredentialVault({
      protector: new InMemoryKeyProtector(),
      checkpointPath: path,
    })
    vault.set('k', 'v')
    vault.delete('k')
    expect(vault.get('k')).toBeNull()
    expect(readFileSync(path, 'utf8')).not.toContain('"k"')
  })
})

describe('RP-4/L09 MCP OAuth checkpoint', () => {
  const tokens = (access: string, refresh: string): OAuthTokenSet => ({
    accessToken: access,
    refreshToken: refresh,
    expiresAt: Date.now() + 3_600_000,
    scope: 'read',
  })

  it('4. save/load 走加密 checkpoint，明文 refreshToken 零落盘', () => {
    const path = checkpointPath()
    const store = new OAuthCheckpointStore({
      protector: new InMemoryKeyProtector(),
      checkpointPath: path,
      clearOnExit: false,
    })
    const value = tokens('access-plaintext', 'refresh-plaintext')
    store.save('mcp', 'session-1', value)
    expect(store.load('mcp', 'session-1')).toEqual(value)
    const raw = readFileSync(path, 'utf8')
    expect(raw).not.toContain('refresh-plaintext')
    expect(raw).not.toContain('access-plaintext')
    store.dispose()
  })

  it('5. refresh 失败时恢复上一次 checkpoint，成功时覆盖', async () => {
    const store = new OAuthCheckpointStore({
      protector: new InMemoryKeyProtector(),
      clearOnExit: false,
    })
    const old = tokens('old-access', 'old-refresh')
    store.save('mcp', 'session-2', old)

    const failed = await store.withRecovery('mcp', 'session-2', async () => {
      throw new Error('upstream 503')
    })
    expect(failed.recovered).toBe(true)
    expect(failed.tokens).toEqual(old)

    const next = tokens('new-access', 'new-refresh')
    const ok = await store.withRecovery('mcp', 'session-2', async () => next)
    expect(ok.recovered).toBe(false)
    expect(store.load('mcp', 'session-2')).toEqual(next)
    store.dispose()
  })

  it('6. 无 checkpoint 且 refresh 失败时抛错，不伪造票据', async () => {
    const store = new OAuthCheckpointStore({
      protector: new InMemoryKeyProtector(),
      clearOnExit: false,
    })
    await expect(
      store.withRecovery('mcp', 'missing', async () => {
        throw new Error('network down')
      }),
    ).rejects.toThrow('refresh 失败且无可用 checkpoint')
    store.dispose()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
