'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button, Tabs, TabsList, TabsTrigger, TabsContent } from '@ihui/ui'

import { AgentRuleForm } from './AgentRuleForm'
import { RulesTable } from './RulesTable'
import { ParamsTable } from './ParamsTable'
import { PAGE_SIZE, EMPTY_FORM, api, fetchRules, fetchRuleParams } from './helpers'
import type { AgentRule, RuleParam, RuleForm } from './types'

export default function AgentRulesPage() {
  const t = useTranslations('admin.agentRules')
  const qc = useQueryClient()
  const [currentTab, setCurrentTab] = React.useState<'rules' | 'params'>('rules')
  const [currentPage, setCurrentPage] = React.useState(1)
  const [showAddForm, setShowAddForm] = React.useState(false)
  const [form, setForm] = React.useState<RuleForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

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
      return api('/api/agent-ext/rules', { method: 'POST', body: JSON.stringify(body) })
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
    if (!form.name.trim()) return setErr(t('nameRequired'))
    if (!form.code.trim()) return setErr(t('codeRequired'))
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
  const rulesTotalPages = Math.max(1, Math.ceil(rulesTotal / PAGE_SIZE))
  const paramsTotalPages = Math.max(1, Math.ceil(paramsTotal / PAGE_SIZE))

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

        <TabsContent value="rules" className="space-y-4">
          <div className="flex items-center justify-end">
            <Button onClick={() => setShowAddForm((v) => !v)} size="sm">
              <Plus className="h-4 w-4" />
              {showAddForm ? t('hideForm') : t('create')}
            </Button>
          </div>
          {showAddForm && (
            <AgentRuleForm
              form={form}
              setForm={setForm}
              err={err}
              savePending={createMut.isPending}
              onSubmit={submit}
              onCancel={resetForm}
            />
          )}
          <RulesTable
            rows={rules}
            isLoading={rulesLoading}
            error={rulesError as Error | null}
            onDelete={handleDeleteRule}
            deletePending={deleteRuleMut.isPending}
          />
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
                {t('pageInfo', { page: currentPage, totalPages: rulesTotalPages })}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= rulesTotalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                {t('next')}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="params" className="space-y-4">
          <ParamsTable
            rows={params}
            isLoading={paramsLoading}
            error={paramsError as Error | null}
            onDelete={handleDeleteParam}
            deletePending={deleteParamMut.isPending}
          />
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
                {t('pageInfo', { page: currentPage, totalPages: paramsTotalPages })}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= paramsTotalPages}
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
