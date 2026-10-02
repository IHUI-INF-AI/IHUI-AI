// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// 签到助手(Phase1b,2026-10-03 立):账号服务端化管理页面。
// 后端:apps/ai-service /api/checkin/*(经 next.config.ts rewrites 同形转发到 8803);
// API 封装:@ihui/api-client(endpoints/checkin.ts,fetchAiServiceJson 裸 JSON);
// 类型契约:@ihui/types(checkin.ts,账号形态脱敏无 jwt 字段)。
// 结构:账号列表(启停开关/手动签到/删除)+ Tabs(签到记录 | 积分历史)+ 录入对话框。

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { CalendarCheck, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@ihui/ui-react'
import {
  createCheckinAccount,
  deleteCheckinAccount,
  listCheckinAccounts,
  listCheckinCreditsHistory,
  listCheckinRecords,
  manualCheckinAccount,
  setCheckinAccountEnabled,
  type CheckinAccount,
  type CheckinCreditsHistoryItem,
  type CheckinRecord,
} from '@ihui/api-client'

export default function CheckinPage() {
  const t = useTranslations('checkin')

  const [accounts, setAccounts] = React.useState<CheckinAccount[]>([])
  const [records, setRecords] = React.useState<CheckinRecord[]>([])
  const [credits, setCredits] = React.useState<CheckinCreditsHistoryItem[]>([])
  const [creditsTotal, setCreditsTotal] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  // 录入表单
  const [addOpen, setAddOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [jwt, setJwt] = React.useState('')
  const [deviceMapText, setDeviceMapText] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)

  // 行内操作态
  const [checkingId, setCheckingId] = React.useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<CheckinAccount | null>(null)
  const [deleting, setDeleting] = React.useState(false)
  const [actionError, setActionError] = React.useState<string | null>(null)

  const loadAll = React.useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [accountsRes, recordsRes, creditsRes] = await Promise.all([
        listCheckinAccounts(),
        listCheckinRecords({ limit: 100 }),
        listCheckinCreditsHistory({ limit: 200 }),
      ])
      setAccounts(accountsRes.accounts)
      setRecords(recordsRes.records)
      setCredits(creditsRes.history)
      setCreditsTotal(creditsRes.total_credits_delta)
    } catch (e) {
      setLoadError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void loadAll()
  }, [loadAll])

  const submitAdd = async () => {
    const trimmedName = name.trim()
    const trimmedJwt = jwt.trim()
    if (!trimmedName || !trimmedJwt) return
    let deviceMap: Record<string, unknown> = {}
    if (deviceMapText.trim()) {
      try {
        const parsed: unknown = JSON.parse(deviceMapText)
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          setFormError(t('deviceMapInvalid'))
          return
        }
        deviceMap = parsed as Record<string, unknown>
      } catch {
        setFormError(t('deviceMapInvalid'))
        return
      }
    }
    setSubmitting(true)
    setFormError(null)
    try {
      await createCheckinAccount({ name: trimmedName, jwt: trimmedJwt, device_map: deviceMap })
      setAddOpen(false)
      setName('')
      setJwt('')
      setDeviceMapText('')
      await loadAll()
    } catch (e) {
      setFormError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const toggleEnabled = async (account: CheckinAccount, enabled: boolean) => {
    setAccounts((prev) =>
      prev.map((a) => (a.id === account.id ? { ...a, enabled } : a)),
    )
    try {
      await setCheckinAccountEnabled(account.id, enabled)
    } catch (e) {
      setAccounts((prev) =>
        prev.map((a) => (a.id === account.id ? { ...a, enabled: account.enabled } : a)),
      )
      setActionError((e as Error).message)
    }
  }

  const runManualCheckin = async (account: CheckinAccount) => {
    setCheckingId(account.id)
    setActionError(null)
    try {
      await manualCheckinAccount(account.id)
      await loadAll()
    } catch (e) {
      setActionError((e as Error).message)
    } finally {
      setCheckingId(null)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteCheckinAccount(deleteTarget.id)
      setDeleteTarget(null)
      await loadAll()
    } catch (e) {
      setActionError((e as Error).message)
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  const formatTime = (iso: string | null) => (iso ? iso.replace('T', ' ').slice(0, 19) : t('none'))

  const renderResult = (ok: boolean | null) =>
    ok === true ? t('resultOk') : ok === false ? t('resultFail') : t('resultUnknown')

  return (
    <div className="mx-auto max-w-5xl px-4 py-4">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarCheck className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">{t('title')}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => void loadAll()} aria-label={t('refresh')}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            {t('addAccount')}
          </Button>
        </div>
      </div>

      {actionError && (
        <div role="alert" className="mb-4 rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {actionError}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : loadError ? (
        <div className="py-16 text-center">
          <p className="mb-3 text-sm text-destructive">{t('loadFailed')}{loadError ? `: ${loadError}` : ''}</p>
          <Button variant="outline" size="sm" onClick={() => void loadAll()}>
            {t('retry')}
          </Button>
        </div>
      ) : (
        <>
          {/* 账号列表 */}
          {accounts.length === 0 ? (
            <div className="rounded-xl border p-10 text-center text-sm text-muted-foreground">
              {t('emptyAccounts')}
            </div>
          ) : (
            <div className="rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('colName')}</TableHead>
                    <TableHead>{t('colEnabled')}</TableHead>
                    <TableHead>{t('colLastCheckin')}</TableHead>
                    <TableHead>{t('colCredits')}</TableHead>
                    <TableHead className="text-right">{t('colActions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell className="font-medium">{account.name}</TableCell>
                      <TableCell>
                        <Switch
                          checked={account.enabled}
                          onCheckedChange={(checked) => void toggleEnabled(account, checked)}
                          aria-label={t('colEnabled')}
                        />
                      </TableCell>
                      <TableCell>
                        {account.last_record ? (
                          <div className="text-xs">
                            <div>{renderResult(account.last_record.ok)}</div>
                            <div className="text-muted-foreground">
                              {formatTime(account.last_record.created_at)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">{t('none')}</span>
                        )}
                      </TableCell>
                      <TableCell>{account.last_record?.credits ?? t('none')}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={checkingId !== null}
                            onClick={() => void runManualCheckin(account)}
                          >
                            {checkingId === account.id && (
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            )}
                            {checkingId === account.id ? t('checking') : t('manualCheckin')}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={t('delete')}
                            onClick={() => setDeleteTarget(account)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* 记录 / 积分历史 */}
          <Tabs defaultValue="records" className="mt-6">
            <TabsList>
              <TabsTrigger value="records">{t('recordsTab')}</TabsTrigger>
              <TabsTrigger value="credits">{t('creditsTab')}</TabsTrigger>
            </TabsList>

            <TabsContent value="records" className="mt-3">
              {records.length === 0 ? (
                <div className="rounded-xl border p-10 text-center text-sm text-muted-foreground">
                  {t('emptyRecords')}
                </div>
              ) : (
                <div className="rounded-xl border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('colTime')}</TableHead>
                        <TableHead>{t('colResult')}</TableHead>
                        <TableHead>{t('colAction')}</TableHead>
                        <TableHead>{t('colCreditsDelta')}</TableHead>
                        <TableHead>{t('colErrorClass')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {records.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell className="text-xs">{formatTime(record.created_at)}</TableCell>
                          <TableCell>
                            <span
                              className={
                                record.ok === true
                                  ? 'text-green-600'
                                  : record.ok === false
                                    ? 'text-destructive'
                                    : 'text-muted-foreground'
                              }
                            >
                              {renderResult(record.ok)}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs">{record.action ?? '-'}</TableCell>
                          <TableCell className="text-xs">
                            {record.credits_delta === null ? '-' : record.credits_delta}
                          </TableCell>
                          <TableCell className="text-xs">
                            {record.classified_error ?? '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="credits" className="mt-3">
              <p className="mb-3 text-sm text-muted-foreground">
                {t('totalCreditsDelta')}: {creditsTotal}
              </p>
              {credits.length === 0 ? (
                <div className="rounded-xl border p-10 text-center text-sm text-muted-foreground">
                  {t('emptyCredits')}
                </div>
              ) : (
                <div className="rounded-xl border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('colTime')}</TableHead>
                        <TableHead>{t('colAction')}</TableHead>
                        <TableHead>{t('colCreditsDelta')}</TableHead>
                        <TableHead>{t('colCurrentCredits')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {credits.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-xs">{formatTime(item.created_at)}</TableCell>
                          <TableCell className="text-xs">{item.action}</TableCell>
                          <TableCell className="text-xs">
                            <span className={item.credits_delta >= 0 ? 'text-green-600' : 'text-destructive'}>
                              {item.credits_delta >= 0 ? `+${item.credits_delta}` : item.credits_delta}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs">{item.credits ?? '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* 录入对话框 */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('addAccountTitle')}</DialogTitle>
            <DialogDescription>{t('addAccountDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="checkin-name">{t('name')}</Label>
              <Input
                id="checkin-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('namePlaceholder')}
                maxLength={100}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="checkin-jwt">{t('jwt')}</Label>
              <textarea
                id="checkin-jwt"
                value={jwt}
                onChange={(e) => setJwt(e.target.value)}
                rows={4}
                placeholder={t('jwtPlaceholder')}
                className="w-full resize-y rounded-sm border bg-background p-2 text-xs outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="checkin-device-map">{t('deviceMap')}</Label>
              <textarea
                id="checkin-device-map"
                value={deviceMapText}
                onChange={(e) => setDeviceMapText(e.target.value)}
                rows={3}
                placeholder={t('deviceMapPlaceholder')}
                className="w-full resize-y rounded-sm border bg-background p-2 text-xs outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            {formError && (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={submitting}>
              {t('cancel')}
            </Button>
            <Button onClick={() => void submitAdd()} disabled={submitting || !name.trim() || !jwt.trim()}>
              {submitting && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              {submitting ? t('submitting') : t('submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteTitle')}</DialogTitle>
            <DialogDescription>
              {t('deleteDescription', { name: deleteTarget?.name ?? '' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              {t('cancel')}
            </Button>
            <Button variant="destructive" onClick={() => void confirmDelete()} disabled={deleting}>
              {deleting && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              {t('confirmDelete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
