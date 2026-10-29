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
  l: number[]
  a: number
  g: number
  p: boolean
  t: number
  s: string[]
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

    // ── ⑦ 围栏显示行数单调不回塌 ────────────────────────────────
    // 判据是"行数"而非高度:react-syntax-highlighter 是懒加载 chunk,plain fallback ↔
    // 高亮版换装会因行高差让像素高度正常跳变(实测 77→54、234→99 皆此型,行数不变);
    // 折叠复位才让行数真缩(12→5)。innerText 按块级布局折行,行号各行计一行。
    const drops: string[] = []
    const heightJitter: string[] = []
    for (let i = 1; i < frames.length; i++) {
      const prev = frames[i - 1] as FrameSample
      const cur = frames[i] as FrameSample
      const sharedLen = Math.min(prev.l.length, cur.l.length)
      for (let k = 0; k < sharedLen; k++) {
        const pl = prev.l[k] as number
        const cl = cur.l[k] as number
        if (cl < pl) drops.push(`帧#${i} 围栏#${k}: ${pl}行 → ${cl}行`)
        const ph = prev.h[k] as number
        const ch = cur.h[k] as number
        if (ch < ph - 1) heightJitter.push(`帧#${i} 围栏#${k}: ${ph}px → ${ch}px`)
      }
    }
    // eslint-disable-next-line no-console
    console.log(
      `[lifecycle] heightJitter=${heightJitter.length} 处(高亮换装,信息性): ${heightJitter.slice(0, 6).join(' | ')}`,
    )
    if (drops.length > 0) {
      // 取证:每个塌缩帧的 ±3 帧全字段读数(归因用,不参与判定)
      const idxs = [...new Set(drops.map((d) => Number(/帧#(\d+)/.exec(d)?.[1] ?? NaN)))]
      for (const di of idxs) {
        for (let i = Math.max(1, di - 3); i <= Math.min(frames.length - 1, di + 3); i++) {
          const f = frames[i] as FrameSample
          // eslint-disable-next-line no-console
          console.log(
            `[lifecycle][evidence] 帧#${i} h=${JSON.stringify(f.h)} l=${JSON.stringify(f.l)} a=${f.a} g=${f.g} p=${f.p} t=${f.t} s=${JSON.stringify(f.s)}`,
          )
        }
      }
    }
    // (调试通道)若塌缩在册:抓每个围栏块的 outerHTML 片段——"展开 (N 行)"按钮文本
    // 直接暴露 codeLines.length,可一步分辨塌缩来源(先取证再断言,expect 会短路)。
    if (drops.length > 0) {
      const html: string[] = await page.evaluate(() =>
        Array.from(document.querySelectorAll('[data-testid="code-block-header"]')).map((e) =>
          (e.parentElement?.outerHTML ?? '').replace(/\s+/g, ' ').slice(0, 400),
        ),
      )
      for (const [i, frag] of html.entries()) {
        // eslint-disable-next-line no-console
        console.log(`[lifecycle][html] 块#${i}: ${frag}`)
      }
    }
    expect(drops, '流式全程围栏显示行数只增不减(折叠复位/晋升回塌即现形)').toEqual([])

    // ── ⑨ mermaid 真出图后占位不得再现 ──────────────────────────
    const firstSvg = frames.findIndex((f) => f.g > 0)
    expect(firstSvg, '真实浏览器内 mermaid 必须完成首次出图').toBeGreaterThan(-1)
    // B 块在场判据 = 快照里出现 main.py。不能用 h.length>=2:晋升 commit 瞬间新旧双头,
    // "长度≥2"最早命中的是 A 的晋升拍而非 B(2026-10-29 实跑分辨)。
    const bFrame = frames.findIndex((f) => f.s.some((x) => x.includes('main.py')))
    expect(bFrame, '第二围栏必须到场(样本驱动未走完后段?)').toBeGreaterThan(-1)
    // 判别力守卫:只有"先出图、后晋升",闪位窗口才存在;顺序反了本片的 ⑨ 腿无的放矢,明说。
    expect(firstSvg, 'mermaid 应在晋升窗前已出图(否则 ⑨ 腿不构成判别窗口)').toBeLessThanOrEqual(
      bFrame,
    )
    // 闪位 = "占位在场且 mermaid 不在场"的帧。裸 p 判据会误伤:
    // react-syntax-highlighter 也是懒加载 chunk,其 dynamic loading 占位同为 animate-pulse
    // (2026-10-29 实跑分辨:图出后 py 块高亮 chunk 在载入 → p 真 g 在 → 非闪位)。
    const relapseAfterSvg = frames.slice(firstSvg + 1).some((f) => f.p && f.g === 0)
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
