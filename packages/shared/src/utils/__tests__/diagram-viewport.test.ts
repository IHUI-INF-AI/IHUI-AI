// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment node
/**
 * G-854 矢量图预览视口数学的成对正反例。
 *
 * 判据面刻意不含 DOM:被测量(`diagram-viewport.ts`)本来就要求无 window,
 * 所以这里的每一条断言都只喂数字 —— 端上真机复核另计(见交付报告「未验证」)。
 *
 * 特别的一条:C1 用**旧实现原件**做同义证明。`clampZoom` 是从 `MermaidDiagram.tsx`
 * 里搬出来的,搬动只证明"新实现自洽"不证明"它与被搬走的那一份同义"(§22 那条
 * "行为是否未变,不得用被改动的脚本自证"),所以这里逐字重写一份改造前的表达式来比。
 */
import { describe, it, expect } from 'vitest'
import {
  MAX_ZOOM,
  MIN_ZOOM,
  ZOOM_STEP,
  clampZoom,
  fitZoom,
  panScroll,
  pinchZoom,
  scrollToKeepPoint,
  zoomFromKey,
} from '../diagram-viewport'

/** 改造前 `MermaidDiagram.tsx:32` 的私有实现,逐字重抄一份当对照(不是被测对象)。 */
function legacyClamp(value: number): number {
  const LEGACY_MIN = 0.4
  const LEGACY_MAX = 4
  return Math.min(LEGACY_MAX, Math.max(LEGACY_MIN, Math.round(value * 100) / 100))
}

describe('diagram-viewport · clampZoom / 常量', () => {
  it('C1 与改造前的私有实现逐值同义(含 NaN 的去向)', () => {
    const sweep = [0, 0.1, 0.39, 0.4, 1, 1.2, 1.43999, 1.728, 2, 3.99, 4, 5, 99, -3, Number.NaN]
    for (const v of sweep) {
      const mine = clampZoom(v)
      const legacy = legacyClamp(v)
      // NaN 两侧都必须是 NaN,否则 `mine === legacy` 会因 NaN !== NaN 直接判红
      if (Number.isNaN(v)) {
        expect(Number.isNaN(mine), `NaN 透传:${v}`).toBe(true)
        expect(Number.isNaN(legacy)).toBe(true)
        continue
      }
      expect(mine, `同义:${v}`).toBe(legacy)
    }
  })

  it('C2 边界与两位小数收敛(1.2 连乘不留浮点尾巴)', () => {
    expect(clampZoom(1 * ZOOM_STEP)).toBe(1.2)
    expect(clampZoom(1.2 * ZOOM_STEP)).toBe(1.44)
    expect(clampZoom(1.44 * ZOOM_STEP)).toBe(1.73)
    expect(clampZoom(0)).toBe(MIN_ZOOM)
    expect(clampZoom(999)).toBe(MAX_ZOOM)
  })

  it('C3 常量就是票面那三个数(不得被顺手改成"更好看"的档)', () => {
    expect(MIN_ZOOM).toBe(0.4)
    expect(MAX_ZOOM).toBe(4)
    expect(ZOOM_STEP).toBe(1.2)
  })
})

describe('diagram-viewport · fitZoom', () => {
  const base = { viewportW: 800, viewportH: 600, naturalW: 1000, naturalH: 800 }

  it('F1 量到了:取"完整可见的最大不放大倍率"(短边那一轴说了算)', () => {
    // min(1, 800/1000 = 0.8, 600/800 = 0.75) ⇒ 0.75
    expect(fitZoom(base)).toBe(0.75)
    // 内容小于视口 ⇒ Math.min(1, …) 封顶在 1,不得放大
    expect(fitZoom({ ...base, naturalW: 400, naturalH: 300 })).toBe(1)
  })

  it('F2 只按短边那一轴收敛(横窄竖宽 ⇒ 由高度定档)', () => {
    expect(fitZoom({ viewportW: 2000, viewportH: 400, naturalW: 1000, naturalH: 800 })).toBe(0.5)
  })

  it('F3 测不到一律回落 1,不猜尺寸(0 / 负数 / NaN 各一档,四个入参逐一喂)', () => {
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(fitZoom({ ...base, naturalW: bad })).toBe(1)
      expect(fitZoom({ ...base, naturalH: bad })).toBe(1)
      expect(fitZoom({ ...base, viewportW: bad })).toBe(1)
      expect(fitZoom({ ...base, viewportH: bad })).toBe(1)
    }
  })

  it('F4 极小内容不被洗成"看不见":fit 触底仍是 MIN_ZOOM 而不是 0', () => {
    expect(fitZoom({ viewportW: 1, viewportH: 1, naturalW: 100000, naturalH: 100000 })).toBe(MIN_ZOOM)
  })
})

