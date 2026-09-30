// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * vendor-infer.ts 防漂移测试(2026-09-30 立 · AI 面板首屏延迟根治)
 *
 * 本文件钉死的是 vendor-infer.ts **存在的三条理由**,破任何一条该模块就失去意义:
 *   V1 键集合对账 —— VENDOR_CODES 必须与 brand-icon.tsx 的 VENDOR_COMPONENTS 键逐一相等
 *                    (缺一个/多一个都红)。这是防漂移核心:tsc 的 satisfies 只在
 *                    typecheck 时生效,而 CI 上 vitest 跑得比 tsc 频繁,且 satisfies
 *                    只锁"VENDOR_COMPONENTS 缺键",锁不住"VENDOR_CODES 多出已删厂商"。
 *   V2 inferVendor 行为 —— 正反用例(命中/前缀反查/空值/未命中)。
 *   V3 零依赖 —— 源码里不得出现任何运行时 import(只允许 import type)。
 *                这是它存在的根本理由:一旦有人 import 回 brand-icon / lobehub,
 *                95+ 个图标组件又被拖回面板主 chunk,而**零视觉症状** —— 只能靠这里咬住。
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { VENDOR_CODES, inferVendor, isKnownVendor } from '../vendor-infer'

/** 以 apps/web(vitest 进程工作目录)为基准读仓库内源码(与 d73-side-panel-pane-mount 同一姿势) */
function readRepo(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), 'utf-8')
}

const BRAND_ICON_SRC = readRepo('src/components/ai/brand-icon.tsx')
const VENDOR_INFER_SRC = readRepo('src/components/ai/vendor-infer.ts')

/** 块注释整体抹成等长空格(保行号),便于后续逐行判定 */
function blankBlockComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
}

/** 去掉行尾 // 注释(字符串字面量内的 // 不误伤) */
function stripLineComment(line: string): string {
  let out = ''
  let quote: string | null = null
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quote) {
      out += ch
      if (ch === '\\') {
        out += line[i + 1] ?? ''
        i++
        continue
      }
      if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch
      out += ch
      continue
    }
    if (ch === '/' && line[i + 1] === '/') break
    out += ch
  }
  return out
}

/** 去注释后的纯代码行 */
function codeLines(src: string): string[] {
  return blankBlockComments(src)
    .split('\n')
    .map((l) => stripLineComment(l))
}

/**
 * 从 brand-icon.tsx 抽出 `const VENDOR_COMPONENTS = { ... }` 的**键集合**。
 * 三种写法都要认(改动说明里点名的三种):
 *   `  openai: OpenAI,`
 *   `  'alibaba-cloud': AlibabaCloud,`
 *   `  '01ai': Yi,`
 */
function extractVendorComponentKeys(src: string): string[] {
  const anchor = 'const VENDOR_COMPONENTS = {'
  const start = src.indexOf(anchor)
  if (start < 0) throw new Error('brand-icon.tsx: 未找到 VENDOR_COMPONENTS 声明')
  const open = src.indexOf('{', start)
  if (open < 0) throw new Error('brand-icon.tsx: VENDOR_COMPONENTS 缺少 { ')
  let depth = 0
  let close = -1
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') {
      depth--
      if (depth === 0) {
        close = i
        break
      }
    }
  }
  if (close < 0) throw new Error('brand-icon.tsx: VENDOR_COMPONENTS 对象字面量未闭合')
  const body = src.slice(open + 1, close)

  const KEY_RE = /^\s*(?:'([^']+)'|"([^"]+)"|([A-Za-z_$][\w$]*))\s*:/
  const keys: string[] = []
  for (const raw of body.split('\n')) {
    const line = stripLineComment(raw)
    if (!line.trim()) continue
    const m = KEY_RE.exec(line)
    if (m) keys.push((m[1] ?? m[2] ?? m[3]) as string)
  }
  return keys
}

