'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { Plus, Edit, Trash2, Loader2, ChevronLeft, ChevronRight, Shield } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Button,
  Input,
  Label,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@ihui/ui'

interface AgentRule {
  id: string
  agentId: string
  name: string
  code: string
  type: string
  priority: number
  status: number
}

interface RuleParam {
  id: string
  ruleId: string
  name: string
  code: string
  type: string
  value: string
  status: number
}

interface ListData<T> {
  list: T[]
  total: number
}

const PAGE_SIZE = 20

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

function fetchRules(page: number): Promise<ListData<AgentRule>> {
  const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
  return api<ListData<AgentRule>>(`/api/agent-ext/rules/list?${qs.toString()}`)
}

function fetchRuleParams(page: number): Promise<ListData<RuleParam>> {
  const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
  return api<ListData<RuleParam>>(`/api/agent-ext/rule-params/list?${qs.toString()}`)
}

interface RuleForm {
  agentId: string
  name: string
  code: string
  type: string
  priority: string
  status: boolean
}

const EMPTY_FORM: RuleForm = {
  agentId: '',
  name: '',
  code: '',
  type: 'system',
  priority: '0',
  status: true,
}

export default function AgentRulesPage() {
  const t = useTranslations('admin.agentRules')
  const qc = useQueryClient()
  const [currentTab, setCurrentTab] = React.useState<'rules' | 'params'>('rules')
  const [currentPage, setCurrentPage] = React.useState(1)
  const [showAddForm, setShowAddForm] = React.useState(false)
  const [form, setForm] = React.useState<RuleForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  const RULE_TYPES = [
    { value: 'system', label: t('ruleTypes.system') },
    { value: 'user', label: t('ruleTypes.user') },
    { value: 'tool', label: t('ruleTypes.tool') },
    { value: 'constraint', label: t('ruleTypes.constraint') },
  ]

  const {
    data: rulesData,
    isLoading: rulesLoading,
    error: rulesError,
  } = useQuery({
    queryKey: ['admin', 'agent-rules', currentPage],
    queryFn: () => fetchRules(currentPage),
  })

  const {
    data: paramsData,
    isLoading: paramsLoading,
    error: paramsError,
  } = useQuery({
    queryKey: ['admin', 'agent-rule-params', currentPage],
    queryFn: () => fetchRuleParams(currentPage),
  })

  const createMut = useMutation({
    mutationFn: () => {
      const body = {
        agentId: form.agentId.trim(),
        name: form.name.trim(),
        code: form.code.trim(),
        type: form.type,
        priority: Number(form.priority) || 0,
        status: form.status ? 1 : 0,
      }
      return api('/api/agent-ext/rules', {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      toast.success(t('createSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'agent-rules'] })
      resetForm()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const deleteRuleMut = useMutation({
    mutationFn: (id: string) => api(`/api/agent-ext/rules/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'agent-rules'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteParamMut = useMutation({
    mutationFn: (id: string) => api(`/api/agent-ext/rule-params/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'agent-rule-params'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function handleTabChange(tab: string) {
    setCurrentTab(tab as 'rules' | 'params')
    setCurrentPage(1)
  }

  function resetForm() {
    setForm(EMPTY_FORM)
    setErr(null)
    setShowAddForm(false)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!form.name.trim()) {
      setErr(t('nameRequired'))
      return
    }
    if (!form.code.trim()) {
      setErr(t('codeRequired'))
      return
    }
    createMut.mutate()
  }

  function handleDeleteRule(rule: AgentRule) {
    if (!window.confirm(t('deleteConfirm', { name: rule.name }))) return
    deleteRuleMut.mutate(rule.id)
  }

  function handleDeleteParam(param: RuleParam) {
    if (!window.confirm(t('deleteParamConfirm', { name: param.name }))) return
    deleteParamMut.mutate(param.id)
  }

  const rulesTotal = rulesData?.total ?? 0
  const paramsTotal = paramsData?.total ?? 0
  const rules = rulesData?.list ?? []
  const params = paramsData?.list ?? []

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <Tabs value={currentTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="rules">{t('rules')}</TabsTrigger>
          <TabsTrigger value="params">{t('params')}</TabsTrigger>
        </TabsList>

        {/* ========== 规则列表 ========== */}
        <TabsContent value="rules" className="space-y-4">
          <div className="flex items-center justify-end">
            <Button onClick={() => setShowAddForm((v) => !v)} size="sm">
              <Plus className="h-4 w-4" />
              {showAddForm ? t('hideForm') : t('create')}
            </Button>
          </div>

          {showAddForm && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t('formTitle')}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={submit} className="space-y-4">
                  {err && (
                    <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {err}
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="r-agent">{t('agentId')}</Label>
                      <Input
                        id="r-agent"
                        value={form.agentId}
                        onChange={(e) => setForm({ ...form, agentId: e.target.value })}
                        placeholder={t('agentIdPlaceholder')}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="r-name">{t('ruleName')}</Label>
                      <Input
                        id="r-name"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder={t('namePlaceholder')}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="r-code">{t('ruleCode')}</Label>
                      <Input
                        id="r-code"
                        value={form.code}
                        onChange={(e) => setForm({ ...form, code: e.target.value })}
                        placeholder={t('codePlaceholder')}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="r-type">{t('ruleType')}</Label>
                      <Select
                        value={form.type}
                        onValueChange={(v) => setForm({ ...form, type: v })}
                      >
                        <SelectTrigger id="r-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RULE_TYPES.map((rt) => (
                            <SelectItem key={rt.value} value={rt.value}>
                              {rt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="r-priority">{t('priority')}</Label>
                      <Input
                        id="r-priority"
                        type="number"
                        min="0"
                        value={form.priority}
                        onChange={(e) => setForm({ ...form, priority: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="r-status">{t('status')}</Label>
                      <Select
                        value={form.status ? '1' : '0'}
                        onValueChange={(v) => setForm({ ...form, status: v === '1' })}
                      >
                        <SelectTrigger id="r-status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">{t('enable')}</SelectItem>
                          <SelectItem value="0">{t('disable')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={resetForm}
                      disabled={createMut.isPending}
                    >
                      {t('cancel')}
                    </Button>
                    <Button type="submit" disabled={createMut.isPending}>
                      {createMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                      {t('save')}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="px-4 py-2.5">{t('ruleId')}</TableHead>
                  <TableHead className="px-4 py-2.5">{t('agentId')}</TableHead>
                  <TableHead className="px-4 py-2.5">{t('ruleName')}</TableHead>
                  <TableHead className="px-4 py-2.5">{t('ruleCode')}</TableHead>
                  <TableHead className="px-4 py-2.5">{t('ruleType')}</TableHead>
                  <TableHead className="px-4 py-2.5">{t('priority')}</TableHead>
                  <TableHead className="px-4 py-2.5">{t('status')}</TableHead>
                  <TableHead className="px-4 py-2.5 text-right">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y">
                {rulesLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                      {t('loading')}
                    </TableCell>
                  </TableRow>
                ) : rulesError ? (
                  <TableRow>
                    <TableCell colSpan={8} className="px-4 py-10 text-center text-destructive">
                      {(rulesError as Error).message}
                    </TableCell>
                  </TableRow>
                ) : rules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                      <Shield className="mx-auto mb-2 h-8 w-8 opacity-40" />
                      {t('noData')}
                    </TableCell>
                  </TableRow>
                ) : (
                  rules.map((rule) => {
                    const enabled = rule.status === 1
                    return (
                      <TableRow key={rule.id} className="hover:bg-muted/30">
                        <TableCell className="px-4 py-2.5 font-mono text-xs">{rule.id}</TableCell>
                        <TableCell className="px-4 py-2.5 font-mono text-xs">
                          {rule.agentId}
                        </TableCell>
                        <TableCell className="px-4 py-2.5 font-medium">{rule.name}</TableCell>
                        <TableCell className="px-4 py-2.5 font-mono text-xs">{rule.code}</TableCell>
                        <TableCell className="px-4 py-2.5">{rule.type}</TableCell>
                        <TableCell className="px-4 py-2.5">{rule.priority}</TableCell>
                        <TableCell className="px-4 py-2.5">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                              enabled
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                                : 'bg-muted text-muted-foreground',
                            )}
                          >
                            <span
                              className={cn(
                                'h-1.5 w-1.5 rounded-full',
                                enabled ? 'bg-emerald-500' : 'bg-muted-foreground',
                              )}
                            />
                            {enabled ? t('enable') : t('disable')}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" title={t('edit')}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteRule(rule)}
                              title={t('delete')}
                              className="text-destructive hover:text-destructive"
                              disabled={deleteRuleMut.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {t('total', { total: rulesTotal })}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                {t('prev')}
              </Button>
              <span className="text-sm text-muted-foreground">
                {t('pageInfo', {
                  page: currentPage,
                  totalPages: Math.max(1, Math.ceil(rulesTotal / PAGE_SIZE)),
                })}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= Math.max(1, Math.ceil(rulesTotal / PAGE_SIZE))}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                {t('next')}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ========== 规则参数 ========== */}
        <TabsContent value="params" className="space-y-4">
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="px-4 py-2.5">{t('paramId')}</TableHead>
                  <TableHead className="px-4 py-2.5">{t('paramRuleId')}</TableHead>
                  <TableHead className="px-4 py-2.5">{t('paramName')}</TableHead>
                  <TableHead className="px-4 py-2.5">{t('paramCode')}</TableHead>
                  <TableHead className="px-4 py-2.5">{t('paramType')}</TableHead>
                  <TableHead className="px-4 py-2.5">{t('paramValue')}</TableHead>
                  <TableHead className="px-4 py-2.5">{t('status')}</TableHead>
                  <TableHead className="px-4 py-2.5 text-right">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y">
                {paramsLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                      {t('loading')}
                    </TableCell>
                  </TableRow>
                ) : paramsError ? (
                  <TableRow>
                    <TableCell colSpan={8} className="px-4 py-10 text-center text-destructive">
                      {(paramsError as Error).message}
                    </TableCell>
                  </TableRow>
                ) : params.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                      <Shield className="mx-auto mb-2 h-8 w-8 opacity-40" />
                      {t('noData')}
                    </TableCell>
                  </TableRow>
                ) : (
                  params.map((param) => {
                    const enabled = param.status === 1
                    return (
                      <TableRow key={param.id} className="hover:bg-muted/30">
                        <TableCell className="px-4 py-2.5 font-mono text-xs">{param.id}</TableCell>
                        <TableCell className="px-4 py-2.5 font-mono text-xs">
                          {param.ruleId}
                        </TableCell>
                        <TableCell className="px-4 py-2.5 font-medium">{param.name}</TableCell>
                        <TableCell className="px-4 py-2.5 font-mono text-xs">
                          {param.code}
                        </TableCell>
                        <TableCell className="px-4 py-2.5">{param.type}</TableCell>
                        <TableCell className="px-4 py-2.5">{param.value}</TableCell>
                        <TableCell className="px-4 py-2.5">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                              enabled
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                                : 'bg-muted text-muted-foreground',
                            )}
                          >
                            <span
                              className={cn(
                                'h-1.5 w-1.5 rounded-full',
                                enabled ? 'bg-emerald-500' : 'bg-muted-foreground',
                              )}
                            />
                            {enabled ? t('enable') : t('disable')}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" title={t('edit')}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteParam(param)}
                              title={t('delete')}
                              className="text-destructive hover:text-destructive"
                              disabled={deleteParamMut.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {t('total', { total: paramsTotal })}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                {t('prev')}
              </Button>
              <span className="text-sm text-muted-foreground">
                {t('pageInfo', {
                  page: currentPage,
                  totalPages: Math.max(1, Math.ceil(paramsTotal / PAGE_SIZE)),
                })}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= Math.max(1, Math.ceil(paramsTotal / PAGE_SIZE))}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                {t('next')}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
