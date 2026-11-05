// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Loader2, QrCode, RefreshCw, KeyRound } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'

import { apiOrThrow } from '@/lib/api'
import { Alert } from '@/components/feedback'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { ClassSelect } from './ClassSelect'

/**
 * `GET /api/edu-ai-management/attendance/qrcode` 出参(现读 edu-ai-management.ts):
 * payload 是「classId + HMAC token + 有效期」的 JSON 字符串,**不含密钥原文**;
 * 界面只把它交给 QRCodeSVG 渲染,绝不以文本形态上屏。
 */
export interface AttendanceQrDto {
  payload: string
  classId: string
  expiresAt: string
  ttlMs: number
}

interface RotateDto {
  rotated: boolean
  fingerprint: string
}

/** 与 AppQrPanel 同一取用形态(qrcode.react 的 QRCodeSVG + level="M"),尺寸按本卡片收窄 */
const QR_SIZE = 180

export function CheckInQrPanel({
  classId,
  onClassChange,
}: {
  classId?: string
  onClassChange?: (v: string) => void
} = {}) {
  const t = useTranslations('eduAttendance')
  const qc = useQueryClient()

  const [innerClassId, setInnerClassId] = React.useState('')
  const selectedClassId = classId ?? innerClassId
  const handleClassChange = onClassChange ?? setInnerClassId

  const [nonce, setNonce] = React.useState(0)
  const [fingerprint, setFingerprint] = React.useState('')
  const [now, setNow] = React.useState(() => Date.now())
  /** 同一张码只自动重取一次:时钟异常导致 expiresAt 恒在过去时,防止一秒一轮的死循环 */
  const autoRetakenFor = React.useRef('')

  const qrQuery = useQuery({
    queryKey: ['edu-attendance-qrcode', selectedClassId, nonce],
    queryFn: () =>
      apiOrThrow<AttendanceQrDto>(
        `/api/edu-ai-management/attendance/qrcode?classId=${encodeURIComponent(selectedClassId)}`,
      ),
    enabled: Boolean(selectedClassId),
    retry: false,
  })
  const qr = qrQuery.data ?? null

  React.useEffect(() => {
    setNonce(0)
    setFingerprint('')
    autoRetakenFor.current = ''
  }, [selectedClassId])

  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const remainSec = qr ? Math.ceil((Date.parse(qr.expiresAt) - now) / 1000) : 0
  React.useEffect(() => {
    if (!qr || remainSec > 0) return
    if (autoRetakenFor.current === qr.expiresAt) return
    autoRetakenFor.current = qr.expiresAt
    setNonce((n) => n + 1)
  }, [qr, remainSec])

  const rotateMutation = useMutation({
    mutationFn: () =>
      apiOrThrow<RotateDto>('/api/edu-ai-management/attendance/rule/rotate-qr-secret', {
        method: 'POST',
        body: JSON.stringify({ classId: selectedClassId }),
      }),
    onSuccess: (data) => {
      setFingerprint(data.fingerprint)
      void qc.invalidateQueries({ queryKey: ['edu-attendance-rule', selectedClassId] })
      setNonce((n) => n + 1)
    },
  })

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-4 w-4 text-muted-foreground" />
          {t('qrPanelTitle')}
        </CardTitle>
        {classId === undefined ? (
          <ClassSelect
            value={selectedClassId}
            onChange={handleClassChange}
            triggerClassName="w-40"
          />
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-wrap items-start gap-4">
        {!selectedClassId ? (
          <p className="font-[weight:inherit] text-label text-muted-foreground">
            {t('ruleClassHint')}
          </p>
        ) : qrQuery.isLoading ? (
          <div className="flex items-center gap-2 py-6 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            {t('qrLoading')}
          </div>
        ) : qr ? (
          <>
            <div
              className="rounded-md border border-border bg-popover p-3"
              data-testid="attendance-qr"
            >
              <QRCodeSVG value={qr.payload} size={QR_SIZE} level="M" />
            </div>
            <div className="space-y-2">
              <p className="font-[weight:inherit] whitespace-nowrap text-label tabular-nums text-muted-foreground">
                {remainSec > 0 ? t('qrExpiresIn', { seconds: String(remainSec) }) : t('qrExpired')}
              </p>
              <p className="font-[weight:inherit] text-label text-muted-foreground">
                {t('qrSecretNote')}
              </p>
              {fingerprint && (
                <p className="font-[weight:inherit] whitespace-nowrap text-label tabular-nums text-emerald-600 dark:text-emerald-500">
                  {t('qrRotated', { fingerprint })}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setNonce((n) => n + 1)}
                  data-testid="qr-refresh"
                >
                  <RefreshCw className="mr-1 h-3.5 w-3.5" />
                  {t('qrRefresh')}
                </Button>
                <Button
                  size="sm"
                  onClick={() => rotateMutation.mutate()}
                  disabled={rotateMutation.isPending}
                >
                  <KeyRound className="mr-1 h-3.5 w-3.5" />
                  {t('qrRotateSecret')}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <Alert
            variant="danger"
            description={String((qrQuery.error as Error | null)?.message ?? t('qrLoadFailed'))}
            action={<p className="font-[weight:inherit] text-label">{t('qrNeedSetup')}</p>}
          />
        )}

        {rotateMutation.error ? (
          <Alert
            variant="danger"
            description={String((rotateMutation.error as Error).message)}
            action={<p className="font-[weight:inherit] text-label">{t('qrNeedSetup')}</p>}
          />
        ) : null}
      </CardContent>
    </Card>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
