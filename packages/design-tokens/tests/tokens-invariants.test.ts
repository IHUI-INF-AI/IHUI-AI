// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 本包自有逻辑的不变量测试面。**刻意只打在其他判据看不见的那一格**:
// 档位表四处对账(源 ↔ preset ↔ tokens.css ↔ 各端副本)由守门 77/93 负责,本文件不重复;
// 这里锁的是**同一张表内部的派生算术**(px → rem → rpx → CSS 变量名)与两个纯函数
// (`cn()`、`extractCssVars()`)—— 派生写错时按路径读 src 的守门仍然全绿,
// 因为它们比的是"值相不相等",而派生恒等式没有任何一道门在算。
//
// 特别地:`scripts/check-cross-end-tokens.mjs`(守门 93)直接 import `extractCssVars` /
// `validateTokenConsistency` 作它自己的取值内核 —— 一门依赖的纯函数若在本包内零测试,
// 那个依赖就是"没有尺子的尺子"。下面这两条是 93 的地基。

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { cn } from '../src/cn.js'
import { GEOMETRY_PX, rnGeometry, TARO_RPX_PER_PX, taroGeometry } from '../src/geometry.js'
import {
  pxToStep,
  RADIUS_CSS_PX,
  RADIUS_CSS_VAR,
  RADIUS_REM,
  RADIUS_SCALE_PX,
  rpxToStep,
  RADIUS_STEPS,
  rnRadius,
} from '../src/radius.js'
import {
  extractCssVars,
  listMissingTokens,
  validateTokenConsistency,
} from '../src/token-registry.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const TOKENS_CSS = readFileSync(join(HERE, '..', 'src', 'styles', 'tokens.css'), 'utf8')

describe('圆角档位表:档位取值 + 表内派生算术', () => {
  // 档位取值是设计决定,改动必须是有意的(同时改这一行),不能是"顺手调一个数字"。
  it('档位取值 = xs2/sm4/md6/lg8/xl12/2xl16,默认档 8', () => {
    expect(RADIUS_STEPS).toEqual({
      xs: 2,
      sm: 4,
      DEFAULT: 8,
      md: 6,
      lg: 8,
      xl: 12,
      '2xl': 16,
    })
  })

  it('派生表的键集与档位表逐一相同(漏一档 = 那一档在某一端没有出口)', () => {
    const steps = Object.keys(RADIUS_STEPS).sort()
    expect(Object.keys(RADIUS_REM).sort()).toEqual(steps)
    expect(Object.keys(RADIUS_CSS_PX).sort()).toEqual(steps)
    expect(Object.keys(RADIUS_CSS_VAR).sort()).toEqual(steps)
  })

  it('RADIUS_REM 逐档 === px/16(1rem = 16px 这条换算只能有一处算)', () => {
    for (const [step, px] of Object.entries(RADIUS_STEPS)) {
      expect(RADIUS_REM[step]).toBe(`${px / 16}rem`)
    }
  })

  it('RADIUS_CSS_PX 逐档 === "<px>px",RADIUS_CSS_VAR 的 DEFAULT 独占裸 --radius', () => {
    for (const [step, px] of Object.entries(RADIUS_STEPS)) {
      expect(RADIUS_CSS_PX[step]).toBe(`${px}px`)
    }
    expect(RADIUS_CSS_VAR.DEFAULT).toBe('--radius')
    expect(RADIUS_CSS_VAR.lg).toBe('--radius-lg')
    // 裸 --radius 只有默认档能占:否则 CSS 端与 RN 端对"rounded 不带后缀"取到不同值。
    expect(Object.values(RADIUS_CSS_VAR).filter((v) => v === '--radius')).toEqual(['--radius'])
  })

  it('rnRadius 就是 RADIUS_STEPS 本身(同一引用,不是抄来的第二份)', () => {
    expect(rnRadius).toBe(RADIUS_STEPS)
  })

  it('RADIUS_SCALE_PX 是去重升序取值集合', () => {
    expect(RADIUS_SCALE_PX).toEqual([2, 4, 6, 8, 12, 16])
  })

  it('rpxToStep / pxToStep 命中时给档名,不命中给 null(不做就近吸附)', () => {
    expect(rpxToStep(24)).toBe('xl') // 24rpx = 12px
    expect(rpxToStep(16)).toBe('DEFAULT') // 16rpx = 8px,对象序里 DEFAULT 先于 lg
    expect(rpxToStep(3)).toBeNull() // 1.5px 不是任何档
    expect(pxToStep(12)).toBe('xl')
    expect(pxToStep('8')).toBe('DEFAULT') // 字符串入参同样归一
    expect(pxToStep(5)).toBeNull()
    expect(pxToStep(undefined)).toBeNull()
  })
})

