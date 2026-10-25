// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * tabs 族「平台无关 spec 数据 + 两端薄壳」接线契约的测试(二期契约下沉,形状照 card-wiring)。
 *
 * 这个文件钉五组不变量,各自挡一种**不会让 typecheck 红**的失效:
 *  ① spec 的平台纯度 —— tabs-spec 里出现任何 import(尤其 react-native / @tarojs / react),
 *     被拉进被检程序的就不再是纯数据(根桶事故同型:一端的编译约束顺着 import 爬进另一端);
 *  ② spec 导出面 —— 本票点名的六个常量必须在位,防"下沉时漏项"被当成"本来就没有";
 *  ③ 两端壳接线 —— **每个**导出常量都要被两端壳 import **且在正文中被消费**;
 *     只 import 不用 = 「造好没装车」,而这正是本票唯一真正要防的事(视觉照旧分叉,
 *     账上却写着已收口);
 *  ④ 平台专属项保留 —— web 的 `px-3`(trigger 横向内距,Radix 按内容定宽)与
 *     `data-[state=active]` 选中态、RN 的 `flex-1`(tab 均分 list)是"承载机制差异,
 *     允许不同形",下沉时误删即属越界收口;
 *  ⑤ 导出面不回退 —— web 四件套(Tabs/TabsList/TabsTrigger/TabsContent)两端壳各自点位:
 *     web 四件都在位,RN 的单组件 Tabs 在位点(无 TabsList 等拆分件 —— RN 的 Tabs 是整条 tablist,
 *     与 web 的 Radix 四件结构不同,属结构差异而非欠债)。
 * 每条判据都是**源码级**(readFileSync + 剥注释):两端壳不在本包的被检程序里,
 * import 它们会把 RN / react-dom 的编译约束带进 shared 的 tsc —— 那正是本票要拆掉的东西。
 * 判据一律实现为纯函数(问题列表),变异自证才能把"改坏的源码"喂回同一把尺子。
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import * as tabsSpec from '../tabs-spec'

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

const SPEC_SRC = readFileSync(join(ROOT, 'packages/shared/src/ui/tabs-spec.ts'), 'utf8')
const WEB_SRC = readFileSync(join(ROOT, 'packages/ui-react/src/components/tabs.tsx'), 'utf8')
const RN_SRC = readFileSync(join(ROOT, 'packages/ui-native/src/tabs.tsx'), 'utf8')

/** 两端壳引入 spec 的子路径(禁挂根桶:挂根桶会把整棵 src/chat 拉进被检程序,O81 实测 0→8 错) */
const SPEC_SUBPATH = '@ihui/shared/ui/tabs-spec'

/**
 * spec 的真实导出常量清单:**现读模块**,不在判据里抄第二份名字 ——
 * 抄名单会让"spec 新增常量"这件事静默逃出看管(新增档却没人装车,判据照样全绿)。
 */
const SPEC_EXPORTS = Object.keys(tabsSpec)
  .filter((name) => /^[A-Z][A-Z0-9_]*$/.test(name))
  .sort()

/** 本票点名的六个常量槽位(spec 可以更多,这六个不许少) */
const REQUIRED_EXPORTS = [
  'TABS_LIST_RADIUS_TIER',
  'TABS_LIST_PADDING_PX',
  'TABS_LIST_HEIGHT_PX',
  'TABS_TRIGGER_RADIUS_TIER',
  'TABS_TRIGGER_FONT_SIZE_PX',
  'TABS_TRIGGER_PADDING_Y_PX',
]

/** 剥注释但**保留字符串内容** —— 方向相反会各错一次:剥字符串会把 `className="p-1"` 一起抹掉
 * (判据失明),留注释会把说明性文字喂进判据(两端壳的说明里逐字写着常量名,不剥就会被自己的说明判成"已消费")。 */
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
  for (const s of sources) out.push(`tabs-spec 出现 import ${s}(spec 必须是平台无关纯数据)`)
  const requires = [...code.matchAll(/\brequire\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1] ?? '')
  for (const s of requires) out.push(`tabs-spec 出现 require(${s})(spec 必须是平台无关纯数据)`)
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
    .map((s) => s.trim())
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

/** ④ 平台专属项:允许不同形,但下沉时误删即越界 ⇒ 逐条钉在位。 */
function platformOnlyProblems(src: string, side: string): string[] {
  const code = stripComments(src)
  const out: string[] = []
  if (side === 'web') {
    // web 的 trigger 横向内距(px-3)与选中态样式是 web 承载机制,允许不同形,但不可误删
    if (!/px-3/.test(code)) out.push('web 壳丢了平台专属 px-3(trigger 横向内距)')
    if (!/data-\[state=active\]/.test(code))
      out.push('web 壳丢了平台专属 data-[state=active](选中态)')
  }
  if (side === 'RN') {
    // RN 的 tab 是 flex-1 均分 list,这是 RN 布局机制,必须保留;且 web 的 px-3 不应泄露进 RN
    if (!/flex-1/.test(code)) out.push('RN 壳丢了平台专属 flex-1(tab 均分布局)')
    if (/px-3/.test(code)) out.push('RN 壳混入了 web 专属 px-3(不该下沉却下沉了)')
  }
  return out
}

/** ⑤ 导出面不回退:web 四件套都在位;RN 的单组件 Tabs 在位点(结构不同,无 TabsList 等拆分件)。
 * 判据只看 **export 声明**(export { ... } / export function X / export const X),不看全文 —— 否则
 * 组件定义 `const TabsContent = ...` 那处出现会让"从 export 里摘掉"这型失效漏检。 */
