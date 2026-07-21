'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, Settings } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent, Input, Label } from '@ihui/ui'
import { Alert } from '@/components/feedback'

interface ChatSettings {
  model: string
  temperature: string
  maxTokens: string
  systemPrompt: string
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const MODELS = [
  { value: 'gpt-4', label: 'GPT-4' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  { value: 'claude-3-opus', label: 'Claude 3 Opus' },
  { value: 'claude-3-sonnet', label: 'Claude 3 Sonnet' },
]

export default function ChatSettingsPage() {
  const router = useRouter()
  const t = useTranslations('chatSettingsPage')

  const [form, setForm] = React.useState<ChatSettings>({
    model: 'gpt-4o',
    temperature: '0.7',
    maxTokens: '2048',
    systemPrompt: '',
  })
  const [err, setErr] = React.useState<string | null>(null)

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        model: form.model,
        temperature: Number(form.temperature) || 0.7,
        maxTokens: Number(form.maxTokens) || 2048,
        systemPrompt: form.systemPrompt.trim() || undefined,
      }
      return api<unknown>('/api/chat/settings', {
        method: 'PUT',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      toast.success(t('saved'))
      router.push('/chat')
    },
    onError: (e: Error) => setErr(e.message),
  })

  function update<K extends keyof ChatSettings>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    const temp = Number(form.temperature)
    const maxT = Number(form.maxTokens)
    if (Number.isNaN(temp) || temp < 0 || temp > 2) {
      setErr(t('errorTempRange'))
      return
    }
    if (Number.isNaN(maxT) || maxT < 1 || maxT > 32768) {
      setErr(t('errorMaxTokensRange'))
      return
    }
    saveMut.mutate()
  }

  const inputClass =
    'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.push('/chat')}>
        <ArrowLeft className="h-4 w-4" />
        {t('back')}
      </Button>

      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Settings className="h-6 w-6 text-primary" />
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="space-y-2">
              <Label htmlFor="cs-model">{t('model')}</Label>
              <select
                id="cs-model"
                value={form.model}
                onChange={(e) => update('model', e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {MODELS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cs-temp">{t('temperature')}</Label>
                <Input
                  id="cs-temp"
                  type="number"
                  min={0}
                  max={2}
                  step={0.1}
                  value={form.temperature}
                  onChange={(e) => update('temperature', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cs-max">{t('maxTokens')}</Label>
                <Input
                  id="cs-max"
                  type="number"
                  min={1}
                  max={32768}
                  value={form.maxTokens}
                  onChange={(e) => update('maxTokens', e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cs-prompt">{t('systemPrompt')}</Label>
              <textarea
                id="cs-prompt"
                value={form.systemPrompt}
                onChange={(e) => update('systemPrompt', e.target.value)}
                placeholder={t('systemPromptPlaceholder')}
                rows={5}
                className={inputClass}
              />
            </div>
          </CardContent>
        </Card>

        {err && <Alert variant="danger" description={err} />}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/chat')}
            disabled={saveMut.isPending}
          >
            {t('cancel')}
          </Button>
          <Button type="submit" disabled={saveMut.isPending}>
            {saveMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {saveMut.isPending ? t('saving') : t('save')}
          </Button>
        </div>
      </form>
    </div>
  )
}
