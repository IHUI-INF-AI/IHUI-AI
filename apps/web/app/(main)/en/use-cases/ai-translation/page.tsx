import type { Metadata } from 'next'
import Link from 'next/link'
import { Sparkles, ArrowRight, Languages, AlertTriangle, Wrench, MessageSquare, GraduationCap, Palette, Globe } from 'lucide-react'

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://ihui.ai/en/use-cases/ai-translation#webpage',
      url: 'https://ihui.ai/en/use-cases/ai-translation',
      name: 'AI Multilingual Translation Agent Use Case — IHUI AI',
      description:
        'AI multilingual translation agent built on IHUI AI full-stack AI operating system: multi-language document translation, localization workflow, glossary management, translation review, cultural adaptation, subtitle translation. 30-minute onboarding, 8-endpoint distribution.',
      inLanguage: ['en', 'zh-CN', 'zh-TW', 'ko', 'ja'],
      isPartOf: { '@id': 'https://ihui.ai/#website' },
      about: { '@id': 'https://ihui.ai/#organization' },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://ihui.ai/en/use-cases/ai-translation#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://ihui.ai' },
        { '@type': 'ListItem', position: 2, name: 'Use Cases', item: 'https://ihui.ai/use-cases' },
        { '@type': 'ListItem', position: 3, name: 'AI Translation', item: 'https://ihui.ai/en/use-cases/ai-translation' },
      ],
    },
    {
      '@type': 'HowTo',
      '@id': 'https://ihui.ai/en/use-cases/ai-translation#howto',
      name: '30-Minute Setup of an AI Multilingual Translation Agent',
      description:
        'Six-step workflow to build an AI multilingual translation agent on IHUI AI: build glossary, upload translation memory, configure languages, train cultural adaptation, set review rules, connect to workflow. 6x faster translation, 70% cost reduction.',
      inLanguage: ['en', 'zh-CN', 'zh-TW', 'ko', 'ja'],
      totalTime: 'PT30M',
      estimatedCost: { '@type': 'MonetaryAmount', currency: 'CNY', value: '0' },
      supply: [{ '@type': 'HowToSupply', name: 'Glossary / translation memory / brand voice document / target language list' }],
      tool: [
        { '@type': 'HowToTool', name: 'IHUI AI Multilingual Translation Engine' },
        { '@type': 'HowToTool', name: 'IHUI AI Glossary Management Module' },
      ],
      step: [
        { '@type': 'HowToStep', position: 1, name: 'Build glossary', text: 'Import product, brand, and industry terms across 50+ languages; Agent enforces strict term consistency and avoids divergent translations.' },
        { '@type': 'HowToStep', position: 2, name: 'Upload translation memory', text: 'Upload prior high-quality bilingual documents; Agent learns team style so AI output matches historical human output.' },
        { '@type': 'HowToStep', position: 3, name: 'Configure target languages', text: 'Choose 50+ target languages including regional variants (e.g., Traditional vs Simplified Chinese); batch translation starts in one click.' },
        { '@type': 'HowToStep', position: 4, name: 'Train cultural adaptation', text: 'Fine-tune translation to target-market culture (Japanese keigo, Arabic RTL, Latin American vs Castilian Spanish); avoid cultural offense.' },
        { '@type': 'HowToStep', position: 5, name: 'Set review rules', text: 'Configure term consistency, number format, date format, unit conversion, and sensitive-word rules; Agent auto-flags suspicious translations.' },
        { '@type': 'HowToStep', position: 6, name: 'Connect to workflow', text: 'Integrate Git, CMS, Confluence, Notion, and Figma; translation updates sync automatically and humans only review critical content.' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'AI Multilingual Translation — Document / Localization / Glossary / Subtitle | IHUI AI',
  description:
    'Build an AI multilingual translation agent on IHUI AI: document translation + localization workflow + glossary management + review + cultural adaptation + subtitle translation. 30-minute onboarding, 8-endpoint distribution.',
  alternates: { canonical: '/en/use-cases/ai-translation' },
  openGraph: {
    title: 'AI Multilingual Translation Agent — IHUI AI',
    description: 'Multi-language translation + glossary + cultural adaptation, 30-minute onboarding.',
    url: 'https://ihui.ai/en/use-cases/ai-translation',
    type: 'article',
  },
}

const problems = [
  'Going global needs 10+ language localization; outsourcing translation costs CNY 0.3-1.5 per 1,000 characters and multiplies by 10 languages',
  'Product terms and brand names are translated inconsistently across language versions, confusing users',
  'Documentation (API, help center, manuals) updates lag behind in translated versions, fragmenting user experience',
  'Marketing copy translation lacks cultural adaptation; literal translations cause target-market backlash',
  'Subtitles, UI strings, PDF, Word, Markdown, and JSON come in many formats; switching tools manually is painful',
  'Translation quality depends on a few senior translators, capacity is limited and turnover risk is high',
]

const capabilities = [
  { title: '50+ language document translation', desc: 'Support 50+ mainstream languages (Chinese, English, Japanese, Korean, French, German, Spanish, Russian, Arabic, Portuguese, Italian, Traditional/Simplified); batch-translate Word, PDF, Markdown, JSON, and CSV with 99% term consistency.' },
  { title: 'Localization workflow', desc: 'Integrate Git, CMS, Confluence, and Notion; source changes auto-trigger translation and humans only final-review critical content.' },
  { title: 'Glossary management', desc: 'Multi-language glossary enforces term consistency; brand, product, and technical terms have 0 mistranslation; TM is reusable across projects.' },
  { title: 'Smart translation review', desc: 'Configure term consistency, number/date/unit format, and sensitive-word rules; Agent auto-flags suspicious translations and reduces human review by 75%.' },
  { title: 'Cultural adaptation', desc: 'Adjust to target-market culture (Japanese keigo levels, Arabic RTL, Latin American vs Castilian Spanish) to avoid cultural offense and raise localization quality.' },
  { title: 'Subtitle translation', desc: 'Parse and translate SRT/VTT subtitle files; timeline auto-aligned and multilingual subtitle exports; subtitle translation speed 8x.' },
]

const cases = [
  {
    title: 'Going-global SaaS: localization cost -70%',
    desc: 'A Chinese SaaS company entering 12 countries (US, JP, KR, DE, FR, ES, RU, AR, etc.) cut annual localization cost from CNY 2.4M to CNY 720K, and translation update cycle from 2 weeks to 2 days.',
  },
  {
    title: 'Cross-border e-commerce: 6x faster multi-language listing',
    desc: 'A cross-border e-commerce platform batch-translated 10-language product info (title, detail, specs) with the AI translation agent; new product launch time fell from 1.5 days to 6 hours and GMV rose 38%.',
  },
  {
    title: 'Online education: 1-day subtitle localization across 8 languages',
    desc: 'An online education platform localized 1000+ course subtitles into 8 languages (JP, KR, EN, ES, PT, RU, AR, FR); cycle dropped from 30 days to 1 day and overseas paid conversion rose 52%.',
  },
]

const toolchain = [
  { name: 'Next.js 15 + React 19', purpose: 'Web workbench for translation and glossary management' },
  { name: 'Fastify 5 + Drizzle ORM', purpose: 'API for translation memory and project version management' },
  { name: 'FastAPI + LangGraph + LiteLLM', purpose: 'Multi-language translation + cultural adaptation + review engine' },
  { name: 'MCP tool protocol', purpose: 'Adapters for Git, CMS, Confluence, Notion, and Figma' },
  { name: 'Tauri 2 desktop', purpose: 'Local document translation and offline glossary' },
  { name: 'WXT browser extension', purpose: 'One-click webpage translation and term highlighting' },
  { name: 'Taro 4 mini-program', purpose: 'Mobile photo-translation' },
  { name: 'CLI command line', purpose: 'Batch document translation and CI/CD integration' },
]

const metrics = [
  { value: '50+', label: 'Supported languages' },
  { value: '6x', label: 'Translation speed' },
  { value: '70%', label: 'Cost reduction' },
  { value: '30min', label: 'Onboarding time' },
]

export default function AiTranslationPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="mx-auto w-full max-w-6xl px-4 py-12 md:px-8 md:py-16">
        {/* Hero */}
        <section className="space-y-5 text-center">
          <div className="inline-flex items-center gap-2 rounded border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Languages className="h-3.5 w-3.5 text-primary" />
            Multilingual Translation
          </div>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            AI Multilingual Translation: 50+ languages, 70% cost reduction
          </h1>
          <p className="mx-auto max-w-3xl text-base text-muted-foreground md:text-lg">
            Built on the IHUI AI full-stack AI operating system, 8-endpoint distribution, Apache 2.0 open source, on-premise support; glossary plus cultural adaptation ensures translation quality.
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
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Localization challenges for going-global teams</h2>
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
          <h2 className="text-center text-2xl font-bold tracking-tight md:text-3xl">Six core capabilities</h2>
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
          <h2 className="text-center text-2xl font-bold tracking-tight md:text-3xl">Customer success stories</h2>
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
            <h2 className="text-center text-2xl font-bold tracking-tight md:text-3xl">Tech stack and toolchain</h2>
          </div>
          <p className="mx-auto mt-3 max-w-3xl text-center text-sm text-muted-foreground md:text-base">
            Built on the IHUI AI full-stack AI operating system with one codebase across 8 endpoints; all core components are open source, deeply integrated with Git, CMS, Confluence, and Notion.
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
          <h2 className="mt-4 text-2xl font-bold tracking-tight md:text-3xl">Start building your AI multilingual translation assistant</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground md:text-base">
            Sign up and get 1000 credits, fork the translation scenario template, and try multi-language batch translation in 30 minutes.
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
            <span className="flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> Translation consult 8801</span>
            <span className="flex items-center gap-1.5"><GraduationCap className="h-3.5 w-3.5" /> Glossary training 8805</span>
            <span className="flex items-center gap-1.5"><Palette className="h-3.5 w-3.5" /> On-premise deploy 8806</span>
            <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> Language extension 8809</span>
          </div>
        </section>
      </main>
    </>
  )
}
