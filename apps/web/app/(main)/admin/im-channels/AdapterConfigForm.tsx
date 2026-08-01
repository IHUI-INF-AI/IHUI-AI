'use client'

import * as React from 'react'
import { Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Switch,
} from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { imChannelsApi } from './im-channels-api'
import type {
  ImAdapterConfig,
  ImAdapterFieldSchema,
  ImAdapterUpsertInput,
  ImPlatformMeta,
} from '@ihui/types'

interface AdapterConfigFormProps {
  platform: ImPlatformMeta
  adapter?: ImAdapterConfig
  onSaved: () => void
}

/** 表单字段值(字符串字段 + boolean switch) */
type FormValues = Record<string, string | boolean>

/** ImAdapterFieldSchema.name 联合类型(从契约层推导) */
type AdapterFieldName = ImAdapterFieldSchema['name']

/** 把已配置 adapter 转成表单初始值 */
function adapterToForm(adapter: ImAdapterConfig | undefined): FormValues {
  return {
    webhookSecret: adapter?.webhookSecret ?? '',
    botToken: adapter?.botToken ?? '',
    appId: adapter?.appId ?? '',
    appSecret: adapter?.appSecret ?? '',
    callbackUrl: adapter?.callbackUrl ?? '',
    useLarkCli: adapter?.useLarkCli ?? false,
  }
}

const FIELD_INPUT_TYPE: Record<ImAdapterFieldSchema['type'], 'text' | 'password' | 'url'> = {
  text: 'text',
  password: 'password',
  url: 'url',
  switch: 'text',
}

export default function AdapterConfigForm({ platform, adapter, onSaved }: AdapterConfigFormProps) {
  const [enabled, setEnabled] = React.useState<boolean>(adapter?.enabled ?? false)
  const [values, setValues] = React.useState<FormValues>(() => adapterToForm(adapter))
  const [saving, setSaving] = React.useState<boolean>(false)
  const [testing, setTesting] = React.useState<boolean>(false)

  // 切换平台时重置表单
  React.useEffect(() => {
    setEnabled(adapter?.enabled ?? false)
    setValues(adapterToForm(adapter))
  }, [platform.platform, adapter])

  const updateField = (name: string, val: string | boolean): void => {
    setValues((prev) => ({ ...prev, [name]: val }))
  }

  const buildUpsertInput = (): ImAdapterUpsertInput => {
    const v = values
    return {
      platform: platform.platform,
      enabled,
      webhookSecret: v.webhookSecret ? String(v.webhookSecret) : undefined,
      botToken: v.botToken ? String(v.botToken) : undefined,
      appId: v.appId ? String(v.appId) : undefined,
      appSecret: v.appSecret ? String(v.appSecret) : undefined,
      callbackUrl: v.callbackUrl ? String(v.callbackUrl) : undefined,
      useLarkCli: Boolean(v.useLarkCli),
    }
  }

  const handleSave = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    // 必填项校验
    for (const f of platform.fields) {
      if (f.required) {
        const val = values[f.name]
        if (f.type === 'switch') {
          if (!Boolean(val)) {
            toast.error(`${f.label} 必须开启`)
            return
          }
        } else if (!val || !String(val).trim()) {
          toast.error(`${f.label} 为必填项`)
          return
        }
      }
    }
    setSaving(true)
    try {
      await imChannelsApi.upsertAdapter(buildUpsertInput())
      toast.success(`${platform.displayName} 适配器已保存`)
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleTestSend = async (): Promise<void> => {
    setTesting(true)
    try {
      const result = await imChannelsApi.sendMessage({
        platform: platform.platform,
        chatId: 'test',
        text: 'ping',
        messageType: 'text',
      })
      if (result.sent) {
        toast.success(`测试消息已发送到 ${platform.displayName}`)
      } else {
        toast.error(`测试发送失败:${result.error ?? '未知错误'}`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '测试发送失败')
    } finally {
      setTesting(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              {platform.icon ? <span aria-hidden className="shrink-0">{platform.icon}</span> : null}
              <span className="truncate" title={platform.displayName}>{platform.displayName}</span>
            </CardTitle>
            <CardDescription className="break-all">
              入站:{platform.inboundFieldType}
              {platform.signatureHeader
                ? ` · 验签 ${platform.signatureHeader}(${platform.signatureEncoding})`
                : ' · 无验签'}
            </CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Label htmlFor="adapter-enabled" className="text-xs text-muted-foreground">
              启用
            </Label>
            <Switch
              id="adapter-enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
              aria-label={`启用 ${platform.displayName}`}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-3">
          {platform.fields.map((f) => {
            const fieldName = f.name as AdapterFieldName
            const val = values[fieldName]
            if (f.type === 'switch') {
              return (
                <div
                  key={f.name}
                  className="flex items-center justify-between gap-3 rounded-md border border-border p-3"
                >
                  <div className="space-y-0.5">
                    <Label className="text-sm">
                      {f.label}
                      {f.required ? <span className="ml-0.5 text-destructive">*</span> : null}
                    </Label>
                    {f.helpText ? (
                      <p className="text-xs text-muted-foreground">{f.helpText}</p>
                    ) : null}
                  </div>
                  <Switch
                    checked={Boolean(val)}
                    onCheckedChange={(c) => updateField(f.name, c)}
                    aria-label={f.label}
                  />
                </div>
              )
            }
            const inputType = FIELD_INPUT_TYPE[f.type]
            return (
              <div key={f.name} className="space-y-1">
                <Label htmlFor={`field-${f.name}`} className="text-sm">
                  {f.label}
                  {f.required ? <span className="ml-0.5 text-destructive">*</span> : null}
                </Label>
                <Input
                  id={`field-${f.name}`}
                  type={inputType}
                  value={typeof val === 'string' ? val : ''}
                  placeholder={f.placeholder}
                  onChange={(e) => updateField(f.name, e.target.value)}
                  autoComplete="off"
                />
                {f.helpText ? <p className="text-xs text-muted-foreground">{f.helpText}</p> : null}
              </div>
            )
          })}

          <div className="flex items-center gap-2 pt-1">
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
              保存配置
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleTestSend}
              disabled={testing || !enabled}
              className={cn(testing && 'opacity-70')}
            >
              {testing ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Send className="mr-1 h-3 w-3" />
              )}
              测试发送
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
