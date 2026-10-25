// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * vip-badge 族「平台无关 spec 数据 + 两端薄壳」接线契约的测试(二期契约下沉,badge + vip-badge 批次)。
 *
 * 本族与 badge 族的差别先说清楚,免得后人对着这张表问"你到底裁了什么":
 *  **本票没有收任何需要裁定的数值档** —— 两端现值**逐字相同**(props 同吃 VipBadgeBaseProps,
 *  sizing 串 web:14 / RN:9 同为 md = `px-2.5 py-1 text-xs gap-1` / sm = `px-2 py-0.5 text-xs gap-0.5`)。
 *  所以本族的票面价值是**证明"零差异也能下沉"**:把已同值的 sizing 沉成 spec 当**回归锁** ——
 *  现在零差异不等于永远零差异,任一侧单方面改内边距/间隙,下面的判据都会红。
 *  ⇒ 若日后本族出现分歧,那是一次**新分叉**,不是本票没收干净。
 *
 * 这个文件钉六组不变量,各自挡一种**不会让 typecheck 红**的失效:
 *  ① spec 的平台纯度 —— vip-badge-spec 里出现任何 import(尤其 react-native / lucide-react / react),
 *     被拉进被检程序的就不再是纯数据(根桶事故同型:一端的编译约束顺着 import 爬进另一端);
 *  ② spec 导出面 —— 本票点名的常量槽位必须在位,防"下沉时漏项"被当成"本来就没有";
 *  ③ 两端壳接线 —— **每个**导出常量都要被两端壳 import **且在正文中被消费**;
 *     只 import 不用 = 「造好没装车」,而这正是本票唯一真正要防的事(视觉照旧分叉,
 *     账上却写着已收口);
 *  ④ 平台专属项保留 —— web 的 lucide `Crown` + `dark:text-amber-500` + `inline-flex`、
 *     RN 的 `flex-row` 是"承载机制差异,允许不同形",下沉时误删即属越界收口;反向混入同样要拦;
 *  ⑤ 导出面不回退 —— VipBadge 在两端壳与两端桶都在位,防调用点断供;
 *  ⑥ 档名集合两端一致 + 零差异登记在案 ——
 *     (a) 两端 sizing 映射表的键集合必须与 VIP_BADGE_SIZE_TIERS 逐字相同(缺档 ⇒ 该档静默掉到
 *         默认形态,是本族唯一会静默出错的失效型);
 *     (b) spec 头注必须写明本族"零差异下沉 = 回归锁"这一性质,防后人误判成本票没收干净。
 * 每条判据都是**源码级**(readFileSync + 剥注释):两端壳不在本包的被检程序里,
 * import 它们会把 RN / react-dom 的编译约束带进 shared 的 tsc —— 那正是本票要拆掉的东西。
 * 判据一律实现为纯函数(问题列表),变异自证才能把"改坏的源码"喂回同一把尺子。
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import * as vipBadgeSpec from '../vip-badge-spec'

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

const SPEC_SRC = readFileSync(join(ROOT, 'packages/shared/src/ui/vip-badge-spec.ts'), 'utf8')
const WEB_SRC = readFileSync(join(ROOT, 'packages/ui-react/src/components/vip-badge.tsx'), 'utf8')
const RN_SRC = readFileSync(join(ROOT, 'packages/ui-native/src/vip-badge.tsx'), 'utf8')
const WEB_BARREL = readFileSync(join(ROOT, 'packages/ui-react/src/index.ts'), 'utf8')
const RN_BARREL = readFileSync(join(ROOT, 'packages/ui-native/src/index.ts'), 'utf8')

/** 两端壳引入 spec 的子路径(禁挂根桶:挂根桶会把整棵 src/chat 拉进被检程序,O81 实测 0→8 错) */
const SPEC_SUBPATH = '@ihui/shared/ui/vip-badge-spec'

/**
 * spec 的真实导出常量清单:**现读模块**,不在判据里抄第二份名字 ——
 * 抄名单会让"spec 新增常量"这件事静默逃出看管(新增档却没人装车,判据照样全绿)。
 */
