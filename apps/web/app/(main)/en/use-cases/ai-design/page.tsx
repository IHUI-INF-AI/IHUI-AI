import type { Metadata } from 'next'
import Link from 'next/link'
import { Sparkles, ArrowRight, PaintBucket, AlertTriangle, Wrench, MessageSquare, GraduationCap, Palette, Globe } from 'lucide-react'

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aizhs.top/en/use-cases/ai-design#webpage',
      url: 'https://aizhs.top/en/use-cases/ai-design',
      name: 'AI Design Collaboration Agent Use Case — IHUI AI',
      description:
        'AI design collaboration agent built on IHUI AI full-stack AI operating system: poster/Logo concepts, UI sketch to code, brand asset management, design review, design system retrieval. 30-minute onboarding, 8-endpoint distribution.',
      inLanguage: ['en', 'zh-CN', 'zh-TW', 'ko', 'ja'],
      isPartOf: { '@id': 'https://aizhs.top/#website' },
      about: { '@id': 'https://aizhs.top/#organization' },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/en/use-cases/ai-design#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: 'Use Cases', item: 'https://aizhs.top/use-cases' },
        { '@type': 'ListItem', position: 3, name: 'AI Design', item: 'https://aizhs.top/en/use-cases/ai-design' },
      ],
    },
    {
      '@type': 'HowTo',
      '@id': 'https://aizhs.top/en/use-cases/ai-design#howto',
      name: '30-Minute Setup of an AI Design Collaboration Agent',
      description:
        'Six-step workflow to build an AI design collaboration agent on IHUI AI: upload brand assets, configure design system, train concept generation, enable sketch to code, set review rules, connect collaboration tools. Design cycle cut by 60%.',
      inLanguage: ['en', 'zh-CN', 'zh-TW', 'ko', 'ja'],
      totalTime: 'PT30M',
      estimatedCost: { '@type': 'MonetaryAmount', currency: 'CNY', value: '0' },
      supply: [{ '@type': 'HowToSupply', name: 'Brand VI manual / past design drafts / design system tokens' }],
      tool: [
        { '@type': 'HowToTool', name: 'IHUI AI Design Concept Engine' },
        { '@type': 'HowToTool', name: 'IHUI AI Sketch-to-Code Module' },
      ],
      step: [
        { '@type': 'HowToStep', position: 1, name: 'Upload brand assets', text: 'Upload brand VI, past posters, Logos, and design system tokens; AI extracts palette, fonts, and layout.' },
        { '@type': 'HowToStep', position: 2, name: 'Configure design system', text: 'Import Figma tokens (color, font size, spacing, radius, shadow); future generations strictly follow the system.' },
        { '@type': 'HowToStep', position: 3, name: 'Train concept generation', text: 'Train on past hit posters and Logos; AI produces 3-5 creative directions aligned with brand voice.' },
        { '@type': 'HowToStep', position: 4, name: 'Sketch to code', text: 'Upload hand-drawn UI sketches; Agent recognizes component structure and produces React + Tailwind code with 85%+ accuracy.' },
        { '@type': 'HowToStep', position: 5, name: 'Set review rules', text: 'Configure a11y, brand consistency, and responsive rules; Agent auto-reviews designs and flags required changes.' },
        { '@type': 'HowToStep', position: 6, name: 'Connect collaboration tools', text: 'Integrate Figma, Sketch, JiShi Design, Lanhu, and Notion; AI embeds into existing workflows.' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'AI Design Collaboration — Poster / Logo / Sketch-to-Code / Design System | IHUI AI',
  description:
    'Build an AI design collaboration agent on IHUI AI: poster and Logo concepts + UI sketch to code + brand asset management + design review + design system retrieval. 30-minute onboarding, 8-endpoint distribution.',
  alternates: { canonical: '/en/use-cases/ai-design' },
  openGraph: {
    title: 'AI Design Collaboration Agent — IHUI AI',
    description: 'Sketch to code + brand assets + design review, 30-minute onboarding.',
    url: 'https://aizhs.top/en/use-cases/ai-design',
    type: 'article',
  },
}

const problems = [
  'Poster, Logo, and landing page design requests concentrate on senior designers; juniors cannot deliver independently, capacity is limited',
  'Hand-drawn UI sketches to code require rounds of communication; one sketch to code averages 2-3 days',
  'Brand assets (Logo, font, palette, layout) are scattered across multiple cloud drives and local files; new hires need 1-2 weeks to ramp up',
  'Design reviews depend on senior designers, feedback cycles are long, and design system consistency is hard to maintain',
  'After design system (Figma tokens) updates, historical drafts are not synchronized, lowering design asset reuse',
  'Marketing campaigns often need ad-hoc design; schedule conflicts are common and urgent requests force designers to work overtime',
]

const capabilities = [
  { title: 'Poster / Logo concept generation', desc: 'Input brand keywords and target audience; AI produces 3-5 creative directions (palette, layout, font) for the designer to deepen, cutting concept time from 1 day to 1 hour.' },
  { title: 'UI sketch to code', desc: 'Upload hand-drawn UI sketches; Agent recognizes component structure and produces React + Tailwind code with 85%+ accuracy and team-compliant readability.' },
  { title: 'Brand asset management', desc: 'Unified management of Logo, font, palette, layout, and icons; new hires ramp in 5 minutes, and asset reuse climbs from 30% to 80%.' },
  { title: 'Smart design review', desc: 'Configure a11y, brand consistency, responsive, and contrast rules; Agent auto-reviews and flags required changes within 10 minutes.' },
  { title: 'Design system retrieval', desc: 'Natural-language query (e.g., "find a 12px-radius card component"); Agent returns the best matching historical component from the design system.' },
  { title: 'Collaboration tool integration', desc: 'Integrate Figma, Sketch, JiShi Design, Lanhu, and Notion; AI embeds into existing workflows with near-zero learning cost.' },
]

const cases = [
  {
    title: 'Internet company UGC: H5 cycle 7 days to 1.5 days',
    desc: 'A leading internet company used the AI design collaboration agent for UGC campaigns. After hand-drawn sketches, shippable H5 code was generated within 1 hour, total design + dev cycle dropped from 7 days to 1.5 days, labor cost down 70%.',
  },
  {
    title: 'New consumer brand: 5x VI rollout efficiency',
    desc: 'A new tea beverage brand expanded stores and needed 200+ materials (poster, takeout packaging, menu) quickly. The AI design collaboration agent produced 80% first drafts from the brand VI library; designers only fine-tuned, lifting rollout efficiency 5x.',
  },
  {
    title: 'B2B SaaS: 98% design system consistency',
    desc: 'A 30-person B2B SaaS design team adopted AI design review; design pass rate rose from 65% to 98%, front-end fidelity rose from 75% to 95%, and iteration efficiency climbed 60%.',
  },
]

const toolchain = [
  { name: 'Next.js 15 + React 19', purpose: 'Web workbench for design collaboration and design system management' },
  { name: 'Fastify 5 + Drizzle ORM', purpose: 'API for design asset storage and version management' },
  { name: 'FastAPI + LangGraph + LiteLLM', purpose: 'Sketch recognition + code generation + design review' },
  { name: 'MCP tool protocol', purpose: 'Adapters for Figma, Sketch, JiShi Design, and Lanhu' },
  { name: 'Tauri 2 desktop', purpose: 'Local design asset cache and offline annotation' },
  { name: 'WXT browser extension', purpose: 'One-click capture of reference material from Figma and the web' },
  { name: 'Taro 4 mini-program', purpose: 'Mobile design review and commenting' },
  { name: 'CLI command line', purpose: 'Batch design asset processing and export' },
]

const metrics = [
  { value: '60%', label: 'Design cycle cut' },
  { value: '85%', label: 'Sketch-to-code accuracy' },
  { value: '5x', label: 'Brand asset reuse' },
  { value: '30min', label: 'Onboarding time' },
]

export default function AiDesignPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8 md:py-8">
        {/* Hero */}
        <section className="space-y-5 text-center">
          <div className="inline-flex items-center gap-2 rounded border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <PaintBucket className="h-3.5 w-3.5 text-primary" />
            Design Collaboration
          </div>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            AI Design Collaboration: sketch to code plus unified brand assets
          </h1>
          <p className="mx-auto max-w-3xl text-base text-muted-foreground md:text-lg">
            Built on the IHUI AI full-stack AI operating system, 8-endpoint distribution, Apache 2.0 open source, on-premise support, with deep Figma and JiShi Design integration.
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
            <h2 className="text-xl font-bold tracking-tight md:text-2xl">Collaboration pain points in design teams</h2>
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
            Built on the IHUI AI full-stack AI operating system with one codebase across 8 endpoints; all core components are open source and deeply integrated with Figma and JiShi Design.
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
          <h2 className="mt-4 text-xl font-bold tracking-tight md:text-2xl">Start building your AI design collaboration assistant</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground md:text-base">
            Sign up and get 1000 credits, fork the design collaboration scenario template, and try sketch-to-code in 30 minutes.
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
            <span className="flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> Design consult 8801</span>
            <span className="flex items-center gap-1.5"><GraduationCap className="h-3.5 w-3.5" /> Design academy 8805</span>
            <span className="flex items-center gap-1.5"><Palette className="h-3.5 w-3.5" /> Brand custom 8806</span>
            <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> Figma plugin 8809</span>
          </div>
        </section>
      </main>
    </>
  )
}
