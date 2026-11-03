// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

//
// Brand404Static.tsx — 构建期预渲染用的品牌 404 展示层(2026-11-04 立)
//
// 与 app/not-found.tsx 用同一个 NotFound 展示组件与同一组 common 文案;差别只有 action:
// 静态页没有 JS,所以「返回」不做 onClick,改成两个真实链接(文档中心 / 首页)。
// 链接样式直接取 @ihui/design-tokens 的共享按钮档位(与 ui-react Button 同一源),
// 不 import @ihui/ui-react 桶:该桶会加载 .css,构建期 renderToStaticMarkup(纯 Node)无法解析。
import * as React from 'react'

import { SHARED_BUTTON_BASE_CLASS, SHARED_BUTTON_VARIANT_CLASSES } from '@ihui/design-tokens'

import { NotFound } from './NotFound'

/** ui-react Button 的 web 平台修饰(button.tsx L30/L36/L38),逐字对齐,保证与站内按钮同形。 */
const BUTTON_WEB_BASE =
  'inline-flex gap-2 whitespace-nowrap rounded-sm text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50'
const BUTTON_WEB_SIZE_DEFAULT = 'h-9 px-4 py-2'
const OUTLINE_LINK_CLASS = [
  BUTTON_WEB_BASE,
  SHARED_BUTTON_BASE_CLASS,
  SHARED_BUTTON_VARIANT_CLASSES.outline,
  'shadow-sm hover:bg-accent hover:text-accent-foreground',
  BUTTON_WEB_SIZE_DEFAULT,
].join(' ')
const PRIMARY_LINK_CLASS = [
  BUTTON_WEB_BASE,
  SHARED_BUTTON_BASE_CLASS,
  SHARED_BUTTON_VARIANT_CLASSES.default,
  'shadow hover:bg-cta/90',
  BUTTON_WEB_SIZE_DEFAULT,
].join(' ')

export interface Brand404StaticProps {
  title: string
  description: string
}

export function Brand404Static({ title, description }: Brand404StaticProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 font-sans text-foreground antialiased">
      <NotFound
        title={title}
        description={description}
        className="py-0"
        action={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <a href="/docs" className={OUTLINE_LINK_CLASS}>
              返回文档中心
            </a>
            <a href="/" className={PRIMARY_LINK_CLASS}>
              返回首页
            </a>
          </div>
        }
      />
    </main>
  )
}
