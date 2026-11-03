// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `remote-icons.ts` 死键回潮锁(承台账票 G-924 收口@2026-10-23)。
 *
 * 立票:注册表按票面口径从原型 zhs_app-ZZ 整体搬迁,原登记 290 条 URL。经全仓 HEAD 面
 * 逐键核消费方,原票点名的 10 条线上取不到的 URL 已在 2026-10-22 撤除;本轮把口径收紧到
 * "零消费方 = 死键 ⇒ 撤",现读 290 条只有 32 条被真实引用,其余 258 条一并撤除。
 *
 * 本文件把这件事钉成机械判据:任何新增的 `REMOTE_ICONS.<key>` 登记行,若在全仓代码面
 * 找不到 `icon('<key>')` / `<alias>.<key>` 消费方(`alias` 由 `const alias = REMOTE_ICONS
 * [ as Type ]` 派生,含 history.tsx / special.tsx 那两处类型收窄) ⇒ 判红。
 * 失效方向 = "多要一次定向说明"(AGENTS §0.10),不是"多放一次死键"。
 *
 * 阳性对照(证明本判据真的会红):对同一份 registry src 做 in-memory 变异(注入一条假
 * 死键 `__dead_key_probe__`),断言扫描器把它归到"零消费方"那侧 —— 只有"当前绿"而没有
 * "错了会红"的断言,与本仓记过多次的"判据失效的表现永远是安静"是同一种缺陷。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve, relative } from 'node:path'
import { describe, it, expect } from 'vitest'

const REGISTRY_REL = 'apps/miniapp-taro/src/constants/remote-icons.ts'
const REGISTRY_ABS = resolve(__dirname, '../../..', REGISTRY_REL)
const ROOT_ABS = resolve(__dirname, '../../..')

/** 消费方扫描面:凡可能 `import from '@/constants/remote-icons'` 的代码路径都算。 */
const SCAN_ROOTS = [
  'apps/miniapp-taro/src',
  'apps/miniapp-taro/tests',
  'apps/mobile-rn/src',
  'apps/web/src',
  'apps/desktop/src',
  'apps/extension/src',
  'apps/cli/src',
  'packages',
]

const CODE_EXT = /\.(ts|tsx|js|jsx)$/
const EXCLUDE_DIR = /^(node_modules|dist|dist-alipay|\.turbo|\.swc|build|out|coverage|assets)$/

function walk(dirAbs: string, out: string[] = []): string[] {
  let entries: string[]
  try {
    entries = readdirSync(dirAbs)
  } catch {
    return out
  }
  for (const name of entries) {
    if (EXCLUDE_DIR.test(name)) continue
    const p = join(dirAbs, name)
    let st
    try {
      st = statSync(p)
    } catch {
      continue
    }
    if (st.isDirectory()) walk(p, out)
    else if (st.isFile() && CODE_EXT.test(name)) out.push(p)
  }
  return out
}

/** 剥行注释与块注释,防止把注册表自身文档里的"使用方式"样例当消费方命中。 */
function codeFace(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
}

/** 从注册表源码里枚举 REMOTE_ICONS 对象体的键名。 */
function extractRegistryKeys(src: string): string[] {
  const lines = src.split('\n')
  const start = lines.findIndex((l) => l.startsWith('export const REMOTE_ICONS'))
  if (start < 0) throw new Error('注册表未找到 `export const REMOTE_ICONS` 声明')
  let end = start
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i] === '}') {
      end = i
      break
    }
  }
  const keys: string[] = []
  for (let i = start + 1; i < end; i++) {
    const m = lines[i]?.match(/^\s+([a-zA-Z_][a-zA-Z0-9_]*):/)
    const k = m?.[1]
    if (k) keys.push(k)
  }
  return keys
}

/** 从代码面找 `const X = REMOTE_ICONS` 别名,包含 `as Type` 变体;返回除注册表自身外的所有别名。 */
function collectAliases(content: string): Set<string> {
  const aliases = new Set<string>()
  const re = /\bconst\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*REMOTE_ICONS\b/g
  let m
  while ((m = re.exec(content))) {
    const a = m[1]
    if (a) aliases.add(a)
  }
  return aliases
}

/** 从代码面找 `import { ... } from '@/constants/remote-icons'` 里是否引了 `icon`。 */
function importsIconHelper(content: string): boolean {
  const re = /import\s*\{([^}]*)\}\s*from\s*['"]@\/constants\/remote-icons['"]/g
  let m
  while ((m = re.exec(content))) {
    const raw = m[1]
    if (!raw) continue
    const names = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (names.includes('icon')) return true
  }
  return false
}

/**
 * 扫描全仓代码面,返回每个键的消费方命中数。
 * 消费方形态:
 *   1. `icon('KEY')` / `icon("KEY")` / `icon(\`KEY\`)` —— 且该文件从 remote-icons 引了 `icon`
 *   2. `REMOTE_ICONS.KEY` / `REMOTE_ICONS['KEY']` / `REMOTE_ICONS["KEY"]`
 *   3. `<alias>.KEY` 与 `<alias>['KEY']`,其中 alias 来自 `const alias = REMOTE_ICONS ...`
 */
