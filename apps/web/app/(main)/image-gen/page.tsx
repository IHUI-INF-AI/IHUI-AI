'use client'

import * as React from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, ImageIcon, Sparkles, Download } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent, Label } from '@ihui/ui'
import { Alert } from '@/components/feedback'

interface GenResult {
  imageUrl: string
  revisedPrompt?: string
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const SIZES = ['1024x1024', '1024x1792', '1792x1024']

export default function ImageGenPage() {
  const [prompt, setPrompt] = React.useState('')
  const [size, setSize] = React.useState(SIZES[0])
  const [result, setResult] = React.useState<GenResult | null>(null)
  const [err, setErr] = React.useState<string | null>(null)

  const genMut = useMutation({
    mutationFn: () => {
      const body = {
        prompt: prompt.trim(),
        size,
      }
      return api<GenResult>('/api/image-gen/generate', {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    onSuccess: (data) => {
      setResult(data)
      toast.success('生成成功')
    },
    onError: (e: Error) => {
      setErr(e.message)
      setResult(null)
    },
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setResult(null)
    if (!prompt.trim()) {
      setErr('请输入提示词')
      return
    }
    genMut.mutate()
  }

  function download() {
    if (!result?.imageUrl) return
    const a = document.createElement('a')
    a.href = result.imageUrl
    a.download = `image-${Date.now()}.png`
    a.target = '_blank'
    a.click()
  }

  const inputClass =
    'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <ImageIcon className="h-6 w-6 text-primary" />
          AI 图片生成
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">输入提示词生成图片</p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="space-y-2">
              <Label htmlFor="ig-prompt">提示词</Label>
              <textarea
                id="ig-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="描述你想生成的图片..."
                rows={4}
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ig-size">尺寸</Label>
              <select
                id="ig-size"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {err && <Alert variant="danger" description={err} />}

        <div className="flex justify-end">
          <Button type="submit" disabled={genMut.isPending}>
            {genMut.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {genMut.isPending ? '生成中...' : '生成图片'}
          </Button>
        </div>
      </form>

      {result && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="overflow-hidden rounded-lg bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={result.imageUrl}
                alt={result.revisedPrompt ?? prompt}
                className="mx-auto max-h-[60vh] w-auto object-contain"
              />
            </div>
            {result.revisedPrompt && (
              <p className="text-xs text-muted-foreground">{result.revisedPrompt}</p>
            )}
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={download}>
                <Download className="mr-1.5 h-4 w-4" />
                下载
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
