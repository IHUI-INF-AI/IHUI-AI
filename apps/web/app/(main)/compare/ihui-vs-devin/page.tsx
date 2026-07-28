import type { Metadata } from 'next'
import { CompareContent } from '../ihui-vs-dify/CompareContent'

const compareJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aizhs.top/compare/ihui-vs-devin#webpage',
      url: 'https://aizhs.top/compare/ihui-vs-devin',
      name: 'IHUI AI vs Devin:通用全栈 AI 操作系统 vs AI 程序员单点工具',
      description:
        'Devin 是首个 AI 软件工程师(单点工具,$500/月起,仅编程场景);IHUI AI 是 Apache 2.0 开源通用全栈 AI 操作系统,10+ 场景(客服/教育/医疗/法律/制造/媒体/政企)。本文深度对比。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://aizhs.top/#website' },
      about: [
        { '@id': 'https://aizhs.top/#organization' },
        { '@type': 'Thing', name: 'Devin AI' },
        { '@type': 'Thing', name: 'Cognition AI' },
      ],
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/compare/ihui-vs-devin#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: '产品对比', item: 'https://aizhs.top/compare' },
        { '@type': 'ListItem', position: 3, name: 'IHUI AI vs Devin', item: 'https://aizhs.top/compare/ihui-vs-devin' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'IHUI AI vs Devin AI:通用全栈 vs AI 程序员单点 | 2026 对比',
  description:
    'Devin 专注代码任务(单点,$500/月起);IHUI AI 是 Apache 2.0 开源通用全栈 AI 操作系统,10+ 场景(客服/教育/医疗/法律/制造/媒体/政企),¥49/月起。本文 11 维度对比。',
  alternates: { canonical: '/compare/ihui-vs-devin' },
  openGraph: {
    title: 'IHUI AI vs Devin — 通用全栈 vs AI 程序员',
    description: '10+ 场景 vs 1 场景;¥49/月 vs $500/月;开源 vs 闭源。',
    url: 'https://aizhs.top/compare/ihui-vs-devin',
    type: 'article',
  },
}

export default function CompareDevinPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(compareJsonLd) }}
      />
      <CompareContent competitor="devin" />
    </>
  )
}
