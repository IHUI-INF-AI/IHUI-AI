// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 流式生命周期像素守门(2026-10-29 立,档⑦⑧⑨的实浏览器面)
//
// 分工:vitest 件(markdown-stream-fence-promotion / mermaid-diagram)证明"逻辑对";
// 本 spec 证"眼睛看到的对"——真实 Chromium 逐帧量 DOM 几何与在场态,jsdom 拿不到的东西在这里拿:
//   ⑦ 晋升不回塌:每个 code-frame 的矩形高度全片只增不减(折叠复位会在某拍砍掉半屏高)
//   ⑨ mermaid 不闪位:真出图(工具条在场)之后,"渲染中"占位不得再现(实例级缓存够不到重挂的那一型)
//   ⑧ 逐块完成态:驱动仍在写字、双围栏均已写完的区间里,两块的"应用到文件"按钮都已就位
//      (旧粗判:先完成的块被冻结在"在写"外观,此区间计数到不了 2 —— 反向可判别)
// 判定时序:harness ?mode=lifecycle 在 mermaid 闭合后停幅 4s(PAUSE_MARK)→ 首帧出图落在停幅窗内,
// 由"紧随其后的段落"逼晋升;若出图晚于 B 块在场,⑨ 的"出图后再闪位"窗口不存在,先以
// firstSvg<=promoFrame 显式声明本片的判别力边界(宁可窗口收紧,不静默假绿)。
// 浏览器/登录/信封夹具与 smoothness spec 同源(./harness-boot),不复制第二份。
import { test, expect } from '@playwright/test'
import { bootHarnessPage } from './harness-boot'

interface FrameSample {
  ts: number
  h: number[]
  a: number
  g: number
  p: boolean
  t: number
}

async function readTimeline(page: import('@playwright/test').Page): Promise<{
  frames: FrameSample[]
  doneTs: number
}> {
  return page.evaluate(() => {
    const w = window as unknown as {
      __FRAMELOG?: FrameSample[]
      __STREAM_DONE?: number
    }
    return { frames: w.__FRAMELOG ?? [], doneTs: w.__STREAM_DONE ?? Number.NaN }
  })
}

test.describe('流式生命周期像素守门(⑦⑧⑨)', () => {
  // 隔离 dev 实例首访路由要现编译(Turbopack on-demand),预算给足
  test.setTimeout(300_000)
  test('晋升不回塌 / mermaid 出图后不闪位 / 逐块完成态当拍到位', async ({ page }) => {
    await bootHarnessPage(page, { mode: 'lifecycle' })

    await page.waitForFunction(
      () => (window as unknown as { __STREAM_DONE?: number }).__STREAM_DONE !== undefined,
      undefined,
      { timeout: 180000 },
    )
    const { frames, doneTs } = await readTimeline(page)

    // ── 采样 sanity ──────────────────────────────────────────────
    expect(frames.length, '时间线帧数应足够(≥60)才谈得上逐帧判据').toBeGreaterThanOrEqual(60)
    expect(Number.isFinite(doneTs), '驱动必须已停笔').toBe(true)

    // ── ⑦ 围栏高度单调不回塌 ────────────────────────────────────
    // 同 index 相邻两拍高度只许增/持平(容 1px 取整);降 = 折叠复位那一闪被抓现行。
    const drops: string[] = []
    for (let i = 1; i < frames.length; i++) {
      const prev = frames[i - 1] as FrameSample
      const cur = frames[i] as FrameSample
      const sharedLen = Math.min(prev.h.length, cur.h.length)
      for (let k = 0; k < sharedLen; k++) {
        const ph = prev.h[k] as number
        const ch = cur.h[k] as number
        if (ch < ph - 1) drops.push(`帧#${i} 围栏#${k}: ${ph}px → ${ch}px`)
      }
    }
    expect(drops, '流式全程围栏块高度只增不减(晋升 remount 不得丢展开态)').toEqual([])

    // ── ⑨ mermaid 真出图后占位不得再现 ──────────────────────────
    const firstSvg = frames.findIndex((f) => f.g > 0)
    expect(firstSvg, '真实浏览器内 mermaid 必须完成首次出图').toBeGreaterThan(-1)
    const bFrame = frames.findIndex((f) => f.h.length >= 2)
    expect(bFrame, '第二围栏必须到场(样本驱动未走完后段?)').toBeGreaterThan(-1)
    // 判别力守卫:只有"先出图、后晋升",闪位窗口才存在;顺序反了本片的 ⑨ 腿无的放矢,明说。
    expect(firstSvg, 'mermaid 应在晋升窗前已出图(否则 ⑨ 腿不构成判别窗口)').toBeLessThanOrEqual(
      bFrame,
    )
    const relapseAfterSvg = frames.slice(firstSvg + 1).some((f) => f.p)
    expect(
      relapseAfterSvg,
      'mermaid 出图后"渲染中"占位不得再现(晋升重挂必须由模块级台账首帧接上)',
    ).toBe(false)

    // ── ⑧ 逐块完成态:驱动停笔前,双块动作按钮都已就位 ───────────
    const duringStream = frames.filter((f) => f.ts <= doneTs - 80)
    expect(duringStream.length, '应有足量"流式中"帧供判').toBeGreaterThan(10)
    const applyDuring = Math.max(...duringStream.map((f) => f.a))
    expect(
      applyDuring,
      '流式未结束即应集齐两枚应用按钮(在写判定逐块化:写完的块当拍升完成外观)',
    ).toBe(2)
    const lastFrame = frames[frames.length - 1] as FrameSample
    expect(lastFrame?.a, '终态动作按钮不回退').toBe(2)
    expect(lastFrame?.g, '终态 mermaid 工具条在场').toBeGreaterThan(0)

    // ── 样本全文淌出 ────────────────────────────────────────────
    const finalText: string = await page.evaluate(
      () => document.querySelector('[data-testid="markdown-stream"]')?.textContent ?? '',
    )
    expect(finalText).toContain('由页内时间线量取')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
