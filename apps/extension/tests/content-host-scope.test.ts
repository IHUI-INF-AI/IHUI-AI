// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * DBG-65 / DBG-71 回归锁: 扩展授权面收窄。
 * - DBG-65: host_permissions 仅 localhost:8802/8803 + *.aizhs.top,但内容脚本
 *   matches 曾为 <all_urls> ⇒ 注入面远超授权面(全网页注入内容脚本)。
 *   现在两处白名单必须逐条一致。
 * - DBG-71: permissions 曾申请 scripting 但全仓零 chrome.scripting 使用 ⇒ 移除,
 *   防止商店审核误判为可注入任意代码的高危权限。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

/** 提取 `matches: [...]` 数组里的字符串项(取第一处 matches,即 defineContentScript 顶层)。 */
function extractMatches(src: string, label: string): string[] {
  const m = /matches:\s*\[([\s\S]*?)\]/.exec(src)
  expect(m, `${label} 应含 matches 数组`).not.toBeNull()
  return (m?.[1]?.match(/'[^']+'/g) ?? []).map((s) => s.replace(/'/g, ''))
}

describe('内容脚本注入面与 host_permissions 一致 (DBG-65)', () => {
  const content = read('../entrypoints/content.ts')
  const wxt = read('../wxt.config.ts')

  it('内容脚本不再声明 <all_urls>', () => {
    expect(content).not.toContain("'<all_urls>'")
    expect(content).not.toContain('"<all_urls>"')
  })

  it('内容脚本 matches 与 host_permissions 逐条一致', () => {
    const contentMatches = extractMatches(content, 'content.ts')
    // host_permissions 段单独提取(直接截数组,勿命中后续 matches 键)
    const hostIdx = wxt.indexOf('host_permissions:')
    expect(hostIdx).toBeGreaterThan(-1)
    const hostEnd = wxt.indexOf(']', hostIdx)
    const hostMatches = (wxt.slice(hostIdx, hostEnd).match(/'[^']+'/g) ?? []).map((s) =>
      s.replace(/'/g, ''),
    )
    expect(hostMatches.length).toBeGreaterThan(0)
    expect(new Set(hostMatches)).toEqual(new Set(contentMatches))
    expect(hostMatches.length).toBe(3)
    expect(hostMatches).toContain('http://localhost:8802/*')
    expect(hostMatches).toContain('http://localhost:8803/*')
    expect(hostMatches).toContain('https://*.aizhs.top/*')
  })

})

describe('移除未使用的 scripting 权限 (DBG-71)', () => {
  const wxt = read('../wxt.config.ts')

  it('manifest permissions 不含 scripting(剥注释后,注释会复述被移除的字样)', () => {
    const permsIdx = wxt.indexOf('permissions: [')
    expect(permsIdx).toBeGreaterThan(-1)
    const perms = wxt
      .slice(permsIdx, wxt.indexOf(']', permsIdx))
      .split('\n')
      .filter((line) => !line.trim().startsWith('//'))
      .join('\n')
    expect(perms).not.toContain('scripting')
    expect(perms).toContain("'storage'")
  })

  it('扩展源码(剥注释后)零 chrome.scripting 使用', () => {
    const files = [
      '../entrypoints/background.ts',
      '../entrypoints/content.ts',
      '../lib/agent-control.ts',
      '../lib/ext-ui-forwarder.ts',
    ]
    for (const f of files) {
      const code = read(f)
        .split('\n')
        .filter((line) => !line.trim().startsWith('//'))
        .join('\n')
      expect(code, f).not.toContain('chrome.scripting')
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
