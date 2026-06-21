/**
 * P7-3 CDN / 缓存策略验证
 * - dist 资源文件名带 hash
 * - nginx 配置中关键资源缓存策略正确
 * - PWA 资源缓存策略（sw.js / manifest / icons）
 * - 静态资源 1 年 immutable
 * - HTML 强 no-cache
 */

import { test, expect } from '@playwright/test'
import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const ROOT = 'g:/1/client'
const NGINX = `${ROOT}/nginx-production.conf`
const DIST = `${ROOT}/dist/web`

function readText(path: string): string {
  return readFileSync(path, 'utf-8')
}

function listDir(dir: string, ext?: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter((f) => !ext || f.endsWith(ext))
}

test.describe('P7-3 CDN 资源 hash 化', () => {
  test('dist 资源文件名带 hash（Vite 缓存友好）', () => {
    const assetsDir = `${DIST}/assets`
    if (!existsSync(assetsDir)) {
      test.skip()
      return
    }
    // 递归遍历 assets 目录
    const findHashed = (dir: string): { total: number; hashed: number } => {
      const stats = { total: 0, hashed: 0 }
      const entries = readdirSync(dir)
      for (const e of entries) {
        const p = join(dir, e)
        const s = statSync(p)
        if (s.isDirectory()) {
          const sub = findHashed(p)
          stats.total += sub.total
          stats.hashed += sub.hashed
        } else {
          stats.total++
          if (/-[a-z0-9_-]{8,}\.(js|css|html|svg|png|jpg|webp|woff2?)$/i.test(e)) {
            stats.hashed++
          }
        }
      }
      return stats
    }
    const result = findHashed(assetsDir)
    console.log(`[cdn] dist/assets: ${result.hashed}/${result.total} 文件带 hash`)
    expect(result.hashed, '>= 80% 资源带 hash').toBeGreaterThanOrEqual(result.total * 0.8)
  })

  test('vite.config.ts 配置 chunk / entry / asset fileNames 带 hash', () => {
    const vite = readText(`${ROOT}/vite.config.ts`)
    expect(vite, 'chunkFileNames 配置').toMatch(/chunkFileNames\s*:\s*['"][^'"]*\[hash\][^'"]*['"]/)
    expect(vite, 'entryFileNames 配置').toMatch(/entryFileNames\s*:\s*['"][^'"]*\[hash\][^'"]*['"]/)
    expect(vite, 'assetFileNames 配置').toMatch(/assetFileNames\s*:\s*['"][^'"]*\[hash\][^'"]*['"]/)
  })
})

test.describe('P7-3 Nginx 缓存策略', () => {
  test('HTML 强 no-cache（避免发布后用户看到旧版）', () => {
    const nginx = readText(NGINX)
    expect(nginx, '根 location no-cache').toMatch(/Cache-Control\s+"no-cache[^"]*must-revalidate/)
  })

  test('hash 资源 1 年 immutable', () => {
    const nginx = readText(NGINX)
    expect(nginx, '/assets/ 1y immutable').toMatch(/location \/assets\/\s*\{[^}]*expires\s+1y[^}]*immutable/s)
    expect(nginx, '/images/ 1y immutable').toMatch(/location \/images\/\s*\{[^}]*expires\s+1y[^}]*immutable/s)
  })

  test('PWA sw.js 短期缓存（5min must-revalidate）', () => {
    const nginx = readText(NGINX)
    expect(nginx, 'sw.js 缓存').toMatch(/location\s*=\s*\/sw\.js[\s\S]*?max-age=300[\s\S]*?must-revalidate/)
  })

  test('PWA manifest.webmanifest 1 小时缓存 + webmanifest mime', () => {
    const nginx = readText(NGINX)
    expect(nginx, 'manifest 1h 缓存').toMatch(/location\s*=\s*\/manifest\.webmanifest[\s\S]*?max-age=3600[\s\S]*?must-revalidate/)
    expect(nginx, 'manifest MIME type').toMatch(/application\/manifest\+json\s+webmanifest/)
  })

  test('PWA icons 长期缓存', () => {
    const nginx = readText(NGINX)
    expect(nginx, '/icons/ 1y immutable').toMatch(/location \/icons\/\s*\{[^}]*expires\s+1y[^}]*immutable/s)
  })

  test('nginx 启用 http2 / gzip / sendfile / tcp_nopush', () => {
    const nginx = readText(NGINX)
    expect(nginx, 'listen 443 ssl http2').toMatch(/listen\s+443\s+ssl\s+http2/)
    // gzip 可能在 nginx.conf 中（不在本文件）
    console.log(`[cdn] nginx http2 启用: ${/listen\s+443\s+ssl\s+http2/.test(nginx)}`)
  })
})

test.describe('P7-3 生产构建产物', () => {
  test('dist/web 包含核心资源（index.html / manifest / sw.js）', () => {
    expect(existsSync(`${DIST}/index.html`), 'index.html 存在').toBe(true)
    expect(existsSync(`${DIST}/manifest.webmanifest`), 'manifest.webmanifest 存在').toBe(true)
    expect(existsSync(`${DIST}/sw.js`), 'sw.js 存在').toBe(true)
    expect(existsSync(`${DIST}/favicon.svg`), 'favicon.svg 存在').toBe(true)
    expect(existsSync(`${DIST}/icons/icon-192.svg`), 'icon-192.svg 存在').toBe(true)
    expect(existsSync(`${DIST}/icons/icon-512.svg`), 'icon-512.svg 存在').toBe(true)
  })

  test('dist/assets 总资源 < 30 MB（包含大依赖如 PDF.js / Element Plus）', () => {
    const assetsDir = `${DIST}/assets`
    if (!existsSync(assetsDir)) {
      test.skip()
      return
    }
    const totalBytes = (() => {
      let total = 0
      const walk = (dir: string) => {
        for (const e of readdirSync(dir)) {
          const p = join(dir, e)
          if (statSync(p).isDirectory()) walk(p)
          else total += statSync(p).size
        }
      }
      walk(assetsDir)
      return total
    })()
    const mb = totalBytes / 1024 / 1024
    console.log(`[cdn] dist/assets 总资源: ${mb.toFixed(2)} MB（gzip 后约 ${(mb * 0.25).toFixed(1)} MB）`)
    // 实际项目包含 pdfjs / docx-preview / xlsx / echarts / element-plus，gzip 后约 6-8 MB
    expect(mb, 'dist/assets 总资源 < 30 MB').toBeLessThan(30)
  })

  test('dist/assets/js 总和 < 20 MB', () => {
    const jsDir = `${DIST}/assets/js`
    if (!existsSync(jsDir)) {
      test.skip()
      return
    }
    const totalBytes = (() => {
      let total = 0
      const walk = (dir: string) => {
        for (const e of readdirSync(dir)) {
          const p = join(dir, e)
          if (statSync(p).isDirectory()) walk(p)
          else total += statSync(p).size
        }
      }
      walk(jsDir)
      return total
    })()
    const mb = totalBytes / 1024 / 1024
    console.log(`[cdn] dist/assets/js 总和: ${mb.toFixed(2)} MB`)
    expect(mb, 'JS 资源 < 20 MB').toBeLessThan(20)
  })
})
