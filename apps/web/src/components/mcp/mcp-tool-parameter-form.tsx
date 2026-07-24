'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@ihui/ui-react'
import { cn } from '@/lib/utils'

export interface McpToolParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'object'
  description?: string
  required?: boolean
  default?: unknown
  enum?: string[]
}

export interface McpToolParameterFormProps {
  schema: McpToolParameter[]
  onSubmit: (values: Record<string, unknown>) => void
  onCancel?: () => void
  submitting?: boolean
}

function defaultValue(p: McpToolParameter): unknown {
  if (p.default !== undefined) return p.default
  switch (p.type) {
    case 'boolean':
      return false
    case 'object':
      return '{}'
    default:
      return ''
  }
}

export function McpToolParameterForm({
  schema,
  onSubmit,
  onCancel,
  submitting,
}: McpToolParameterFormProps) {
  const t = useTranslations('mcp')
  const [values, setValues] = React.useState<Record<string, unknown>>(() => {
    const init: Record<string, unknown> = {}
    for (const p of schema) init[p.name] = defaultValue(p)
    return init
  })
  const [jsonError, setJsonError] = React.useState<string | null>(null)

  const set = (name: string, v: unknown) => setValues((prev) => ({ ...prev, [name]: v }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const out: Record<string, unknown> = {}
    for (const p of schema) {
      const raw = values[p.name]
      if (p.type === 'object') {
        try {
          out[p.name] =
            typeof raw === 'string' && raw.trim() === '' ? {} : JSON.parse(raw as string)
        } catch (err) {
          setJsonError(`${p.name}: ${(err as Error).message}`)
          return
        }
      } else if (p.type === 'number') {
        out[p.name] = raw === '' || raw === undefined ? undefined : Number(raw)
      } else {
        out[p.name] = raw
      }
    }
    setJsonError(null)
    onSubmit(out)
  }

  if (schema.length === 0) {
    return (
      <form onSubmit={handleSubmit} className="space-y-3">
        <p className="text-sm text-muted-foreground">{t('noParameters')}</p>
        <div className="flex justify-end gap-2">
          {onCancel && (
            <Button type="button" variant="ghost" size="sm" className="bg-muted" onClick={onCancel}>
              {t('cancel')}
            </Button>
          )}
          <Button type="submit" size="sm" disabled={submitting}>
            {t('submit')}
          </Button>
        </div>
      </form>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {schema.map((p) => (
        <div key={p.name} className="space-y-1.5">
          <Label htmlFor={`param-${p.name}`} className="flex items-center gap-1">
            <span>{p.name}</span>
            {p.required && <span className="text-destructive">*</span>}
            <span className="text-xs font-normal text-muted-foreground">({p.type})</span>
          </Label>
          {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
          {p.enum ? (
            <Select value={(values[p.name] as string) ?? ''} onValueChange={(v) => set(p.name, v)}>
              <SelectTrigger id={`param-${p.name}`}>
                <SelectValue placeholder={t('selectPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {p.enum.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : p.type === 'boolean' ? (
            <Switch
              id={`param-${p.name}`}
              checked={Boolean(values[p.name])}
              onCheckedChange={(v) => set(p.name, v)}
            />
          ) : p.type === 'object' ? (
            <textarea
              id={`param-${p.name}`}
              className={cn(
                'flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
              )}
              value={
                typeof values[p.name] === 'string'
                  ? (values[p.name] as string)
                  : JSON.stringify(values[p.name], null, 2)
              }
              onChange={(e) => set(p.name, e.target.value)}
              placeholder='{"key":"value"}'
            />
          ) : (
            <Input
              id={`param-${p.name}`}
              type={p.type === 'number' ? 'number' : 'text'}
              value={(values[p.name] as string | number) ?? ''}
              onChange={(e) => set(p.name, e.target.value)}
            />
          )}
        </div>
      ))}
      {jsonError && <p className="text-xs text-destructive">{jsonError}</p>}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            {t('cancel')}
          </Button>
        )}
        <Button type="submit" size="sm" disabled={submitting}>
          {t('submit')}
        </Button>
      </div>
    </form>
  )
}
