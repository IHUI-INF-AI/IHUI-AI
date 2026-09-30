// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AISidePanel 懒加载边界(2026-09-30 立 · AI 面板首屏延迟根治)防回潮测试
 *
 * 为什么用**源码静态断言**而不是渲染:
 *   宿主 ai-side-panel.tsx 有 1756 行、拖着 chat 全套 + markdown 栈 + 终端 dock,
 *   为"某个 import 是不是静态的"去把整棵依赖树渲染起来,成本高且极易因无关重构而红。
 *   而"静态 import vs 动态 import"本身就是**源码属性** —— 直接读源码判定更稳、更准。
 *
 * 为什么必须钉死:
 *   把重组件改回静态 import 是**零视觉症状**的回退(面板照样能显示,只是又慢回去了),
 *   没有任何运行期行为测试能发现 —— 只能靠这里咬住。
 *
 * 判据分组:
 *   L1 8 个懒加载模块只出现在 import() 中,不得出现在静态 import 语句里
 *     (brand-icon 例外:允许 `import type` —— 类型导入编译期擦除,不会拖回图标集)
 *   L2 inferVendor 必须来自 @/components/ai/vendor-infer,不得改回从 brand-icon 导入
 *   L3 BrandIconDeferred 的 fallback 占位:aria-hidden + 按 size 设宽高
 *
 * 判定姿势:去注释(// 与 /* *\/)后按行处理,区分
 *   `import ... from '...'`(静态) 与 `import('...')`(动态)。
 *   注释里提到的模块路径(改动说明里就点名了这些路径)**不算**静态 import。
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** 以 apps/web(vitest 进程工作目录)为基准读仓库内源码 */
function readRepo(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), 'utf-8')
}

const HOST_REL = 'src/components/ai/ai-side-panel.tsx'
const HOST_SRC = readRepo(HOST_REL)

/** 懒加载边界内的模块(改动 2 点名的 8 个) */
const LAZY_MODULES = [
  '@/components/ai/agent-task-progress-pane',
  '@/components/ai/environment-info-popover',
  '@/components/ai/ai-side-panel-tools',
  '@/components/ai/ai-terminal-dock',
  '@/components/workspace/workspace-permission-dialog',
  '@/components/chat/question-dialog',
  '@/components/chat/compaction-status-bar',
  '@/components/ai/brand-icon',
] as const

/** 唯一允许静态 import(type-only)的模块 */
const TYPE_ONLY_ALLOWED = '@/components/ai/brand-icon'

type ImportKind = 'static' | 'static-type' | 'dynamic'
interface ImportSite {
  specifier: string
  kind: ImportKind
  line: number
  /** 语句原文(用于判断它绑定了哪些符号,如 inferVendor) */
  raw: string
}

/** 块注释抹成等长空格(保行号) */
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

/**
 * 扫描源码里的全部 import 位点,区分静态 / type-only 静态 / 动态。
 * 只认**带引号的模块说明符**,注释里光秃秃写的路径(如 `brand-icon(95+ 个 …)`)不计。
 */
function collectImports(src: string): ImportSite[] {
  const lines = blankBlockComments(src)
    .split('\n')
    .map((l) => stripLineComment(l))

  const sites: ImportSite[] = []
  // 动态:任意位置的 import('...')(本文件里出现在 dynamic(() => import('...')) 与 React.lazy 中)
  lines.forEach((line, idx) => {
    for (const m of line.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      sites.push({ specifier: m[1] as string, kind: 'dynamic', line: idx + 1, raw: line.trim() })
    }
  })

  // 静态:以 `import ` 开头(且不是 import() )的语句,可能跨行,直到出现 from '...' 或裸 import '...'
  let chunk: string | null = null
  let chunkStart = 0
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string
    if (chunk === null) {
      if (/^\s*import\s+(?!\()/.test(line)) {
        chunk = line
        chunkStart = i + 1
      } else {
        continue
      }
    } else {
      chunk += '\n' + line
    }

    const fromMatch = /\bfrom\s*['"]([^'"]+)['"]/.exec(chunk)
    const bareMatch = /^\s*import\s*['"]([^'"]+)['"]\s*;?\s*$/.exec(chunk)
    const specifier = fromMatch?.[1] ?? bareMatch?.[1]
    if (specifier === undefined) continue

    sites.push({
      specifier,
      kind: /^\s*import\s+type\b/.test(chunk) ? 'static-type' : 'static',
      line: chunkStart,
      raw: chunk.replace(/\s+/g, ' ').trim(),
    })
    chunk = null
  }
  return sites
}

const IMPORTS = collectImports(HOST_SRC)

describe('AISidePanel 懒加载边界 · L0 判定器自证', () => {
  it('判定器抓到了足够多的 import 位点(防"静态分析空转导致后续断言恒绿")', () => {
    expect(IMPORTS.length, 'ai-side-panel.tsx 应有大量 import').toBeGreaterThan(20)
    const dynamics = IMPORTS.filter((s) => s.kind === 'dynamic')
    expect(dynamics.length, '应有多个动态 import').toBeGreaterThanOrEqual(8)
  })

  it('注释里点名的模块路径不会被误判成静态 import', () => {
    // 改动说明的块注释里提到了 brand-icon / message-list 等路径,去注释后不应出现
    const statics = IMPORTS.filter((s) => s.kind !== 'dynamic').map((s) => s.specifier)
    expect(statics, '不得把注释文字当成静态 import').not.toContain('@lobehub/icons')
  })
})

