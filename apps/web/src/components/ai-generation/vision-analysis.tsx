'use client'

import * as React from 'react'
import { Loader2, Upload } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@ihui/ui'
import { fetchApi } from '@/lib/api'
import { extractText } from '@/lib/ai-media'

const TEXTAREA_CLS =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export function VisionAnalysis() {
  const t = useTranslations('aiGeneration')
  const [imageUrl, setImageUrl] = React.useState('')
  const [question, setQuestion] = React.useState('')
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const mutation = useMutation({
    mutationFn: async (payload: {
      model: string
      messages: Array<{ role: string; content: Array<Record<string, string>> }>
    }) => {
      const res = await fetchApi<unknown>('/api/ai/dashscope/multimodal', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => toast.success(t('generateSuccess')),
    onError: (err: Error) => toast.error(err.message),
  })

  const answer = mutation.data ? extractText(mutation.data) : ''

  const onFile = (file: File | undefined) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setImageUrl(String(reader.result ?? ''))
    reader.readAsDataURL(file)
  }

  const onSubmit = () => {
    if (!imageUrl.trim() || !question.trim()) {
      toast.error(t('promptRequired'))
      return
    }
    mutation.mutate({
      model: 'qwen-vl-max',
      messages: [
        {
          role: 'user',
          content: [{ image: imageUrl.trim() }, { text: question.trim() }],
        },
      ],
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('visionAnalysisTitle')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('visionAnalysisSubtitle')}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="vision-url">{t('imageUrl')}</Label>
          <Input
            id="vision-url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder={t('imageUrlPlaceholder')}
          />
        </div>
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4" />
            {t('uploadImage')}
          </Button>
        </div>
        <div className="space-y-2">
          <Label htmlFor="vision-question">{t('question')}</Label>
          <textarea
            id="vision-question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={t('questionPlaceholder')}
            rows={3}
            className={TEXTAREA_CLS}
          />
        </div>
        <Button onClick={onSubmit} disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {mutation.isPending ? t('generating') : t('generate')}
        </Button>

        {mutation.isPending ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={`skel-${i}`} className="h-4 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : null}

        {answer ? (
          <div className="space-y-2">
            <Label>{t('result')}</Label>
            <div className="prose prose-sm max-w-none rounded-md border p-4 dark:prose-invert">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

export default VisionAnalysis
