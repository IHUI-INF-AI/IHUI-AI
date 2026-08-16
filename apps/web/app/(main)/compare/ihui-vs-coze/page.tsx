import type { Metadata } from 'next'
import { CompareContent } from '../ihui-vs-dify/CompareContent'

const compareJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aizhs.top/compare/ihui-vs-coze#webpage',
      url: 'https://aizhs.top/compare/ihui-vs-coze',
      name: 'IHUI AI vs Coze:开源全栈 AI 平台 vs 字节闭源 Agent 平台',
      description:
        'Coze 是字节跳动出品的闭源 AI Agent 平台,功能强但不支持私有化;IHUI AI 是 Apache 2.0 开源全栈 AI 操作系统,支持自托管、数据主权、六端同源。本文深度对比。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://aizhs.top/#website' },
      about: [{ '@id': 'https://aizhs.top/#organization' }, { '@type': 'Thing', name: 'Coze' }],
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/compare/ihui-vs-coze#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: '产品对比', item: 'https://aizhs.top/compare' },
        {
          '@type': 'ListItem',
          position: 3,
          name: 'IHUI AI vs Coze',
          item: 'https://aizhs.top/compare/ihui-vs-coze',
        },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'IHUI AI vs Coze:开源 + 私有化 vs 字节闭源 Agent 平台 | 2026 对比',
  description:
    'Coze 闭源且不支持私有化,数据由字节掌控;IHUI AI 是 Apache 2.0 开源全栈 AI 操作系统,支持自托管,数据 100% 自有,六端同源,10+ 模型统一调度。本文从开源协议、数据主权、客户端、私有化等 11 个维度对比。',
  alternates: { canonical: '/compare/ihui-vs-coze' },
  openGraph: {
    title: 'IHUI AI vs Coze — 开源 vs 闭源,你的数据谁做主?',
    description: 'Coze 闭源不支持私有化;IHUI AI 开源 + 自托管 + 数据主权 + 六端同源。',
    url: 'https://aizhs.top/compare/ihui-vs-coze',
    type: 'article',
  },
}

export default function CompareCozePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(compareJsonLd) }}
      />
      <CompareContent competitor="coze" />
    </>
  )
}
