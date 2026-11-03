// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//
// brand-404.test.tsx — 品牌 404 资产与 Proxy 落码语义锁(2026-11-04 立)
//
// 钉住三件事,一条都不许退化:
//   ① 构建期 markups 是站内 NotFound(品牌组件)+ 两个真实链接,零脚本;
//   ② 资产自带 noindex,404 响应头带 no-store / x-robots-tag;
//   ③ 响应体只可能是资产原文 —— 请求路径/slug 从未进入 body(用 sentinel 证伪)。
import { beforeEach, describe, expect, it } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { Brand404Static } from '../components/common/Brand404Static'
import {
  BRAND_404_TITLE,
  assembleBrand404Html,
  brand404Body,
  brand404DistDir,
  brand404Path,
  loadBrand404Html,
  resetBrand404Cache,
} from '../lib/brand-404'
import { docsGateResponseHeaders } from '../lib/docs-detail-gate'

const SENTINEL_SLUG = 'this-slug-should-not-exist-zz9'
const STUB_CSS = '.text-heading{font-size:1.5rem}.text-muted-foreground{color:#8b949e}'

function stubAsset(): string {
  return assembleBrand404Html({
    markup: '<main class="text-heading text-muted-foreground">页面未找到</main>',
    css: STUB_CSS,
  })
}

describe('Brand404Static 渲染(站内 NotFound 品牌组件)', () => {
  it('渲染 404 码 + 站内文案 + 两个真实返回链接,且零脚本', () => {
    const markup = renderToStaticMarkup(
      React.createElement(Brand404Static, {
        title: '页面未找到',
        description: '您访问的页面不存在或已被移除。',
      }),
    )
    expect(markup).toContain('text-heading')
    expect(markup).toContain('text-muted-foreground')
    expect(markup).toContain('页面未找到')
    expect(markup).toContain('返回文档中心')
    expect(markup).toContain('返回首页')
    expect(markup).not.toContain('<script')
    expect(markup).not.toContain(SENTINEL_SLUG)
  })
})

describe('assembleBrand404Html', () => {
  it('doctype / lang / noindex / 标题 / 内联 CSS 齐备', () => {
    const html = stubAsset()
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true)
    expect(html).toContain('<html lang="zh-CN">')
    expect(html).toContain('<meta name="robots" content="noindex">')
    expect(html).toContain(`<title>${BRAND_404_TITLE}</title>`)
    expect(html).toContain(`<style>${STUB_CSS}</style>`)
    expect(html).not.toContain('<script')
  })

  it('入参没有 slug/path:请求路径不可能被拼进 body', () => {
    const html = stubAsset()
    expect(html).not.toContain(SENTINEL_SLUG)
    // 结构性保证:拼装函数签名里只有 markup/css/title,没有 requestPath
    expect(assembleBrand404Html.length).toBe(1)
  })
})

describe('loadBrand404Html', () => {
  beforeEach(() => resetBrand404Cache())

  it('命中构建资产 ⇒ 原文返回,并缓存(第二次不再读盘)', async () => {
    const asset = stubAsset()
    let reads = 0
    const readFile = async (): Promise<string> => {
      reads += 1
      return asset
    }
    const first = await loadBrand404Html({ readFile, distDir: '.next', cwd: 'C:/app' })
    const second = await loadBrand404Html({ readFile, distDir: '.next', cwd: 'C:/app' })
    expect(first).toBe(asset)
    expect(second).toBe(asset)
    expect(reads).toBe(1)
  })

  it('资产缺失(ENOENT)⇒ null,不抛错;空文件同样 null', async () => {
    let reads = 0
    const missing = async (): Promise<string> => {
      reads += 1
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    }
    expect(await loadBrand404Html({ readFile: missing })).toBeNull()
    expect(reads).toBe(1)
    resetBrand404Cache()
    expect(await loadBrand404Html({ readFile: async () => '   ' })).toBeNull()
  })

  it('distDir 镜像 IHUI_BUILD_DIST:蓝绿槽各读自己的资产', () => {
    expect(brand404DistDir({ IHUI_BUILD_DIST: '.next-blue' })).toBe('.next-blue')
    expect(brand404DistDir({})).toBe('.next')
    expect(brand404Path('.next-green', 'C:/app')).toContain('.next-green')
    expect(brand404Path(undefined, 'C:/app')).toContain('brand-404.html')
  })
})

describe('404 响应语义', () => {
  it('body 只可能是资产原文;兜底仅在资产缺失时生效,且都不含请求 slug', () => {
    const asset = stubAsset()
    const body = brand404Body(asset, '<p>fallback</p>')
    expect(body).toBe(asset)
    expect(body).not.toContain(SENTINEL_SLUG)
    expect(brand404Body(null, '<p>fallback</p>')).toBe('<p>fallback</p>')
  })

  it('响应头:no-store + noindex + html;有 CSP 时透传,无 CSP 不加', () => {
    const headers = docsGateResponseHeaders()
    expect(headers.get('content-type')).toBe('text/html; charset=utf-8')
    expect(headers.get('cache-control')).toBe('no-store')
    expect(headers.get('x-robots-tag')).toBe('noindex')
    expect(headers.get('content-security-policy')).toBeNull()
    expect(docsGateResponseHeaders("default-src 'self'").get('content-security-policy')).toBe(
      "default-src 'self'",
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
