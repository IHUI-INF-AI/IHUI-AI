// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { setupTest as test, expect } from './fixtures'
import type { Page } from '@playwright/test'

/**
 * 教育各页的接口健康对账(2026-09-29)。
 *
 * 为什么不测 UI 文案:那批页走 `useTranslations`,文案改了测试就红 —— 那是测翻译不是测功能。
 * 为什么测接口状态码:本轮真实修掉的两个缺陷恰好都是"页面渲染正常、数据请求失败"型 ——
 * 「学费标准」tab 因 `/tuition-standard` 没注册读侧别名而 404(但新增能成功,所以看起来"像权限问题"),
 * 以及弹窗把 `pageSize=200` 发过去被 zod 拒成 400(表现为"下拉是空的",没有任何错误提示)。
 * 这两种在页面上都不报错,只有看响应码才发现 —— 正是本仓说的"错误被静默吞掉"那一型。
 *
 * 断言范围:只收 `/api/edu-ai-management/` 与 `/api/admin/` 下的请求;
 * 401 视为登录态问题(机器态,skip 而非判红),其余 4xx/5xx 一律收集并判红。
 */
const PAGES = [
  { path: '/edu/edu-management/schedule', label: '排课' },
  { path: '/edu/edu-management/finance', label: '财务' },
  { path: '/edu/edu-management/class', label: '班级' },
]

test.describe('教育页接口健康', () => {
  for (const p of PAGES) {
    test(`${p.label}页的数据请求不得出现 4xx/5xx`, async ({ adminPage: page }: { adminPage: Page }) => {
      test.setTimeout(90_000)
      const bad: string[] = []
      let unauthorized = 0
      page.on('response', (r) => {
        const u = r.url()
        if (!(u.includes('/api/edu-ai-management/') || u.includes('/api/admin/'))) return
        const s = r.status()
        if (s === 401) {
          unauthorized += 1
          return
        }
        if (s >= 400) bad.push(`${s} ${u.replace(/^https?:\/\/[^/]+/, '')}`)
      })
      await page.goto(p.path, { waitUntil: 'domcontentloaded' })
      if (page.url().includes('login')) {
        test.skip(true, `LOGIN_STATE_EXPIRED:被重定向到 ${page.url()}(机器态,非页面缺陷)`)
        return
      }
      // 等一轮取数完成(该页取数后才渲染面板,过早断言会漏掉请求)
      await page.waitForTimeout(8000)
      // 财务页要切到「缴费记录」面板才会发那批请求
      const tab = page.getByRole('tab', { name: '缴费记录' })
      if ((await tab.count()) > 0) {
        await tab.first().click().catch(() => {})
        await page.waitForTimeout(4000)
      }
      // 本机常见环境态:8801/8802 是并发会话起的 dev 进程,代码可能落后于 HEAD。
      // 已知一例 —— HEAD 已注册 `/tuition-standard` 与 `/refund` 的读侧别名,
      // 而未重启的 api 进程仍会对这两个路径回 404。这不是仓库缺陷,但**不因此放宽断言**
      // (放宽就等于把真回归一起放行);改成把排查顺序写进失败信息。
      expect(
        bad,
        `${p.label}页存在失败请求(admin 登录态下 4xx/5xx 即契约断链):${bad.join(' | ')}\n` +
          '排查第一步:确认 8802 那个 api 进程是否已重启到当前 HEAD —— ' +
          'dev 进程长期不重启时,已修的读侧别名/新端点会以 404 形态出现(实测踩过)。' +
          '私有实例三臂对照可判真伪:新端点 401 / 已知端点 401 / 假路径 404。',
      ).toEqual([])
      if (unauthorized > 0) console.log(`NOTE ${p.label}: ${unauthorized} 个 401(登录态相关,未计失败)`)
    })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
