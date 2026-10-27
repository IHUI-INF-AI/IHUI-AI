// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useMutation } from '@tanstack/react-query'
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
import {
  BASE,
  CATEGORY_LABELS,
  PHONE_RE,
  TEMPLATE_KEYS,
  api,
  errorLabel,
  normalizePhoneInput,
  parseDryRun,
  providerLabel,
  templateLabel,
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

function reviewSuffix(row: SmsTemplateRow | undefined): string {
  if (!row) return ''
  if (!row.templateId) return ' · 未回填'
  if (row.reviewStatus === 'rejected') return ' · 审核未通过'
  if (row.reviewStatus === 'pending') return ' · 审核中'
  if (row.reviewStatus === 'approved') return ' · 已生效'
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
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {TEMPLATE_KEYS[category].map((key) => {
          const row = templates.find((t) => t.category === category && t.key === key)
          return (
            <SelectItem key={key} value={key}>
              {templateLabel(key)}
              {reviewSuffix(row)}
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
  return (
    <Select value={value} onValueChange={(v) => onChange(v as SmsCategory)}>
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="notice">{CATEGORY_LABELS.notice}</SelectItem>
        <SelectItem value="marketing">{CATEGORY_LABELS.marketing}</SelectItem>
      </SelectContent>
    </Select>
  )
}

export function SendPanel({ status }: { status: SmsStatus }) {
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
      api<SmsSendResponse>(`${BASE}/send`, {
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
      api<SmsBroadcastResponse>(`${BASE}/broadcast`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: (result) => {
      setBcastResult(result)
      if (!result.dryRun) broadcastRequestIdRef.current = null
      if (result.dryRun) toast.success(`预演完成:命中 ${result.total} 个号码`)
      else toast.success(`群发完成:成功 ${result.sent ?? 0} / 失败 ${result.failed ?? 0}`)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function submitSend(e: React.FormEvent) {
    e.preventDefault()
    const phone = normalizePhoneInput(form.phone)
    if (!PHONE_RE.test(phone)) {
      toast.error('手机号格式不正确(支持 13800000000 / +8613800000000)')
      return
    }
    const content = form.fallbackContent.trim()
    if (content && content.length > 35) {
      toast.error('阿里云兜底正文不能超过 35 字(变量长度上限)')
      return
    }
    if (marketingOff && form.category === 'marketing' && !form.dryRun) {
      toast.error('营销总开关已关闭,营销短信仅可预演')
      return
    }
    const tpl = status.templates.find(
      (t) => t.category === form.category && t.key === form.templateKey,
    )
    if (!form.dryRun && !tpl?.templateId && !content) {
      toast.error('该模板尚未回填 ID,真发需要先回填或填写兜底正文走阿里云通道')
      return
    }
    if (!form.dryRun && tpl?.reviewStatus === 'rejected' && !content) {
      toast.error('该模板腾讯审核未通过,请在兜底正文填写文案后重试')
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
      toast.error('阿里云兜底正文不能超过 35 字(变量长度上限)')
      return
    }
    if (!bcast.dryRun && bcast.confirm.trim() !== requiredConfirm()) {
      toast.error(`真发需要输入确认词 ${requiredConfirm()}`)
      return
    }
    if (marketingOff && bcast.category === 'marketing' && !bcast.dryRun) {
      toast.error('营销总开关已关闭,营销短信仅可预演')
      return
    }
    const tpl = status.templates.find(
      (t) => t.category === bcast.category && t.key === bcast.templateKey,
    )
    if (!bcast.dryRun && !tpl?.templateId && !content) {
      toast.error('该模板尚未回填 ID,真发需要先回填或填写兜底正文走阿里云通道')
      return
    }
    if (!bcast.dryRun && tpl?.reviewStatus === 'rejected' && !content) {
      toast.error('该模板腾讯审核未通过,请在兜底正文填写文案后重试')
      return
    }
    const limit = Number(bcast.limit)
    if (!Number.isInteger(limit) || limit < 1 || limit > status.broadcastLimit) {
      toast.error(`本次数量需为 1–${status.broadcastLimit} 的整数`)
      return
    }
    const excludeDays = Number(bcast.excludeRecentDays)
    if (!Number.isInteger(excludeDays) || excludeDays < 0 || excludeDays > 30) {
      toast.error('跳过天数需为 0–30 的整数')
      return
    }
    if (!bcast.dryRun && excludeDays === 0) {
      const ok = await confirm({
        title: '跳过天数为 0',
        description: '本次群发不会排除近期已收到同模板的用户,可能与刚收到过的人重复打扰。确认继续?',
        confirmText: '继续真发',
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

  return (
    <div className="space-y-4">
      {marketingOff && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          营销总开关已关闭(SMS_MARKETING_ENABLED=0):营销类短信仅可预演,真发会被后端统一拦截;
          通知类短信不受影响。
        </p>
      )}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">单发</CardTitle>
            <CardDescription>客服补偿与联调使用,默认预演不消耗额度。</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={submitSend}>
              <div className="space-y-1">
                <Label htmlFor="send-phone">手机号</Label>
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
                  <Label>用途</Label>
                  <CategorySelect
                    value={form.category}
                    onChange={(category) =>
                      setForm({ ...form, category, templateKey: firstKey(category) })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>模板</Label>
                  <TemplateSelect
                    category={form.category}
                    value={form.templateKey}
                    onChange={(templateKey) => setForm({ ...form, templateKey })}
                    templates={status.templates}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="send-fallback">兜底正文(可选)</Label>
                <Textarea
                  id="send-fallback"
                  rows={2}
                  value={form.fallbackContent}
                  onChange={(e) => setForm({ ...form, fallbackContent: e.target.value })}
                  placeholder="腾讯模板未过审时回落阿里云通知模板使用,≤35 字"
                />
                <p className="text-xs text-muted-foreground">
                  {form.fallbackContent.trim().length}/35 · 腾讯已过审时不会使用
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id="send-dry-run"
                    checked={form.dryRun}
                    onCheckedChange={(dryRun) => setForm({ ...form, dryRun })}
                  />
                  <Label htmlFor="send-dry-run">预演(不真发)</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="send-skip-rate"
                    checked={form.skipRateLimit}
                    onCheckedChange={(skipRateLimit) => setForm({ ...form, skipRateLimit })}
                  />
                  <Label htmlFor="send-skip-rate">跳过单号频控</Label>
                </div>
              </div>

              <Button type="submit" size="sm" disabled={sendMut.isPending || sendBlocked}>
                {sendMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                发送
              </Button>
            </form>

            {sendResult && (
              <div className="mt-3 rounded-md border p-3 text-sm">
                {dryRunView ? (
                  <p>
                    预演通过:通道解析为
                    <Badge variant="secondary" className="mx-1">
                      {providerLabel(dryRunView.channel)}
                    </Badge>
                    未消耗额度。
                  </p>
                ) : sendResult.result.sent ? (
                  <p className="text-emerald-600">
                    发送成功 · 通道 {providerLabel(sendResult.result.provider ?? '-')} · 模板{' '}
                    {sendResult.result.templateId ?? '-'}
                  </p>
                ) : (
                  <p className="text-destructive">发送失败:{errorLabel(sendResult.result.error)}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">群发</CardTitle>
            <CardDescription>
              面向全量用户,按注册时间正序取前 N 个有手机号的号码;默认跳过近{' '}
              {status.broadcastExcludeRecentDays}{' '}
              天已成功收到同一模板的用户,让后续批次自然向后推进。 单次上限 {status.broadcastLimit}{' '}
              条。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={submitBroadcast}>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>用途</Label>
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
                  <Label>模板</Label>
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
                  <Label htmlFor="bcast-limit">本次数量</Label>
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
                  <Label htmlFor="bcast-exclude">跳过近 N 天已收</Label>
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
                  <p className="text-xs text-muted-foreground">0 = 不跳过</p>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="bcast-fallback">兜底正文(可选)</Label>
                  <Input
                    id="bcast-fallback"
                    value={bcast.fallbackContent}
                    onChange={(e) => setBcast({ ...bcast, fallbackContent: e.target.value })}
                    placeholder="≤35 字"
                    maxLength={35}
                  />
                </div>
              </div>

              {bcast.category === 'marketing' && (
                <p className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                  营销类受退订黑名单、单号 2 条/日与 4 条/月、全局日上限
                  {status.compliance.marketingGlobalDailyCap} 条、以及
                  {status.compliance.marketingSendWindow} 时段限制。
                </p>
              )}

              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id="bcast-dry-run"
                    checked={bcast.dryRun}
                    onCheckedChange={(dryRun) => setBcast({ ...bcast, dryRun })}
                  />
                  <Label htmlFor="bcast-dry-run">预演(不真发)</Label>
                </div>
              </div>

              {!bcast.dryRun && (
                <div className="space-y-1">
                  <Label htmlFor="bcast-confirm">
                    确认词(输入 <code className="font-mono">{requiredConfirm()}</code> 才会真发)
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
                    填入确认词
                  </button>
                </div>
              )}

              <Button type="submit" size="sm" disabled={bcastMut.isPending || bcastBlocked}>
                {bcastMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                执行群发
              </Button>
            </form>

            {bcastResult && (
              <div className="mt-3 space-y-2 rounded-md border p-3 text-sm">
                {bcastResult.dryRun ? (
                  <>
                    <p>
                      预演:命中 {bcastResult.total} 个号码 · 通道{' '}
                      {providerLabel(bcastResult.channel ?? '-')} · 模板{' '}
                      {bcastResult.templateId ?? '-'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      范围内 {bcastResult.scopeTotal ?? '-'} 个 · 跳过近{' '}
                      {bcastResult.excludeRecentDays ?? 0} 天已收 {bcastResult.excludedRecent ?? 0}{' '}
                      个 · 可发 {bcastResult.eligible ?? '-'} 个
                      {(bcastResult.targetOffset ?? 0) > 0
                        ? ` · 起始偏移 ${bcastResult.targetOffset}`
                        : ''}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      样本号码:{bcastResult.samplePhones?.join('、') || '-'}
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      共 {bcastResult.total} 条 · 成功{' '}
                      <span className="font-medium text-emerald-600">{bcastResult.sent ?? 0}</span>{' '}
                      · 失败{' '}
                      <span className="font-medium text-destructive">
                        {bcastResult.failed ?? 0}
                      </span>{' '}
                      · 拦截 {bcastResult.suppressed ?? 0}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      范围内 {bcastResult.scopeTotal ?? '-'} 个 · 跳过近{' '}
                      {bcastResult.excludeRecentDays ?? 0} 天已收 {bcastResult.excludedRecent ?? 0}{' '}
                      个 · 可发 {bcastResult.eligible ?? '-'} 个
                      {(bcastResult.targetOffset ?? 0) > 0
                        ? ` · 起始偏移 ${bcastResult.targetOffset}`
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
                            <span className="text-destructive">{errorLabel(f.error)}</span>
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
