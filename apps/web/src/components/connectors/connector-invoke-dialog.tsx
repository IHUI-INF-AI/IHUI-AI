// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { Loader2, Play, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'

import {
  invokeConnectorOperation,
  type ConnectorEntry,
  type ConnectorInvokeResult,
} from '@ihui/api-client/endpoints/connectors'
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@ihui/ui-react'

import { CAPABILITY_LABEL_KEY, requiredParamNames } from './connector-utils'

interface Props {
  entry: ConnectorEntry | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** 通用操作调用面板:按操作清单发起 list/search/fetch/action 调用。 */
export function ConnectorInvokeDialog({ entry, open, onOpenChange }: Props) {
  const t = useTranslations('connectors')
  const [operationId, setOperationId] = React.useState('')
  const [paramsText, setParamsText] = React.useState('{}')
  const [confirm, setConfirm] = React.useState(false)
  const [running, setRunning] = React.useState(false)
  const [result, setResult] = React.useState<ConnectorInvokeResult | null>(null)
  const [error, setError] = React.useState('')

  const operations = entry?.operations ?? []
  const operation = operations.find((op) => op.id === operationId) ?? operations[0]
  const isWrite = operation?.capability === 'action'
  const required = requiredParamNames(operation)

  React.useEffect(() => {
    if (!open) return
    setResult(null)
    setError('')
    setConfirm(false)
    setParamsText('{}')
    setOperationId(entry?.operations[0]?.id ?? '')
  }, [open, entry])

  const run = async () => {
    if (!entry || !operation || running) return
    // 操作级停用门(2026-11-24):服务端 custom_http.invoke() 已对 disabled=True 拒执,
    // 这里前置拦截,避免让用户打一次注定失败的请求再读报错;文案复用既有 disabled 键,
    // 不新造第五语言。服务端门仍是真相源(绕过 UI 直接调 API 照样被拒)。
    if (operation.disabled) {
      toast.error(t('disabled'))
      return
    }
    let params: Record<string, unknown> = {}
    if (paramsText.trim()) {
      try {
        const parsed: unknown = JSON.parse(paramsText)
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          toast.error(t('invokeFailed'))
          return
        }
        params = parsed as Record<string, unknown>
      } catch {
        toast.error(t('invokeFailed'))
        return
      }
    }
    if (isWrite && !confirm) {
      toast.error(t('confirmWrite'))
      return
    }
    setRunning(true)
    setError('')
    try {
      const response = await invokeConnectorOperation(entry.key, operation.id, params, confirm)
      if (response.success && response.data) {
        setResult(response.data)
        toast.success(t('invokeSuccess'))
      } else {
        setError(response.error ?? t('invokeFailed'))
        toast.error(response.error ?? t('invokeFailed'))
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t('invokeFailed')
      setError(message)
      toast.error(message)
    } finally {
      setRunning(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('invokeTitle')}</DialogTitle>
          <DialogDescription>{entry?.name}</DialogDescription>
        </DialogHeader>

        {operations.length === 0 ? (
          <p className="text-label text-muted-foreground">{t('noOperations')}</p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-label text-muted-foreground">{t('operationLabel')}</Label>
              <Select value={operation?.id ?? ''} onValueChange={setOperationId}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {operations.map((op) => (
                    <SelectItem key={op.id} value={op.id}>
                      {op.name || op.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {operation && (
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <Badge variant={isWrite ? 'destructive' : 'secondary'}>
                    {t(CAPABILITY_LABEL_KEY[operation.capability])}
                  </Badge>
                  {operation.disabled && (
                    <Badge variant="destructive">{t('disabled')}</Badge>
                  )}
                  <span>
                    {operation.method} {operation.path}
                  </span>
                  {required.length > 0 && (
                    <span>{t('requiredParams', { params: required.join(', ') })}</span>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-label text-muted-foreground">{t('paramsLabel')}</Label>
              <textarea
                value={paramsText}
                onChange={(e) => setParamsText(e.target.value)}
                spellCheck={false}
                className="h-28 w-full resize-y rounded-md border bg-background p-2 font-mono text-[11px] leading-relaxed outline-none focus:border-stroke-focus"
              />
              <p className="text-[11px] text-muted-foreground">{t.raw('paramsHint')}</p>
            </div>

            {isWrite && (
              <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/10 p-3">
                <p className="flex items-center gap-1.5 text-label text-destructive">
                  <ShieldAlert className="h-4 w-4" />
                  {t('writeWarning')}
                </p>
                <div className="flex items-center justify-between gap-3">
                  <Label className="text-label">{t('confirmWrite')}</Label>
                  <Switch checked={confirm} onCheckedChange={setConfirm} />
                </div>
              </div>
            )}

            {error && (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-label text-destructive">
                {error}
              </p>
            )}

            {result && (
              <div className="space-y-1.5">
                <Label className="text-label text-muted-foreground">{t('resultTitle')}</Label>
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-2 text-[11px] leading-relaxed">
                  {result.content || JSON.stringify(result.data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button
            onClick={() => void run()}
            disabled={running || operations.length === 0 || !!operation?.disabled}
          >
            {running ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="mr-1.5 h-3.5 w-3.5" />
            )}
            {running ? t('running') : t('run')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
