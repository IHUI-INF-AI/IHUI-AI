import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent, CardDescription, Button } from '@ihui/ui-react'
import {
  Check,
  X,
  Cpu,
  Zap,
  Shield,
  Users,
  Building2,
  Sparkles,
  Github,
  ArrowRight,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Pricing — Simple, Transparent Plans | IHUI AI',
  description:
    'Simple pricing for individuals, teams, and enterprises. Free tier available. Monthly and annual billing. No hidden fees. Start free, upgrade as you grow. Apache 2.0 open-source, self-hosted option available.',
  alternates: {
    canonical: '/en/pricing',
    languages: {
      'x-default': '/pricing',
      en: '/en/pricing',
      'zh-CN': '/pricing',
    },
  },
  openGraph: {
    title: 'Pricing — Simple, Transparent Plans',
    description: 'Free, Individual, Team, Enterprise plans. Monthly/annual billing.',
    url: 'https://aizhs.top/en/pricing',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: '/og-image-en.jpg',
        width: 1200,
        height: 630,
        alt: 'Pricing — Simple, Transparent Plans',
        type: 'image/jpeg',
      },
    ],
  },
}

const plans = [
  {
    name: 'Free',
    icon: Sparkles,
    price: '$0',
    period: '/mo',
    yearly: null,
    description: 'For trying out IHUI AI',
    features: [
      '100 AI messages per month',
      '3 agent templates',
      '1 knowledge base',
      'Community support',
    ],
    cta: 'Get Started',
    href: '/agents',
    highlight: false,
  },
  {
    name: 'Individual',
    icon: Zap,
    price: '$9.99',
    period: '/mo',
    yearly: '$99.99/yr',
    description: 'For personal projects and power users',
    features: [
      '3,000 AI messages per month',
      'Unlimited agent templates',
      '5 knowledge bases',
      'All 176+ models',
      'Email support',
    ],
    cta: 'Choose Individual',
    href: '/pricing',
    highlight: false,
  },
  {
    name: 'Team',
    icon: Users,
    price: '$49.99',
    period: '/mo',
    yearly: '$499.99/yr',
    description: 'For growing teams collaborating',
    features: [
      '20,000 AI messages per month',
      '10 team members',
      '50 knowledge bases',
      'Priority support',
      'Team collaboration',
    ],
    cta: 'Choose Team',
    href: '/pricing',
    highlight: false,
  },
  {
    name: 'Enterprise',
    icon: Building2,
    price: 'Custom',
    period: '',
    yearly: null,
    description: 'For large organizations with custom needs',
    features: [
      'Unlimited messages',
      'Unlimited members',
      'Unlimited knowledge bases',
      'SSO/SAML',
      'Self-hosted deployment',
      'Dedicated support',
    ],
    cta: 'Contact Sales',
    href: 'mailto:contact@aizhs.top',
    highlight: true,
  },
]

const comparison = [
  {
    feature: 'Messages',
    free: '100/mo',
    individual: '3,000/mo',
    team: '20,000/mo',
    enterprise: 'Unlimited',
  },
  {
    feature: 'Agents',
    free: '3 templates',
    individual: 'Unlimited',
    team: 'Unlimited',
    enterprise: 'Unlimited',
  },
  { feature: 'Knowledge Bases', free: '1', individual: '5', team: '50', enterprise: 'Unlimited' },
  {
    feature: 'Models',
    free: 'Limited',
    individual: 'All 176+',
    team: 'All 176+',
    enterprise: 'All 176+',
  },
  { feature: 'Team Members', free: '1', individual: '1', team: '10', enterprise: 'Unlimited' },
  {
    feature: 'Support',
    free: 'Community',
    individual: 'Email',
    team: 'Priority',
    enterprise: 'Dedicated',
  },
  { feature: 'SSO/SAML', free: false, individual: false, team: false, enterprise: true },
  { feature: 'Self-hosted', free: false, individual: false, team: false, enterprise: true },
]

const faqs = [
  {
    q: 'Can I change plans anytime?',
    a: 'Yes, upgrade or downgrade anytime. Changes take effect immediately and are prorated.',
  },
  {
    q: 'Is there a free trial?',
    a: 'Yes, the Free plan is forever-free. No credit card required. Upgrade only when you need more.',
  },
  {
    q: 'Do you support self-hosting?',
    a: 'Yes, the Enterprise plan includes self-hosted deployment. IHUI AI is Apache 2.0 open-source — deploy on your own infrastructure with Docker Compose.',
  },
  {
    q: 'What payment methods do you accept?',
    a: 'Credit card, Alipay, and WeChat Pay. Annual billing saves you 2 months.',
  },
  {
    q: 'Can I get a refund?',
    a: 'Yes, we offer a 14-day money-back guarantee on all paid plans. No questions asked.',
  },
]

function ComparisonCell({ value }: { value: string | boolean }) {
  if (typeof value === 'boolean') {
    return value ? (
      <Check className="mx-auto h-4 w-4 text-primary" />
    ) : (
      <X className="mx-auto h-4 w-4 text-muted-foreground" />
    )
  }
  return <span className="text-sm">{value}</span>
}

