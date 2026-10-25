// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * tooltip 族「平台无关 spec 数据 + 两端薄壳」接线契约的测试(二期契约下沉,tooltip + input 批次)。
 *
 * 这个文件钉六组不变量,各自挡一种**不会让 typecheck 红**的失效:
 *  ① spec 的平台纯度 —— tooltip-spec 里出现任何 import(尤其 react-native / @tarojs / react),
 *     被拉进被检程序的就不再是纯数据(根桶事故同型:一端的编译约束顺着 import 爬进另一端);
 *  ② spec 导出面 —— 本票点名的六个常量必须在位,防"下沉时漏项"被当成"本来就没有";
 *  ③ 两端壳接线 —— **每个**导出常量都要被两端壳 import **且在正文中被消费**;
 *     只 import 不用 = 「造好没装车」,而这正是本票唯一真正要防的事(视觉照旧分叉,
 *     账上却写着已收口);
 *  ④ 平台专属项保留 —— web 的 z-popover / Arrow / animate-in / overflow-hidden、
 *     RN 的 Modal 自绘定位 / 长按 300ms / border-border / MAX_WIDTH 是"承载机制差异,允许不同形",
 *     下沉时误删即属越界收口;反向混入同样要拦(不该下沉却下沉了);
 *  ⑤ 导出面不回退 —— Tooltip 四件套两端壳与两端桶都在位,防调用点断供;
 *  ⑥ 核心档裁定 + 单端档留痕 ——
 *     (a) GAP 是本族唯一的分叉档,裁定值 4(规则2 取 compact 较小档),两端都按它落点;
 *     (b) 只下沉的那一半不许被"已下沉"的账盖掉:MAX_WIDTH / delayLongPress / ANIM_DURATION
 *         是**单端项**,spec 头注必须逐条登记,且 spec **不得导出**它们(导出了就必须被两端消费,
 *         而 web 端没有对应槽位 ⇒ 一旦导出就是把单端项伪装成跨端项)。
 * 每条判据都是**源码级**(readFileSync + 剥注释):两端壳不在本包的被检程序里,
 * import 它们会把 RN / react-dom 的编译约束带进 shared 的 tsc —— 那正是本票要拆掉的东西。
 * 判据一律实现为纯函数(问题列表),变异自证才能把"改坏的源码"喂回同一把尺子。
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import * as tooltipSpec from '../tooltip-spec'

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

const SPEC_SRC = readFileSync(join(ROOT, 'packages/shared/src/ui/tooltip-spec.ts'), 'utf8')
const WEB_SRC = readFileSync(join(ROOT, 'packages/ui-react/src/components/tooltip.tsx'), 'utf8')
const RN_SRC = readFileSync(join(ROOT, 'packages/ui-native/src/tooltip.tsx'), 'utf8')
const WEB_BARREL = readFileSync(join(ROOT, 'packages/ui-react/src/index.ts'), 'utf8')
const RN_BARREL = readFileSync(join(ROOT, 'packages/ui-native/src/index.ts'), 'utf8')

/** 两端壳引入 spec 的子路径(禁挂根桶:挂根桶会把整棵 src/chat 拉进被检程序,O81 实测 0→8 错) */
const SPEC_SUBPATH = '@ihui/shared/ui/tooltip-spec'

/**
 * spec 的真实导出常量清单:**现读模块**,不在判据里抄第二份名字 ——
 * 抄名单会让"spec 新增常量"这件事静默逃出看管(新增档却没人装车,判据照样全绿)。
 */
const SPEC_EXPORTS = Object.keys(tooltipSpec)
  .filter((name) => /^[A-Z][A-Z0-9_]*$/.test(name))
  .sort()

/** 本票点名的六个常量槽位(spec 可以更多,这六个不许少) */
const REQUIRED_EXPORTS = [
  'TOOLTIP_GAP_PX',
  'TOOLTIP_RADIUS_TIER',
  'TOOLTIP_PADDING_X_PX',
  'TOOLTIP_PADDING_Y_PX',
  'TOOLTIP_TEXT_TIER',
  'TOOLTIP_SHADOW_TIER',
]

