// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// 平台特有:连接器授权详情页(D17)。
// 刻意**只读** —— 配置/同步/删除的能力只在 /connectors 那一处实现(§3 禁止端内重复实现),
// 本页负责把"授权到哪、能读什么、读过哪些文档"讲清楚,并回链到那一页完成动作。

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'

import { formatShortDateTime } from '@/lib/date-utils'
import { ViewMoreLink } from '@/components/common/view-more-link'
import { MARKETS, ecosystemHubHref } from '@/components/ecosystem/expert-packs'
import { useConnectors } from '@/components/ecosystem/use-ecosystem-overview'

/** 连接器类型对应的展示名:复用 connectors 词表里既有的四个键(封闭集,不扩) */
const CONNECTOR_TYPE_KEYS = ['yuque', 'feishu', 'wecom', 'dingtalk'] as const

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-right text-xs">{value}</span>
    </div>
  )
}

export default function ConnectorAuthDetailPageClient() {
  const t = useTranslations('ecosystem')
  const tc = useTranslations('connectors')
  const more = useTranslations('common')
  const locale = useLocale()
  const params = useParams<{ key?: string | string[] }>()
  const { status, entries } = useConnectors()

  const raw = Array.isArray(params.key) ? params.key[0] : params.key
  let connectorKey = raw ?? ''
  try {
    connectorKey = decodeURIComponent(connectorKey)
  } catch {
    /* 畸形百分号编码退回原值:坏 URL 不该崩整页 */
  }
  const entry = entries.find((e) => e.key === connectorKey)

  if (status === 'pending') {
    return <p className="mx-auto w-full max-w-3xl px-4 py-10 text-xs text-muted-foreground">{tc('loading')}</p>
  }
  if (status === 'failed') {
    return (
      <p className="mx-auto w-full max-w-3xl px-4 py-10 text-xs text-muted-foreground">
        {tc('loadFailed')}
      </p>
    )
  }
  if (!entry) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10 text-center">
        <p className="text-sm text-muted-foreground">{t('connectorNotFound')}</p>
        <Link
          href={MARKETS.connectors.href}
          className="mt-3 inline-flex items-center rounded-md bg-muted px-3 py-1.5 text-xs transition-colors hover:bg-accent"
        >
          <span>{tc('title')}</span>
        </Link>
      </div>
    )
  }

  const typeKey = (CONNECTOR_TYPE_KEYS as readonly string[]).includes(entry.type)
    ? entry.type
    : undefined
  const typeLabel = typeKey ? tc(typeKey) : entry.type
  const docs = entry.sync_items.slice(0, 20)

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <header className="mb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">{entry.name}</h1>
          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded bg-muted px-1 text-[10px] font-semibold leading-none tabular-nums text-muted-foreground">
            {typeLabel}
          </span>
          <ViewMoreLink label={more('more')} href={ecosystemHubHref} className="ms-auto" />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{t('connectorAuthReadonlyHint')}</p>
      </header>

      <section aria-labelledby="connector-auth-state" className="rounded-xl border border-border bg-card p-3">
        <h2 id="connector-auth-state" className="mb-1 text-sm font-medium">
          {t('connectorAuthStateTitle')}
        </h2>
        <Row label={tc('typeLabel')} value={typeLabel} />
        <Row
          label={t('connectorAuthConfigLabel')}
          value={entry.configured ? tc('configured') : tc('notConfigured')}
        />
        <Row
          label={t('connectorAuthEnableLabel')}
          value={entry.enabled ? tc('enabled') : tc('disabled')}
        />
        <Row
          label={tc('lastSyncAt')}
          value={
            entry.last_sync_at
              ? (formatShortDateTime(entry.last_sync_at, locale) || entry.last_sync_at)
              : tc('neverSynced')
          }
        />
        <Row
          label={t('installedAt')}
          value={
            entry.installed_at
              ? (formatShortDateTime(entry.installed_at, locale) || entry.installed_at)
              : '—'
          }
        />
        {entry.last_error ? <Row label={t('lastErrorLabel')} value={entry.last_error} /> : null}
      </section>

      <section
        aria-labelledby="connector-auth-scope"
        className="mt-4 rounded-xl border border-border bg-card p-3"
      >
        <h2 id="connector-auth-scope" className="mb-1 text-sm font-medium">
          {t('connectorAuthScopeTitle')}
        </h2>
        <ul className="flex flex-col gap-1">
          <li className="flex items-center gap-2 text-xs">
            <span
              className={entry.capabilities.doc_list ? 'text-foreground' : 'text-muted-foreground'}
            >
              {t('capDocList')}
            </span>
            <span className="text-muted-foreground">
              {entry.capabilities.doc_list ? t('capSupported') : t('capUnsupported')}
            </span>
          </li>
          <li className="flex items-center gap-2 text-xs">
            <span
              className={entry.capabilities.fetch_doc ? 'text-foreground' : 'text-muted-foreground'}
            >
              {t('capFetchDoc')}
            </span>
            <span className="text-muted-foreground">
              {entry.capabilities.fetch_doc ? t('capSupported') : t('capUnsupported')}
            </span>
          </li>
        </ul>
      </section>

      <section
        aria-labelledby="connector-auth-docs"
        className="mt-4 rounded-xl border border-border bg-card p-3"
      >
        <div className="mb-1 flex items-center gap-2">
          <h2 id="connector-auth-docs" className="text-sm font-medium">
            {tc('docList')}
          </h2>
          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded bg-muted px-1 text-[10px] font-semibold leading-none tabular-nums text-muted-foreground">
            {entry.sync_items.length}
          </span>
        </div>
        {docs.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('connectorNoDocs')}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {docs.map((doc) => (
              <li key={doc.doc_id} className="truncate text-xs">
                <span>{doc.title}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link
          href={MARKETS.connectors.href}
          className="inline-flex items-center rounded-md bg-muted px-3 py-1.5 text-xs transition-colors hover:bg-accent"
        >
          <span>{t('manageConnectors')}</span>
        </Link>
        <ViewMoreLink label={more('more')} href={ecosystemHubHref} />
      </div>
    </div>
  )
}
