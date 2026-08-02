import type { Metadata } from 'next'
import Link from 'next/link'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  Button,
} from '@ihui/ui-react'
import {
  BookOpen,
  Rocket,
  Bot,
  Database,
  Wrench,
  Code,
  Github,
  ArrowRight,
  Users,
  Mail,
} from 'lucide-react'

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aizhs.top/en/docs#webpage',
      url: 'https://aizhs.top/en/docs',
      name: 'Documentation — Guides & API Reference | IHUI AI',
      description:
        'Comprehensive documentation for IHUI AI. Quick start guide, API reference, RAG knowledge base setup, MCP tool protocol, agent development, workflow orchestration.',
      inLanguage: ['en', 'zh-CN'],
      isPartOf: { '@id': 'https://aizhs.top/#website' },
      about: { '@id': 'https://aizhs.top/#organization' },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/en/docs#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: 'Documentation', item: 'https://aizhs.top/en/docs' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'Documentation — Guides & API Reference | IHUI AI',
  description:
    'Comprehensive documentation for IHUI AI. Quick start guide, API reference, RAG knowledge base setup, MCP tool protocol, agent development, workflow orchestration. Build your AI application with detailed guides.',
  alternates: {
    canonical: '/en/docs',
    languages: {
      'x-default': '/docs',
      en: '/en/docs',
      'zh-CN': '/docs',
    },
  },
  openGraph: {
    title: 'Documentation — Guides & API Reference',
    description: 'Quick start, API reference, RAG, MCP, agent development guides.',
    url: 'https://aizhs.top/en/docs',
    type: 'website',
    locale: 'en_US',
  },
}

const quickStartCards = [
  {
    title: '5-Minute Setup',
    description:
      'Deploy IHUI AI with Docker Compose in under five minutes. Pre-built images, sensible defaults, one-command startup.',
    href: '/docs/quickstart',
    icon: Rocket,
  },
  {
    title: 'First Agent',
    description:
      'Build your first AI agent with the visual editor. Wire up prompts, tools, and knowledge bases without writing code.',
    href: '/docs/quickstart',
    icon: Bot,
  },
  {
    title: 'First RAG',
    description:
      'Set up a knowledge base, ingest documents, and watch retrieval-augmented generation cite its sources accurately.',
    href: '/docs/rag',
    icon: Database,
  },
]

const docCategories = [
  {
    title: 'Getting Started',
    description:
      'Installation, configuration, and first steps. Go from zero to a running IHUI AI instance.',
    href: '/docs/manual/getting-started',
    icon: BookOpen,
  },
  {
    title: 'AI Chat',
    description:
      'Chat interface, conversation management, multimodal input (images, files, voice).',
    href: '/docs/manual/ai-chat',
    icon: Users,
  },
  {
    title: 'Agent Development',
    description:
      'Build, deploy, and monetize agents. Visual orchestration, templates, and best practices.',
    href: '/docs/agent',
    icon: Bot,
  },
  {
    title: 'Knowledge Base (RAG)',
    description:
      'Document ingestion, vector retrieval, BM25 hybrid search, citation tracking, knowledge graph.',
    href: '/docs/rag',
    icon: Database,
  },
  {
    title: 'MCP Integration',
    description:
      'Model Context Protocol tool servers, server management, custom tool development.',
    href: '/docs/mcp',
    icon: Wrench,
  },
  {
    title: 'API Reference',
    description:
      'REST API endpoints, OpenAI-compatible chat completions, webhooks, and OpenAPI 3.1 spec.',
    href: '/docs/api',
    icon: Code,
  },
]

const architectureModules = [
  { name: 'apps/web', desc: 'Next.js 15 + React 19 frontend (Tailwind 4 + shadcn/ui).' },
  { name: 'apps/api', desc: 'Fastify 5 + Drizzle ORM backend (PostgreSQL).' },
  { name: 'apps/ai-service', desc: 'FastAPI + LangGraph AI service (LiteLLM + MCP).' },
  { name: 'packages/', desc: 'Shared database / auth / types / ui across all 8 endpoints.' },
]

const supportCards = [
  {
    title: 'GitHub Issues',
    description: 'Bug reports, feature requests, and pull requests. Apache 2.0 open source.',
    href: 'https://github.com/IHUI-INF-AI/IHUI-AI/issues',
    icon: Github,
  },
  {
    title: 'Community Forum',
    description: 'Questions & answers, discussions, showcases, and community templates.',
    href: '/asks',
    icon: Users,
  },
  {
    title: 'Email Support',
    description: 'Direct support for enterprise customers and integration questions.',
    href: 'mailto:support@aizhs.top',
    icon: Mail,
  },
]

