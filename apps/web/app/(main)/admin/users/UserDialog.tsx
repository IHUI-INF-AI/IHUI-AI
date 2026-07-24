'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Camera, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar } from '@/components/data/Avatar'
import { Modal, Drawer, ConfirmDialog } from '@/components/feedback'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@ihui/ui-react'
import { api } from './helpers'
import type { AdminUser, DeptItem } from './types'

interface AvatarUploadResp {
  user: { avatar: string | null } & Partial<AdminUser>
}

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
  onAvatarUploaded: (user: AdminUser) => void
  getDeptName?: (deptId: number | null) => string | null
  deptList?: DeptItem[]
  onDeptChange?: (userId: string, deptId: number | null) => void
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
  onAvatarUploaded,
  getDeptName,
  deptList,
  onDeptChange,
}: Props) {
  const t = useTranslations('admin.users')
  const isDelete = !!confirmUser && confirmMode === 'delete'
  const isActive = !!confirmUser && (confirmUser.status ?? 0) === 1
  const isBanned = !!confirmUser && (confirmUser.status ?? 0) === 3
  const fileRef = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState(false)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !detailUser) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const resp = await api<AvatarUploadResp>(`/api/users/${detailUser.id}/avatar`, {
        method: 'POST',
        body: fd,
      })
      onAvatarUploaded({ ...detailUser, avatar: resp.user.avatar ?? detailUser.avatar })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '上传失败')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

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
              <div className="group relative">
                <Avatar
                  src={detailUser.avatar ?? undefined}
                  name={detailUser.nickname || 'U'}
                  size="lg"
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  aria-label={t('uploadAvatar')}
                  className="absolute inset-0 flex items-center justify-center rounded-md bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100 disabled:opacity-60"
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleFile}
                />
              </div>
              <div>
                <p className="font-medium">{detailUser.nickname || '-'}</p>
                <p className="text-sm text-muted-foreground">
                  {detailUser.phone || detailUser.email || '-'}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground/70">{t('uploadAvatarHint')}</p>
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
                <p>
                  {(detailUser.status ?? 0) === 3
                    ? t('statusCancelled')
                    : (detailUser.status ?? 0) >= 1
                      ? t('statusActive')
                      : t('statusDisabled')}
                </p>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">{t('dept')}</span>
                {deptList && onDeptChange ? (
                  <div className="mt-1">
                    <Select
                      value={detailUser.deptId ? String(detailUser.deptId) : 'none'}
                      onValueChange={(v) =>
                        onDeptChange(detailUser.id, v === 'none' ? null : Number(v))
                      }
                      disabled={patchPending}
                    >
                      <SelectTrigger className="h-8 w-full text-sm" id="u-dept">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t('noDept')}</SelectItem>
                        {deptList.map((d) => (
                          <SelectItem key={d.deptId} value={String(d.deptId)}>
                            {d.deptName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <p>{getDeptName?.(detailUser.deptId) ?? t('noDept')}</p>
                )}
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
        title={isActive ? t('ban') : t('unban')}
        content={
          isActive ? t('confirmBan') : isBanned ? t('confirmUnban') : t('confirmStatusChange')
        }
        confirmText={isActive ? t('ban') : t('unban')}
        onConfirm={onConfirmStatus}
        onCancel={onCancelStatus}
        loading={patchPending}
      />

      <ConfirmDialog
        open={isDelete}
        variant="danger"
        title={t('delete')}
        content={
          confirmUser
            ? `${t('confirmDeletePrefix')} "${confirmUser.nickname || confirmUser.phone || confirmUser.id}" ${t('confirmDeleteSuffix')}`
            : ''
        }
        confirmText={t('delete')}
        onConfirm={onConfirmDelete}
        onCancel={onCancelStatus}
        loading={deletePending}
      />
    </>
  )
}
