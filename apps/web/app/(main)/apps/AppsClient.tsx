// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

import {
  CAPABILITY_APP_CALLS,
  CAPABILITY_APP_CALL_NAMES,
  CAPABILITY_APP_SLOTS,
  validateCapabilityApp,
  type CapabilityAppRecord,
  type CapabilityAppSlot,
} from '@ihui/types'
import { cn } from '@/lib/utils'
import { toast } from '@/components/common'
import { useCapabilityApps } from '@/hooks/use-capability-apps'
import { CapabilityAppIcon } from '@/components/capability-app/app-renderer'

/** 新建应用的起始模板:结构合法、可直接保存,也让模型有一个可照抄的形状。 */
const EXAMPLE_SPEC = {
  description:
    '把这段替换成你的应用。data 支持 {"call":"<只读能力>"} 直接取真实数据,块用 from 消费结果。',
  data: {
    recent: { call: 'conversations.recent', args: { limit: '5' } },
  },
  blocks: [
    { kind: 'heading', text: '我的最近会话', level: 2 },
    {
      kind: 'text',
      text: '这是由 AI 生成的声明式页面:零编译、保存即生效,可直接放在侧栏或对话页。',
    },
    {
      kind: 'table',
      from: 'recent',
      valueKey: 'items',
      columns: [
        { key: 'title', label: '标题' },
        { key: 'messageCount', label: '消息数' },
        { key: 'updatedAt', label: '更新时间' },
      ],
    },
    {
      kind: 'button',
      label: '让 AI 继续完善',
      variant: 'primary',
      action: { type: 'agent', prompt: '请基于当前应用继续完善：「我的最近会话」' },
    },
  ],
}

/** slot → 文案键(字面量映射,避免 next-intl 类型化键被拼接字符串绕过)。 */
const SLOT_KEY = {
  page: 'slotPage',
  'sidebar-right': 'slotSidebarRight',
  'sidebar-left': 'slotSidebarLeft',
  'chat-dock': 'slotChatDock',
  'shell-overlay': 'slotShellOverlay',
} as const

/** 可用只读能力清单:从共享词表生成,提示词与校验器/服务端三者不会漂移。 */
const CALL_PROMPT = CAPABILITY_APP_CALL_NAMES.map((name) => {
  const spec = CAPABILITY_APP_CALLS[name]
  const params =
    spec.params.length === 0
      ? '无参数'
      : spec.params
          .map((param) =>
            param.min !== undefined && param.max !== undefined
              ? `${param.key}(${param.kind}, ${param.min}-${param.max})`
              : `${param.key}(${param.kind})`,
          )
          .join(' / ')
  return `- ${name}:${spec.summary};参数:${params}`
}).join('\n')

/** 给模型的复制提示词:与校验器同一份词表,减少「生成完保存失败」的来回。 */
const AI_PROMPT = [
  '请为我生成一个能直接在 IHUI 里显示和使用的声明式应用。',
  '输出格式:只输出一个 ```capability-app 代码围栏,围栏内是 JSON,不要额外解释。示例:',
  '```capability-app',
  '{ "id": "my-app", "title": "我的应用", "slot": "page", "version": "1.0.0", "source": "ai", "spec": { "blocks": [] } }',
  '```',
  '字段:id(小写字母开头、只含字母数字和连字符)、title、description、icon、slot、version("1.0.0")、source("ai")、spec。',
  `slot 取值:${CAPABILITY_APP_SLOTS.join(' / ')}。`,
  'spec.blocks 每项必须带 kind,可用 kind:heading/text/callout/badge/divider/keyValue/stat/progress/list/table/code/image/button/chart/tabs/columns/form。',
  'spec.data 可选,键名即 blocks 里的 from;每项二选一:{"path":"/api/站内接口"} 或 {"call":"<只读能力名>","args":{...}}。',
  '按钮与表单的 action 可用:{type:"navigate",path:"/站内路径"}、{type:"copy",text}、{type:"agent",prompt}、{type:"refresh"}、{type:"submit",prompt?}、{type:"tool",call:"<只读能力名>",args:{...},into:"<绑定键>"}。',
  'into 会把调用结果写回该绑定键,后续块的 from 可直接引用它来展示真实数据(优先用 call 取真实数据,不要写死数字)。',
  '可用的只读能力(只能用这些名字,写错会保存失败):',
  CALL_PROMPT,
  '不要输出任何脚本、命令、eval、innerHTML 之类字段,也不要用自定义 kind。',
].join('\n')

