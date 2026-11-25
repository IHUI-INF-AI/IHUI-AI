// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RP-4/L09 凭据保险库：明文凭据零落盘。
 *
 * 设计边界：
 * - 只有 AES-256-GCM 密文 + 被 OS keyring/DPAPI 包裹的数据密钥可以落盘；
 * - 数据密钥每次写入随机生成，进程内不保留明文副本（用完即 fill(0)）；
 * - checkpoint 原子写入并限制权限；`dispose()` 清空内存索引并擦除可擦字段；
 * - OS 适配层可注入，测试用 InMemoryKeyProtector 走同一条加解密路径。
 */
import { execFileSync } from 'node:child_process'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
  chmodSync,
} from 'node:fs'
import { dirname } from 'node:path'
import { platform } from 'node:os'

export interface ProtectedKey {
  readonly version: 1
  readonly material: string
}

export interface KeyProtector {
  readonly id: string
  protect(key: Buffer): ProtectedKey
  unprotect(protectedKey: ProtectedKey): Buffer
}

const VAULT_ENTROPY = Buffer.from('ihui-credential-vault-v1', 'utf8')

function powershellProtect(input: string, unprotect: boolean): string {
  const b64 = unprotect
    ? `[Text.Encoding]::UTF8.GetBytes('${input}')`
    : `[Text.Encoding]::UTF8.GetBytes('${input}')`
  const entropy = `[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes('${VAULT_ENTROPY.toString('utf8')}'))`
  const call = unprotect
    ? `[Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String('${input}'),[Convert]::FromBase64String(${entropy}),[Security.Cryptography.DataProtectionScope]::CurrentUser)`
    : `[Security.Cryptography.ProtectedData]::Protect(${b64},[Convert]::FromBase64String(${entropy}),[Security.Cryptography.DataProtectionScope]::CurrentUser)`
  const script = `Add-Type -AssemblyName System.Security; [Convert]::ToBase64String(${call})`
  return execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    encoding: 'utf8',
    timeout: 15_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

/** 默认 OS 包裹器：Windows DPAPI / macOS Keychain / Linux secret-tool。 */
export class OsKeyProtector implements KeyProtector {
  readonly id = 'os-keyring'

  protect(key: Buffer): ProtectedKey {
    const material = key.toString('base64')
    switch (platform()) {
      case 'win32':
        return { version: 1, material: powershellProtect(material, false) }
      case 'darwin': {
        const account = 'ihui-credential-vault'
        execFileSync(
          'security',
          ['add-generic-password', '-a', account, '-s', account, '-w', material, '-U'],
          {
            stdio: 'ignore',
            timeout: 15_000,
          },
        )
        return { version: 1, material: `keychain:${account}` }
      }
      case 'linux':
        execFileSync(
          'secret-tool',
          [
            'store',
            '--label',
            'IHUI credential vault',
            'service',
            'ihui-credential-vault',
            'key',
            'data',
          ],
          { input: material, stdio: ['pipe', 'ignore', 'ignore'], timeout: 15_000 },
        )
        return { version: 1, material: 'secret-tool:data' }
      default:
        throw new Error(`unsupported platform for OS keyring: ${platform()}`)
    }
  }

  unprotect(protectedKey: ProtectedKey): Buffer {
    if (protectedKey.version !== 1) throw new Error('unsupported protected key version')
    switch (platform()) {
      case 'win32':
        return Buffer.from(powershellProtect(protectedKey.material, true), 'base64')
      case 'darwin': {
        const out = execFileSync(
          'security',
          [
            'find-generic-password',
            '-a',
            'ihui-credential-vault',
            '-s',
            'ihui-credential-vault',
            '-w',
          ],
          { encoding: 'utf8', timeout: 15_000, stdio: ['ignore', 'pipe', 'pipe'] },
        )
        return Buffer.from(out.trim(), 'base64')
      }
      case 'linux': {
        const out = execFileSync(
          'secret-tool',
          ['lookup', 'service', 'ihui-credential-vault', 'key', 'data'],
          { encoding: 'utf8', timeout: 15_000, stdio: ['ignore', 'pipe', 'pipe'] },
        )
        return Buffer.from(out.trim(), 'base64')
      }
      default:
        throw new Error(`unsupported platform for OS keyring: ${platform()}`)
    }
  }
}

/** 测试/离线回退用包裹器：密钥只在进程内存中，不得用于生产持久化。 */
export class InMemoryKeyProtector implements KeyProtector {
  readonly id = 'in-memory-test-only'
  private readonly keys = new Map<string, Buffer>()

  protect(key: Buffer): ProtectedKey {
    const id = randomBytes(16).toString('hex')
    this.keys.set(id, Buffer.from(key))
    return { version: 1, material: id }
  }

  unprotect(protectedKey: ProtectedKey): Buffer {
    const key = this.keys.get(protectedKey.material)
    if (!key) throw new Error('protected key not found')
    return Buffer.from(key)
  }
}

interface VaultRecord {
  readonly ciphertext: string
  readonly iv: string
  readonly tag: string
  readonly protectedKey: ProtectedKey
  readonly updatedAt: number
}

export interface CredentialVaultOptions {
  readonly protector?: KeyProtector
  /** 加密 checkpoint 路径；不传则只保留进程内密文。 */
  readonly checkpointPath?: string
}

/**
 * 凭据保险库。所有 set/get 均同步，便于在既有服务里低风险接入；
 * OS 包裹器和实际的 token 刷新网络调用仍是异步的，由调用方自行编排。
 */
export class CredentialVault {
  private readonly protector: KeyProtector
  private readonly checkpointPath?: string
  private readonly records = new Map<string, VaultRecord>()

  constructor(options: CredentialVaultOptions = {}) {
    this.protector = options.protector ?? new OsKeyProtector()
    this.checkpointPath = options.checkpointPath
    if (this.checkpointPath && existsSync(this.checkpointPath)) this.readCheckpoint()
  }

  set(key: string, secret: string): void {
    if (!key) throw new Error('credential key must not be empty')
    if (typeof secret !== 'string') throw new Error('credential secret must be a string')
    const dataKey = randomBytes(32)
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', dataKey, iv)
    const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()])
    const record: VaultRecord = {
      ciphertext: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      protectedKey: this.protector.protect(dataKey),
      updatedAt: Date.now(),
    }
    dataKey.fill(0)
    this.records.set(key, record)
    this.persist()
  }

  get(key: string): string | null {
    const record = this.records.get(key)
    if (!record) return null
    const dataKey = this.protector.unprotect(record.protectedKey)
    try {
      const decipher = createDecipheriv('aes-256-gcm', dataKey, Buffer.from(record.iv, 'base64'))
      decipher.setAuthTag(Buffer.from(record.tag, 'base64'))
      return Buffer.concat([
        decipher.update(Buffer.from(record.ciphertext, 'base64')),
        decipher.final(),
      ]).toString('utf8')
    } finally {
      dataKey.fill(0)
    }
  }

  has(key: string): boolean {
    return this.records.has(key)
  }

  delete(key: string): void {
    if (!this.records.delete(key)) return
    this.persist()
  }

  /** 进程退出或租户切换时调用：清空内存索引，密文字段就地擦除。 */
  dispose(): void {
    // JS 字符串不可变，无法原地清零；用空壳替换后再清索引，避免密文继续被引用。
    const scrubbed: VaultRecord = {
      ciphertext: '',
      iv: '',
      tag: '',
      protectedKey: { version: 1, material: '' },
      updatedAt: 0,
    }
    for (const key of this.records.keys()) this.records.set(key, scrubbed)
    this.records.clear()
  }

  private readCheckpoint(): void {
    if (!this.checkpointPath) return
    try {
      const parsed = JSON.parse(readFileSync(this.checkpointPath, 'utf8')) as Record<
        string,
        VaultRecord
      >
      if (!parsed || typeof parsed !== 'object') return
      for (const [key, record] of Object.entries(parsed)) {
        if (record && typeof record.ciphertext === 'string' && record.protectedKey?.version === 1) {
          this.records.set(key, record)
        }
      }
    } catch {
      // 损坏的 checkpoint 一律忽略，fail-closed（不会把可疑内容当凭据加载）。
    }
  }

  private persist(): void {
    if (!this.checkpointPath) return
    const dir = dirname(this.checkpointPath)
    mkdirSync(dir, { recursive: true })
    const tmp = `${this.checkpointPath}.${process.pid}.tmp`
    writeFileSync(tmp, JSON.stringify(Object.fromEntries(this.records), null, 2), { mode: 0o600 })
    chmodSync(tmp, 0o600)
    renameSync(tmp, this.checkpointPath)
  }

  /** 删除 checkpoint 文件本体（同时清空内存索引）。 */
  clearCheckpoint(): void {
    this.dispose()
    if (this.checkpointPath && existsSync(this.checkpointPath)) unlinkSync(this.checkpointPath)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
