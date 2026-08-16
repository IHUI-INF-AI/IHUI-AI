import type { Metadata } from 'next'
import Link from 'next/link'
import {
  Sparkles,
  ArrowRight,
  BookOpen,
  AlertTriangle,
  Wrench,
  MessageSquare,
  GraduationCap,
  Palette,
  Globe,
} from 'lucide-react'

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aizhs.top/en/use-cases/ai-research#webpage',
      url: 'https://aizhs.top/en/use-cases/ai-research',
      name: 'AI Academic Research Assistant Agent Use Case — IHUI AI',
      description:
        'AI academic research assistant built on IHUI AI full-stack AI operating system: paper retrieval/review, PDF parsing, citation management, research trend analysis, cross-discipline knowledge graph. 30-minute onboarding, 8-endpoint distribution.',
      inLanguage: ['en', 'zh-CN', 'zh-TW', 'ko', 'ja'],
      isPartOf: { '@id': 'https://aizhs.top/#website' },
      about: { '@id': 'https://aizhs.top/#organization' },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/en/use-cases/ai-research#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://aizhs.top' },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Use Cases',
          item: 'https://aizhs.top/use-cases',
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: 'AI Research',
          item: 'https://aizhs.top/en/use-cases/ai-research',
        },
      ],
    },
    {
      '@type': 'HowTo',
      '@id': 'https://aizhs.top/en/use-cases/ai-research#howto',
      name: '30-Minute Setup of an AI Academic Research Assistant',
      description:
        'Six-step workflow to build an AI academic research assistant on IHUI AI: connect databases, upload literature, configure citation styles, train review generation, build knowledge graph, output trend reports. 8x faster literature research.',
      inLanguage: ['en', 'zh-CN', 'zh-TW', 'ko', 'ja'],
      totalTime: 'PT30M',
      estimatedCost: { '@type': 'MonetaryAmount', currency: 'CNY', value: '0' },
      supply: [
        {
          '@type': 'HowToSupply',
          name: 'Research keywords / prior PDF literature / citation style (APA/MLA/Chicago)',
        },
      ],
      tool: [
        { '@type': 'HowToTool', name: 'IHUI AI Literature Retrieval Engine' },
        { '@type': 'HowToTool', name: 'IHUI AI PDF Parsing Module' },
      ],
      step: [
        {
          '@type': 'HowToStep',
          position: 1,
          name: 'Connect academic databases',
          text: 'Integrate 30+ databases such as arXiv, PubMed, IEEE, CNKI, and Wanfang, with daily ingestion of newly published papers.',
        },
        {
          '@type': 'HowToStep',
          position: 2,
          name: 'Upload PDF literature',
          text: 'Batch-upload prior PDF papers; AI extracts title, authors, abstract, and references to build a local library.',
        },
        {
          '@type': 'HowToStep',
          position: 3,
          name: 'Configure citation styles',
          text: 'Choose from APA, MLA, Chicago, GB/T 7714, IEEE, and Vancouver; references are generated to journal specifications.',
        },
        {
          '@type': 'HowToStep',
          position: 4,
          name: 'Train review model',
          text: 'Agent learns the team prior review-writing style and produces structured literature reviews with minimal editing.',
        },
        {
          '@type': 'HowToStep',
          position: 5,
          name: 'Build knowledge graph',
          text: 'Extract entities (authors, institutions, methods, datasets) and relationships; visualize cross-discipline exploration.',
        },
        {
          '@type': 'HowToStep',
          position: 6,
          name: 'Output trend reports',
          text: 'Time-series and topic models surface research hotspots, emerging methods, and potential collaborators weekly.',
        },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'AI Academic Research Assistant — Paper Retrieval / Review / Citation | IHUI AI',
  description:
    'Build an AI academic research assistant on IHUI AI: paper retrieval + PDF parsing + citation management + review generation + knowledge graph + trend analysis. 30-minute onboarding, 8-endpoint distribution, Apache 2.0 open source.',
  alternates: { canonical: '/en/use-cases/ai-research' },
  openGraph: {
    title: 'AI Academic Research Assistant — IHUI AI',
    description:
      'Literature retrieval + review generation + knowledge graph, 30-minute onboarding.',
    url: 'https://aizhs.top/en/use-cases/ai-research',
    type: 'article',
  },
}

const problems = [
  'Cross-database searches across arXiv, PubMed, CNKI, Wanfang, and Google Scholar take time; new researchers need 2-3 months to map core literature in a field',
  'PDF papers pile up; reading 100 papers manually takes 40 hours on average, making information extraction highly inefficient',
  'Manual reference formatting in APA, MLA, Chicago, GB/T 7714 is error-prone and damages submission quality',
  'Literature reviews depend on individual experience; cross-discipline links are hard to surface, limiting innovation discovery',
  'Research hotspots change quickly; weekly or monthly manual tracking lags and causes missed collaboration opportunities',
  'Each research-group member maintains their own literature library; knowledge assets do not accumulate or get reused across the team',
]

const capabilities = [
  {
    title: '30+ Database cross-search',
    desc: 'Integrate arXiv, PubMed, IEEE, CNKI, Wanfang, Springer, and Elsevier in one search entry; new papers are ingested daily.',
  },
  {
    title: 'Smart PDF parsing',
    desc: 'Batch-parse PDFs to extract title, authors, abstract, figures, formulas, and references. 100-paper parsing time drops from 40 hours to 20 minutes.',
  },
  {
    title: 'Auto citation style generation',
    desc: 'Support 20+ citation styles including APA, MLA, Chicago, GB/T 7714, and IEEE Vancouver; references are formatted to journal requirements.',
  },
  {
    title: 'Literature review generation',
    desc: 'Agent learns the team review-writing style and produces structured reviews; cycle drops from 2 weeks to 2 days.',
  },
  {
    title: 'Cross-discipline knowledge graph',
    desc: 'Extract entities (authors, institutions, methods, datasets) and relationships; visualize the graph and discover potential collaborators.',
  },
  {
    title: 'Research trend analysis',
    desc: 'Time-series and topic models track research hotspots, emerging methods, and highly-cited papers; weekly trend reports support topic selection.',
  },
]

const cases = [
  {
    title: 'University lab: PhD research cycle from 2 months to 1 week',
    desc: 'A 985-university computer science lab onboarded 12 PhD students to the AI research assistant. Literature reading efficiency rose 8x, average review writing time dropped from 14 days to 2.5 days, and SCI publications increased 35% year-over-year.',
  },
  {
    title: 'Research institute: 60% shorter cross-discipline project cycle',
    desc: 'A Chinese research institute used the knowledge graph in the AI research assistant to surface intersections between bioinformatics and materials science, helping launch 8 cross-discipline projects; average project cycle dropped from 6 months to 2.4 months.',
  },
  {
    title: 'Enterprise R&D: automated technical intelligence weekly report',
    desc: 'An AI foundation-model company uses the AI research assistant to monitor new papers across 30+ top conferences (NeurIPS, ICML, CVPR, ACL); a weekly intelligence report is auto-generated every Monday, accelerating the R&D team response to frontier research by 5x.',
  },
]

const toolchain = [
  {
    name: 'Next.js 15 + React 19',
    purpose: 'Web workbench for literature retrieval, reading, and writing',
  },
  {
    name: 'Fastify 5 + Drizzle ORM',
    purpose: 'API for literature metadata management and access control',
  },
  {
    name: 'FastAPI + LangGraph + LiteLLM',
    purpose: 'PDF parsing + review generation + knowledge graph extraction',
  },
  { name: 'MCP tool protocol', purpose: 'Adapters for arXiv, PubMed, CNKI, Wanfang data sources' },
  { name: 'Tauri 2 desktop', purpose: 'Offline literature library and local PDF annotation' },
  {
    name: 'WXT browser extension',
    purpose: 'One-click import of papers from Google Scholar and PubMed',
  },
  { name: 'Taro 4 mini-program', purpose: 'Mobile fast-reading and quick notes' },
  { name: 'CLI command line', purpose: 'Batch literature management and BibTeX export' },
]

const metrics = [
  { value: '30+', label: 'Academic databases' },
  { value: '8x', label: 'Literature research speed' },
  { value: '20+', label: 'Citation styles' },
  { value: '30min', label: 'Onboarding time' },
]

export default function AiResearchPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 min-[768px]:px-8 min-[768px]:py-8">
        {/* Hero */}
        <section className="space-y-5 text-center">
          <div className="inline-flex items-center gap-2 rounded border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <BookOpen className="h-3.5 w-3.5 text-primary" />
            Academic Research
          </div>
          <h1 className="text-4xl font-bold tracking-tight min-[768px]:text-5xl">
            AI Academic Research Assistant: 8x faster literature research
          </h1>
          <p className="mx-auto max-w-3xl text-base text-muted-foreground min-[768px]:text-lg">
            Built on the IHUI AI full-stack AI operating system, distributed across 8 endpoints
            (Web, desktop, mini-program, browser extension, RN, CLI, API, AI-Service), Apache 2.0
            open source, with on-premise deployment support.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 pt-2">
            {metrics.map((m) => (
              <div key={m.label} className="text-center">
                <div className="text-2xl font-bold text-primary min-[768px]:text-3xl">
                  {m.value}
                </div>
                <div className="mt-1 text-xs text-muted-foreground min-[768px]:text-sm">
                  {m.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Problems */}
        <section className="mt-16 rounded-2xl border bg-card p-8 min-[768px]:p-12">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <h2 className="text-xl font-bold tracking-tight min-[768px]:text-2xl">
              Real pain points of researchers
            </h2>
          </div>
          <ul className="mt-6 space-y-3">
            {problems.map((p, i) => (
              <li
                key={i}
                className="flex items-start gap-3 text-sm leading-relaxed text-muted-foreground min-[768px]:text-base"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
                {p}
              </li>
            ))}
          </ul>
        </section>

        {/* Capabilities */}
        <section className="mt-16">
          <h2 className="text-center text-xl font-bold tracking-tight min-[768px]:text-2xl">
            Six core capabilities
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-6 min-[768px]:grid-cols-2 min-[1024px]:grid-cols-3">
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
        <section className="mt-16 rounded-2xl border bg-primary/5 p-8 min-[768px]:p-12">
          <h2 className="text-center text-xl font-bold tracking-tight min-[768px]:text-2xl">
            Customer success stories
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-6 min-[768px]:grid-cols-3">
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
            <h2 className="text-center text-xl font-bold tracking-tight min-[768px]:text-2xl">
              Tech stack and toolchain
            </h2>
          </div>
          <p className="mx-auto mt-3 max-w-3xl text-center text-sm text-muted-foreground min-[768px]:text-base">
            Built on the IHUI AI full-stack AI operating system with one codebase across 8
            endpoints; all core components are open source.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-4 min-[768px]:grid-cols-2 min-[1024px]:grid-cols-4">
            {toolchain.map((t, i) => (
              <div key={i} className="rounded-2xl border bg-card p-5">
                <h3 className="text-sm font-semibold">{t.name}</h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t.purpose}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Contact/CTA */}
        <section className="mt-16 rounded-2xl border bg-card p-8 text-center min-[768px]:p-12">
          <Sparkles className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-4 text-xl font-bold tracking-tight min-[768px]:text-2xl">
            Start building your AI academic research assistant
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground min-[768px]:text-base">
            Sign up and get 1000 credits, fork the academic research scenario template, and try it
            in 30 minutes.
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
            <span className="flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" /> Consult port 8801
            </span>
            <span className="flex items-center gap-1.5">
              <GraduationCap className="h-3.5 w-3.5" /> Teaching edition 8802
            </span>
            <span className="flex items-center gap-1.5">
              <Palette className="h-3.5 w-3.5" /> Lab deployment 8803
            </span>
            <span className="flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" /> Mirror acceleration 8809
            </span>
          </div>
        </section>
      </main>
    </>
  )
}
