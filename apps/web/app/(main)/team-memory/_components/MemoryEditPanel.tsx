// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:

'use client'

/**
 * 团队记忆新建/编辑内联面板 (2026-09-08 新增)
 * 从 team-memory 页面拆出,保持单文件 <250 行约束。
 */

import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { Input, Textarea } from '@/components/form'
import type { TeamMemoryKind } from '@ihui/api-client'

const KINDS: TeamMemoryKind[] = ['decision', 'convention', 'pitfall', 'fingerprint']

/** kind → 徽章样式(语义色,禁 rounded-full) */
export const KIND_BADGE: Record<TeamMemoryKind, string> = {
  decision: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  convention: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  pitfall: 'bg-red-500/10 text-red-600 dark:text-red-400',
  fingerprint: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
}

export interface EditingState {
  id: string | null
  kind: TeamMemoryKind
  title: string
  content: string
  tags: string
}

interface MemoryEditPanelProps {
  editing: EditingState
  saving: boolean
  onChange: (next: EditingState) => void
  onSave: () => void
  onCancel: () => void
}

export function MemoryEditPanel({ editing, saving, onChange, onSave, onCancel }: MemoryEditPanelProps) {
  const t = useTranslations('teamMemory')

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{editing.id ? t('editBtn') : t('newBtn')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => onChange({ ...editing, kind: k })}
              className={`rounded px-2 py-1 text-xs ${
                editing.kind === k ? KIND_BADGE[k] : 'bg-muted text-muted-foreground'
              }`}
            >
              {t(`kind.${k}`)}
            </button>
          ))}
        </div>
        <Input
          value={editing.title}
          onChange={(e) => onChange({ ...editing, title: e.target.value })}
          placeholder={t('titlePlaceholder')}
          aria-label={t('titleLabel')}
        />
        <Textarea
          className="min-h-32"
          value={editing.content}
          onChange={(e) => onChange({ ...editing, content: e.target.value })}
          placeholder={t('contentPlaceholder')}
          aria-label={t('contentLabel')}
        />
        <Input
          value={editing.tags}
          onChange={(e) => onChange({ ...editing, tags: e.target.value })}
          placeholder={t('tagsPlaceholder')}
          aria-label={t('tagsLabel')}
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            <span>{t('cancelBtn')}</span>
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            <span>{t('saveBtn')}</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
