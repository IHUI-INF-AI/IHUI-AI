// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// AI 输入框文字容器描边不变量(2026-11-23 用户定档):
//   纯打字文字容器静息不画描边,只留填充底;聚焦时只出现一层墨环(亮纯黑/暗纯白)。
// 这里锁住 RN/小程序两端实现形态,防止把常驻灰框或第二层内框加回来。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8')

const cssBlock = (text, selector) => {
  const at = text.indexOf(selector)
  if (at < 0) return ''
  const open = text.indexOf('{', at)
  const close = text.indexOf('}', open)
  return open >= 0 && close > open ? text.slice(open + 1, close) : ''
}

test('RN 大输入框:外壳静息透明,外层独担焦点墨环,内层文字框不再画第二层', () => {
  const src = read('apps/mobile-rn/src/components/InputArea.tsx')
  assert.match(src, /fieldShell:\s*\{[\s\S]*?borderColor: 'transparent'/)
  assert.match(src, /focusedStyle={styles\.inputFocusTransparent}/)
  assert.match(src, /fieldShellFocused/)
  assert.match(src, /inputFocusTransparent/)
})

test('RN 聊天输入框静息描边为透明(聚焦才换墨色)', () => {
  const src = read('apps/mobile-rn/src/components/BottomActionBar.tsx')
  assert.match(src, /borderRadius: INPUT_BORDER_RADIUS,[\s\S]*?borderColor: 'transparent'/)
})

test('RN 共享聊天输入壳静息描边为透明', () => {
  for (const rel of [
    'packages/app/src/features/chat/MessageInput.tsx',
    'packages/app/src/features/chat/ChatComposer.tsx',
  ]) {
    const src = read(rel)
    assert.match(src, /borderRadius: rnRadius\['2xl'\],[\s\S]*?borderColor: 'transparent'/, rel)
  }
})

test('小程序 AI 输入壳静息不画描边(聚焦由 useFieldFocus 墨色覆盖)', () => {
  const css = read('apps/miniapp-taro/src/pkg-ai/ai/chat.css')
  const block = cssBlock(css, '.search-box-bor')
  assert.match(block, /border:\s*1px solid transparent/)
})

test('web AI 输入卡:静息透明,聚焦取墨档单源 --color-stroke-focus(不随强调色变紫)', () => {
  const css = read('apps/web/app/globals.css')
  const shell = cssBlock(css, '.ai-input-shell {')
  assert.match(shell, /border-color:\s*transparent/)

  const idleFocus = cssBlock(css, '.ai-input-shell--idle:focus-within')
  assert.match(idleFocus, /border-color:\s*var\(--color-stroke-focus\)/)
  assert.match(idleFocus, /box-shadow:\s*none/)
  // --color-primary 会被 data-accent 覆盖成紫/绿/蓝;聚焦环必须跨主题恒定黑白。
  assert.doesNotMatch(idleFocus, /--color-primary/)
  assert.doesNotMatch(idleFocus, /chart-5|8b5cf6|violet/)

  const highRiskFocus = cssBlock(css, '.ai-input-shell--high-risk:focus-within')
  assert.match(highRiskFocus, /border-color:\s*var\(--color-stroke-focus\)/)
  assert.doesNotMatch(highRiskFocus, /--color-primary/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
