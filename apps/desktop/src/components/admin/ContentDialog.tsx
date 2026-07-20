/**
 * ContentDialog — AdminContent 10 Tab 共用的内容创建/编辑弹窗(配置驱动)。
 *
 * 数据流:
 *  - mode=create: type 可切换(默认 defaultType),按 type config 渲染字段
 *  - mode=edit:   type 固定(回填 row.type),按 type config 渲染字段并从 row 回填
 *
 * 字段 schema 由 `lib/admin-content-types.ts` 的 TYPE_CONFIGS 统一提供,涵盖
 * 10 种 type(announcement / help-article / help-category / doc / article /
 * advertise / about-us / contact / recommendation / mobile-adapter)。
 *
 * 提交:onSubmit({ type, values }),values 是按字段名展开的扁平对象(字符串已 trim),
 *       父页面负责调用 createAdminContent / updateAdminContent。
 *
 * 设计取舍:不暴露 type 私有嵌套结构(about-us 内部 phone/socialMedia 等
 * 已在 about-us 字段 schema 中平铺),父页面无需关心 type 特定字段名。
 */
import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../i18n'
import { AdminDialog, AdminDialogActions } from './AdminDialog'
import {
  ALL_CONTENT_TYPES,
  TYPE_CONFIGS,
  getTypeConfig,
  type ContentType,
  type FormValue,
  type FormValues,
  type FieldDef,
  type FieldKind,
} from '../../lib/admin-content-types'
import type { ContentRow } from '../../lib/api/admin-content'

export type ContentDialogMode = 'create' | 'edit'

export interface ContentFormValues {
  type: ContentType
  values: Record<string, string | number | boolean>
}

export interface ContentDialogProps {
  open: boolean
  mode: ContentDialogMode
  /** edit 模式必填,create 模式可空(type 由弹窗内 select 决定) */
  row?: ContentRow | null
  /** create 模式默认 type;edit 模式可省略(取 row.type) */
  defaultType?: ContentType
  submitting?: boolean
  onClose: () => void
  onSubmit: (values: ContentFormValues) => void | Promise<void>
}

function isFormValue(v: unknown): v is FormValue {
  return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
}

function defaultsForFields(fields: readonly FieldDef[]): FormValues {
  const out: FormValues = {}
  for (const f of fields) {
    if (f.defaultValue !== undefined) out[f.name] = f.defaultValue
  }
  return out
}

function fromRow(row: ContentRow | null | undefined, fields: readonly FieldDef[]): FormValues {
  if (!row) return defaultsForFields(fields)
  const out: FormValues = {}
  for (const f of fields) {
    const v = (row as Record<string, unknown>)[f.name]
    if (v === undefined || v === null) {
      if (f.defaultValue !== undefined) out[f.name] = f.defaultValue
    } else if (isFormValue(v)) {
      out[f.name] = v
    }
  }
  return out
}

function validate(
  values: FormValues,
  fields: readonly FieldDef[],
  t: (k: string) => string,
): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const f of fields) {
    const v = values[f.name]
    if (f.required) {
      const empty =
        v === undefined || v === null || (typeof v === 'string' && v.trim().length === 0)
      if (empty) {
        errors[f.name] = t('admin.content.formFieldRequired')
        continue
      }
    }
    if (f.kind === 'number' && v !== undefined && v !== null && v !== '') {
      if (typeof v !== 'number' && !Number.isFinite(Number(v))) {
        errors[f.name] = t('admin.content.formFieldInvalid')
      }
    }
  }
  return errors
}

function resolveType(row: ContentRow | null | undefined, fallback: ContentType): ContentType {
  if (row && (ALL_CONTENT_TYPES as readonly string[]).includes(row.type as string)) {
    return row.type as ContentType
  }
  return fallback
}

