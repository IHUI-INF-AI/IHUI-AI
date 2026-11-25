// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RP-4/L09 MCP OAuth checkpoint：
 * - refresh token 只经 CredentialVault 加密落盘；
 * - refresh 失败时从 checkpoint 恢复到内存，不把上一次的有效票据直接丢弃；
 * - dispose() 与进程退出钩子清空内存副本。
 */
import { CredentialVault, type CredentialVaultOptions } from './credential-vault'

export interface OAuthTokenSet {
  readonly accessToken: string
  readonly refreshToken: string
  readonly expiresAt: number
  readonly scope?: string
  readonly obtainedAt?: number
}

export interface OAuthCheckpointOptions extends CredentialVaultOptions {
  /** 进程退出时自动清空内存副本（默认 true）。 */
  readonly clearOnExit?: boolean
}

function keyOf(provider: string, sessionId: string): string {
  if (!provider || !sessionId) throw new Error('provider 与 sessionId 均不能为空')
  return `oauth:${provider}:${sessionId}`
}

export class OAuthCheckpointStore {
  private readonly vault: CredentialVault
  private readonly clearOnExit: boolean
  private readonly onExit = (): void => this.vault.dispose()

  constructor(options: OAuthCheckpointOptions = {}) {
    const { clearOnExit = true, ...vaultOptions } = options
    this.vault = new CredentialVault(vaultOptions)
    this.clearOnExit = clearOnExit
    if (this.clearOnExit) process.once('exit', this.onExit)
  }

  save(provider: string, sessionId: string, tokens: OAuthTokenSet): void {
    this.vault.set(keyOf(provider, sessionId), JSON.stringify(tokens))
  }

  load(provider: string, sessionId: string): OAuthTokenSet | null {
    const raw = this.vault.get(keyOf(provider, sessionId))
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw) as OAuthTokenSet
      if (!parsed.accessToken || !parsed.refreshToken || !Number.isFinite(parsed.expiresAt))
        return null
      return parsed
    } catch {
      return null
    }
  }

  clear(provider: string, sessionId: string): void {
    this.vault.delete(keyOf(provider, sessionId))
  }

  /**
   * 刷新失败时恢复最近一次 checkpoint；返回 null 表示从未落过 checkpoint。
   * 这是"refresh 失败可恢复"的最小语义：不重新签发票据，只恢复已经合法持有的票据。
   */
  recover(provider: string, sessionId: string): OAuthTokenSet | null {
    return this.load(provider, sessionId)
  }

  /**
   * 包装一次 refresh：成功则用新票据覆盖 checkpoint；失败则保留旧 checkpoint 并返回它，
   * 让调用方在短暂上游故障期间仍能继续使用未过期票据。
   */
  async withRecovery(
    provider: string,
    sessionId: string,
    refresh: (current: OAuthTokenSet | null) => Promise<OAuthTokenSet>,
  ): Promise<{ tokens: OAuthTokenSet; recovered: boolean }> {
    const current = this.load(provider, sessionId)
    try {
      const next = await refresh(current)
      this.save(provider, sessionId, next)
      return { tokens: next, recovered: false }
    } catch {
      const restored = this.recover(provider, sessionId)
      if (!restored) throw new Error('refresh 失败且无可用 checkpoint')
      return { tokens: restored, recovered: true }
    }
  }

  dispose(): void {
    if (this.clearOnExit) process.removeListener('exit', this.onExit)
    this.vault.dispose()
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
