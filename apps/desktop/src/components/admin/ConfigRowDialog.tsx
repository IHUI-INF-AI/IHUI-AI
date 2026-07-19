/**
 * ConfigRowDialog — 单行配置编辑/新增弹窗。
 *
 * 校验:
 *  - key 必填,只允许 [A-Za-z0-9_.]
 *  - value 必填
 */
import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n'
import { AdminDialog, AdminDialogActions } from './AdminDialog'

export interface ConfigRowValues {
  key: string
  value: string
}

export interface ConfigRowDialogProps {
  open: boolean
  mode: 'add' | 'edit'
  initialKey?: string
  initialValue?: string
  /** 当编辑模式下,原始 key 用于检测冲突 */
  submitting?: boolean
  onClose: () => void
  onSubmit: (values: ConfigRowValues) => void | Promise<void>
}

const KEY_REGEX = /^[A-Za-z0-9_.]+$/

function validate(values: ConfigRowValues, t: (k: string) => string): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!values.key.trim()) errors.key = t('admin.settings.formKeyRequired')
  else if (!KEY_REGEX.test(values.key.trim())) errors.key = t('admin.settings.formKeyInvalid')
  if (values.value === '' || values.value === undefined || values.value === null) {
    errors.value = t('admin.settings.formValueRequired')
  }
  return errors
}

export function ConfigRowDialog({
  open,
  mode,
  initialKey = '',
  initialValue = '',
  submitting,
  onClose,
  onSubmit,
}: ConfigRowDialogProps) {
  const { t } = useI18n()
  const [values, setValues] = useState<ConfigRowValues>({ key: initialKey, value: initialValue })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) {
      setValues({ key: initialKey, value: initialValue })
      setErrors({})
    }
  }, [open, initialKey, initialValue])

  const set = <K extends keyof ConfigRowValues>(k: K, v: ConfigRowValues[K]) => {
    setValues((prev) => ({ ...prev, [k]: v }))
  }

  const submit = () => {
    const errs = validate(values, t)
    setErrors(errs)
    if (Object.keys(errs).length > 0) return
    void onSubmit({ key: values.key.trim(), value: values.value })
  }

  return (
    <AdminDialog
      open={open}
      onClose={onClose}
      title={mode === 'add' ? t('admin.settings.addDialogTitle') : t('admin.settings.editDialogTitle')}
      testId={`config-row-dialog-${mode}`}
      size="sm"
      footer={
        <AdminDialogActions
          onCancel={onClose}
          onSubmit={submit}
          submitLabel={t('admin.settings.save')}
          cancelLabel={t('common.cancel')}
          submitting={submitting}
          submitTestId={`config-row-dialog-${mode}-submit`}
          cancelTestId={`config-row-dialog-${mode}-cancel`}
        />
      }
    >
      <div className="admin-form">
        <div className="admin-form-field">
          <label className="admin-form-label">{t('admin.settings.formKey')}</label>
          <input
            value={values.key}
            onChange={(e) => set('key', e.target.value)}
            disabled={mode === 'edit'}
            data-testid={`config-row-dialog-${mode}-key`}
          />
          {errors.key ? <div className="admin-form-error">{errors.key}</div> : null}
        </div>
        <div className="admin-form-field">
          <label className="admin-form-label">{t('admin.settings.formValue')}</label>
          <textarea
            value={values.value}
            onChange={(e) => set('value', e.target.value)}
            rows={3}
            data-testid={`config-row-dialog-${mode}-value`}
          />
          {errors.value ? <div className="admin-form-error">{errors.value}</div> : null}
        </div>
      </div>
    </AdminDialog>
  )
}
