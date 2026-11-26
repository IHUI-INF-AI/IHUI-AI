// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Windows DPAPI 保护器(L09)。
 *
 * 为什么走 PowerShell 子进程而不是引原生库:仓内没有 keyring/keytar 依赖(pnpm-lock 零命中),
 * 引一个原生模块要跨平台编译,对"只在本机桌面用"的场景性价比极低。DPAPI 的正确入口是
 * .NET 的 `ProtectedData`,它就在 Windows 自带的 PowerShell 里;**CurrentUser 作用域**保证
 * 只有当前用户能解开,换机/换用户即失效 —— 这正是"凭据不落盘可读"要的语义。
 *
 * 代价如实说:每次 get/set 起一次子进程(几十毫秒级)。凭据读写是低频操作,这个代价能接受;
 * 高频路径请走上层的内存缓存(`FileCredentialStore` 默认 5 分钟)。
 */

import { spawn } from 'node:child_process'

import { CredentialStoreError, type CredentialProtector } from './types.js'

const ENTROPY = 'ihui-ai-credentials'

const PROTECT_SCRIPT = [
  'Add-Type -AssemblyName System.Security',
  `$entropy=[Text.Encoding]::UTF8.GetBytes('${ENTROPY}')`,
  '$plain=[Convert]::FromBase64String([Console]::In.ReadToEnd())',
  "$cipher=[Security.Cryptography.ProtectedData]::Protect($plain,$entropy,'CurrentUser')",
  '[Console]::Out.Write([Convert]::ToBase64String($cipher))',
].join('; ')

const UNPROTECT_SCRIPT = [
  'Add-Type -AssemblyName System.Security',
  `$entropy=[Text.Encoding]::UTF8.GetBytes('${ENTROPY}')`,
  '$cipher=[Convert]::FromBase64String([Console]::In.ReadToEnd())',
  "$plain=[Security.Cryptography.ProtectedData]::Unprotect($cipher,$entropy,'CurrentUser')",
  '[Console]::Out.Write([Convert]::ToBase64String($plain))',
].join('; ')

function runProtected(script: string, payloadBase64: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })
    const out: Buffer[] = []
    const err: Buffer[] = []
    child.stdout.on('data', (chunk: Buffer) => out.push(chunk))
    child.stderr.on('data', (chunk: Buffer) => err.push(chunk))
    child.on('error', (error) =>
      reject(
        new CredentialStoreError('protector-failed', '启动 powershell 失败', { cause: error }),
      ),
    )
    child.on('close', (code) => {
      const text = Buffer.concat(out).toString('utf8').trim()
      if (code !== 0 || !text) {
        reject(
          new CredentialStoreError(
            'protector-failed',
            `DPAPI 调用失败(rc=${code}): ${Buffer.concat(err).toString('utf8').slice(0, 200)}`,
          ),
        )
        return
      }
      try {
        resolve(Buffer.from(text, 'base64'))
      } catch (error) {
        reject(
          new CredentialStoreError('protector-failed', 'DPAPI 返回值不是合法 base64', {
            cause: error,
          }),
        )
      }
    })
    child.stdin.end(payloadBase64)
  })
}

export class WindowsDpapiProtector implements CredentialProtector {
  readonly id = 'windows-dpapi'

  static isSupported(platform: NodeJS.Platform = process.platform): boolean {
    return platform === 'win32'
  }

  async protect(plaintext: string): Promise<Buffer> {
    if (!WindowsDpapiProtector.isSupported()) {
      throw new CredentialStoreError('unsupported-platform', 'DPAPI 只在 Windows 可用')
    }
    return runProtected(PROTECT_SCRIPT, Buffer.from(plaintext, 'utf8').toString('base64'))
  }

  async unprotect(cipher: Buffer): Promise<string> {
    if (!WindowsDpapiProtector.isSupported()) {
      throw new CredentialStoreError('unsupported-platform', 'DPAPI 只在 Windows 可用')
    }
    const plain = await runProtected(UNPROTECT_SCRIPT, cipher.toString('base64'))
    return plain.toString('utf8')
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
