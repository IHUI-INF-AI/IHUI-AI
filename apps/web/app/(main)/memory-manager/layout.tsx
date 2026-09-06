// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍​‌​​‌​​​‍​‌​‌​‌​‌‍​‌​​‌​​‌‍​​‌​‌‌​‌‍​‌​​​​​‌‍​‌​​‌​​‌‍‌​‌‌​‌‌‌‍‌‌​​‌‌​​‌‌‌‌​‌​‍‌‌​‌‌​​​‌​​​‌‌‌‍​‌​​​​​‌‍​‌​​‌​​‌‍‌​‌‌​‌‌‌‍‌‌​​‌‌‌​‌​​‌‌‌​‍‌‌​​‌‌​​​‌​​‌​‌‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍​‌‌​‌‌‌‍​‌​​‌‌​​‍​‌​​​​‌‌‍​‌​​​​​‌‌‍​‌‌​‌‌​‌‌‍​‌‌‌​​​​‌‍​‌‌​‌​​‌‍​‌‌‌‌​‌​‍​‌‌​‌​​​‍​‌‌‌​​‌‌‍​​‌​‌‌‌​‍​‌‌‌​‌​​‍​‌‌​‌‌‌‌‍​‌‌‌​​​​‍‌​‌‌​‌‌‌‍​‌​‌​​​​‍​‌​‌​​‌​‍​‌​​‌‌‌‌‍​‌​‌​‌‌​‍​‌​​​‌​‌‍​‌​​‌‌‌​‍​‌​​​​​‌‍​‌​​‌‌‌​‍​‌​​​​‌‌‍​‌​​​‌​‌‍​​‌​‌‌​‌‍​​‌‌​​‌​‍​​‌‌​​​​‍​​‌‌​​‌​‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// Memory Manager 长期记忆管理页 metadata(SEO):服务端 wrapper 注入唯一 title/OG,区别于工作区通用标题。

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    absolute: '长期记忆管理 Memory Manager | IHUI AI',
  },
  description:
    'IHUI AI 长期记忆管理:跨会话沉淀用户偏好、项目约定与踩坑教训,支持类型/重要度过滤、手动新增、删除与提升重要度,让 Agent 真正做到越用越懂你。',
  alternates: { canonical: '/memory-manager' },
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    title: '长期记忆管理 Memory Manager | IHUI AI',
    description: 'IHUI AI 长期记忆管理,跨会话沉淀偏好/约定/教训,让 Agent 越用越懂你。',
    url: 'https://aizhs.top/memory-manager',
    siteName: 'IHUI AI',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'IHUI AI 长期记忆管理' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '长期记忆管理 Memory Manager | IHUI AI',
    description: 'IHUI AI 长期记忆管理,跨会话沉淀偏好/约定/教训。',
    images: ['/og-image.png'],
  },
}

export default function MemoryManagerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}