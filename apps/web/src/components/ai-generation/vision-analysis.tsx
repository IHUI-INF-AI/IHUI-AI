'use client'

import * as React from 'react'
import dynamic from 'next/dynamic'
import { Loader2, Upload } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from '@/components/common'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@ihui/ui-react'
import { fetchApi } from '@/lib/api'
import { extractText } from '@/lib/ai-media'
import { isMermaidLanguage } from '@/lib/markdown-mermaid-code'

// MermaidDiagram 仅在客户端加载,不影响首屏 bundle
const MermaidDiagram = dynamic(() => import('@/components/media/MermaidDiagram'), {
  ssr: false,
  loading: () => <div className="animate-pulse text-xs text-muted-foreground">…</div>,
})

const TEXTAREA_CLS =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

/** 图片上传大小上限:10MB(防止 base64 进 state 导致 OOM) */
const MAX_IMAGE_SIZE = 10 * 1024 * 1024

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
    // 大小校验:防止超大文件 base64 进 state 导致 OOM
    if (file.size > MAX_IMAGE_SIZE) {
      toast.error(`图片不能超过 ${MAX_IMAGE_SIZE / 1024 / 1024}MB`)
      return
    }
    // 类型校验:只允许图片,防 .exe/.html/.svg 等
    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件')
      return
    }
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
            onChange={(e) => {
              onFile(e.target.files?.[0])
              // 允许重复选择同一文件(否则选同一文件第二次不触发 change)
              e.target.value = ''
            }}
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
        <Button onClick={onSubmit} disabled={mutation.isPending} aria-busy={mutation.isPending}>
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
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ className: cls, children, ...props }: React.ComponentProps<'code'>) {
                    const match = /language-(\w+)/.exec(cls || '')
                    const inline = !match && !String(children).includes('\n')
                    if (inline) {
                      return (
                        <code className="rounded bg-muted px-1.5 py-0.5 text-sm" {...props}>
                          {children}
                        </code>
                      )
                    }
                    // mermaid 块交给 MermaidDiagram 渲染
                    if (isMermaidLanguage(cls)) {
                      return <MermaidDiagram code={String(children).replace(/\n$/, '')} />
                    }
                    return (
                      <code className={cls} {...props}>
                        {children}
                      </code>
                    )
                  },
                }}
              >
                {answer}
              </ReactMarkdown>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

export default VisionAnalysis
