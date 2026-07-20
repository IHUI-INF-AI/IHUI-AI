'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { FolderOpen, Loader2, Plus, Shield } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Input, Label } from '@ihui/ui'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@ihui/ui'
import { ProjectCard, type ProjectCardData } from '@/components/workspace/project-card'
import { DiffPreview, InlineDiffViewer } from '@/components/ai'
import { WorkspaceFolderSelector } from '@/components/ai/workspace-folder-selector'
import { CheckpointHistoryPanel } from '@/components/ai/checkpoint-history-panel'
import { FileMentionPopover } from '@/components/ai/file-mention-popover'
import { LocalFolderPicker } from '@/components/workspace/local-folder-picker'

interface ProjectItem {
  id: string
  name: string
  description: string
  fileCount: number
  updatedAt: string
}

async function fetchProjects(): Promise<ProjectItem[]> {
  const res = await fetchApi<{ projects: ProjectItem[] }>('/api/workspace/projects')
  if (!res.success) throw new Error(res.error)
  return res.data.projects
}

async function createProject(input: { name: string; description?: string }): Promise<ProjectItem> {
  const res = await fetchApi<{ project: ProjectItem }>('/api/workspace/projects', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  if (!res.success) throw new Error(res.error)
  return res.data.project
}

export default function WorkspacePage() {
  const t = useTranslations('workspace')
  const tc = useTranslations('common')
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['workspace', 'projects'],
    queryFn: fetchProjects,
  })

  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [formError, setFormError] = React.useState<string | null>(null)
  const [mentionOpen, setMentionOpen] = React.useState(false)
  const [selectedFolder, setSelectedFolder] = React.useState<string>()
  const [folderPickerOpen, setFolderPickerOpen] = React.useState(false)
  const [openedWorkspace, setOpenedWorkspace] = React.useState<{
    path: string
    name: string
  } | null>(null)

  const createMutation = useMutation({
    mutationFn: createProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace', 'projects'] })
      setDialogOpen(false)
      setName('')
      setDescription('')
      setFormError(null)
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
    createMutation.mutate({ name: name.trim(), description: description.trim() || undefined })
  }

  const handleOpenChange = (open: boolean) => {
    if (!open && createMutation.isPending) return
    setDialogOpen(open)
    if (!open) {
      setName('')
      setDescription('')
      setFormError(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setFolderPickerOpen(true)}>
            <FolderOpen className="h-4 w-4" />
            {t('openLocalFolder')}
          </Button>
          <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" />
                {t('newProject')}
              </Button>
            </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <DialogHeader>
                <DialogTitle>{t('newProject')}</DialogTitle>
                <DialogDescription>{t('createProjectDesc')}</DialogDescription>
              </DialogHeader>

              {formError && (
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {formError}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="project-name">{t('name')}</Label>
                <Input
                  id="project-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('namePlaceholder')}
                  maxLength={128}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="project-description">{t('description')}</Label>
                <textarea
                  id="project-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('descriptionPlaceholder')}
                  maxLength={2000}
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  disabled={createMutation.isPending}
                >
                  {tc('cancel')}
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {createMutation.isPending ? t('creating') : t('create')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : data && data.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((project) => (
            <ProjectCard key={project.id} project={project as ProjectCardData} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">{t('noProjects')}</p>
        </div>
      )}

      {/* 已打开的本地工作区展示 */}
      {openedWorkspace && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Shield className="h-4 w-4 text-emerald-500" />
            {t('openedWorkspace')}
          </h2>
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">{openedWorkspace.name}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {openedWorkspace.path}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFolderPickerOpen(true)}
              >
                {t('reopenPermission')}
              </Button>
            </div>
          </div>
        </section>
      )}

      <LocalFolderPicker
        open={folderPickerOpen}
        onOpenChange={setFolderPickerOpen}
        onWorkspaceOpened={(path, name) => setOpenedWorkspace({ path, name })}
      />

      {/* 开发者工具预览 */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold">{t('developerTools')}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <WorkspaceFolderSelector
            folders={[]}
            selected={selectedFolder}
            onSelect={setSelectedFolder}
          />
          <CheckpointHistoryPanel checkpoints={[]} />
        </div>
        <div className="relative">
          <Button variant="outline" size="sm" onClick={() => setMentionOpen((v) => !v)}>
            {t('mentionFile')}
          </Button>
          <FileMentionPopover
            files={[]}
            open={mentionOpen}
            onSelect={() => setMentionOpen(false)}
            onClose={() => setMentionOpen(false)}
          />
        </div>
        <DiffPreview oldContent="" newContent="" language="typescript" filename="auth.ts" />
        <InlineDiffViewer content="" filename="auth.ts" />
      </section>
    </div>
  )
}
