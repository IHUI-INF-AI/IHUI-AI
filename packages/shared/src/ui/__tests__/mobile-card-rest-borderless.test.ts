// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 移动端卡片容器「静息无描边」契约(2026-11-23 用户定档)。
 *
 * 背景:主界面所有白底容器外都多一圈 1px 灰描边,来源是各卡片样式里的
 * `borderWidth: 1 + borderColor: tk.border.light`(10% 黑)以及 Card 壳的
 * `border border-border`。定档后:卡片只保留表面填充(bg-card / surface.card),
 * 靠页面底 surface.bg(#F5F5F5)与卡片 #FFFFFF 的色差分层;
 * 描边宽度可保留(1px + transparent)以避免布局跳动,但颜色不得再取 border.light/medium。
 *
 * 判据是源码级(不 import RN 壳):spec 的编译约束不许被拉进 shared 的被检程序。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

function repoRoot(): string {
  let dir = fileURLToPath(new URL('.', import.meta.url))
  for (let up = 0; up < 12; up += 1) {
    try {
      readFileSync(join(dir, 'pnpm-workspace.yaml'), 'utf8')
      return dir
    } catch {
      const parent = resolve(dir, '..')
      if (parent === dir) break
      dir = parent
    }
  }
  throw new Error('找不到仓库根(pnpm-workspace.yaml)⇒ 移动端卡片描边契约无从取材')
}

const ROOT = repoRoot()

/** 共享卡片与主界面卡片样式:这些块的白底容器不得再持 border.light/medium */
const CARD_FILES: Array<{ file: string; blocks: string[] }> = [
  { file: 'packages/app/src/features/cards/AgentCard.tsx', blocks: ['card'] },
  { file: 'packages/app/src/features/cards/CourseCard.tsx', blocks: ['card'] },
  { file: 'packages/app/src/features/cards/BusinessCard.tsx', blocks: ['card'] },
  { file: 'packages/app/src/features/cards/VipCard.tsx', blocks: ['card'] },
  { file: 'packages/app/src/features/cards/UserInfoCard.tsx', blocks: ['card'] },
  { file: 'packages/app/src/components/ScreenStates.tsx', blocks: ['pressCard', 'skeletonCard', 'skeletonRow'] },
  { file: 'packages/app/src/features/agent-screen/AgentScreen.tsx', blocks: ['card'] },
  { file: 'packages/app/src/features/live/LiveScreen.tsx', blocks: ['card'] },
  { file: 'apps/mobile-rn/src/components/AiModelCard.tsx', blocks: ['card'] },
  { file: 'apps/mobile-rn/src/screens/ProfileScreen.tsx', blocks: ['contentItem'] },
]

const HARD_BORDER_RE = /borderColor\s*:\s*(?:tk\.|tokens\.)border\.(?:light|medium)/

/** 取 `name: { ... }` 的顶层块文本(括号配对;字符串内的花括号跳过) */
function styleBlock(src: string, name: string): string | null {
  const re = new RegExp(`\\b${name}\\s*:\\s*\\{`, 'g')
  const m = re.exec(src)
  if (!m) return null
  const open = src.indexOf('{', m.index)
  let depth = 0
  let i = open
  for (; i < src.length; i += 1) {
    const c = src[i]
    if (c === "'" || c === '"' || c === '`') {
      const quote = c
      i += 1
      while (i < src.length && src[i] !== quote) {
        if (src[i] === '\\') i += 1
        i += 1
      }
      continue
    }
    if (c === '{') depth += 1
    else if (c === '}') {
      depth -= 1
      if (depth === 0) break
    }
  }
  return src.slice(open + 1, i)
}

/** 顶层(不钻进嵌套对象)是否有取灰描边 */
function hasHardBorder(block: string): boolean {
  const lines = block.split('\n')
  let depth = 0
  for (const line of lines) {
    if (depth === 0 && HARD_BORDER_RE.test(line)) return true
    for (const c of line) {
      if (c === '{') depth += 1
      else if (c === '}') depth -= 1
    }
  }
  return false
}

function cardBorderProblems(): string[] {
  const out: string[] = []
  for (const { file, blocks } of CARD_FILES) {
    const src = readFileSync(join(ROOT, file), 'utf8')
    for (const name of blocks) {
      const block = styleBlock(src, name)
      if (block === null) {
        out.push(`${file} 找不到样式块 ${name}(判据取材前提没了)`)
        continue
      }
      if (hasHardBorder(block)) out.push(`${file} 的 ${name} 仍取 border.light/medium(卡片静息无描边)`)
    }
  }
  return out
}

/** 全量扫移动端源码里的容器型白底块(只认顶层边框色,不钻进嵌套对象) */
const CONTAINER_NAME = /card|panel|sheet|section|banner|contentitem/i
const CONTROL_NAME =
  /input|btn|button|chip|tag|badge|checkbox|tab|switch|avatar|indicator|divider|dot|icon|pager|picker|toggle|action|option|cell|qr|thumb|hit|glyph|error|star|rating|progress|handle|slider|radio|stepper|count/i
const SCAN_DIRS = ['packages/app/src', 'apps/mobile-rn/src']

function* walkTs(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '__tests__' || name.startsWith('.')) continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) yield* walkTs(p)
    else if (/\.(tsx|ts)$/.test(name)) yield p
  }
}

