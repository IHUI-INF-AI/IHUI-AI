/**
 * AdminGuard:对当前 AuthUser 做 roleId 校验,非管理员渲染 403 占位。
 * 不重定向 — 维持当前 URL(便于 Tauri 多窗口 / 浏览器新标签场景)。
 */
import type { ReactNode } from 'react'
import type { AuthUser } from '@ihui/api-client'
import { isAdminUser } from '../../lib/admin-guard'
import { useI18n } from '../../i18n'

interface Props {
  user: AuthUser | null
  children: ReactNode
}

export default function AdminGuard({ user, children }: Props) {
  const { t } = useI18n()
  if (isAdminUser(user)) return <>{children}</>
  return (
    <div className="admin-forbidden" data-testid="admin-forbidden">
      <h2>{t('admin.forbidden')}</h2>
      <p>{t('admin.loginAsAdmin')}</p>
    </div>
  )
}

export { isAdminUser }
