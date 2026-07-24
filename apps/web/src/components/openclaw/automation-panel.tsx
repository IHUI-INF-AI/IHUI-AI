'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Clock, Webhook, Plug, Plus, Trash2, Loader2 } from 'lucide-react'

import {
  Button,
  Input,
  Label,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@ihui/ui-react'
import {
  listAutomation,
  createCronJob,
  deleteCronJob,
  createWebhook,
  deleteWebhook,
  createHook,
  deleteHook,
  type CronJobItem,
  type WebhookItem,
  type HookItem,
} from '@/lib/openclaw-api'

// ===== Cron 子面板 =====

function CronSection({ items }: { items: CronJobItem[] }) {
  const t = useTranslations('floatingChat.openclaw')
  const queryClient = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [schedule, setSchedule] = React.useState('')
  const [task, setTask] = React.useState('')

  const createMutation = useMutation({
    mutationFn: () =>
      createCronJob({ name: name.trim(), schedule: schedule.trim(), task: task.trim() }),
    onSuccess: () => {
      toast.success(t('cronJobs'))
      setOpen(false)
      setName('')
      setSchedule('')
      setTask('')
      queryClient.invalidateQueries({ queryKey: ['openclaw', 'automation'] })
    },
    onError: () => toast.error(t('fillCronFields')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCronJob(id),
    onSuccess: () => {
      toast.success(t('cronJobs'))
      queryClient.invalidateQueries({ queryKey: ['openclaw', 'automation'] })
    },
    onError: () => toast.error(t('confirmDeleteCron')),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !schedule.trim() || !task.trim()) {
      toast.error(t('fillCronFields'))
      return
    }
    createMutation.mutate()
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4" />
          {t('cronJobs')}
        </CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4" />
              {t('addCronJob')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <DialogHeader>
                <DialogTitle>{t('addCronJob')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="cron-name">{t('cronName')}</Label>
                <Input id="cron-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cron-schedule">{t('cronSchedule')}</Label>
                <Input
                  id="cron-schedule"
                  value={schedule}
                  onChange={(e) => setSchedule(e.target.value)}
                  placeholder="0 * * * *"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cron-task">{t('cronTask')}</Label>
                <Input id="cron-task" value={task} onChange={(e) => setTask(e.target.value)} />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={createMutation.isPending}
                >
                  {t('confirmDeleteCron')}
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('addCronJob')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="rounded-md bg-muted/40 px-3 py-6 text-center text-sm text-muted-foreground">
            {t('noCronJobs')}
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2"
              >
                <Clock className="h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-medium">{c.name}</p>
                  <p className="break-words text-xs text-muted-foreground">
                    {c.schedule} · {c.task}
                  </p>
                </div>
                {c.enabled && (
                  <span className="rounded-sm bg-primary/10 px-2 py-0.5 text-xs text-primary">
                    {t('enabled')}
                  </span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (window.confirm(t('confirmDeleteCron'))) deleteMutation.mutate(c.id)
                  }}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

// ===== Webhook 子面板 =====

function WebhookSection({ items }: { items: WebhookItem[] }) {
  const t = useTranslations('floatingChat.openclaw')
  const queryClient = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [endpoint, setEndpoint] = React.useState('')
  const [events, setEvents] = React.useState('')

  const createMutation = useMutation({
    mutationFn: () =>
      createWebhook({
        name: name.trim(),
        endpoint: endpoint.trim(),
        events: events.trim(),
      }),
    onSuccess: () => {
      toast.success(t('webhooks'))
      setOpen(false)
      setName('')
      setEndpoint('')
      setEvents('')
      queryClient.invalidateQueries({ queryKey: ['openclaw', 'automation'] })
    },
    onError: () => toast.error(t('fillWebhookFields')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteWebhook(id),
    onSuccess: () => {
      toast.success(t('webhooks'))
      queryClient.invalidateQueries({ queryKey: ['openclaw', 'automation'] })
    },
    onError: () => toast.error(t('confirmDeleteWebhook')),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !endpoint.trim()) {
      toast.error(t('fillWebhookFields'))
      return
    }
    createMutation.mutate()
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Webhook className="h-4 w-4" />
          {t('webhooks')}
        </CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4" />
              {t('addWebhook')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <DialogHeader>
                <DialogTitle>{t('addWebhook')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="webhook-name">{t('webhookName')}</Label>
                <Input id="webhook-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="webhook-endpoint">{t('webhookEndpoint')}</Label>
                <Input
                  id="webhook-endpoint"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="webhook-events">{t('webhookEvents')}</Label>
                <Input
                  id="webhook-events"
                  value={events}
                  onChange={(e) => setEvents(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={createMutation.isPending}
                >
                  {t('confirmDeleteWebhook')}
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('addWebhook')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="rounded-md bg-muted/40 px-3 py-6 text-center text-sm text-muted-foreground">
            {t('noWebhooks')}
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((w) => (
              <li
                key={w.id}
                className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2"
              >
                <Webhook className="h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-medium">{w.name}</p>
                  <p className="break-words text-xs text-muted-foreground">
                    {w.endpoint}
                    {w.events ? ` · ${w.events}` : ''}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (window.confirm(t('confirmDeleteWebhook'))) deleteMutation.mutate(w.id)
                  }}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

// ===== Hook 子面板 =====

function HookSection({ items }: { items: HookItem[] }) {
  const t = useTranslations('floatingChat.openclaw')
  const queryClient = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [type, setType] = React.useState('')
  const [name, setName] = React.useState('')
  const [handler, setHandler] = React.useState('')

  const createMutation = useMutation({
    mutationFn: () => createHook({ type: type.trim(), name: name.trim(), handler: handler.trim() }),
    onSuccess: () => {
      toast.success(t('hooks'))
      setOpen(false)
      setType('')
      setName('')
      setHandler('')
      queryClient.invalidateQueries({ queryKey: ['openclaw', 'automation'] })
    },
    onError: () => toast.error(t('fillHookFields')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteHook(id),
    onSuccess: () => {
      toast.success(t('hooks'))
      queryClient.invalidateQueries({ queryKey: ['openclaw', 'automation'] })
    },
    onError: () => toast.error(t('confirmDeleteHook')),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!type.trim() || !name.trim() || !handler.trim()) {
      toast.error(t('fillHookFields'))
      return
    }
    createMutation.mutate()
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Plug className="h-4 w-4" />
          {t('hooks')}
        </CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4" />
              {t('addHook')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <DialogHeader>
                <DialogTitle>{t('addHook')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="hook-type">{t('hookType')}</Label>
                <Input id="hook-type" value={type} onChange={(e) => setType(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hook-name">{t('hookName')}</Label>
                <Input id="hook-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hook-handler">{t('hookHandler')}</Label>
                <Input
                  id="hook-handler"
                  value={handler}
                  onChange={(e) => setHandler(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={createMutation.isPending}
                >
                  {t('confirmDeleteHook')}
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('addHook')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="rounded-md bg-muted/40 px-3 py-6 text-center text-sm text-muted-foreground">
            {t('noHooks')}
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((h) => (
              <li
                key={h.id}
                className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2"
              >
                <Plug className="h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-medium">{h.name}</p>
                  <p className="break-words text-xs text-muted-foreground">
                    {h.type} · {h.handler}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (window.confirm(t('confirmDeleteHook'))) deleteMutation.mutate(h.id)
                  }}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

// ===== 主面板 =====

export function AutomationPanel() {
  const t = useTranslations('floatingChat.openclaw')

  const { data, isLoading } = useQuery({
    queryKey: ['openclaw', 'automation'],
    queryFn: listAutomation,
  })

  const cronJobs = data?.cronJobs ?? []
  const webhooks = data?.webhooks ?? []
  const hooks = data?.hooks ?? []

  return (
    <Tabs defaultValue="cron" className="space-y-4">
      <TabsList>
        <TabsTrigger value="cron">{t('cronJobs')}</TabsTrigger>
        <TabsTrigger value="webhooks">{t('webhooks')}</TabsTrigger>
        <TabsTrigger value="hooks">{t('hooks')}</TabsTrigger>
      </TabsList>
      {isLoading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        </div>
      ) : (
        <>
          <TabsContent value="cron" className="mt-0">
            <CronSection items={cronJobs} />
          </TabsContent>
          <TabsContent value="webhooks" className="mt-0">
            <WebhookSection items={webhooks} />
          </TabsContent>
          <TabsContent value="hooks" className="mt-0">
            <HookSection items={hooks} />
          </TabsContent>
        </>
      )}
    </Tabs>
  )
}

export default AutomationPanel
