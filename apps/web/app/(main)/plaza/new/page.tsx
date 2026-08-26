'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Loader2, Send } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent, Input, Label } from '@ihui/ui-react'
import { Textarea } from '@/components/form'
import { toast } from '@/components/common/Toaster'
import { BackButton } from '@/components/common'

interface PlazaItem {
  id: string
  title: string
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function PlazaNewPage() {
  const t = useTranslations('plazaNew')
  const router = useRouter()
  const [title, setTitle] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [contact, setContact] = React.useState('')
  const [lowestPrice, setLowestPrice] = React.useState('')
  const [peakPrice, setPeakPrice] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  const onSubmit = async () => {
    if (title.trim().length < 2 || description.trim().length < 10) return
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim(),
      }
      if (contact.trim()) body.contact = contact.trim()
      const low = Number(lowestPrice)
      const peak = Number(peakPrice)
      if (lowestPrice && low > 0) body.lowestPrice = low
      if (peakPrice && peak > 0) body.peakPrice = peak
      await api<PlazaItem>('/plaza', { method: 'POST', body: JSON.stringify(body) })
      toast.success(t('success'))
      router.push('/plaza')
    } catch (e) {
      toast.error((e as Error).message || t('failed'))
    } finally {
      setSubmitting(false)
    }
  }

  const valid = title.trim().length >= 2 && description.trim().length >= 10

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <BackButton fallbackHref="/plaza" />
        <h1 className="text-lg font-medium">{t('title')}</h1>
        <div className="w-10" />
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="p-title">{t('titleLabel')}</Label>
            <Input
              id="p-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder={t('titlePlaceholder')}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-desc">{t('descLabel')}</Label>
            <Textarea
              id="p-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={10000}
              rows={5}
              placeholder={t('descPlaceholder')}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p-low">{t('lowLabel')}</Label>
              <Input
                id="p-low"
                type="number"
                min={0}
                value={lowestPrice}
                onChange={(e) => setLowestPrice(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-peak">{t('peakLabel')}</Label>
              <Input
                id="p-peak"
                type="number"
                min={0}
                value={peakPrice}
                onChange={(e) => setPeakPrice(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-contact">{t('contactLabel')}</Label>
            <Input
              id="p-contact"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              maxLength={200}
              placeholder={t('contactPlaceholder')}
            />
          </div>
          <Button className="w-full" disabled={submitting || !valid} onClick={() => void onSubmit()}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            {t('submit')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
