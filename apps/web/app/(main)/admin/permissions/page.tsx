'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'

import { PermissionsHeader } from './PermissionsHeader'
import { PermissionsFilter } from './PermissionsFilter'
import { PermissionsList } from './PermissionsList'
import { api } from './helpers'
import type { Permission } from './types'

export default function AdminPermissionsPage() {
  const [keyword, setKeyword] = React.useState('')
  const [resourceFilter, setResourceFilter] = React.useState('all')
  const [actionFilter, setActionFilter] = React.useState('all')
  const [copiedId, setCopiedId] = React.useState<string | null>(null)

  const permsQ = useQuery({
    queryKey: ['admin', 'permissions'],
    queryFn: () => api<{ list: Permission[] }>('/api/permissions').then((d) => d.list ?? []),
  })

  const perms = React.useMemo(() => permsQ.data ?? [], [permsQ.data])

  const resources = React.useMemo(() => {
    const s = new Set<string>()
    perms.forEach((p) => s.add(p.resource))
    return Array.from(s).sort()
  }, [perms])

  const actions = React.useMemo(() => {
    const s = new Set<string>()
    perms.forEach((p) => s.add(p.action))
    return Array.from(s).sort()
  }, [perms])

  const filtered = React.useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return perms.filter((p) => {
      if (resourceFilter !== 'all' && p.resource !== resourceFilter) return false
      if (actionFilter !== 'all' && p.action !== actionFilter) return false
      if (kw) {
        const hay = `${p.name} ${p.displayName} ${p.description ?? ''}`.toLowerCase()
        if (!hay.includes(kw)) return false
      }
      return true
    })
  }, [perms, keyword, resourceFilter, actionFilter])

  const grouped = React.useMemo(() => {
    const m = new Map<string, Permission[]>()
    filtered.forEach((p) => {
      const arr = m.get(p.resource) ?? []
      arr.push(p)
      m.set(p.resource, arr)
    })
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [filtered])

  function copyCode(p: Permission) {
    navigator.clipboard?.writeText(p.name).then(() => {
      setCopiedId(p.id)
      setTimeout(() => setCopiedId((cur) => (cur === p.id ? null : cur)), 1500)
    })
  }

  return (
    <div className="space-y-4">
      <PermissionsHeader
        total={perms.length}
        resourceCount={resources.length}
        actionCount={actions.length}
      />
      <PermissionsFilter
        keyword={keyword}
        setKeyword={setKeyword}
        resourceFilter={resourceFilter}
        setResourceFilter={setResourceFilter}
        actionFilter={actionFilter}
        setActionFilter={setActionFilter}
        resources={resources}
        actions={actions}
        filteredCount={filtered.length}
      />
      <PermissionsList
        grouped={grouped}
        isLoading={permsQ.isLoading}
        isError={permsQ.isError}
        copiedId={copiedId}
        onCopy={copyCode}
      />
    </div>
  )
}
