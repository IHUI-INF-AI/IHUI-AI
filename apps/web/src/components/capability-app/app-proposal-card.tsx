// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Loader2, Sparkles } from 'lucide-react'

import {
  CAPABILITY_APP_ID_RE,
  validateCapabilityApp,
  type CapabilityAppRecord,
  type CapabilityAppSlot,
} from '@ihui/types'
import { toast } from '@/components/common'
import { saveCapabilityApp } from '@ihui/api-client'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import { CapabilityAppIcon, CapabilityAppRenderer } from './app-renderer'

/**
 * 对话内「应用提案卡」(2026-11-13 立)
 *
 * 链路:模型在回答里输出一个 ```capability-app 围栏(纯 JSON)→ 本卡片就地渲染预览 →
 * 用户点「创建并打开」→ 落库 → 立即跳到 /apps/<id>。
 *
 * 这是「AI 造应用」的主入口:
 *  - 不依赖专用 Agent 工具,任何模型只要按约定产出 JSON 就能用;
 *  - 预览与正式页面共用 CapabilityAppRenderer,不存在两套渲染;
 *  - 校验失败不隐藏,逐条把 path/code 摆出来(模型也能据此自我修正)。
 */

/** 把 title 归一成合法 id(模型常漏 id 或写成中文)。 */
function deriveAppId(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  if (base && /^[a-z]/.test(base)) return base
  return `app-${Date.now().toString(36)}`
}

const SLOT_FALLBACK: CapabilityAppSlot = 'page'

/** slot → 文案键的静态映射(刻意不拼字符串:next-intl 的类型化键只认字面量)。 */
const SLOT_KEY = {
  page: 'slotPage',
  'sidebar-right': 'slotSidebarRight',
  'sidebar-left': 'slotSidebarLeft',
  'chat-dock': 'slotChatDock',
  'shell-overlay': 'slotShellOverlay',
} as const

function prepareDraft(
  raw: unknown,
): { ok: true; app: CapabilityAppRecord } | { ok: false; issues: string[] } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, issues: ['$: 应用定义必须是 JSON 对象'] }
  }
  const input = { ...(raw as Record<string, unknown>) }
  if (typeof input['id'] !== 'string' || !CAPABILITY_APP_ID_RE.test(input['id'])) {
    const title = typeof input['title'] === 'string' ? input['title'] : ''
    input['id'] = deriveAppId(title)
  }
  input['source'] = 'ai'
  if (typeof input['slot'] !== 'string') input['slot'] = SLOT_FALLBACK
  if (typeof input['version'] !== 'string') input['version'] = '1.0.0'

  const validation = validateCapabilityApp(input)
  if (!validation.ok) {
    return { ok: false, issues: validation.errors.map((item) => `${item.path}: ${item.message}`) }
  }
  const now = new Date().toISOString()
  return { ok: true, app: { ...validation.value, createdAt: now, updatedAt: now } }
}

export function CapabilityAppProposalCard({ json }: { json: string }) {
  const router = useRouter()
  const t = useTranslations('apps')
  const [saving, setSaving] = React.useState(false)
  const [preview, setPreview] = React.useState(false)

  const parsed = React.useMemo(() => {
    try {
      return prepareDraft(JSON.parse(json))
    } catch (err) {
      return {
        ok: false as const,
        issues: [`$: ${err instanceof Error ? err.message : t('invalidJson')}`],
      }
    }
  }, [json, t])

  if (!parsed.ok) {
    return (
      <div className="font-[weight:inherit] my-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-label text-amber-700 dark:text-amber-300">
        <div className="mb-1 font-medium">{t('invalidTitle')}</div>
        <ul className="list-disc space-y-0.5 pl-4">
          {parsed.issues.slice(0, 4).map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </div>
    )
  }

  const app = parsed.app

  const handleCreate = async () => {
    setSaving(true)
    try {
      const saved = await saveCapabilityApp(app)
      toast.success(t('savedToast'))
      router.push(`/apps/${encodeURIComponent(saved.id)}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="my-2 overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted">
          <CapabilityAppIcon name={app.icon} className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-body font-medium">{app.title}</div>
          <div className="truncate text-[11px] text-muted-foreground">
            {app.spec.blocks.length} {t('blocks')} · {t(SLOT_KEY[app.slot])}
          </div>
        </div>
        <Sparkles className="h-4 w-4 text-primary" aria-hidden />
      </div>
      {app.description ? (
        <p className="font-[weight:inherit] px-3 py-2 text-label text-muted-foreground">{app.description}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 border-t border-border px-3 py-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleCreate()}
          className="inline-flex items-center gap-1.5 rounded-sm bg-cta px-3 py-1.5 text-body font-medium text-cta-foreground hover:bg-cta/90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
          {saving ? t('creating') : t('createAndOpen')}
        </button>
        <button
          type="button"
          onClick={() => setPreview((value) => !value)}
          className="font-[weight:inherit] inline-flex items-center gap-1 rounded-sm border border-border px-2.5 py-1.5 text-body hover:bg-muted"
          aria-expanded={preview}
        >
          {t('preview')}
          <ChevronDown
            className={cn('h-3.5 w-3.5 transition-transform', preview && 'rotate-180')}
            aria-hidden
          />
        </button>
      </div>
      {preview ? (
        <div className="border-t border-border px-3 py-3">
          <CapabilityAppRenderer app={app} />
        </div>
      ) : null}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
