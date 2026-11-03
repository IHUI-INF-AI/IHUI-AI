// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

//
// build-brand-404.mts — 构建期生成品牌 404 静态资产(2026-11-04 立)
//
// 由 apps/web 的 postbuild 触发,在 next build 成功之后执行:
//   1. renderToStaticMarkup 渲染 Brand404Static(站内 NotFound + common 文案,同一展示组件);
//   2. Tailwind v4 只编译该页用到的最小闭包(source(none) + 显式 @source),内联 <style>;
//   3. 写到 <distDir>/static/brand-404.html,运行期由 Proxy 读取并以 404 返回。
//
// 为什么不是让 Next 自己预渲染 app/not-found.tsx:根布局每请求读 cookies()/headers(),
// /_not-found 是动态路由;next build(非 export)不会产出 _not-found.html
// (next/dist/build/index.js 的 moveExportedAppNotFoundTo404 只在 output:export 下搬文件)。
//
// 为什么失败要非零退出:资产缺失时 Proxy 会退回旧的手写页 —— 那是语义正确但品牌退化的兜底。
// 让构建红、线上停在上一版,比静默上线一份退化页更符合「三条语义与品牌都不退化」。
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import postcss from 'postcss'
import tailwindcss from '@tailwindcss/postcss'

import sharedZhCN from '../../../packages/i18n/messages/shared/zh-CN.json'
import { Brand404Static } from '@/components/common/Brand404Static'
import { assembleBrand404Html, brand404DistDir, brand404Path } from '@/lib/brand-404'

const here = path.dirname(fileURLToPath(import.meta.url))
const webRoot = path.resolve(here, '..')

/** 构建期 Tailwind 最小闭包:只扫这三个组件面 + design tokens 常量。 */
const CSS_ENTRY = `@import 'tailwindcss' source(none);
@import '../../packages/design-tokens/src/styles/tokens.css';
@import '../../packages/design-tokens/src/styles/base.css';
@source './src/components/common/Brand404Static.tsx';
@source './src/components/common/NotFound.tsx';
@source '../../packages/design-tokens/src';
`

function assertBrandHtml(html: string, file: string): void {
  const problems: string[] = []
  if (!html.startsWith('<!DOCTYPE html>')) problems.push('缺 doctype')
  if (!html.includes('<meta name="robots" content="noindex">')) problems.push('缺 noindex')
  if (!/<style>[\s\S]{40,}<\/style>/.test(html)) problems.push('缺非空内联 <style>')
  if (html.includes('<script')) problems.push('含 <script(静态页应为零脚本)')
  if (!html.includes('页面未找到')) problems.push('缺 common.notFoundTitle 文案')
  if (!html.includes('返回文档中心') || !html.includes('返回首页')) problems.push('缺两个返回链接')
  if (problems.length > 0) {
    throw new Error(`[brand-404] 资产校验失败(${file}):${problems.join(' / ')}`)
  }
}

async function verifyExisting(file: string): Promise<void> {
  const html = await readFile(file, 'utf8')
  assertBrandHtml(html, file)
  const size = (await stat(file)).size
  console.log(`[brand-404] verify ok: ${file} (${size} bytes)`)
}

async function main(): Promise<void> {
  const distDir = brand404DistDir()
  const outFile = brand404Path(distDir, webRoot)

  if (process.argv.includes('--verify-only')) {
    await verifyExisting(outFile)
    return
  }

  if (process.env.EXPORT_STATIC === '1' || process.env.GITHUB_PAGES === '1') {
    console.log('[brand-404] 静态导出形态不生成(Proxy 不生效),skip')
    return
  }

  // 临时 CSS 入口必须落在 apps/web 内:@import/@source 都按该文件位置解析相对路径。
  const entryFile = path.join(webRoot, '.brand-404.build.css')
  try {
    await writeFile(entryFile, CSS_ENTRY, 'utf8')
    const result = await postcss([tailwindcss()]).process(CSS_ENTRY, { from: entryFile })
    const css = result.css.trim()
    if (!css) throw new Error('[brand-404] Tailwind 产出空 CSS')

    const messages = sharedZhCN as { common: Record<string, string> }
    const markup = renderToStaticMarkup(
      React.createElement(Brand404Static, {
        title: messages.common.notFoundTitle,
        description: messages.common.notFoundDescription,
      }),
    )
    const html = assembleBrand404Html({ markup, css })

    await mkdir(path.dirname(outFile), { recursive: true })
    await writeFile(outFile, html, 'utf8')
    console.log(`[brand-404] written: ${outFile}`)
    await verifyExisting(outFile)
  } finally {
    await rm(entryFile, { force: true })
  }
}

main().catch((error: unknown) => {
  console.error('[brand-404] 生成失败:', error)
  process.exitCode = 1
})
