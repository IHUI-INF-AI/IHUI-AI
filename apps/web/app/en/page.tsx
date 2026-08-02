import type { Metadata } from 'next'
import Link from 'next/link'
import {
  Sparkles,
  Bot,
  Database,
  Cpu,
  Wrench,
  Workflow,
  Github,
  ArrowRight,
  Globe,
  Layers,
  Smartphone,
  Monitor,
  Terminal,
  Puzzle,
  Server,
  Cog,
  CheckCircle2,
  Boxes,
  type LucideIcon,
} from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  Button,
} from '@ihui/ui-react'

export const metadata: Metadata = {
  title: 'IHUI AI — All-in-One AI Operating System | Agent Marketplace & RAG',
  description:
    'IHUI AI is an open-source full-stack AI operating system. Build, deploy, and scale AI agents across 8 platforms (Web/Desktop/Mobile/CLI/Extension/Miniapp). Integrates Agent marketplace, RAG knowledge base, multi-model dispatch (OpenAI/Claude/Gemini/Qwen/DeepSeek), MCP tool protocol. Apache 2.0 licensed.',
  alternates: {
    canonical: '/en',
    languages: {
      'x-default': '/',
      en: '/en',
      'zh-CN': '/',
    },
  },
  openGraph: {
    title: 'IHUI AI — All-in-One AI Operating System',
    description:
      'Open-source AI platform: Agent marketplace, RAG, multi-model dispatch, 8-end sync. Apache 2.0.',
    url: 'https://aizhs.top/en',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: '/og-image-en.jpg',
        width: 1200,
        height: 630,
        alt: 'IHUI AI — All-in-One AI Operating System',
        type: 'image/jpeg',
      },
    ],
  },
}

interface Feature {
  icon: LucideIcon
  title: string
  desc: string
}

const FEATURES: Feature[] = [
  {
    icon: Boxes,
    title: '8-End Sync',
    desc: 'Web / Desktop / Mobile / CLI / Extension / Miniapp — one codebase, eight platforms. Ship everywhere from a single source.',
  },
  {
    icon: Bot,
    title: 'Agent Marketplace',
    desc: '200+ pre-built agent templates for customer service, sales, content creation, and code review. Deploy in one click.',
  },
  {
    icon: Database,
    title: 'RAG Knowledge Base',
    desc: '30+ data sources, hybrid retrieval (vector + BM25 + knowledge graph). Ground your agents in your private data.',
  },
  {
    icon: Cpu,
    title: 'Multi-Model Dispatch',
    desc: '176+ models from OpenAI, Claude, Gemini, Qwen, and DeepSeek. Auto-fallback, smart routing, one unified API.',
  },
  {
    icon: Wrench,
    title: 'MCP Tool Protocol',
    desc: 'Native Model Context Protocol support. Securely let agents call external tools, APIs, and data sources.',
  },
  {
    icon: Workflow,
    title: 'Workflow Orchestration',
    desc: 'n8n-style visual node canvas. Drag-and-drop AI automation with branching, loops, and human-in-the-loop steps.',
  },
]

const MODEL_PROVIDERS = [
  { name: 'OpenAI', count: '30+ models' },
  { name: 'Anthropic', count: '10+ models' },
  { name: 'Google Gemini', count: '15+ models' },
  { name: 'Alibaba Qwen', count: '20+ models' },
  { name: 'Baidu ERNIE', count: '12+ models' },
  { name: 'DeepSeek', count: '8+ models' },
  { name: 'Zhipu GLM', count: '10+ models' },
  { name: 'ByteDance Doubao', count: '15+ models' },
  { name: 'Moonshot Kimi', count: '6+ models' },
]

interface Platform {
  icon: LucideIcon
  name: string
  desc: string
}

const PLATFORMS: Platform[] = [
  { icon: Globe, name: 'Web', desc: 'Next.js 15 + React 19' },
  { icon: Monitor, name: 'Desktop', desc: 'Windows / macOS / Linux' },
  { icon: Smartphone, name: 'Mobile', desc: 'iOS / Android (RN)' },
  { icon: Terminal, name: 'CLI', desc: 'Developer terminal tool' },
  { icon: Puzzle, name: 'Extension', desc: 'Browser extension' },
  { icon: Layers, name: 'Miniapp', desc: 'WeChat miniapp (Taro)' },
  { icon: Server, name: 'API', desc: 'Fastify 5 REST + WebSocket' },
  { icon: Cog, name: 'AI Service', desc: 'FastAPI + LangGraph' },
]

