'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { fetchCombos, createCombo, deleteCombo } from '@ihui/api-client'
import {
  Button,
  Card,
  CardContent,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@ihui/ui-react'
import { Loader2, Plus, Trash2 } from 'lucide-react'

import type { ComboChain, ComboStrategy } from './types'

const STRATEGIES: ComboStrategy[] = ['priority', 'cheapest', 'fusion']

const STRATEGY_BADGE: Record<ComboStrategy, string> = {
  priority: 'border-transparent bg-violet-500/15 text-violet-600 dark:text-violet-500',
  cheapest: 'border-transparent bg-amber-500/15 text-amber-600 dark:text-amber-500',
  fusion: 'border-transparent bg-pink-500/15 text-pink-600 dark:text-pink-500',
}

export function CombosTab() {
  const t = useTranslations('settings.gateway.combos')
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['gateway-combos'],
    queryFn: fetchCombos,
  })
  const combos: ComboChain[] = data?.combos ?? []

  const [createOpen, setCreateOpen] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<ComboChain | null>(null)

  const createMut = useMutation({
    mutationFn: createCombo,
    onSuccess: () => {
      toast.success(t('createSuccess'))
      qc.invalidateQueries({ queryKey: ['gateway-combos'] })
      setCreateOpen(false)
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Error'),
  })

  const deleteMut = useMutation({
    mutationFn: (name: string) => deleteCombo(name),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['gateway-combos'] })
      setDeleteTarget(null)
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Error'),
  })

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          {t('create')}
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      )}

      {!isLoading && combos.length === 0 && (
        <p className="py-8 text-center text-xs text-muted-foreground">{t('empty')}</p>
      )}

      <div className="space-y-2">
        {combos.map((c) => (
          <Card key={c.name}>
            <CardContent className="p-3 min-[640px]:p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{c.name}</p>
                    <Badge className={STRATEGY_BADGE[c.strategy]}>{c.strategy}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {c.chain.map((m) => (
                      <Badge key={m} variant="secondary" className="text-[11px]">
                        {m}
                      </Badge>
                    ))}
                  </div>
                  {c.strategy === 'fusion' && c.judge && (
                    <p className="text-[11px] text-muted-foreground">
                      judge: <span className="text-foreground">{c.judge}</span>
                    </p>
                  )}
                  {c.description && (
                    <p className="text-[11px] text-muted-foreground">{c.description}</p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 shrink-0 px-2 text-xs text-muted-foreground hover:text-red-600"
                  onClick={() => setDeleteTarget(c)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <CreateComboDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        submitting={createMut.isPending}
        onSubmit={(v) => createMut.mutate(v)}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('delete')}</DialogTitle>
            <DialogDescription>
              {t('deleteConfirm', { name: deleteTarget?.name ?? '' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={deleteMut.isPending}
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.name)}
            >
              {t('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface FormValues {
  name: string
  strategy: ComboStrategy
  chain: string[]
  judge: string | null
  description: string
}

function CreateComboDialog({
  open,
  onOpenChange,
  submitting,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  submitting: boolean
  onSubmit: (v: FormValues) => void
}) {
  const t = useTranslations('settings.gateway.combos')

  const [name, setName] = React.useState('')
  const [strategy, setStrategy] = React.useState<ComboStrategy>('priority')
  const [chainText, setChainText] = React.useState('')
  const [judge, setJudge] = React.useState('')
  const [description, setDescription] = React.useState('')

  React.useEffect(() => {
    if (!open) {
      setName('')
      setStrategy('priority')
      setChainText('')
      setJudge('')
      setDescription('')
    }
  }, [open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const chain = chainText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    if (!name.trim() || chain.length === 0) return
    onSubmit({
      name: name.trim(),
      strategy,
      chain,
      judge: strategy === 'fusion' && judge.trim() ? judge.trim() : null,
      description: description.trim(),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('create')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">{t('name')}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="maximize-free"
              required
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t('strategy')}</Label>
            <Select value={strategy} onValueChange={(v) => setStrategy(v as ComboStrategy)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STRATEGIES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t('chain')}</Label>
            <textarea
              value={chainText}
              onChange={(e) => setChainText(e.target.value)}
              placeholder={'kimi-k2\nglm-4-flash\ndeepseek-chat'}
              rows={4}
              required
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          {strategy === 'fusion' && (
            <div className="space-y-1">
              <Label className="text-xs">{t('judge')}</Label>
              <Input
                value={judge}
                onChange={(e) => setJudge(e.target.value)}
                placeholder="glm-4-flash"
              />
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs">{t('description')}</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
              {t('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