describe('diagram-viewport · scrollToKeepPoint(定点缩放)', () => {
  const geo = { naturalW: 1000, naturalH: 800, viewportW: 400, viewportH: 300 }

  it('K1 光标下的内容点不动:scrollTo = scrollFrom + (zoomTo − zoomFrom) × point', () => {
    const r = scrollToKeepPoint({
      ...geo,
      zoomFrom: 1,
      zoomTo: 2,
      point: { x: 100, y: 50 },
      scroll: { scrollTop: 0, scrollLeft: 0 },
    })
    expect(r.scrollLeft).toBe(100)
    expect(r.scrollTop).toBe(50)
    // 反方向(缩小)把同一段位移还回去:100 + (1 − 2) × 100 = 0
    const back = scrollToKeepPoint({
      ...geo,
      zoomFrom: 2,
      zoomTo: 1,
      point: { x: 100, y: 50 },
      scroll: { scrollTop: 50, scrollLeft: 100 },
    })
    expect(back).toEqual({ scrollTop: 0, scrollLeft: 0 })
  })

  it('K2 钳在合法滚动范围内:上限 = 缩放后占位 − 视口,越界被截而不报错', () => {
    // 从 4 倍的最右下角回到 1 倍、锚点取左上 ⇒ 请求位仍是 3600/2900,而 1 倍的上限只有 600/500
    const r = scrollToKeepPoint({
      ...geo,
      zoomFrom: 4,
      zoomTo: 1,
      point: { x: 0, y: 0 },
      scroll: { scrollTop: 2900, scrollLeft: 3600 },
    })
    expect(r).toEqual({ scrollTop: 800 - 300, scrollLeft: 1000 - 400 })
    // 缩到 0.4 倍:横轴已不溢出(0.4×1000 = 400 = 视口宽)⇒ 上限 0;纵轴仍溢出 20(0.4×800 − 300)
    // ⇒ 两轴各按各的上限钳,请求位 380 被截到 20,而不是留一个"看不见内容"的滚动位
    const small = scrollToKeepPoint({
      ...geo,
      zoomFrom: 4,
      zoomTo: 0.4,
      point: { x: 900, y: 700 },
      scroll: { scrollTop: 2900, scrollLeft: 3600 },
    })
    expect(small).toEqual({ scrollTop: 0.4 * 800 - 300, scrollLeft: 0 })
  })

  it('K3 测不到尺寸 ⇒ 保持原位(既不跳到 0,也不放行一次无法验证的越界)', () => {
    const untouched = scrollToKeepPoint({
      naturalW: 0,
      naturalH: 0,
      viewportW: 0,
      viewportH: 0,
      zoomFrom: 1,
      zoomTo: 2,
      point: { x: 100, y: 100 },
      scroll: { scrollTop: 37, scrollLeft: 41 },
    })
    expect(untouched).toEqual({ scrollTop: 37, scrollLeft: 41 })
  })

  it('K4 倍率本身不可计时同样不动,不产 NaN 滚动位', () => {
    const r = scrollToKeepPoint({
      ...geo,
      zoomFrom: Number.NaN,
      zoomTo: 2,
      point: { x: 10, y: 10 },
      scroll: { scrollTop: 5, scrollLeft: 6 },
    })
    expect(r).toEqual({ scrollTop: 5, scrollLeft: 6 })
    expect(Number.isFinite(r.scrollTop) && Number.isFinite(r.scrollLeft)).toBe(true)
  })

  it('K5 浮点尾巴不外泄到滚动位:1 → 1.2 时 (1.2 − 1) 是 0.19999999999999996,读数仍要是 40 而不是 39.99999999999999', () => {
    // 这一条不是洁癖:滚动位是要写进 DOM 的,尾巴会让"同一次手势"的读数在断言与合成层里抖
    expect(1.2 - 1).not.toBe(0.2)
    const r = scrollToKeepPoint({
      ...geo,
      zoomFrom: 1,
      zoomTo: 1.2,
      point: { x: 200, y: 150 },
      scroll: { scrollTop: 0, scrollLeft: 0 },
    })
    expect(r.scrollLeft).toBe(40)
    expect(r.scrollTop).toBe(30)
  })
})

