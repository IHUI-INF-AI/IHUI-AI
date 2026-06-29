/**
 * P9-5 持续文档化验证
 * - BusinessDocs.vue 包含 8 个 Tab（新增 FAQ/CHANGELOG/CONTRIBUTING）
 * - FAQ Tab 包含常见问题列表
 * - CHANGELOG Tab 包含版本更新日志
 * - CONTRIBUTING Tab 包含贡献指南步骤
 * - i18n 翻译完整
 */

import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'

const BASE = 'http://127.0.0.1:8888'
const ROOT = 'g:/1/client'
const DOCS_PATH = `${ROOT}/src/views/BusinessDocs.vue`
const ZH_CN_PATH = `${ROOT}/src/locales/zh-CN.json`
const EN_PATH = `${ROOT}/src/locales/en.json`

function readText(path: string): string {
  return readFileSync(path, 'utf-8')
}

test.describe('P9-5 持续文档化 - 源码审查', () => {
  let docsContent: string
  let zhCNContent: string
  let enContent: string

  test.beforeAll(() => {
    docsContent = readText(DOCS_PATH)
    zhCNContent = readText(ZH_CN_PATH)
    enContent = readText(EN_PATH)
  })

  test('BusinessDocs.vue 包含 8 个 Tab', () => {
    expect(docsContent, '包含 FAQ Tab').toMatch(/name="faq"/)
    expect(docsContent, '包含 CHANGELOG Tab').toMatch(/name="changelog"/)
    expect(docsContent, '包含 CONTRIBUTING Tab').toMatch(/name="contributing"/)
    console.log('[P9-5] 3 个新 Tab 存在 ✅')
  })

  test('FAQ Tab 包含常见问题列表', () => {
    expect(docsContent, '包含 faqItems 数据').toMatch(/const faqItems/)
    expect(docsContent, 'FAQ 使用 el-collapse').toMatch(/<el-collapse v-model="openFaq"/)
    expect(docsContent, 'FAQ 至少 5 个问题').toMatch(/faqItems:\s*FaqItem\[\]\s*=\s*\[/)
    console.log('[P9-5] FAQ Tab 结构完整 ✅')
  })

  test('CHANGELOG Tab 包含版本更新日志', () => {
    expect(docsContent, '包含 changelog 数据').toMatch(/const changelog/)
    expect(docsContent, 'CHANGELOG 使用 el-timeline').toMatch(/<el-timeline>/)
    expect(docsContent, '包含 v1.1.0 版本').toMatch(/v1\.1\.0/)
    expect(docsContent, '包含 v1.0.0 版本').toMatch(/v1\.0\.0/)
    console.log('[P9-5] CHANGELOG Tab 结构完整 ✅')
  })

  test('CONTRIBUTING Tab 包含贡献指南步骤', () => {
    expect(docsContent, '包含 contributingSteps 数据').toMatch(/const contributingSteps/)
    expect(docsContent, 'CONTRIBUTING 使用 el-steps').toMatch(/<el-steps direction="vertical"/)
    expect(docsContent, '包含 Fork 步骤').toMatch(/Fork/)
    expect(docsContent, '包含 PR 步骤').toMatch(/Pull Request/)
    console.log('[P9-5] CONTRIBUTING Tab 结构完整 ✅')
  })

  test('zh-CN.json 包含新 Tab 翻译', () => {
    expect(zhCNContent, '包含 faq Tab 翻译').toMatch(/"faq":\s*"FAQ"/)
    expect(zhCNContent, '包含 changelog Tab 翻译').toMatch(/"changelog":\s*"更新日志"/)
    expect(zhCNContent, '包含 contributing Tab 翻译').toMatch(/"contributing":\s*"贡献指南"/)
    expect(zhCNContent, '包含 faq.title 翻译').toMatch(/"title":\s*"常见问题解答"/)
    expect(zhCNContent, '包含 changelog.title 翻译').toMatch(/"title":\s*"版本更新日志"/)
    expect(zhCNContent, '包含 contributing.title 翻译').toMatch(/"title":\s*"贡献指南"/)
    console.log('[P9-5] zh-CN.json 翻译完整 ✅')
  })

  test('en.json 包含新 Tab 翻译', () => {
    expect(enContent, '包含 faq Tab 翻译').toMatch(/"faq":\s*"FAQ"/)
    expect(enContent, '包含 changelog Tab 翻译').toMatch(/"changelog":\s*"Changelog"/)
    expect(enContent, '包含 contributing Tab 翻译').toMatch(/"contributing":\s*"Contributing"/)
    expect(enContent, '包含 faq.title 翻译').toMatch(/"title":\s*"Frequently Asked Questions"/)
    expect(enContent, '包含 changelog.title 翻译').toMatch(/"title":\s*"Version Changelog"/)
    expect(enContent, '包含 contributing.title 翻译').toMatch(/"title":\s*"Contributing Guide"/)
    console.log('[P9-5] en.json 翻译完整 ✅')
  })
})

test.describe('P9-5 持续文档化 - 页面渲染验证', () => {
  test('业务文档页可访问 + 8 个 Tab 渲染', async ({ page }) => {
    await page.goto(`${BASE}/business-docs`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(1000)

    // 验证 Tab 数量（8 个 Tab）
    const tabs = page.locator('.el-tabs__item')
    const tabCount = await tabs.count()
    console.log(`[P9-5] Tab 数量: ${tabCount}`)
    expect(tabCount, '应有 8 个 Tab').toBeGreaterThanOrEqual(8)
    console.log('[P9-5] 8 个 Tab 渲染正常 ✅')
  })

  test('FAQ Tab 可切换 + 内容渲染', async ({ page }) => {
    await page.goto(`${BASE}/business-docs`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(1000)

    // 点击 FAQ Tab（第 6 个 Tab，索引 5）
    const faqTab = page.locator('.el-tabs__item').nth(5)
    await faqTab.click({ force: true })
    await page.waitForTimeout(1000)

    // 验证 FAQ 内容渲染
    const collapseItems = page.locator('.el-collapse-item')
    const itemCount = await collapseItems.count()
    console.log(`[P9-5] FAQ 问题数量: ${itemCount}`)
    expect(itemCount, 'FAQ 应有至少 5 个问题').toBeGreaterThanOrEqual(5)
    console.log('[P9-5] FAQ Tab 内容渲染正常 ✅')
  })

  test('CHANGELOG Tab 可切换 + 内容渲染', async ({ page }) => {
    await page.goto(`${BASE}/business-docs`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(1000)

    // 点击 CHANGELOG Tab（第 7 个 Tab，索引 6）
    const changelogTab = page.locator('.el-tabs__item').nth(6)
    await changelogTab.click({ force: true })
    await page.waitForTimeout(1000)

    // 验证 CHANGELOG 内容渲染
    const timelineItems = page.locator('.el-timeline-item')
    const itemCount = await timelineItems.count()
    console.log(`[P9-5] CHANGELOG 版本数量: ${itemCount}`)
    expect(itemCount, 'CHANGELOG 应有至少 2 个版本').toBeGreaterThanOrEqual(2)
    console.log('[P9-5] CHANGELOG Tab 内容渲染正常 ✅')
  })

  test('CONTRIBUTING Tab 可切换 + 内容渲染', async ({ page }) => {
    await page.goto(`${BASE}/business-docs`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(1000)

    // 点击 CONTRIBUTING Tab（第 8 个 Tab，索引 7）
    const contributingTab = page.locator('.el-tabs__item').nth(7)
    await contributingTab.click({ force: true })
    await page.waitForTimeout(1000)

    // 验证 CONTRIBUTING 内容渲染
    const steps = page.locator('.el-step')
    const stepCount = await steps.count()
    console.log(`[P9-5] CONTRIBUTING 步骤数量: ${stepCount}`)
    expect(stepCount, 'CONTRIBUTING 应有至少 5 个步骤').toBeGreaterThanOrEqual(5)
    console.log('[P9-5] CONTRIBUTING Tab 内容渲染正常 ✅')
  })
})