describe('AISidePanel 懒加载边界 · L1 八个模块不得改回静态 import', () => {
  it.each(LAZY_MODULES)('%s 只出现在 import() 动态导入中', (mod) => {
    const dynamicSites = IMPORTS.filter((s) => s.kind === 'dynamic' && s.specifier === mod)
    // 运行时静态 import(非 import type):8 个模块一律禁止
    const runtimeStatic = IMPORTS.filter((s) => s.kind === 'static' && s.specifier === mod)
    // brand-icon 之外,连 type-only 静态导入也不许有(它们本该整体走 dynamic)
    const anyStatic =
      mod === TYPE_ONLY_ALLOWED
        ? []
        : IMPORTS.filter((s) => s.kind !== 'dynamic' && s.specifier === mod)

    expect(
      dynamicSites.length,
      `${mod} 应至少有一处动态 import(否则重组件被打回主 chunk)`,
    ).toBeGreaterThanOrEqual(1)
    expect(
      runtimeStatic,
      `${mod} 不得出现在运行时静态 import 语句里(第 ${runtimeStatic.map((s) => s.line).join(',')} 行)`,
    ).toEqual([])
    expect(
      anyStatic,
      `${mod} 不得出现在任何静态 import 语句里(第 ${anyStatic.map((s) => s.line).join(',')} 行)`,
    ).toEqual([])
  })

  it('brand-icon 唯一的静态 import 必须是 type-only', () => {
    const brandStatics = IMPORTS.filter(
      (s) => s.kind !== 'dynamic' && s.specifier === TYPE_ONLY_ALLOWED,
    )
    for (const site of brandStatics) {
      expect(
        site.kind,
        `${TYPE_ONLY_ALLOWED} 第 ${site.line} 行的静态 import 必须是 import type(否则 95+ 图标回主 chunk)`,
      ).toBe('static-type')
    }
  })

  it('每个 dynamic(...) 都带 ssr:false(与 GlobalShell 的 ssr:false 语义一致)', () => {
    const code = blankBlockComments(HOST_SRC)
    for (const mod of LAZY_MODULES) {
      if (mod === TYPE_ONLY_ALLOWED) continue // brand-icon 走 React.lazy,不是 dynamic()
      const idx = code.indexOf(`import('${mod}')`)
      expect(idx, `源码里应能定位到 import('${mod}')`).toBeGreaterThan(-1)
      const tail = code.slice(idx, idx + 200)
      expect(tail, `${mod} 的 dynamic 调用应带 ssr: false`).toMatch(/ssr:\s*false/)
    }
  })
})

describe('AISidePanel 懒加载边界 · L2 inferVendor 来自零依赖模块', () => {
  it('inferVendor 从 @/components/ai/vendor-infer 导入', () => {
    const inferVendorSites = IMPORTS.filter(
      (s) => s.kind !== 'dynamic' && /\binferVendor\b/.test(s.raw),
    )
    expect(
      inferVendorSites.length,
      '应有一处绑定 inferVendor 的静态 import(语句原文里出现 inferVendor)',
    ).toBeGreaterThanOrEqual(1)
    for (const site of inferVendorSites) {
      expect(
        site.specifier,
        `inferVendor 应从 @/components/ai/vendor-infer 导入(第 ${site.line} 行却从 ${site.specifier} 导入)`,
      ).toBe('@/components/ai/vendor-infer')
    }
  })

  it('inferVendor 不得改回从 brand-icon 导入(否则图标集被拖回主 chunk)', () => {
    const code = blankBlockComments(HOST_SRC)
      .split('\n')
      .map((l) => stripLineComment(l))
      .join('\n')
    const bad = /import\s+(?!type\b)[^;\n]*\{[^}\n]*\binferVendor\b[^}\n]*\}[^;\n]*from\s*['"]@\/components\/ai\/brand-icon['"]/
    expect(code).not.toMatch(bad)
    expect(code).not.toMatch(/\binferVendor\b[^;\n]*from\s*['"]@\/components\/ai\/brand-icon['"]/)
  })
})

describe('AISidePanel 懒加载边界 · L3 BrandIconDeferred 等尺寸占位', () => {
  const anchor = 'function BrandIconDeferred'
  const start = HOST_SRC.indexOf(anchor)

  it('存在 BrandIconDeferred(React.lazy + Suspense 包装体)', () => {
    expect(start, '应定义 BrandIconDeferred').toBeGreaterThan(-1)
    expect(HOST_SRC).toMatch(/const\s+BrandIconLazy\s*=\s*React\.lazy\(/)
  })

  it('fallback 占位带 aria-hidden 且按 size 设宽高(加载完成时不跳动)', () => {
    expect(start).toBeGreaterThan(-1)
    const end = HOST_SRC.indexOf('\n}', start)
    expect(end, 'BrandIconDeferred 函数体应有结束').toBeGreaterThan(start)
    const body = HOST_SRC.slice(start, end)

    expect(body, 'fallback 应渲染 <span> 占位').toMatch(/<span/)
    expect(body, '占位不得被读屏命中').toMatch(/aria-hidden/)
    expect(body, '占位应按 size 设宽高').toMatch(
      /style=\{\{\s*width:\s*size\s*,\s*height:\s*size\s*\}\}/,
    )
    expect(body, '占位应有 muted 同色底').toMatch(/inline-block shrink-0 rounded bg-muted/)
    expect(body, '应挂 React.Suspense 边界').toMatch(/React\.Suspense/)
    expect(body, '应把 size/className/vendor/fallbackIcon 透传给懒加载图标').toMatch(
      /<BrandIconLazy[\s\S]*size=\{size\}/,
    )
  })
})
