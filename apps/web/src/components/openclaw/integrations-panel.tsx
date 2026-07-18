'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Plug, PlugZap, Plus, Loader2, Radio } from 'lucide-react'

import {
  Button,
  Input,
  Label,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@ihui/ui'
import {
  listChannels,
  listSupportedChannels,
  connectChannel,
  disconnectChannel,
  createChannel,
  deleteChannel,
  type ChannelItem,
} from '@/lib/openclaw-api'

const CHANNEL_TYPES = [
  { value: 'web-chat', label: 'Web Chat' },
  { value: 'wechat-mp', label: 'WeChat MP' },
  { value: 'wechat-work', label: 'WeChat Work' },
  { value: 'slack', label: 'Slack' },
  { value: 'discord', label: 'Discord' },
  { value: 'teams', label: 'Teams' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'line', label: 'LINE' },
  { value: 'matrix', label: 'Matrix' },
  { value: 'signal', label: 'Signal' },
] as const

export function IntegrationsPanel() {
  const t = useTranslations('floatingChat.openclaw')
  const queryClient = useQueryClient()

  const channelsQuery = useQuery({
    queryKey: ['openclaw', 'channels'],
    queryFn: listChannels,
  })

  const supportedQuery = useQuery({
    queryKey: ['openclaw', 'channels', 'supported'],
    queryFn: listSupportedChannels,
  })

  const connectMutation = useMutation({
    mutationFn: (id: string) => connectChannel(id),
    onSuccess: () => {
      toast.success(t('connected'))
      queryClient.invalidateQueries({ queryKey: ['openclaw', 'channels'] })
    },
    onError: () => toast.error(t('connect')),
  })

  const disconnectMutation = useMutation({
    mutationFn: (id: string) => disconnectChannel(id),
    onSuccess: () => {
      toast.success(t('disconnected'))
      queryClient.invalidateQueries({ queryKey: ['openclaw', 'channels'] })
    },
    onError: () => toast.error(t('disconnect')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteChannel(id),
    onSuccess: () => {
      toast.success(t('confirmDeleteChannel'))
      queryClient.invalidateQueries({ queryKey: ['openclaw', 'channels'] })
    },
    onError: () => toast.error(t('confirmDeleteChannel')),
  })

  const channels: ChannelItem[] = channelsQuery.data ?? []
  const supportedList =
    supportedQuery.data ??
    CHANNEL_TYPES.map((c) => ({
      id: c.value,
      type: c.value,
      name: c.label,
    }))

  const merged = React.useMemo(() => {
    const map = new Map<string, ChannelItem>()
    for (const s of supportedList) {
      map.set(s.id, { ...s, connected: false })
    }
    for (const c of channels) {
      map.set(c.id, { ...map.get(c.id), ...c })
    }
    return Array.from(map.values())
  }, [channels, supportedList])

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Radio className="h-4 w-4" />
            {t('integrationsHint')}
          </CardTitle>
          <AddChannelDialog />
        </CardHeader>
        <CardContent>
          {channelsQuery.isLoading ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            </div>
          ) : merged.length === 0 ? (
            <p className="rounded-md bg-muted/40 px-3 py-6 text-center text-sm text-muted-foreground">
              {t('noChannels')}
            </p>
          ) : (
            <ul className="space-y-2">
              {merged.map((c) => {
                const connected = !!c.connected
                return (
                  <li
                    key={c.id}
                    className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2"
                  >
                    {connected ? (
                      <PlugZap className="h-4 w-4 shrink-0 text-primary" />
                    ) : (
                      <Plug className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-medium">{c.name}</p>
                      <p className="break-words text-xs text-muted-foreground">{c.type}</p>
                    </div>
                    <span
                      className={
                        connected
                          ? 'rounded-sm bg-primary/10 px-2 py-0.5 text-xs text-primary'
                          : 'rounded-sm bg-muted px-2 py-0.5 text-xs text-muted-foreground'
                      }
                    >
                      {connected ? t('connected') : t('disconnected')}
                    </span>
                    {connected ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => disconnectMutation.mutate(c.id)}
                        disabled={disconnectMutation.isPending}
                      >
                        {t('disconnect')}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => connectMutation.mutate(c.id)}
                        disabled={connectMutation.isPending}
                      >
                        {t('connect')}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (window.confirm(t('confirmDeleteChannel'))) {
                          deleteMutation.mutate(c.id)
                        }
                      }}
                      disabled={deleteMutation.isPending}
                    >
                      {t('confirmDeleteChannel')}
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function AddChannelDialog() {
  const t = useTranslations('floatingChat.openclaw')
  const queryClient = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [type, setType] = React.useState<string>('')
  const [name, setName] = React.useState('')

  const createMutation = useMutation({
    mutationFn: () => createChannel({ type, name: name.trim() }),
    onSuccess: () => {
      toast.success(t('addChannel'))
      setOpen(false)
      setType('')
      setName('')
      queryClient.invalidateQueries({ queryKey: ['openclaw', 'channels'] })
    },
    onError: () => toast.error(t('addChannel')),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!type || !name.trim()) return
    createMutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          {t('addChannel')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t('addChannel')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="channel-type">{t('channelType')}</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="channel-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHANNEL_TYPES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="channel-name">{t('channelName')}</Label>
            <Input id="channel-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={createMutation.isPending}
            >
              {t('confirmDeleteChannel')}
            </Button>
            <Button type="submit" disabled={!type || !name.trim() || createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('addChannel')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default IntegrationsPanel
