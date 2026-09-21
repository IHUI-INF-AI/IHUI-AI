// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// Deep Research 深度研究页 metadata(SEO):该路由组 layout 作为服务端 wrapper,
// 为该"use client"页面注入唯一 title/description + OG,区别于 (main) 工作区通用标题。

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    absolute: '深度研究 Deep Research | IHUI AI',
  },
  description:
    'IHUI AI 深度研究(Deep Research)Agent:输入课题即可规划问题、多源检索、深度调查与综合成稿,一键生成带来源清单的 Markdown 研究报告,对标 Claude/Perplexity 深度研究。',
  alternates: { canonical: '/deep-research' },
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    title: '深度研究 Deep Research | IHUI AI',
    description:
      'IHUI AI 深度研究 Agent:规划问题 → 多源检索 → 深度调查 → 综合成稿,一键生成带来源的 Markdown 研究报告。',
    url: 'https://aizhs.top/deep-research',
    siteName: 'IHUI AI',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'IHUI AI 深度研究' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '深度研究 Deep Research | IHUI AI',
    description: 'IHUI AI 深度研究 Agent,一键生成带来源的 Markdown 研究报告。',
    images: ['/og-image.png'],
  },
}

export default function DeepResearchLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
