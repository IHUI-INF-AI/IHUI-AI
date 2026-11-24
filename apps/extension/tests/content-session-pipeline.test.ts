// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * DBG-61 / DBG-62 回归锁: 选区「查词 / 发送到 AI」链路。
 * - DBG-61: chrome.storage.session 默认 TRUSTED_CONTEXTS ⇒ 内容脚本里整个 undefined,
 *   `?.set` 静默 no-op。background 启动时必须把 session 放开到 TRUSTED_AND_UNTRUSTED_CONTEXTS,
 *   内容脚本的两个生产者写入才有意义。
 * - DBG-62: chrome.tabs.query / chrome.sidePanel.open 不在内容脚本可用面内,
 *   打开侧栏必须改走 background 的 sidePanel.open 消息通道。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

describe('storage.session 访问级放开 (DBG-61)', () => {
  const bg = read('../entrypoints/background.ts')

  it('background 启动时把 session 放开给内容脚本(TRUSTED_AND_UNTRUSTED_CONTEXTS)', () => {
    expect(bg).toContain("setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' })")
  })

  it('放开失败只告警,不阻断 SW 启动', () => {
    const idx = bg.indexOf("setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' })")
    const around = bg.slice(Math.max(0, idx - 400), idx + 600)
    expect(around).toContain('console.warn')
  })

  it('内容脚本仍经 session 写两个 pending 键(生产者不回归)', () => {
    const content = read('../entrypoints/content.ts')
    expect(content).toContain('chrome.storage.session?.set({ ihui_pending_vocab: text })')
    expect(content).toContain('chrome.storage.session?.set({ ihui_pending_prompt: text })')
  })
})

describe('侧栏打开走消息通道 (DBG-62)', () => {
  const content = read('../entrypoints/content.ts')

  it('handleSendToAI 经 sendMessage 请求 sidePanel.open', () => {
    expect(content).toContain("type: 'sidePanel.open'")
  })

  it('内容脚本代码(剥注释后)不再直接触碰 tabs.query / sidePanel.open(不在可用面内)', () => {
    const code = content
      .split('\n')
      .filter((line) => !line.trim().startsWith('//'))
      .join('\n')
    expect(code).not.toContain('chrome.tabs.query')
    expect(code).not.toContain('chrome.sidePanel.open(')
  })

  it('background 侧确有该消息的落地分支', () => {
    const bg = read('../entrypoints/background.ts')
    expect(bg).toContain("case 'sidePanel.open'")
    expect(bg).toContain('handleSidePanelOpen')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
