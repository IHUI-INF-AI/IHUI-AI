import type { Metadata } from 'next'
import Link from 'next/link'
import {
  Bot,
  ArrowRight,
  Headphones,
  Megaphone,
  PenTool,
  Code,
  BarChart3,
  BookOpen,
  Wrench,
  FolderSearch,
  Database,
  Globe,
  TerminalSquare,
  CheckCircle2,
  type LucideIcon,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription, Button } from '@ihui/ui-react'

export const metadata: Metadata = {
  title: 'AI Agent Marketplace — 200+ Agent Templates | IHUI AI',
  description:
    'Discover 200+ pre-built AI agent templates for customer service, sales, content creation, code review, data analysis. Visual orchestration, one-click deploy to 8 platforms, MCP tool protocol support. Open-source.',
  alternates: {
    canonical: '/en/agents',
    languages: {
      'x-default': '/agents',
      en: '/en/agents',
      'zh-CN': '/agents',
    },
  },
  openGraph: {
    title: 'AI Agent Marketplace — 200+ Agent Templates',
    description:
      'Visual orchestration + MCP tools + 8-end deploy. 200+ ready-to-use agent templates.',
    url: 'https://aizhs.top/en/agents',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: '/og-image-en.jpg',
        width: 1200,
        height: 630,
        alt: 'AI Agent Marketplace — 200+ Agent Templates',
        type: 'image/jpeg',
      },
    ],
  },
}

interface UseCase {
  icon: LucideIcon
  title: string
  desc: string
}

const USE_CASES: UseCase[] = [
  {
    icon: Headphones,
    title: 'Customer Service',
    desc: '24/7 multilingual support, automatic ticket routing, FAQ automation, and escalation handling.',
  },
  {
    icon: Megaphone,
    title: 'Sales & Marketing',
    desc: 'Lead qualification, personalized email outreach, content generation, and campaign analytics.',
  },
  {
    icon: PenTool,
    title: 'Content Creation',
    desc: 'Blog writing, SEO optimization, social media posts, and multilingual content at scale.',
  },
  {
    icon: Code,
    title: 'Code Review',
    desc: 'Pull request analysis, bug detection, security scanning, and automated test generation.',
  },
  {
    icon: BarChart3,
    title: 'Data Analysis',
    desc: 'Automated report generation, trend insight, anomaly detection, and natural-language queries.',
  },
  {
    icon: BookOpen,
    title: 'Knowledge Management',
    desc: 'Document Q&A, internal knowledge base, onboarding assistant, and smart search.',
  },
]

interface Step {
  number: string
  title: string
  desc: string
}

const STEPS: Step[] = [
  {
    number: '01',
    title: 'Choose a Template',
    desc: 'Pick from 200+ pre-built agent templates, or start from scratch with a blank canvas.',
  },
  {
    number: '02',
    title: 'Configure Visually',
    desc: 'Use the drag-and-drop editor to connect nodes, set prompts, and wire up tools — no code required.',
  },
  {
    number: '03',
    title: 'Deploy Everywhere',
    desc: 'One-click deploy to Web, Mobile, Desktop, CLI, and Extension — all platforms at once.',
  },
]

interface McpTool {
  icon: LucideIcon
  name: string
  desc: string
}

const MCP_TOOLS: McpTool[] = [
  { icon: FolderSearch, name: 'File System', desc: 'Read, write, and manage files' },
  { icon: Database, name: 'Database', desc: 'Query SQL and NoSQL databases' },
  { icon: Globe, name: 'API', desc: 'Call REST and GraphQL endpoints' },
  { icon: TerminalSquare, name: 'Web Search', desc: 'Search the web in real time' },
  { icon: Code, name: 'Code Execution', desc: 'Run sandboxed code safely' },
]

export default function EnglishAgentsPage() {
  return (
    <main className="h-[calc(100vh-58px)] overflow-y-auto">
      <div className="mx-auto max-w-5xl px-6 py-12 md:py-16">
        {/* Hero */}
        <section className="mb-16 flex flex-col items-center text-center md:mb-24">
          <div className="mb-4 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Bot className="h-3.5 w-3.5" />
            200+ Templates · Visual Orchestration · MCP Native
          </div>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-foreground md:text-5xl lg:text-6xl">
            AI Agent
            <br />
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Marketplace
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
            200+ pre-built agent templates. Visual orchestration. One-click deploy to 8 platforms.
          </p>
          <div className="mt-8">
            <Button asChild variant="default" size="lg">
              <Link href="/agents">
                Explore Full Marketplace
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>

        {/* Use Case Categories */}
        <section className="mb-16 md:mb-24">
          <div className="mb-8 text-center md:mb-12">
            <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Built for Every Use Case
            </h2>
            <p className="mt-3 text-muted-foreground">
              Six categories of ready-to-deploy agent templates.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {USE_CASES.map((useCase) => (
              <Card key={useCase.title} className="transition-colors hover:bg-accent/50">
                <CardHeader>
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <useCase.icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-lg">{useCase.title}</CardTitle>
                  <CardDescription className="mt-2 leading-relaxed">{useCase.desc}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        {/* How It Works */}
        <section className="mb-16 md:mb-24">
          <div className="mb-8 text-center md:mb-12">
            <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              How It Works
            </h2>
            <p className="mt-3 text-muted-foreground">
              From template to production in three steps.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {STEPS.map((step) => (
              <Card key={step.number}>
                <CardHeader>
                  <span className="text-sm font-bold text-primary">{step.number}</span>
                  <CardTitle className="mt-2 text-lg">{step.title}</CardTitle>
                  <CardDescription className="mt-2 leading-relaxed">{step.desc}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        {/* MCP Integration Section */}
        <section className="mb-16 md:mb-24">
          <Card className="overflow-hidden">
            <CardContent className="p-8 md:p-12 min-[640px]:p-8 min-[640px]:p-12">
              <div className="mb-8 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Wrench className="h-6 w-6" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                  MCP Tool Protocol Native Support
                </h2>
                <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
                  Agents can securely call external tools and data sources via the Model Context
                  Protocol. Connect your infrastructure without writing custom integrations.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {MCP_TOOLS.map((tool) => (
                  <div
                    key={tool.name}
                    className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/50"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <tool.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{tool.name}</p>
                      <p className="text-xs text-muted-foreground">{tool.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Secure Sandboxing
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Permission Scopes
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Audit Logging
                </span>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Footer CTA */}
        <section className="mb-8 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            Ready to build your agent?
          </h2>
          <p className="mt-3 text-muted-foreground">Start from a template or create your own.</p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button asChild variant="default" size="lg">
              <Link href="/agents/create">
                Start Building
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/en/pricing">View Pricing</Link>
            </Button>
          </div>
          <p className="mt-8 text-xs text-muted-foreground">
            <Link href="/agents" className="underline-offset-4 hover:underline">
              Chinese version: 智汇 AI
            </Link>
          </p>
        </section>
      </div>
    </main>
  )
}