/**
 * 剥注释但**保留字符串内容** —— 方向相反会各错一次:剥字符串会把 `className="px-3"`
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
  for (const s of sources) out.push(`tooltip-spec 出现 import ${s}(spec 必须是平台无关纯数据)`)
  const requires = [...code.matchAll(/\brequire\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1] ?? '')
  for (const s of requires) out.push(`tooltip-spec 出现 require(${s})(spec 必须是平台无关纯数据)`)
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

/** ④ 平台专属项:允许不同形,但下沉时误删即越界;反向混入(不该下沉却下沉)同样要拦。 */
function platformOnlyProblems(src: string, side: string): string[] {
  const code = stripComments(src)
  const out: string[] = []
  if (side === 'web') {
    if (!/z-popover/.test(code)) out.push('web 壳丢了平台专属 z-popover(层叠通道)')
    if (!/Arrow/.test(code)) out.push('web 壳丢了平台专属 Arrow(气泡箭头)')
    if (!/animate-in/.test(code)) out.push('web 壳丢了平台专属 animate-in(进出场动画)')
    if (!/overflow-hidden/.test(code)) out.push('web 壳丢了平台专属 overflow-hidden')
    if (/delayLongPress/.test(code)) out.push('web 壳混入了 RN 专属 delayLongPress(长按通道)')
  }
  if (side === 'RN') {
    if (!/delayLongPress/.test(code)) out.push('RN 壳丢了平台专属 delayLongPress(长按触发)')
    if (!/Modal/.test(code)) out.push('RN 壳丢了平台专属 Modal(浮层承载)')
    if (!/measureInWindow/.test(code)) out.push('RN 壳丢了平台专属 measureInWindow(自绘定位)')
    if (!/border-border/.test(code)) out.push('RN 壳丢了平台专属 border-border(边框色类)')
    if (!/MAX_WIDTH/.test(code)) out.push('RN 壳丢了单端项 MAX_WIDTH(240 上限)')
    if (/z-popover/.test(code)) out.push('RN 壳混入了 web 专属 z-popover(无 z-index 通道)')
    if (/animate-in/.test(code)) out.push('RN 壳混入了 web 专属 animate-in(无 CSS 动画通道)')
    if (/hover:/.test(code)) out.push('RN 壳混入了 web 专属 hover:(无 CSS :hover 通道)')
  }
  return out
}

/** ⑤ 导出面:两端壳 + 两端桶都要把 Tooltip 四件套递出去。 */
function exportProblems(src: string, side: string, parts: string[]): string[] {
  const code = stripComments(src)
  const out: string[] = []
  for (const part of parts) {
    if (!new RegExp(`\\b${part}\\b`).test(code)) out.push(`${side} 缺 ${part}`)
  }
  return out
}

const WEB_EXPORT_PARTS = ['Tooltip', 'TooltipTrigger', 'TooltipContent', 'TooltipProvider']
const RN_EXPORT_PARTS = ['Tooltip', 'TooltipProps']

/**
 * ⑥(b) 单端项必须在案且**不许伪装成跨端常量**:spec 头注要逐条登记本票没收的三项,
 * 同时 spec 不得导出它们(导出了 ⇒ 两端壳都得消费,而 web 端没有对应槽位)。
 * 注意这里读的是**带注释**的原文:登记就写在头注里,剥了注释这条判据会永远假绿。
 */
function singleSideRegistrationProblems(src: string, exports = SPEC_EXPORTS): string[] {
  const out: string[] = []
  if (!/MAX_WIDTH\s*=\s*240/.test(src))
    out.push('tooltip-spec 未登记单端项 MAX_WIDTH = 240(RN 独有)')
  if (!/delayLongPress\s*=\s*300/.test(src)) {
    out.push('tooltip-spec 未登记单端项 delayLongPress = 300(触发机制,规则6 不下沉)')
  }
  if (!/ANIM_DURATION\s*=\s*150/.test(src)) {
    out.push('tooltip-spec 未登记单端项 ANIM_DURATION = 150(进出场机制,规则6 不下沉)')
  }
  if (!/规则6/.test(src)) out.push('tooltip-spec 未登记"机制差按规则6 允许不同形"的裁定依据')
  for (const banned of ['MAX_WIDTH', 'DELAY_LONG_PRESS', 'ANIM_DURATION']) {
    if (exports.includes(banned)) {
      out.push(`tooltip-spec 导出了单端项 ${banned}(单端项不得伪装成跨端常量)`)
    }
  }
  return out
}

