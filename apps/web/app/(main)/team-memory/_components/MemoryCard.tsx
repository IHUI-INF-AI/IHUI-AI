// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:

'use client'

/**
 * 团队记忆列表卡片 (2026-09-08 新增)
 * 从 team-memory 页面拆出,保持单文件 <250 行约束。
 */

import { useTranslations } from 'next-intl'
import { Pencil, Trash2 } from 'lucide-react'
import { Button, Card, CardContent } from '@ihui/ui-react'
import type { TeamMemoryDTO } from '@ihui/api-client'
import { KIND_BADGE } from './MemoryEditPanel'

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: '2-digit',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

interface MemoryCardProps {
  row: TeamMemoryDTO
  onEdit: (row: TeamMemoryDTO) => void
  onDelete: (row: TeamMemoryDTO) => void
}

export function MemoryCard({ row, onEdit, onDelete }: MemoryCardProps) {
  const t = useTranslations('teamMemory')

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-center gap-2">
          <span className={`rounded px-2 py-0.5 text-xs ${KIND_BADGE[row.kind]}`}>
            {t(`kind.${row.kind}`)}
          </span>
          <span className="flex-1 truncate text-sm font-medium">{row.title}</span>
          <Button variant="ghost" size="icon-sm" onClick={() => onEdit(row)} aria-label={t('editBtn')}>
            <Pencil className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => onDelete(row)} aria-label={t('deleteBtn')}>
            <Trash2 className="size-4" />
          </Button>
        </div>
        <p className="text-muted-foreground line-clamp-3 text-sm whitespace-pre-wrap">{row.content}</p>
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          {row.tags.map((tag: string) => (
            <span key={tag} className="bg-muted rounded px-1.5 py-0.5">
              {tag}
            </span>
          ))}
          <span className="ml-auto">{formatDate(row.updatedAt)}</span>
        </div>
      </CardContent>
    </Card>
  )
}
