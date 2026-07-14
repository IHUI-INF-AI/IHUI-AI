'use client'

import { useTranslations } from 'next-intl'
import { Avatar } from '@/components/data/Avatar'
import { Modal, Drawer, ConfirmDialog } from '@/components/feedback'
import type { AdminUser } from './types'

interface Props {
  quickUser: AdminUser | null
  onCloseQuick: () => void
  detailUser: AdminUser | null
  onCloseDetail: () => void
  confirmUser: AdminUser | null
  confirmMode: 'status' | 'delete'
  onConfirmStatus: () => void
  onConfirmDelete: () => void
  onCancelStatus: () => void
  patchPending: boolean
  deletePending: boolean
  dateFmt: Intl.DateTimeFormat
}

export function UserDialog({
  quickUser,
  onCloseQuick,
  detailUser,
  onCloseDetail,
  confirmUser,
  confirmMode,
  onConfirmStatus,
  onConfirmDelete,
  onCancelStatus,
  patchPending,
  deletePending,
  dateFmt,
}: Props) {
  const t = useTranslations('admin.users')
  const isDelete = !!confirmUser && confirmMode === 'delete'
  const isActive = !!confirmUser && (confirmUser.status ?? 0) >= 1
  return (
    <>
      <Modal open={!!quickUser} onClose={onCloseQuick} title={t('userDetail')} size="sm">
        {quickUser && (
          <div className="flex items-center gap-3">
            <Avatar
              src={quickUser.avatar ?? undefined}
              name={quickUser.nickname || 'U'}
              size="lg"
            />
            <div className="min-w-0">
              <p className="font-medium">{quickUser.nickname || '-'}</p>
              <p className="text-sm text-muted-foreground">{quickUser.phone || '-'}</p>
              <p className="text-xs text-muted-foreground/80">{quickUser.email || '-'}</p>
            </div>
          </div>
        )}
      </Modal>

      <Drawer
        open={!!detailUser}
        onClose={onCloseDetail}
        title={t('userDetail')}
        side="right"
        width="28rem"
      >
        {detailUser && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar
                src={detailUser.avatar ?? undefined}
                name={detailUser.nickname || 'U'}
                size="lg"
              />
              <div>
                <p className="font-medium">{detailUser.nickname || '-'}</p>
                <p className="text-sm text-muted-foreground">
                  {detailUser.phone || detailUser.email || '-'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">{t('phone')}</span>
                <p>{detailUser.phone || '-'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">{t('email')}</span>
                <p>{detailUser.email || '-'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">{t('role')}</span>
                <p>{(detailUser.roleId ?? 0) >= 1 ? t('roleAdmin') : t('roleUser')}</p>
              </div>
              <div>
                <span className="text-muted-foreground">{t('status')}</span>
                <p>{(detailUser.status ?? 0) >= 1 ? t('statusActive') : t('statusDisabled')}</p>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">{t('createdAt')}</span>
                <p>{detailUser.createdAt ? dateFmt.format(new Date(detailUser.createdAt)) : '-'}</p>
              </div>
            </div>
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={!!confirmUser && confirmMode === 'status'}
        variant="danger"
        title={isActive ? t('disable') : t('enable')}
        content={t('confirmStatusChange')}
        confirmText={isActive ? t('disable') : t('enable')}
        onConfirm={onConfirmStatus}
        onCancel={onCancelStatus}
        loading={patchPending}
      />

      <ConfirmDialog
        open={isDelete}
        variant="danger"
        title="删除用户"
        content={
          confirmUser
            ? `确认要删除用户 "${confirmUser.nickname || confirmUser.phone || confirmUser.id}" 吗?此操作不可恢复。`
            : ''
        }
        confirmText="删除"
        onConfirm={onConfirmDelete}
        onCancel={onCancelStatus}
        loading={deletePending}
      />
    </>
  )
}
