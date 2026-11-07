// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import {
  BookOpen,
  Rocket,
  MessageCircle,
  Coins,
  Bot,
  Settings,
  HelpCircle,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react'

const SITE_URL = 'https://aizhs.top'

const manualJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'ItemList',
      '@id': 'https://aizhs.top/docs/manual#list',
      name: '智汇 AI 使用说明手册目录',
      description:
        '面向终端用户的智汇 AI 使用说明手册,从注册登录到 AI 对话、Agent 使用、知识库、积分订阅、账户设置、常见问题全流程图文教程。',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: '开始使用',
          url: 'https://aizhs.top/docs/manual/getting-started',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'AI 对话',
          url: 'https://aizhs.top/docs/manual/ai-chat',
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: '使用 Agent',
          url: 'https://aizhs.top/docs/manual/agent',
        },
        {
          '@type': 'ListItem',
          position: 4,
          name: '知识库',
          url: 'https://aizhs.top/docs/manual/knowledge-base',
        },
        {
          '@type': 'ListItem',
          position: 5,
          name: '积分与订阅',
          url: 'https://aizhs.top/docs/manual/billing',
        },
        {
          '@type': 'ListItem',
          position: 6,
          name: '账户设置',
          url: 'https://aizhs.top/docs/manual/account',
        },
        {
          '@type': 'ListItem',
          position: 7,
          name: '常见问题',
          url: 'https://aizhs.top/docs/manual/faq',
        },
      ],
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/docs/manual#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: '文档', item: 'https://aizhs.top/docs' },
        {
          '@type': 'ListItem',
          position: 3,
          name: '使用说明手册',
          item: 'https://aizhs.top/docs/manual',
        },
      ],
    },
  ],
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('docs')
  return {
    title: t('meta.manual.title'),
    description: t('meta.manual.description'),
    alternates: {
      canonical: '/docs/manual',
      languages: {
        'x-default': '/docs/manual',
      },
    },
    openGraph: {
      title: t('meta.manual.title'),
      description: t('meta.manual.description'),
      url: `${SITE_URL}/docs/manual`,
      type: 'article',
      images: [
        {
          url: '/images/logo.png?v=20261021',
          width: 1200,
          height: 630,
          alt: '智汇 AI 使用说明手册',
        },
      ],
    },
  }
}

const chapters = [
  {
    num: '01',
    href: '/docs/manual/getting-started',
    key: 'getting-started',
    desc: '注册账号、登录、界面导览、首次对话,3 分钟上手。',
    icon: Rocket,
  },
  {
    num: '02',
    href: '/docs/manual/ai-chat',
    key: 'ai-chat',
    desc: '如何与 AI 对话、上传文件、切换模型、查看历史、分享对话。',
    icon: MessageCircle,
  },
  {
    num: '03',
    href: '/docs/manual/agent',
    key: 'agent',
    desc: '从市场选用 Agent、收藏、定制提示词、发布到自己的工作台。',
    icon: Bot,
  },
  {
    num: '04',
    href: '/docs/manual/knowledge-base',
    key: 'knowledge-base',
    desc: '上传文档、检索测试、把知识库挂载到 Agent,让 AI 懂你的业务。',
    icon: BookOpen,
  },
  {
    num: '05',
    href: '/docs/manual/billing',
    key: 'billing',
    desc: '积分消耗规则、套餐对比、充值、发票、共享积分池。',
    icon: Coins,
  },
  {
    num: '06',
    href: '/docs/manual/account',
    key: 'account',
    desc: '个人资料、安全设置、API Key、通知偏好、注销账号。',
    icon: Settings,
  },
  {
    num: '07',
    href: '/docs/manual/faq',
    key: 'faq',
    desc: '登录失败、积分异常、模型不可用、数据导出等高频问答。',
    icon: HelpCircle,
  },
]

export default async function ManualIndexPage() {
  const t = await getTranslations('docs')
  return (
    <main className="px-4 mx-auto w-full max-w-5xl py-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(manualJsonLd) }}
      />

      {/* Hero */}
      <header className="space-y-4 text-center">
        <div className="inline-flex items-center gap-2 rounded border bg-card px-3 py-1 text-label font-medium text-muted-foreground">
          <BookOpen className="h-3.5 w-3.5" />
          {t('manual.overview.title')}
        </div>
        <h1 className="text-display min-[768px]:text-4xl min-[1024px]:text-5xl font-bold tracking-tight">
          智汇 AI 使用说明手册
        </h1>
        <p className="mx-auto max-w-3xl text-base text-muted-foreground min-[768px]:text-lg">
          {t('meta.manual.description')} {t('manual.overview.description')}
        </p>
      </header>

      {/* 章节列表 */}
      <ol className="mt-12 space-y-3">
        {chapters.map((ch) => (
          <li key={ch.href}>
            <a
              href={ch.href}
              className="group flex items-center gap-4 rounded-lg border bg-card p-3 transition-colors hover:bg-accent"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cta/10 text-primary min-[768px]:h-14 min-[768px]:w-14">
                {typeof ch.icon === 'string' ? ch.icon : <ch.icon className="h-6 w-6" />}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-[weight:inherit] text-label font-mono text-muted-foreground">
                    {t('common.chapterBadge', { num: ch.num })}
                  </span>
                </div>
                <h2 className="text-base font-semibold min-[768px]:text-lg">
                  {t(`manual.${ch.key}.title`)}
                </h2>
                <p className="font-[weight:inherit] mt-1 text-label text-muted-foreground min-[768px]:text-body">{ch.desc}</p>
              </div>
              <ChevronRight
                className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1"
                aria-hidden
              />
            </a>
          </li>
        ))}
      </ol>

      {/* 底部导航 */}
      <div className="mt-12 flex flex-wrap items-center justify-between gap-3">
        <a
          href="/docs"
          className="font-[weight:inherit] inline-flex items-center gap-1 rounded-lg border bg-card px-4 py-2 text-body hover:bg-accent"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
          <span>{t('common.backToDocs')}</span>
        </a>
        <a
          href="/docs/manual/getting-started"
          className="inline-flex items-center gap-1 rounded-lg bg-cta px-4 py-2 text-body font-medium text-cta-foreground hover:bg-cta/90"
        >
          <span>{t('common.startReading')}</span>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </a>
      </div>
    </main>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
