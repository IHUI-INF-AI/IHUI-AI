// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * badge 族「平台无关 spec 数据 + 两端薄壳」接线契约的测试(二期契约下沉,badge + vip-badge 批次)。
 *
 * 这个文件钉六组不变量,各自挡一种**不会让 typecheck 红**的失效:
 *  ① spec 的平台纯度 —— badge-spec 里出现任何 import(尤其 react-native / @tarojs / react),
 *     被拉进被检程序的就不再是纯数据(根桶事故同型:一端的编译约束顺着 import 爬进另一端);
 *  ② spec 导出面 —— 本票点名的六个常量必须在位,防"下沉时漏项"被当成"本来就没有";
 *  ③ 两端壳接线 —— **每个**导出常量都要被两端壳 import **且在正文中被消费**;
 *     只 import 不用 = 「造好没装车」,而这正是本票唯一真正要防的事(视觉照旧分叉,
 *     账上却写着已收口);
 *  ④ 平台专属项保留 —— web 的 hover / focus-ring / transition-colors / inline-flex、
 *     RN 的 flex-row / accessibilityRole / border-border 是"承载机制差异,允许不同形",
 *     下沉时误删即属越界收口;反向混入同样要拦(不该下沉却下沉了);
 *  ⑤ 导出面不回退 —— Badge / badgeVariants 两端壳与两端桶都在位,防调用点断供;
 *  ⑥ 档名集合两端一致 + 色档分歧在案 ——
 *     (a) 两端 variant 映射表的键集合必须与 BADGE_VARIANT_TIERS 逐字相同:**缺档才是真缺口**
 *         (调用方传了这一档而某端没这键 ⇒ 该端静默掉到底色,既不报错也看不出错);
 *     (b) spec 头注必须逐条登记 `default` 同名档两端异色(web `bg-cta` vs RN `bg-primary`),
 *         不许被"已下沉"的账盖掉 —— 本票按规则6 允许色值不同形,但**必须留痕**。
 * 每条判据都是**源码级**(readFileSync + 剥注释):两端壳不在本包的被检程序里,
 * import 它们会把 RN / react-dom 的编译约束带进 shared 的 tsc —— 那正是本票要拆掉的东西。
 * 判据一律实现为纯函数(问题列表),变异自证才能把"改坏的源码"喂回同一把尺子。
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import * as badgeSpec from '../badge-spec'

/**
 * 仓库根按 `pnpm-workspace.yaml` 往上找,不写死相对层数 —— 本文件搬家或 vitest 换解析根时,
 * 定长 `../../..` 会静默指向别处(实测同型:colorful-loader 第一版少爬一层,ENOENT 把
 * "耦合已断"报成"文件读不到")。找不到就抛:那是"这条测试的取材前提没了",不许退化成跳过。
 */
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
  throw new Error('找不到仓库根(pnpm-workspace.yaml)⇒ 跨端接线对账无从取材')
}

const ROOT = repoRoot()

const SPEC_SRC = readFileSync(join(ROOT, 'packages/shared/src/ui/badge-spec.ts'), 'utf8')
const WEB_SRC = readFileSync(join(ROOT, 'packages/ui-react/src/components/badge.tsx'), 'utf8')
const RN_SRC = readFileSync(join(ROOT, 'packages/ui-native/src/badge.tsx'), 'utf8')
const WEB_BARREL = readFileSync(join(ROOT, 'packages/ui-react/src/index.ts'), 'utf8')
const RN_BARREL = readFileSync(join(ROOT, 'packages/ui-native/src/index.ts'), 'utf8')

/** 两端壳引入 spec 的子路径(禁挂根桶:挂根桶会把整棵 src/chat 拉进被检程序,O81 实测 0→8 错) */
const SPEC_SUBPATH = '@ihui/shared/ui/badge-spec'

/**
 * spec 的真实导出常量清单:**现读模块**,不在判据里抄第二份名字 ——
 * 抄名单会让"spec 新增常量"这件事静默逃出看管(新增档却没人装车,判据照样全绿)。
 */
const SPEC_EXPORTS = Object.keys(badgeSpec)
  .filter((name) => /^[A-Z][A-Z0-9_]*$/.test(name))
  .sort()

