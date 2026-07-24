'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ihui/ui-react'
import { Plus, Trash2 } from 'lucide-react'
import type { GenField, GenType, GenTypeMeta } from '@ihui/api-client'

interface FieldEditorProps {
  fields: GenField[]
  onChange: (next: GenField[]) => void
  fieldTypes: GenTypeMeta['fieldTypes']
  disabled?: boolean
}

const FIELD_TYPE_OPTIONS: GenField['type'][] = ['string', 'number', 'boolean', 'date']

export function FieldEditor({ fields, onChange, fieldTypes, disabled }: FieldEditorProps) {
  const tA11y = useTranslations('a11y')
  const supported = FIELD_TYPE_OPTIONS.filter((t) => fieldTypes.includes(t))

  function add() {
    onChange([...fields, { name: '', type: 'string' }])
  }
  function remove(i: number) {
    onChange(fields.filter((_, idx) => idx !== i))
  }
  function update(i: number, patch: Partial<GenField>) {
    onChange(fields.map((f, idx) => (idx === i ? { ...f, ...patch } : f)))
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>字段</Label>
        <Button type="button" variant="outline" size="sm" onClick={add} disabled={disabled}>
          <Plus className="h-4 w-4" />
          <span>新增字段</span>
        </Button>
      </div>
      <div className="space-y-2">
        {fields.map((f, i) => (
          <Card key={i}>
            <CardContent className="flex items-end gap-2 pt-3">
              <div className="flex-1 space-y-1">
                <Label htmlFor={`f-name-${i}`} className="text-xs">
                  名称
                </Label>
                <Input
                  id={`f-name-${i}`}
                  value={f.name}
                  onChange={(e) => update(i, { name: e.target.value })}
                  placeholder="userName"
                  disabled={disabled}
                />
              </div>
              <div className="w-32 space-y-1">
                <Label htmlFor={`f-label-${i}`} className="text-xs">
                  显示名
                </Label>
                <Input
                  id={`f-label-${i}`}
                  value={f.label ?? ''}
                  onChange={(e) => update(i, { label: e.target.value })}
                  placeholder="用户名"
                  disabled={disabled}
                />
              </div>
              <div className="w-32 space-y-1">
                <Label htmlFor={`f-type-${i}`} className="text-xs">
                  类型
                </Label>
                <Select
                  value={f.type}
                  onValueChange={(v) => update(i, { type: v as GenField['type'] })}
                  disabled={disabled}
                >
                  <SelectTrigger id={`f-type-${i}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {supported.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pb-2">
                <label className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={Boolean(f.required)}
                    onChange={(e) => update(i, { required: e.target.checked })}
                    disabled={disabled}
                  />
                  必填
                </label>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => remove(i)}
                disabled={disabled}
                aria-label={tA11y('deleteField')}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
        {fields.length === 0 && (
          <p className="text-xs text-muted-foreground">点击「新增字段」添加第一个字段</p>
        )}
      </div>
    </div>
  )
}

interface TemplateSelectorProps {
  types: GenTypeMeta[]
  value: GenType
  onChange: (v: GenType) => void
  disabled?: boolean
  getLabel: (key: GenType) => string
}

export function TemplateSelector({
  types,
  value,
  onChange,
  disabled,
  getLabel,
}: TemplateSelectorProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="gen-type">模板类型</Label>
      <Select value={value} onValueChange={(v) => onChange(v as GenType)} disabled={disabled}>
        <SelectTrigger id="gen-type" className="w-full max-w-md">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {types.map((t) => (
            <SelectItem key={t.type} value={t.type}>
              {getLabel(t.type)} — {t.description}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
