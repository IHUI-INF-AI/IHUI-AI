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
import { Cpu, Zap, Shield, Sparkles, ArrowRight, Check } from 'lucide-react'

export const metadata: Metadata = {
  title: 'AI Model Hub — 176+ Models Unified API | IHUI AI',
  description:
    'Access 176+ AI models from OpenAI, Claude, Gemini, Qwen, DeepSeek, ERNIE, Doubao, Kimi, Zhipu through one unified API. Auto-failover, pay-as-you-go pricing, OpenAI-compatible API. Build with the best AI models.',
  alternates: {
    canonical: '/en/models',
    languages: {
      'x-default': '/models',
      'en': '/en/models',
      'zh-CN': '/models',
    },
  },
  openGraph: {
    title: 'AI Model Hub — 176+ Models Unified API',
    description: '9 providers, 176+ models, one API. OpenAI-compatible with auto-failover.',
    url: 'https://aizhs.top/en/models',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: '/og-image-en.jpg',
        width: 1200,
        height: 630,
        alt: 'AI Model Hub — 176+ Models Unified API',
        type: 'image/jpeg',
      },
    ],
  },
}

const providers = [
  { name: 'OpenAI', count: '20+ models', models: ['GPT-4o', 'GPT-4 Turbo', 'GPT-3.5 Turbo', 'o1', 'o3'] },
  { name: 'Anthropic', count: '12+ models', models: ['Claude 3.5 Sonnet', 'Claude 3 Opus', 'Claude 3 Haiku'] },
  { name: 'Google Gemini', count: '8+ models', models: ['Gemini 1.5 Pro', 'Gemini 1.5 Flash', 'Gemini Ultra'] },
  { name: 'Alibaba Qwen', count: '15+ models', models: ['Qwen2.5-72B', 'Qwen2.5-Coder', 'Qwen-VL'] },
  { name: 'Baidu ERNIE', count: '10+ models', models: ['ERNIE 4.0', 'ERNIE Speed', 'ERNIE Lite'] },
  { name: 'DeepSeek', count: '8+ models', models: ['DeepSeek-V3', 'DeepSeek-Coder', 'DeepSeek-R1'] },
  { name: 'Zhipu GLM', count: '10+ models', models: ['GLM-4', 'GLM-4V', 'GLM-3-Turbo'] },
  { name: 'ByteDance Doubao', count: '12+ models', models: ['Doubao-Pro', 'Doubao-Lite', 'Doubao-Vision'] },
  { name: 'Moonshot Kimi', count: '6+ models', models: ['Kimi-Long-Context', 'Moonshot-v1'] },
]

const features = [
  { icon: Cpu, title: 'Unified API', desc: 'OpenAI-compatible interface. Switch models with a single line change — no SDK refactoring needed.' },
  { icon: Shield, title: 'Auto-Failover', desc: 'Automatic fallback when a provider is down. Your requests always succeed, even during outages.' },
  { icon: Zap, title: 'Pay-as-You-Go', desc: 'No commitment, no minimum spend. Pay only for the tokens you actually use.' },
  { icon: Sparkles, title: 'Stream & Batch', desc: 'Support for streaming responses and batch processing. Build responsive UX and process large workloads.' },
]

export default function ModelsLandingPage() {
  return (
    <main className="h-[calc(100vh-58px)] overflow-y-auto">
      <div className="mx-auto max-w-5xl px-6 py-12 md:py-16">
        {/* Hero */}
        <section className="mb-16 flex flex-col items-center text-center md:mb-24">
          <div className="mb-4 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Cpu className="h-3.5 w-3.5 text-primary" />
            AI Model Hub
          </div>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-foreground md:text-5xl">
            176+ AI Models, One Unified API
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
            Access OpenAI, Claude, Gemini, Qwen, DeepSeek and more through a single
            OpenAI-compatible API. Auto-failover, pay-as-you-go.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild variant="default" size="lg">
              <Link href="/models">
                Explore Full Model Hub
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/docs/api">View API Docs</Link>
            </Button>
          </div>
        </section>

        {/* 9 Providers Grid */}
        <section className="mb-16 md:mb-24">
          <div className="mb-8 text-center md:mb-12">
            <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              9 Providers, 176+ Models
            </h2>
            <p className="mt-3 text-muted-foreground">
              All major AI providers unified under one API. Switch models without changing your code.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {providers.map((p) => (
              <Card key={p.name} className="transition-colors hover:bg-accent/50">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{p.name}</CardTitle>
                    <span className="text-xs text-muted-foreground">{p.count}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ul className="space-y-1">
                    {p.models.map((m) => (
                      <li
                        key={m}
                        className="flex items-center gap-2 text-sm text-muted-foreground"
                      >
                        <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                        {m}
                      </li>
                    ))}
                  </ul>
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link href="/models">Try {p.name}</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="mb-16 md:mb-24">
          <div className="mb-8 text-center md:mb-12">
            <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Why Choose Our Model Hub?
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <Card key={f.title} className="transition-colors hover:bg-accent/50">
                <CardContent className="pt-6">
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-semibold">{f.title}</h3>
                  <CardDescription className="mt-2 leading-relaxed">
                    {f.desc}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Code Example */}
        <section className="mb-16 md:mb-24">
          <div className="mb-8 text-center md:mb-12">
            <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Get Started in 3 Lines
            </h2>
            <p className="mt-3 text-muted-foreground">
              OpenAI-compatible API. Drop in your existing code — just change the base URL.
            </p>
          </div>
          <pre className="overflow-x-auto rounded-lg bg-muted p-4">
            <code className="text-sm text-foreground">{`curl https://aizhs.top/api/v1/chat/completions \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"Hello"}]}'`}</code>
          </pre>
        </section>

        {/* Footer CTA */}
        <section>
          <Card className="p-8 text-center md:p-12">
            <h2 className="text-xl font-bold tracking-tight text-foreground md:text-2xl">
              Ready to build with 176+ AI models?
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground md:text-base">
              Get your API key and start building in minutes. Free tier available.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button asChild variant="default" size="lg">
                <Link href="/developer">Get API Key</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/en/pricing">
                  View Pricing
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </Card>
        </section>
      </div>
    </main>
  )
}