describe('几何档投影:dp 与 rpx 必须由同一张表派生', () => {
  it('取值冻结:tapBox 36 / glyphMd 20', () => {
    expect(GEOMETRY_PX).toEqual({ tapBox: 36, glyphMd: 20 })
  })

  it('taroGeometry 逐档 === px × TARO_RPX_PER_PX,键集与源表相同', () => {
    expect(TARO_RPX_PER_PX).toBe(2)
    expect(Object.keys(taroGeometry).sort()).toEqual(Object.keys(GEOMETRY_PX).sort())
    for (const [step, px] of Object.entries(GEOMETRY_PX)) {
      expect(taroGeometry[step]).toBe(px * TARO_RPX_PER_PX)
    }
  })

  it('rnGeometry 就是 GEOMETRY_PX 本身(2 倍换算只允许发生在 taro 那一侧)', () => {
    expect(rnGeometry).toBe(GEOMETRY_PX)
    expect(rnGeometry.tapBox).not.toBe(taroGeometry.tapBox)
  })
})

describe('cn():类名合并入口', () => {
  it('冲突工具类后者胜出(twMerge 语义,不是简单拼接)', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
    expect(cn('text-sm', 'text-lg')).toBe('text-lg')
  })

  it('falsy 入参被丢掉,条件对象按真值取键(clsx 语义)', () => {
    expect(cn('a', false, undefined, null, '', 'b')).toBe('a b')
    expect(cn('base', { on: true, off: false })).toBe('base on')
  })

  it('数组与嵌套数组摊平', () => {
    expect(cn(['x', ['y', 'z']])).toBe('x y z')
  })

  it('非冲突类名保持两者(不得把不同属性合并掉)', () => {
    expect(cn('flex', 'items-center')).toBe('flex items-center')
  })
})

describe('token-registry:守门 93 的取值内核', () => {
  it('extractCssVars 剥块注释 —— 注释里的伪变量不得被当成声明', () => {
    const css = ['/* --color-fake: #000; */', ':root {', '  --color-real: #111 ;', '}'].join('\n')
    const vars = extractCssVars(css)
    expect(vars.has('--color-fake')).toBe(false)
    expect(vars.get('--color-real')).toBe('#111') // 值两侧空白被 trim
  })

  it('validateTokenConsistency 三态:一致 / 副本缺档 / 副本值漂', () => {
    const src = ':root { --color-a: 1; --color-b: 2; }'
    expect(validateTokenConsistency(src, ':root { --color-a: 1; --color-b: 2; }').consistent).toBe(
      true,
    )

    const missing = validateTokenConsistency(src, ':root { --color-z: 9; }')
    expect(missing.consistent).toBe(false)
    expect(missing.missingInCss).toEqual(['--color-z'])

    const drift = validateTokenConsistency(src, ':root { --color-a: 999; }')
    expect(drift.consistent).toBe(false)
    expect(drift.valueMismatches).toEqual([{ name: '--color-a', cssValue: '1', rnValue: '999' }])
  })

  it('登记表点名的每个 token 在真相源 tokens.css 里都有声明(登记先于落盘 = 悬空引用)', () => {
    expect(listMissingTokens(TOKENS_CSS)).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