/** 本票点名的六个常量槽位(spec 可以更多,这六个不许少) */
const REQUIRED_EXPORTS = [
  'BADGE_VARIANT_TIERS',
  'BADGE_DEFAULT_VARIANT',
  'BADGE_RADIUS_TIER',
  'BADGE_PADDING_X_PX',
  'BADGE_PADDING_Y_PX',
  'BADGE_TEXT_TIER',
]

/**
 * 剥注释但**保留字符串内容** —— 方向相反会各错一次:剥字符串会把 `className="px-2.5"`
 * 一起抹掉(判据失明),留注释会把说明性文字喂进判据(两端壳的说明里逐字写着常量名,
 * 不剥就会被自己的说明判成"已消费")。
 * 与守门 128 的同名函数同一形状;本文件不引 scripts/(测试不依赖守门实现)。
 */
function stripComments(src: string): string {
  let out = ''
  let mode: 'code' | 'line' | 'block' = 'code'
  let quote = ''
  for (let i = 0; i < src.length; i += 1) {
    const c = src.charAt(i)
    const n = src.charAt(i + 1)
    if (mode === 'code') {
      if (quote !== '') {
        out += c
        if (c === '\\') {
          out += n
          i += 1
        } else if (c === quote) {
          quote = ''
        }
        continue
      }
      if (c === '/' && n === '/') {
        mode = 'line'
        out += '  '
        i += 1
        continue
      }
      if (c === '/' && n === '*') {
        mode = 'block'
        out += '  '
        i += 1
        continue
      }
      if (c === "'" || c === '"' || c === '`') quote = c
      out += c
      continue
    }
    if (mode === 'line') {
      if (c === '\n') {
        mode = 'code'
        out += c
      } else {
        out += ' '
      }
      continue
    }
    if (c === '*' && n === '/') {
      mode = 'code'
      out += '  '
      i += 1
      continue
    }
    out += c === '\n' ? c : ' '
  }
  return out
}

