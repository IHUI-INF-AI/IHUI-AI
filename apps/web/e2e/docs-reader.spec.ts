// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * docs-reader.spec.ts — 移动端 /docs 可读性用例(390×844,游客态)
 *
 * 立因(主席 2026-11-01 实测,此前全仓无人判):
 *   ① 手机 390px 未登录打开 /docs,文档正文被 `div.ai-panel-root`(position:fixed,
 *      实测盒 390×844)整屏盖住;`document.elementFromPoint(H1 坐标)` 命中的是面板容器
 *      而不是标题 ⇒ 既有 e2e 只断"不 500"(navigation.spec.ts 只断 toHaveURL,
 *      navigation-full.spec.ts 只收集 status≥500),视觉回归又不覆盖 /docs,这一格是空的。
 *   ② 6 处文字被容器裁切(/docs/api 的 /v1/agents/:id/publish 需 145px 给 128px 等),
 *      违反 AGENTS.md §4「读数不得断行」。
 *
 * 这条用例是"修好了才会绿"的牙。**不得为了变绿放宽断言**(AGENTS.md §12e 禁止削判据消红)。
 *
 * 2026-11-03 现读(本机 8801 dev 服务 = 工作树面):产品三条已转绿 —— 别席(s5)未提交的修复
 * 已把工作树里的整屏遮挡与格子裁切改掉(实测 .ai-panel-root 由 390×844 降到 390×405,
 * H1 中心点 elementFromPoint 命中 h1 本体;4 处 /v1/agents/* 格子无裁切祖先)。
 * 因此"绿"必须由下面那条**牙自证**撑住:同一套探针喂合成缺陷页(整屏 fixed 面板 +
 * 128px 格子塞长读数)必须判红 —— 探针松了会在那里当场翻红,而不是在这里假装通过。
 * 修复尚未进 HEAD(hreflang 死声明仍在 HEAD 面,由 scripts/check-docs-public-health.mjs 量)。
 *
 * 跑法(外部已起的 dev server,免得抢 8801 触发后端门):
 *   cd apps/web && PLAYWRIGHT_BROWSERS_PATH='D:\caches\playwright' \
 *   IHUI_E2E_EXTERNAL_SERVER=1 IHUI_E2E_BASE_URL=http://localhost:8801 \
 *   pnpm exec playwright test e2e/docs-reader.spec.ts
 */
import { expect, test } from '@playwright/test'

const MOBILE_VIEWPORT = { width: 390, height: 844 }

// 游客态:显式空 storageState,防止别的 spec 的登录态串味(缺陷只在未登录时暴露)
test.use({ viewport: MOBILE_VIEWPORT, storageState: { cookies: [], origins: [] } })

interface PointProbe {
  hitTag: string | null
  hitClass: string | null
  hitChain: string[]
  inAiPanel: boolean
  hitsHeadingOrTextContainer: boolean
  h1Text: string | null
  h1Box: { x: number; y: number; width: number; height: number } | null
  aiPanelBox: { width: number; height: number; position: string } | null
}

/** 取 H1 中心点,用 elementFromPoint 判"这一屏到底谁在接手" */
async function probeHeading(page: import('@playwright/test').Page): Promise<PointProbe> {
  const h1 = page.locator('h1').first()
  await expect(h1, 'docs 页必须有 H1(没有就没什么可读性可判)').toBeVisible({ timeout: 15_000 })
  // 侧栏面板是客户端挂载的:先给它一次"落位"的机会,否则可能趁它还没出现时假绿。
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
  await page.waitForSelector('.ai-panel-root', { timeout: 5_000 }).catch(() => {})
  const box = await h1.boundingBox()
  expect(box, 'H1 必须量得到盒(量不到 = 未判定,不得记绿)').not.toBeNull()
  if (!box) throw new Error('H1 盒量不到 ⇒ 未判定,不得记绿')
  // boundingBox 的完整盒型是 { x, y, width, height }(原断言只断言了 x,访问 width 时 TS 判空)
  // 归并判定:用 `if (!box)` 真空值守卫完成类型收窄,故无需对侧的 `as {…}` 盒型断言 cast。
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2

  return page.evaluate(
    ({ x, y, h1Box }) => {
      const el = document.elementFromPoint(x, y)
      const h1El = document.querySelector('h1')
      const chain: string[] = []
      let cur: Element | null = el
      while (cur && chain.length < 8) {
        const cls =
          typeof cur.className === 'string' ? cur.className.trim().split(/\s+/).join('.') : ''
        chain.push(
          `${cur.tagName.toLowerCase()}${cur.id ? `#${cur.id}` : ''}${cls ? `.${cls}` : ''}`,
        )
        cur = cur.parentElement
      }
      const panel = document.querySelector('.ai-panel-root')
      const pbox = panel?.getBoundingClientRect()
      return {
        hitTag: el ? el.tagName.toLowerCase() : null,
        hitClass: el && typeof el.className === 'string' ? el.className : null,
        hitChain: chain,
        inAiPanel: Boolean(el && h1El && el.closest('.ai-panel-root')),
        hitsHeadingOrTextContainer: Boolean(
          el && h1El && (el === h1El || h1El.contains(el) || el.contains(h1El)),
        ),
        h1Text: h1El ? (h1El.textContent ?? '').trim().slice(0, 40) : null,
        h1Box,
        aiPanelBox: pbox
          ? {
              width: Math.round(pbox.width),
              height: Math.round(pbox.height),
              position: getComputedStyle(panel as HTMLElement).position,
            }
          : null,
      }
    },
    { x, y, h1Box: box },
  )
}

interface PathCell {
  text: string
  need: number
  available: number
  clipped: boolean
  minWidthRescue: boolean
  clippedBy: string
  tag: string
}

/**
 * 读数格子的裁切扫描(唯一一份:产品页与合成缺陷夹具共用同一判据,不在两处各写一遍)。
 * 量法:文本叶子本身可能是 inline(clientWidth/scrollWidth 恒 0,实测坑),所以沿"叶子→祖先"
 * 链找真正在裁的那一层(overflow-x: hidden|clip),用它自己的 scrollWidth vs clientWidth 判。
 * 兜住的出口 = 该格显式 min-width(AGENTS.md §4 读数不得断行的合法出路之一)。
 */
async function scanPathCells(page: import('@playwright/test').Page): Promise<PathCell[]> {
  await page.waitForFunction(
    () =>
      Array.from(document.querySelectorAll('code, span, div, td, th')).some((n) =>
        (n.textContent ?? '').trim().startsWith('/v1/agents/'),
      ),
    undefined,
    { timeout: 20_000 },
  )
  return page.evaluate(() => {
    const out: PathCell[] = []
    const clipper = (el: Element): Element | null => {
      let cur: Element | null = el
      while (cur) {
        const cs = getComputedStyle(cur)
        if (cs.overflowX === 'hidden' || cs.overflowX === 'clip') {
          if (cur.scrollWidth > cur.clientWidth + 1) return cur
        }
        cur = cur.parentElement
      }
      return null
    }
    for (const n of Array.from(document.querySelectorAll('code, span, div, td, th'))) {
      const text = (n.textContent ?? '').trim()
      if (!text.startsWith('/v1/agents/')) continue
      if (n.childElementCount > 0) continue // 只判承载读数的那一层叶子文本
      if (n.getBoundingClientRect().height === 0) continue // 没渲染的不算证据
      const cut = clipper(n)
      const cs = cut ? getComputedStyle(cut) : null
      const mw = cs?.minWidth ?? 'auto'
      out.push({
        text: text.slice(0, 48),
        need: cut ? cut.scrollWidth : n.scrollWidth,
        available: cut ? cut.clientWidth : n.clientWidth,
        clipped: Boolean(cut),
        minWidthRescue: mw !== 'auto' && parseFloat(mw) > 0,
        clippedBy: cut
          ? `${cut.tagName.toLowerCase()}.${(typeof cut.className === 'string' ? cut.className : '').trim().split(/\s+/).slice(0, 3).join('.')}`
          : 'none',
        tag: n.tagName.toLowerCase(),
      })
    }
    return out
  })
}

test.describe('移动端 /docs 可读性(390×844 · 游客)', () => {
  for (const path of ['/docs', '/docs/api']) {
    test(`${path} 的 H1 必须真的可点可读(不被 .ai-panel-root 盖住)`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' })
      // 侧栏面板是客户端挂载的,给它一次落位的机会(不 sleep 等待,直接等 H1 可见后再量)
      const probe = await probeHeading(page)

      expect(
        probe.hitsHeadingOrTextContainer,
        `elementFromPoint(${path} 的 H1 中心) 命中的是 [${probe.hitTag}] class="${probe.hitClass}" ` +
          `链=${probe.hitChain.join(' < ')};H1 文本="${probe.h1Text}"。` +
          `命中元素既不是标题本身也不是它的文本容器 ⇒ 正文被别的东西压在下面`,
      ).toBe(true)

      expect(
        probe.inAiPanel,
        `H1 坐标处命中的元素落在 .ai-panel-root 内(面板实测盒 ${JSON.stringify(probe.aiPanelBox)},` +
          `视口 ${MOBILE_VIEWPORT.width}×${MOBILE_VIEWPORT.height})⇒ 移动端整屏遮挡缺陷在场`,
      ).toBe(false)
    })
  }

  test('/docs/api 的 API 路径格子不得被裁(§4 读数不得断行)', async ({ page }) => {
    await page.goto('/docs/api', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('h1').first(), '/docs/api 必须有 H1').toBeVisible({ timeout: 15_000 })
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})

    const cells = await scanPathCells(page)

    // 枚举到 0 个候选 = 判据失明,不是"通过"(§0.3)
    expect(
      cells.length,
      '/docs/api 里一个 /v1/agents/* 路径格子都没量到 ⇒ 用例判据失明,不得记绿',
    ).toBeGreaterThan(0)

    const clipped = cells.filter((c) => c.clipped && !c.minWidthRescue)
    expect(
      clipped,
      `被容器裁掉的 API 路径格子 ${clipped.length} 处:` +
        clipped
          .map(
            (c) =>
              `<${c.tag}> "${c.text}" 需 ${c.need}px 给 ${c.available}px(裁它的是 ${c.clippedBy})`,
          )
          .join(' | '),
    ).toEqual([])
  })

  /**
   * 牙自证:同一套探针喂一张"合成缺陷页"(主席实测的两种形态:整屏 fixed 面板盖正文 +
   * 128px 格子塞 145px 读数)必须判红。产品页此刻是绿的(修复在工作树里),这条夹具保证
   * "绿"是缺陷真没了,不是探针松了 —— 摘掉判据/放宽断言都会在这里当场翻红。
   */
  test('牙自证:合成缺陷页必须被同一探针判红', async ({ page }) => {
    await page.setContent(
      `<!doctype html><html><head><meta charset="utf-8"><style>
         body{margin:0;width:390px}
         h1{margin:0;padding:16px;font-size:24px}
         .ai-panel-root{position:fixed;top:0;left:0;width:390px;height:844px;z-index:990;background:#fff}
         .cell{width:128px;overflow:hidden;white-space:nowrap}
       </style></head><body>
         <main><h1>文档中心</h1><div class="cell"><code>/v1/agents/:id/publish</code></div></main>
         <div class="ai-panel-root"></div>
       </body></html>`,
      { waitUntil: 'load' },
    )

    const probe = await probeHeading(page)
    expect(probe.hitsHeadingOrTextContainer, '合成缺陷页应判"命中的不是标题"').toBe(false)
    expect(probe.inAiPanel, '合成缺陷页应判"命中元素落在 .ai-panel-root 内"').toBe(true)

    const cells = await scanPathCells(page)
    expect(cells.length, '合成缺陷页必须量到路径格子').toBeGreaterThan(0)
    const clipped = cells.filter((c) => c.clipped && !c.minWidthRescue)
    expect(clipped.length, `合成裁切格子未被判出:${JSON.stringify(cells)}`).toBeGreaterThan(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
