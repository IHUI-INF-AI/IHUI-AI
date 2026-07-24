'use client'

import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import {
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@ihui/ui-react'
import { EDIT_FIELDS, textareaClass } from './helpers'

interface DemandAuditEditDialogProps {
  open: boolean
  editId: string | null
  form: Record<string, string>
  isPending: boolean
  onFormChange: (form: Record<string, string>) => void
  onClose: () => void
  onSubmit: () => void
}

export function DemandAuditEditDialog({
  open,
  editId,
  form,
  isPending,
  onFormChange,
  onClose,
  onSubmit,
}: DemandAuditEditDialogProps) {
  const t = useTranslations('admin.demandAudit')
  const tc = useTranslations('common')
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : !isPending && onClose())}>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            onSubmit()
          }}
          className="space-y-3"
        >
          <DialogHeader>
            <DialogTitle>{editId ? t('editTitle') : t('createTitle')}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {EDIT_FIELDS.map((f) => (
              <div key={f.key} className={f.type === 'textarea' ? 'col-span-2' : ''}>
                <Label className="text-xs">{f.label}</Label>
                {f.type === 'textarea' ? (
                  <textarea
                    className={`${textareaClass} mt-1`}
                    rows={2}
                    value={form[f.key] ?? ''}
                    onChange={(e) => onFormChange({ ...form, [f.key]: e.target.value })}
                  />
                ) : (
                  <Input
                    className="mt-1 h-8 text-sm"
                    type={f.type === 'date' ? 'date' : 'text'}
                    value={form[f.key] ?? ''}
                    onChange={(e) => onFormChange({ ...form, [f.key]: e.target.value })}
                  />
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {tc('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
