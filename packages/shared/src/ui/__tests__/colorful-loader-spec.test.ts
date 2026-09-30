// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * colorful-loader-spec 的**几何上界**对账 —— "半径不超过项目上限"这件事由构造保证,不由测量保证。
 *
 * 为什么值得单独写:小程序端彩点边长是 `toRpx(dotSize)` —— 一个由 `size` 属性驱动的表达式
 * (2026-09-30 用户定档「不允许任何胶囊型」后彩点已是方点,不再写 `borderRadius: '50%'`)。
 * 任何静态尺子对这一型只能报"量不到盒形"(它不该猜),而"量不到"在一条
 * 判红判据那里与"没超标"**同形**。所以这一族的边界必须由共享源的 clamp 与本测试闭合。
 *
 * 三条断言各挡一种失效:
 *  ① 上界与档位表最大档耦合(从 radius.js 现读,不在本文件抄第二份数字)—— 有人抬上限而忘了
 *     抬这里,或反过来,都会当场红;
 *  ② 全域扫描:size 从 0 到 4000 点径都不越界、且不低于可见下限 4 —— 挡"clamp 写漏/写反";
 *  ③ 现存档逐值不变(默认 40 仍是 4、160 仍是 16)—— 挡"为消红顺手改了观感":本改动只应影响
 *     那些本来就会违反上限的超大档。
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  COLORFUL_LOADER_DEFAULT_SIZE_PX,
  COLORFUL_LOADER_MAX_DOT_PX,
  colorfuleLoaderDotSizePx,
} from '../colorful-loader-spec'

/** 档位表最大档 —— 从源头文件现读解析,不 import(避免 dist 陈旧时测试跟着说谎),也不抄字面值。 */
function maxRadiusStepPx(): number {
  /**
   * 仓库根按 `pnpm-workspace.yaml` 往上找,不写死相对层数 —— 本文件搬家或 vitest 改变解析根时,
   * 定长 `../../..` 会静默指向别处(实测第一版就是这样:少爬一层,ENOENT 把"耦合已断"报成"文件读不到")。
   * 找不到就抛:那正是"这条测试的耦合前提没了",不许退化成跳过。
   */
  let dir = fileURLToPath(new URL('.', import.meta.url))
  let root: string | null = null
  for (let up = 0; up < 12; up++) {
    try {
      readFileSync(join(dir, 'pnpm-workspace.yaml'), 'utf8')
      root = dir
      break
    } catch {
      const parent = resolve(dir, '..')
      if (parent === dir) break
      dir = parent
    }
  }
  if (!root) throw new Error('找不到仓库根(pnpm-workspace.yaml)⇒ 档位表耦合无从对账')
  const src = readFileSync(join(root, 'packages/design-tokens/src/radius.js'), 'utf8')
  const block = src.match(/RADIUS_STEPS\s*=\s*\{([\s\S]*?)\}/)
  if (!block) throw new Error('radius.js 里找不到 RADIUS_STEPS ⇒ 本测试的耦合前提已失效')
  // `noUncheckedIndexedAccess` 下 `block[1]` 是 `string | undefined`(匹配组也算越界可能),
  // 而这里"没有第 1 组"在上一次 throw 之后按定义不可能发生 ⇒ 用解构显式承认这一点,
  // 不用 `!`(§3 类型零技术债:禁把断言当类型兜底)。
  const [, stepsBlock = ''] = block
  const steps = [...stepsBlock.matchAll(/['"]?(\w+)['"]?\s*:\s*(\d+(?:\.\d+)?)/g)].map((m) =>
    Number(m[2]),
  )
  if (steps.length === 0) throw new Error('RADIUS_STEPS 解析到 0 档 ⇒ 解析式已漂,不是"没有上限"')
  /**
   * 覆盖面自证:解析到的档数必须等于块内"冒号 + 数字"的出现次数。第一版没写这条,而它正好抓住了
   * 真缺陷 —— 表里 `'2xl': 16` 是**带引号**的键,不含引号的解析式把它整条漏掉,于是"最大档"读成 12。
   * 一份会漏读最大档的尺子,比没有尺子更危险:它让"上界 = 2 × 上限"这条断言自洽地通过。
   */
  const numericEntries = (stepsBlock.match(/:\s*\d+(?:\.\d+)?/g) || []).length
  if (steps.length !== numericEntries) {
    throw new Error(
      `RADIUS_STEPS 解析不全:读到 ${steps.length} 档,块内实有 ${numericEntries} 个数值档 ⇒ 修解析式,别改断言`,
    )
  }
  return Math.max(...steps)
}

describe('colorful-loader-spec 圆点几何上界', () => {
  it('上界 = 2 × 档位表最大档(等效半径正好等于项目半径上限)', () => {
    const cap = maxRadiusStepPx()
    expect(COLORFUL_LOADER_MAX_DOT_PX).toBe(cap * 2)
    // 等效半径 = 边长一半(全圆写法),所以它必须正好落在上限上而不是越过。
    expect(COLORFUL_LOADER_MAX_DOT_PX / 2).toBe(cap)
  })

  it('全域扫描:size 从 0 到 4000,点径既不越界也不掉到可见下限以下', () => {
    for (let size = 0; size <= 4000; size += 1) {
      const dot = colorfuleLoaderDotSizePx(size)
      expect(dot).toBeGreaterThanOrEqual(4)
      expect(dot).toBeLessThanOrEqual(COLORFUL_LOADER_MAX_DOT_PX)
      // 小数档(步长 0.5)也扫一遍:clamp 不得把非整数结果抖成 NaN
      expect(Number.isFinite(dot)).toBe(true)
    }
    for (let size = 0; size <= 800; size += 0.5) {
      const dot = colorfuleLoaderDotSizePx(size)
      expect(dot).toBeLessThanOrEqual(COLORFUL_LOADER_MAX_DOT_PX)
    }
  })

  it('现存档逐值不变(本改动只应收掉本来就会越界的超大档)', () => {
    // 默认档:40px 容器 ⇒ 点径 4px(公式下界),与加 clamp 之前逐字同值。
    expect(colorfuleLoaderDotSizePx(COLORFUL_LOADER_DEFAULT_SIZE_PX)).toBe(4)
    // 三腿实测常用档
    expect(colorfuleLoaderDotSizePx(64)).toBe(6.4)
    expect(colorfuleLoaderDotSizePx(160)).toBe(16)
    expect(colorfuleLoaderDotSizePx(240)).toBe(24)
    // 只有越过上限的档才改变 —— 24×? 这里 320 原本给 32(正好是上限),400 原本给 40 ⇒ 被收住
    expect(colorfuleLoaderDotSizePx(320)).toBe(COLORFUL_LOADER_MAX_DOT_PX)
    expect(colorfuleLoaderDotSizePx(400)).toBe(COLORFUL_LOADER_MAX_DOT_PX)
    expect(colorfuleLoaderDotSizePx(4000)).toBe(COLORFUL_LOADER_MAX_DOT_PX)
  })

  it('上界不得被读成"点径恒等于上界"(clamp 只在越界时生效)', () => {
    expect(colorfuleLoaderDotSizePx(40)).toBeLessThan(COLORFUL_LOADER_MAX_DOT_PX)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