const SPEC_EXPORTS = Object.keys(vipBadgeSpec)
  .filter((name) => /^[A-Z][A-Z0-9_]*$/.test(name))
  .sort()

/** 本票点名的常量槽位(spec 可以更多,这些不许少) */
const REQUIRED_EXPORTS = [
  'VIP_BADGE_SIZE_TIERS',
  'VIP_BADGE_DEFAULT_SIZE',
  'VIP_BADGE_DEFAULT_LABEL',
  'VIP_BADGE_RADIUS_TIER',
  'VIP_BADGE_TEXT_TIER',
  'VIP_BADGE_MD_PADDING_X_PX',
  'VIP_BADGE_MD_PADDING_Y_PX',
  'VIP_BADGE_MD_GAP_PX',
  'VIP_BADGE_SM_PADDING_X_PX',
  'VIP_BADGE_SM_PADDING_Y_PX',
  'VIP_BADGE_SM_GAP_PX',
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
  for (const s of sources) out.push(`vip-badge-spec 出现 import ${s}(spec 必须是平台无关纯数据)`)
  const requires = [...code.matchAll(/\brequire\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1] ?? '')
  for (const s of requires) out.push(`vip-badge-spec 出现 require(${s})(spec 必须是平台无关纯数据)`)
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
    // 容许 `type X` 类型级导入:档名集合常量(如 VIP_BADGE_SIZE_TIERS)只用于类型位置
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
    if (!/Crown/.test(code)) out.push('web 壳丢了平台专属 lucide Crown 图标')
    if (!/dark:text-amber-500/.test(code)) out.push('web 壳丢了平台专属 dark:text-amber-500')
    if (!/inline-flex/.test(code)) out.push('web 壳丢了平台专属 inline-flex(横排承载)')
  }
  if (side === 'RN') {
    if (!/flex-row/.test(code)) out.push('RN 壳丢了平台专属 flex-row(横排承载)')
    if (/dark:/.test(code)) out.push('RN 壳混入了 web 专属 dark:(RN 无 dark: 通道)')
    if (/lucide/.test(code)) out.push('RN 壳混入了 web 专属 lucide 图标依赖')
    if (/inline-flex/.test(code)) out.push('RN 壳混入了 web 专属 inline-flex')
  }
  return out
}

/** ⑤ 导出面:两端壳 + 两端桶都要把 VipBadge 递出去。 */
function exportProblems(src: string, side: string): string[] {
  const code = stripComments(src)
  const out: string[] = []
  if (!/\bVipBadge\b/.test(code)) out.push(`${side} 缺 VipBadge`)
  return out
}

/** ⑥(a) 取出某端 sizing 映射表(键为 size 档名)的键集合。 */
function sizingKeysOf(src: string): string[] | null {
  const code = stripComments(src)
  const hit = code.match(/const\s+SIZING_CLASS[^=]*=\s*\{([\s\S]*?)\n\}/)
  if (!hit) return null
  // 只取"整行缩进两格 + 档名 + 冒号"的键(同上理由:类名串里的冒号不是档名分隔符)
  return [...(hit[1] ?? '').matchAll(/^\s{2}([A-Za-z][A-Za-z0-9_]*)\s*:/gm)].map((m) => m[1] ?? '')
}

/** ⑥(a) 档名集合两端一致:缺档/多档都红。 */
function sizeTierProblems(src: string, side: string): string[] {
  const keys = sizingKeysOf(src)
  if (!keys) return [`${side} 壳找不到 SIZING_CLASS 档位映射表(无法核对档名集合)`]
  const want = [...vipBadgeSpec.VIP_BADGE_SIZE_TIERS].sort()
  const got = [...new Set(keys)].sort()
  const out: string[] = []
  for (const t of want) {
    if (!got.includes(t)) out.push(`${side} 壳缺 size 档「${t}」(该档会静默掉到默认形态)`)
  }
  for (const k of got) {
    if (!want.includes(k)) out.push(`${side} 壳多出 spec 未登记的 size 档「${k}」`)
  }
  return out
}

