import type { Metadata } from 'next'
import Link from 'next/link'
import { Sparkles, ArrowRight, Megaphone, AlertTriangle, Wrench, MessageSquare, GraduationCap, Palette, Globe } from 'lucide-react'

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aizhs.top/en/use-cases/ai-marketing#webpage',
      url: 'https://aizhs.top/en/use-cases/ai-marketing',
      name: 'AI Marketing Content Generation Agent Use Case — IHUI AI',
      description:
        'AI marketing content generation agent built on IHUI AI full-stack AI operating system: multi-platform copy (Xiaohongshu, Douyin, Weibo, WeChat, LinkedIn), SEO blog, brand voice consistency, A/B test copy, persona-driven content. 30-minute onboarding, 8-endpoint distribution.',
      inLanguage: ['en', 'zh-CN', 'zh-TW', 'ko', 'ja'],
      isPartOf: { '@id': 'https://aizhs.top/#website' },
      about: { '@id': 'https://aizhs.top/#organization' },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/en/use-cases/ai-marketing#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: 'Use Cases', item: 'https://aizhs.top/use-cases' },
        { '@type': 'ListItem', position: 3, name: 'AI Marketing', item: 'https://aizhs.top/en/use-cases/ai-marketing' },
      ],
    },
    {
      '@type': 'HowTo',
      '@id': 'https://aizhs.top/en/use-cases/ai-marketing#howto',
      name: '30-Minute Setup of an AI Marketing Content Generation Agent',
      description:
        'Six-step workflow to build an AI marketing content generation agent on IHUI AI: upload brand guidelines, train voice model, connect platform APIs, configure A/B testing, import personas, enable data feedback. 10x content output.',
      inLanguage: ['en', 'zh-CN', 'zh-TW', 'ko', 'ja'],
      totalTime: 'PT30M',
      estimatedCost: { '@type': 'MonetaryAmount', currency: 'CNY', value: '0' },
      supply: [{ '@type': 'HowToSupply', name: 'Brand guidelines / past hit articles / product manual / target personas' }],
      tool: [
        { '@type': 'HowToTool', name: 'IHUI AI Multi-Platform Copy Engine' },
        { '@type': 'HowToTool', name: 'IHUI AI Brand Voice Module' },
      ],
      step: [
        { '@type': 'HowToStep', position: 1, name: 'Upload brand guidelines', text: 'Upload brand story, voice document, and past hit articles; AI learns tone and forbidden expressions.' },
        { '@type': 'HowToStep', position: 2, name: 'Train voice model', text: 'Fine-tune the LLM on brand history; manual review workload drops 80% while outputs match brand persona.' },
        { '@type': 'HowToStep', position: 3, name: 'Connect platform APIs', text: 'Connect Xiaohongshu, Douyin, Weibo, WeChat, LinkedIn, and Twitter Open APIs for one-click publishing.' },
        { '@type': 'HowToStep', position: 4, name: 'Configure A/B tests', text: 'Generate 3-5 title and cover variants per topic; the agent runs A/B tests and identifies the high-CTR version within 72 hours.' },
        { '@type': 'HowToStep', position: 5, name: 'Import personas', text: 'Import CRM personas (age, region, spending power, interests); Agent auto-matches tone, angle, and CTA for +35% conversion.' },
        { '@type': 'HowToStep', position: 6, name: 'Enable data feedback', text: 'Pull platform metrics (views, likes, conversions); AI reviews top performers and feeds the next round of generation.' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'AI Marketing Content Generation — Multi-Platform Copy / SEO / Brand Voice | IHUI AI',
  description:
    'Build an AI marketing content generation agent on IHUI AI: multi-platform copy + SEO blog + brand voice consistency + A/B testing + persona-driven content. 30-minute onboarding, 8-endpoint distribution.',
  alternates: { canonical: '/en/use-cases/ai-marketing' },
  openGraph: {
    title: 'AI Marketing Content Generation Agent — IHUI AI',
    description: 'Multi-platform rewriting + brand voice consistency + A/B testing, 30-minute onboarding.',
    url: 'https://aizhs.top/en/use-cases/ai-marketing',
    type: 'article',
  },
}

const problems = [
  'WeChat, Zhihu, Xiaohongshu, Douyin, and LinkedIn each have a different tone; manual rewriting for every platform exhausts capacity',
  'Marketing copy must satisfy SEO keywords, brand voice, and platform algorithm preferences at the same time, which is slow and inconsistent',
  'Topic planning depends on a few senior editors; new hires produce inconsistently and the brand voice drifts',
  'A/B testing needs a large volume of assets, manual production lags, and optimization decisions are delayed',
  'Multi-language versions (Chinese, English, Japanese, Korean, Traditional Chinese) require separate editors, which is expensive and slow',
  'Marketing performance data is scattered across platform dashboards; manual weekly/monthly reports are slow and cannot feed back into content strategy in time',
]

const capabilities = [
  { title: 'One-click multi-platform rewriting', desc: 'One 3,000-word article is auto-rewritten into Xiaohongshu short post, Douyin script, Zhihu answer, LinkedIn long-form, and Weibo post; each matches the platform tone.' },
  { title: 'Smart SEO optimization', desc: 'Enter target keywords; AI auto-generates SEO-friendly title, meta, and body, applying mainstream rules for Google, Bing, and Baidu.' },
  { title: 'Unified brand voice', desc: 'Upload brand guidelines and past hits; AI learns the voice and 100% of outputs match the brand.' },
  { title: 'A/B test copy', desc: '3-5 title and cover variants per topic; agent runs A/B tests and finds the high-CTR version in 72 hours, lifting conversion 35%.' },
  { title: 'Persona-driven content', desc: 'Import CRM personas; agent matches tone, content angle, and CTA for true 1:1 personalization.' },
  { title: 'Data feedback loop', desc: 'Pull platform metrics; AI reviews top performers and feeds the next round of creation for continuous improvement.' },
]

const cases = [
  {
    title: 'DTC new consumer brand: 10x content output',
    desc: 'A new tea beverage brand using the AI marketing agent can run 5 platform accounts (Xiaohongshu, Douyin, Weibo, WeChat, Bilibili) with one operator; monthly output rose from 80 to 850 pieces, followers grew 3.2x, and CAC dropped 40%.',
  },
  {
    title: 'B2B SaaS: +220% organic SEO traffic',
    desc: 'A B2B SaaS company used the AI marketing agent to auto-generate SEO blogs; 240 high-quality English blogs in 6 months lifted Google organic traffic 220% and MQLs by 85%.',
  },
  {
    title: 'Cross-border e-commerce: 80% lower multi-language cost',
    desc: 'A cross-border e-commerce brand cut multi-language localization outsourcing cost by 80% across 5 languages (JP, KR, EN, DE, FR) and compressed product launch cycle from 14 days to 3 days.',
  },
]

const toolchain = [
  { name: 'Next.js 15 + React 19', purpose: 'Web workbench for marketing operations and brand guidelines' },
  { name: 'Fastify 5 + Drizzle ORM', purpose: 'API for multi-platform account auth and publishing queue' },
  { name: 'FastAPI + LangGraph + LiteLLM', purpose: 'Multi-platform rewriting + SEO optimization + brand voice fine-tuning' },
  { name: 'MCP tool protocol', purpose: 'Adapters for Xiaohongshu, Douyin, Weibo, WeChat, and LinkedIn' },
  { name: 'Tauri 2 desktop', purpose: 'Local brand asset library and offline copy workbench' },
  { name: 'WXT browser extension', purpose: 'One-click capture of reference material and competitor copy' },
  { name: 'Taro 4 mini-program', purpose: 'Mobile marketing data dashboard and instant review' },
  { name: 'CLI command line', purpose: 'Batch content generation and publishing pipeline automation' },
]

const metrics = [
  { value: '10x', label: 'Content output' },
  { value: '80%', label: 'Multi-language cost cut' },
  { value: '35%', label: 'Conversion lift' },
  { value: '30min', label: 'Onboarding time' },
]

export default function AiMarketingPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8 md:py-8">
        {/* Hero */}
        <section className="space-y-5 text-center">
          <div className="inline-flex items-center gap-2 rounded border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Megaphone className="h-3.5 w-3.5 text-primary" />
            Marketing Content
          </div>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            AI Marketing Content Generation: 10x output across all platforms
          </h1>
          <p className="mx-auto max-w-3xl text-base text-muted-foreground md:text-lg">
            Built on the IHUI AI full-stack AI operating system, 8-endpoint distribution, Apache 2.0 open source, on-premise support, with unified brand voice guarantee.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 pt-2">
            {metrics.map((m) => (
              <div key={m.label} className="text-center">
                <div className="text-2xl font-bold text-primary md:text-3xl">{m.value}</div>
                <div className="mt-1 text-xs text-muted-foreground md:text-sm">{m.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Problems */}
        <section className="mt-16 rounded-2xl border bg-card p-8 md:p-12">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <h2 className="text-xl font-bold tracking-tight md:text-2xl">Capacity bottlenecks in marketing teams</h2>
          </div>
          <ul className="mt-6 space-y-3">
            {problems.map((p, i) => (
              <li key={i} className="flex items-start gap-3 text-sm leading-relaxed text-muted-foreground md:text-base">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
                {p}
              </li>
            ))}
          </ul>
        </section>

        {/* Capabilities */}
        <section className="mt-16">
          <h2 className="text-center text-xl font-bold tracking-tight md:text-2xl">Six core capabilities</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {capabilities.map((c, i) => (
              <div key={c.title} className="rounded-2xl border bg-card p-6 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                  {i + 1}
                </div>
                <h3 className="mt-4 text-lg font-semibold">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Cases */}
        <section className="mt-16 rounded-2xl border bg-primary/5 p-8 md:p-12">
          <h2 className="text-center text-xl font-bold tracking-tight md:text-2xl">Customer success stories</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {cases.map((cs, i) => (
              <div key={i} className="rounded-2xl border bg-card p-6">
                <h3 className="text-base font-semibold">{cs.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{cs.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Toolchain */}
        <section className="mt-16">
          <div className="flex items-center justify-center gap-3">
            <Wrench className="h-6 w-6 text-primary" />
            <h2 className="text-center text-xl font-bold tracking-tight md:text-2xl">Tech stack and toolchain</h2>
          </div>
          <p className="mx-auto mt-3 max-w-3xl text-center text-sm text-muted-foreground md:text-base">
            Built on the IHUI AI full-stack AI operating system with one codebase across 8 endpoints; all core components are open source and integrate seamlessly with 5 major social platforms.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {toolchain.map((t, i) => (
              <div key={i} className="rounded-2xl border bg-card p-5">
                <h3 className="text-sm font-semibold">{t.name}</h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t.purpose}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Contact/CTA */}
        <section className="mt-16 rounded-2xl border bg-card p-8 text-center md:p-12">
          <Sparkles className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-4 text-xl font-bold tracking-tight md:text-2xl">Start building your AI marketing content assistant</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground md:text-base">
            Sign up and get 1000 credits, fork the marketing scenario template, and try multi-platform output in 30 minutes.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/sso/register"
              className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Free signup
            </Link>
            <Link
              href="/use-cases"
              className="inline-flex h-11 items-center justify-center rounded-md border border-input bg-background px-8 text-sm font-medium hover:bg-accent"
            >
              View other use cases <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> Sales consult 8804</span>
            <span className="flex items-center gap-1.5"><GraduationCap className="h-3.5 w-3.5" /> Marketing academy 8805</span>
            <span className="flex items-center gap-1.5"><Palette className="h-3.5 w-3.5" /> Brand custom 8806</span>
            <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> Platform mirror 8809</span>
          </div>
        </section>
      </main>
    </>
  )
}
