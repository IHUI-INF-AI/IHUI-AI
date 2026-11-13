// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​​​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D2 的浏览器侧**集成冒烟**(2026-11-13 立,判别力已实测并如实登记)。
 *
 * ## 这两个用例能证明什么、不能证明什么(必须先读)
 *
 * **能证明**:`?mode=tail` 隔离路由在真实浏览器里能走完两条路径 ——
 * 末帧推入后 DOM 最终含该帧、整体替换后 DOM 是干净的新内容。它们钉的是
 * "组件 + React 提交 + 节流 + rAF 在真实渲染环境里协同不崩",不是逻辑正确性。
 *
 * **不能证明**:它们**测不出** trailing timer 捕获旧快照那个缺陷。
 * 实测:把 `setThrottledContent(pendingContentRef.current)` 改回 `setThrottledContent(content)`
 * (即回退 D2 的修复),本文件两例**仍然通过**。原因:该缺陷要求"同一节流窗口内两帧、
 * 且 timer 已挂不再重排"这一精确时序,而浏览器里经 React effect 重注册后该时序不稳定复现。
 *
 * ⇒ **判别力在单测**:`markdown-stream-trailing-frame.test.tsx` 用假定时器精确构造该时序,
 * 已做反向验证(回退修复 ⇒ 该用例变红)。本文件不重复那条断言,也不冒充它。
 *
 * 这条界线写在这里,是为了防止下一个人看到"e2e 全绿"就以为 D2 的时序被浏览器覆盖了。
 */
import { test, expect, type Page } from '@playwright/test'
import { bootHarnessPage } from './harness-boot'

const TAIL_SENTINEL = 'TAIL-END-SENTINEL'
const REPLACED = 'REPLACED-VIEW-CONTENT'

function hostText(page: Page): Promise<string> {
  return page.evaluate(
    () => document.querySelector('[data-testid="stream-host"]')?.textContent ?? '',
  )
}

test.describe('D2 浏览器集成冒烟(判别力见文件头注)', () => {
  test.setTimeout(180_000)

  test('末帧路径在真实浏览器里跑通:末帧最终出现在 DOM', async ({ page }) => {
    await bootHarnessPage(page, { mode: 'tail' })

    // harness 在 streaming 仍为 true 时推末帧(见 page.tsx 的 startTail 注释),
    // 因此这里等的是"末帧靠节流自身落盘",不靠 finish 冲刺。
    await page
      .waitForFunction(
        (sentinel) =>
          (document.querySelector('[data-testid="stream-host"]')?.textContent ?? '').includes(
            sentinel,
          ),
        TAIL_SENTINEL,
        { timeout: 20000 },
      )
      .catch(() => undefined)

    // 节流窗口为 16ms,给足 1s 余量后必须已落盘
    await page.waitForTimeout(1000)
    const text = await hostText(page)
    expect(text).toContain(TAIL_SENTINEL)
  })

  test('整体替换路径在真实浏览器里跑通:替换后 DOM 为新内容且无旧残留', async ({ page }) => {
    await bootHarnessPage(page, { mode: 'tail' })

    await page
      .waitForFunction((needle) => (document.body.textContent ?? '').includes(needle), REPLACED, {
        timeout: 20000,
      })
      .catch(() => undefined)

    await page.waitForTimeout(300)
    const text = await hostText(page)
    expect(text).toContain(REPLACED)
    expect(text, '替换后旧内容不得残留').not.toContain(TAIL_SENTINEL)
  })
})
