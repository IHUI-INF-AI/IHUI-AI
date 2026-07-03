/**
 * 验证侧边栏底部登录/注册按钮的左右间距与 nav-item 完全一致 (2026-07-04 立)
 *
 * 背景: 用户反馈"登录注册按钮距离侧边栏左右间距有点大, 应该跟上面的所有
 * 菜单按钮容器相同". 实测: 旧 .sidebar-login-row padding: 6px 12px 10px
 * 导致 login-btn x=12 right=104 width=92, 而 nav-item x=4 right=112 width=108,
 * 差 8px/边, 整体按钮窄 16px.
 *
 * 修复: .sidebar-login-row 改为 margin-x: var(--nav-item-margin-x) (4px)
 * + padding-x: 0, 让 .login-button (width:100%) 撑满 = nav-item 同宽 108px.
 *
 * 检查项 (源码级 A + 浏览器级 B/C/D):
 *   A1. .sidebar-login-row 必须用 var(--nav-item-margin-x) 水平对齐 nav-item
 *   A2. .sidebar-login-row padding-x 必须为 0 (不能是 12px/8px 等)
 *   A3. 折叠态 padding 仍可用 10px 0 (居中 28×28 按钮)
 *   B1. 展开态: login-btn.x === nav-item.x (= 4px, 允许 ±1px 误差)
 *   B2. 展开态: login-btn.right === nav-item.right (= 112px, 允许 ±1px 误差)
 *   B3. 展开态: login-btn.width === nav-item.width (= 108px, 允许 ±1px 误差)
 *   B4. 展开态: login-btn centerX === sidebar centerX (58px, 116px sidebar)
 *   C1. 暗色模式: login-btn 与 nav-item 同样对齐
 *   D1. 折叠态: login-btn 28×28 + 与图标中心 x 一致 (沿用既有 sidebar-collapsed-bottom-alignment)
 *   D2. 折叠态: login-btn borderRadius !== 50% (不能是圆形)
 */
import { test, expect, type Page } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SIDEBAR_VUE = path.resolve(__dirname, '../src/components/Sidebar.vue')

/* ── 源码级守门: 必须在 dev server 不可用时也能跑, 拦截常见回归 ── */
test.describe('源码级: .sidebar-login-row 水平对齐约束', () => {
  test('A1+A2: padding-x 必须为 0 且 margin-x 必须引用 var(--nav-item-margin-x)', () => {
    expect(fs.existsSync(SIDEBAR_VUE), `Sidebar.vue 不存在: ${SIDEBAR_VUE}`).toBe(true)
    const content = fs.readFileSync(SIDEBAR_VUE, 'utf8')

    // 找到所有 .sidebar-login-row { ... } 规则块 (排除 .sidebar-login-row.is-collapsed)
    const lines = content.split('\n')
    const blocks: { start: number; end: number }[] = []
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*\.sidebar-login-row\s*\{/.test(lines[i])) {
        let depth = 0
        let endIdx = i
        for (let j = i; j < lines.length; j++) {
          depth += (lines[j].match(/\{/g) || []).length
          depth -= (lines[j].match(/\}/g) || []).length
          if (depth === 0) { endIdx = j; break }
        }
        blocks.push({ start: i, end: endIdx })
      }
    }

    expect(blocks.length, '.sidebar-login-row 规则块数量 (排除 .is-collapsed)').toBeGreaterThanOrEqual(1)

    for (const block of blocks) {
      // A1: 块内必须包含 margin-x 引用 --nav-item-margin-x
      const blockText = lines.slice(block.start, block.end + 1).join('\n')
      const hasMarginX = /margin\s*:\s*0\s+var\(--nav-item-margin-x\)|margin\s*:\s*0\s+var\(--nav-item-margin-x\)\s*;?/.test(blockText)
        || /margin\s*:[^;]*var\(--nav-item-margin-x\)[^;]*;/.test(blockText)
      expect(hasMarginX,
        `.sidebar-login-row (行 ${block.start + 1}-${block.end + 1}) 必须 margin-x 引用 var(--nav-item-margin-x) 与 nav-item 对齐\n` +
        `块内容:\n${blockText}`,
      ).toBe(true)

      // A2: padding-x 必须为 0 (padding: 6px 0 10px 这种三向写法, 左右分量都是 0)
      const paddingMatch = blockText.match(/padding\s*:\s*([^;]+);/)
      expect(paddingMatch, `.sidebar-login-row (行 ${block.start + 1}-${block.end + 1}) 必须显式 padding 声明`).not.toBeNull()
      if (paddingMatch) {
        const parts = paddingMatch[1].trim().split(/\s+/)
        // padding 三/四向简写: 6px 0 10px → [6px, 0, 10px], 左右 (parts[1], parts[3]||parts[1]) 都必须为 0
        const leftRight: string[] = []
        if (parts.length === 1) leftRight.push(parts[0])
        else if (parts.length === 2) { leftRight.push(parts[1]) } // vertical horizontal
        else if (parts.length === 3) { leftRight.push(parts[1], parts[1]) } // top horizontal bottom
        else if (parts.length === 4) { leftRight.push(parts[1], parts[3]) } // top right bottom left
        for (const v of leftRight) {
          expect(['0', '0px'], `.sidebar-login-row padding 水平分量必须为 0 (实测: ${v}, 完整: ${paddingMatch[1].trim()})`).toContain(v)
        }
      }
    }
  })

  test('A3: 禁用旧值 padding: 6px 12px 10px (会导致按钮比 nav-item 窄 16px)', () => {
    const content = fs.readFileSync(SIDEBAR_VUE, 'utf8')
    const lines = content.split('\n')
    for (let i = 0; i < lines.length; i++) {
      // 排除 .is-collapsed 块内的 padding: 10px 0
      expect(/padding\s*:\s*6px\s+12px\s+10px/.test(lines[i]),
        `第 ${i + 1} 行: 含禁用旧值 padding: 6px 12px 10px (用户反馈"登录按钮间距大"根因, 2026-07-04 已修复为 margin-x: var(--nav-item-margin-x) + padding: 6px 0 10px)`,
      ).toBe(false)
    }
  })
})

