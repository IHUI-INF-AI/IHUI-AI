// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test, expect } from './fixtures'

/**
 * 号池管理页「安装桌面切号」按钮 —— 真实浏览器端到端契约(2026-11-15 立,AGENTS §17)。
 *
 * 契约两端:
 *   - 前端:apps/web/app/(main)/admin/relay/account-pool/page.tsx 页头工具条按钮,
 *     点击 POST /api/admin/relay/desktop-shortcut/install;
 *   - 后端:apps/api relay-account-pool.ts 路由 32 → relay-desktop-shortcut.ts
 *     驱动 pwsh 跑仓内唯一真相源安装器 scripts/install-relay-shortcut.ps1。
 *
 * 平台两分支都是**契约的一部分**(同机边界与「登录本机」一致):
 *   - win32(api 宿主 = 有桌面的机器):200 + installed[] 真实落档,toast 回显;
 *   - 其它(CI linux runner:没有桌面可装):409 + 点名出路,绝不冒充成功。
 * 无 skip、无固定 sleep:全部锚定请求/页面自身状态(门 311 口径)。
 */
const IS_WIN32 = process.platform === 'win32'
const INSTALL_URL = '/api/admin/relay/desktop-shortcut/install'

test.describe('号池管理页 · 桌面一键切号快捷方式按钮', () => {
  test('按钮渲染且接口按平台给出诚实回包(win32 落档 / 其余 409 点名出路)', async ({
    adminPage,
  }) => {
    await adminPage.goto('/admin/relay/account-pool')
    await expect(adminPage.getByRole('heading', { name: /账号池管理/ })).toBeVisible({
      timeout: 120_000,
    })
    const btn = adminPage.getByRole('button', { name: /安装桌面切号/ })
    await expect(btn).toBeVisible({ timeout: 120_000 })

    const respPromise = adminPage
      .waitForResponse((r) => r.url().includes(INSTALL_URL), { timeout: 90_000 })
      .then(async (r) => ({ status: r.status(), body: await r.json() }))

    await btn.click()
    const { status, body } = await respPromise

    if (IS_WIN32) {
      // 装的是真实桌面(幂等覆盖同名 .lnk);证据链 = 回包路径 + toast 文案,不各自 sleep。
      expect(status).toBe(200)
      expect(body.code).toBe(0)
      const links: string[] = (body.data?.installed ?? []).map((s: { link: string }) => s.link)
      expect(links.length).toBeGreaterThan(0)
      expect(links.some((l) => l.endsWith('AI 客户端一键切号.lnk'))).toBe(true)
      await expect(
        adminPage.locator('[data-sonner-toast]').filter({ hasText: /快捷方式/ }),
      ).toBeVisible({ timeout: 60_000 })
    } else {
      // 非 win32:接口必须 409 并给出可执行出路(等人工在目标机双击 cmd)。
      expect(status).toBe(409)
      expect(String(body.message)).toContain('install-relay-shortcut.cmd')
      await expect(
        adminPage.locator('[data-sonner-toast]').filter({ hasText: /安装失败/ }),
      ).toBeVisible({ timeout: 60_000 })
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