describe('diagram-viewport · panScroll(拖拽/键盘平移)', () => {
  const geo = { naturalW: 1000, naturalH: 800, viewportW: 400, viewportH: 300 }
  const at = (scrollTop: number, scrollLeft: number) => ({ scrollTop, scrollLeft })

  it('P1 范围内逐字跟手(钳制不是量化)', () => {
    expect(panScroll({ ...geo, zoom: 2, scroll: at(0, 0), delta: { dx: 120, dy: 80 } })).toEqual({
      scrollTop: 80,
      scrollLeft: 120,
    })
    // 反方向同理:dy 为负就是"往上看",滚动位随之减小(未越下界时不取整、不量化)
    expect(panScroll({ ...geo, zoom: 2, scroll: at(80, 120), delta: { dx: -20, dy: -30 } })).toEqual(
      { scrollTop: 50, scrollLeft: 100 },
    )
  })

  it('P2 两向越界各钳一次:下界 0、上界 = zoom×内容 − 视口', () => {
    const over = panScroll({ ...geo, zoom: 2, scroll: at(0, 0), delta: { dx: 99999, dy: 99999 } })
    expect(over).toEqual({ scrollTop: 800 * 2 - 300, scrollLeft: 1000 * 2 - 400 })
    const under = panScroll({ ...geo, zoom: 2, scroll: over, delta: { dx: -99999, dy: -99999 } })
    expect(under).toEqual({ scrollTop: 0, scrollLeft: 0 })
  })

  it('P3 未放大到溢出 ⇒ 该轴回 0(调用方不需要再判一次 zoom > 1)', () => {
    const flat = panScroll({ ...geo, zoom: 0.3, scroll: at(120, 240), delta: { dx: 50, dy: 50 } })
    expect(flat).toEqual({ scrollTop: 0, scrollLeft: 0 })
  })

  it('P4 测不到尺寸 ⇒ 保持原位,不产 NaN', () => {
    const r = panScroll({
      naturalW: Number.NaN,
      naturalH: 0,
      viewportW: 400,
      viewportH: 300,
      zoom: 2,
      scroll: at(11, 22),
      delta: { dx: 100, dy: 100 },
    })
    expect(r).toEqual({ scrollTop: 11, scrollLeft: 22 })
  })
})

describe('diagram-viewport · zoomFromKey(键表只此一份)', () => {
  it('Z1 认识的键各归其位', () => {
    expect(zoomFromKey('+')).toBe('in')
    expect(zoomFromKey('=')).toBe('in')
    expect(zoomFromKey('-')).toBe('out')
    expect(zoomFromKey('_')).toBe('out')
    expect(zoomFromKey('0')).toBe('reset')
    expect(zoomFromKey('f')).toBe('fit')
    expect(zoomFromKey('F')).toBe('fit')
    expect(zoomFromKey('ArrowLeft')).toBe('pan-left')
    expect(zoomFromKey('ArrowRight')).toBe('pan-right')
    expect(zoomFromKey('ArrowUp')).toBe('pan-up')
    expect(zoomFromKey('ArrowDown')).toBe('pan-down')
  })

  it('Z2 不认识的键 ⇒ null(调用方据此**不得** preventDefault)', () => {
    for (const k of ['a', 'Enter', ' ', 'Tab', 'PageDown', 'Delete', '', 'Escape']) {
      expect(zoomFromKey(k), `键 ${JSON.stringify(k)} 不该被接管`).toBeNull()
    }
  })

  it('Z3 Escape 刻意不在表里:关窗归承载层(Radix),预览器不抢', () => {
    expect(zoomFromKey('Escape', { ctrlKey: true })).toBeNull()
  })

  it('Z4 带 ctrl/meta 时只接倍率族,方向键与 f 还给浏览器/文本编辑', () => {
    expect(zoomFromKey('=', { ctrlKey: true })).toBe('in')
    expect(zoomFromKey('0', { metaKey: true })).toBe('reset')
    expect(zoomFromKey('ArrowLeft', { ctrlKey: true })).toBeNull()
    expect(zoomFromKey('f', { ctrlKey: true })).toBeNull()
  })

  it('Z5 opts 缺席与显式 false 同义(不得因未传就整表失效)', () => {
    expect(zoomFromKey('+', {})).toBe('in')
    expect(zoomFromKey('+', { ctrlKey: false })).toBe('in')
    expect(zoomFromKey('+')).toBe(zoomFromKey('+', undefined))
  })
})

describe('diagram-viewport · pinchZoom(双指捏合)', () => {
  it('N1 距离比即倍率比,并收敛到合法域', () => {
    expect(pinchZoom({ prevDistance: 100, nextDistance: 150, baseZoom: 1 })).toBe(1.5)
    expect(pinchZoom({ prevDistance: 150, nextDistance: 100, baseZoom: 1.5 })).toBe(1)
    expect(pinchZoom({ prevDistance: 10, nextDistance: 9999, baseZoom: 1 })).toBe(MAX_ZOOM)
    expect(pinchZoom({ prevDistance: 9999, nextDistance: 1, baseZoom: 1 })).toBe(MIN_ZOOM)
  })

  it('N2 距离为 0 / NaN / 负 ⇒ 不动(不得除以 0 得到 Infinity 再被 clamp 洗成最大档)', () => {
    for (const bad of [0, -50, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(pinchZoom({ prevDistance: bad, nextDistance: 120, baseZoom: 1.8 })).toBe(1.8)
      expect(pinchZoom({ prevDistance: 120, nextDistance: bad, baseZoom: 1.8 })).toBe(1.8)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
