'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { Loader2, Edit, Trash2, FileText, Upload, EyeOff } from 'lucide-react'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { type Resource, api } from './types'

export function ResourcesTable({
  resources,
  isLoading,
  error,
  onEdit,
}: {
  resources: Resource[]
  isLoading: boolean
  error: unknown
  onEdit: (res: Resource) => void
}) {
  const t = useTranslations('admin.resources')
  const qc = useQueryClient()

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/resources/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'resources'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const publishMut = useMutation({
    mutationFn: (args: { id: string; isPublished: boolean }) =>
      api<{ resource: Resource }>(`/api/admin/resources/${args.id}/publish`, {
        method: 'PUT',
        body: JSON.stringify({ isPublished: args.isPublished }),
      }),
    onSuccess: (_data, vars) => {
      toast.success(vars.isPublished ? t('publishSuccess') : t('unpublishSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'resources'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function handleDelete(res: Resource) {
    if (!window.confirm(t('deleteConfirm'))) return
    deleteMut.mutate(res.id)
  }

  function togglePublish(res: Resource) {
    publishMut.mutate({ id: res.id, isPublished: !res.isPublished })
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">{t('colTitle')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colCategory')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colFile')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colStatus')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colSort')}</TableHead>
            <TableHead className="px-4 py-2.5 text-right">{t('colActions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y">
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                {t('loading')}
              </TableCell>
            </TableRow>
          ) : error ? (
            <TableRow>
              <TableCell colSpan={6} className="px-4 py-10 text-center text-destructive">
                {(error as Error).message}
              </TableCell>
            </TableRow>
          ) : resources.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                <FileText className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('noData')}
              </TableCell>
            </TableRow>
          ) : (
            resources.map((res) => {
              const published = res.isPublished
              return (
                <TableRow key={res.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5">
                    <div className="font-medium">{res.title}</div>
                    {res.intro ? (
                      <div className="max-w-xs break-words text-xs text-muted-foreground">
                        {res.intro}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    {res.categoryName ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    {res.fileType ? (
                      <span className="text-xs text-muted-foreground">{res.fileType}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
                        published
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          published ? 'bg-emerald-500' : 'bg-muted-foreground',
                        )}
                      />
                      {published ? t('published') : t('unpublished')}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-2.5">{res.sort}</TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => togglePublish(res)}
                        title={published ? t('unpublish') : t('publish')}
                        disabled={publishMut.isPending}
                      >
                        {published ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(res)}
                        title={t('edit')}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(res)}
                        title={t('delete')}
                        className="text-destructive hover:text-destructive"
                        disabled={deleteMut.isPending}
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
  )
}
