/* eslint-disable */
// 批量测试关键页面,捕获 console error / page error / network 失败
// 用法: PLAYWRIGHT_BASE_URL=http://localhost:3100 npx tsx scripts/bug-scan.ts
import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8801'
const PAGES = [
  '/',
  '/sso/login',
  '/sso/register',
  '/plaza',
  '/chat',
  '/news',
  '/asks',
  '/agents',
  '/agents/123',
  '/ai-world',
  '/ai-career',
  '/bi-dashboard',
  '/workspace',
  '/admin/user-center',
  '/settings',
  '/user/profile',
  '/orders',
  '/orders/123',
  '/admin',
  '/admin/users',
  '/admin/dict',
  '/admin/news',
  '/admin/menu',
  '/admin/role',
  '/admin/sms',
  '/admin/oss',
  '/forbidden',
]

interface Bug {
  url: string
  status: number | null
  consoleErrors: string[]
  pageErrors: string[]
  failedRequests: string[]
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext()
  const bugs: Bug[] = []

  for (const path of PAGES) {
    const url = `${BASE}${path}`
    const page = await ctx.newPage()
    const consoleErrors: string[] = []
    const pageErrors: string[] = []
    const failedRequests: string[] = []
    let status: number | null = null

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    page.on('pageerror', (err) => pageErrors.push(err.message))
    page.on('response', (resp) => {
      status = resp.status()
      if (resp.status() >= 500) failedRequests.push(`${resp.status()} ${resp.url()}`)
    })
    page.on('requestfailed', (req) => {
      failedRequests.push(`FAILED ${req.url()} (${req.failure()?.errorText})`)
    })

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
    } catch (e) {
      pageErrors.push((e as Error).message)
    }

    if (consoleErrors.length || pageErrors.length || failedRequests.length) {
      bugs.push({ url: path, status, consoleErrors, pageErrors, failedRequests })
    }

    await page.close()
  }

  await browser.close()

  const report = bugs
    .map(
      (b) =>
        `### ${b.url} (status=${b.status ?? '??'})\n` +
        (b.pageErrors.length
          ? `PageErrors:\n${b.pageErrors.map((e) => `  - ${e}`).join('\n')}\n`
          : '') +
        (b.consoleErrors.length
          ? `ConsoleErrors:\n${b.consoleErrors.map((e) => `  - ${e.substring(0, 200)}`).join('\n')}\n`
          : '') +
        (b.failedRequests.length
          ? `FailedRequests:\n${b.failedRequests.map((e) => `  - ${e}`).join('\n')}\n`
          : ''),
    )
    .join('\n---\n\n')

  writeFileSync(
    resolve(__dirname, '../scan-report.md'),
    `# 扫描报告\n\n测试 base: ${BASE}\n共扫描 ${PAGES.length} 页\n发现 ${bugs.length} 页有错误\n\n${report || '(无错误)'}`,
  )
  console.log(`\n✅ 报告已写入 scan-report.md (${bugs.length}/${PAGES.length} 页有错误)`)
  console.log(report)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
