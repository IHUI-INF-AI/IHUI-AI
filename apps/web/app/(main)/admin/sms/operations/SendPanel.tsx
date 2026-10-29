// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { useConfirm } from '@/hooks/use-confirm'
import { Loader2, Send } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@ihui/ui-react'
import { Textarea } from '@/components/form'
import { richAnchorRenderer } from '@/components/chat/rich-anchor-text'
import { apiOrThrow } from '@/lib/api'
import {
  BASE,
  CATEGORY_LABEL_KEYS,
  ERROR_LABEL_KEYS,
  PHONE_RE,
  PROVIDER_LABEL_KEYS,
  TEMPLATE_KEYS,
  TEMPLATE_LABEL_KEYS,
  codeLabel,
  normalizePhoneInput,
  parseDryRun,
} from './helpers'
import type {
  SmsBroadcastResponse,
  SmsCategory,
  SmsSendResponse,
  SmsStatus,
  SmsTemplateRow,
} from './types'

interface SendForm {
  phone: string
  category: SmsCategory
  templateKey: string
  fallbackContent: string
  dryRun: boolean
  skipRateLimit: boolean
}

interface BroadcastForm {
  category: SmsCategory
  templateKey: string
  fallbackContent: string
  limit: string
  excludeRecentDays: string
  dryRun: boolean
  confirm: string
}

function firstKey(category: SmsCategory): string {
  return TEMPLATE_KEYS[category][0] ?? 'binding-success'
}

/** 幂等键:crypto.randomUUID 只在安全上下文可用,内网 http 访问后台时退化为时间戳+随机串。 */
function newRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** 模板下拉项的审核后缀:只回 i18n 键,无后缀时回空串(分隔符由渲染处给)。 */
function reviewSuffixKey(row: SmsTemplateRow | undefined): string {
  if (!row) return ''
  if (!row.templateId) return 'status.notBackfilled'
  if (row.reviewStatus === 'rejected') return 'send.suffixRejected'
  if (row.reviewStatus === 'pending') return 'review.pending'
  if (row.reviewStatus === 'approved') return 'review.approved'
  return ''
}

