'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'

import { TeamDialog } from './TeamDialog'
import { TeamList } from './TeamList'
import { fetchTeams, createTeam } from './helpers'

export default function TeamsPage() {
  const t = useTranslations('teams')
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['teams'],
    queryFn: fetchTeams,
  })

  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [slug, setSlug] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [formError, setFormError] = React.useState<string | null>(null)

  const resetForm = () => {
    setName('')
    setSlug('')
    setDescription('')
    setFormError(null)
  }

  const createMutation = useMutation({
    mutationFn: createTeam,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] })
      setDialogOpen(false)
      resetForm()
    },
    onError: (e: Error) => setFormError(e.message),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!name.trim()) {
      setFormError(t('nameRequired'))
      return
    }
    if (!slug.trim()) {
      setFormError(t('slugRequired'))
      return
    }
    createMutation.mutate({
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim() || undefined,
    })
  }

  const handleOpenChange = (open: boolean) => {
    if (!open && createMutation.isPending) return
    setDialogOpen(open)
    if (!open) resetForm()
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <TeamDialog
          open={dialogOpen}
          onOpenChange={handleOpenChange}
          name={name}
          setName={setName}
          slug={slug}
          setSlug={setSlug}
          description={description}
          setDescription={setDescription}
          formError={formError}
          onSubmit={handleSubmit}
          isPending={createMutation.isPending}
        />
      </div>

      <TeamList data={data} isLoading={isLoading} error={error} />
    </div>
  )
}
