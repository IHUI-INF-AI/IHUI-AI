'use client'

/**
 * 各平台凭据配置引导组件
 * 顶部:平台名称 + 首字母图标 + authType 徽章
 * 中部:PlatformCredentialForm 动态表单
 * 底部:外链"详细教程"+ 折叠"常见问题"
 * 接收 platformId + 受控表单值,纯展示组件(无副作用)
 */

import * as React from 'react'
import { ExternalLink, ChevronDown, HelpCircle, KeyRound, ShieldCheck, Cookie } from 'lucide-react'
import { Badge, Collapsible, CollapsibleTrigger, CollapsibleContent } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import {
  getPlatformSchema,
  PLATFORM_AUTH_TYPE_LABELS,
  type CredentialAuthType,
} from '@/lib/publish/platform-schemas'
import { PlatformCredentialForm } from './PlatformCredentialForm'

interface CredentialGuideProps {
  platformId: string
  value: Record<string, string>
  onChange: (value: Record<string, string>) => void
  disabled?: boolean
}

const AUTH_BADGE_STYLE: Readonly<Record<CredentialAuthType, string>> = {
  api_key: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  oauth: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  browser_cookie: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  none: 'bg-muted text-muted-foreground',
} as const

const AUTH_ICON: Readonly<Record<CredentialAuthType, React.ComponentType<{ className?: string }>>> =
  {
    api_key: KeyRound,
    oauth: ShieldCheck,
    browser_cookie: Cookie,
    none: HelpCircle,
  } as const

const FAQ_ITEMS: readonly { q: string; a: string }[] = [
  {
    q: 'Cookie 过期了怎么办?',
    a: 'Cookie 有效期 7-30 天,过期后重新登录平台官网,按 4 步教程复制新 Cookie,然后回到这里编辑账号、替换字段值并保存即可。',
  },
  {
    q: '账号被平台封禁怎么办?',
    a: '凭据验证会失败,但保存的账号不会自动删除。建议先在平台官网申诉解封,解封后凭据通常仍可使用;若账号已注销,请删除本账号配置。',
  },
  {
    q: '发布失败如何排查?',
    a: '在「发布历史」页面查看本次发布任务的错误信息。常见原因:Cookie 过期(重新获取)、内容格式不支持(检查平台支持的内容类型)、触发风控(降低发布频率,间隔 30 分钟以上)。',
  },
  {
    q: '多个账号能配同一平台吗?',
    a: '可以,每个账号用不同的昵称区分。系统支持同一平台配置多个账号,发布任务时可选择具体账号。',
  },
] as const

export function CredentialGuide({ platformId, value, onChange, disabled }: CredentialGuideProps) {
  const schema = getPlatformSchema(platformId)

  if (!schema) {
    return (
      <p className="text-xs text-muted-foreground">暂不支持该平台的可视化配置,请使用 JSON 模式。</p>
    )
  }

  const AuthIcon = AUTH_ICON[schema.authType]

  return (
    <div className="space-y-3">
      {/* 平台头部:图标 + 名称 + authType 徽章 */}
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-sm font-semibold text-primary">
          {schema.platformName.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{schema.platformName}</div>
          <div className="text-xs text-muted-foreground">{schema.helpText}</div>
        </div>
        <Badge className={cn('shrink-0 border-transparent', AUTH_BADGE_STYLE[schema.authType])}>
          <AuthIcon className="mr-1 h-3 w-3" />
          {PLATFORM_AUTH_TYPE_LABELS[schema.authType]}
        </Badge>
      </div>

      {/* 动态凭据表单(含 BrowserAuthHelper 引导) */}
      <PlatformCredentialForm
        platformId={platformId}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />

      {/* 外链详细教程 */}
      <a
        href={schema.setupGuideUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground hover:bg-accent"
      >
        <ExternalLink className="h-3 w-3" />
        详细教程(官网)
      </a>

      {/* 折叠常见问题 */}
      <Collapsible>
        <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <HelpCircle className="h-3 w-3" />
          常见问题
          <ChevronDown className="h-3 w-3" />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 pt-2">
          {FAQ_ITEMS.map((item) => (
            <div key={item.q} className="rounded-md bg-muted/50 p-2">
              <div className="text-xs font-medium text-foreground">{item.q}</div>
              <div className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                {item.a}
              </div>
            </div>
          ))}
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