export default function EnDocsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="mx-auto w-full max-w-6xl px-4 py-10 min-[768px]:px-8 min-[768px]:py-14">
        {/* Hero */}
        <section className="space-y-5 text-center">
          <div className="inline-flex items-center gap-2 rounded border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <BookOpen className="h-3.5 w-3.5 text-primary" />
            Documentation
          </div>
          <h1 className="text-4xl font-bold tracking-tight min-[768px]:text-5xl">
            Documentation &amp; Guides
          </h1>
          <p className="mx-auto max-w-3xl text-base text-muted-foreground min-[768px]:text-lg">
            Everything you need to build with IHUI AI. Quick start, API reference, tutorials.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button asChild variant="default">
              <Link href="/docs">
                Read Full Docs (Chinese)
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/docs/quickstart">Quick Start</Link>
            </Button>
          </div>
        </section>

        {/* Quick Start */}
        <section className="mt-16">
          <div className="flex items-center gap-3">
            <Rocket className="h-6 w-6 text-primary" />
            <h2 className="text-xl font-bold tracking-tight min-[768px]:text-2xl">Quick Start</h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground min-[768px]:text-base">
            Ship your first AI feature in minutes. Each guide links to the full Chinese documentation.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-6 min-[768px]:grid-cols-2 min-[1024px]:grid-cols-3">
            {quickStartCards.map((card) => {
              const Icon = card.icon
              return (
                <Card key={card.title} className="flex flex-col">
                  <CardHeader>
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="mt-3 text-base">{card.title}</CardTitle>
                    <CardDescription className="mt-1 text-sm leading-relaxed">
                      {card.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="mt-auto">
                    <Link
                      href={card.href}
                      className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                    >
                      Learn More
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>

        {/* Documentation Categories */}
        <section className="mt-16">
          <div className="flex items-center gap-3">
            <BookOpen className="h-6 w-6 text-primary" />
            <h2 className="text-xl font-bold tracking-tight min-[768px]:text-2xl">
              Documentation Categories
            </h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground min-[768px]:text-base">
            Six core areas covering the full IHUI AI platform.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-6 min-[768px]:grid-cols-2 min-[1024px]:grid-cols-3">
            {docCategories.map((cat) => {
              const Icon = cat.icon
              return (
                <Card key={cat.title} className="flex flex-col">
                  <CardHeader>
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="mt-3 text-base">{cat.title}</CardTitle>
                    <CardDescription className="mt-1 text-sm leading-relaxed">
                      {cat.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="mt-auto">
                    <Button asChild variant="outline" size="sm">
                      <Link href={cat.href}>
                        Read
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>

        {/* Code Example */}
        <section className="mt-16 rounded-2xl border bg-card p-6 min-[768px]:p-10">
          <div className="flex items-center gap-3">
            <Code className="h-6 w-6 text-primary" />
            <h2 className="text-xl font-bold tracking-tight min-[768px]:text-2xl">
              Quick API Example
            </h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground min-[768px]:text-base">
            Install the CLI, scaffold a project, and start developing in three commands.
          </p>
          <pre className="mt-6 overflow-x-auto rounded-lg border bg-background p-4 text-xs leading-relaxed text-foreground min-[768px]:text-sm">
            <code>{`# Install CLI
npm install -g @ihui/cli

# Initialize a project
ihui init my-ai-app

# Start development
cd my-ai-app && ihui dev`}</code>
          </pre>
        </section>

        {/* Architecture Overview */}
        <section className="mt-16">
          <div className="flex items-center gap-3">
            <Wrench className="h-6 w-6 text-primary" />
            <h2 className="text-xl font-bold tracking-tight min-[768px]:text-2xl">
              Architecture Overview
            </h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground min-[768px]:text-base">
            IHUI AI is a TypeScript monorepo (pnpm workspace + Turborepo) spanning 8 endpoints. One codebase, every platform.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-4 min-[768px]:grid-cols-2">
            {architectureModules.map((mod) => (
              <div
                key={mod.name}
                className="rounded-xl border bg-card p-5"
              >
                <div className="font-mono text-sm font-semibold text-primary">{mod.name}</div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{mod.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-6">
            <Button asChild variant="outline">
              <Link href="/docs">
                View Architecture Details
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>

        {/* Community & Support */}
        <section className="mt-16">
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-primary" />
            <h2 className="text-xl font-bold tracking-tight min-[768px]:text-2xl">
              Community &amp; Support
            </h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground min-[768px]:text-base">
            Get help, report issues, and connect with other builders.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-6 min-[768px]:grid-cols-2 min-[1024px]:grid-cols-3">
            {supportCards.map((card) => {
              const Icon = card.icon
              return (
                <Card key={card.title} className="flex flex-col">
                  <CardHeader>
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="mt-3 text-base">{card.title}</CardTitle>
                    <CardDescription className="mt-1 text-sm leading-relaxed">
                      {card.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="mt-auto">
                    <Button asChild variant="outline" size="sm">
                      <Link href={card.href}>Open</Link>
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>

        {/* Footer CTA */}
        <section className="mt-16 rounded-2xl border bg-primary/5 p-8 text-center min-[768px]:p-12">
          <h2 className="text-xl font-bold tracking-tight min-[768px]:text-2xl">
            Ready to build?
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground min-[768px]:text-base">
            Launch your first AI agent on IHUI AI today. Apache 2.0 open source, 8-endpoint distribution.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button asChild variant="default">
              <Link href="/agents">
                Start Building
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <a
                href="https://github.com/IHUI-INF-AI/IHUI-AI"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github className="h-4 w-4" />
                View on GitHub
              </a>
            </Button>
          </div>
        </section>
      </main>
    </>
  )
}
