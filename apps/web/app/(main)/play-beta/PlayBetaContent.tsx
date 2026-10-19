// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { Smartphone, CheckCircle2, Loader2, ExternalLink } from 'lucide-react'
import { Button, Card, CardContent, Input, Label, Checkbox } from '@ihui/ui-react'
import { BackButton } from '@/components/common'
import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'

const PLAY_TESTING_URL = 'https://play.google.com/apps/testing/zh.ai.sq'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const STEPS = ['success.step1', 'success.step2', 'success.step3'] as const
const FAQ = [
  { q: 'faq.q1', a: 'faq.a1' },
  { q: 'faq.q2', a: 'faq.a2' },
  { q: 'faq.q3', a: 'faq.a3' },
] as const

type Status = 'idle' | 'loading' | 'success' | 'error'

export function PlayBetaContent(): React.JSX.Element {
  const t = useTranslations('playBeta')
  const locale = useLocale()
  const [email, setEmail] = React.useState('')
  const [agreed, setAgreed] = React.useState(false)
  const [honeypot, setHoneypot] = React.useState('')
  const [status, setStatus] = React.useState<Status>('idle')
  const [errorMsg, setErrorMsg] = React.useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (honeypot) return
    if (!EMAIL_RE.test(email)) {
      setStatus('error')
      setErrorMsg(t('errors.invalidEmail'))
      return
    }
    setStatus('loading')
    setErrorMsg('')
    const r = await fetchApi<{ registered: boolean }>('/api/play-testers/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, locale, agreedPrivacy: agreed, website: honeypot }),
    })
    if (r.success) {
      setStatus('success')
    } else {
      setStatus('error')
      setErrorMsg(r.error ?? t('errors.generic'))
    }
  }

  const whyItems = t.raw('why.items') as string[]

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-4">
      <BackButton />
      {/* Hero */}
      <section className="text-center">
        <div className="inline-flex items-center gap-2 ui-card rounded-lg border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <Smartphone className="h-3.5 w-3.5 text-primary" />
          {t('hero.badge')}
        </div>
        <h1 className="mt-3 text-2xl min-[768px]:text-3xl min-[1024px]:text-4xl font-bold tracking-tight">
          {t('hero.title')}
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground min-[768px]:text-base">
          {t('hero.subtitle')}
        </p>
      </section>

      {status === 'success' ? (
        <div className="mt-10 space-y-6">
          <Card className="border-emerald-500/30">
            <CardContent className="min-[640px]:p-3 flex flex-col items-center gap-3 p-3 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              <h2 className="text-xl font-bold text-foreground">{t('success.title')}</h2>
              <p className="text-sm text-muted-foreground">{t('success.desc')}</p>
              <ol className="mt-2 w-full space-y-2 text-left">
                {STEPS.map((key, idx) => (
                  <li key={key} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span
                      className={cn(
                        'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary',
                      )}
                    >
                      {idx + 1}
                    </span>
                    <span>{t(key)}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="min-[640px]:p-3 p-3">
              <h2 className="text-sm font-semibold text-foreground">{t('join.title')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t('join.desc')}</p>
              <Button asChild className="mt-3 w-full">
                <a href={PLAY_TESTING_URL} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-1 h-4 w-4" />
                  {t('join.button')}
                </a>
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">{t('join.hint')}</p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="mt-10 grid grid-cols-1 gap-6 min-[768px]:grid-cols-5">
          {/* Why join */}
          <Card className="border-border min-[768px]:col-span-2">
            <CardContent className="min-[640px]:p-3 p-3">
              <h2 className="mb-3 text-sm font-semibold text-foreground">{t('why.title')}</h2>
              <ul className="space-y-2.5">
                {whyItems.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Form */}
          <Card className="border-border min-[768px]:col-span-3">
            <CardContent className="min-[640px]:p-3 p-3">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="play-beta-email">{t('form.email')}</Label>
                  <Input
                    id="play-beta-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('form.emailPlaceholder')}
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

                <label className="flex cursor-pointer items-start gap-2 text-xs text-muted-foreground">
                  <Checkbox
                    checked={agreed}
                    onCheckedChange={(v) => setAgreed(v === true)}
                    aria-label={t('form.privacyRequired')}
                  />
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
                      <Smartphone className="mr-1 h-4 w-4" />
                      {t('form.submit')}
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* FAQ */}
      <Card className="mt-10 border-border">
        <CardContent className="min-[640px]:p-3 p-3">
          <h2 className="mb-3 text-sm font-semibold text-foreground">{t('faq.title')}</h2>
          <div className="space-y-3">
            {FAQ.map((item) => (
              <div key={item.q}>
                <h3 className="text-sm font-medium text-foreground">{t(item.q)}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{t(item.a)}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </main>
  )
}