/**
 * ⑥(b) 零差异登记在案:spec 头注必须写明"两端已同值 / 下沉是回归锁 / 收不到需裁定的数值档"。
 * 读的是**带注释**的原文:登记写在头注里,剥了注释这条判据会永远假绿。
 */
function zeroDiffRegistrationProblems(src: string): string[] {
  const out: string[] = []
  if (!/回归锁/.test(src)) out.push('vip-badge-spec 未写明本族下沉的性质是"回归锁"')
  if (!/零差异/.test(src)) out.push('vip-badge-spec 未写明本族两端现值零差异')
  if (!/规则1/.test(src)) out.push('vip-badge-spec 未写明本族全部命中规则1(已同值收防分叉)')
  return out
}

describe('① vip-badge-spec 的平台纯度', () => {
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
  it('现态:本票点名的常量槽位全部在位', () => {
    expect(SPEC_EXPORTS.length).toBeGreaterThan(0)
    for (const name of REQUIRED_EXPORTS) expect(SPEC_EXPORTS).toContain(name)
  })

  it('裁定取值:两档 size 集合 = sm/md,默认 sm + 文案 VIP', () => {
    expect([...vipBadgeSpec.VIP_BADGE_SIZE_TIERS]).toEqual(['sm', 'md'])
    expect(vipBadgeSpec.VIP_BADGE_DEFAULT_SIZE).toBe('sm')
    expect(vipBadgeSpec.VIP_BADGE_DEFAULT_LABEL).toBe('VIP')
  })

  it('裁定取值(规则1,两端已同值):md = 10/4/4,sm = 8/2/2', () => {
    expect(vipBadgeSpec.VIP_BADGE_MD_PADDING_X_PX).toBe(10)
    expect(vipBadgeSpec.VIP_BADGE_MD_PADDING_Y_PX).toBe(4)
    expect(vipBadgeSpec.VIP_BADGE_MD_GAP_PX).toBe(4)
    expect(vipBadgeSpec.VIP_BADGE_SM_PADDING_X_PX).toBe(8)
    expect(vipBadgeSpec.VIP_BADGE_SM_PADDING_Y_PX).toBe(2)
    expect(vipBadgeSpec.VIP_BADGE_SM_GAP_PX).toBe(2)
  })

  it('本锁有牙:漏掉 VIP_BADGE_SM_GAP_PX ⇒ 导出面判据必须红', () => {
    const missing = REQUIRED_EXPORTS.filter((n) => n !== 'VIP_BADGE_SM_GAP_PX')
    expect(missing).not.toContain('VIP_BADGE_SM_GAP_PX')
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

  it('本锁有牙:web 壳把 sm 档间隙改回字面量(import 还在,消费断开)⇒ 判据必须红', () => {
    const dirty = WEB_SRC.replace('GAP_CLASS[VIP_BADGE_SM_GAP_PX]', "'gap-0.5'")
    expect(dirty).not.toBe(WEB_SRC)
    expect(specWiringProblems(dirty, 'web')).toEqual([
      'web 壳 import 了 VIP_BADGE_SM_GAP_PX 但正文没有消费(造好没装车)',
    ])
  })

  it('本锁有牙:web 壳把圆角档改回字面量(连同类型标注一起断开)⇒ 判据必须红', () => {
    const dirty = WEB_SRC.replace('RADIUS_CLASS[VIP_BADGE_RADIUS_TIER]', "'rounded-md'").replace(
      'Record<typeof VIP_BADGE_RADIUS_TIER, string>',
      'Record<string, string>',
    )
    expect(dirty).not.toBe(WEB_SRC)
    expect(specWiringProblems(dirty, 'web').length).toBeGreaterThan(0)
  })

  it('本锁有牙:RN 壳把 md 档间隙改回字面量(import 还在,消费断开)⇒ 判据必须红', () => {
    const dirty = RN_SRC.replace('GAP_CLASS[VIP_BADGE_MD_GAP_PX]', "'gap-1'")
    expect(dirty).not.toBe(RN_SRC)
    expect(specWiringProblems(dirty, 'RN')).toEqual([
      'RN 壳 import 了 VIP_BADGE_MD_GAP_PX 但正文没有消费(造好没装车)',
    ])
  })

  it('本锁有牙:RN 壳漏引一个常量 ⇒ 判据必须红', () => {
    const dirty = RN_SRC.replace('  VIP_BADGE_MD_GAP_PX,\n', '')
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
  it('现态:web 保留 Crown 图标 + dark: 通道 + inline-flex', () => {
    expect(platformOnlyProblems(WEB_SRC, 'web')).toEqual([])
  })

  it('现态:RN 保留 flex-row,且不混入 lucide / dark: / inline-flex', () => {
    expect(platformOnlyProblems(RN_SRC, 'RN')).toEqual([])
  })

  it('本锁有牙:web 壳删掉 Crown 图标 ⇒ 平台专属判据必须红', () => {
    const dirty = WEB_SRC.replace("import { Crown } from 'lucide-react'\n", '').replace(
      /<Crown[^>]*\/>/,
      '',
    )
    expect(dirty).not.toBe(WEB_SRC)
    expect(platformOnlyProblems(dirty, 'web').length).toBeGreaterThan(0)
  })

  it('本锁有牙:RN 壳混入 web 的 dark: ⇒ 平台专属判据必须红', () => {
    const dirty = RN_SRC.replace('text-amber-600 ${', 'text-amber-600 dark:text-amber-500 ${')
    expect(dirty).not.toBe(RN_SRC)
    expect(platformOnlyProblems(dirty, 'RN').length).toBeGreaterThan(0)
  })
})

describe('⑤ 导出面不回退', () => {
  it('现态:VipBadge 在两端壳与两端桶都在位', () => {
    expect(exportProblems(WEB_SRC, 'web')).toEqual([])
    expect(exportProblems(RN_SRC, 'RN')).toEqual([])
    expect(exportProblems(WEB_BARREL, 'web 桶')).toEqual([])
    expect(exportProblems(RN_BARREL, 'RN 桶')).toEqual([])
  })

  it('本锁有牙:RN 桶删掉 VipBadge ⇒ 导出面判据必须红', () => {
    const dirty = RN_BARREL.replace("export { VipBadge } from './vip-badge'\n", '')
    expect(dirty).not.toBe(RN_BARREL)
    expect(exportProblems(dirty, 'RN 桶').length).toBeGreaterThan(0)
  })
})

describe('⑥ 档名集合两端一致 + 零差异登记在案', () => {
  it('现态:web 壳 sizing 键集合与 spec 档名集合逐字相同', () => {
    expect(sizeTierProblems(WEB_SRC, 'web')).toEqual([])
  })

  it('现态:RN 壳 sizing 键集合与 spec 档名集合逐字相同', () => {
    expect(sizeTierProblems(RN_SRC, 'RN')).toEqual([])
  })

  it('本锁有牙:web 壳掉了一档(md)⇒ 档名集合判据必须红', () => {
    const dirty = WEB_SRC.replace(/  md: \[\n[\s\S]*?\n  \]\.join\(' '\),\n/, '')
    expect(dirty).not.toBe(WEB_SRC)
    expect(sizeTierProblems(dirty, 'web')).toEqual([
      'web 壳缺 size 档「md」(该档会静默掉到默认形态)',
    ])
  })

  it('本锁有牙:RN 壳掉了一档(sm)⇒ 档名集合判据必须红', () => {
    const dirty = RN_SRC.replace(/  sm: \[\n[\s\S]*?\n  \]\.join\(' '\),\n/, '')
    expect(dirty).not.toBe(RN_SRC)
    expect(sizeTierProblems(dirty, 'RN').length).toBeGreaterThan(0)
  })

  it('现态:零差异下沉的性质已登记在案(回归锁,不是漏裁)', () => {
    expect(zeroDiffRegistrationProblems(SPEC_SRC)).toEqual([])
  })

  it('本锁有牙:删掉零差异登记 ⇒ 判据必须红', () => {
    const dirty = SPEC_SRC.replace(/回归锁/g, '收口')
    expect(dirty).not.toBe(SPEC_SRC)
    expect(zeroDiffRegistrationProblems(dirty).length).toBeGreaterThan(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