export function ContentDialog({
  open,
  mode,
  row,
  defaultType = 'announcement',
  submitting,
  onClose,
  onSubmit,
}: ContentDialogProps) {
  const { t } = useI18n()
  const [type, setType] = useState<ContentType>(defaultType)
  const [values, setValues] = useState<FormValues>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  const config = useMemo(() => getTypeConfig(type), [type])

  useEffect(() => {
    if (open) {
      const resolvedType = mode === 'edit' ? defaultType : resolveType(row ?? null, defaultType)
      setType(resolvedType)
      setValues(fromRow(row ?? null, getTypeConfig(resolvedType).fields))
      setErrors({})
    }
  }, [open, mode, row, defaultType])

  const set = (name: string, v: FormValue) => {
    setValues((prev) => ({ ...prev, [name]: v }))
  }

  const submit = () => {
    const errs = validate(values, config.fields, t)
    setErrors(errs)
    if (Object.keys(errs).length > 0) return
    const out: Record<string, string | number | boolean> = {}
    for (const [k, v] of Object.entries(values)) {
      if (v === undefined) continue
      out[k] = typeof v === 'string' ? v.trim() : v
    }
    void onSubmit({ type, values: out })
  }

  return (
    <AdminDialog
      open={open}
      onClose={onClose}
      title={mode === 'create' ? t('admin.content.create') : t('admin.content.edit')}
      testId={`content-dialog-${mode}`}
      size="lg"
      footer={
        <AdminDialogActions
          onCancel={onClose}
          onSubmit={submit}
          submitLabel={t('common.save')}
          cancelLabel={t('common.cancel')}
          submitting={submitting}
          submitTestId={`content-dialog-${mode}-submit`}
          cancelTestId={`content-dialog-${mode}-cancel`}
        />
      }
    >
      <div className="admin-form">
        <div className="admin-form-field">
          <label className="admin-form-label">{t('admin.content.formType')}</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ContentType)}
            data-testid="content-dialog-type"
            disabled={mode === 'edit'}
          >
            {ALL_CONTENT_TYPES.map((tp) => (
              <option key={tp} value={tp}>
                {t(`admin.content.${TYPE_CONFIGS[tp].typeKey}`)}
              </option>
            ))}
          </select>
        </div>
        {config.fields.map((field) => (
          <FieldRow
            key={field.name}
            field={field}
            value={values[field.name]}
            error={errors[field.name]}
            onChange={(v) => set(field.name, v)}
            mode={mode}
            t={t}
          />
        ))}
      </div>
    </AdminDialog>
  )
}

interface FieldRowProps {
  field: FieldDef
  value: FormValue | undefined
  error: string | undefined
  onChange: (v: FormValue) => void
  mode: ContentDialogMode
  t: (k: string) => string
}

function FieldRow({ field, value, error, onChange, mode, t }: FieldRowProps) {
  const testId = `content-dialog-${field.name}`
  const inputType = kindToInputType(field.kind)
  return (
    <div className="admin-form-field">
      <label className="admin-form-label">
        {t(field.labelKey)}
        {field.required ? ' *' : ''}
      </label>
      {field.kind === 'bool' ? (
        <select
          value={value === true ? '1' : '0'}
          onChange={(e) => onChange(e.target.value === '1')}
          data-testid={testId}
          disabled={mode !== 'create' && field.name === 'isPublished' ? false : false}
        >
          <option value="0">{t('admin.content.statusDraft')}</option>
          <option value="1">{t('admin.content.statusPublished')}</option>
        </select>
      ) : field.kind === 'textarea' ? (
        <textarea
          value={typeof value === 'string' ? value : value !== undefined ? String(value) : ''}
          onChange={(e) => onChange(e.target.value)}
          data-testid={testId}
          rows={field.name === 'content' || field.name === 'description' ? 6 : 3}
        />
      ) : field.kind === 'number' ? (
        <input
          type="number"
          value={value === undefined || value === null ? '' : Number(value)}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          data-testid={testId}
        />
      ) : (
        <input
          type={inputType}
          value={typeof value === 'string' ? value : value !== undefined ? String(value) : ''}
          onChange={(e) => onChange(e.target.value)}
          data-testid={testId}
        />
      )}
      {error ? <div className="admin-form-error">{error}</div> : null}
    </div>
  )
}

function kindToInputType(kind: FieldKind): string {
  switch (kind) {
    case 'number':
      return 'number'
    case 'url':
      return 'url'
    case 'datetime':
      return 'datetime-local'
    case 'text':
    case 'textarea':
    case 'bool':
    default:
      return 'text'
  }
}
