'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  Download,
  Share2,
  Trash2,
  Loader2,
  AlertTriangle,
  FileJson,
  CheckCircle2,
  History,
  ScrollText,
  LogIn,
} from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@ihui/ui-react'
import { BackButton } from '@/components/common'
import { Alert } from '@/components/feedback'
import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'

/* ============ 类型定义(与 apps/api/src/routes/gdpr.ts 返回结构对齐) ============ */

/** 用户基础档案(export 返回的 user 字段)。 */
interface ExportUser {
  id: string
  phone: string | null
  email: string | null
  username: string | null
  nickname: string | null
  avatar: string | null
  bio: string | null
  gender: number
  birthday: string | null
  status: number
  createdAt: string
  updatedAt: string
}

interface ExportSearchItem {
  id: string
  query: string
  resultsCount: number
  createdAt: string
}

interface ExportAuditItem {
  id: string
  action: string
  resourceType: string | null
  resourceId: string | null
  createdAt: string
}

/** POST /api/gdpr/export 返回的 data 结构。 */
interface ExportData {
  user: ExportUser
  searchHistory: ExportSearchItem[]
  auditLogs: ExportAuditItem[]
}

/** portability 返回的 subject 结构。 */
interface PortabilitySubject {
  id: string
  identifier: string | null
}

interface PortabilityProfile {
  username: string | null
  nickname: string | null
  email: string | null
  phone: string | null
  avatar: string | null
  bio: string | null
  gender: number | null
  birthday: string | null
  createdAt: string
  updatedAt: string
}

interface PortabilitySearchItem {
  query: string
  resultsCount: number
  createdAt: string
}

interface PortabilityAuditItem {
  action: string
  resourceType: string | null
  resourceId: string | null
  createdAt: string
}

/** POST /api/gdpr/portability 返回的 data 结构(机器可读的 GDPR 可携带导出)。 */
interface PortabilityData {
  schema: string
  exportedAt: string
  subject: PortabilitySubject
  data: {
    profile: PortabilityProfile
    searchHistory: PortabilitySearchItem[]
    auditTrail: PortabilityAuditItem[]
  }
}

/** POST /api/gdpr/erase 返回的 data 结构。 */
interface EraseData {
  erased: boolean
  userId: string
}

/* ============ 常量与工具 ============ */

/** 擦除确认必须输入的大写文本(二次确认防误删)。 */
const DELETE_CONFIRM_TEXT = 'DELETE'

/** 空值占位展示。 */
function formatValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
}

/** ISO 时间 → 本地可读格式。 */
function formatDate(value: string): string {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString()
}

/** 将对象序列化为 JSON 并触发浏览器下载。 */
function downloadJson<T>(data: T, filename = 'my-data.json'): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/* ============ 用户字段列表子组件 ============ */

interface UserFieldRow {
  label: string
  value: string
}