function TemplateSelect({
  category,
  value,
  onChange,
  templates,
}: {
  category: SmsCategory
  value: string
  onChange: (v: string) => void
  templates: SmsTemplateRow[]
}) {
  const t = useTranslations('admin.smsOperations')
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {TEMPLATE_KEYS[category].map((key) => {
          const row = templates.find((tpl) => tpl.category === category && tpl.key === key)
          const suffixKey = reviewSuffixKey(row)
          return (
            <SelectItem key={key} value={key}>
              {codeLabel(TEMPLATE_LABEL_KEYS, key, t)}
              {suffixKey ? ` · ${t(suffixKey)}` : ''}
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}

function CategorySelect({
  value,
  onChange,
  id,
}: {
  value: SmsCategory
  onChange: (v: SmsCategory) => void
  id?: string
}) {
  const t = useTranslations('admin.smsOperations')
  return (
    <Select value={value} onValueChange={(v) => onChange(v as SmsCategory)}>
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="notice">{t(CATEGORY_LABEL_KEYS.notice)}</SelectItem>
        <SelectItem value="marketing">{t(CATEGORY_LABEL_KEYS.marketing)}</SelectItem>
      </SelectContent>
    </Select>
  )
}

export function SendPanel({ status }: { status: SmsStatus }) {
  const t = useTranslations('admin.smsOperations')
  const [form, setForm] = React.useState<SendForm>({
    phone: '',
    category: 'notice',
    templateKey: firstKey('notice'),
    fallbackContent: '',
    dryRun: true,
    skipRateLimit: false,
  })
  const [sendResult, setSendResult] = React.useState<{
    result: SmsSendResponse
    dryRun: boolean
  } | null>(null)

  const [bcast, setBcast] = React.useState<BroadcastForm>({
    category: 'notice',
    templateKey: firstKey('notice'),
    fallbackContent: '',
    limit: '50',
    excludeRecentDays: String(status.broadcastExcludeRecentDays ?? 7),
    dryRun: true,
    confirm: '',
  })
  const [bcastResult, setBcastResult] = React.useState<SmsBroadcastResponse | null>(null)
  // 原生 window.confirm 违反 §4(禁用原生提示窗),改走仓内唯一出口 useConfirm
  const { confirm, ConfirmDialogRenderer } = useConfirm()
  /** 跳过天数是否被操作员手动改过:没改过时跟随 status 刷新,改过之后不再被覆盖。 */
  const excludeDirtyRef = React.useRef(false)
  /** 群发幂等键:真发提交时生成一次,超时重试复用同一个;成功后再清空,下一次是新一次群发。 */
  const broadcastRequestIdRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    if (excludeDirtyRef.current) return
    setBcast((prev) => ({
      ...prev,
      excludeRecentDays: String(status.broadcastExcludeRecentDays ?? 7),
    }))
  }, [status.broadcastExcludeRecentDays])

  const sendMut = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiOrThrow<SmsSendResponse>(`${BASE}/send`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: (result, payload) => {
      setSendResult({ result, dryRun: payload.dryRun === true })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const bcastMut = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiOrThrow<SmsBroadcastResponse>(`${BASE}/broadcast`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: (result) => {
      setBcastResult(result)
      if (!result.dryRun) broadcastRequestIdRef.current = null
      if (result.dryRun) toast.success(t('send.dryRunDoneToast', { count: result.total }))
      else
        toast.success(
          t('send.broadcastDoneToast', { sent: result.sent ?? 0, failed: result.failed ?? 0 }),
        )
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function submitSend(e: React.FormEvent) {
    e.preventDefault()
    const phone = normalizePhoneInput(form.phone)
    if (!PHONE_RE.test(phone)) {
      toast.error(t('field.phoneInvalid'))
      return
    }
    const content = form.fallbackContent.trim()
    if (content && content.length > 35) {
      toast.error(t('send.fallbackTooLong'))
      return
    }
    if (marketingOff && form.category === 'marketing' && !form.dryRun) {
      toast.error(t('send.marketingOffToast'))
      return
    }
    const tpl = status.templates.find(
      (row) => row.category === form.category && row.key === form.templateKey,
    )
    if (!form.dryRun && !tpl?.templateId && !content) {
      toast.error(t('send.templateNotBackfilled'))
      return
    }
    if (!form.dryRun && tpl?.reviewStatus === 'rejected' && !content) {
      toast.error(t('send.templateRejected'))
      return
    }
    setSendResult(null)
    sendMut.mutate({
      phone,
      category: form.category,
      templateKey: form.templateKey,
      ...(content ? { fallbackContent: content } : {}),
      dryRun: form.dryRun,
      skipRateLimit: form.skipRateLimit,
    })
  }

  // 页面群发固定面向全量用户(按注册顺序取前 N)，后端要求全量档使用更强的确认词。
  function requiredConfirm(): string {
    return bcast.category === 'marketing' ? 'SEND_ALL_MARKETING' : 'SEND_ALL'
  }

  async function submitBroadcast(e: React.FormEvent) {
    e.preventDefault()
    const content = bcast.fallbackContent.trim()
    if (content && content.length > 35) {
      toast.error(t('send.fallbackTooLong'))
      return
    }
    if (!bcast.dryRun && bcast.confirm.trim() !== requiredConfirm()) {
      toast.error(t('send.confirmWordRequired', { word: requiredConfirm() }))
      return
    }
    if (marketingOff && bcast.category === 'marketing' && !bcast.dryRun) {
      toast.error(t('send.marketingOffToast'))
      return
    }
    const tpl = status.templates.find(
      (row) => row.category === bcast.category && row.key === bcast.templateKey,
    )
    if (!bcast.dryRun && !tpl?.templateId && !content) {
      toast.error(t('send.templateNotBackfilled'))
      return
    }
    if (!bcast.dryRun && tpl?.reviewStatus === 'rejected' && !content) {
      toast.error(t('send.templateRejected'))
      return
    }
    const limit = Number(bcast.limit)
    if (!Number.isInteger(limit) || limit < 1 || limit > status.broadcastLimit) {
      toast.error(t('send.limitInvalid', { max: status.broadcastLimit }))
      return
    }
    const excludeDays = Number(bcast.excludeRecentDays)
    if (!Number.isInteger(excludeDays) || excludeDays < 0 || excludeDays > 30) {
      toast.error(t('send.excludeDaysInvalid'))
      return
    }
    if (!bcast.dryRun && excludeDays === 0) {
      const ok = await confirm({
        title: t('send.zeroDaysTitle'),
        description: t('send.zeroDaysDesc'),
        confirmText: t('send.zeroDaysConfirm'),
      })
      if (!ok) return
    }
    setBcastResult(null)
    // 真发才需要幂等键:预演不发短信,不该占用锁
    if (!bcast.dryRun && !broadcastRequestIdRef.current) {
      broadcastRequestIdRef.current = newRequestId()
    }
    bcastMut.mutate({
      category: bcast.category,
      templateKey: bcast.templateKey,
      ...(content ? { fallbackContent: content } : {}),
      allUsers: true,
      limit,
      excludeRecentDays: excludeDays,
      dryRun: bcast.dryRun,
      ...(bcast.dryRun
        ? {}
        : { confirm: bcast.confirm.trim(), requestId: broadcastRequestIdRef.current }),
    })
  }

  const dryRunView = sendResult ? parseDryRun(sendResult.result.error) : null
  /** 营销总开关关闭时只允许预演:真发会在后端被 marketing_disabled 拦截,
   *  这里提前禁用按钮并说明原因,避免操作员误以为是通道故障。 */
  const marketingOff = !status.compliance.marketingEnabled
  const sendBlocked = marketingOff && form.category === 'marketing' && !form.dryRun
  const bcastBlocked = marketingOff && bcast.category === 'marketing' && !bcast.dryRun
  /** 群发范围的三段读数(范围内 / 跳过已收 / 可发);整条句子走 ICU,不拆成片段拼接。 */
  function scopeSummary(r: SmsBroadcastResponse): string {
    return t('send.scopeSummary', {
      scopeTotal: r.scopeTotal ?? '-',
      days: r.excludeRecentDays ?? 0,
      excluded: r.excludedRecent ?? 0,
      eligible: r.eligible ?? '-',
    })
  }

  return (
    <div className="space-y-4">
      {marketingOff && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          {t('send.marketingOffBanner')}
        </p>
      )}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('send.cardSingle')}</CardTitle>
            <CardDescription>{t('send.cardSingleDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={submitSend}>
              <div className="space-y-1">
                <Label htmlFor="send-phone">{t('field.phone')}</Label>
                <Input
                  id="send-phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="13800000000"
                  inputMode="tel"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>{t('field.usage')}</Label>
                  <CategorySelect
                    value={form.category}
                    onChange={(category) =>
                      setForm({ ...form, category, templateKey: firstKey(category) })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>{t('field.template')}</Label>
                  <TemplateSelect
                    category={form.category}
                    value={form.templateKey}
                    onChange={(templateKey) => setForm({ ...form, templateKey })}
                    templates={status.templates}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="send-fallback">{t('field.fallbackContent')}</Label>
                <Textarea
                  id="send-fallback"
                  rows={2}
                  value={form.fallbackContent}
                  onChange={(e) => setForm({ ...form, fallbackContent: e.target.value })}
                  placeholder={t('send.fallbackPlaceholder')}
                />
                <p className="text-xs text-muted-foreground">
                  {t('send.fallbackCounter', { n: form.fallbackContent.trim().length })}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id="send-dry-run"
                    checked={form.dryRun}
                    onCheckedChange={(dryRun) => setForm({ ...form, dryRun })}
                  />
                  <Label htmlFor="send-dry-run">{t('send.dryRunLabel')}</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="send-skip-rate"
                    checked={form.skipRateLimit}
                    onCheckedChange={(skipRateLimit) => setForm({ ...form, skipRateLimit })}
                  />
                  <Label htmlFor="send-skip-rate">{t('send.skipRateLimitLabel')}</Label>
                </div>
              </div>

              <Button type="submit" size="sm" disabled={sendMut.isPending || sendBlocked}>
                {sendMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {t('send.submitLabel')}
              </Button>
            </form>

            {sendResult && (
              <div className="mt-3 rounded-md border p-3 text-sm">
                {dryRunView ? (
                  <p>
                    {t.rich('send.dryRunPassed', {
                      channel: codeLabel(PROVIDER_LABEL_KEYS, dryRunView.channel, t),
                      badge: (chunks) => (
                        <Badge variant="secondary" className="mx-1">
                          {chunks}
                        </Badge>
                      ),
                    })}
                  </p>
                ) : sendResult.result.sent ? (
                  <p className="text-emerald-600">
                    {t('send.sentSuccess', {
                      channel: codeLabel(PROVIDER_LABEL_KEYS, sendResult.result.provider, t),
                      template: sendResult.result.templateId ?? '-',
                    })}
                  </p>
                ) : (
                  <p className="text-destructive">
                    {t('send.sendFailed', {
                      reason: codeLabel(ERROR_LABEL_KEYS, sendResult.result.error, t),
                    })}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('send.cardBroadcast')}</CardTitle>
            <CardDescription>
              {t('send.cardBroadcastDesc', {
                days: status.broadcastExcludeRecentDays,
                limit: status.broadcastLimit,
              })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={submitBroadcast}>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>{t('field.usage')}</Label>
                  <CategorySelect
                    value={bcast.category}
                    onChange={(category) =>
                      setBcast({
                        ...bcast,
                        category,
                        templateKey: firstKey(category),
                        confirm: '',
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>{t('field.template')}</Label>
                  <TemplateSelect
                    category={bcast.category}
                    value={bcast.templateKey}
                    onChange={(templateKey) => setBcast({ ...bcast, templateKey })}
                    templates={status.templates}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor="bcast-limit">{t('send.limitLabel')}</Label>
                  <Input
                    id="bcast-limit"
                    type="number"
                    min={1}
                    max={status.broadcastLimit}
                    value={bcast.limit}
                    onChange={(e) => setBcast({ ...bcast, limit: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="bcast-exclude">{t('send.excludeLabel')}</Label>
                  <Input
                    id="bcast-exclude"
                    type="number"
                    min={0}
                    max={30}
                    value={bcast.excludeRecentDays}
                    onChange={(e) => {
                      excludeDirtyRef.current = true
                      setBcast({ ...bcast, excludeRecentDays: e.target.value })
                    }}
                  />
                  <p className="text-xs text-muted-foreground">{t('send.excludeZeroHint')}</p>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="bcast-fallback">{t('field.fallbackContent')}</Label>
                  <Input
                    id="bcast-fallback"
                    value={bcast.fallbackContent}
                    onChange={(e) => setBcast({ ...bcast, fallbackContent: e.target.value })}
                    placeholder={t('send.fallbackShortPlaceholder')}
                    maxLength={35}
                  />
                </div>
              </div>

              {bcast.category === 'marketing' && (
                <p className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                  {t('send.marketingConstraint', {
                    cap: status.compliance.marketingGlobalDailyCap,
                    window: status.compliance.marketingSendWindow,
                  })}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id="bcast-dry-run"
                    checked={bcast.dryRun}
                    onCheckedChange={(dryRun) => setBcast({ ...bcast, dryRun })}
                  />
                  <Label htmlFor="bcast-dry-run">{t('send.dryRunLabel')}</Label>
                </div>
              </div>

              {!bcast.dryRun && (
                <div className="space-y-1">
                  <Label htmlFor="bcast-confirm">
                    {t.rich('send.confirmLabel', {
                      word: requiredConfirm(),
                      code: richAnchorRenderer('code'),
                    })}
                  </Label>
                  <Input
                    id="bcast-confirm"
                    value={bcast.confirm}
                    onChange={(e) => setBcast({ ...bcast, confirm: e.target.value })}
                    placeholder={requiredConfirm()}
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => setBcast({ ...bcast, confirm: requiredConfirm() })}
                  >
                    {t('send.fillConfirmWord')}
                  </button>
                </div>
              )}

              <Button type="submit" size="sm" disabled={bcastMut.isPending || bcastBlocked}>
                {bcastMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {t('send.submitBroadcastLabel')}
              </Button>
            </form>

            {bcastResult && (
              <div className="mt-3 space-y-2 rounded-md border p-3 text-sm">
                {bcastResult.dryRun ? (
                  <>
                    <p>
                      {t('send.dryRunSummary', {
                        total: bcastResult.total,
                        channel: codeLabel(PROVIDER_LABEL_KEYS, bcastResult.channel, t),
                        template: bcastResult.templateId ?? '-',
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {scopeSummary(bcastResult)}
                      {(bcastResult.targetOffset ?? 0) > 0
                        ? ` · ${t('send.scopeOffset', { offset: bcastResult.targetOffset ?? 0 })}`
                        : ''}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t('send.samplePhones', {
                        phones: bcastResult.samplePhones?.join('、') || '-',
                      })}
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      {t.rich('send.broadcastSummary', {
                        total: bcastResult.total,
                        sent: bcastResult.sent ?? 0,
                        failed: bcastResult.failed ?? 0,
                        suppressed: bcastResult.suppressed ?? 0,
                        ok: (chunks) => (
                          <span className="font-medium text-emerald-600">{chunks}</span>
                        ),
                        bad: (chunks) => (
                          <span className="font-medium text-destructive">{chunks}</span>
                        ),
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {scopeSummary(bcastResult)}
                      {(bcastResult.targetOffset ?? 0) > 0
                        ? ` · ${t('send.scopeOffset', { offset: bcastResult.targetOffset ?? 0 })}`
                        : ''}
                    </p>
                    {bcastResult.idempotentHint && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        {bcastResult.idempotentHint}
                      </p>
                    )}
                    {bcastResult.failures && bcastResult.failures.length > 0 && (
                      <div className="max-h-40 overflow-y-auto text-xs">
                        {bcastResult.failures.map((f, i) => (
                          <div
                            key={`${f.userId ?? i}`}
                            className="flex justify-between gap-2 py-0.5"
                          >
                            <span className="font-mono text-muted-foreground">
                              {f.phone ?? '-'}
                            </span>
                            <span className="text-destructive">
                              {codeLabel(ERROR_LABEL_KEYS, f.error, t)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <ConfirmDialogRenderer />
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
