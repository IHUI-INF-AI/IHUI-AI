// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// AI 输入卡聚焦紫辉光回归(2026-11-23 用户定档):
//   静息与聚焦都保留 1px field 灰描边;聚焦只叠加双层紫辉光(近 8px/10% + 远 22px -2px/18%)。
//   web / RN / 小程序共用 --color-ai-input-glow-* 这一组 token,不得端内另写 rgba。
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

test('设计 token 提供紫辉光单源三档,并登记到 token-registry', () => {
  const css = read('packages/design-tokens/src/styles/tokens.css')
  assert.match(css, /--color-ai-input-glow:\s*#8b5cf6/)
  assert.match(css, /--color-ai-input-glow-soft:\s*rgba\(139, 92, 246, 0\.1\)/)
  assert.match(css, /--color-ai-input-glow-strong:\s*rgba\(139, 92, 246, 0\.18\)/)

  const registry = read('packages/design-tokens/src/token-registry.ts')
  assert.match(registry, /name: '--color-ai-input-glow'/)
  assert.match(registry, /name: '--color-ai-input-glow-soft'/)
  assert.match(registry, /name: '--color-ai-input-glow-strong'/)

  const rn = read('packages/design-tokens/src/rn-tokens.ts')
  assert.match(rn, /aiInputGlow:\s*\{\s*DEFAULT:\s*'#8b5cf6'/)
  assert.match(rn, /soft:\s*'rgba\(139, 92, 246, 0\.1\)'/)
  assert.match(rn, /strong:\s*'rgba\(139, 92, 246, 0\.18\)'/)
})

test('RN 大输入框:field 灰描边 + 双层紫辉光,不取墨档', () => {
  const src = read('apps/mobile-rn/src/components/InputArea.tsx')
  assert.match(src, /fieldShell:\s*\{[\s\S]*?borderColor: tokens\.stroke\.field/)
  assert.match(src, /fieldShellFocused:\s*\{[\s\S]*?boxShadow: AI_INPUT_GLOW_SHADOW/)
  assert.match(src, /blurRadius: 8,?[\s\S]*?color: tokens\.aiInputGlow\.soft/)
  assert.match(
    src,
    /blurRadius: 22,?[\s\S]*?spreadDistance: -2,?[\s\S]*?color: tokens\.aiInputGlow\.strong/,
  )
  assert.doesNotMatch(
    cssBlock(src, 'fieldShellFocused'),
    /tokens\.stroke\.focus/,
    '聚焦态不得回取墨档描边',
  )
  assert.match(src, /focusedStyle={styles\.inputFocusTransparent}/)

  // 展开态第二圈"黑色描边"不是自绘 border,而是 RN Web 浏览器给 textarea 的
  // 默认 focus outline;TextField 基座必须显式关掉,聚焦视觉只留自绘那一圈。
  const field = read('packages/app/src/components/TextField.tsx')
  assert.match(field, /outlineStyle: 'none'/)
  assert.match(field, /outlineWidth: 0/)
  assert.match(field, /outlineColor: 'transparent'/)
})

test('小程序 AI 输入框:field 灰描边 + 同一组紫辉光 token', () => {
  const css = read('apps/miniapp-taro/src/pkg-ai/ai/chat.css')
  const block = cssBlock(css, '.search-box-bor')
  assert.match(block, /border:\s*1px solid var\(--color-input\)/)

  const src = read('apps/miniapp-taro/src/components/InputArea.tsx')
  assert.match(src, /borderColor: 'var\(--color-input\)'/)
  assert.match(src, /var\(--color-ai-input-glow-soft\)/)
  assert.match(src, /var\(--color-ai-input-glow-strong\)/)
})

test('web AI 输入卡:field 灰描边 + 双层紫辉光 token,禁止旧 chart-5', () => {
  const css = read('apps/web/app/globals.css')
  const shell = cssBlock(css, '.ai-input-shell {')
  assert.match(shell, /border-color:\s*var\(--color-input\)/)

  const idleFocus = cssBlock(css, '.ai-input-shell--idle:focus-within')
  assert.match(idleFocus, /border-color:\s*var\(--color-input\)/)
  assert.match(idleFocus, /0 0 8px 0 var\(--color-ai-input-glow-soft\)/)
  assert.match(idleFocus, /0 0 22px -2px var\(--color-ai-input-glow-strong\)/)
  assert.doesNotMatch(idleFocus, /--chart-5|8b5cf6|violet/)

  const highRiskFocus = cssBlock(css, '.ai-input-shell--high-risk:focus-within')
  assert.match(highRiskFocus, /border-color:\s*var\(--color-primary\)/)
})

const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

test('RN AI 输入框全量对齐 web:取消上限 / 1~6 行 / 字符计数 / 四箭头全屏', () => {
  const src = read('apps/mobile-rn/src/components/InputArea.tsx')
  const code = stripComments(src)
  // 字符限制:不再有任何截断实现;旧 maxLength prop 仅为兼容而保留(@deprecated,内部忽略)
  assert.doesNotMatch(
    code,
    /Math\.floor\(maxLength|maxLength=\{maxLength|value\.length\}\/\{maxLength\}/,
  )
  assert.doesNotMatch(code, /DEFAULT_MAX_LENGTH|WARNING_RATIO|isOverWarning/)
  assert.match(src, /@deprecated 2026-11-23[\s\S]*?maxLength\?: number/)
  // 1~6 行:上限 = shared spec 148;两层静态高 = 48 + 32 + 4 + 12 + 2
  assert.match(code, /MAX_INPUT_HEIGHT = INPUT_AREA_INPUT_MAX_HEIGHT_PX/)
  assert.match(code, /SHELL_STATIC_HEIGHT[\s\S]*?INPUT_AREA_INPUT_MIN_HEIGHT_PX/)
  assert.match(code, /SHELL_STATIC_HEIGHT[\s\S]*?rnGeometry\.controlBox/)
  // 字符显示逻辑:有内容才渲染「N 字符」,不显示分母/上限
  assert.match(code, /t\('charCount', \{ count: value\.length \}\)/)
  assert.match(code, /value\.length > 0/)
  assert.doesNotMatch(code, /\$\{?value\.length\}[^/]*\/[^/]*maxLength/)
  // 右上角四箭头 -> Modal 全屏,文本区 flex 撑满
  assert.match(code, /<Maximize/)
  assert.match(code, /setIsExpanded\(true\)/)
  assert.match(code, /<Modal/)
  assert.match(code, /styles\.expandedInput/)
  assert.match(
    code,
    /isExpanded \? styles\.fieldShellFocused : null|textFocused \? styles\.fieldShellFocused/,
  )

  const spec = read('packages/shared/src/ui/input-area-spec.ts')
  assert.match(spec, /INPUT_AREA_INPUT_MAX_HEIGHT_PX = 148/)
  // 胶囊仍取单行静态档 62,不被两层输入卡撑高
  assert.match(
    read('packages/shared/src/ui/tab-bar-spec.ts'),
    /TAB_BAR_HEIGHT_PX = INPUT_AREA_SHELL_HEIGHT_PX/,
  )

  for (const locale of ['zh-CN', 'zh-TW', 'en', 'ja', 'ko']) {
    const messages = JSON.parse(read(`packages/i18n/messages/mobile-rn/${locale}.json`))
    assert.equal(typeof messages.charCount, 'string', `${locale} 缺 charCount`)
    assert.match(messages.charCount, /\{count\}/, `${locale} charCount 缺插值占位`)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