const WEB_PARTS = ['Tabs', 'TabsList', 'TabsTrigger', 'TabsContent']
const RN_PARTS = ['Tabs']

function exportProblems(src: string, parts: string[]): string[] {
  const code = stripComments(src)
  const exportTexts = [
    ...code.matchAll(
      /export\s+(?:(?:async\s+)?(?:function|const|let|var|class|type|interface)\s+[A-Za-z_$][\w$]*|\{[^}]*\})/g,
    ),
  ].map((m) => m[0])
  const exportBlob = exportTexts.join(' ')
  const out: string[] = []
  for (const part of parts) {
    if (!new RegExp(`\\b${part}\\b`).test(exportBlob)) out.push(`壳缺 ${part}`)
  }
  return out
}

describe('① tabs-spec 的平台纯度', () => {
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

  it('裁定取值:TABS_LIST_RADIUS_TIER = lg / TABS_TRIGGER_RADIUS_TIER = md(两端现值已同,收一处)', () => {
    expect(tabsSpec.TABS_LIST_RADIUS_TIER).toBe('lg')
    expect(tabsSpec.TABS_TRIGGER_RADIUS_TIER).toBe('md')
  })

  it('裁定取值:TABS_LIST_PADDING_PX = 4 / TABS_LIST_HEIGHT_PX = 36 / TABS_TRIGGER_PADDING_Y_PX = 4', () => {
    expect(tabsSpec.TABS_LIST_PADDING_PX).toBe(4)
    expect(tabsSpec.TABS_LIST_HEIGHT_PX).toBe(36)
    expect(tabsSpec.TABS_TRIGGER_PADDING_Y_PX).toBe(4)
  })

  it('本锁有牙:漏掉 TABS_TRIGGER_FONT_SIZE_PX ⇒ 导出面判据必须红', () => {
    const missing = REQUIRED_EXPORTS.filter((n) => n !== 'TABS_TRIGGER_FONT_SIZE_PX')
    expect(missing).not.toContain('TABS_TRIGGER_FONT_SIZE_PX')
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

  it('本锁有牙:web 壳把圆角档改回字面量(import 还在,消费断开)⇒ 判据必须红', () => {
    const dirty = WEB_SRC.replace(
      'TRIGGER_RADIUS_CLASS[TABS_TRIGGER_RADIUS_TIER]',
      "'rounded-md'",
    ).replace('Record<typeof TABS_TRIGGER_RADIUS_TIER, string>', 'Record<string, string>')
    expect(dirty).not.toBe(WEB_SRC)
    expect(specWiringProblems(dirty, 'web').length).toBeGreaterThan(0)
  })

  it('本锁有牙:web 壳把纵向内距改回字面量(连同类型标注一起断开)⇒ 判据必须红', () => {
    const dirty = WEB_SRC.replace(
      'TRIGGER_PADDING_Y_CLASS[TABS_TRIGGER_PADDING_Y_PX]',
      "'py-1'",
    ).replace('Record<number, string> = { 4:', 'Record<number, string> = { 0:')
    expect(dirty).not.toBe(WEB_SRC)
    expect(specWiringProblems(dirty, 'web').length).toBeGreaterThan(0)
  })

  it('本锁有牙:RN 壳把消费改回字面量(import 还在,消费断开)⇒ 判据必须红', () => {
    const dirty = RN_SRC.replace('LIST_HEIGHT_CLASS[TABS_LIST_HEIGHT_PX]', "'h-9'")
    expect(dirty).not.toBe(RN_SRC)
    expect(specWiringProblems(dirty, 'RN').length).toBeGreaterThan(0)
  })

  it('本锁有牙:RN 壳漏引一个常量 ⇒ 判据必须红', () => {
    const dirty = RN_SRC.replace('  TABS_TRIGGER_RADIUS_TIER,\n', '')
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

describe('④ 平台专属项:允许不同形,但不许下沉时误删', () => {
  it('现态:web 保留 px-3 与 data-[state=active]', () => {
    expect(platformOnlyProblems(WEB_SRC, 'web')).toEqual([])
  })

  it('现态:RN 保留 flex-1,且不混入 web px-3', () => {
    expect(platformOnlyProblems(RN_SRC, 'RN')).toEqual([])
  })

  it('本锁有牙:RN 壳删掉 flex-1 ⇒ 平台专属判据必须红', () => {
    const dirty = RN_SRC.replace(
      "'flex-1 items-center justify-center'",
      "'items-center justify-center'",
    )
    expect(dirty).not.toBe(RN_SRC)
    expect(platformOnlyProblems(dirty, 'RN').length).toBeGreaterThan(0)
  })
})

describe('⑤ 导出面不回退', () => {
  it('现态:web 四件套都在位', () => {
    expect(exportProblems(WEB_SRC, WEB_PARTS)).toEqual([])
  })

  it('现态:RN 的单组件 Tabs 在位点', () => {
    expect(exportProblems(RN_SRC, RN_PARTS)).toEqual([])
  })

  it('本锁有牙:web 壳删掉 TabsContent ⇒ 导出面判据必须红', () => {
    const dirty = WEB_SRC.replace(
      /export\s*\{\s*Tabs, TabsList, TabsTrigger, TabsContent\s*\}/,
      'export { Tabs, TabsList, TabsTrigger }',
    )
    expect(dirty).not.toBe(WEB_SRC)
    expect(exportProblems(dirty, WEB_PARTS).length).toBeGreaterThan(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