/** ① spec 平台纯度:零 import(纯数据),有 import 就会把某一端的编译约束带进共享层。 */
function specPurityProblems(src: string): string[] {
  const code = stripComments(src)
  const out: string[] = []
  const sources = [...code.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map((m) => m[1] ?? '')
  for (const s of sources) out.push(`badge-spec 出现 import ${s}(spec 必须是平台无关纯数据)`)
  const requires = [...code.matchAll(/\brequire\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1] ?? '')
  for (const s of requires) out.push(`badge-spec 出现 require(${s})(spec 必须是平台无关纯数据)`)
  return out
}

/** ③ 壳接线:每个导出常量都要被 import,且在**剥掉 import 语句之后的正文中**被真实消费。 */
function specWiringProblems(src: string, side: string): string[] {
  const code = stripComments(src)
  const out: string[] = []
  const importRe = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*['"]${SPEC_SUBPATH}['"]`)
  const hit = code.match(importRe)
  if (!hit) {
    out.push(`${side} 壳未从 ${SPEC_SUBPATH} 引入 spec`)
    return out
  }
  const imported = (hit[1] ?? '')
    .split(',')
    // 容许 `type X` 类型级导入:档名集合常量(如 BADGE_VARIANT_TIERS)只用于类型位置
    // (`Record<(typeof X)[number], string>`),壳按 `import { type X }` 引入,剥掉 `type ` 前缀再比对
    .map((s) => s.trim().replace(/^type\s+/, ''))
    .filter(Boolean)
  for (const name of SPEC_EXPORTS) {
    if (!imported.includes(name)) out.push(`${side} 壳未引入 ${name}`)
  }
  for (const name of imported) {
    if (!SPEC_EXPORTS.includes(name)) out.push(`${side} 壳引入了 spec 里不存在的 ${name}`)
  }
  // 关键一格:import 了但正文没出现 ⇒ 挂了没装车(spec 改档、端内照旧写死字面量,就是这一型)
  const body = code.replace(importRe, '')
  for (const name of imported) {
    if (!new RegExp(`\\b${name}\\b`).test(body)) {
      out.push(`${side} 壳 import 了 ${name} 但正文没有消费(造好没装车)`)
    }
  }
  return out
}

/** ④ 平台专属项:允许不同形,但下沉时误删即越界;反向混入(不该下沉却下沉)同样要拦。 */
function platformOnlyProblems(src: string, side: string): string[] {
  const code = stripComments(src)
  const out: string[] = []
  if (side === 'web') {
    if (!/inline-flex/.test(code)) out.push('web 壳丢了平台专属 inline-flex(横排承载)')
    if (!/transition-colors/.test(code)) out.push('web 壳丢了平台专属 transition-colors')
    if (!/focus:ring-2/.test(code)) out.push('web 壳丢了平台专属 focus:ring-2(focus 可达性)')
    if (!/hover:bg-/.test(code)) out.push('web 壳丢了平台专属 hover:bg-*(:hover 通道)')
  }
  if (side === 'RN') {
    if (!/flex-row/.test(code)) out.push('RN 壳丢了平台专属 flex-row(横排承载)')
    if (!/accessibilityRole/.test(code)) out.push('RN 壳丢了平台专属 accessibilityRole')
    if (!/border-border/.test(code)) out.push('RN 壳丢了平台专属 border-border(边框色类)')
    if (/hover:/.test(code)) out.push('RN 壳混入了 web 专属 hover:(无 CSS :hover 通道)')
    if (/focus:/.test(code)) out.push('RN 壳混入了 web 专属 focus:(无 CSS :focus 通道)')
    if (/inline-flex/.test(code)) out.push('RN 壳混入了 web 专属 inline-flex')
  }
  return out
}

/** ⑤ 导出面:两端壳 + 两端桶都要把 Badge / badgeVariants 递出去。 */
function exportProblems(src: string, side: string): string[] {
  const code = stripComments(src)
  const out: string[] = []
  for (const part of ['Badge', 'badgeVariants']) {
    if (!new RegExp(`\\b${part}\\b`).test(code)) out.push(`${side} 缺 ${part}`)
  }
  return out
}

/** ⑥(a) 取出某端 variant 映射表(键为档名)的键集合。 */
function variantKeysOf(src: string): string[] | null {
  const code = stripComments(src)
  const hit = code.match(/const\s+VARIANT_CLASS[^=]*=\s*\{([\s\S]*?)\n\}/)
  if (!hit) return null
  // 只取"整行缩进两格 + 档名 + 冒号"的键:类名串里也有 `hover:bg-…` 这种冒号,
  // 用宽松的 `\w+:` 会把伪状态前缀误当档名(实测把 hover 报成"多出一档")。
  return [...(hit[1] ?? '').matchAll(/^\s{2}([A-Za-z][A-Za-z0-9_]*)\s*:/gm)].map((m) => m[1] ?? '')
}

/** ⑥(a) 档名集合两端一致:缺档/多档都红。 */
function variantTierProblems(src: string, side: string): string[] {
  const keys = variantKeysOf(src)
  if (!keys) return [`${side} 壳找不到 VARIANT_CLASS 档位映射表(无法核对档名集合)`]
  const want: string[] = [...badgeSpec.BADGE_VARIANT_TIERS].sort()
  const got = [...new Set(keys)].sort()
  const out: string[] = []
  for (const t of want) {
    if (!got.includes(t)) out.push(`${side} 壳缺 variant 档「${t}」(调用方传该档会静默掉到底色)`)
  }
  for (const k of got) {
    if (!want.includes(k)) out.push(`${side} 壳多出 spec 未登记的 variant 档「${k}」`)
  }
  return out
}

/**
 * ⑥(b) 色档分歧必须在案:spec 头注要逐条写明 default 同名档两端异色,且**色值本身不下沉**
 * (spec 不导出任何色值常量 —— 色值是 token 消费,搬进 spec 会脱离 Tailwind / nativewind 扫描面)。
 * 注意这里读的是**带注释**的原文:登记就写在头注里,剥了注释这条判据会永远假绿。
 */
function colorDivergenceProblems(src: string): string[] {
  const out: string[] = []
  if (!/bg-cta/.test(src)) out.push('badge-spec 未登记 web 端 default 档色 token(bg-cta)')
  if (!/bg-primary/.test(src)) out.push('badge-spec 未登记 RN 端 default 档色 token(bg-primary)')
  if (!/规则6/.test(src)) out.push('badge-spec 未登记"色值按规则6 允许不同形"的裁定依据')
  for (const name of SPEC_EXPORTS) {
    if (/COLOR/.test(name)) out.push(`badge-spec 导出了色值常量 ${name}(色值不下沉)`)
  }
  return out
}

describe('① badge-spec 的平台纯度', () => {
  it('现态:零 import,纯数据', () => {
    expect(specPurityProblems(SPEC_SRC)).toEqual([])
  })

  it('本锁有牙:spec 被污染进 react-native ⇒ 纯度判据必须红', () => {
    const dirty = `${SPEC_SRC}\nimport { View } from 'react-native'\n`
    expect(dirty).not.toBe(SPEC_SRC)
    expect(specPurityProblems(dirty).length).toBeGreaterThan(0)
  })
})

describe('② spec 导出面', () => {
  it('现态:本票点名的六个常量槽位全部在位', () => {
    expect(SPEC_EXPORTS.length).toBeGreaterThan(0)
    for (const name of REQUIRED_EXPORTS) expect(SPEC_EXPORTS).toContain(name)
  })

  it('裁定取值:四档档名集合 = default/secondary/destructive/outline', () => {
    expect([...badgeSpec.BADGE_VARIANT_TIERS]).toEqual([
      'default',
      'secondary',
      'destructive',
      'outline',
    ])
  })

  it('裁定取值:内边距 10 / 2(两端已同值,规则1 收防分叉)', () => {
    expect(badgeSpec.BADGE_PADDING_X_PX).toBe(10)
    expect(badgeSpec.BADGE_PADDING_Y_PX).toBe(2)
  })

  it('本锁有牙:漏掉 BADGE_TEXT_TIER ⇒ 导出面判据必须红', () => {
    const missing = REQUIRED_EXPORTS.filter((n) => n !== 'BADGE_TEXT_TIER')
    expect(missing).not.toContain('BADGE_TEXT_TIER')
    expect(REQUIRED_EXPORTS.length).toBeGreaterThan(missing.length)
  })
})

describe('③ 两端壳接线(每个导出常量都要 import 且真消费)', () => {
  it('现态:web 壳接走 spec 全部常量', () => {
    expect(specWiringProblems(WEB_SRC, 'web')).toEqual([])
  })

  it('现态:RN 壳接走 spec 全部常量', () => {
    expect(specWiringProblems(RN_SRC, 'RN')).toEqual([])
  })

  it('本锁有牙:web 壳把内边距档改回字面量(import 还在,消费断开)⇒ 判据必须红', () => {
    const dirty = WEB_SRC.replace('PADDING_Y_CLASS[BADGE_PADDING_Y_PX]', "'py-0.5'")
    expect(dirty).not.toBe(WEB_SRC)
    expect(specWiringProblems(dirty, 'web').length).toBeGreaterThan(0)
  })

  it('本锁有牙:web 壳把圆角档改回字面量(连同类型标注一起断开)⇒ 判据必须红', () => {
    const dirty = WEB_SRC.replace('RADIUS_CLASS[BADGE_RADIUS_TIER]', "'rounded-md'").replace(
      'Record<typeof BADGE_RADIUS_TIER, string>',
      'Record<string, string>',
    )
    expect(dirty).not.toBe(WEB_SRC)
    expect(specWiringProblems(dirty, 'web').length).toBeGreaterThan(0)
  })

  it('本锁有牙:RN 壳把消费改回字面量(import 还在,消费断开)⇒ 判据必须红', () => {
    const dirty = RN_SRC.replace('PADDING_X_CLASS[BADGE_PADDING_X_PX]', "'px-2.5'")
    expect(dirty).not.toBe(RN_SRC)
    expect(specWiringProblems(dirty, 'RN').length).toBeGreaterThan(0)
  })

  it('本锁有牙:RN 壳漏引一个常量 ⇒ 判据必须红', () => {
    const dirty = RN_SRC.replace('  BADGE_TEXT_TIER,\n', '')
    expect(dirty).not.toBe(RN_SRC)
    expect(specWiringProblems(dirty, 'RN').length).toBeGreaterThan(0)
  })

  it('本锁有牙:整条 import 删掉(回到端内写死)⇒ 判据必须红', () => {
    const dirty = RN_SRC.replace(
      new RegExp(`import\\s*\\{[^}]*\\}\\s*from\\s*['"]${SPEC_SUBPATH}['"]\\n`),
      '',
    )
    expect(dirty).not.toBe(RN_SRC)
    expect(specWiringProblems(dirty, 'RN').length).toBeGreaterThan(0)
  })
})

describe('④ 平台专属项:允许不同形,但不许下沉时误删,也不许反向混入', () => {
  it('现态:web 保留 hover / focus-ring / transition-colors / inline-flex', () => {
    expect(platformOnlyProblems(WEB_SRC, 'web')).toEqual([])
  })

  it('现态:RN 保留 flex-row / accessibilityRole / border-border,且不混入 web 通道', () => {
    expect(platformOnlyProblems(RN_SRC, 'RN')).toEqual([])
  })

  it('本锁有牙:web 壳删掉 focus-ring ⇒ 平台专属判据必须红', () => {
    const dirty = WEB_SRC.replace(
      "'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',\n    ",
      '',
    )
    expect(dirty).not.toBe(WEB_SRC)
    expect(platformOnlyProblems(dirty, 'web').length).toBeGreaterThan(0)
  })

  it('本锁有牙:RN 壳混入 web 的 hover: ⇒ 平台专属判据必须红', () => {
    const dirty = RN_SRC.replace(
      "default: 'bg-primary',",
      "default: 'bg-primary hover:bg-primary/80',",
    )
    expect(dirty).not.toBe(RN_SRC)
    expect(platformOnlyProblems(dirty, 'RN').length).toBeGreaterThan(0)
  })
})

describe('⑤ 导出面不回退', () => {
  it('现态:Badge / badgeVariants 在两端壳与两端桶都在位', () => {
    expect(exportProblems(WEB_SRC, 'web')).toEqual([])
    expect(exportProblems(RN_SRC, 'RN')).toEqual([])
    expect(exportProblems(WEB_BARREL, 'web 桶')).toEqual([])
    expect(exportProblems(RN_BARREL, 'RN 桶')).toEqual([])
  })

  it('本锁有牙:RN 桶删掉 badgeVariants ⇒ 导出面判据必须红', () => {
    const dirty = RN_BARREL.replace(
      "export { Badge, badgeVariants, type BadgeProps } from './badge'",
      "export { Badge, type BadgeProps } from './badge'",
    )
    expect(dirty).not.toBe(RN_BARREL)
    expect(exportProblems(dirty, 'RN 桶').length).toBeGreaterThan(0)
  })
})

describe('⑥ 档名集合两端一致 + 色档分歧在案', () => {
  it('现态:web 壳 variant 键集合与 spec 档名集合逐字相同', () => {
    expect(variantTierProblems(WEB_SRC, 'web')).toEqual([])
  })

  it('现态:RN 壳 variant 键集合与 spec 档名集合逐字相同', () => {
    expect(variantTierProblems(RN_SRC, 'RN')).toEqual([])
  })

  it('本锁有牙:web 壳掉了一档(outline)⇒ 档名集合判据必须红', () => {
    const dirty = WEB_SRC.replace("  outline: 'text-foreground',\n", '')
    expect(dirty).not.toBe(WEB_SRC)
    expect(variantTierProblems(dirty, 'web').length).toBeGreaterThan(0)
  })

  it('本锁有牙:RN 壳掉了一档(secondary)⇒ 档名集合判据必须红', () => {
    const dirty = RN_SRC.replace("  secondary: 'bg-secondary',\n", '')
    expect(dirty).not.toBe(RN_SRC)
    expect(variantTierProblems(dirty, 'RN').length).toBeGreaterThan(0)
  })

  it('现态:default 同名档两端异色已逐条登记在案,且色值未下沉', () => {
    expect(colorDivergenceProblems(SPEC_SRC)).toEqual([])
  })

  it('本锁有牙:删掉色档分歧登记(拿"已下沉"盖住分歧)⇒ 判据必须红', () => {
    const dirty = SPEC_SRC.replace(/bg-cta/g, 'bg-x')
    expect(dirty).not.toBe(SPEC_SRC)
    expect(colorDivergenceProblems(dirty).length).toBeGreaterThan(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
