'use client'

import * as React from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { CheckCircle2, Loader2, Mail, Phone } from 'lucide-react'
import { Button, Input } from '@ihui/ui-react'
import { Textarea, Select, Checkbox } from '@/components/form'
import { fetchApi } from '@/lib/api'

const SERVICE_KEYS = ['deployment', 'training', 'custom', 'consulting', 'other'] as const
const BUDGET_KEYS = ['under5k', '5kTo20k', '20kTo50k', 'over50k'] as const
const TIMELINE_KEYS = ['urgent', 'month', 'flexible'] as const

interface FormState {
  name: string
  company: string
  email: string
  phone: string
  serviceType: string
  budget: string
  description: string
  timeline: string
  agreeTerms: boolean
  website: string // honeypot
}

const INITIAL_FORM: FormState = {
  name: '',
  company: '',
  email: '',
  phone: '',
  serviceType: '',
  budget: '',
  description: '',
  timeline: '',
  agreeTerms: false,
  website: '',
}

export function InquiryForm(): React.JSX.Element {
  const t = useTranslations('services')
  const searchParams = useSearchParams()
  const [form, setForm] = React.useState<FormState>(INITIAL_FORM)
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [submitting, setSubmitting] = React.useState(false)
  const [submitted, setSubmitted] = React.useState(false)

  // 从 URL 预选服务类型(?service=deployment)
  React.useEffect(() => {
    const svc = searchParams.get('service')
    if (svc && SERVICE_KEYS.includes(svc as (typeof SERVICE_KEYS)[number])) {
      setForm((f) => ({ ...f, serviceType: svc }))
    }
  }, [searchParams])

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: '' }))
  }

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = t('inquiry.errors.nameRequired')
    if (!form.email.trim()) e.email = t('inquiry.errors.emailRequired')
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = t('inquiry.errors.emailInvalid')
    if (!form.serviceType) e.serviceType = t('inquiry.errors.serviceTypeRequired')
    if (!form.budget) e.budget = t('inquiry.errors.budgetRequired')
    if (!form.description.trim()) e.description = t('inquiry.errors.descriptionRequired')
    else if (form.description.trim().length < 50) e.description = t('inquiry.errors.descriptionTooShort')
    if (!form.timeline) e.timeline = t('inquiry.errors.timelineRequired')
    if (!form.agreeTerms) e.agreeTerms = t('inquiry.errors.agreeRequired')
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    try {
      const result = await fetchApi<{ id: string }>('/api/service-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (result.success) {
        toast.success(t('inquiry.success.title'))
        setForm(INITIAL_FORM)
        setSubmitted(true)
      } else {
        toast.error(t('inquiry.errors.submitFailed'))
      }
    } catch {
      toast.error(t('inquiry.errors.submitFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  const serviceOptions = SERVICE_KEYS.map((k) => ({ label: t(`inquiry.serviceTypes.${k}`), value: k }))
  const budgetOptions = BUDGET_KEYS.map((k) => ({ label: t(`inquiry.budgets.${k}`), value: k }))
  const timelineOptions = TIMELINE_KEYS.map((k) => ({ label: t(`inquiry.timelines.${k}`), value: k }))

  if (submitted) {
    return (
      <div className="rounded-lg border bg-card p-6 text-center space-y-3">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
        <h3 className="text-lg font-semibold">{t('inquiry.success.title')}</h3>
        <p className="text-sm text-muted-foreground">{t('inquiry.success.message')}</p>
        <div className="flex flex-wrap items-center justify-center gap-4 pt-2 text-sm">
          <span className="inline-flex items-center gap-1.5">
            <Mail className="h-4 w-4 text-muted-foreground" />
            business@ihui.ai
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Phone className="h-4 w-4 text-muted-foreground" />
            400-888-0000
          </span>
        </div>
        <Button variant="outline" size="sm" className="mt-2" onClick={() => setSubmitted(false)}>
          {t('inquiry.fields.submit')}
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {/* honeypot:对用户隐藏,机器人会填 */}
      <input
        type="text"
        name="website"
        value={form.website}
        onChange={(e) => update('website', e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">
            {t('inquiry.fields.name')} <span className="text-destructive">*</span>
          </label>
          <Input
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder={t('inquiry.fields.namePlaceholder')}
          />
          {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">{t('inquiry.fields.company')}</label>
          <Input
            value={form.company}
            onChange={(e) => update('company', e.target.value)}
            placeholder={t('inquiry.fields.companyPlaceholder')}
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">
            {t('inquiry.fields.email')} <span className="text-destructive">*</span>
          </label>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            placeholder={t('inquiry.fields.emailPlaceholder')}
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">{t('inquiry.fields.phone')}</label>
          <Input
            type="tel"
            value={form.phone}
            onChange={(e) => update('phone', e.target.value)}
            placeholder={t('inquiry.fields.phonePlaceholder')}
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label={t('inquiry.fields.serviceType')}
          options={serviceOptions}
          value={form.serviceType}
          onChange={(v) => update('serviceType', String(v))}
          error={errors.serviceType}
        />
        <Select
          label={t('inquiry.fields.budget')}
          options={budgetOptions}
          value={form.budget}
          onChange={(v) => update('budget', String(v))}
          error={errors.budget}
        />
      </div>
      <Select
        label={t('inquiry.fields.timeline')}
        options={timelineOptions}
        value={form.timeline}
        onChange={(v) => update('timeline', String(v))}
        error={errors.timeline}
      />
      <div className="space-y-1.5">
        <label className="text-sm font-medium">
          {t('inquiry.fields.description')} <span className="text-destructive">*</span>
        </label>
        <Textarea
          value={form.description}
          onChange={(e) => update('description', e.target.value)}
          placeholder={t('inquiry.fields.descriptionPlaceholder')}
          rows={4}
          maxLength={2000}
          showCounter
        />
        {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
      </div>
      <div className="space-y-1.5">
        <Checkbox
          checked={form.agreeTerms}
          onChange={(v) => update('agreeTerms', v)}
          label={<span className="text-sm">{t('inquiry.fields.agreeTerms')}</span>}
        />
        {errors.agreeTerms && <p className="text-xs text-destructive">{errors.agreeTerms}</p>}
      </div>
      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? (
          <>
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            {t('inquiry.fields.submitting')}
          </>
        ) : (
          t('inquiry.fields.submit')
        )}
      </Button>
    </form>
  )
}
