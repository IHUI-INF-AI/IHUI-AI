// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 条目新建 / 成员修正对话框(G-35,2026-09-26)
 * 新建走 POST /spaces/:spaceId/items,修正走 PUT /items/:itemId(带 expectedRevision 乐观并发)。
 * content 是 jsonb:本面固定写 { text } 一档,正文可编辑字段即 plainText。
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from '@ihui/ui-react'
import { Input, Select, Textarea } from '@/components/form'
import {
  createKnowledgeSpaceItem,
  reviseKnowledgeItem,
  type KnowledgeItemDTO,
  type KnowledgeSpaceDTO,
  type TeamKnowledgeKind,
} from '@ihui/api-client'

const KINDS: TeamKnowledgeKind[] = ['memory', 'wiki', 'card']

interface ItemEditDialogProps {
  space: KnowledgeSpaceDTO
  /** null = 新建 */
  item: KnowledgeItemDTO | null
  onClose: () => void
  onSaved: () => void
}

export function ItemEditDialog({ space, item, onClose, onSaved }: ItemEditDialogProps) {
  const t = useTranslations('teamKnowledge')
  const isCreate = item === null

  const [kind, setKind] = React.useState<TeamKnowledgeKind>(item?.kind ?? 'memory')
  const [title, setTitle] = React.useState(item?.title ?? '')
  const [text, setText] = React.useState(item?.plainText ?? '')
  const [tags, setTags] = React.useState(item?.tags.join(', ') ?? '')
  const [changeNote, setChangeNote] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const save = async () => {
    if (!title.trim()) {
      setError(t('needTitle'))
      return
    }
    setSaving(true)
    setError(null)
    const tagList = tags
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean)
    try {
      if (item === null) {
        await createKnowledgeSpaceItem(space.id, {
          kind,
          title: title.trim(),
          content: { text },
          plainText: text,
          tags: tagList,
          changeNote: changeNote.trim() || undefined,
        })
      } else {
        await reviseKnowledgeItem(item.id, {
          title: title.trim(),
          content: { text },
          plainText: text,
          tags: tagList,
          changeNote: changeNote.trim() || undefined,
          // 打开对话框时读到的版本号:服务端不一致即 409,由错误面回显冲突消息
          expectedRevision: item.revision,
        })
      }
      onSaved()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-sm">
            {isCreate ? t('createItemTitle') : t('reviseItemTitle')}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 p-3">
          {isCreate && (
            <Select
              options={KINDS.map((k) => ({ value: k, label: t(`kind.${k}`) }))}
              value={kind}
              onChange={(v) => setKind(String(v) as TeamKnowledgeKind)}
              aria-label={t('kindLabel')}
            />
          )}
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('titlePlaceholder')}
            aria-label={t('titleLabel')}
          />
          <Textarea
            className="min-h-32"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('contentPlaceholder')}
            aria-label={t('contentLabel')}
          />
          <Input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder={t('tagsPlaceholder')}
            aria-label={t('tagsLabel')}
          />
          <Input
            value={changeNote}
            onChange={(e) => setChangeNote(e.target.value)}
            placeholder={t('changeNotePlaceholder')}
            aria-label={t('changeNoteLabel')}
          />
          {error && <span className="text-sm text-red-600 dark:text-red-400">{error}</span>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              <span>{t('cancelBtn')}</span>
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              <span>{t('saveBtn')}</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
