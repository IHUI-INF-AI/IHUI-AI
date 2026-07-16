'use client'
import { selectClass, textareaClass } from '@/lib/edu'
import {
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  Switch,
} from '@ihui/ui'
import { useTranslations } from 'next-intl'
import type { PaperForm } from './types'

interface Props {
  form: PaperForm
  onFormChange: (patch: Partial<PaperForm>) => void
}

function splitIds(v: string): string[] {
  return v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function ExamDialogFields({ form, onFormChange }: Props) {
  const t = useTranslations('admin.edu.exam.index')
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="p-type">{t('fieldPaperType')}</Label>
        <Select
          value={form.paperType}
          onValueChange={(v) => onFormChange({ paperType: v as PaperForm['paperType'] })}
        >
          <SelectTrigger className={selectClass} id="p-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="normal">{t('paperType.normal')}</SelectItem>
            <SelectItem value="mock">{t('paperType.mock')}</SelectItem>
            <SelectItem value="random">{t('paperType.random')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="p-cid">{t('fieldCidList')}</Label>
        <Input
          id="p-cid"
          value={form.cidList.join(',')}
          onChange={(e) => onFormChange({ cidList: splitIds(e.target.value) })}
          placeholder={t('cidListPlaceholder')}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="p-qid">{t('fieldQuestionIdList')}</Label>
        <textarea
          id="p-qid"
          className={textareaClass}
          value={form.questionIdList.join(',')}
          onChange={(e) => onFormChange({ questionIdList: splitIds(e.target.value) })}
          placeholder={t('questionIdListPlaceholder')}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="p-qd">{t('fieldQuestionDisordered')}</Label>
          <div className="flex h-9 items-center">
            <Switch
              id="p-qd"
              checked={form.questionDisordered}
              onCheckedChange={(v) => onFormChange({ questionDisordered: v })}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="p-od">{t('fieldOptionDisordered')}</Label>
          <div className="flex h-9 items-center">
            <Switch
              id="p-od"
              checked={form.optionDisordered}
              onCheckedChange={(v) => onFormChange({ optionDisordered: v })}
            />
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="p-diff">{t('fieldDifficulty')}</Label>
        <Select
          value={String(form.difficulty)}
          onValueChange={(v) => onFormChange({ difficulty: Number(v) })}
        >
          <SelectTrigger className={selectClass} id="p-diff">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1</SelectItem>
            <SelectItem value="2">2</SelectItem>
            <SelectItem value="3">3</SelectItem>
            <SelectItem value="4">4</SelectItem>
            <SelectItem value="5">5</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </>
  )
}
