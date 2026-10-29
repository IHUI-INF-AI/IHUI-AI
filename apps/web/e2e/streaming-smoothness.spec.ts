// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 流式渲染平滑度 e2e 守门(2026-10-28 立,2026-10-28 改走隔离路由)
//
// 起因:用户反馈长回答流式"整坨蹦、跟 Qoder/Trae/Codex 差太多"。根因定位见
// markdown-stream.tsx 头注与 smooth-delta-batcher.ts —— 渲染层曾把批处理泵逐帧送来的
// 字符再用 50/150/400ms 自适应节流二次合并(长内容降到 400ms),并把光标套进
// useDeferredValue 滞后一拍,长回答上把"逐字淌"重新压回"2.5 次/秒整坨跳"。
// 修复:THROTTLE_MS 恒为 16ms 帧对齐、删除 useDeferredValue;并完成瞬间恒切分(零重排)。
//
// 本 spec 是"实跑"验证:不依赖真实模型与后端,改用 apps/web/app/e2e-harness/markdown-stream
// 隔离路由(零后端依赖,本地驱动器模拟平滑批处理的几何揭示),让浏览器真渲流式;
// 随后在浏览器内逐帧采样 markdown 文本长度,量化"平滑度":
//   - 平滑(修复后):文本长度呈几十~上百次小步增长,单次最大跳变 < 总长 30%;
//   - 整坨蹦(回退 400ms):文本长度只有几次大跳,单次跳变 ≈ 总长 100%。
// 完成瞬间翻转 isStreaming=false,验证 active→stable 零重排(子节点数恒定、DOM 复用)。
// 本沙箱 chromium 下载被墙,改走系统 Edge via channel:'msedge' + --no-sandbox。
// 2026-10-29:启动夹具(localStorage 假会话 + /api 信封)抽到 ./harness-boot 单一真相源,
// 与 streaming-lifecycle(档⑦⑧⑨像素守门)共用,不再各自复制一份。
import { test, expect, type Page } from '@playwright/test'
import { bootHarnessPage } from './harness-boot'

test.describe('长回答流式平滑度(隔离路由实跑)', () => {
  // 隔离实例首访 harness 路由需现场编译;共享热实例下该额度不会用满
  test.setTimeout(180_000)
  test('长回答逐帧平滑淌出,无整坨蹦,完成瞬间零重排', async ({ page }: { page: Page }) => {
    await bootHarnessPage(page)

    // harness 页挂载后自动启动流式(绕过按钮被覆盖层拦截的 onClick 失效问题)
    // 先等流式真正开始(content > 0),再采样
    await page
      .waitForFunction(
        () =>
          (document.querySelector('[data-testid="markdown-stream"]')?.textContent ?? '').length > 0,
        { timeout: 10000 },
      )
      .catch(() => {
        // eslint-disable-next-line no-console
        console.log('[warn] 流式未在 10s 内启动,继续采样以暴露问题')
      })

    // Node 侧轮询采样渲染文本长度(不受页面内 rAF 节流影响;驱动用 setInterval 推进)。
    // 采样窗口 3.5s、每 ~15ms 一拍 → ~230 个样本,足以量化"逐帧小步" vs "整坨蹦"。
    const samples: number[] = []
    const t0 = Date.now()
    while (Date.now() - t0 < 3500) {
      const len = await page.evaluate(
        () => (document.querySelector('[data-testid="markdown-stream"]')?.textContent ?? '').length,
      )
      samples.push(len)
      await page.waitForTimeout(15)
    }

    // 渐进流式实证:内容在多个采样点持续变长(排除"一次粘贴整坨"的假象)
    const distinct = [...new Set(samples.filter((x) => x > 0))].sort((a, b) => a - b)
    const nonZero = samples.filter((x) => x > 0)
    expect(distinct.length, '渲染台阶数应 ≥ 10 → 确为逐段增长而非一次粘贴').toBeGreaterThanOrEqual(
      10,
    )
    expect(nonZero.length, '采样窗口内多数拍应已增长').toBeGreaterThan(20)

    const total = distinct.at(-1) ?? 0
    const maxStep =
      distinct.length > 1 ? Math.max(...distinct.slice(1).map((v, i) => v - (distinct[i] ?? 0))) : 0
    const ratio = total > 0 ? maxStep / total : 1

    // 注:无头 Edge 对 setInterval/rAF 有节流,偶发把多帧合并成一次 ~300 字突跳,
    // 故 ratio 在此环境偏宽松;逐帧平滑的权威证明见 vitest 门禁(markdown-stream-smoothness)
    // 该门禁喂逐帧 content,测得 maxStepRatio≈0.07。此处 ratio 仅作信息性日志 + 宽松背压。
    // eslint-disable-next-line no-console
    console.log(
      `[streaming-smoothness] total=${total} distinctSteps=${distinct.length} maxStep=${maxStep} maxStepRatio=${ratio.toFixed(3)}`,
    )

    // 全文完整在场。注意:不能拿 Markdown 源串长度(1571)比 DOM 纯文本——
    // 渲染后 '# ' '**' '- ' '>' '```' 等语法符被剥离,纯文本必然更短(实测 1274)。
    // 更反直觉的是:流式中途 textContent 反而更长(未闭合栅栏/半截表格把 ``` 与 | 当纯文本吐出),
    // 故"末拍长度 == 终态长度"是伪判据,必须等驱动停下后再取终态。
    // 完成信号 = 按钮标签 (content.length) 停止增长。
    let prevLen = -1
    for (let k = 0; k < 80; k++) {
      const curLen = await page.evaluate(() => {
        const label = document.querySelector('[data-testid="start-stream"]')?.textContent ?? ''
        const m = /\((\d+)\)/.exec(label)
        return m ? Number(m[1]) : -1
      })
      if (curLen > 0 && curLen === prevLen) break
      prevLen = curLen
      await page.waitForTimeout(150)
    }
    expect(prevLen, '驱动应已推进到全文(源串长度 >0 且已停止增长)').toBeGreaterThan(1000)

    const finalText = await page.evaluate(
      () => document.querySelector('[data-testid="markdown-stream"]')?.textContent ?? '',
    )
    expect(finalText.length, '长回答渲染纯文本应 >1000 字').toBeGreaterThan(1000)
    expect(finalText, '正文尾句必须淌出 → 证明全文完整、无中途截断').toContain(
      '这便是我们要的流式质感',
    )
    // 宽松背压:单次最大跳变占比不应接近"整坨蹦"(≈1.0);留余量给无头节流
    expect(ratio, '单跳占比应远低于整坨蹦阈值(无头节流下放宽至 0.6)').toBeLessThan(0.6)

    // 完成瞬间零重排:DOM 结构 intact(MarkdownStream 单根,翻转前后恒定)。
    // 内部 DOM 复用(零重排)的权威证明见组件测试 markdown-stream.test.tsx 的
    // "翻转零重排"强断言(firstChild 节点复用)。
    const childCount = await page.evaluate(
      () => document.querySelector('[data-testid="stream-host"]')?.childElementCount ?? -1,
    )
    expect(childCount).toBe(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
