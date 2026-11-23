// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import { Loader2, Save, Trash2 } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@ihui/ui-react'
import { SOURCE_TEXT, type PlatformMeta, type TenantApp } from './types'

interface Props {
  app: TenantApp
  meta: PlatformMeta
  busy: boolean
  secret: string
  onPatch: (patch: Partial<TenantApp>) => void
  onSecretChange: (value: string) => void
  onSave: () => void
  onRemove: () => void
}

export default function TenantAppCard({
  app,
  meta,
  busy,
  secret,
  onPatch,
  onSecretChange,
  onSave,
  onRemove,
}: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-body">
          <span>{meta.label}</span>
          <span className="text-label font-normal text-muted-foreground">
            {SOURCE_TEXT[app.source]}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Input
          value={app.appId}
          onChange={(e) => onPatch({ appId: e.target.value })}
          placeholder={meta.appIdLabel}
          aria-label={`${meta.label} ${meta.appIdLabel}`}
        />
        <Input
          type="password"
          value={secret}
          onChange={(e) => onSecretChange(e.target.value)}
          placeholder={app.configured ? `已配置（${app.appSecretMasked}），留空沿用` : 'App Secret'}
          aria-label={`${meta.label} App Secret`}
        />
        {meta.extra.map((field) => (
          <Input
            key={field.key}
            value={app.extra[field.key] ?? ''}
            onChange={(e) => onPatch({ extra: { ...app.extra, [field.key]: e.target.value } })}
            placeholder={field.label}
            aria-label={`${meta.label} ${field.label}`}
          />
        ))}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button size="sm" onClick={onSave} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span>保存</span>
          </Button>
          <Button size="sm" variant="outline" onClick={() => onPatch({ enabled: !app.enabled })}>
            <span>{app.enabled ? '停用' : '启用'}</span>
          </Button>
          {app.source === 'tenant' && (
            <Button size="sm" variant="outline" onClick={onRemove} disabled={busy}>
              <Trash2 className="h-4 w-4" />
              <span>删除</span>
            </Button>
          )}
          <span className="text-label text-muted-foreground">
            {app.configured ? (app.enabled ? '已启用' : '已停用') : '未配置'}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