export function AppsClient() {
  const t = useTranslations('apps')
  const { apps, authenticated, loading, error, save, remove } = useCapabilityApps()
  const [creating, setCreating] = React.useState(false)
  const [title, setTitle] = React.useState('')
  const [appId, setAppId] = React.useState('')
  const [slot, setSlot] = React.useState<CapabilityAppSlot>('page')
  const [json, setJson] = React.useState(() => JSON.stringify(EXAMPLE_SPEC, null, 2))
  const [issues, setIssues] = React.useState<string[]>([])
  const [saving, setSaving] = React.useState(false)

  const resetForm = React.useCallback(() => {
    setTitle('')
    setAppId('')
    setSlot('page')
    setJson(JSON.stringify(EXAMPLE_SPEC, null, 2))
    setIssues([])
  }, [])

  const handleCreate = React.useCallback(async () => {
    setIssues([])
    let specRaw: unknown
    try {
      specRaw = JSON.parse(json)
    } catch (err) {
      setIssues([`spec 不是合法 JSON:${err instanceof Error ? err.message : '解析失败'}`])
      return
    }
    const draft = {
      id: appId.trim(),
      title: title.trim(),
      slot,
      version: '1.0.0',
      source: 'user',
      spec: specRaw,
    }
    const validation = validateCapabilityApp(draft)
    if (!validation.ok) {
      setIssues(validation.errors.map((item) => `${item.path}: ${item.message}`))
      return
    }
    setSaving(true)
    try {
      const now = new Date().toISOString()
      const record: CapabilityAppRecord = {
        ...validation.value,
        createdAt: now,
        updatedAt: now,
      }
      await save(record)
      toast.success(t('savedToast'))
      setCreating(false)
      resetForm()
    } catch (err) {
      setIssues([err instanceof Error ? err.message : t('saveFailed')])
    } finally {
      setSaving(false)
    }
  }, [appId, json, resetForm, save, slot, t, title])

  const copyPrompt = React.useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return
    void navigator.clipboard.writeText(AI_PROMPT).then(
      () => toast.success(t('promptCopied')),
      () => toast.error(t('copyFail')),
    )
  }, [t])

  const handleDelete = React.useCallback(
    async (app: CapabilityAppRecord) => {
      const ok = await remove(app.id)
      if (ok) toast.success(t('deletedToast', { title: app.title }))
      else toast.error(t('deleteFailed'))
    },
    [remove, t],
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-[weight:inherit] text-body text-muted-foreground">{t('subtitle')}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={copyPrompt}
            className="font-[weight:inherit] rounded-sm border border-border px-3 py-1.5 text-body hover:bg-muted"
          >
            {t('copyPrompt')}
          </button>
          <button
            type="button"
            onClick={() => setCreating((value) => !value)}
            className="rounded-sm bg-cta px-3 py-1.5 text-body font-medium text-cta-foreground hover:bg-cta/90"
          >
            {creating ? t('collapse') : t('newApp')}
          </button>
        </div>
      </div>

      {creating ? (
        <section className="space-y-3 rounded-lg border border-border bg-card p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="font-[weight:inherit] space-y-1 text-body">
              <span className="font-[weight:inherit] text-label text-muted-foreground">{t('appId')}</span>
              <input
                value={appId}
                onChange={(event) => setAppId(event.target.value)}
                placeholder="my-dashboard"
                className="font-[weight:inherit] w-full rounded-sm border border-border bg-background px-2.5 py-1.5 text-body"
              />
            </label>
            <label className="font-[weight:inherit] space-y-1 text-body">
              <span className="font-[weight:inherit] text-label text-muted-foreground">{t('titleLabel')}</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="我的应用"
                className="font-[weight:inherit] w-full rounded-sm border border-border bg-background px-2.5 py-1.5 text-body"
              />
            </label>
            <label className="font-[weight:inherit] space-y-1 text-body">
              <span className="font-[weight:inherit] text-label text-muted-foreground">{t('slotLabel')}</span>
              <select
                value={slot}
                onChange={(event) => setSlot(event.target.value as CapabilityAppSlot)}
                className="font-[weight:inherit] w-full rounded-sm border border-border bg-background px-2.5 py-1.5 text-body"
              >
                {CAPABILITY_APP_SLOTS.map((item) => (
                  <option key={item} value={item}>
                    {t(SLOT_KEY[item])}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block space-y-1">
            <span className="font-[weight:inherit] text-label text-muted-foreground">{t('specLabel')}</span>
            <textarea
              value={json}
              onChange={(event) => setJson(event.target.value)}
              spellCheck={false}
              className="font-[weight:inherit] min-h-64 w-full rounded-sm border border-border bg-background px-3 py-2 font-mono text-label"
            />
          </label>
          {issues.length > 0 ? (
            <ul className="font-[weight:inherit] space-y-1 rounded-sm border border-red-500/30 bg-red-500/10 px-3 py-2 text-label text-red-700 dark:text-red-300">
              {issues.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          ) : null}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleCreate()}
              className="rounded-sm bg-cta px-3 py-1.5 text-body font-medium text-cta-foreground hover:bg-cta/90 disabled:opacity-50"
            >
              {saving ? t('saving') : t('save')}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="font-[weight:inherit] rounded-sm border border-border px-3 py-1.5 text-body hover:bg-muted"
            >
              {t('reset')}
            </button>
          </div>
        </section>
      ) : null}

      {!authenticated && !loading ? (
        <div className="font-[weight:inherit] rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-body text-amber-700 dark:text-amber-300">
          {t('loginHint')}
        </div>
      ) : null}

      {error ? (
        <div className="font-[weight:inherit] rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-body text-red-700 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {loading ? <div className="font-[weight:inherit] text-body text-muted-foreground">{t('loading')}</div> : null}

      {!loading && apps.length === 0 ? (
        <div className="font-[weight:inherit] rounded-lg border border-dashed border-border px-4 py-8 text-center text-body text-muted-foreground">
          {t('emptyHint')}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {apps.map((app) => (
          <div
            key={app.id}
            className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                <CapabilityAppIcon name={app.icon} className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-body font-medium">{app.title}</div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {app.id} · {t(SLOT_KEY[app.slot])}
                </div>
              </div>
            </div>
            {app.description ? (
              <p className="font-[weight:inherit] line-clamp-2 text-label text-muted-foreground">{app.description}</p>
            ) : null}
            <div className="mt-auto flex items-center gap-2 pt-1">
              <Link
                href={`/apps/${encodeURIComponent(app.id)}`}
                className={cn(
                  'rounded-md bg-cta px-2.5 py-1 text-label font-medium text-cta-foreground',
                  'hover:bg-cta/90',
                )}
              >
                {t('open')}
              </Link>
              <button
                type="button"
                onClick={() => void handleDelete(app)}
                className="font-[weight:inherit] rounded-sm border border-border px-2.5 py-1 text-label hover:bg-muted"
              >
                {t('delete')}
              </button>
              <span className="ml-auto text-[11px] text-muted-foreground">
                {app.source === 'ai' ? t('sourceAi') : t('sourceManual')}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
