'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { Plus, Download } from 'lucide-react'
import { Button, Tabs, TabsList, TabsTrigger, TabsContent } from '@ihui/ui'
import { exportFromApi } from '@/lib/export-utils'

import { AgentRuleForm } from './AgentRuleForm'
import { RulesTable } from './RulesTable'
import { ParamsTable } from './ParamsTable'
import { Pagination } from './Pagination'
import {
  PAGE_SIZE,
  EMPTY_FORM,
  api,
  fetchRules,
  fetchRuleParams,
  RULES_EXPORT_COLS,
  PARAMS_EXPORT_COLS,
} from './helpers'
import type { AgentRule, RuleParam, RuleForm } from './types'

export default function AgentRulesPage() {
  const t = useTranslations('admin.agentRules')
  const qc = useQueryClient()
  const [currentTab, setCurrentTab] = React.useState<'rules' | 'params'>('rules')
  const [currentPage, setCurrentPage] = React.useState(1)
  const [showAddForm, setShowAddForm] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
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

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        agentId: form.agentId.trim(),
        ruleName: form.ruleName.trim(),
        ruleCode: form.ruleCode.trim(),
        ruleType: form.ruleType,
        priority: Number(form.priority) || 0,
        status: form.status ? 1 : 0,
        description: form.description.trim() || undefined,
      }
      return editingId
        ? api(`/api/agent-ext/rules/${editingId}`, { method: 'PUT', body: JSON.stringify(body) })
        : api('/api/agent-ext/rules', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editingId ? t('updateSuccess') : t('createSuccess'))
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
    setEditingId(null)
    setShowAddForm(false)
  }
  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setErr(null)
    setShowAddForm(true)
  }
  function openEditRule(rule: AgentRule) {
    setEditingId(rule.id)
    setForm({
      agentId: rule.agentId,
      ruleName: rule.ruleName,
      ruleCode: rule.ruleCode,
      ruleType: rule.ruleType,
      priority: String(rule.priority),
      status: rule.status === 1,
      description: rule.description ?? '',
    })
    setErr(null)
    setShowAddForm(true)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!form.ruleName.trim()) return setErr(t('nameRequired'))
    if (!form.ruleCode.trim()) return setErr(t('codeRequired'))
    saveMut.mutate()
  }
  function handleDeleteRule(rule: AgentRule) {
    if (!window.confirm(t('deleteConfirm', { name: rule.ruleName }))) return
    deleteRuleMut.mutate(rule.id)
  }
  function handleDeleteParam(param: RuleParam) {
    if (!window.confirm(t('deleteParamConfirm', { name: param.name }))) return
    deleteParamMut.mutate(param.id)
  }
  async function handleExportRules() {
    const ok = await exportFromApi(
      `/api/agent-ext/rules/list?page=1&pageSize=${PAGE_SIZE * 10}`,
      'agent-rules',
      [...RULES_EXPORT_COLS],
    )
    if (!ok) toast.error(t('exportFailed'))
  }
  async function handleExportParams() {
    const ok = await exportFromApi(
      `/api/agent-ext/rule-params/list?page=1&pageSize=${PAGE_SIZE * 10}`,
      'agent-rule-params',
      [...PARAMS_EXPORT_COLS],
    )
    if (!ok) toast.error(t('exportFailed'))
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
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={handleExportRules}>
              <Download className="h-4 w-4" />
              {t('export')}
            </Button>
            <Button onClick={() => (editingId ? resetForm() : openCreate())} size="sm">
              <Plus className="h-4 w-4" />
              {editingId || showAddForm ? t('hideForm') : t('create')}
            </Button>
          </div>
          {showAddForm && (
            <AgentRuleForm
              form={form}
              setForm={setForm}
              err={err}
              savePending={saveMut.isPending}
              isEditing={!!editingId}
              onSubmit={submit}
              onCancel={resetForm}
            />
          )}
          <RulesTable
            rows={rules}
            isLoading={rulesLoading}
            error={rulesError as Error | null}
            onEdit={openEditRule}
            onDelete={handleDeleteRule}
            deletePending={deleteRuleMut.isPending}
          />
          <Pagination
            page={currentPage}
            totalPages={rulesTotalPages}
            total={rulesTotal}
            setPage={setCurrentPage}
          />
        </TabsContent>

        <TabsContent value="params" className="space-y-4">
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={handleExportParams}>
              <Download className="h-4 w-4" />
              {t('export')}
            </Button>
          </div>
          <ParamsTable
            rows={params}
            isLoading={paramsLoading}
            error={paramsError as Error | null}
            onDelete={handleDeleteParam}
            deletePending={deleteParamMut.isPending}
          />
          <Pagination
            page={currentPage}
            totalPages={paramsTotalPages}
            total={paramsTotal}
            setPage={setCurrentPage}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
