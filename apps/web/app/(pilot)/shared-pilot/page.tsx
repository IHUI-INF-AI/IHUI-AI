// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import { useCallback, useState } from 'react'
import { useTheme } from '@/hooks/use-theme'
import {
  AgreementScreen,
  AnnouncementDetailScreen,
  ConversationHistoryScreen,
  IcpRecordScreen,
  type AnnouncementDetailItem,
  type ConversationHistoryGroup,
} from '@ihui/rn-app/pilot'
import type { TFunction } from '@ihui/types'
import zhCN from '@ihui/i18n/messages/mobile-rn/zh-CN.json'

/**
 * 共享屏 web 承载试点页(2026-10-28)。
 *
 * 三屏全部来自 `@ihui/rn-app/pilot`(packages/app 源码),web 侧只做两件事:
 * 注入词表与回调。屏内 RN 原语由 next.config 的 react-native → react-native-web
 * 别名承载,图标由 lucide-react-native → lucide-react 承载。
 *
 * 本页是"web 收编"的机制证明:同一份共享屏源码在 web / RN / 小程序三端渲染。
 */

const PILOT_TABS = [
  { key: 'icp', label: 'ICP record' },
  { key: 'announcement', label: 'Announcement detail' },
  { key: 'agreement', label: 'Agreement' },
  { key: 'history', label: 'Conversation history' },
] as const

type PilotKey = (typeof PILOT_TABS)[number]['key']

const ANNOUNCEMENT: AnnouncementDetailItem = {
  id: 'shared-pilot-1',
  title: 'One shared screen, three ends',
  author: 'IHUI AI',
  publishTime: '2026-10-28',
  content:
    'This paragraph is rendered by packages/app/src/features/announcement-detail/AnnouncementDetailScreen.tsx on the web, using react-native-web primitives.',
}

const HISTORY_FIXTURE: ConversationHistoryGroup[] = [
  {
    key: 'today',
    label: '今天',
    items: [
      {
        id: 'pilot-history-1',
        title: 'One shared screen, three ends',
        preview: '同一份 ConversationHistoryScreen 在 web / RN / 小程序渲染。',
        timeLabel: '11-05 09:20',
        messageCount: 6,
        pinned: true,
      },
      {
        id: 'pilot-history-2',
        title: 'A2 history thin shell',
        preview: '排序出口与列表 UI 迁到共享屏，端内零平台 API。',
        timeLabel: '11-05 08:10',
        messageCount: 3,
        pinned: false,
      },
    ],
  },
]

function readString(source: unknown, key: string): string | undefined {
  const value = key
    .split('.')
    .reduce<unknown>(
      (acc, part) =>
        acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[part] : undefined,
      source,
    )
  return typeof value === 'string' ? value : undefined
}

const t: TFunction = (key, options) =>
  readString(zhCN, key) ?? (typeof options?.fallback === 'string' ? options.fallback : key)

const noop = () => {}

const tt = (key: string, fallback: string) => readString(zhCN, key) ?? fallback

export default function SharedPilotPage() {
  const { resolvedTheme } = useTheme()
  const [active, setActive] = useState<PilotKey>('icp')
  const select = useCallback((key: PilotKey) => () => setActive(key), [])

  return (
    <main className="mx-auto w-full max-w-3xl space-y-4 px-6 py-8">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-foreground">Shared screen · web pilot</h1>
        <p className="text-body text-muted-foreground">
          Rendered directly from packages/app through react-native-web.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {PILOT_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={select(tab.key)}
            aria-pressed={active === tab.key}
            className={`rounded-sm border px-3 py-1.5 text-body transition-colors ${
              active === tab.key
                ? 'border-primary/40 bg-muted text-foreground'
                : 'border-border text-muted-foreground hover:bg-muted/60'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <section className="flex h-[640px] flex-col overflow-hidden rounded-lg border border-border">
        {active === 'icp' && (
          <IcpRecordScreen
            t={t}
            onBack={noop}
            colorScheme={resolvedTheme === 'dark' ? 'dark' : 'light'}
          />
        )}
        {active === 'announcement' && (
          <AnnouncementDetailScreen
            t={t}
            item={ANNOUNCEMENT}
            loading={false}
            error=""
            onBack={noop}
            colorScheme={resolvedTheme === 'dark' ? 'dark' : 'light'}
          />
        )}
        {active === 'agreement' && (
          <AgreementScreen
            t={t}
            onBack={noop}
            colorScheme={resolvedTheme === 'dark' ? 'dark' : 'light'}
          />
        )}
        {active === 'history' && (
          <ConversationHistoryScreen
            t={t}
            tt={tt}
            groups={HISTORY_FIXTURE}
            itemCount={2}
            loading={false}
            isFiltered={false}
            keyword=""
            onKeywordChange={noop}
            filters={[]}
            activeFilter="all"
            onFilterChange={noop}
            showClearAll
            onClearAll={noop}
            onImport={noop}
            degraded={false}
            onRetry={noop}
            canPin
            onOpen={noop}
            onTogglePin={noop}
            hasMore={false}
            loadingMore={false}
            onLoadMore={noop}
            refreshing={false}
            onRefresh={noop}
            onStartNew={noop}
            colorScheme={resolvedTheme === 'dark' ? 'dark' : 'light'}
          />
        )}
      </section>
    </main>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