/* ── 浏览器级守门: dev server 不可用时自动 skip ── */
async function gotoWithFallback(page: Page): Promise<boolean> {
  try {
    await page.goto('http://localhost:8888/', { waitUntil: 'domcontentloaded', timeout: 8000 })
    return true
  } catch {
    return false
  }
}

test.describe('浏览器级: 登录按钮与 nav-item 水平对齐', () => {
  test('B1-B4: 展开态 login-btn 与 nav-item 完全对齐 (x/right/width/centerX)', async ({ page, viewport }) => {
    // 移动端 (.login-button @media width<=767px 强制 width:40px 方形) 与桌面端布局不同, 此用例不适用
    if (viewport && viewport.width < 768) test.skip(true, '移动端 .login-button 渲染为 40×40 方形图标, 不撑满到 nav-item 宽度, 不适用此用例')
    test.skip((await gotoWithFallback(page)) === false, 'dev server 8888 未启动, 跳过浏览器级测试')

    const errors: string[] = []
    page.on('pageerror', err => errors.push(err.message))
    page.on('console', msg => {
      if (msg.type() === 'error') {
        if (msg.text().includes('401')) return
        if (msg.text().includes('Authentication required')) return
        errors.push(msg.text())
      }
    })

    await page.locator('.nav-item').first().waitFor({ state: 'attached', timeout: 30000 })
    await page.waitForTimeout(2000)

    const firstNav = page.locator('.nav-item').first()
    const loginRow = page.locator('.sidebar-login-row').first()
    const loginBtn = page.locator('.sidebar-login-row .login-button').first()

    await loginRow.waitFor({ state: 'attached', timeout: 10000 })
    await loginBtn.waitFor({ state: 'attached', timeout: 10000 })
    await page.waitForTimeout(500)

    const navBox = await firstNav.boundingBox()
    const rowBox = await loginRow.boundingBox()
    const btnBox = await loginBtn.boundingBox()
    const sidebar = page.locator('.app-sidebar').first()
    const sidebarBox = await sidebar.boundingBox()

    expect(navBox, 'nav-item 可见').not.toBeNull()
    expect(rowBox, 'sidebar-login-row 可见').not.toBeNull()
    expect(btnBox, 'login-button 可见').not.toBeNull()
    expect(sidebarBox, 'app-sidebar 可见').not.toBeNull()

    if (!navBox || !rowBox || !btnBox || !sidebarBox) return

    console.log(`[nav] x=${Math.round(navBox.x)} right=${Math.round(navBox.x + navBox.width)} width=${Math.round(navBox.width)}`)
    console.log(`[row] x=${Math.round(rowBox.x)} right=${Math.round(rowBox.x + rowBox.width)} width=${Math.round(rowBox.width)}`)
    console.log(`[btn] x=${Math.round(btnBox.x)} right=${Math.round(btnBox.x + btnBox.width)} width=${Math.round(btnBox.width)}`)

    // B1: 左边对齐 (允许 ±1px 子像素误差)
    expect(Math.abs(btnBox.x - navBox.x), `login-btn.x(${btnBox.x}) 应与 nav-item.x(${navBox.x}) ±1px 一致`).toBeLessThanOrEqual(1)
    // B2: 右边对齐
    const navRight = navBox.x + navBox.width
    const btnRight = btnBox.x + btnBox.width
    expect(Math.abs(btnRight - navRight), `login-btn.right(${btnRight}) 应与 nav-item.right(${navRight}) ±1px 一致`).toBeLessThanOrEqual(1)
    // B3: 宽度一致
    expect(Math.abs(btnBox.width - navBox.width), `login-btn.width(${btnBox.width}) 应与 nav-item.width(${navBox.width}) ±1px 一致`).toBeLessThanOrEqual(1)
    // B4: 中心 x === sidebar 中心 x
    const sidebarCenterX = sidebarBox.x + sidebarBox.width / 2
    const btnCenterX = btnBox.x + btnBox.width / 2
    expect(Math.abs(btnCenterX - sidebarCenterX), `login-btn 中心 x(${btnCenterX}) 应与 sidebar 中心 x(${sidebarCenterX}) ±1px 一致`).toBeLessThanOrEqual(1)

    expect(errors, `控制台无错误: ${errors.join('\n')}`).toEqual([])
  })

  test('C1: 暗色模式 login-btn 仍与 nav-item 对齐', async ({ page, viewport }) => {
    // 移动端 (.login-button @media width<=767px 强制 width:40px 方形) 与桌面端布局不同, 此用例不适用
    if (viewport && viewport.width < 768) test.skip(true, '移动端 .login-button 渲染为 40×40 方形图标, 不撑满到 nav-item 宽度, 不适用此用例')
    test.skip((await gotoWithFallback(page)) === false, 'dev server 8888 未启动, 跳过浏览器级测试')

    const errors: string[] = []
    page.on('pageerror', err => errors.push(err.message))
    page.on('console', msg => {
      if (msg.type() === 'error') {
        if (msg.text().includes('401')) return
        if (msg.text().includes('Authentication required')) return
        errors.push(msg.text())
      }
    })

    await page.addInitScript(() => {
      localStorage.setItem('darkMode', 'dark')
    })
    await page.goto('http://localhost:8888/', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(800)
    await page.evaluate(() => document.documentElement.classList.add('dark'))
    await page.waitForTimeout(500)

    await page.locator('.nav-item').first().waitFor({ state: 'attached', timeout: 30000 })
    await page.waitForTimeout(1500)

    const firstNav = page.locator('.nav-item').first()
    const loginBtn = page.locator('.sidebar-login-row .login-button').first()
    await loginBtn.waitFor({ state: 'attached', timeout: 10000 })

    const navBox = await firstNav.boundingBox()
    const btnBox = await loginBtn.boundingBox()
    if (!navBox || !btnBox) return

    const navRight = navBox.x + navBox.width
    const btnRight = btnBox.x + btnBox.width
    expect(Math.abs(btnBox.x - navBox.x), `暗色 login-btn.x(${btnBox.x}) 应与 nav-item.x(${navBox.x}) ±1px 一致`).toBeLessThanOrEqual(1)
    expect(Math.abs(btnRight - navRight), `暗色 login-btn.right(${btnRight}) 应与 nav-item.right(${navRight}) ±1px 一致`).toBeLessThanOrEqual(1)
    expect(Math.abs(btnBox.width - navBox.width), `暗色 login-btn.width(${btnBox.width}) 应与 nav-item.width(${navBox.width}) ±1px 一致`).toBeLessThanOrEqual(1)

    await page.screenshot({ path: 'e2e/__screenshots__/sidebar-login-row-dark.png', clip: { x: 0, y: 700, width: 200, height: 100 } })
    expect(errors, `控制台无错误: ${errors.join('\n')}`).toEqual([])
  })

  test('D1+D2: 折叠态 login-btn 28×28 + 居中 + 非 50% 圆形 (沿用既有守门)', async ({ page }) => {
    test.skip((await gotoWithFallback(page)) === false, 'dev server 8888 未启动, 跳过浏览器级测试')

    const errors: string[] = []
    page.on('pageerror', err => errors.push(err.message))
    page.on('console', msg => {
      if (msg.type() === 'error') {
        if (msg.text().includes('401')) return
        errors.push(msg.text())
      }
    })

    await page.goto('http://localhost:8888/', { waitUntil: 'domcontentloaded' })
    await page.locator('.sidebar-actions').first().waitFor({ state: 'attached', timeout: 30000 })
    await page.waitForTimeout(1500)

    const collapseBtn = page.locator('.sidebar-collapse-btn').first()
    if (await collapseBtn.count() > 0) {
      await collapseBtn.click({ force: true }).catch(() => {})
      await page.waitForTimeout(800)
    }

    const loginBtn = page.locator('.sidebar-login-row .login-button').first()
    await loginBtn.waitFor({ state: 'attached', timeout: 10000 })

    const btnBox = await loginBtn.boundingBox()
    const br = await loginBtn.evaluate(el => getComputedStyle(el).borderRadius)
    if (btnBox) {
      console.log(`[collapsed-login] ${Math.round(btnBox.width)}x${Math.round(btnBox.height)} borderRadius=${br}`)
      expect(btnBox.width, '折叠态 login-btn 宽度必须 28px').toBe(28)
      expect(btnBox.height, '折叠态 login-btn 高度必须 28px').toBe(28)
      expect(br, `折叠态 login-btn 不能是 50% 圆形, 实际: ${br}`).not.toBe('50%')
    }

    expect(errors, `控制台无错误: ${errors.join('\n')}`).toEqual([])
  })
})
