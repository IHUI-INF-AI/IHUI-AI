'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'

import { SkillTable } from './SkillTable'
import { SkillFormDialog, SkillDeleteDialog } from './SkillDialog'
import { SkillFilter } from './SkillFilter'
import { SkillMarketDialog } from './SkillMarketDialog'
import { api, fetchSkills, EMPTY_FORM, skillToForm } from './helpers'
import type { Skill, SkillForm } from './types'
import { BackButton } from '@/components/common'

export default function AdminSkillsPage() {
  const t = useTranslations('admin.skills')
  const qc = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Skill | null>(null)
  const [delId, setDelId] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState('')
  const [marketOpen, setMarketOpen] = React.useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'skills'],
    queryFn: fetchSkills,
  })

  const saveMut = useMutation({
    mutationFn: (input: SkillForm) => {
      const body: Record<string, unknown> = {
        name: input.name.trim(),
        description: input.description.trim() || undefined,
        version: input.version.trim() || undefined,
        tags: input.tags.trim()
          ? input.tags
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined,
      }
      return api('/api/skills', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'skills'] })
      close()
    },
  })

  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/skills/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'skills'] })
      setDelId(null)
    },
  })

  function openCreate() {
    setEditing(null)
    setOpen(true)
  }
  function openEdit(skill: Skill) {
    setEditing(skill)
    setOpen(true)
  }
  function close() {
    if (saveMut.isPending) return
    setOpen(false)
    setEditing(null)
  }
  function onValid(values: SkillForm) {
    saveMut.mutate(values)
  }

  const skills = (data ?? []).filter(
    (s) => !search || s.name.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="space-y-4 px-4 py-6">
      <BackButton />
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
      </div>

      <SkillFilter
        search={search}
        onSearchChange={setSearch}
        onCreate={openCreate}
        onOpenMarket={() => setMarketOpen(true)}
      />

      <SkillTable
        skills={skills}
        isLoading={isLoading}
        error={error as Error | null}
        total={skills.length}
        onEdit={openEdit}
        onDelete={(id) => setDelId(id)}
        onOpenMarket={() => setMarketOpen(true)}
      />

      <SkillFormDialog
        open={open}
        editing={editing}
        defaultValues={editing ? skillToForm(editing) : EMPTY_FORM}
        savePending={saveMut.isPending}
        onValid={onValid}
        onClose={close}
      />

      <SkillDeleteDialog
        delId={delId}
        delPending={delMut.isPending}
        onConfirm={() => {
          if (delId) delMut.mutate(delId)
        }}
        onClose={() => setDelId(null)}
      />

      <SkillMarketDialog open={marketOpen} onClose={() => setMarketOpen(false)} />
    </div>
  )
}
