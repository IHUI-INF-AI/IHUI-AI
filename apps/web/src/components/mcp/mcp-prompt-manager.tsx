'use client'

import * as React from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Eye, Loader2, Play } from 'lucide-react'
import { toast } from 'sonner'

import {
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@ihui/ui'
import { fetchApi } from '@/lib/api'

import { McpResultPreview } from './mcp-result-preview'
import {
  type McpToolParameter,
  McpToolParameterForm,
} from './mcp-tool-parameter-form'

export interface McpPromptArgument {
  name: string
  description?: string
  required?: boolean
}

export interface McpPrompt {
  name: string
  description?: string
  arguments?: McpPromptArgument[]
  template?: string
}

function promptToFormParams(prompt: McpPrompt): McpToolParameter[] {
  return (prompt.arguments ?? []).map((arg) => ({
    name: arg.name,
    type: 'string' as const,
    description: arg.description,
    required: arg.required,
  }))
}

export function McpPromptManager() {
  const t = useTranslations('mcp')
  const [previewPrompt, setPreviewPrompt] = React.useState<McpPrompt | null>(
    null,
  )
  const [executePrompt, setExecutePrompt] = React.useState<McpPrompt | null>(
    null,
  )

  const { data: prompts, isLoading } = useQuery({
    queryKey: ['mcp', 'prompts'],
    queryFn: async () => {
      const res = await fetchApi<McpPrompt[]>('/api/ai/mcp/prompts')
      if (!res.success) throw new Error(res.error)
      return res.data
    },
  })

  const execMutation = useMutation({
    mutationFn: async (input: {
      name: string
      args: Record<string, unknown>
    }) => {
      const res = await fetchApi<unknown>(
        `/api/ai/mcp/prompts/${encodeURIComponent(input.name)}/execute`,
        {
          method: 'POST',
          body: JSON.stringify(input.args),
        },
      )
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const openExecute = (prompt: McpPrompt) => {
    execMutation.reset()
    setExecutePrompt(prompt)
  }

  const handleExecute = (values: Record<string, unknown>) => {
    if (!executePrompt) return
    execMutation.mutate({ name: executePrompt.name, args: values })
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{t('promptTitle')}</h2>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !prompts || prompts.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
          {t('noPrompts')}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {prompts.map((prompt) => (
            <Card key={prompt.name}>
              <CardContent className="p-4">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-medium">
                    {prompt.name}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setPreviewPrompt(prompt)}
                      title={t('preview')}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openExecute(prompt)}
                      title={t('executePrompt')}
                    >
                      <Play className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {prompt.description && (
                  <p className="mb-2 text-xs text-muted-foreground">
                    {prompt.description}
                  </p>
                )}
                {prompt.arguments && prompt.arguments.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {prompt.arguments.map((arg) => (
                      <span
                        key={arg.name}
                        className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                      >
                        {arg.name}
                        {arg.required ? '*' : ''}
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={!!previewPrompt}
        onOpenChange={(o) => !o && setPreviewPrompt(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{previewPrompt?.name}</DialogTitle>
          </DialogHeader>
          {previewPrompt?.description && (
            <p className="text-sm text-muted-foreground">
              {previewPrompt.description}
            </p>
          )}
          {previewPrompt?.arguments && previewPrompt.arguments.length > 0 && (
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">
                {t('parameters')}
              </span>
              {previewPrompt.arguments.map((arg) => (
                <div key={arg.name} className="text-xs">
                  <span className="font-mono">{arg.name}</span>
                  {arg.required && <span className="text-destructive">*</span>}
                  {arg.description && (
                    <span className="text-muted-foreground">
                      {' '}
                      — {arg.description}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          {previewPrompt?.template && (
            <pre className="max-h-[300px] overflow-auto rounded-md border bg-muted/30 p-3 text-xs whitespace-pre-wrap">
              {previewPrompt.template}
            </pre>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!executePrompt}
        onOpenChange={(o) => !o && setExecutePrompt(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('executePrompt')} — {executePrompt?.name}
            </DialogTitle>
          </DialogHeader>
          {executePrompt && (
            <div className="space-y-4">
              <McpToolParameterForm
                schema={promptToFormParams(executePrompt)}
                onSubmit={handleExecute}
                onCancel={() => setExecutePrompt(null)}
                submitting={execMutation.isPending}
              />
              {execMutation.isPending && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('executing')}
                </div>
              )}
              {execMutation.isSuccess && (
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    {t('result')}
                  </span>
                  <McpResultPreview result={execMutation.data} />
                </div>
              )}
              {execMutation.isError && (
                <p className="text-xs text-destructive">
                  {execMutation.error instanceof Error
                    ? execMutation.error.message
                    : t('error')}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
