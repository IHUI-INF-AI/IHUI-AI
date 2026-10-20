// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  TAB_BAR_FONT_SIZE_ACTIVE_PX,
  TAB_BAR_FONT_SIZE_PX,
  TAB_BAR_GAP_BOTTOM_MINIAPP_PX,
  TAB_BAR_GAP_BOTTOM_MIN_PX,
  TAB_BAR_GAP_TOP_PX,
  TAB_BAR_GLOW_RADIUS_PX,
  TAB_BAR_HEIGHT_PX,
  TAB_BAR_ICON_SIZE_PX,
  TAB_BAR_INDICATOR_H_PX,
  TAB_BAR_INDICATOR_INSET_PX,
  TAB_BAR_MARGIN_H_PX,
} from '../tab-bar-spec'
import {
  INPUT_AREA_CONTAINER_PADDING_X_PX,
  INPUT_AREA_SHELL_HEIGHT_PX,
} from '../input-area-spec'

/**
 * 本表存在的理由(与 tab-bar-spec 头注同一条因果,写在这里是为了让它坏的时候有人知道):
 * 跨端对账门 128 的取档实现只认 `const X = <数字>` 这种字面量形状,不跟 import 走。
 * 把两端几何收成一份源之后,门对这一族**读不到数字** —— 这是"分叉在结构上已被消灭"的代价,
 * 不是判据缺口;但代价只有在"两端真的都走转发"时才成立。有人把任一端改回字面量,
 * 这一族就同时失去单一源与门的判据(门只会看见有字面量的那一腿)。所以这条断言必须有牙。
 */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..')

/** 两端各自声明这些量的文件(转发点) */
const CONSUMERS = [
  {
    name: 'mobile-rn TabBar.styles.ts',
    file: 'apps/mobile-rn/src/components/TabBar.styles.ts',
    names: [
      'TAB_BAR_HEIGHT',
      'TAB_BAR_ICON_SIZE',
      'TAB_BAR_FONT_SIZE',
      'TAB_BAR_FONT_SIZE_ACTIVE',
      'TAB_BAR_FLOAT_MARGIN_H',
      'TAB_BAR_FLOAT_GAP_TOP',
      'TAB_BAR_FLOAT_GAP_BOTTOM_MIN',
      'TAB_BAR_GLOW_RADIUS_PX',
    ],
  },
  {
    name: 'miniapp-taro tab-bar-metrics.ts',
    file: 'apps/miniapp-taro/src/constants/tab-bar-metrics.ts',
    names: [
      'TAB_BAR_HEIGHT',
      'TAB_BAR_ICON_SIZE',
      'TAB_BAR_FONT_SIZE',
      'TAB_BAR_FONT_SIZE_ACTIVE',
      'TAB_BAR_MARGIN_H',
      'TAB_BAR_GAP_BOTTOM',
      'TAB_BAR_INDICATOR_H',
      'TAB_BAR_GLOW_RADIUS_PX',
    ],
  },
] as const

/** 剥注释:注释里出现的 `= 12` 之类历史数字不得被算成实现(守门同口径) */
const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

describe('底部胶囊几何单一源', () => {
  it('高与左右留边确实取自输入框那两枚档(不是另拍数字)', () => {
    expect(TAB_BAR_HEIGHT_PX).toBe(INPUT_AREA_SHELL_HEIGHT_PX)
    expect(TAB_BAR_MARGIN_H_PX).toBe(INPUT_AREA_CONTAINER_PADDING_X_PX)
  })

  it('表内每一枚都是可枚举的有限数(读不到值即红,不记绿)', () => {
    const table = {
      TAB_BAR_HEIGHT_PX,
      TAB_BAR_MARGIN_H_PX,
      TAB_BAR_ICON_SIZE_PX,
      TAB_BAR_FONT_SIZE_PX,
      TAB_BAR_FONT_SIZE_ACTIVE_PX,
      TAB_BAR_INDICATOR_H_PX,
      TAB_BAR_INDICATOR_INSET_PX,
      TAB_BAR_GAP_TOP_PX,
      TAB_BAR_GAP_BOTTOM_MIN_PX,
      TAB_BAR_GAP_BOTTOM_MINIAPP_PX,
      TAB_BAR_GLOW_RADIUS_PX,
    }
    const keys = Object.keys(table)
    expect(keys.length).toBeGreaterThan(0)
    for (const k of keys) expect(Number.isFinite(table[k as keyof typeof table])).toBe(true)
  })

  it('两端同名量一律转发本表,不得回写成字面量(回写即同时失去单一源与门 128 的判据)', () => {
    for (const c of CONSUMERS) {
      const src = stripComments(readFileSync(join(ROOT, c.file), 'utf8'))
      // 阳性对照:转发形状必须真在盘上读得到,否则下面的反向断言是空转
      const forwards = c.names.filter((n) =>
        new RegExp(`\\b(?:export\\s+)?const\\s+${n}\\s*=\\s*[A-Za-z_$][\\w$]*`).test(src),
      )
      expect(forwards.length).toBe(c.names.length)
      for (const n of c.names) {
        const literal = new RegExp(`\\b(?:export\\s+)?const\\s+${n}\\s*=\\s*\\d`).test(src)
        expect(literal, `${c.file} 里的 ${n} 被写成了字面量 ⇒ 应转发 @ihui/shared/ui/tab-bar-spec`).toBe(
          false,
        )
      }
    }
  })

  it('指示条几何在 RN 侧也走档(端内不留裸数字)', () => {
    const src = stripComments(
      readFileSync(join(ROOT, 'apps/mobile-rn/src/components/TabBar.styles.ts'), 'utf8'),
    )
    const body = src.slice(src.indexOf('activeIndicator:'))
    expect(/^[\s\S]{0,240}height:\s*TAB_BAR_INDICATOR_H_PX/.test(body), '指示条高未取档').toBe(true)
    expect(/^[\s\S]{0,240}left:\s*TAB_BAR_INDICATOR_INSET_PX/.test(body), '指示条缩进未取档').toBe(
      true,
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
