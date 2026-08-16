import type { Metadata } from 'next'
import Link from 'next/link'
import {
  Sparkles,
  ArrowRight,
  GraduationCap,
  AlertTriangle,
  Wrench,
  MessageSquare,
  Palette,
  Globe,
  Lightbulb,
} from 'lucide-react'

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aizhs.top/en/use-cases/ai-edu#webpage',
      url: 'https://aizhs.top/en/use-cases/ai-edu',
      name: 'AI Smart Education Agent Use Case — IHUI AI',
      description:
        'AI smart education agent built on IHUI AI full-stack AI operating system: personalized learning path, smart Q&A, question generation and grading, learning data analytics, teaching collaboration, parent-school communication. 30-minute onboarding, 8-endpoint distribution.',
      inLanguage: ['en', 'zh-CN', 'zh-TW', 'ko', 'ja'],
      isPartOf: { '@id': 'https://aizhs.top/#website' },
      about: { '@id': 'https://aizhs.top/#organization' },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/en/use-cases/ai-edu#breadcrumb',
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
          name: 'AI Education',
          item: 'https://aizhs.top/en/use-cases/ai-edu',
        },
      ],
    },
    {
      '@type': 'HowTo',
      '@id': 'https://aizhs.top/en/use-cases/ai-edu#howto',
      name: '30-Minute Setup of an AI Smart Education Agent',
      description:
        'Six-step workflow to build an AI smart education agent on IHUI AI: configure student data, train learning path model, integrate question bank, set grading rules, enable analytics, connect parent-school communication. 100% personalized coverage.',
      inLanguage: ['en', 'zh-CN', 'zh-TW', 'ko', 'ja'],
      totalTime: 'PT30M',
      estimatedCost: { '@type': 'MonetaryAmount', currency: 'CNY', value: '0' },
      supply: [
        {
          '@type': 'HowToSupply',
          name: 'Student data / question bank / textbook / teaching research docs',
        },
      ],
      tool: [
        { '@type': 'HowToTool', name: 'IHUI AI Personalized Learning Path Engine' },
        { '@type': 'HowToTool', name: 'IHUI AI Smart Question Bank Module' },
      ],
      step: [
        {
          '@type': 'HowToStep',
          position: 1,
          name: 'Configure student data',
          text: 'Import historical grades, homework, and learning behavior; AI builds student profiles and identifies strengths and weaknesses.',
        },
        {
          '@type': 'HowToStep',
          position: 2,
          name: 'Train learning path',
          text: 'Train a personalized path model on knowledge graph and historical data; daily and weekly plans are auto-generated for each student.',
        },
        {
          '@type': 'HowToStep',
          position: 3,
          name: 'Integrate question bank',
          text: 'Connect school, district, or third-party question banks (K12, language, vocational); AI auto-generates tests matching student level.',
        },
        {
          '@type': 'HowToStep',
          position: 4,
          name: 'Set grading rules',
          text: 'Configure rules for objective and subjective questions (essay, free response); Agent grades 24/7 with 85%+ accuracy on subjective questions.',
        },
        {
          '@type': 'HowToStep',
          position: 5,
          name: 'Enable analytics',
          text: 'Aggregate class, grade, and subject data; auto-generate learning reports and surface common weaknesses to support teaching research.',
        },
        {
          '@type': 'HowToStep',
          position: 6,
          name: 'Parent-school communication',
          text: 'Connect WeChat, DingTalk, and WeCom parent apps; auto-push weekly reports, homework status, and progress highlights.',
        },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'AI Smart Education — Personalized Learning / Smart Q&A / Parent-School | IHUI AI',
  description:
    'Build an AI smart education agent on IHUI AI: personalized learning path + smart Q&A + question generation and grading + learning analytics + teaching collaboration + parent-school communication. 30-minute onboarding, 8-endpoint distribution.',
  alternates: { canonical: '/en/use-cases/ai-edu' },
  openGraph: {
    title: 'AI Smart Education Agent — IHUI AI',
    description: 'Personalized learning path + smart Q&A + grading, 30-minute onboarding.',
    url: 'https://aizhs.top/en/use-cases/ai-edu',
    type: 'article',
  },
}

const problems = [
  'In large classes (40-60 students) teachers cannot tailor learning paths; advanced students are unchallenged and struggling students fall behind',
  'After-class Q&A depends on teacher online hours; student questions pile up on evenings and weekends, hurting learning continuity',
  'Grading (especially essays and subjective questions) consumes teacher time; delayed feedback weakens error correction',
  'Student data (grades, homework, in-class behavior) is scattered across systems; teachers cannot analyze holistically and teaching research is slow',
  'Teaching research collaboration (lesson plans, slides, questions) lacks a unified platform; high-quality resources are hard to share across schools or districts',
  'Parent-school communication relies on parents meetings and WeChat groups; information is asymmetric and parents cannot grasp student status in time',
]

const capabilities = [
  {
    title: 'Personalized learning path',
    desc: 'Knowledge graph and student profiles power dynamic daily and weekly plans; advanced students extend while struggling students get targeted support, scaling differentiated teaching.',
  },
  {
    title: '7x24 smart Q&A',
    desc: 'AI Q&A agent answers student questions around the clock using subject knowledge graphs and historical Q&A; 30-second response, 92% accuracy across K12 subjects.',
  },
  {
    title: 'Smart question generation and grading',
    desc: 'Question bank integration auto-generates tests at student level; objective questions graded instantly and subjective questions (essays, free response) at 85%+ accuracy, cutting teacher workload 70%.',
  },
  {
    title: 'Learning data analytics',
    desc: 'Aggregate class, grade, and subject data; auto-generate learning reports and identify common weaknesses to support data-driven teaching.',
  },
  {
    title: 'Teaching research collaboration',
    desc: 'Unified management of lesson plans, slides, questions, and reflections; cross-school and cross-district sharing raises high-quality resource reuse from 30% to 75%.',
  },
  {
    title: 'Parent-school communication',
    desc: 'Connect WeChat, DingTalk, and WeCom parent apps; auto-push weekly reports, homework status, and progress highlights, lifting parent satisfaction 60%.',
  },
]

const cases = [
  {
    title: 'District education bureau: 30K students on personalized learning',
    desc: 'A district bureau in a Chinese municipality onboarded the AI smart education agent across 32 schools and 30,000 students. The agent handles 2.8M Q&A per month, grading efficiency rose 8x, and teacher time for personalized mentoring increased 35%.',
  },
  {
    title: 'K12 training institution: renewal rate +25%',
    desc: 'A leading K12 training institution used the AI smart education agent. Weekly learning reports help parents see progress; renewal rate climbed from 62% to 87% and parent complaints dropped 70%.',
  },
  {
    title: 'University: 7x24 Q&A coverage for general courses',
    desc: 'A 985 university used the AI Q&A agent for general courses (calculus, English, computer basics). Student questions get answers within 30 seconds; teachers are freed from repetitive Q&A to focus on course design and course pass rates rose 18%.',
  },
]

const toolchain = [
  { name: 'Next.js 15 + React 19', purpose: 'Web teaching admin console and learning dashboard' },
  {
    name: 'Fastify 5 + Drizzle ORM',
    purpose: 'API for student data storage and permission isolation',
  },
  {
    name: 'FastAPI + LangGraph + LiteLLM',
    purpose: 'Personalized path + smart Q&A + subjective grading',
  },
  {
    name: 'MCP tool protocol',
    purpose:
      'Adapters for question banks, textbooks, learning systems, and parent-school platforms',
  },
  {
    name: 'Tauri 2 desktop',
    purpose: 'Teacher offline lesson preparation and local question bank',
  },
  {
    name: 'WXT browser extension',
    purpose: 'One-click capture from teaching research sites and question banks',
  },
  {
    name: 'Taro 4 mini-program',
    purpose: 'Student photo question search and parent learning report',
  },
  { name: 'CLI command line', purpose: 'Batch question bank import and student data export' },
]

const metrics = [
  { value: '100%', label: 'Personalized coverage' },
  { value: '70%', label: 'Teacher workload cut' },
  { value: '92%', label: 'Q&A accuracy' },
  { value: '30min', label: 'Onboarding time' },
]

export default function AiEduPage() {
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
            <GraduationCap className="h-3.5 w-3.5 text-primary" />
            Smart Education
          </div>
          <h1 className="text-4xl font-bold tracking-tight min-[768px]:text-5xl">
            AI Smart Education: a personalized learning path for every student
          </h1>
          <p className="mx-auto max-w-3xl text-base text-muted-foreground min-[768px]:text-lg">
            Built on the IHUI AI full-stack AI operating system, 8-endpoint distribution, Apache 2.0
            open source, on-premise support; covers K12, higher education, and vocational training.
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
              Real challenges facing educators
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
            endpoints; all core components are open source; covers K12, higher education, and
            vocational training scenarios.
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
            Start building your AI smart education assistant
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground min-[768px]:text-base">
            Sign up and get 1000 credits, fork the smart education scenario template, and try
            personalized learning in 30 minutes.
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
              <MessageSquare className="h-3.5 w-3.5" /> Education consult 8801
            </span>
            <span className="flex items-center gap-1.5">
              <Lightbulb className="h-3.5 w-3.5" /> Teaching research 8805
            </span>
            <span className="flex items-center gap-1.5">
              <Palette className="h-3.5 w-3.5" /> Campus deploy 8806
            </span>
            <span className="flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" /> District solution 8809
            </span>
          </div>
        </section>
      </main>
    </>
  )
}
