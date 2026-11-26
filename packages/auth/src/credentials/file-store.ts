// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 文件后端 + OS 保护器(L09)。
 *
 * 盘上形态:一个 service 一个 JSON,`accounts` 里只存**密文的 base64**;明文只在内存里出现,
 * 且带 TTL 缓存(默认 5 分钟),`clearMemoryCache()` 一调用即失效。
 *
 * 为什么不做"一个账号一个文件":service 内账号数少(通常 1-3 个),单文件读改写更简单;
 * 但写必须是**原子**的(先写 `.tmp-<pid>` 再 rename),否则并发写会把整份账号表写坏。
 */

import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import {
  CredentialStoreError,
  assertCredentialName,
  type CredentialProtector,
  type CredentialStore,
} from './types.js'

interface ServiceFile {
  version: 1
  accounts: Record<string, string>
}

export interface FileCredentialStoreOptions {
  /** 密文落盘目录,由调用方给(模块内不猜系统路径)。 */
  dir: string
  protector: CredentialProtector
  /** 明文内存缓存 TTL,默认 5 分钟;0 = 不缓存。 */
  cacheTtlMs?: number
  /** 注入时钟(测试用)。 */
  now?: () => number
}

const DEFAULT_TTL_MS = 5 * 60 * 1000

export class FileCredentialStore implements CredentialStore {
  private readonly dir: string
  private readonly protector: CredentialProtector
  private readonly cacheTtlMs: number
  private readonly now: () => number
  private readonly cache = new Map<string, { value: string; at: number }>()

  constructor(options: FileCredentialStoreOptions) {
    if (!options.dir) throw new CredentialStoreError('io-failed', 'credential dir 不能为空')
    this.dir = options.dir
    this.protector = options.protector
    this.cacheTtlMs = options.cacheTtlMs ?? DEFAULT_TTL_MS
    this.now = options.now ?? Date.now
  }

  private filePath(service: string): string {
    assertCredentialName('service', service)
    return join(this.dir, `${service}.json`)
  }

  private cacheKey(service: string, account: string): string {
    return `${service}\u0000${account}`
  }

  private async readService(service: string): Promise<ServiceFile> {
    const path = this.filePath(service)
    let raw: string
    try {
      raw = await readFile(path, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { version: 1, accounts: {} }
      throw new CredentialStoreError('io-failed', `读凭据文件失败: ${path}`, { cause: error })
    }
    try {
      const parsed = JSON.parse(raw) as ServiceFile
      if (parsed.version !== 1 || typeof parsed.accounts !== 'object' || parsed.accounts === null) {
        throw new Error('unexpected shape')
      }
      return parsed
    } catch (error) {
      throw new CredentialStoreError('io-failed', `凭据文件格式损坏: ${path}`, { cause: error })
    }
  }

  private async writeService(service: string, data: ServiceFile): Promise<void> {
    const path = this.filePath(service)
    const tmp = `${path}.tmp-${process.pid}`
    await mkdir(this.dir, { recursive: true })
    try {
      await writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
      await rename(tmp, path)
    } catch (error) {
      await unlink(tmp).catch(() => undefined)
      throw new CredentialStoreError('io-failed', `写凭据文件失败: ${path}`, { cause: error })
    }
  }

  async get(service: string, account: string): Promise<string | null> {
    assertCredentialName('account', account)
    const key = this.cacheKey(service, account)
    const cached = this.cache.get(key)
    if (cached && this.cacheTtlMs > 0 && this.now() - cached.at < this.cacheTtlMs)
      return cached.value
    if (cached) this.cache.delete(key)

    const data = await this.readService(service)
    const cipherBase64 = data.accounts[account]
    if (!cipherBase64) return null

    let plain: string
    try {
      plain = await this.protector.unprotect(Buffer.from(cipherBase64, 'base64'))
    } catch (error) {
      throw new CredentialStoreError('protector-failed', `解密失败(${this.protector.id})`, {
        cause: error,
      })
    }
    if (this.cacheTtlMs > 0) this.cache.set(key, { value: plain, at: this.now() })
    return plain
  }

  async set(service: string, account: string, secret: string): Promise<void> {
    assertCredentialName('account', account)
    if (typeof secret !== 'string' || secret.length === 0) {
      throw new CredentialStoreError('io-failed', 'secret 不能为空(要删除请用 delete)')
    }
    let cipher: Buffer
    try {
      cipher = await this.protector.protect(secret)
    } catch (error) {
      throw new CredentialStoreError('protector-failed', `加密失败(${this.protector.id})`, {
        cause: error,
      })
    }
    const data = await this.readService(service)
    data.accounts[account] = cipher.toString('base64')
    await this.writeService(service, data)
    if (this.cacheTtlMs > 0)
      this.cache.set(this.cacheKey(service, account), { value: secret, at: this.now() })
  }

  async delete(service: string, account: string): Promise<boolean> {
    assertCredentialName('account', account)
    this.cache.delete(this.cacheKey(service, account))
    const data = await this.readService(service)
    if (!(account in data.accounts)) return false
    delete data.accounts[account]
    await this.writeService(service, data)
    return true
  }

  async list(service: string): Promise<string[]> {
    const data = await this.readService(service)
    return Object.keys(data.accounts).sort()
  }

  clearMemoryCache(): void {
    this.cache.clear()
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