/** 将用户档案字段渲染为键值列表(i18n 有 key 的用翻译,其余用字段名)。 */
function UserInfoList({ user, t }: { user: ExportUser; t: ReturnType<typeof useTranslations> }) {
  const rows: UserFieldRow[] = [
    { label: t('email'), value: formatValue(user.email) },
    { label: t('phone'), value: formatValue(user.phone) },
    { label: t('nickname'), value: formatValue(user.nickname) },
    { label: 'username', value: formatValue(user.username) },
    { label: 'avatar', value: formatValue(user.avatar) },
    { label: 'bio', value: formatValue(user.bio) },
    { label: 'birthday', value: formatValue(user.birthday) },
    { label: 'gender', value: formatValue(user.gender) },
    { label: 'status', value: formatValue(user.status) },
    { label: 'createdAt', value: formatDate(user.createdAt) },
    { label: 'updatedAt', value: formatDate(user.updatedAt) },
  ]
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 min-[480px]:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label} className="flex min-w-0 gap-2 text-sm">
          <dt className="w-20 shrink-0 truncate text-muted-foreground">{row.label}</dt>
          <dd className="min-w-0 break-all">{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/* ============ 页面 ============ */

export default function DataRightsPage() {
  const t = useTranslations('eduAi.dataRights')
  const ct = useTranslations('common')
  const authT = useTranslations('oAuthCallbackPage')
  const router = useRouter()
  const logout = useAuthStore((s) => s.logout)

  // 数据导出
  const [exportData, setExportData] = React.useState<ExportData | null>(null)
  const [exporting, setExporting] = React.useState(false)
  const [exportError, setExportError] = React.useState<string | null>(null)

  // 数据可携带
  const [portabilityData, setPortabilityData] = React.useState<PortabilityData | null>(null)
  const [portabilityLoading, setPortabilityLoading] = React.useState(false)
  const [portabilityError, setPortabilityError] = React.useState<string | null>(null)

  // 数据擦除
  const [eraseOpen, setEraseOpen] = React.useState(false)
  const [eraseConfirmText, setEraseConfirmText] = React.useState('')
  const [erasing, setErasing] = React.useState(false)
  const [eraseError, setEraseError] = React.useState<string | null>(null)
  const [erased, setErased] = React.useState(false)

  const canConfirmErase = eraseConfirmText === DELETE_CONFIRM_TEXT && !erasing

  const handleExport = async () => {
    setExporting(true)
    setExportError(null)
    const res = await fetchApi<ExportData>('/api/gdpr/export', { method: 'POST' })
    setExporting(false)
    if (res.success) {
      setExportData(res.data)
    } else {
      setExportError(res.error ?? t('error'))
    }
  }

  const handlePortability = async () => {
    setPortabilityLoading(true)
    setPortabilityError(null)
    const res = await fetchApi<PortabilityData>('/api/gdpr/portability', { method: 'POST' })
    setPortabilityLoading(false)
    if (res.success) {
      setPortabilityData(res.data)
    } else {
      setPortabilityError(res.error ?? t('error'))
    }
  }

  const handleErase = async () => {
    if (!canConfirmErase) return
    setErasing(true)
    setEraseError(null)
    const res = await fetchApi<EraseData>('/api/gdpr/erase', { method: 'POST' })
    setErasing(false)
    if (res.success) {
      setEraseOpen(false)
      setEraseConfirmText('')
      setErased(true)
      // 后端已吊销 refresh token + 匿名化账号,清空本地会话
      logout()
    } else {
      setEraseError(res.error ?? t('error'))
    }
  }

  return (
    <div className="space-y-4 px-4 py-6">
      <BackButton />

      {/* 标题 */}
      <div>
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {erased ? (
        /* ============ 擦除成功结果 ============ */
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <CheckCircle2 className="h-4 w-4" />
              {t('eraseSuccess')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{t('eraseDone')}</p>
            <Button onClick={() => router.push('/login')}>
              <LogIn className="h-4 w-4" />
              {authT('backToLogin')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ============ 数据导出卡 ============ */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-sky-600 dark:text-sky-400">
                <Download className="h-4 w-4" />
                {t('exportCard')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{t('exportDesc')}</p>

              <Button onClick={handleExport} disabled={exporting}>
                {exporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {exporting ? t('exporting') : t('exportBtn')}
              </Button>

              {exportError && <Alert variant="danger" description={exportError} />}

              {exportData && (
                <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="flex items-center gap-1.5 text-sm font-medium">
                      <FileJson className="h-4 w-4" />
                      {t('exportResult')}
                    </h3>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadJson(exportData, 'my-data.json')}
                    >
                      <Download className="h-4 w-4" />
                      {t('downloadJson')}
                    </Button>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">{t('userInfo')}</p>
                    <UserInfoList user={exportData.user} t={t} />
                  </div>

                  <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <History className="h-4 w-4 shrink-0" />
                      {t('searchHistory')}:
                      <strong className="text-foreground">{exportData.searchHistory.length}</strong>
                      {t('count')}
                    </span>
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <ScrollText className="h-4 w-4 shrink-0" />
                      {t('auditLogs')}:
                      <strong className="text-foreground">{exportData.auditLogs.length}</strong>
                      {t('count')}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ============ 数据可携带卡 ============ */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-emerald-600 dark:text-emerald-400">
                <Share2 className="h-4 w-4" />
                {t('portabilityCard')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{t('portabilityDesc')}</p>

              <Button
                onClick={handlePortability}
                disabled={portabilityLoading}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {portabilityLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Share2 className="h-4 w-4" />
                )}
                {t('portabilityBtn')}
              </Button>

              {portabilityError && <Alert variant="danger" description={portabilityError} />}

              {portabilityData && (
                <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="flex items-center gap-1.5 text-sm font-medium">
                      <FileJson className="h-4 w-4" />
                      {t('portabilityResult')}
                    </h3>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadJson(portabilityData, 'gdpr-portability.json')}
                    >
                      <Download className="h-4 w-4" />
                      {t('downloadJson')}
                    </Button>
                  </div>
                  <pre className="max-h-80 overflow-auto rounded-md bg-background/60 p-3 text-xs leading-relaxed">
                    {JSON.stringify(portabilityData, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ============ 数据擦除卡 ============ */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-destructive">
                <Trash2 className="h-4 w-4" />
                {t('eraseCard')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="danger" title={t('eraseDesc')} />

              <Button
                variant="destructive"
                onClick={() => {
                  setEraseError(null)
                  setEraseConfirmText('')
                  setEraseOpen(true)
                }}
              >
                <Trash2 className="h-4 w-4" />
                {t('eraseBtn')}
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {/* ============ 擦除确认弹窗 ============ */}
      <Dialog
        open={eraseOpen}
        onOpenChange={(o) => {
          if (!o && !erasing) setEraseOpen(false)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              {t('eraseConfirm')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Alert variant="danger" title={t('eraseDesc')} />
            <div className="space-y-1">
              <Label htmlFor="erase-confirm">{t('eraseConfirmText')}</Label>
              <Input
                id="erase-confirm"
                value={eraseConfirmText}
                onChange={(e) => setEraseConfirmText(e.target.value)}
                placeholder={DELETE_CONFIRM_TEXT}
                disabled={erasing}
                autoComplete="off"
                autoCapitalize="characters"
              />
            </div>
            {eraseError && (
              <p className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {eraseError}
              </p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setEraseOpen(false)}
              disabled={erasing}
              className="flex-1 min-[640px]:flex-none"
            >
              {ct('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleErase}
              disabled={!canConfirmErase}
              className="flex-1 min-[640px]:flex-none"
            >
              {erasing && <Loader2 className="h-4 w-4 animate-spin" />}
              {ct('confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
