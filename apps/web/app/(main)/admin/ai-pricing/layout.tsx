// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

// 模型定价管理页 metadata(SEO):服务端 wrapper 注入唯一 title。

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    absolute: '模型定价管理 | IHUI AI',
  },
  description:
    'IHUI AI 模型定价管理:按 token/按次(上下文分档)/按张/按视频四种计费模式的定价写入与维护。',
  alternates: { canonical: '/admin/ai-pricing' },
}

export default function AdminAiPricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
