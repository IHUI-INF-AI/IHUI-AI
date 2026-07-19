/**
 * UserDialog — 用户创建/编辑弹窗。
 *
 * 模式:
 *  - mode=create: nickname / phone? / email? / password(必填) / role / status / level
 *  - mode=edit:   nickname / phone / email / role / status / level(password 不展示)
 *
 * 校验:
 *  - nickname 必填
 *  - create 模式下 password 必填且 ≥6
 *  - phone 11 位数字(非空时校验)
 *  - email 含 @ 和 .(非空时校验)
 *  - level 0-99
 */
import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n'
import { AdminDialog, AdminDialogActions } from './AdminDialog'
import type { MemberUser } from '@ihui/api-client'

export type UserDialogMode = 'create' | 'edit'

export interface UserFormValues {
  nickname: string
  phone: string
  email: string
  password: string
  roleId: number
  status: number
  level: number
}

export interface UserDialogProps {
  open: boolean
  mode: UserDialogMode
  user?: MemberUser | null
  submitting?: boolean
  onClose: () => void
  onSubmit: (values: UserFormValues) => void | Promise<void>
}

const DEFAULT_VALUES: UserFormValues = {
  nickname: '',
  phone: '',
  email: '',
  password: '',
  roleId: 0,
  status: 1,
  level: 0,
}

function fromUser(u: MemberUser | null | undefined): UserFormValues {
  if (!u) return { ...DEFAULT_VALUES }
  return {
    nickname: u.nickname ?? '',
    phone: u.phone ?? '',
    email: u.email ?? '',
    password: '',
    roleId: u.isSystemAdmin ? 99 : u.roleId ?? 0,
    status: u.status ?? 1,
    level: u.level ?? 0,
  }
}

function validate(values: UserFormValues, mode: UserDialogMode, t: (k: string) => string): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!values.nickname.trim()) errors.nickname = t('admin.users.formNicknameRequired')
  if (mode === 'create') {
    if (!values.password) errors.password = t('admin.users.formPasswordRequired')
    else if (values.password.length < 6) errors.password = t('admin.users.formPasswordLength')
  } else if (values.password && values.password.length < 6) {
    errors.password = t('admin.users.formPasswordLength')
  }
  if (values.phone && !/^1\d{10}$/.test(values.phone)) {
    errors.phone = t('admin.users.formPhoneInvalid')
  }
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    errors.email = t('admin.users.formEmailInvalid')
  }
  if (values.level < 0 || values.level > 99 || Number.isNaN(values.level)) {
    errors.level = t('admin.users.formLevelRange')
  }
  return errors
}

export function UserDialog({ open, mode, user, submitting, onClose, onSubmit }: UserDialogProps) {
  const { t } = useI18n()
  const [values, setValues] = useState<UserFormValues>(DEFAULT_VALUES)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) {
      setValues(fromUser(user))
      setErrors({})
    }
  }, [open, user])

  const set = <K extends keyof UserFormValues>(k: K, v: UserFormValues[K]) => {
    setValues((prev) => ({ ...prev, [k]: v }))
  }

  const submit = () => {
    const errs = validate(values, mode, t)
    setErrors(errs)
    if (Object.keys(errs).length > 0) return
    void onSubmit(values)
  }

  return (
    <AdminDialog
      open={open}
      onClose={onClose}
      title={mode === 'create' ? t('admin.users.create') : t('admin.users.edit')}
      testId={`user-dialog-${mode}`}
      size="md"
      footer={
        <AdminDialogActions
          onCancel={onClose}
          onSubmit={submit}
          submitLabel={t('common.save')}
          cancelLabel={t('common.cancel')}
          submitting={submitting}
          submitTestId={`user-dialog-${mode}-submit`}
          cancelTestId={`user-dialog-${mode}-cancel`}
        />
      }
    >
      <div className="admin-form">
        <div className="admin-form-field">
          <label className="admin-form-label">{t('admin.users.formNickname')}</label>
          <input
            value={values.nickname}
            onChange={(e) => set('nickname', e.target.value)}
            data-testid="user-dialog-nickname"
          />
          {errors.nickname ? <div className="admin-form-error">{errors.nickname}</div> : null}
        </div>
        <div className="admin-form-field">
          <label className="admin-form-label">{t('admin.users.formPhone')}</label>
          <input
            value={values.phone}
            onChange={(e) => set('phone', e.target.value)}
            data-testid="user-dialog-phone"
            placeholder="13800000000"
          />
          {errors.phone ? <div className="admin-form-error">{errors.phone}</div> : null}
        </div>
        <div className="admin-form-field">
          <label className="admin-form-label">{t('admin.users.formEmail')}</label>
          <input
            value={values.email}
            onChange={(e) => set('email', e.target.value)}
            data-testid="user-dialog-email"
            placeholder="user@example.com"
          />
          {errors.email ? <div className="admin-form-error">{errors.email}</div> : null}
        </div>
        <div className="admin-form-field">
          <label className="admin-form-label">
            {t('admin.users.formPassword')}
            {mode === 'edit' ? <span className="admin-form-hint">({t('admin.users.formPasswordLength')})</span> : null}
          </label>
          <input
            type="password"
            value={values.password}
            onChange={(e) => set('password', e.target.value)}
            data-testid="user-dialog-password"
          />
          {errors.password ? <div className="admin-form-error">{errors.password}</div> : null}
        </div>
        <div className="admin-form-field">
          <label className="admin-form-label">{t('admin.users.formRole')}</label>
          <select
            value={values.roleId}
            onChange={(e) => set('roleId', Number(e.target.value))}
            data-testid="user-dialog-role"
          >
            <option value={0}>{t('admin.users.roleUser')}</option>
            <option value={1}>{t('admin.users.roleAdmin')}</option>
            <option value={99}>{t('admin.users.roleSystem')}</option>
          </select>
        </div>
        <div className="admin-form-field">
          <label className="admin-form-label">{t('admin.users.formStatus')}</label>
          <select
            value={values.status}
            onChange={(e) => set('status', Number(e.target.value))}
            data-testid="user-dialog-status"
          >
            <option value={1}>{t('admin.users.statusActive')}</option>
            <option value={0}>{t('admin.users.statusDisabled')}</option>
          </select>
        </div>
        <div className="admin-form-field">
          <label className="admin-form-label">{t('admin.users.formLevel')}</label>
          <input
            type="number"
            min={0}
            max={99}
            value={values.level}
            onChange={(e) => set('level', Number(e.target.value))}
            data-testid="user-dialog-level"
          />
          {errors.level ? <div className="admin-form-error">{errors.level}</div> : null}
        </div>
      </div>
    </AdminDialog>
  )
}