describe('vendor-infer: V1 厂商代码清单与 brand-icon 图标表逐键对账', () => {
  const iconKeys = extractVendorComponentKeys(BRAND_ICON_SRC)

  it('提取器真的抓到了整张图标表(防"正则没匹配上导致空集比对恒绿")', () => {
    expect(iconKeys.length, 'brand-icon.tsx 图标表键数应远超 100').toBeGreaterThan(100)
    expect(new Set(iconKeys).size, 'brand-icon.tsx 不应有重复键').toBe(iconKeys.length)
  })

  it('VENDOR_CODES 与 VENDOR_COMPONENTS 键集合完全一致(缺/多都红)', () => {
    const iconKeySet = new Set(iconKeys)
    const vendorSet = new Set<string>(VENDOR_CODES)

    const missingInIcons = VENDOR_CODES.filter((c) => !iconKeySet.has(c))
    const extraInIcons = iconKeys.filter((k) => !vendorSet.has(k))

    expect(
      missingInIcons,
      `VENDOR_CODES 中这些代码在 brand-icon.tsx 没有对应图标: ${missingInIcons.join(', ')}`,
    ).toEqual([])
    expect(
      extraInIcons,
      `brand-icon.tsx 中这些图标键不在 VENDOR_CODES: ${extraInIcons.join(', ')}`,
    ).toEqual([])
    expect(VENDOR_CODES.length).toBe(iconKeys.length)
  })

  it('VENDOR_CODES 自身无重复项', () => {
    expect(new Set(VENDOR_CODES).size).toBe(VENDOR_CODES.length)
  })

  it('brand-icon.tsx 用 satisfies Record<VendorCode, ...> 锁死键集合(不靠约定的自觉)', () => {
    // 注:判定只认"satisfies 子句 + 目标类型",不认它相对闭合花括号的位置 ——
    // 位置排版不是本用例要守的东西(守的是"键集合被 VendorCode 编译期锁死"这件事本身)。
    expect(BRAND_ICON_SRC).toMatch(
      /const\s+VENDOR_COMPONENTS\s*=\s*\{[\s\S]*?satisfies\s+Record<VendorCode,\s*VendorIconComponent\s*>/,
    )
  })

  it('brand-icon.tsx re-export inferVendor(旧调用方不破)', () => {
    expect(BRAND_ICON_SRC).toMatch(/export\s*\{\s*inferVendor\s*\}\s*from\s*'\.\/vendor-infer'/)
  })
})

describe('vendor-infer: V2 inferVendor 推断行为', () => {
  it('命中:裸模型名 → 厂商代码', () => {
    expect(inferVendor('gpt-4o')).toBe('openai')
    expect(inferVendor('claude-3-5-sonnet')).toBe('anthropic')
    expect(inferVendor('deepseek-chat')).toBe('deepseek')
    expect(inferVendor('qwen2.5-72b-instruct')).toBe('qwen')
  })

  it('providerCode/ 前缀反查(如 openai/gpt-4o → openai)', () => {
    expect(inferVendor('openai/gpt-4o')).toBe('openai')
    expect(inferVendor('anthropic/claude-3-5-sonnet')).toBe('anthropic')
    expect(inferVendor('stepfun/step-3.7-flash')).toBe('stepfun')
    // 裸名命中优先于前缀:前缀未知时仍按模型名推断
    expect(inferVendor('unknown-provider/gpt-4o')).toBe('openai')
  })

  it('空值一律 undefined(不得抛、不得返回空串)', () => {
    expect(inferVendor('')).toBeUndefined()
    expect(inferVendor(null)).toBeUndefined()
    expect(inferVendor(undefined)).toBeUndefined()
  })

  it('未命中:未知字串 → undefined', () => {
    expect(inferVendor('这是个不存在的模型')).toBeUndefined()
    expect(inferVendor('zzz-not-a-model')).toBeUndefined()
    expect(inferVendor('/')).toBeUndefined()
  })

  it('凡推断出结果,必是已登记厂商代码(inferVendor 不得返回野值)', () => {
    const samples = [
      'gpt-4o',
      'claude-3-5-sonnet',
      'openai/gpt-4o',
      'gemini-1.5-pro',
      'llama-3.1-70b',
      'grok-4',
      'glm-4.6',
      'doubao-pro-32k',
      'moonshot-v1-128k',
      'modelscope/qwen2.5-72b',
    ]
    let hit = 0
    for (const s of samples) {
      const v = inferVendor(s)
      if (v === undefined) continue
      hit++
      expect(isKnownVendor(v), `inferVendor('${s}') = '${v}' 不在册`).toBe(true)
    }
    expect(hit, '样例里至少应有若干命中(否则本用例形同虚设)').toBeGreaterThanOrEqual(8)
  })
})

describe('vendor-infer: V3 isKnownVendor', () => {
  it('已登记代码 → true', () => {
    expect(isKnownVendor('openai')).toBe(true)
    expect(isKnownVendor('anthropic')).toBe(true)
    expect(isKnownVendor('alibaba-cloud')).toBe(true)
    expect(isKnownVendor('01ai')).toBe(true)
  })

  it('未登记 / 空值 → false', () => {
    expect(isKnownVendor('不存在的厂商')).toBe(false)
    expect(isKnownVendor('')).toBe(false)
    expect(isKnownVendor(null)).toBe(false)
    expect(isKnownVendor(undefined)).toBe(false)
  })

  it('清单里每一项都能被 isKnownVendor 认下(两份真源自洽)', () => {
    for (const code of VENDOR_CODES) {
      expect(isKnownVendor(code), `'${code}' 应在册`).toBe(true)
    }
  })
})

describe('vendor-infer: V4 零依赖(本模块存在的根本理由)', () => {
  it('源码不含任何运行时 import 语句(只允许 import type)', () => {
    const runtimeImports = codeLines(VENDOR_INFER_SRC).filter(
      (l) => /^\s*import\b/.test(l) && !/^\s*import\s+type\b/.test(l),
    )
    expect(
      runtimeImports,
      `vendor-infer.ts 出现运行时 import,图标集会被拖回面板主 chunk: ${runtimeImports.join(' | ')}`,
    ).toEqual([])
  })

  it('源码不含动态 import() / require()', () => {
    const code = codeLines(VENDOR_INFER_SRC).join('\n')
    expect(code).not.toMatch(/\bimport\s*\(/)
    expect(code).not.toMatch(/\brequire\s*\(/)
  })

  it('源码不含对 brand-icon / lobehub 的任何引用(含注释外的路径串)', () => {
    const code = codeLines(VENDOR_INFER_SRC).join('\n')
    expect(code).not.toMatch(/brand-icon/)
    expect(code).not.toMatch(/@lobehub\/icons/)
  })
})
