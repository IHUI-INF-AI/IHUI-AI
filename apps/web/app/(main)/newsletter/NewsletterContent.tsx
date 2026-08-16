'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Mail, CheckCircle2, Loader2, ArrowRight } from 'lucide-react'
import { Button, Card, CardContent, Input, Label, Checkbox } from '@ihui/ui-react'
import { AnimatedNumber, BackButton } from '@/components/common'
import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'

const INTEREST_TAGS = ['aiEng', 'agent', 'rag', 'mcp', 'multiTenant', 'devops', 'business'] as const
type InterestTag = (typeof INTEREST_TAGS)[number]

const RECOMMENDED_ARTICLES = [
  { slug: 'ai-engineering-practices', key: 'articles.a1' },
  { slug: 'agent-development-guide', key: 'articles.a2' },
  { slug: 'rag-implementation', key: 'articles.a3' },
] as const

type Status = 'idle' | 'loading' | 'success' | 'error'

export function NewsletterContent(): React.JSX.Element {
  const t = useTranslations('newsletter')
  const [email, setEmail] = React.useState('')
  const [interests, setInterests] = React.useState<Set<InterestTag>>(new Set())
  const [agreed, setAgreed] = React.useState(false)
  const [honeypot, setHoneypot] = React.useState('')
  const [status, setStatus] = React.useState<Status>('idle')
  const [errorMsg, setErrorMsg] = React.useState('')

  const toggleInterest = (tag: InterestTag) => {
    setInterests((prev) => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (honeypot) return
    setStatus('loading')
    setErrorMsg('')
    const r = await fetchApi<{ subscribed: boolean }>('/api/newsletter/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        interests: Array.from(interests),
        agreedPrivacy: agreed,
      }),
    })
    if (r.success) {
      setStatus('success')
    } else {
      setStatus('error')
      setErrorMsg(r.error ?? t('errors.generic'))
    }
  }

  const benefits = t.raw('benefits.items') as string[]

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 min-[768px]:px-8 min-[768px]:py-14">
      <BackButton />
      {/* Hero */}
      <section className="text-center">
        <div className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <Mail className="h-3.5 w-3.5 text-primary" />
          {t('hero.badge')}
        </div>
        <h1 className="mt-3 text-2xl min-[768px]:text-3xl min-[1024px]:text-4xl font-bold tracking-tight">
          {t('hero.title')}
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground min-[768px]:text-base">
          {t('hero.subtitle')}
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          {t('hero.subscriberPrefix')}{' '}
          <span className="font-semibold text-primary">
            <AnimatedNumber value={8392} />
          </span>{' '}
          {t('hero.subscriberSuffix')}
        </p>
      </section>

      {status === 'success' ? (
        <Card className="mt-10 border-emerald-500/30">
          <CardContent className="flex flex-col items-center gap-4 p-5 min-[768px]:p-8 text-center min-[640px]:p-5 min-[640px]:p-8">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            <h2 className="text-xl font-bold text-foreground">{t('success.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('success.desc')}</p>
            <div className="mt-4 w-full text-left">
              <h3 className="mb-3 text-sm font-semibold text-foreground">
                {t('success.recommended')}
              </h3>
              <ul className="space-y-2">
                {RECOMMENDED_ARTICLES.map((a) => (
                  <li key={a.slug}>
                    <Link
                      href={`/blog/${a.slug}`}
                      className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted/50"
                    >
                      <span>{t(`${a.key}.title`)}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-10 grid grid-cols-1 gap-6 min-[768px]:grid-cols-5">
          {/* Benefits */}
          <Card className="border-border min-[768px]:col-span-2">
            <CardContent className="p-5 min-[640px]:p-5">
              <h2 className="mb-3 text-sm font-semibold text-foreground">{t('benefits.title')}</h2>
              <ul className="space-y-2.5">
                {benefits.map((b, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Form */}
          <Card className="border-border min-[768px]:col-span-3">
            <CardContent className="p-5 min-[640px]:p-5">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">{t('form.email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>

                {/* honeypot */}
                <input
                  type="text"
                  name="website"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                  className="hidden"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                />

                <div className="space-y-2">
                  <Label>{t('form.interests')}</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {INTEREST_TAGS.map((tag) => (
                      <label
                        key={tag}
                        className={cn(
                          'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs transition-colors',
                          interests.has(tag)
                            ? 'border-primary bg-primary/5 text-foreground'
                            : 'border-border text-muted-foreground hover:bg-muted/50',
                        )}
                      >
                        <Checkbox
                          checked={interests.has(tag)}
                          onCheckedChange={() => toggleInterest(tag)}
                        />
                        <span>{t(`form.tags.${tag}`)}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <label className="flex cursor-pointer items-start gap-2 text-xs text-muted-foreground">
                  <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} />
                  <span>
                    {t('form.privacyPrefix')}{' '}
                    <Link href="/privacy" className="text-primary hover:underline">
                      {t('form.privacyLink')}
                    </Link>
                  </span>
                </label>

                {status === 'error' && <p className="text-xs text-destructive">{errorMsg}</p>}

                <Button
                  type="submit"
                  disabled={status === 'loading' || !agreed || !email}
                  className="w-full"
                >
                  {status === 'loading' ? (
                    <>
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      {t('form.submitting')}
                    </>
                  ) : (
                    <>
                      <Mail className="mr-1 h-4 w-4" />
                      {t('form.submit')}
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  )
}