export default function PricingLandingPage() {
  return (
    <main className="h-[calc(100vh-58px)] overflow-y-auto">
      <div className="mx-auto max-w-5xl px-6 py-12 md:py-16">
        {/* Hero */}
        <section className="mb-12 flex flex-col items-center text-center md:mb-16">
          <div className="mb-4 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Shield className="h-3.5 w-3.5 text-primary" />
            Pricing
          </div>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-foreground md:text-5xl">
            Simple, Transparent Pricing
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
            Start free. Upgrade as you grow. No hidden fees.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Cpu className="h-4 w-4 text-primary" /> 176+ models
            </span>
            <span className="flex items-center gap-1.5">
              <Github className="h-4 w-4 text-primary" /> Apache 2.0 open source
            </span>
            <span className="flex items-center gap-1.5">
              <Shield className="h-4 w-4 text-primary" /> Self-hosted ready
            </span>
          </div>
          <div className="mt-6 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm">
            <span className="font-medium">Monthly</span>
            <span className="text-muted-foreground">|</span>
            <span className="font-medium">Annual</span>
            <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              Save 2 months
            </span>
          </div>
        </section>

        {/* 4 Plans Grid */}
        <section className="mb-16 md:mb-24">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={plan.highlight ? 'border-primary ring-1 ring-primary' : ''}
              >
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <plan.icon className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                  </div>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold">{plan.price}</span>
                      {plan.period && (
                        <span className="text-sm text-muted-foreground">{plan.period}</span>
                      )}
                    </div>
                    {plan.yearly && (
                      <p className="mt-1 text-xs text-muted-foreground">or {plan.yearly}</p>
                    )}
                  </div>
                  <ul className="space-y-2">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm">
                        <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    asChild
                    variant={plan.highlight ? 'default' : 'outline'}
                    size="sm"
                    className="w-full"
                  >
                    <Link href={plan.href}>{plan.cta}</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Feature Comparison Table */}
        <section className="mb-16 md:mb-24">
          <div className="mb-8 text-center md:mb-12">
            <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Compare All Features
            </h2>
          </div>
          <div className="overflow-x-auto">
            <div className="grid min-w-[640px] grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-2">
              <div className="text-sm font-semibold">Feature</div>
              <div className="text-center text-sm font-semibold">Free</div>
              <div className="text-center text-sm font-semibold">Individual</div>
              <div className="text-center text-sm font-semibold">Team</div>
              <div className="text-center text-sm font-semibold">Enterprise</div>
              {comparison.map((row) => (
                <div key={row.feature} className="contents">
                  <div className="rounded bg-card px-3 py-2 text-sm text-muted-foreground">
                    {row.feature}
                  </div>
                  <div className="flex items-center justify-center rounded bg-card px-3 py-2">
                    <ComparisonCell value={row.free} />
                  </div>
                  <div className="flex items-center justify-center rounded bg-card px-3 py-2">
                    <ComparisonCell value={row.individual} />
                  </div>
                  <div className="flex items-center justify-center rounded bg-card px-3 py-2">
                    <ComparisonCell value={row.team} />
                  </div>
                  <div className="flex items-center justify-center rounded bg-card px-3 py-2">
                    <ComparisonCell value={row.enterprise} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-16 md:mb-24">
          <div className="mb-8 text-center md:mb-12">
            <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Frequently Asked Questions
            </h2>
          </div>
          <div className="mx-auto max-w-3xl space-y-3">
            {faqs.map((faq) => (
              <details key={faq.q} className="rounded-lg border border-border bg-card p-4">
                <summary className="cursor-pointer font-medium">{faq.q}</summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{faq.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Open Source */}
        <section className="mb-16 md:mb-24">
          <Card className="p-8 md:p-12">
            <div className="flex flex-col items-center text-center">
              <Github className="h-10 w-10 text-primary" />
              <h2 className="mt-4 text-xl font-bold tracking-tight text-foreground md:text-2xl">
                Open Source. Self-Host. Free Forever.
              </h2>
              <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
                IHUI AI is licensed under Apache 2.0. Deploy on your own infrastructure with Docker
                Compose one-click deployment. Your data, your rules.
              </p>
              <div className="mt-6">
                <Button asChild variant="outline" size="lg">
                  <a
                    href="https://github.com/IHUI-INF-AI/IHUI-AI"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Github className="h-4 w-4" />
                    View on GitHub
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>
          </Card>
        </section>

        {/* Footer CTA */}
        <section>
          <Card className="p-8 text-center md:p-12">
            <h2 className="text-xl font-bold tracking-tight text-foreground md:text-2xl">
              Ready to get started?
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground md:text-base">
              Sign up free — no credit card required. 智汇 AI
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button asChild variant="default" size="lg">
                <Link href="/agents">Sign Up Free</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a href="mailto:contact@aizhs.top">Talk to Sales</a>
              </Button>
            </div>
          </Card>
        </section>
      </div>
    </main>
  )
}
