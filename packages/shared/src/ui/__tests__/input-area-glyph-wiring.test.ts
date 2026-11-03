// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * InputArea「控件字形档」跨端单源接线契约(O81 票④,InputArea 族)。
 *
 * 钉三组不变量,各自挡一种**不会让 typecheck 红**的失效:
 *  ① 档值必须走 `@ihui/design-tokens` 的几何表,不得在 spec 里手抄第二份数字
 *     (手抄那一枚就是"改一端另一端不跟随"的成因;数值一律从 geometry.js 现读,
 *      本文件不复制第二份字面判据);
 *  ② 一档不得重新长出多个名字:小程序 ai-home 侧曾有两枚别名
 *     (`INPUT_AREA_AI_HOME_ICON_BOX_PX` / `INPUT_AREA_AI_HOME_ADD_GLYPH_PX`),
 *     它们的值早已被改指 controlGlyph,别名与注释却留在原地(注释还在写 25/22 并声称"与 RN 不成对")
 *     ⇒ 三个名字、一份真相,账面与实态互相打脸。本条锁"别名已从导出面摘掉";
 *  ③ 两条腿必须**都真的引用**这一枚常数:只有一端引用 = 守门 128 的 SL 维会把它报成
 *     "仅一侧具名档"(另一条腿还没接线)。正向对照(两端各 ≥1 处取数)与反向锁
 *     (两端源码里不得再出现旧别名)成对写,缺任何一半都是一条空转的尺子。
 *
 * 判据一律是**源码级** readFileSync + 剥注释:两端组件文件不在本包的被检程序里,
 * import 它们会把 RN / Taro 的编译约束带进 shared 的 tsc(同 back-chevron-wiring 那条口径)。
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import * as inputAreaSpec from '../input-area-spec'
import { INPUT_AREA_CONTROL_GLYPH_PX } from '../input-area-spec'

/**
 * 仓库根按 `pnpm-workspace.yaml` 往上找,不写死相对层数(定长 `../../..` 一旦文件搬家就
 * 静默指向别处,把"耦合已断"报成"文件读不到")。找不到就抛 —— 取材前提没了不许退化成跳过。
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

/** 两端各自的 InputArea 腿(守门 128 在册配对的两条腿文件)。 */
const LEGS = [
  { name: 'miniapp-taro', file: 'apps/miniapp-taro/src/components/InputArea.tsx' },
  { name: 'mobile-rn', file: 'apps/mobile-rn/src/components/InputArea.tsx' },
] as const

/** 已被并入 controlGlyph 的两枚旧别名:出现在任何一侧源码或导出面都算回潮。 */
const RETIRED_ALIASES = [
  'INPUT_AREA_AI_HOME_ICON_BOX_PX',
  'INPUT_AREA_AI_HOME_ADD_GLYPH_PX',
] as const

/** 剥注释:历史数字写在注释里不得被算成实现(与守门 128 的 stripComments 同口径的简易版)。 */
const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

/**
 * 几何档现读:从 geometry.js 取 `controlGlyph` 的当前值,不在本文件抄第二份字面值。
 * 读不到就抛 —— 那说明这一枚档已改名或表已搬走,本测试的耦合前提失效,必须响亮失败。
 */
function geometryStep(step: string): number {
  const src = readFileSync(join(ROOT, 'packages/design-tokens/src/geometry.js'), 'utf8')
  const hit = src.match(new RegExp(`\\b${step}\\s*:\\s*(\\d+(?:\\.\\d+)?)`))
  if (!hit) throw new Error(`geometry.js 读不到 ${step} ⇒ 本测试的耦合前提已失效`)
  return Number(hit[1])
}

describe('InputArea 控件字形档跨端单源(O81 票④)', () => {
  it('① 档值走 geometry.controlGlyph,spec 里没有手抄的第二份数字', () => {
    expect(INPUT_AREA_CONTROL_GLYPH_PX).toBe(geometryStep('controlGlyph'))
    const specSrc = stripComments(
      readFileSync(join(ROOT, 'packages/shared/src/ui/input-area-spec.ts'), 'utf8'),
    )
    const literal = /\bINPUT_AREA_CONTROL_GLYPH_PX\s*=\s*\d/.test(specSrc)
    expect(literal, 'spec 里这一枚又写成裸数字 ⇒ 与几何表分叉,单一源已断').toBe(false)
  })

  it('② 两枚旧别名已从导出面摘掉,一档不再挂三个名字', () => {
    for (const alias of RETIRED_ALIASES) {
      expect(
        Object.prototype.hasOwnProperty.call(inputAreaSpec, alias),
        `${alias} 又回到导出面 ⇒ 与 INPUT_AREA_CONTROL_GLYPH_PX 同值重名,回潮`,
      ).toBe(false)
    }
  })

  it('③ 两条腿都真引用这一枚常数(正向对照),且源码里不再出现旧别名(反向锁)', () => {
    for (const leg of LEGS) {
      const src = stripComments(readFileSync(join(ROOT, leg.file), 'utf8'))
      const refs = (src.match(/\bINPUT_AREA_CONTROL_GLYPH_PX\b/g) ?? []).length
      expect(
        refs,
        `${leg.file} 不再引用控件字形档 ⇒ 该腿脱线,守门 128 的 SL 维会报"仅一侧"`,
      ).toBeGreaterThan(0)
      for (const alias of RETIRED_ALIASES) {
        expect(
          new RegExp(`\\b${alias}\\b`).test(src),
          `${leg.file} 又出现旧别名 ${alias} ⇒ 一档三名回潮`,
        ).toBe(false)
      }
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
