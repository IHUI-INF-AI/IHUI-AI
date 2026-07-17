'use client'

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Loader2, Plug, PlugZap, Plus, Server, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ihui/ui'
import { cn } from '@/lib/utils'
import { fetchApi } from '@/lib/api'

export interface McpServer {
  id: string
  name: string
  url: string
  transport: 'stdio' | 'sse' | 'http'
  status: 'connected' | 'disconnected'
}

interface CreateServerInput {
  name: string
  url: string
  transport: 'stdio' | 'sse' | 'http'
}

interface AddServerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (input: CreateServerInput) => void
  submitting: boolean
}

function AddServerDialog({ open, onOpenChange, onSubmit, submitting }: AddServerDialogProps) {
  const t = useTranslations('mcp')
  const [name, setName] = React.useState('')
  const [url, setUrl] = React.useState('')
  const [transport, setTransport] = React.useState<'stdio' | 'sse' | 'http'>('sse')

  React.useEffect(() => {
    if (!open) {
      setName('')
      setUrl('')
      setTransport('sse')
    }
  }, [open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({ name, url, transport })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('addServer')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="mcp-server-name">{t('serverName')}</Label>
            <Input
              id="mcp-server-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('namePlaceholder')}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mcp-server-url">{t('serverUrl')}</Label>
            <Input
              id="mcp-server-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t('urlPlaceholder')}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mcp-server-transport">{t('transport')}</Label>
            <Select
              value={transport}
              onValueChange={(v) => setTransport(v as 'stdio' | 'sse' | 'http')}
            >
              <SelectTrigger id="mcp-server-transport">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stdio">stdio</SelectItem>
                <SelectItem value="sse">SSE</SelectItem>
                <SelectItem value="http">HTTP</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function McpManager() {
  const t = useTranslations('mcp')
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = React.useState(false)

  const { data: servers, isLoading } = useQuery({
    queryKey: ['mcp', 'servers'],
    queryFn: async () => {
      const res = await fetchApi<McpServer[]>('/api/ai/mcp/servers')
      if (!res.success) throw new Error(res.error)
      return res.data
    },
  })

  const createMutation = useMutation({
    mutationFn: async (input: CreateServerInput) => {
      const res = await fetchApi<McpServer>('/api/ai/mcp/servers', {
        method: 'POST',
        body: JSON.stringify(input),
      })
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      toast.success(t('createSuccess'))
      queryClient.invalidateQueries({ queryKey: ['mcp', 'servers'] })
      setDialogOpen(false)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const toggleMutation = useMutation({
    mutationFn: async (server: McpServer) => {
      const action = server.status === 'connected' ? 'disconnect' : 'connect'
      const res = await fetchApi<McpServer>(`/api/ai/mcp/servers/${server.id}/${action}`, {
        method: 'POST',
      })
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mcp', 'servers'] }),
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetchApi<void>(`/api/ai/mcp/servers/${id}`, {
        method: 'DELETE',
      })
      if (!res.success) throw new Error(res.error)
    },
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      queryClient.invalidateQueries({ queryKey: ['mcp', 'servers'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleDelete = (server: McpServer) => {
    if (window.confirm(t('deleteConfirm'))) {
      deleteMutation.mutate(server.id)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('managerTitle')}</h2>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          {t('addServer')}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !servers || servers.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
          <Server className="mx-auto mb-2 h-8 w-8 opacity-50" />
          {t('empty')}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {servers.map((server) => {
            const connected = server.status === 'connected'
            const toggling = toggleMutation.isPending && toggleMutation.variables?.id === server.id
            return (
              <Card key={server.id} className="transition-colors hover:bg-accent">
                <CardContent className="p-4">
                  <div className="mb-2 flex items-start justify-between">
                    <div className="min-w-0">
                      <div className="break-words font-medium">{server.name}</div>
                      <div className="break-words text-xs text-muted-foreground">{server.url}</div>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded-md px-2 py-0.5 text-xs font-medium',
                        connected
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {connected ? t('connected') : t('disconnected')}
                    </span>
                  </div>
                  <div className="mb-3 text-xs text-muted-foreground">
                    {t('transport')}: {server.transport}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={connected ? 'outline' : 'default'}
                      className="h-8 flex-1"
                      disabled={toggleMutation.isPending}
                      onClick={() => toggleMutation.mutate(server)}
                    >
                      {toggling ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : connected ? (
                        <PlugZap className="h-3.5 w-3.5" />
                      ) : (
                        <Plug className="h-3.5 w-3.5" />
                      )}
                      {connected ? t('disconnect') : t('connect')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      disabled={deleteMutation.isPending}
                      onClick={() => handleDelete(server)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <AddServerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={(v) => createMutation.mutate(v)}
        submitting={createMutation.isPending}
      />
    </div>
  )
}