export default function EnglishHomePage() {
  return (
    <main className="h-[calc(100vh-58px)] overflow-y-auto">
      <div className="mx-auto max-w-5xl px-6 py-12 md:py-16">
        {/* Hero Section */}
        <section className="mb-16 flex flex-col items-center text-center md:mb-24">
          <div className="mb-4 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            Open-source · Apache 2.0 · Self-hostable
          </div>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-foreground md:text-5xl lg:text-6xl">
            IHUI AI — The All-in-One
            <br />
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              AI Operating System
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
            Build, deploy, and scale AI agents across 8 platforms. Open-source.
            Apache 2.0.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild variant="default" size="lg">
              <Link href="/en/agents">
                Explore Agents
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/en/pricing">View Pricing</Link>
            </Button>
          </div>
        </section>

        {/* Key Features Grid */}
        <section className="mb-16 md:mb-24">
          <div className="mb-8 text-center md:mb-12">
            <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Everything You Need to Ship AI
            </h2>
            <p className="mt-3 text-muted-foreground">
              Six core capabilities, one unified platform.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <Card
                key={feature.title}
                className="transition-colors hover:bg-accent/50"
              >
                <CardHeader>
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                  <CardDescription className="mt-2 leading-relaxed">
                    {feature.desc}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        {/* Supported Models Section */}
        <section className="mb-16 md:mb-24">
          <div className="mb-8 text-center md:mb-12">
            <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              176+ AI Models, One API
            </h2>
            <p className="mt-3 text-muted-foreground">
              Nine leading model providers, unified under a single interface.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {MODEL_PROVIDERS.map((provider) => (
              <Card
                key={provider.name}
                className="transition-colors hover:bg-accent/50"
              >
                <CardContent className="flex flex-col items-center gap-1 p-4 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-foreground">
                    <Cpu className="h-5 w-5" />
                  </div>
                  <span className="mt-2 text-sm font-medium text-foreground">
                    {provider.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {provider.count}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* 8-End Platform Section */}
        <section className="mb-16 md:mb-24">
          <div className="mb-8 text-center md:mb-12">
            <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Eight Platforms, One Codebase
            </h2>
            <p className="mt-3 text-muted-foreground">
              Write once. Deploy to web, desktop, mobile, CLI, and more.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {PLATFORMS.map((platform) => (
              <Card
                key={platform.name}
                className="transition-colors hover:bg-accent/50"
              >
                <CardContent className="flex flex-col items-center gap-2 p-4 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <platform.icon className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {platform.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {platform.desc}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Open Source Section */}
        <section className="mb-16 md:mb-24">
          <Card className="overflow-hidden">
            <CardContent className="flex flex-col items-center gap-6 p-8 text-center md:p-12">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Github className="h-7 w-7" />
              </div>
              <div className="max-w-2xl">
                <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                  Open Source. Apache 2.0.
                </h2>
                <p className="mt-4 text-muted-foreground">
                  Self-hosted deployment with Docker Compose one-click setup.
                  Full source code, no vendor lock-in, community-driven.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Apache 2.0 License
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Docker Compose Setup
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  No Vendor Lock-in
                </span>
              </div>
              <Button asChild variant="default" size="lg">
                <a
                  href="https://github.com/IHUI-INF-AI/IHUI-AI"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Github className="h-4 w-4" />
                  View on GitHub
                </a>
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* Footer CTA */}
        <section className="mb-8 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            Ready to build your AI agent?
          </h2>
          <p className="mt-3 text-muted-foreground">
            Start free. No credit card required.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button asChild variant="default" size="lg">
              <Link href="/agents">
                Get Started Free
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/en/docs">Read Docs</Link>
            </Button>
          </div>
          <p className="mt-8 text-xs text-muted-foreground">
            <Link href="/" className="underline-offset-4 hover:underline">
              Chinese version: 智汇 AI
            </Link>
          </p>
        </section>
      </div>
    </main>
  )
}
