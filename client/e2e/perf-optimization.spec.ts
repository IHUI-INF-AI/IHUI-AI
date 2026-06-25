/**
 * P9-2 性能深度优化 - chunk 拆分验证
 * - vite.config.ts manualChunks 将 vue-office 拆分为 5 个子模块
 * - modulePreload exclude 列表已更新为子模块名
 * - 生产构建产物包含拆分后的 chunk 文件
 * - 首屏 HTML 不预加载 vue-office 子模块
 */

import { test, expect } from '@playwright/test'
import { readFileSync, readdirSync } from 'fs'
import { join, dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

// 2026-06-25 修复: 改用脚本自身位置计算 client 根, 避免硬编码 g:/1/client
// client/e2e/perf-optimization.spec.ts -> ../../ (项目 client 根)
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..')

const BASE_PROD = 'http://127.0.0.1:4173'
const VITE_CONFIG_PATH = `${ROOT}/vite.config.ts`
const DIST_JS_DIR = `${ROOT}/dist/web/assets/js`

function readText(path: string): string {
  return readFileSync(path, 'utf-8')
}

function listJsFiles(): string[] {
  try {
    return readdirSync(DIST_JS_DIR)
  } catch (e) {
    return []
  }
}

test.describe('P9-2 性能深度优化 - 源码审查', () => {
  let viteConfig: string

  test.beforeAll(() => {
    viteConfig = readText(VITE_CONFIG_PATH)
  })

  test('vite.config.ts manualChunks 拆分 vue-office 为 5 个子模块', () => {
    expect(viteConfig, '含 @vue-office 判断').toMatch(/id\.includes\(['"]@vue-office['"]\)/)
    expect(viteConfig, '含 docx 拆分').toMatch(/vue-office-docx/)
    expect(viteConfig, '含 excel 拆分').toMatch(/vue-office-excel/)
    expect(viteConfig, '含 presentation 拆分').toMatch(/vue-office-presentation/)
    expect(viteConfig, '含 pdf 拆分').toMatch(/vue-office-pdf/)
    expect(viteConfig, '含 core 拆分').toMatch(/vue-office-core/)
    console.log('[P9-2] manualChunks vue-office 拆分 5 个子模块 ✅')
  })

  test('vite.config.ts modulePreload exclude 列表已更新', () => {
    expect(viteConfig, '排除 vue-office-docx').toMatch(/'vue-office-docx'/)
    expect(viteConfig, '排除 vue-office-excel').toMatch(/'vue-office-excel'/)
    expect(viteConfig, '排除 vue-office-presentation').toMatch(/'vue-office-presentation'/)
    expect(viteConfig, '排除 vue-office-pdf').toMatch(/'vue-office-pdf'/)
    expect(viteConfig, '排除 vue-office-core').toMatch(/'vue-office-core'/)
    console.log('[P9-2] modulePreload exclude 列表已更新 ✅')
  })

  test('vite.config.ts 不再使用单一 vue-office exclude', () => {
    const excludeBlock = viteConfig.match(/const exclude = \[[\s\S]*?\]/)
    expect(excludeBlock, 'exclude 块存在').toBeTruthy()
    if (excludeBlock) {
      const block = excludeBlock[0]
      // 不应包含独立的 'vue-office'（应被 5 个子模块替代）
      const hasStandaloneVueOffice = /'vue-office'(?!-)/.test(block)
      expect(hasStandaloneVueOffice, '不应有独立 vue-office exclude').toBe(false)
    }
    console.log('[P9-2] 已移除单一 vue-office exclude ✅')
  })
})

test.describe('P9-2 性能深度优化 - 生产构建产物', () => {
  let jsFiles: string[]

  test.beforeAll(() => {
    jsFiles = listJsFiles()
  })

  test('生产构建产物包含 vue-office 拆分 chunk', () => {
    const docxFiles = jsFiles.filter((f) => f.startsWith('vue-office-docx'))
    const excelFiles = jsFiles.filter((f) => f.startsWith('vue-office-excel'))
    const coreFiles = jsFiles.filter((f) => f.startsWith('vue-office-core'))

    expect(docxFiles.length, '存在 vue-office-docx chunk').toBeGreaterThan(0)
    expect(excelFiles.length, '存在 vue-office-excel chunk').toBeGreaterThan(0)
    expect(coreFiles.length, '存在 vue-office-core chunk').toBeGreaterThan(0)
    console.log(`[P9-2] 拆分 chunk: docx=${docxFiles.length}, excel=${excelFiles.length}, core=${coreFiles.length} ✅`)
  })

  test('生产构建产物不再有单一 vue-office chunk', () => {
    const standaloneVueOffice = jsFiles.filter(
      (f) => f.startsWith('vue-office-') === false && f.startsWith('vue-office') && !f.includes('-docx') && !f.includes('-excel') && !f.includes('-presentation') && !f.includes('-pdf') && !f.includes('-core')
    )
    expect(standaloneVueOffice.length, '不应有单一 vue-office chunk').toBe(0)
    console.log('[P9-2] 无单一 vue-office chunk ✅')
  })

  test('vue-office-excel chunk 大小合理（< 2MB）', () => {
    const excelFiles = jsFiles.filter((f) => f.startsWith('vue-office-excel'))
    if (excelFiles.length === 0) {
      console.log('[P9-2] vue-office-excel chunk 不存在，跳过大小检查')
      return
    }
    const excelPath = join(DIST_JS_DIR, excelFiles[0])
    const stat = readFileSync(excelPath)
    const sizeMB = stat.length / (1024 * 1024)
    expect(sizeMB, `vue-office-excel 大小 ${sizeMB.toFixed(2)}MB < 2MB`).toBeLessThan(2)
    console.log(`[P9-2] vue-office-excel chunk 大小: ${sizeMB.toFixed(2)}MB ✅`)
  })

  test('vue-office-core chunk 大小合理（< 1.5MB）', () => {
    const coreFiles = jsFiles.filter((f) => f.startsWith('vue-office-core'))
    if (coreFiles.length === 0) {
      console.log('[P9-2] vue-office-core chunk 不存在，跳过大小检查')
      return
    }
    const corePath = join(DIST_JS_DIR, coreFiles[0])
    const stat = readFileSync(corePath)
    const sizeMB = stat.length / (1024 * 1024)
    expect(sizeMB, `vue-office-core 大小 ${sizeMB.toFixed(2)}MB < 1.5MB`).toBeLessThan(1.5)
    console.log(`[P9-2] vue-office-core chunk 大小: ${sizeMB.toFixed(2)}MB ✅`)
  })
})

test.describe('P9-2 性能深度优化 - 首屏预加载验证', () => {
  test('首页 HTML 不预加载 vue-office 子模块', async ({ page }) => {
    await page.goto(`${BASE_PROD}/`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle')

    // 等待 DOM 稳定后获取 HTML
    await page.waitForTimeout(500)
    const html = await page.content()
    const modulepreloadLinks = html.match(/<link[^>]*rel="modulepreload"[^>]*>/g) || []

    const vueOfficePreloads = modulepreloadLinks.filter((link) =>
      link.includes('vue-office-docx') ||
      link.includes('vue-office-excel') ||
      link.includes('vue-office-presentation') ||
      link.includes('vue-office-pdf') ||
      link.includes('vue-office-core')
    )

    expect(vueOfficePreloads.length, '首屏不应预加载 vue-office 子模块').toBe(0)
    console.log(`[P9-2] 首屏 modulepreload 数量: ${modulepreloadLinks.length}, vue-office 预加载数量: ${vueOfficePreloads.length} ✅`)
  })

  test('首页加载性能 - 关键资源数量合理', async ({ page }) => {
    const resourceRequests: string[] = []

    page.on('request', (req) => {
      const url = req.url()
      if (url.includes('/assets/js/') || url.includes('/assets/css/')) {
        resourceRequests.push(url)
      }
    })

    await page.goto(`${BASE_PROD}/`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    console.log(`[P9-2] 首页加载 JS/CSS 资源数量: ${resourceRequests.length}`)
    // 首页包含 i18n、Element Plus、路由预加载等，资源数量在 150 以内为合理
    expect(resourceRequests.length, '首页资源数量 < 150').toBeLessThan(150)
  })
})
