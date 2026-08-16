import type { Metadata } from 'next'
import { CompareContent } from '../ihui-vs-dify/CompareContent'

const compareJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aizhs.top/compare/ihui-vs-copilot-studio#webpage',
      url: 'https://aizhs.top/compare/ihui-vs-copilot-studio',
      name: 'IHUI AI vs Microsoft Copilot Studio:跨云中立 vs Azure 锁定',
      description:
        'Microsoft Copilot Studio 锁定 Microsoft 365 + Azure 生态($200/月起,闭源);IHUI AI 是 Apache 2.0 开源全栈 AI 操作系统,跨云中立(AWS/Azure/GCP/阿里云/腾讯云),支持国产化信创。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://aizhs.top/#website' },
      about: [
        { '@id': 'https://aizhs.top/#organization' },
        { '@type': 'Thing', name: 'Microsoft Copilot Studio' },
      ],
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/compare/ihui-vs-copilot-studio#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: '产品对比', item: 'https://aizhs.top/compare' },
        {
          '@type': 'ListItem',
          position: 3,
          name: 'IHUI AI vs Microsoft Copilot Studio',
          item: 'https://aizhs.top/compare/ihui-vs-copilot-studio',
        },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'IHUI AI vs Microsoft Copilot Studio:跨云中立 vs Azure 锁定 | 2026 对比',
  description:
    'Copilot Studio 锁定 Microsoft 365 + Azure($200/月起,闭源,不支持国产化);IHUI AI 是 Apache 2.0 开源,跨云中立(AWS/Azure/GCP/阿里云/腾讯云/华为云),完整国产化信创适配。本文 11 维度对比。',
  alternates: { canonical: '/compare/ihui-vs-copilot-studio' },
  openGraph: {
    title: 'IHUI AI vs Microsoft Copilot Studio — 跨云中立 vs Azure 锁定',
    description: '开源 vs 闭源;跨云 vs Azure 锁定;免费 vs $200/月起;支持信创 vs 不支持。',
    url: 'https://aizhs.top/compare/ihui-vs-copilot-studio',
    type: 'article',
  },
}

export default function CompareCopilotStudioPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(compareJsonLd) }}
      />
      <CompareContent competitor="copilot-studio" />
    </>
  )
}
