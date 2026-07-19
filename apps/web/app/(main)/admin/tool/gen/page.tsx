'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Wand2, Loader2 } from 'lucide-react'

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ihui/ui'
import { fetchApi } from '@/lib/api'

type Template = 'list' | 'page' | 'detail' | 'dialog'

const TEMPLATES: Template[] = ['list', 'page', 'detail', 'dialog']
const ENDPOINT = '/api/admin/tool/gen'

interface GenResult {
  files?: string[]
  output?: string
}

export default function ToolGenPage() {
  const t = useTranslations('admin.tool.gen')
  const [moduleName, setModuleName] = React.useState('')
  const [template, setTemplate] = React.useState<Template>('list')
  const [result, setResult] = React.useState<GenResult | null>(null)
  const [pending, setPending] = React.useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const name = moduleName.trim()
    if (!name) {
      toast.error(t('error'))
      return
    }
    setPending(true)
    setResult(null)
    try {
      const r = await fetchApi<GenResult>(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleName: name, template }),
      })
      if (!r.success) throw new Error(r.error)
      setResult(r.data)
      toast.success(t('success'))
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('error'))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Wand2 className="h-6 w-6 text-primary" />
          <span>{t('title')}</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="moduleName">{t('moduleName')}</Label>
              <Input
                id="moduleName"
                value={moduleName}
                onChange={(e) => setModuleName(e.target.value)}
                placeholder="user / order / product"
                className="max-w-md"
                disabled={pending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="template">{t('template')}</Label>
              <Select value={template} onValueChange={(v) => setTemplate(v as Template)} disabled={pending}>
                <SelectTrigger id="template" className="w-full max-w-md">
                  <SelectValue placeholder={t('template')} />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATES.map((tpl) => (
                    <SelectItem key={tpl} value={tpl}>
                      {t(tpl)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={pending}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                <span>{t('generate')}</span>
              </Button>
            </div>
          </form>

          {result && (
            <pre className="mt-4 max-h-80 overflow-auto rounded-md bg-muted/50 p-3 text-xs">
              {result.files?.length ? result.files.join('\n') : result.output ?? JSON.stringify(result, null, 2)}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
