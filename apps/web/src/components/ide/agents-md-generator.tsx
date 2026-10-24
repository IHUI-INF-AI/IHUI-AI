// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * D07 残余②:web IDE 空态「一键生成 AGENTS.md」入口(2026-10-24)。
 *
 * 三段式,任何一段都不静默:
 *   1) 生成草稿前必须经 confirmDialog 显式确认;取消 ⇒ 连请求都不发。
 *   2) 草稿只进 textarea,不进文件;写盘前再次确认。
 *   3) 草稿生成失败 / 无 DirectoryHandle / 写盘失败 ⇒ role=alert 明说原因。
 *
 * 文案统一走 `ide.agentsMd` 五语词包(D07 文案迁移),本文件不持中文字面量。
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { FilePlus2, Loader2 } from 'lucide-react'
import { confirmDialog } from '@/components/feedback'
import { saveWorkspaceTextFile } from '@/lib/workspace-file-save'
import { AGENTS_MD_FILENAME, generateAgentsMdDraft } from '@/lib/agents-md-init'
import { cn } from '@/lib/utils'

interface AgentsMdGeneratorProps {
  workspacePath: string
}

export function AgentsMdGenerator({ workspacePath }: AgentsMdGeneratorProps) {
  const t = useTranslations('ide')
  const [draft, setDraft] = React.useState('')
  const [busy, setBusy] = React.useState<'generate' | 'write' | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)

  const handleGenerate = async () => {
    if (busy) return
    const confirmed = await confirmDialog({
      title: t('agentsMd.generateConfirmTitle'),
      content: t('agentsMd.generateConfirmContent'),
    })
    if (!confirmed) return
    setError(null)
    setNotice(null)
    setBusy('generate')
    try {
      const result = await generateAgentsMdDraft(workspacePath, {
        emptyWorkspace: t('agentsMd.errorEmptyWorkspace'),
        requestFailed: t('agentsMd.errorRequestFailed'),
        noDraft: t('agentsMd.errorNoDraft'),
      })
      if (!result.ok || !result.draft) {
        setError([t('agentsMd.generateFailed'), result.error].filter(Boolean).join(': '))
        return
      }
      setDraft(result.draft)
      setNotice(t('agentsMd.draftNotice'))
    } catch (err) {
      setError([t('agentsMd.generateFailed'), (err as Error).message].filter(Boolean).join(': '))
    } finally {
      setBusy(null)
    }
  }

  const handleWrite = async () => {
    if (busy || !draft.trim()) return
    const confirmed = await confirmDialog({
      title: t('agentsMd.writeConfirmTitle'),
      content: t('agentsMd.writeConfirmContent'),
      variant: 'danger',
    })
    if (!confirmed) return
    setError(null)
    setNotice(null)
    setBusy('write')
    try {
      const result = await saveWorkspaceTextFile(AGENTS_MD_FILENAME, draft)
      if (!result.ok) {
        setError(
          [t('agentsMd.writeFailed'), result.message ?? result.reason].filter(Boolean).join(': '),
        )
        return
      }
      setDraft('')
      setNotice(t('agentsMd.written'))
    } catch (err) {
      setError([t('agentsMd.writeFailed'), (err as Error).message].filter(Boolean).join(': '))
    } finally {
      setBusy(null)
    }
  }

  const handleDiscard = () => {
    if (busy) return
    setDraft('')
    setError(null)
    setNotice(null)
  }

  return (
    <div className="w-full rounded-lg border border-border bg-background/70 p-3 text-left">
      <p className="text-xs font-medium text-foreground">{t('agentsMd.title')}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{t('agentsMd.hint')}</p>

      {!draft && (
        <button
          type="button"
          onClick={handleGenerate}
          disabled={busy !== null}
          className={cn(
            'mt-2 flex items-center gap-1.5 rounded-sm border border-border bg-background px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted/40',
            busy !== null && 'cursor-not-allowed opacity-60',
          )}
        >
          {busy === 'generate' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FilePlus2 className="h-3.5 w-3.5" />
          )}
          <span>{busy === 'generate' ? t('agentsMd.generating') : t('agentsMd.generate')}</span>
        </button>
      )}

      {draft && (
        <div className="mt-2 flex flex-col gap-2">
          <label
            htmlFor="agents-md-draft"
            className="text-[11px] font-medium text-muted-foreground"
          >
            {t('agentsMd.draftTitle')}
          </label>
          <textarea
            id="agents-md-draft"
            aria-label={t('agentsMd.draftTitle')}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
            className="h-40 w-full resize-y rounded-sm border border-border bg-background p-2 font-mono text-[11px] text-foreground outline-none focus:border-primary/60"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleWrite}
              disabled={busy !== null || !draft.trim()}
              className={cn(
                'flex items-center gap-1.5 rounded-sm bg-cta px-3 py-1.5 text-xs text-cta-foreground transition-colors hover:bg-cta/90',
                (busy !== null || !draft.trim()) && 'cursor-not-allowed opacity-60',
              )}
            >
              {busy === 'write' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>{busy === 'write' ? t('agentsMd.writing') : t('agentsMd.write')}</span>
            </button>
            <button
              type="button"
              onClick={handleDiscard}
              disabled={busy !== null}
              className="rounded-sm border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t('agentsMd.discard')}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 text-[11px] leading-relaxed text-destructive">
          {error}
        </p>
      )}
      {notice && !error && (
        <p role="status" className="mt-2 text-[11px] text-muted-foreground">
          {notice}
        </p>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
