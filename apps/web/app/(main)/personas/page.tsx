'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { UserCircle, FileJson, Loader2, Search, ChevronDown } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, Input } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { BackButton } from '@/components/common'
import { useAuthStore } from '@/stores/auth'
import { cn } from '@/lib/utils'

const AI_SERVICE_URL = process.env.NEXT_PUBLIC_AI_SERVICE_URL ?? 'http://localhost:8803'

interface Persona {
  name: string
  description: string
}

interface PersonaListResponse {
  personas: Persona[]
  count: number
}

/** JSON Schema 中单个字段的声明(可能缺省,全部可选) */
interface SchemaProperty {
  type?: string
  description?: string
  items?: { type?: string }
  enum?: string[]
}

/** JSON Schema 子集(input_schema / output_schema) */
interface JsonSchema {
  type?: string
  description?: string
  properties?: Record<string, SchemaProperty>
  required?: string[]
  additionalProperties?: boolean | JsonSchema
}

interface PersonaDetail {
  name: string
  description: string
  input_schema: JsonSchema
  output_schema: JsonSchema
}

/** 直连 ai-service:携带 Bearer token,错误时优先取后端 detail 作为提示 */
async function fetchAiJson<T>(path: string, token: string | null): Promise<T> {
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${AI_SERVICE_URL}${path}`, { headers })
  let json: unknown = null
  try {
    json = await res.json()
  } catch {
    json = null
  }
  if (!res.ok) {
    const detail =
      typeof json === 'object' && json !== null && 'detail' in json
        ? String((json as Record<string, unknown>).detail)
        : undefined
    throw new Error(detail ?? `请求失败:${res.status}`)
  }
  return json as T
}

/** 字段类型展示:array 时展示 items 子类型 */
function describeType(prop: SchemaProperty): string {
  if (prop.type === 'array') {
    return prop.items?.type ? `array<${prop.items.type}>` : 'array'
  }
  return prop.type ?? 'unknown'
}

/** 契约字段树:列出字段名 + 类型 + 描述;无 properties 时直接 JSON 展示 */
function SchemaView({ schema }: { schema: JsonSchema }) {
  const t = useTranslations('eduAi.personas')
  const properties = schema.properties

  if (!properties || Object.keys(properties).length === 0) {
    return (
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted/50 p-3 font-mono text-xs leading-relaxed text-muted-foreground">
        {JSON.stringify(schema, null, 2)}
      </pre>
    )
  }

  const requiredFields = schema.required ?? []

  return (
    <div className="space-y-2">
      {schema.description && (
        <p className="text-xs leading-relaxed text-muted-foreground">{schema.description}</p>
      )}
      <ul className="space-y-1.5">
        {Object.entries(properties).map(([fieldName, prop]) => (
          <li key={fieldName} className="rounded-md border bg-card p-2.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <code className="font-mono text-xs font-semibold text-primary">{fieldName}</code>
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
                {describeType(prop)}
              </span>
              {requiredFields.includes(fieldName) ? (
                <span className="text-[10px] font-medium text-destructive">{t('required')}</span>
              ) : (
                <span className="text-[10px] text-muted-foreground">{t('optional')}</span>
              )}
            </div>
            {prop.description && (
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {prop.description}
              </p>
            )}
            {prop.enum && prop.enum.length > 0 && (
              <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                {prop.enum.map((v) => JSON.stringify(v)).join(' | ')}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function PersonasPage() {
  const t = useTranslations('eduAi.personas')
  const tc = useTranslations('common')
  const token = useAuthStore((s) => s.token)

  const [personas, setPersonas] = React.useState<Persona[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState('')
  const [reloadKey, setReloadKey] = React.useState(0)

  const [selectedName, setSelectedName] = React.useState<string | null>(null)
  const [detail, setDetail] = React.useState<PersonaDetail | null>(null)
  const [detailLoading, setDetailLoading] = React.useState(false)
  const [detailError, setDetailError] = React.useState<string | null>(null)

  const loadPersonas = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchAiJson<PersonaListResponse>('/api/personas', token)
      setPersonas(data.personas ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [token])

  React.useEffect(() => {
    void loadPersonas()
  }, [loadPersonas, reloadKey])

  const loadDetail = React.useCallback(
    async (name: string) => {
      setDetailLoading(true)
      setDetailError(null)
      setDetail(null)
      try {
        const data = await fetchAiJson<PersonaDetail>(
          `/api/personas/${encodeURIComponent(name)}`,
          token,
        )
        setDetail(data)
      } catch (e) {
        setDetailError(e instanceof Error ? e.message : String(e))
      } finally {
        setDetailLoading(false)
      }
    },
    [token],
  )

  const handleToggle = (name: string) => {
    if (selectedName === name) {
      setSelectedName(null)
      setDetail(null)
      return
    }
    setSelectedName(name)
    void loadDetail(name)
  }

  const query = search.trim().toLowerCase()
  const filtered = query
    ? personas.filter(
        (p) =>
          p.name.toLowerCase().includes(query) || p.description.toLowerCase().includes(query),
      )
    : personas

  return (
    <div className="space-y-4">
      <BackButton fallbackHref="/" />
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <UserCircle className="h-7 w-7 text-primary" />
          {t('title')}
        </h1>
        <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
      </header>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchPlaceholder')}
          className="pl-9"
        />
      </div>

      {error ? (
        <Alert
          variant="danger"
          title={t('error')}
          description={error}
          action={
            <Button size="sm" onClick={() => setReloadKey((k) => k + 1)}>
              {tc('refresh')}
            </Button>
          }
        />
      ) : loading ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-center text-muted-foreground">
          <UserCircle className="h-8 w-8" />
          <p className="text-sm">{query ? t('empty') : t('noPersonas')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3">
          {filtered.map((p) => {
            const isSelected = p.name === selectedName
            return (
              <Card
                key={p.name}
                className={cn(
                  'transition-colors',
                  isSelected
                    ? 'border-primary ring-1 ring-primary/30'
                    : 'cursor-pointer hover:border-primary/40 hover:bg-accent/40',
                )}
              >
                <button
                  type="button"
                  onClick={() => handleToggle(p.name)}
                  aria-expanded={isSelected}
                  className="block w-full rounded-lg text-left"
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 font-mono text-sm font-semibold">
                        <UserCircle className="h-4 w-4 shrink-0 text-primary" />
                        {p.name}
                      </span>
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                          isSelected && 'rotate-180',
                        )}
                      />
                    </div>
                    <p className="mt-1.5 line-clamp-2 break-words text-xs text-muted-foreground">
                      {p.description || '—'}
                    </p>
                  </CardContent>
                </button>
              </Card>
            )
          })}
        </div>
      )}

      {selectedName && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <FileJson className="h-5 w-5 text-primary" />
            {selectedName}
            {detail?.description && (
              <span className="text-xs font-normal text-muted-foreground">
                {detail.description}
              </span>
            )}
          </h2>

          {detailLoading ? (
            <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              {t('loading')}
            </div>
          ) : detailError ? (
            <Alert variant="danger" title={t('error')} description={detailError} />
          ) : detail ? (
            <div className="grid grid-cols-1 gap-4 min-[768px]:grid-cols-2">
              <Card>
                <CardHeader className="p-4 pb-2">
                  <h3 className="text-sm font-medium">{t('inputSchema')}</h3>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <SchemaView schema={detail.input_schema} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="p-4 pb-2">
                  <h3 className="text-sm font-medium">{t('outputSchema')}</h3>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <SchemaView schema={detail.output_schema} />
                </CardContent>
              </Card>
            </div>
          ) : null}
        </section>
      )}
    </div>
  )
}
