// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Esc 层栈水位回归。
 *
 * 拦的是这型回潮:新组件又去 document/window 上挂一个全局 keydown 消费 Escape,
 * 而不问层栈谁在栈顶。同一事件里同 target 上的多个监听器彼此不受 stopPropagation
 * 影响,所以每多一个这样的组件,"按一次 Esc 把所有层一起关掉"就复发一次。
 *
 * 判据取"全局监听 + Escape"这一窄口径,不取"文件里出现过 Escape" —— 后者会把
 * 元素级 onKeyDown(焦点在框内,本就不参与全局抢键)和键盘映射表一并算进来,
 * 门会在合规代码上恒红。
 */

const HERE = resolve(fileURLToPath(import.meta.url), '..')
const WEB_ROOT = resolve(HERE, '../..')
const SCAN_DIRS = ['app', 'src']

/** 挂在 document/window 上的全局 keydown 注册。 */
const GLOBAL_KEYDOWN = /(?:document|window)\s*\.\s*addEventListener\s*\(\s*['"]keydown['"]/
const HANDLES_ESCAPE = /['"]Escape['"]/
const IMPORTS_STACK = /from\s+['"][^'"]*overlay-stack['"]/

/**
 * 例外清单:key 为相对 apps/web 的路径,value 为"为什么它不算浮层消费者"。
 * 空清单是目标态;往里加条目前先确认该文件确实不是在关某层 UI。
 */
const ALLOWLIST: Record<string, string> = {}

const SKIP_DIR = new Set(['node_modules', '.next', '__tests__', 'test', 'tests'])
const SKIP_FILE = /\.test\.tsx?$/

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
      if (!SKIP_DIR.has(name)) yield* walk(full)
    } else if (/\.tsx?$/.test(name) && !SKIP_FILE.test(name)) {
      yield full
    }
  }
}

function collectViolations(): string[] {
  const violations: string[] = []
  for (const sub of SCAN_DIRS) {
    for (const file of walk(join(WEB_ROOT, sub))) {
      const rel = file.slice(WEB_ROOT.length + 1).replace(/\\/g, '/')
      if (rel.endsWith('lib/overlay-stack.ts')) continue
      if (rel in ALLOWLIST) continue
      const src = readFileSync(file, 'utf8')
      if (!GLOBAL_KEYDOWN.test(src)) continue
      if (!HANDLES_ESCAPE.test(src)) continue
      if (IMPORTS_STACK.test(src)) continue
      violations.push(rel)
    }
  }
  return violations.sort()
}

describe('overlay-stack 水位', () => {
  it('全局 keydown 里消费 Escape 的文件必须接入层栈', () => {
    const violations = collectViolations()
    expect(
      violations,
      `以下文件在 document/window 上挂了全局 keydown 并消费 Escape,却没接 @/lib/overlay-stack。` +
        `它们会让"按一次 Esc 只退一层"失效。修法四步(照抄 components/chat/add-menu-popover.tsx):\n` +
        violations.map((v) => `  - ${v}`).join('\n') +
        `\n1) import { isTopOverlay, popOverlay, pushOverlay } from '@/lib/overlay-stack'` +
        `\n2) const XXX_OVERLAY_ID = '<kebab-name>'` +
        `\n3) 注册监听前 pushOverlay(XXX_OVERLAY_ID),cleanup 里 popOverlay(XXX_OVERLAY_ID)` +
        `\n4) Escape 分支首行 if (!isTopOverlay(XXX_OVERLAY_ID)) return`,
    ).toEqual([])
  })

  it('例外清单里的路径必须真含全局 Escape 监听(防清单腐烂)', () => {
    const rotted = Object.keys(ALLOWLIST).filter((rel) => {
      const src = readFileSync(join(WEB_ROOT, rel), 'utf8')
      return !(GLOBAL_KEYDOWN.test(src) && HANDLES_ESCAPE.test(src))
    })
    expect(
      rotted,
      `例外清单这些条目已不成立(文件里已没有全局 Escape 监听),应直接从 ALLOWLIST 删除:\n${rotted.join('\n')}`,
    ).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
