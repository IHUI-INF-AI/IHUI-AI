// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * D158(2026-09-28):命令放行规则面板(审批第四档「批准并生成放行规则」的管理面)。
 *
 * 列出 ai-service 持久层(approval_persistence)里未过期的前缀放行规则,
 * 支持单条撤销(项目自有 confirmDialog,禁用原生 confirm)。数据经
 * @ihui/api-client 的 listApprovalGrants / revokeApprovalGrant 直连 ai-service
 * GET/DELETE /llm/approval-grants(与审批决策回传同一条 ai-service 通道)。
 *
 * 前缀展示用服务端还原的可读形态(`git push`),撤销用原始 cacheKey(\x1f 连接键)
 * 精确删 —— 两者是不同字段,不互转。
 *
 * D159(2026-09-30 立,用户批"三档到底"):同一张面板、同一组 API 加开一个
 * **「网络目标」分节**(kind=network),撤销仍走那条 `revokeApprovalGrant(cacheKey, kind)`
 * —— 票面第 3 条不可漂:"与 D158 已有的 exec_prefix 规则共面板共 API,不得新建第二套
 * 规则存储或第二个面板组件"。所以这里只按 `kind` 把服务端已经返回的行**分组渲染**,
 * 不新开请求、不新开组件、不新开 store。
 */
import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react'
import { listApprovalGrants, revokeApprovalGrant } from '@ihui/api-client'
import type { ApprovalGrant } from '@ihui/api-client'
import { confirmDialog } from '@/components/feedback'

/** 时间展示统一 Intl.DateTimeFormat(AGENTS §4);locale 跟随浏览器。 */
const DATE_FORMAT = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'short',
  timeStyle: 'short',
})

function formatDateTime(value: string | null): string {
  if (!value) return ''
  const ts = Date.parse(value)
  if (Number.isNaN(ts)) return value
  return DATE_FORMAT.format(new Date(ts))
}

export function ApprovedRulesPanel() {
  const t = useTranslations('aiApprovedRules')
  const [grants, setGrants] = React.useState<ApprovalGrant[] | null>(null)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [revokingKey, setRevokingKey] = React.useState<string | null>(null)

  const refresh = React.useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const rows = await listApprovalGrants()
      setGrants(rows)
    } catch (e) {
      setGrants(null)
      setLoadError((e as Error).message || 'load failed')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  const handleRevoke = React.useCallback(
    async (grant: ApprovalGrant) => {
      const ok = await confirmDialog({
        title: t('revokeConfirmTitle'),
        // D159:网络目标那一档问的是"这个 host:port 以后还要不要问",不是"前缀"——
        // 两种 kind 共用一句"前缀「…」"会让用户以为自己撤销的是命令规则。
        content:
          grant.kind === 'network'
            ? t('revokeConfirmContentNetwork', { target: grant.prefix })
            : t('revokeConfirmContent', { prefix: grant.prefix }),
        variant: 'danger',
      })
      if (!ok) return
      setRevokingKey(grant.cacheKey)
      try {
        await revokeApprovalGrant(grant.cacheKey, grant.kind)
        await refresh()
      } catch (e) {
        console.error('[approved-rules-panel] revoke failed', e)
        // 撤销失败必须响:刷新拿到真实状态,失败态由行内错误提示承载
        setLoadError((e as Error).message || 'revoke failed')
      } finally {
        setRevokingKey(null)
      }
    },
    [t, refresh],
  )

  // D159:按 kind 分组(服务端一条 API 返回两种 kind)。**未登记的 kind 单独成组**,
  // 而不是并进前缀那一节 —— 以后再加一档时,并进旧节就会让新规则看起来是旧规则。
  const commandGrants = (grants ?? []).filter((g) => g.kind === 'exec_prefix')
  const networkGrants = (grants ?? []).filter((g) => g.kind === 'network')
  const otherKinds = Array.from(
    new Set(
      (grants ?? [])
        .filter((g) => g.kind !== 'exec_prefix' && g.kind !== 'network')
        .map((g) => g.kind),
    ),
  )
  const sections: ReadonlyArray<{ key: string; titleKey: string | null; rows: ApprovalGrant[] }> =
    [
      { key: 'commands', titleKey: 'sectionCommands', rows: commandGrants },
      { key: 'network', titleKey: 'sectionNetwork', rows: networkGrants },
      // 服务端将来多返回一档时各自成节、标题用 kind 原文 —— 并进旧节就等于
      // 让新规则穿着旧规则的标签出现在面板上(清单腐烂的同一种形状)。
      ...otherKinds.map((kind) => ({
        key: kind,
        titleKey: null,
        rows: (grants ?? []).filter((g) => g.kind === kind),
      })),
    ]

  return (
    <div className="space-y-2" data-testid="approved-rules-panel">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium">{t('title')}</h3>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          data-testid="approved-rules-refresh"
          className="inline-flex h-7 items-center gap-1 rounded-sm border border-border bg-background px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {t('refresh')}
        </button>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{t('description')}</p>

      {loadError && (
        <div
          className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
          data-testid="approved-rules-error"
        >
          {t('loadFailed')}
        </div>
      )}

      {grants !== null && grants.length === 0 && !loadError && (
        <div
          className="rounded-md border border-border bg-muted/30 px-3 py-6 text-center text-xs text-muted-foreground"
          data-testid="approved-rules-empty"
        >
          {t('empty')}
        </div>
      )}

      {grants !== null && grants.length > 0 && (
        <div className="space-y-3" data-testid="approved-rules-groups">
          {sections
            .filter((section) => section.rows.length > 0)
            .map((section) => (
              <section
                key={section.key}
                data-testid={`approved-rules-section-${section.key}`}
              >
                <h4 className="mb-1 text-xs font-medium text-muted-foreground">
                  {section.titleKey ? t(section.titleKey) : section.key}
                </h4>
                <ul className="space-y-1.5">
                  {section.rows.map((grant) => (
                    <li
                      key={grant.cacheKey}
                      className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <code className="block truncate font-mono text-xs font-medium">
                          {grant.prefix}
                        </code>
                        <div className="mt-0.5 flex flex-wrap gap-x-3 text-[10px] text-muted-foreground">
                          <span>
                            {t('createdAtHeader')}: {formatDateTime(grant.createdAt)}
                          </span>
                          <span>
                            {t('expiresAtHeader')}:{' '}
                            {grant.expiresAt ? formatDateTime(grant.expiresAt) : t('neverExpires')}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleRevoke(grant)}
                        disabled={revokingKey !== null}
                        data-testid={`approved-rules-revoke-${grant.cacheKey}`}
                        className="inline-flex h-7 shrink-0 items-center gap-1 rounded-sm border border-border bg-background px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                      >
                        {revokingKey === grant.cacheKey ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        {t('revoke')}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
        </div>
      )}
    </div>
  )
}

export default ApprovedRulesPanel
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