function scanMobileCardBorders(root: string): string[] {
  const out: string[] = []
  for (const dir of SCAN_DIRS) {
    for (const file of walkTs(join(root, dir))) {
      const src = readFileSync(file, 'utf8')
      const re = /([A-Za-z0-9_$]+)\s*:\s*\{/g
      let m: RegExpExecArray | null
      while ((m = re.exec(src))) {
        const name = m[1] ?? ''
        const open = src.indexOf('{', m.index)
        let depth = 0
        let i = open
        for (; i < src.length; i += 1) {
          const c = src[i]
          if (c === "'" || c === '"' || c === '`') {
            const quote = c
            i += 1
            while (i < src.length && src[i] !== quote) {
              if (src[i] === '\\') i += 1
              i += 1
            }
            continue
          }
          if (c === '{') depth += 1
          else if (c === '}') {
            depth -= 1
            if (depth === 0) break
          }
        }
        const body = src.slice(open + 1, i)
        re.lastIndex = i
        if (!CONTAINER_NAME.test(name) || CONTROL_NAME.test(name)) continue
        if (!hasHardBorder(body)) continue
        out.push(`${dir}/${file.slice(join(root, dir).length + 1)} 的 ${name}`)
      }
    }
  }
  return out
}

/** Card 壳(两端)根节点不得挂描边类 */
function cardShellProblems(): string[] {
  const out: string[] = []
  const shells = [
    ['packages/ui-native/src/card.tsx', 'RN'],
    ['apps/miniapp-taro/src/components/Card.tsx', '小程序'],
  ] as const
  for (const [file, side] of shells) {
    const src = readFileSync(join(ROOT, file), 'utf8')
    if (!/cn\('bg-card'/.test(src)) out.push(`${side} Card 壳根节点未收敛到 bg-card`)
    if (/cn\('border border-border bg-card'/.test(src)) out.push(`${side} Card 壳根节点又挂回描边`)
  }
  // 小程序按压卡:样式在 CSS,同一条规则
  const css = readFileSync(join(ROOT, 'apps/miniapp-taro/src/components/ScreenStates.taro.css'), 'utf8')
  const press = /\.ihui-press-card\s*\{([\s\S]*?)\}/.exec(css)
  if (!press) out.push('找不到 .ihui-press-card 规则(判据取材前提没了)')
  else if (/border\s*:/.test(press[1] ?? '')) out.push('.ihui-press-card 仍挂 border(卡片静息无描边)')
  return out
}

describe('移动端卡片静息无描边', () => {
  it('现态:共享卡片 + 主界面卡片样式不再取 border.light/medium', () => {
    expect(cardBorderProblems()).toEqual([])
  })

  it('现态:移动端全量容器型样式块都不再取 border.light/medium', () => {
    expect(scanMobileCardBorders(ROOT)).toEqual([])
  })

  it('现态:两端 Card 壳与小程序按压卡不再挂描边', () => {
    expect(cardShellProblems()).toEqual([])
  })

  it('本锁有牙:把透明描边改回 tk.border.light ⇒ 判据必须红', () => {
    const src = readFileSync(join(ROOT, 'packages/app/src/features/cards/AgentCard.tsx'), 'utf8')
    const dirty = src.replace(
      "borderColor: 'transparent'",
      "borderColor: tk.border.light",
    )
    expect(dirty).not.toBe(src)
    const block = styleBlock(dirty, 'card')
    expect(block).not.toBeNull()
    expect(hasHardBorder(block ?? '')).toBe(true)
  })

  it('本锁有牙:给 Card 壳加回 border border-border ⇒ 判据必须红', () => {
    const src = readFileSync(join(ROOT, 'packages/ui-native/src/card.tsx'), 'utf8')
    const dirty = src.replace("cn('bg-card'", "cn('border border-border bg-card'")
    expect(dirty).not.toBe(src)
    expect(/cn\('border border-border bg-card'/.test(dirty)).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
