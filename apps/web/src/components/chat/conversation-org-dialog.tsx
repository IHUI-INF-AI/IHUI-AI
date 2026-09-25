// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// D20 会话文件夹/标签编辑对话框(G-11)。纯受控组件:不直接碰 store / 网络,
// 元数据读写由调用方(sidebar-chat-history / 会话列表)注入;归一化与上限
// 复用 @ihui/shared conversation-org,不建第二套规则。

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { FolderOpen, Tag, X } from 'lucide-react'

import {
  normalizeOrgName,
  normalizeTagList,
  ORG_FOLDER_MAX_LENGTH,
  type ConversationOrgMeta,
} from '@ihui/shared'

import { cn } from '@/lib/utils'
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input } from '@ihui/ui-react'

export interface ConversationOrgSubmitValue {
  folder: string | null
  tags: string[]
}

export function ConversationOrgDialog({
  open,
  onOpenChange,
  conversationTitle,
  meta,
  folders,
  saving = false,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 仅用于标题区上下文展示 */
  conversationTitle: string
  /** 打开时的已保存元数据(每次 open 重置本地编辑态) */
  meta: ConversationOrgMeta
  /** 已存在的文件夹名(点击即填入,起联想作用) */
  folders: readonly string[]
  saving?: boolean
  onSubmit: (next: ConversationOrgSubmitValue) => void
}) {
  const t = useTranslations('aiChat.org')
  const tc = useTranslations('aiChat')

  const [folderInput, setFolderInput] = React.useState('')
  const [tags, setTags] = React.useState<string[]>([])
  const [tagInput, setTagInput] = React.useState('')
  const tagInputRef = React.useRef<HTMLInputElement>(null)

  // 每次 open 以已保存元数据重置本地编辑态(关闭即弃,不做半途持久化)
  React.useEffect(() => {
    if (open) {
      setFolderInput(meta.folder ?? '')
      setTags(meta.tags ?? [])
      setTagInput('')
    }
  }, [open, meta])

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' && e.key !== ',') return
    e.preventDefault()
    const value = tagInput.trim()
    if (!value) return
    setTags((prev) => normalizeTagList([...prev, value]))
    setTagInput('')
    tagInputRef.current?.focus()
  }

  const handleSubmit = () => {
    const folder = normalizeOrgName(folderInput, ORG_FOLDER_MAX_LENGTH)
    onSubmit({ folder: folder || null, tags: normalizeTagList(tags) })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="min-[640px]:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        {conversationTitle && (
          <p className="truncate text-xs text-muted-foreground" data-testid="org-dialog-title">
            {conversationTitle}
          </p>
        )}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
              <FolderOpen className="h-3.5 w-3.5" />
              {t('folderLabel')}
            </label>
            <Input
              value={folderInput}
              onChange={(e) => setFolderInput(e.target.value)}
              placeholder={t('folderPlaceholder')}
              maxLength={ORG_FOLDER_MAX_LENGTH}
              data-testid="org-folder-input"
            />
            {folders.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {folders.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFolderInput(f)}
                    className={cn(
                      'inline-flex max-w-full items-center rounded-sm border px-1.5 py-0.5 text-[11px] transition-colors',
                      'hover:bg-muted',
                    )}
                  >
                    <span className="min-w-0 truncate">{f}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
              <Tag className="h-3.5 w-3.5" />
              {t('tagsLabel')}
            </label>
            <Input
              ref={tagInputRef}
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              placeholder={t('tagPlaceholder')}
              data-testid="org-tag-input"
            />
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    data-testid="org-tag-chip"
                    className="inline-flex h-5 min-w-0 items-center gap-0.5 rounded-sm bg-muted px-1.5 text-[11px]"
                  >
                    <span className="min-w-0 truncate">{tag}</span>
                    <button
                      type="button"
                      onClick={() => setTags((prev) => prev.filter((x) => x !== tag))}
                      aria-label={t('removeTagAria', { tag })}
                      data-testid={`org-tag-remove-${tag}`}
                      className="inline-flex shrink-0 items-center rounded-sm p-px hover:bg-accent"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" className="bg-muted" onClick={() => onOpenChange(false)}>
            {tc('renameDialog.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={saving} data-testid="org-dialog-save">
            {tc('renameDialog.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ConversationOrgDialog
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
