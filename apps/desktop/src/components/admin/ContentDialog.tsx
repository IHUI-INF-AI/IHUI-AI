/**
 * ContentDialog — AdminContent 4 Tab 共用的内容创建/编辑弹窗。
 *
 * 模式:
 *  - mode=create: 内容类型可切换 + 标题 + 内容 + 状态 + 排序
 *  - mode=edit:   类型固定 + 标题 + 内容 + 状态 + 排序(从原行回填)
 *
 * 提交:onSubmit(values),values 含 type / title / content / isPublished / sortOrder;
 *       父页面负责调用 createAdminContent 或 updateAdminContent。
 *
 * 设计取舍:只覆盖 4 个 Tab 共用字段(标题 / 内容 / 状态 / 排序),未暴露 type 各自的
 * 私有字段(position / imageUrl / summary 等)— 父页面需要时直接改 body。
 */
import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n'
import { AdminDialog, AdminDialogActions } from './AdminDialog'
import { CONTENT_TYPES, type ContentType, type ContentRow } from '../../lib/api/admin-content'

export type ContentDialogMode = 'create' | 'edit'

export interface ContentFormValues {
  type: ContentType
  title: string
  content: string
  isPublished: boolean
  sortOrder: number
}

export interface ContentDialogProps {
  open: boolean
  mode: ContentDialogMode
  /** edit 模式必填,create 模式可空(type 由弹窗内选择) */
  row?: ContentRow | null
  /** create 模式下,父页面决定默认 type(create 模式也可由弹窗内 select 切换) */
  defaultType?: ContentType
  submitting?: boolean
  onClose: () => void
  onSubmit: (values: ContentFormValues) => void | Promise<void>
}

const DEFAULTS: ContentFormValues = {
  type: 'announcement',
  title: '',
  content: '',
  isPublished: false,
  sortOrder: 0,
}

function fromRow(row: ContentRow | null | undefined, fallbackType: ContentType): ContentFormValues {
  if (!row) return { ...DEFAULTS, type: fallbackType }
  const isPub = row.isPublished
  const sort = row.sortOrder ?? row.sort
  return {
    type: fallbackType,
    title: typeof row.title === 'string' ? row.title : '',
    content: typeof row.content === 'string' ? row.content : '',
    isPublished: typeof isPub === 'boolean' ? isPub : false,
    sortOrder: typeof sort === 'number' ? sort : 0,
  }
}

function validate(values: ContentFormValues, t: (k: string) => string): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!values.title.trim()) errors.title = t('admin.content.formTitleRequired')
  if (!values.content.trim()) errors.content = t('admin.content.formContentRequired')
  if (!Number.isFinite(values.sortOrder)) errors.sortOrder = t('admin.content.formSortInvalid')
  return errors
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
  const [values, setValues] = useState<ContentFormValues>(DEFAULTS)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) {
      setValues(
        fromRow(
          row ?? null,
          mode === 'edit' ? defaultType : ((row?.type as ContentType) ?? defaultType),
        ),
      )
      setErrors({})
    }
  }, [open, mode, row, defaultType])

  const set = <K extends keyof ContentFormValues>(k: K, v: ContentFormValues[K]) => {
    setValues((prev) => ({ ...prev, [k]: v }))
  }

  const submit = () => {
    const errs = validate(values, t)
    setErrors(errs)
    if (Object.keys(errs).length > 0) return
    void onSubmit(values)
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
            value={values.type}
            onChange={(e) => set('type', e.target.value as ContentType)}
            data-testid="content-dialog-type"
            disabled={mode === 'edit'}
          >
            {CONTENT_TYPES.map((tp) => (
              <option key={tp} value={tp}>
                {t(`admin.content.type${tp.replace(/-(.)/g, (_, c) => c.toUpperCase())}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-form-field">
          <label className="admin-form-label">{t('admin.content.formTitle')}</label>
          <input
            value={values.title}
            onChange={(e) => set('title', e.target.value)}
            data-testid="content-dialog-title"
          />
          {errors.title ? <div className="admin-form-error">{errors.title}</div> : null}
        </div>
        <div className="admin-form-field">
          <label className="admin-form-label">{t('admin.content.formContent')}</label>
          <textarea
            value={values.content}
            onChange={(e) => set('content', e.target.value)}
            data-testid="content-dialog-content"
            rows={6}
          />
          {errors.content ? <div className="admin-form-error">{errors.content}</div> : null}
        </div>
        <div className="admin-form-field">
          <label className="admin-form-label">{t('admin.content.formStatus')}</label>
          <select
            value={values.isPublished ? '1' : '0'}
            onChange={(e) => set('isPublished', e.target.value === '1')}
            data-testid="content-dialog-status"
          >
            <option value="0">{t('admin.content.statusDraft')}</option>
            <option value="1">{t('admin.content.statusPublished')}</option>
          </select>
        </div>
        <div className="admin-form-field">
          <label className="admin-form-label">{t('admin.content.formSortOrder')}</label>
          <input
            type="number"
            value={values.sortOrder}
            onChange={(e) => set('sortOrder', Number(e.target.value))}
            data-testid="content-dialog-sortOrder"
          />
          {errors.sortOrder ? <div className="admin-form-error">{errors.sortOrder}</div> : null}
        </div>
      </div>
    </AdminDialog>
  )
}
