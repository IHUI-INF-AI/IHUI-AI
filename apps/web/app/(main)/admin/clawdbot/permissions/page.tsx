'use client'

import * as React from 'react'
import { Shield, Loader2, Plus, Trash2 } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button, Input, Label } from '@ihui/ui'
import { Alert } from '@/components/feedback'

interface PermissionRule {
  id: string
  role: string
  resource: string
  actions: string[]
  effect: 'allow' | 'deny'
}

type RulesData = { list: PermissionRule[] } | PermissionRule[]

export default function ClawdbotPermissionsPage() {
  const [rules, setRules] = React.useState<PermissionRule[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [showForm, setShowForm] = React.useState(false)
  const [form, setForm] = React.useState({
    role: '',
    resource: '',
    actions: 'read',
    effect: 'allow' as 'allow' | 'deny',
  })

  const load = React.useCallback(async () => {
    const res = await fetchApi<RulesData>('/api/admin/clawdbot/permissions')
    if (res.success && res.data) {
      const d = res.data
      setRules(Array.isArray(d) ? d : (d.list ?? []))
    } else if (!res.success) {
      setError(res.error)
    }
    setLoading(false)
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.role.trim() || !form.resource.trim()) return
    const body = JSON.stringify({ ...form, actions: form.actions.split(',').map((a) => a.trim()) })
    const res = await fetchApi('/api/admin/clawdbot/permissions', { method: 'POST', body })
    if (res.success) {
      setShowForm(false)
      void load()
    } else {
      setError(res.error)
    }
  }

  const remove = async (id: string) => {
    if (!confirm('确定删除此权限规则?')) return
    const res = await fetchApi(`/api/admin/clawdbot/permissions/${id}`, { method: 'DELETE' })
    if (res.success) void load()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> 加载中...
      </div>
    )
  }
  if (error) {
    return (
      <div className="p-4">
        <Alert variant="danger" title="操作失败" description={error} />
      </div>
    )
  }

  const roles = Array.from(new Set(rules.map((r) => r.role)))
  const resources = Array.from(new Set(rules.map((r) => r.resource)))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Shield className="h-6 w-6 text-primary" /> 权限管理
        </h1>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4" /> 添加规则
        </Button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="space-y-3 rounded-lg border bg-card p-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>角色</Label>
              <Input
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                placeholder="如 admin, user"
              />
            </div>
            <div className="space-y-1">
              <Label>资源</Label>
              <Input
                value={form.resource}
                onChange={(e) => setForm({ ...form, resource: e.target.value })}
                placeholder="如 bots, sessions"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>操作 (逗号分隔)</Label>
              <Input
                value={form.actions}
                onChange={(e) => setForm({ ...form, actions: e.target.value })}
                placeholder="read,write"
              />
            </div>
            <div className="space-y-1">
              <Label>效果</Label>
              <select
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={form.effect}
                onChange={(e) => setForm({ ...form, effect: e.target.value as 'allow' | 'deny' })}
              >
                <option value="allow">允许</option>
                <option value="deny">拒绝</option>
              </select>
            </div>
          </div>
          <Button type="submit" size="sm">
            保存
          </Button>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/30">
            <tr>
              <th className="px-4 py-2 text-left font-medium">角色</th>
              <th className="px-4 py-2 text-left font-medium">资源</th>
              <th className="px-4 py-2 text-left font-medium">操作</th>
              <th className="px-4 py-2 text-left font-medium">效果</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {rules.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-muted-foreground">
                  暂无权限规则
                </td>
              </tr>
            ) : (
              rules.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2">{r.role}</td>
                  <td className="px-4 py-2">{r.resource}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {r.actions.map((a) => (
                        <span key={a} className="rounded bg-muted px-1.5 py-0.5 text-xs">
                          {a}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 text-xs',
                        r.effect === 'allow'
                          ? 'bg-emerald-500/10 text-emerald-600'
                          : 'bg-red-500/10 text-red-600',
                      )}
                    >
                      {r.effect === 'allow' ? '允许' : '拒绝'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Button variant="ghost" size="sm" onClick={() => remove(r.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {roles.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-2 text-sm font-medium">角色 × 资源矩阵</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b">
                <tr>
                  <th className="px-2 py-1 text-left">角色</th>
                  {resources.map((res) => (
                    <th key={res} className="px-2 py-1 text-left">
                      {res}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {roles.map((role) => (
                  <tr key={role}>
                    <td className="px-2 py-1 font-medium">{role}</td>
                    {resources.map((res) => {
                      const rule = rules.find(
                        (r) => r.role === role && r.resource === res && r.effect === 'allow',
                      )
                      return (
                        <td key={res} className="px-2 py-1">
                          {rule ? rule.actions.join(',') : '—'}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