function scanConsumerHits(): Record<string, number> {
  const hits: Record<string, number> = {}
  const bump = (k: string) => {
    hits[k] = (hits[k] ?? 0) + 1
  }
  const candidateFiles: string[] = []
  for (const r of SCAN_ROOTS) {
    const abs = resolve(ROOT_ABS, r)
    try {
      statSync(abs)
    } catch {
      continue
    }
    walk(abs, candidateFiles)
  }
  for (const abs of candidateFiles) {
    const rel = relative(ROOT_ABS, abs).replace(/\\/g, '/')
    if (rel === REGISTRY_REL) continue // 注册表自身不算消费方
    let raw: string
    try {
      raw = readFileSync(abs, 'utf8')
    } catch {
      continue
    }
    const code = codeFace(raw)
    const aliases = collectAliases(code)
    const usesIconFn = importsIconHelper(code)

    // 1) icon('KEY') 字面量,限该文件引了 icon
    if (usesIconFn) {
      const re = /\bicon\(\s*['"`]([A-Za-z_][A-Za-z0-9_]*)['"`]/g
      let m
      while ((m = re.exec(code))) {
        const k = m[1]
        if (k) bump(k)
      }
    }

    // 2) REMOTE_ICONS.<k> / REMOTE_ICONS[<q><k><q>]
    {
      const reDot = /\bREMOTE_ICONS\.([A-Za-z_][A-Za-z0-9_]*)/g
      let m
      while ((m = reDot.exec(code))) {
        const k = m[1]
        if (k) bump(k)
      }
      const reBr = /\bREMOTE_ICONS\[\s*['"`]([A-Za-z_][A-Za-z0-9_]*)['"`]\s*\]/g
      while ((m = reBr.exec(code))) {
        const k = m[1]
        if (k) bump(k)
      }
    }

    // 3) 别名
    for (const a of aliases) {
      if (a === 'REMOTE_ICONS') continue
      const reA = new RegExp(`\\b${a}\\.([A-Za-z_][A-Za-z0-9_]*)`, 'g')
      let m
      while ((m = reA.exec(code))) {
        const k = m[1]
        if (k) bump(k)
      }
      const reABr = new RegExp(`\\b${a}\\[\\s*['"\`]([A-Za-z_][A-Za-z0-9_]*)['"\`]\\s*\\]`, 'g')
      while ((m = reABr.exec(code))) {
        const k = m[1]
        if (k) bump(k)
      }
    }
  }
  return hits
}

describe('remote-icons.ts 死键回潮锁(G-924)', () => {
  const registrySrc = readFileSync(REGISTRY_ABS, 'utf8')
  const keys = extractRegistryKeys(registrySrc)
  const hits = scanConsumerHits()

  it('注册表非空(枚举到 0 键判死,AGENTS §0.3)', () => {
    expect(keys.length).toBeGreaterThan(0)
  })

  it('零死键:每一枚注册表键都在全仓代码面命中至少一个消费方', () => {
    const dead = keys.filter((k) => (hits[k] ?? 0) === 0)
    expect(
      dead,
      `死键(全仓零消费方)${dead.length} 枚,清单:${dead.slice(0, 20).join(', ')}${dead.length > 20 ? ' …' : ''}`,
    ).toEqual([])
  })

  it('阳性对照:合成一枚假死键塞进注册表文本,判据必须点名它', () => {
    const fakeKey = '__dead_key_probe_g924__'
    const mutatedSrc = registrySrc.replace(
      /export const REMOTE_ICONS: Record<string, string> = \{/,
      `export const REMOTE_ICONS: Record<string, string> = {\n  ${fakeKey}: aizhsUrl('__probe__.png'),`,
    )
    const mutatedKeys = extractRegistryKeys(mutatedSrc)
    expect(mutatedKeys).toContain(fakeKey)
    // 假键在全仓代码面找不到消费方 ⇒ 应该被 dead 集合抓到
    expect(mutatedKeys.filter((k) => (hits[k] ?? 0) === 0)).toContain(fakeKey)
  })

  it('反向对照:类型收窄别名命中的键(history.tsx / special.tsx)必须算作有消费方', () => {
    // 这两处是 `const ICONS = REMOTE_ICONS as { ... }` 形态;判据必须走别名路径而不是
    // 只认字面 `REMOTE_ICONS.<k>`。任一枚被别名命中的键在 dead 集合出现 ⇒ 判据漏检。
    const narrowed = [
      'message',
      'imageOr',
      'aimusic',
      'jiqiren',
      'aitext',
      'plazaIcon01',
      'hot',
      'tishiIcon',
    ]
    for (const k of narrowed) {
      expect(keys, `键 ${k} 应当仍在注册表`).toContain(k)
      expect(hits[k] ?? 0, `键 ${k} 应通过 ICONS 别名命中至少一次`).toBeGreaterThan(0)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
