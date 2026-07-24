'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Sparkles, PenLine } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, Button } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'

interface EnhanceResult {
  consistency: unknown
  pacing: unknown
  outline: unknown
}

interface LineRewrite {
  original: string
  rewritten: string
  sceneIndex: number
  lineIndex: number
}

async function api<T>(url: string, body?: unknown): Promise<T> {
  const r = await fetchApi<T>(url, {
    method: 'POST',
    body: body ? JSON.stringify(body) : '{}',
  })
  if (!r.success) throw new Error(r.error)
  return r.data
}

const inputCls =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring placeholder:text-muted-foreground'

export default function DramaPage() {
  const t = useTranslations('drama.editor')
  const [scriptId, setScriptId] = React.useState('')
  const [title, setTitle] = React.useState('')
  const [enhanceResult, setEnhanceResult] = React.useState<EnhanceResult | null>(null)
  const [enhanceLoading, setEnhanceLoading] = React.useState(false)
  const [enhanceErr, setEnhanceErr] = React.useState<string | null>(null)

  const [lineScriptId, setLineScriptId] = React.useState('')
  const [sceneIndex, setSceneIndex] = React.useState('1')
  const [lineIndex, setLineIndex] = React.useState('1')
  const [content, setContent] = React.useState('')
  const [instruction, setInstruction] = React.useState('')
  const [lineResult, setLineResult] = React.useState<LineRewrite | null>(null)
  const [lineLoading, setLineLoading] = React.useState(false)
  const [lineErr, setLineErr] = React.useState<string | null>(null)

  async function handleEnhance(e: React.FormEvent) {
    e.preventDefault()
    if (!scriptId.trim()) {
      setEnhanceErr(t('errors.scriptIdRequired'))
      return
    }
    setEnhanceLoading(true)
    setEnhanceErr(null)
    try {
      const res = await api<EnhanceResult>(
        `/api/drama/scripts/${scriptId}/enhance`,
        title ? { title } : {},
      )
      setEnhanceResult(res)
    } catch (err) {
      setEnhanceErr((err as Error).message)
    } finally {
      setEnhanceLoading(false)
    }
  }

  async function handleLine(e: React.FormEvent) {
    e.preventDefault()
    if (!lineScriptId.trim() || !content.trim()) {
      setLineErr(t('errors.scriptIdAndContentRequired'))
      return
    }
    setLineLoading(true)
    setLineErr(null)
    try {
      const res = await api<LineRewrite>(
        `/api/drama/scripts/${lineScriptId}/scenes/${sceneIndex}/lines/${lineIndex}/enhance`,
        { content, instruction: instruction || undefined },
      )
      setLineResult(res)
    } catch (err) {
      setLineErr((err as Error).message)
    } finally {
      setLineLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <Sparkles className="h-5 w-5 text-primary" />
          {t('title')}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" />
            {t('enhance.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form onSubmit={handleEnhance} className="space-y-3">
            <div className="flex gap-2">
              <input
                className={inputCls}
                placeholder={t('enhance.scriptIdPlaceholder')}
                value={scriptId}
                onChange={(e) => setScriptId(e.target.value)}
              />
              <input
                className={inputCls}
                placeholder={t('enhance.titlePlaceholder')}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <Button type="submit" size="sm" disabled={enhanceLoading}>
                {enhanceLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {t('enhance.submitBtn')}
              </Button>
            </div>
          </form>
          {enhanceErr && <Alert variant="danger" description={enhanceErr} />}
          {enhanceResult && (
            <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
              <div>
                <span className="font-medium">{t('enhance.consistency')}</span>
                <pre className="mt-1 overflow-auto whitespace-pre-wrap text-xs">
                  {JSON.stringify(enhanceResult.consistency, null, 2)}
                </pre>
              </div>
              <div>
                <span className="font-medium">{t('enhance.pacing')}</span>
                <pre className="mt-1 overflow-auto whitespace-pre-wrap text-xs">
                  {JSON.stringify(enhanceResult.pacing, null, 2)}
                </pre>
              </div>
              <div>
                <span className="font-medium">{t('enhance.outline')}</span>
                <pre className="mt-1 overflow-auto whitespace-pre-wrap text-xs">
                  {JSON.stringify(enhanceResult.outline, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PenLine className="h-4 w-4" />
            {t('lineRewrite.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form onSubmit={handleLine} className="space-y-3">
            <div className="flex gap-2">
              <input
                className={inputCls}
                placeholder={t('lineRewrite.scriptIdPlaceholder')}
                value={lineScriptId}
                onChange={(e) => setLineScriptId(e.target.value)}
              />
              <input
                className={`${inputCls} w-20`}
                type="number"
                min="1"
                placeholder={t('lineRewrite.scenePlaceholder')}
                value={sceneIndex}
                onChange={(e) => setSceneIndex(e.target.value)}
              />
              <input
                className={`${inputCls} w-20`}
                type="number"
                min="1"
                placeholder={t('lineRewrite.linePlaceholder')}
                value={lineIndex}
                onChange={(e) => setLineIndex(e.target.value)}
              />
            </div>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring placeholder:text-muted-foreground"
              placeholder={t('lineRewrite.contentPlaceholder')}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            <input
              className={inputCls}
              placeholder={t('lineRewrite.instructionPlaceholder')}
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
            />
            <Button type="submit" size="sm" disabled={lineLoading}>
              {lineLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PenLine className="h-4 w-4" />
              )}
              {t('lineRewrite.submitBtn')}
            </Button>
          </form>
          {lineErr && <Alert variant="danger" description={lineErr} />}
          {lineResult && (
            <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
              <div>
                <span className="font-medium text-muted-foreground">
                  {t('lineRewrite.original')}
                </span>
                <p className="mt-1">{lineResult.original}</p>
              </div>
              <div>
                <span className="font-medium text-primary">{t('lineRewrite.rewritten')}</span>
                <p className="mt-1">{lineResult.rewritten}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
