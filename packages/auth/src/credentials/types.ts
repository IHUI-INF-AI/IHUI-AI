// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 凭据存储接口(L09 / P0-B 前置,2026-11-26 立)。
 *
 * 三条设计约束,来自对标清单与本仓既有反例:
 *  1. **明文零落盘**:落盘的只有经 OS 保护器(Windows DPAPI)处理后的密文;接口层不认识明文格式。
 *  2. **退出即清内存副本**:内存缓存只为"同一进程内少跑几次系统调用",`clearMemoryCache()` 必须真清,
 *     不给"关了界面还以为清干净"留口子。
 *  3. **失败方向恒为拒绝**:保护器拿不到、平台不支持、名字不合法,一律抛错,不静默降级成明文。
 */

export type CredentialStoreErrorCode =
  'unsupported-platform' | 'protector-failed' | 'bad-name' | 'io-failed'

export class CredentialStoreError extends Error {
  readonly code: CredentialStoreErrorCode

  constructor(code: CredentialStoreErrorCode, message: string, options?: { cause?: unknown }) {
    super(message)
    this.name = 'CredentialStoreError'
    this.code = code
    if (options?.cause !== undefined) this.cause = options.cause
  }
}

/** OS 级保护器:输入明文,输出只有本机当前用户能解开的密文。 */
export interface CredentialProtector {
  readonly id: string
  protect(plaintext: string): Promise<Buffer>
  unprotect(cipher: Buffer): Promise<string>
}

export interface CredentialStore {
  /** 读到明文;不存在返回 null(不抛错,便于调用方判空)。 */
  get(service: string, account: string): Promise<string | null>
  /** 覆盖写;同一 service/account 只保留最新一份。 */
  set(service: string, account: string, secret: string): Promise<void>
  /** 删除并返回是否真的删掉了。 */
  delete(service: string, account: string): Promise<boolean>
  /** 列出某 service 下的账号名(不含密文)。 */
  list(service: string): Promise<string[]>
  /** 清空进程内明文副本。进程退出前必须调用一次。 */
  clearMemoryCache(): void
}

/** 名字白名单:service/account 会进文件名,必须先过这道闸再拼路径。 */
export const CREDENTIAL_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/

export function assertCredentialName(kind: 'service' | 'account', value: string): void {
  if (!CREDENTIAL_NAME_PATTERN.test(value)) {
    throw new CredentialStoreError(
      'bad-name',
      `${kind} 名不合法(只允许字母数字与 ._- ,长度 1-64): ${value}`,
    )
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
