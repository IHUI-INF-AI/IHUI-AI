'use client'

import * as React from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ihui/ui-react'
import { fetchApi } from '@/lib/api'

import type { McpServer } from './mcp-manager'
import { McpToolCallResult } from './mcp-tool-call-result'
import {
  type McpToolParameter,
  McpToolParameterForm,
} from './mcp-tool-parameter-form'

export interface McpTool {
  name: string
  description?: string
  inputSchema?: {
    type: 'object'
    properties?: Record<
      string,
      {
        type?: 'string' | 'number' | 'boolean' | 'object'
        description?: string
        enum?: string[]
        default?: unknown
      }
    >
    required?: string[]
  }
}

interface CallToolInput {
  serverId: string
  toolName: string
  arguments: Record<string, unknown>
}

interface CallResult {
  result: unknown
  duration?: number
}

function schemaToFormParams(tool: McpTool): McpToolParameter[] {
  const props = tool.inputSchema?.properties
  if (!props) return []
  const required = new Set(tool.inputSchema?.required ?? [])
  return Object.entries(props).map(([name, prop]) => ({
    name,
    type: (prop.type ?? 'string') as McpToolParameter['type'],
    description: prop.description,
    required: required.has(name),
    default: prop.default,
    enum: prop.enum,
  }))
}

export interface McpQuickCallProps {
  serverId?: string
}

export function McpQuickCall({ serverId: fixedServerId }: McpQuickCallProps) {
  const t = useTranslations('mcp')
  const [selectedServer, setSelectedServer] = React.useState(
    fixedServerId ?? '',
  )
  const [selectedTool, setSelectedTool] = React.useState('')

  const serverId = fixedServerId ?? selectedServer

  const { data: servers } = useQuery({
    queryKey: ['mcp', 'servers'],
    queryFn: async () => {
      const res = await fetchApi<McpServer[]>('/api/ai/mcp/servers')
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    enabled: !fixedServerId,
  })

  const { data: tools, isLoading: toolsLoading } = useQuery({
    queryKey: ['mcp', 'servers', serverId, 'tools'],
    queryFn: async () => {
      const res = await fetchApi<McpTool[]>(
        `/api/ai/mcp/servers/${serverId}/tools`,
      )
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    enabled: !!serverId,
  })

  const callMutation = useMutation({
    mutationFn: async (input: CallToolInput) => {
      const res = await fetchApi<CallResult>('/api/ai/mcp/tools/call', {
        method: 'POST',
        body: JSON.stringify({
          serverId: input.serverId,
          name: input.toolName,
          arguments: input.arguments,
        }),
      })
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const currentTool = tools?.find((tool) => tool.name === selectedTool)
  const formParams = React.useMemo(
    () => (currentTool ? schemaToFormParams(currentTool) : []),
    [currentTool],
  )

  const handleServerChange = (id: string) => {
    setSelectedServer(id)
    setSelectedTool('')
  }

  const handleSubmit = (values: Record<string, unknown>) => {
    if (!serverId || !selectedTool) return
    callMutation.mutate({
      serverId,
      toolName: selectedTool,
      arguments: values,
    })
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{t('quickCallTitle')}</h2>

      <div className="grid gap-3 sm:grid-cols-2">
        {!fixedServerId && (
          <div className="space-y-1.5">
            <Label>{t('selectServer')}</Label>
            <Select
              value={selectedServer}
              onValueChange={handleServerChange}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('selectServer')} />
              </SelectTrigger>
              <SelectContent>
                {(servers ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1.5">
          <Label>{t('selectTool')}</Label>
          <Select
            value={selectedTool}
            onValueChange={setSelectedTool}
            disabled={!serverId}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('selectTool')} />
            </SelectTrigger>
            <SelectContent>
              {(tools ?? []).map((tool) => (
                <SelectItem key={tool.name} value={tool.name}>
                  {tool.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {currentTool?.description && (
        <p className="text-sm text-muted-foreground">
          {currentTool.description}
        </p>
      )}

      {serverId && toolsLoading && (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {currentTool && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">{t('parameters')}</CardTitle>
          </CardHeader>
          <CardContent>
            <McpToolParameterForm
              schema={formParams}
              onSubmit={handleSubmit}
              submitting={callMutation.isPending}
            />
          </CardContent>
        </Card>
      )}

      {callMutation.isPending && (
        <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('executing')}
        </div>
      )}

      {callMutation.isSuccess && callMutation.data && (
        <McpToolCallResult
          toolName={selectedTool}
          result={callMutation.data.result}
          duration={callMutation.data.duration}
          status="success"
        />
      )}
      {callMutation.isError && (
        <McpToolCallResult
          toolName={selectedTool}
          result={null}
          status="error"
          error={
            callMutation.error instanceof Error
              ? callMutation.error.message
              : t('error')
          }
        />
      )}
    </div>
  )
}
