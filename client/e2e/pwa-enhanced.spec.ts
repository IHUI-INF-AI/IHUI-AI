/**
 * P9-1 PWA 增强（Background Sync + Push + Share Target）
 * - sw.js 包含 Background Sync 逻辑（enqueueRequest / replayQueue / sync 事件）
 * - sw.js 包含 Push 事件处理（showNotification）
 * - sw.js 包含 notificationclick 事件
 * - sw.js 包含 Web Share Target 处理（/share-target）
 * - manifest.webmanifest 包含 share_target 字段
 * - sw.js 版本号升级到 v1.1.0
 */

import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'

const BASE_PROD = 'http://127.0.0.1:4173'
const ROOT = process.cwd()
const SW_PATH = `${ROOT}/public/sw.js`
const MANIFEST_PATH = `${ROOT}/public/manifest.webmanifest`

function readText(path: string): string {
  return readFileSync(path, 'utf-8')
}

async function isProdServerAvailable(request: { get: (url: string) => Promise<{ status: () => number }> }): Promise<boolean> {
  try {
    const res = await request.get(BASE_PROD + '/')
    return res.status() === 200
  } catch {
    return false
  }
}

test.describe('P9-1 PWA 增强 - 源码审查', () => {
  let swContent: string
  let manifestContent: string

  test.beforeAll(() => {
    swContent = readText(SW_PATH)
    manifestContent = readText(MANIFEST_PATH)
  })

  test('sw.js 版本号升级到 v1.1.0', () => {
    expect(swContent, '含 v1.1.0').toMatch(/CACHE_VERSION\s*=\s*['"]v1\.1\.0['"]/)
    console.log('[P9-1] CACHE_VERSION = v1.1.0 ✅')
  })

  test('sw.js 包含 Background Sync - IndexedDB 队列', () => {
    expect(swContent, '含 indexedDB.open').toMatch(/indexedDB\.open\(\s*SYNC_QUEUE_STORE/)
    expect(swContent, '含 createObjectStore').toMatch(/createObjectStore\(\s*['"]requests['"]/)
    expect(swContent, '含 enqueueRequest 函数').toMatch(/async\s+function\s+enqueueRequest/)
    expect(swContent, '含 replayQueue 函数').toMatch(/async\s+function\s+replayQueue/)
    console.log('[P9-1] Background Sync 队列逻辑 ✅')
  })

  test('sw.js 包含 sync 事件监听', () => {
    expect(swContent, '含 sync 事件').toMatch(/addEventListener\(\s*['"]sync['"]/)
    expect(swContent, '含 retry-api-requests tag').toMatch(/['"]retry-api-requests['"]/)
    console.log('[P9-1] sync 事件监听 ✅')
  })

  test('sw.js 离线 POST 请求入队逻辑', () => {
    expect(swContent, '含 queued-for-sync 响应').toMatch(/queued-for-sync/)
    expect(swContent, '含 sync.register').toMatch(/sync\.register/)
    console.log('[P9-1] 离线 POST 入队 ✅')
  })

  test('sw.js 包含 Push 事件处理', () => {
    expect(swContent, '含 push 事件').toMatch(/addEventListener\(\s*['"]push['"]/)
    expect(swContent, '含 showNotification').toMatch(/showNotification/)
    expect(swContent, '含 notification 图标').toMatch(/icon-192\.svg/)
    console.log('[P9-1] Push 通知 ✅')
  })

  test('sw.js 包含 notificationclick 事件', () => {
    expect(swContent, '含 notificationclick 事件').toMatch(/addEventListener\(\s*['"]notificationclick['"]/)
    expect(swContent, '含 openWindow').toMatch(/openWindow/)
    console.log('[P9-1] notificationclick ✅')
  })

  test('sw.js 包含 Web Share Target 处理', () => {
    expect(swContent, '含 /share-target').toMatch(/\/share-target/)
    expect(swContent, '含 formData 解析').toMatch(/request\.formData\(\)/)
    expect(swContent, '含 Response.redirect').toMatch(/Response\.redirect/)
    console.log('[P9-1] Web Share Target ✅')
  })

  test('manifest.webmanifest 包含 share_target 字段', () => {
    expect(manifestContent, '含 share_target').toMatch(/"share_target"/)
    expect(manifestContent, '含 action /share-target').toMatch(/"action":\s*"\/share-target"/)
    expect(manifestContent, '含 multipart/form-data').toMatch(/multipart\/form-data/)
    console.log('[P9-1] manifest share_target ✅')
  })
})

test.describe('P9-1 PWA 增强 - 生产构建验证', () => {
  test('生产 sw.js HTTP 200 + 含 Background Sync', async ({ request }) => {
    const available = await isProdServerAvailable(request)
    if (!available) {
      console.log('[P9-1] 生产预览服务器 4173 未运行，跳过生产构建验证')
      test.skip(true, '生产预览服务器 4173 未运行')
    }
    const res = await request.get(`${BASE_PROD}/sw.js`, { failOnStatusCode: false })
    expect(res.status(), 'sw.js 200').toBe(200)
    const text = await res.text()
    expect(text, '含 enqueueRequest').toMatch(/enqueueRequest/)
    expect(text, '含 replayQueue').toMatch(/replayQueue/)
    expect(text, '含 push 事件').toMatch(/addEventListener\(\s*['"]push['"]/)
    console.log('[P9-1] 生产 sw.js 增强 ✅')
  })

  test('生产 manifest.webmanifest 含 share_target', async ({ request }) => {
    const available = await isProdServerAvailable(request)
    if (!available) {
      console.log('[P9-1] 生产预览服务器 4173 未运行，跳过生产构建验证')
      test.skip(true, '生产预览服务器 4173 未运行')
    }
    const res = await request.get(`${BASE_PROD}/manifest.webmanifest`, { failOnStatusCode: false })
    expect(res.status(), 'manifest 200').toBe(200)
    const text = await res.text()
    expect(text, '含 share_target').toMatch(/share_target/)
    console.log('[P9-1] 生产 manifest share_target ✅')
  })
})
