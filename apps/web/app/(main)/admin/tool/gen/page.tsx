'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Wand2, Loader2 } from 'lucide-react'

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from '@ihui/ui'
import { getToolGenMeta, postToolGen, type GenField, type GenResult, type GenType, type GenTypeMeta } from '@/lib/api/admin-tool-gen'
import { FieldEditor, TemplateSelector } from '@/components/admin/tool/gen/field-editor'
import { GenResultViewer } from '@/components/admin/tool/gen/result-viewer'

export default function ToolGenPage() {
  const t = useTranslations('admin.tool.gen')
  const [types, setTypes] = React.useState<GenTypeMeta[]>([])
  const [loadingMeta, setLoadingMeta] = React.useState(true)
  const [moduleName, setModuleName] = React.useState('')
  const [genType, setGenType] = React.useState<GenType>('list')
  const [fields, setFields] = React.useState<GenField[]>([])
  const [result, setResult] = React.useState<GenResult | null>(null)
  const [pending, setPending] = React.useState(false)

  const currentTypeMeta = types.find((m) => m.type === genType)

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      const r = await getToolGenMeta()
      if (cancelled) return
      if (r.success) {
        setTypes(r.data.types)
        // 选中第一个类型时,自动填入默认字段
        const first = r.data.types[0]
        if (first) {
          setGenType(first.type)
          setFields(first.defaultFields)
        }
      } else {
        toast.error(r.error ?? '加载模板元信息失败')
      }
      setLoadingMeta(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  function onTypeChange(next: GenType) {
    setGenType(next)
    const meta = types.find((m) => m.type === next)
    if (meta) setFields(meta.defaultFields)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const name = moduleName.trim()
    if (!name) {
      toast.error(t('error'))
      return
    }
    if (fields.length === 0) {
      toast.error('请至少配置一个字段')
      return
    }
    setPending(true)
    setResult(null)
    const r = await postToolGen({ type: genType, name, fields })
    setPending(false)
    if (!r.success) {
      toast.error(r.error ?? t('error'))
      return
    }
    setResult(r.data)
    toast.success(t('success'))
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

      <Card className="max-w-3xl">
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
                disabled={pending || loadingMeta}
              />
            </div>

            <TemplateSelector
              types={types}
              value={genType}
              onChange={onTypeChange}
              disabled={pending || loadingMeta}
              getLabel={(k) => t(k)}
            />

            {currentTypeMeta && (
              <FieldEditor
                fields={fields}
                onChange={setFields}
                fieldTypes={currentTypeMeta.fieldTypes}
                disabled={pending}
              />
            )}

            <div className="flex gap-2">
              <Button type="submit" disabled={pending || loadingMeta}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                <span>{t('generate')}</span>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {result && <GenResultViewer result={result} />}
    </div>
  )
}
