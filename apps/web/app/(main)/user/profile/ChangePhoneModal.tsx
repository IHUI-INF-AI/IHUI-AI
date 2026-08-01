'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { toUserFriendlyMessage } from '@ihui/shared'
import { Button, Input, Label } from '@ihui/ui-react'
import { Modal } from '@/components/feedback/Modal'
import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'

const phoneRegex = /^1[3-9]\d{9}$/

interface Props {
  open: boolean
  onClose: () => void
  /** 当前账号绑定的旧手机号 */
  oldPhone: string
  /** 修改成功后回调,参数为新手机号 */
  onSuccess: (newPhone: string) => void
}

/**
 * 修改手机号弹窗(2026-08-01 立,用户规则:"只点击按钮才能修改并且获取新旧手机号验证码确认后才能修改")
 *
 * 流程:
 *   1. 旧手机号(只读,显示当前账号绑定手机号) → 获取旧手机号验证码 → 输入旧验证码
 *   2. 新手机号(可输入) → 获取新手机号验证码 → 输入新验证码
 *   3. 点击"确认修改" → POST /api/users/change-phone
 *   4. 后端校验双验证码 + 自动合并账号(新号有账号时)
 */
export function ChangePhoneModal({ open, onClose, oldPhone, onSuccess }: Props) {
  const t = useTranslations('user.profile')
  const [oldCode, setOldCode] = React.useState('')
  const [newPhone, setNewPhone] = React.useState('')
  const [newCode, setNewCode] = React.useState('')
  const [oldCountdown, setOldCountdown] = React.useState(0)
  const [newCountdown, setNewCountdown] = React.useState(0)
  const [sendingOld, setSendingOld] = React.useState(false)
  const [sendingNew, setSendingNew] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState('')

  // 关闭弹窗时重置所有状态
  const handleClose = () => {
    setOldCode('')
    setNewPhone('')
    setNewCode('')
    setOldCountdown(0)
    setNewCountdown(0)
    setSendingOld(false)
    setSendingNew(false)
    setSubmitting(false)
    setError('')
    onClose()
  }

  const startCountdown = (setter: React.Dispatch<React.SetStateAction<number>>) => {
    setter(60)
    const timer = setInterval(() => {
      setter((c) => {
        if (c <= 1) {
          clearInterval(timer)
          return 0
        }
        return c - 1
      })
    }, 1000)
  }

  const startOldCountdown = () => startCountdown(setOldCountdown)
  const startNewCountdown = () => startCountdown(setNewCountdown)

  const onSendOldCode = async () => {
    if (oldCountdown > 0 || sendingOld) return
    setError('')
    setSendingOld(true)
    try {
      const res = await fetchApi<{ sent: boolean }>('/api/auth/send-code', {
        method: 'POST',
        body: JSON.stringify({ phone: oldPhone, scene: 'phone-binding' }),
      })
      if (!res.success) {
        setError(toUserFriendlyMessage(res.error))
        return
      }
      toast.success(t('oldCodeSent'))
      startOldCountdown()
    } catch {
      setError(t('sendCodeFailed'))
    } finally {
      setSendingOld(false)
    }
  }

  const onSendNewCode = async () => {
    if (newCountdown > 0 || sendingNew) return
    setError('')
    if (!phoneRegex.test(newPhone)) {
      setError(t('newPhoneInvalid'))
      return
    }
    if (newPhone === oldPhone) {
      setError(t('newPhoneSameAsOld'))
      return
    }
    setSendingNew(true)
    try {
      const res = await fetchApi<{ sent: boolean }>('/api/auth/send-code', {
        method: 'POST',
        body: JSON.stringify({ phone: newPhone, scene: 'phone-binding' }),
      })
      if (!res.success) {
        setError(toUserFriendlyMessage(res.error))
        return
      }
      toast.success(t('newCodeSent'))
      startNewCountdown()
    } catch {
      setError(t('sendCodeFailed'))
    } finally {
      setSendingNew(false)
    }
  }

  const onSubmit = async () => {
    setError('')
    if (!oldCode || oldCode.length !== 6) {
      setError(t('oldCodeInvalid'))
      return
    }
    if (!phoneRegex.test(newPhone)) {
      setError(t('newPhoneInvalid'))
      return
    }
    if (!newCode || newCode.length !== 6) {
      setError(t('newCodeInvalid'))
      return
    }
    setSubmitting(true)
    try {
      const res = await fetchApi<{ user: { id: string; phone: string } }>(
        '/api/users/change-phone',
        {
          method: 'POST',
          body: JSON.stringify({
            oldPhone,
            oldCode,
            newPhone,
            newCode,
          }),
        },
      )
      if (!res.success) {
        setError(toUserFriendlyMessage(res.error))
        return
      }
      toast.success(t('phoneChanged'))
      onSuccess(res.data.user.phone)
      handleClose()
    } catch {
      setError(t('changePhoneFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t('changePhoneTitle')}
      description={t('changePhoneDesc')}
      size="md"
      footer={
        <>
          <Button type="button" variant="outline" onClick={handleClose} disabled={submitting}>
            {t('cancel')}
          </Button>
          <Button type="button" onClick={onSubmit} disabled={submitting}>
            {submitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {t('confirmChange')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* 旧手机号(只读) + 旧验证码 */}
        <div className="space-y-2">
          <Label htmlFor="oldPhoneDisplay">{t('oldPhone')}</Label>
          <Input id="oldPhoneDisplay" value={oldPhone} readOnly disabled className="bg-muted/50" />
          <div className="flex items-end gap-2">
            <div className="flex-1 min-w-0 space-y-1.5">
              <Label htmlFor="oldCodeInput">{t('oldCode')}</Label>
              <Input
                id="oldCodeInput"
                inputMode="numeric"
                maxLength={6}
                placeholder={t('codePlaceholder')}
                value={oldCode}
                onChange={(e) => setOldCode(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={onSendOldCode}
              disabled={oldCountdown > 0 || sendingOld}
              className="shrink-0 whitespace-nowrap"
            >
              {sendingOld && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {oldCountdown > 0 ? t('resend', { seconds: oldCountdown }) : t('sendOldCode')}
            </Button>
          </div>
        </div>

        {/* 新手机号 + 新验证码 */}
        <div className="space-y-2">
          <Label htmlFor="newPhoneInput">{t('newPhone')}</Label>
          <Input
            id="newPhoneInput"
            type="tel"
            inputMode="numeric"
            maxLength={11}
            placeholder={t('newPhonePlaceholder')}
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, ''))}
          />
          <div className="flex items-end gap-2">
            <div className="flex-1 min-w-0 space-y-1.5">
              <Label htmlFor="newCodeInput">{t('newCode')}</Label>
              <Input
                id="newCodeInput"
                inputMode="numeric"
                maxLength={6}
                placeholder={t('codePlaceholder')}
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={onSendNewCode}
              disabled={newCountdown > 0 || sendingNew}
              className="shrink-0 whitespace-nowrap"
            >
              {sendingNew && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {newCountdown > 0 ? t('resend', { seconds: newCountdown }) : t('sendNewCode')}
            </Button>
          </div>
        </div>

        {error && <p className={cn('text-xs text-destructive')}>{error}</p>}

        <p className="text-xs text-muted-foreground">{t('mergeHint')}</p>
      </div>
    </Modal>
  )
}
