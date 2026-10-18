// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// E2E:API 登录(httpOnly cookie 注入浏览器上下文)→ /admin/monitor/panels 渲染验证截图
// 凭据只从 secrets 文件读入内存,不落盘、不打印
import fs from 'node:fs'
import { createRequire } from 'node:module'
// 全局 npm 目录的 playwright(ESM 不吃 NODE_PATH,createRequire 走 CJS 解析)
const require2 = createRequire(import.meta.url)
const { chromium } = require2(process.env.APPDATA + '/npm/node_modules/playwright')

const password = fs.readFileSync('D:/DevEnv/secrets/admin-password.txt', 'utf8').trim()
const BASE = 'http://127.0.0.1:8801'
const OUT = 'D:/IHUI-AI/.ihui-agent/tmp'

;(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'D:/DevEnv/cache/playwright/chromium-1223/chrome-win64/chrome.exe' })
  const context = await browser.newContext({ viewport: { width: 1680, height: 950 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 150)))

  // 1. 同源 API 登录 ⇒ Set-Cookie auth_token 自动落入浏览器上下文(与 UI 登录同一端点)
  const login = await context.request.post(`${BASE}/api/auth/login/username`, {
    data: { username: 'admin', password },
    headers: { 'content-type': 'application/json' },
  })
  const loginBody = await login.json().catch(() => ({}))
  console.log('API-LOGIN', login.status(), loginBody?.data?.user?.username ?? JSON.stringify(loginBody).slice(0, 120))
  const token = loginBody?.data?.accessToken
  if (!token) throw new Error('no accessToken in login response')
  // use-auth-bootstrap 2026-08-26 修复路径:非 httpOnly 的 auth_token 会被 getAuthCookie()
  // 直接恢复成 store token ⇒ 客户端登录态完整(httpOnly:true 则 JS 读不到,只会弹登录框)
  await context.addCookies([
    { name: 'auth_token', value: token, domain: '127.0.0.1', path: '/', httpOnly: false, sameSite: 'Lax' },
  ])
  console.log('COOKIE-SET')

  // 2. 直达监控面板页
  await page.goto(`${BASE}/admin/monitor/panels`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  console.log('URL', page.url())
  await page.waitForTimeout(9000) // 配置 chunk + 首盘批量查询 + 图表渲染
  await page.screenshot({ path: `${OUT}/e2e-03-panels.png` })
  const canvases = await page.locator('canvas').count()
  const bodyText = await page.locator('body').innerText()
  console.log('CANVAS-COUNT', canvases)
  console.log('HAS-TITLE', /监控大屏/.test(bodyText))
  console.log('HAS-NODATA', /暂无数据/.test(bodyText))
  console.log('PAGE-ERRORS', errors.length, errors.slice(0, 3))

  // 3. 切到「Agent 与工具链路」盘验证切盘 + Loki 日志盘验证 ANSI 剥离
  const nav = page.locator('aside button', { hasText: 'Agent 与工具链路' }).first()
  if (await nav.count()) {
    await nav.click()
    await page.waitForTimeout(6000)
    await page.screenshot({ path: `${OUT}/e2e-04-agent-dash.png` })
    console.log('SWITCH-OK')
  }
  const logsNav = page.locator('aside button', { hasText: '智能体与模型日志' }).first()
  if (await logsNav.count()) {
    await logsNav.click()
    await page.waitForTimeout(6000)
    await page.screenshot({ path: `${OUT}/e2e-05-logs-dash.png` })
    console.log('LOGS-OK')
  }
  // 3.5 新增四盘抽查(2026-10-19 覆盖率补齐:主机/隧道/日志栈/应用运行时)
  for (const [name, shot] of [
    ['Windows 宿主机', 'e2e-07-windows-host'],
    ['公网隧道', 'e2e-08-cloudflared'],
    ['日志栈', 'e2e-09-log-stack'],
    ['应用层黄金指标', 'e2e-10-app-golden'],
    ['深度链路', 'e2e-11-ai-deep-pipeline'],
  ]) {
    const navItem = page.locator('aside button', { hasText: name }).first()
    if (!(await navItem.count())) { console.log('NEWDASH-NAV-MISS', name); continue }
    await navItem.click()
    await page.waitForTimeout(8000)
    await page.screenshot({ path: `${OUT}/${shot}.png` })
    const txt = await page.locator('body').innerText()
    console.log('NEWDASH', name, 'cards=', await page.locator('.rounded-lg.border').count(), 'nodata=', /暂无数据/.test(txt))
  }

  // 4. SaaS 租户监控页:GrafanaFrame 原生替身(2026-10-18 退役收尾)
  //    判据:页面无指向 Grafana 的 iframe,且有真实渲染出的图表/面板
  await page.goto(`${BASE}/admin/saas/metrics`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  // 该盘 8 面板需等首个 96 条批量查询返回(实测 8~10s);用面板标题作为就绪信号,
  // 9s 硬等会在冷启动时误抓到瞬时错误态(2026-10-19 实测)
  await page.waitForSelector('text=活跃租户数', { timeout: 25_000 }).catch(() => {})
  await page.waitForTimeout(3000)
  await page.screenshot({ path: `${OUT}/e2e-06-saas-metrics.png` })
  const frames = await page.locator('iframe').count()
  const grafanaFrames = await page.locator('iframe[src*="grafana"], iframe[src*="8816"]').count()
  const saasText = await page.locator('body').innerText()
  console.log('SAAS-URL', page.url())
  console.log('SAAS-IFRAME-COUNT', frames, 'GRAFANA-IFRAME', grafanaFrames)
  // 该盘 21 面板里大部分是 stat/table 类(数字/表格,无 canvas) ⇒ 以面板标题与
  // 降级提示判据替代 canvas 计数;'Grafana' 字样已从可见文案清空(i18n 改为原生面板)
  const saasPanels = await page.locator('[data-panel-title], .rounded-lg.border').count()
  console.log('SAAS-CANVAS', await page.locator('canvas').count(), 'SAAS-CARDS', saasPanels, 'SAAS-PANEL-TITLES', /活跃租户数|租户 API 调用总数/.test(saasText))
  console.log('SAAS-HAS-GRAFANA-WORD', /Grafana/.test(saasText), 'SAAS-HAS-UNAVAILABLE-HINT', /监控服务不可用/.test(saasText))
  await browser.close()
})().catch((e) => {
  console.error('E2E-FAIL', String(e).slice(0, 300))
  process.exit(1)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
