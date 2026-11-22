// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * ui-react 侧 Esc 层栈水位回归(与 apps/web 的 overlay-stack-water-level.test.ts
 * 同口径,扫描面换成 packages/ui-react/src)。
 *
 * 拦的是这型回潮:ui-react 里又有组件去 document 上挂全局 keydown 消费 Escape
 * 而不问层栈谁在栈顶。Dialog/Sheet/Drawer/Select 家族经 useEscStackGuard 内建
 * 注册,自绘下拉(TreeSelect / WorkPanel dropdown)已手动接入 —— 新增全局 Escape
 * 消费点必须同样接入。
 */

const HERE = resolve(fileURLToPath(import.meta.url), '..')
// apps/web/src/lib → 仓库根 → packages/ui-react/src
const UIREACT_SRC = resolve(HERE, '../../../packages/ui-react/src')

const GLOBAL_KEYDOWN = /(?:document|window)\s*\.\s*addEventListener\s*\(\s*['"]keydown['"]/
const HANDLES_ESCAPE = /['"]Escape['"]/
const IMPORTS_STACK = /from\s+['"][^'"]*overlay-stack['"]/

function* walk(dir: string): Generator<string> {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const name of entries) {
    const full = join(dir, name)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (st.isDirectory()) {
      yield* walk(full)
    } else if (/\.tsx?$/.test(name) && !name.endsWith('.test.ts') && !name.endsWith('.test.tsx')) {
      yield full
    }
  }
}

describe('overlay-stack 水位(ui-react)', () => {
  it('ui-react 内全局 keydown 消费 Escape 的文件必须接入层栈', () => {
    const violations: string[] = []
    for (const file of walk(UIREACT_SRC)) {
      if (file.endsWith('lib/overlay-stack.ts')) continue
      const src = readFileSync(file, 'utf8')
      if (!GLOBAL_KEYDOWN.test(src)) continue
      if (!HANDLES_ESCAPE.test(src)) continue
      if (IMPORTS_STACK.test(src)) continue
      violations.push(file.slice(UIREACT_SRC.length + 1).replace(/\\/g, '/'))
    }
    expect(
      violations.sort(),
      `以下 ui-react 文件在 document/window 上挂了全局 keydown 并消费 Escape,却没接层栈。` +
        `修法:import { isTopOverlay, popOverlay, pushOverlay } from '../lib/overlay-stack',` +
        `open 时 push / cleanup 时 pop / Escape 分支首行 if (!isTopOverlay(id)) return。` +
        `Radix Content 家族一律走 useEscStackId + mergeEscStackRef + guardEscKeyDown(lib/use-esc-stack.ts):\n` +
        violations.map((v) => `  - ${v}`).join('\n'),
    ).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
