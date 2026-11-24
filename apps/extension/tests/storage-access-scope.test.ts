// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * chrome.storage.local 的凭据作用域(2026-11-08,同型根因 E 类第 2 条)。
 *
 * 现状:长期 refreshToken 明文写在 storage.local,而该 area 默认对内容脚本可读 ——
 * background.ts 里「token 走 local,仍保持 TRUSTED_CONTEXTS 不外溢」的注释与事实不符
 * (全仓从未对 local 调用过 setAccessLevel)。本组锁三件事:
 * ① 启动即把 local 降到 TRUSTED_CONTEXTS(内容脚本物理读不到 token area);
 * ② 不支持该 API 的运行时只告警、不阻断启动;
 * ③ 凭据永不改存到 storage.session(该 area 已为选区文本对内容脚本放开,
 *    把 token 挪进去等于扩大暴露面)。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { restrictLocalStorageToTrustedContexts } from '../lib/storage-access'

afterEach(() => {
  delete (globalThis as { chrome?: unknown }).chrome
})

function installChrome(local: Record<string, unknown>): void {
  ;(globalThis as unknown as { chrome: unknown }).chrome = { storage: { local } }
}

describe('storage.local 访问级', () => {
  it('降到 TRUSTED_CONTEXTS(内容脚本不得读取 token area)', async () => {
    const setAccessLevel = vi.fn(() => Promise.resolve())
    installChrome({ setAccessLevel })
    await restrictLocalStorageToTrustedContexts()
    expect(setAccessLevel).toHaveBeenCalledTimes(1)
    expect(setAccessLevel).toHaveBeenCalledWith({ accessLevel: 'TRUSTED_CONTEXTS' })
  })

  it('运行时不支持 setAccessLevel 时不抛错(只告警,不阻断启动)', async () => {
    installChrome({})
    await expect(restrictLocalStorageToTrustedContexts()).resolves.toBeUndefined()
  })
})

describe('凭据存储面接线锁', () => {
  const background = readFileSync(
    fileURLToPath(new URL('../entrypoints/background.ts', import.meta.url)),
    'utf8',
  )
  const token = readFileSync(fileURLToPath(new URL('../lib/token.ts', import.meta.url)), 'utf8')

  it('background 启动时执行访问级收紧', () => {
    expect(background).toContain('restrictLocalStorageToTrustedContexts()')
  })

  it('token.ts 不把任何凭据写进 storage.session', () => {
    expect(token).not.toContain('storage.session')
    expect(token).not.toMatch(/sessionSet|session\s*\.set/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