describe('① tooltip-spec 的平台纯度', () => {
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

  it('裁定取值:核心档 GAP = 4(规则2 取 compact 较小档,web 4 vs RN 8)', () => {
    expect(tooltipSpec.TOOLTIP_GAP_PX).toBe(4)
  })

  it('裁定取值:已同值的五档(规则1 回归锁)md / 12 / 6 / xs / md', () => {
    expect(tooltipSpec.TOOLTIP_RADIUS_TIER).toBe('md')
    expect(tooltipSpec.TOOLTIP_PADDING_X_PX).toBe(12)
    expect(tooltipSpec.TOOLTIP_PADDING_Y_PX).toBe(6)
    expect(tooltipSpec.TOOLTIP_TEXT_TIER).toBe('xs')
    expect(tooltipSpec.TOOLTIP_SHADOW_TIER).toBe('md')
  })

  it('本锁有牙:漏掉 TOOLTIP_GAP_PX ⇒ 导出面判据必须红', () => {
    const missing = REQUIRED_EXPORTS.filter((n) => n !== 'TOOLTIP_GAP_PX')
    expect(missing).not.toContain('TOOLTIP_GAP_PX')
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

  it('本锁有牙:web 壳把核心档改回字面量(sideOffset 写死 4)⇒ 判据必须红', () => {
    const dirty = WEB_SRC.replace('sideOffset = TOOLTIP_GAP_PX', 'sideOffset = 4')
    expect(dirty).not.toBe(WEB_SRC)
    expect(specWiringProblems(dirty, 'web').length).toBeGreaterThan(0)
  })

  it('本锁有牙:web 壳把纵向内边距档改回字面量(import 还在,消费断开)⇒ 判据必须红', () => {
    const dirty = WEB_SRC.replace('PADDING_Y_CLASS[TOOLTIP_PADDING_Y_PX]', "'py-1.5'")
    expect(dirty).not.toBe(WEB_SRC)
    expect(specWiringProblems(dirty, 'web').length).toBeGreaterThan(0)
  })

  it('本锁有牙:web 壳把圆角档改回字面量(连同类型标注一起断开)⇒ 判据必须红', () => {
    const dirty = WEB_SRC.replace('RADIUS_CLASS[TOOLTIP_RADIUS_TIER]', "'rounded-md'").replace(
      'Record<typeof TOOLTIP_RADIUS_TIER, string>',
      'Record<string, string>',
    )
    expect(dirty).not.toBe(WEB_SRC)
    expect(specWiringProblems(dirty, 'web').length).toBeGreaterThan(0)
  })

  it('本锁有牙:RN 壳把核心档改回写死的 8(重新分叉)⇒ 判据必须红', () => {
    const dirty = RN_SRC.replace(/TOOLTIP_GAP_PX/g, '8')
    expect(dirty).not.toBe(RN_SRC)
    expect(specWiringProblems(dirty, 'RN').length).toBeGreaterThan(0)
  })

  it('本锁有牙:RN 壳把投影档改回字面量(连同类型标注一起断开)⇒ 判据必须红', () => {
    const dirty = RN_SRC.replace('SHADOW_CLASS[TOOLTIP_SHADOW_TIER]', "'shadow-md'").replace(
      'Record<typeof TOOLTIP_SHADOW_TIER, string>',
      'Record<string, string>',
    )
    expect(dirty).not.toBe(RN_SRC)
    expect(specWiringProblems(dirty, 'RN').length).toBeGreaterThan(0)
  })

  it('本锁有牙:RN 壳漏引一个常量 ⇒ 判据必须红', () => {
    const dirty = RN_SRC.replace('  TOOLTIP_TEXT_TIER,\n', '')
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
  it('现态:web 保留 z-popover / Arrow / animate-in / overflow-hidden', () => {
    expect(platformOnlyProblems(WEB_SRC, 'web')).toEqual([])
  })

  it('现态:RN 保留 Modal / 长按 / border-border / MAX_WIDTH,且不混入 web 通道', () => {
    expect(platformOnlyProblems(RN_SRC, 'RN')).toEqual([])
  })

  it('本锁有牙:web 壳删掉 Arrow ⇒ 平台专属判据必须红', () => {
    const dirty = WEB_SRC.replace('<TooltipPrimitive.Arrow className="fill-popover" />', '')
    expect(dirty).not.toBe(WEB_SRC)
    expect(platformOnlyProblems(dirty, 'web').length).toBeGreaterThan(0)
  })

  it('本锁有牙:RN 壳删掉长按触发 ⇒ 平台专属判据必须红', () => {
    const dirty = RN_SRC.replace('onLongPress={show} delayLongPress={300}', 'onPress={show}')
    expect(dirty).not.toBe(RN_SRC)
    expect(platformOnlyProblems(dirty, 'RN').length).toBeGreaterThan(0)
  })

  it('本锁有牙:RN 壳混入 web 的 z-popover ⇒ 平台专属判据必须红', () => {
    const dirty = RN_SRC.replace(
      "'border border-border bg-popover',",
      "'z-popover border border-border bg-popover',",
    )
    expect(dirty).not.toBe(RN_SRC)
    expect(platformOnlyProblems(dirty, 'RN').length).toBeGreaterThan(0)
  })
})

describe('⑤ 导出面不回退', () => {
  it('现态:Tooltip 四件套在两端壳与两端桶都在位', () => {
    expect(exportProblems(WEB_SRC, 'web', WEB_EXPORT_PARTS)).toEqual([])
    expect(exportProblems(RN_SRC, 'RN', RN_EXPORT_PARTS)).toEqual([])
    expect(exportProblems(WEB_BARREL, 'web 桶', WEB_EXPORT_PARTS)).toEqual([])
    expect(exportProblems(RN_BARREL, 'RN 桶', RN_EXPORT_PARTS)).toEqual([])
  })

  it('本锁有牙:RN 桶删掉 Tooltip ⇒ 导出面判据必须红', () => {
    const dirty = RN_BARREL.replace("export { Tooltip, type TooltipProps } from './tooltip'", '')
    expect(dirty).not.toBe(RN_BARREL)
    expect(exportProblems(dirty, 'RN 桶', RN_EXPORT_PARTS).length).toBeGreaterThan(0)
  })
})

describe('⑥ 核心档裁定 + 单端档留痕', () => {
  it('现态:MAX_WIDTH / delayLongPress / ANIM_DURATION 已逐条登记,且未伪装成跨端常量', () => {
    expect(singleSideRegistrationProblems(SPEC_SRC)).toEqual([])
  })

  it('本锁有牙:删掉单端项登记(拿"已下沉"盖住没收的项)⇒ 判据必须红', () => {
    const dirty = SPEC_SRC.replace(/MAX_WIDTH\s*=\s*240/g, 'MAX_WIDTH = 0')
    expect(dirty).not.toBe(SPEC_SRC)
    expect(singleSideRegistrationProblems(dirty).length).toBeGreaterThan(0)
  })

  it('本锁有牙:把单端项导出成跨端常量 ⇒ 判据必须红', () => {
    const leaked = [...SPEC_EXPORTS, 'MAX_WIDTH']
    expect(leaked).toContain('MAX_WIDTH')
    expect(singleSideRegistrationProblems(SPEC_SRC, leaked).length).toBeGreaterThan(0)
    // 反面:现态的导出面喂回同一把尺子必须绿(否则这条判据是空跑)
    expect(singleSideRegistrationProblems(SPEC_SRC, SPEC_EXPORTS)).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
