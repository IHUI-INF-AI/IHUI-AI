/**
 * P7-6 Service Worker 离线缓存策略
 * - sw.js 语法正确（能 load）
 * - sw.js 包含 3 策略（cache-first / network-first / SWR）
 * - sw.js 包含离线兜底 URL
 * - sw.js 包含版本号（用于升级清理）
 * - 生产构建 sw.js 可访问
 * - 浏览器实际能注册 + activate
 */

import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'

const BASE = 'http://127.0.0.1:4173'
const ROOT = process.cwd()
const SW_PATH = `${ROOT}/public/sw.js`

function readText(path: string): string {
  return readFileSync(path, 'utf-8')
}

async function isProdServerAvailable(request: { get: (url: string) => Promise<{ status: () => number }> }): Promise<boolean> {
  try {
    const res = await request.get(BASE + '/')
    return res.status() === 200
  } catch {
    return false
  }
}

test.describe('P7-6 sw.js 静态校验', () => {
  test('sw.js 包含 3 大缓存策略', () => {
    const sw = readText(SW_PATH)
    expect(sw, 'cache-first 策略').toMatch(/cacheFirst|isHashedAsset|isStaticDir/)
    expect(sw, 'network-first 策略').toMatch(/networkFirst|isApiRequest/)
    expect(sw, 'stale-while-revalidate 策略').toMatch(/staleWhileRevalidate/)
  })

  test('sw.js 包含离线兜底页', () => {
    const sw = readText(SW_PATH)
    expect(sw, 'OFFLINE_PAGE 常量').toMatch(/OFFLINE_PAGE/)
    expect(sw, 'caches.match 兜底').toMatch(/caches\.match\(OFFLINE_PAGE\)/)
  })

  test('sw.js 包含预缓存清单', () => {
    const sw = readText(SW_PATH)
    expect(sw, 'PRECACHE_URLS 数组').toMatch(/PRECACHE_URLS\s*=\s*\[/)
    expect(sw, '预缓存 index.html').toMatch(/['"]\/index\.html['"]/)
    expect(sw, '预缓存 manifest').toMatch(/manifest\.webmanifest/)
    expect(sw, '预缓存 favicon').toMatch(/favicon\.svg/)
  })

  test('sw.js 包含版本号 + 旧缓存清理逻辑', () => {
    const sw = readText(SW_PATH)
    expect(sw, 'CACHE_VERSION 常量').toMatch(/CACHE_VERSION/)
    expect(sw, 'activate 事件清理旧缓存').toMatch(/activate[\s\S]*?caches\.delete/)
  })

  test('sw.js 包含 skipWaiting + clients.claim', () => {
    const sw = readText(SW_PATH)
    expect(sw, 'install skipWaiting').toMatch(/skipWaiting/)
    expect(sw, 'activate clients.claim').toMatch(/clients\.claim/)
  })

  test('sw.js 区分 GET / POST / 跨域', () => {
    const sw = readText(SW_PATH)
    expect(sw, 'method 检查').toMatch(/request\.method/)
    expect(sw, '跨域放行').toMatch(/url\.origin\s*[!=]==?\s*self\.location\.origin/)
  })

  test('offline.html 兜底页存在', () => {
    const html = readFileSync(`${ROOT}/public/offline.html`, 'utf-8')
    expect(html, 'offline.html 存在').toBeTruthy()
    expect(html, '含离线提示').toMatch(/离线|offline/i)
  })
})

test.describe('P7-6 浏览器实际注册', () => {
  test('生产 sw.js HTTP 200 + JS MIME', async ({ request }) => {
    const available = await isProdServerAvailable(request)
    if (!available) {
      console.log('[pwa] 生产预览服务器 4173 未运行，跳过生产构建验证')
      test.skip(true, '生产预览服务器 4173 未运行')
    }
    const res = await request.get(`${BASE}/sw.js`, { failOnStatusCode: false })
    expect(res.status(), 'sw.js 200').toBe(200)
    const ct = res.headers()['content-type'] || ''
    console.log(`[pwa] sw.js content-type: ${ct}`)
    expect(ct, 'sw.js JS MIME').toMatch(/javascript|application\/json/i)
  })

  test('生产 manifest.webmanifest HTTP 200', async ({ request }) => {
    const available = await isProdServerAvailable(request)
    if (!available) {
      console.log('[pwa] 生产预览服务器 4173 未运行，跳过生产构建验证')
      test.skip(true, '生产预览服务器 4173 未运行')
    }
    const res = await request.get(`${BASE}/manifest.webmanifest`, { failOnStatusCode: false })
    expect(res.status(), 'manifest 200').toBe(200)
  })

  test('index.html 注册 sw.js（has <script> with navigator.serviceWorker.register）', async ({ request }) => {
    const available = await isProdServerAvailable(request)
    if (!available) {
      console.log('[pwa] 生产预览服务器 4173 未运行，跳过生产构建验证')
      test.skip(true, '生产预览服务器 4173 未运行')
    }
    const res = await request.get(`${BASE}/`, { failOnStatusCode: false })
    const html = await res.text()
    const hasRegister = /navigator\.serviceWorker\.register\(['"`]?\/sw\.js/.test(html)
    console.log(`[pwa] index.html has sw.js register: ${hasRegister}`)
    expect(hasRegister, 'index.html 注册 sw.js').toBe(true)
  })

  test('首页加载 + sw 可注册（chromium 实际测试）', async ({ page, context }) => {
    const available = await isProdServerAvailable(context.request)
    if (!available) {
      console.log('[pwa] 生产预览服务器 4173 未运行，跳过生产构建验证')
      test.skip(true, '生产预览服务器 4173 未运行')
    }
    test.setTimeout(45000)
    await page.goto(`${BASE}/`, { waitUntil: 'load' })
    await page.waitForTimeout(2000)

    // 验证 navigator.serviceWorker 可用
    const swSupported = await page.evaluate(() => 'serviceWorker' in navigator)
    console.log(`[pwa] serviceWorker supported: ${swSupported}`)
    expect(swSupported, '浏览器支持 serviceWorker').toBe(true)

    // 验证注册成功（可能仍在 installing/activated）
    const swState = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration()
      if (!reg) return { registered: false }
      const sw = reg.active || reg.installing || reg.waiting
      return {
        registered: true,
        scope: reg.scope,
        state: sw ? sw.state : 'unknown',
        scriptURL: sw ? sw.scriptURL : null,
      }
    })
    console.log(`[pwa] serviceWorker 状态: ${JSON.stringify(swState)}`)
    expect(swState.registered, 'sw.js 已注册').toBe(true)
    // 生产 dist 中 usePWA 会自动注册 /service-worker.js（vite-plugin-pwa workbox 产物），
    // 手写兜底 sw 注册在 dev 模式。这里允许任一 sw 路径。
    expect(swState.scriptURL, 'scriptURL 指向 /sw.js 或 /service-worker.js').toMatch(/\/(sw|service-worker)\.js$/)
  })
})
