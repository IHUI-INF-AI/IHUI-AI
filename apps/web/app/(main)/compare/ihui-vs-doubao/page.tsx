import type { Metadata } from 'next'
import { CompareContent } from '../ihui-vs-dify/CompareContent'

const compareJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aizhs.top/compare/ihui-vs-doubao#webpage',
      url: 'https://aizhs.top/compare/ihui-vs-doubao',
      name: 'IHUI AI vs 豆包:企业级开源 Agent 平台 vs 字节 C 端 AI',
      description:
        '豆包是字节 C 端 AI 助手;IHUI AI 是 Apache 2.0 开源企业级 Agent 平台,含私有化+数据主权+Agent 市场+六端分发。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://aizhs.top/#website' },
      about: [
        { '@id': 'https://aizhs.top/#organization' },
        { '@type': 'Thing', name: 'Doubao / 豆包' },
      ],
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/compare/ihui-vs-doubao#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: '产品对比', item: 'https://aizhs.top/compare' },
        {
          '@type': 'ListItem',
          position: 3,
          name: 'IHUI AI vs 豆包',
          item: 'https://aizhs.top/compare/ihui-vs-doubao',
        },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'IHUI AI vs 豆包:企业级开源 Agent 平台 vs 字节 C 端 AI | 2026 对比',
  description:
    '豆包是字节 C 端 AI 助手(免费+抖音生态);IHUI AI 是 Apache 2.0 开源企业级 Agent 平台,含私有化+数据主权+Agent 市场+六端分发。本文 9 维度对比。',
  alternates: { canonical: '/compare/ihui-vs-doubao' },
  openGraph: {
    title: 'IHUI AI vs 豆包 — 企业级开源 vs C 端免费',
    description: '私有化 + 数据主权 vs 字节云托管。',
    url: 'https://aizhs.top/compare/ihui-vs-doubao',
    type: 'article',
  },
}

export default function CompareDoubaoPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(compareJsonLd) }}
      />
      <CompareContent competitor="doubao" />
    </>
  )
}
