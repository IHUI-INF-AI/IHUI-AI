// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 焦点环单一 token 不变量 —— 亮 #000 / 暗 #fff,灰环 --color-ring 不得回归。
// 约束来源:2026-11-23 用户定档「只留黑色跟白色,唯一 token」。
// 扫描面走 git ls-files(被审面),不看 .next/dist/.venv 等生成物。
import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8')

const FOCUS_TOKEN = '--color-stroke-focus'
const RETIRED_TOKEN = '--color-ring'

const SOURCE_FILES = [
  'packages/design-tokens/src/styles/tokens.css',
  'packages/design-tokens/src/tailwind-preset.js',
  'packages/design-tokens/src/rn-tokens.ts',
  'apps/miniapp-taro/src/app.css',
  'apps/mobile-rn/global.css',
]

test('焦点环 token 只保留黑/白两档', () => {
  const css = read('packages/design-tokens/src/styles/tokens.css')
  assert.match(css, /--color-stroke-focus:\s*#000000;/)
  assert.match(css, /--color-stroke-focus:\s*#ffffff;/)
  assert.ok(
    !new RegExp(`${RETIRED_TOKEN}\\s*:`).test(css),
    '灰环 token 不得在 tokens.css 里重新声明',
  )
})

test('三端派生副本与 Tailwind 映射不得带回灰环 token', () => {
  for (const rel of SOURCE_FILES) {
    const text = read(rel)
    assert.ok(!text.includes(RETIRED_TOKEN), `${rel} 仍引用 ${RETIRED_TOKEN}`)
  }
})

test('代码面不得再出现 ring-ring 类(焦点环已统一为 outline 四件套)', () => {
  const files = execSync('git ls-files "*.ts" "*.tsx" "*.js" "*.jsx" "*.css"', {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
    .split('\n')
    .filter(Boolean)
    .filter((f) => !f.includes('__tests__') && !f.includes('/tests/'))
  const hits = []
  for (const rel of files) {
    const text = read(rel)
    for (const line of text.split('\n')) {
      if (line.includes('ring-ring')) hits.push(`${rel}: ${line.trim().slice(0, 120)}`)
    }
  }
  assert.equal(hits.length, 0, hits.slice(0, 10).join('\n'))
})

test('共享输入框聚焦写法 = outline 四件套,不得退回 ring', () => {
  const input = read('packages/ui-react/src/components/input.tsx')
  assert.match(input, /focus-visible:outline-stroke-focus/)
  assert.ok(!/focus-visible:ring-/.test(input), '共享 Input 仍在使用 ring 焦点环')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
