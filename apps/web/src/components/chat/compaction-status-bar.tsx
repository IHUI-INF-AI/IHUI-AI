// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useChatStore } from '@/stores/chat'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/feedback/Modal'
import { Tooltip } from '@/components/feedback/Tooltip'
import {
  listCompactionArchives,
  getCompactionArchive,
  type CompactionArchiveItem,
  type CompactionArchiveMessage,
} from '@ihui/api-client'
import { ChevronLeft } from 'lucide-react'

/** 自动压缩上下文状态栏(2026-08-16 立):
 *  - 在 AI 对话框底部、输入框上方显示
 *  - 压缩中:显示"正在压缩上下文..." + 扫光动效
 *  - 压缩完成:显示压缩结果(token 变化 + 压缩条数为摘要)
 *  - 3 秒后自动隐藏完成态 */
export function CompactionStatusBar() {
  const t = useTranslations('chat')
  const compactionStatus = useChatStore((s) => s.compactionStatus)
  const conversationId = useChatStore((s) => s.conversationId)
  const [visible, setVisible] = React.useState(false)
  const [archiveOpen, setArchiveOpen] = React.useState(false)
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const hideAndReset = React.useCallback(() => {
    setVisible(false)
    // 延迟清空 store 状态,等动画结束
    setTimeout(() => {
      useChatStore.getState().setCompactionStatus(null)
    }, 300)
  }, [])

  // 压缩完成 3 秒后自动隐藏(归档弹层打开期间暂停,保证"查看原始消息"入口可点)
  const scheduleHide = React.useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(hideAndReset, 3000)
  }, [hideAndReset])

  React.useEffect(() => {
    if (!compactionStatus) {
      setVisible(false)
      return
    }

    setVisible(true)

    if (compactionStatus.phase === 'done' && !archiveOpen) {
      scheduleHide()
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [compactionStatus, archiveOpen, scheduleHide])

  if (!visible || !compactionStatus) return null

  const isCompacting = compactionStatus.phase === 'compacting'

  /** 「本轮实际省略了多少」的唯一出处 —— 本文件内所有披露口(摘要行 / 截断提示 / 归档入口)
   *  只读这一个数,禁止在渲染处再算第二份。
   *  数据链:`@ihui/context-compaction` 的 `CompressionResult.removedCount`
   *  (packages/context-compaction/src/index.ts:463 等置位点 = 本次被折进摘要的原始消息条数)
   *  → SSE `compaction` 帧 → api-client `onCompaction`(packages/api-client/src/client.ts:2195)
   *  → chat store `compactionStatus.removedCount`(apps/web/src/hooks/use-chat/send-message.ts:632)。 */
  const omittedCount = compactionStatus.phase === 'done' ? compactionStatus.removedCount : 0

  return (
    <div
      className={cn(
        'overflow-hidden transition-all duration-300',
        visible ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0',
      )}
    >
      <div
        className={cn(
          'relative mx-4 mb-2 flex items-center gap-2 overflow-hidden rounded-lg px-3 py-2 text-xs',
          isCompacting
            ? 'bg-primary/10 text-primary'
            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
        )}
        onMouseEnter={() => {
          // hover 暂停自动隐藏,给用户时间点击"查看原始消息"入口
          if (timerRef.current) clearTimeout(timerRef.current)
        }}
        onMouseLeave={() => {
          if (compactionStatus.phase === 'done' && !archiveOpen) scheduleHide()
        }}
      >
        {/* 扫光动效(仅压缩中显示) */}
        {isCompacting && (
          <span className="relative inline-flex h-2 w-2 shrink-0" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
        )}

        {/* 完成图标(压缩完成显示) */}
        {!isCompacting && (
          <svg
            className="h-3.5 w-3.5 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}

        <span className="shrink-0 font-medium">
          {isCompacting ? '正在压缩上下文...' : '上下文已自动压缩'}
        </span>

        {/* 压缩详情(仅完成态显示)。
         *  2026-09-26 A10B-7:"压缩 N 条历史为摘要"是一句省略量披露,N=0 时它自己就是废话,
         *  故与下面两处披露同用 omittedCount 判据 —— 一个都没省就不要说"省了什么"。 */}
        {!isCompacting && (
          <span className="text-muted-foreground">
            {compactionStatus.tokensBefore} → {compactionStatus.tokensAfter} tokens
            {omittedCount > 0 ? ` (压缩 ${omittedCount} 条历史为摘要)` : ''}
          </span>
        )}

        {/* truncated 截断降级专属提示(2026-09-01;2026-09-26 A10B-7 补配对判据):
         *  `trigger === 'truncated'` 只说明"发生过截断降级",它**不蕴含**真有历史被折叠 ——
         *  截断兜底里 removedCount 取的是"除最后一组外被折进摘要的条数"
         *  (packages/context-compaction/src/index.ts:463 `removedCount: toCompressAll.length`),
         *  只剩一个配对组时它就是 0。此前这一句只看标志位、紧邻 5 行的归档入口却看计数,
         *  两个相邻披露口宽严不同形 ⇒ 会念出"已截断…(省略 0 条)"这种自相矛盾的话。
         *  现两者消费同一个 omittedCount,文案里的数字即该值,为 0 时整句不渲染。 */}
        {!isCompacting && compactionStatus.trigger === 'truncated' && omittedCount > 0 && (
          <span className="text-muted-foreground">
            {/* 数字直接取 omittedCount(不在渲染处再算第二份)。与相邻摘要行 / 归档入口同格式:
             *  实测本运行时(next-intl + zh-CN)裸 `{count}` 插值不加分组,渲染成 1234 而非 1,234;
             *  该格式一致性由 compaction-status-bar.test.tsx 的千分位断言守着,换 locale/版本若开始
             *  分组,那条断言会当场红,而不是悄悄产出"同一块里一个 1,234 一个 1234"。 */}
            · {t('compaction.truncatedNotice', { count: omittedCount })}
          </span>
        )}

        {/* 归档查看入口(2026-09-01 立,"归档记忆"):压缩原文已落库归档,点击回看被压掉的原始消息 */}
        {!isCompacting && conversationId && omittedCount > 0 && (
          <Tooltip content={t('compaction.archiveTitle')} side="top">
            <button
              type="button"
              onClick={() => setArchiveOpen(true)}
              className="shrink-0 rounded font-medium underline underline-offset-2 transition-opacity hover:opacity-80"
            >
              {t('compaction.viewArchived', { count: omittedCount })}
            </button>
          </Tooltip>
        )}

        {/* 扫光条(压缩中:使用项目已有 shimmer 动画) */}
        {isCompacting && (
          <span
            className="absolute inset-0 -translate-x-full animate-shimmer"
            style={{
              backgroundImage:
                'linear-gradient(90deg, transparent, color-mix(in srgb, var(--color-primary) 12%, transparent), transparent)',
              backgroundSize: '200% 100%',
            }}
            aria-hidden
          />
        )}
      </div>

      {/* 压缩归档查看弹层(打开期间状态栏不自动隐藏) */}
      {conversationId && (
        <ArchiveViewerDialog
          open={archiveOpen}
          conversationId={conversationId}
          onClose={() => setArchiveOpen(false)}
        />
      )}
    </div>
  )
}

/** 消息 role 徽标配色(user/assistant/tool/system 简单区分样式) */
const ARCHIVE_ROLE_BADGE: Record<string, string> = {
  user: 'bg-primary/10 text-primary',
  assistant: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  tool: 'bg-muted text-muted-foreground',
  system: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
}

/** 压缩归档查看弹层(2026-09-01 立):
 *  打开时拉取归档列表,点选某条后按需取详情(被压缩的原始消息原文)。
 *  状态全部 local state,不进全局 store;原文 jsonb 结构与 replaceMessages 存储一致。 */
function ArchiveViewerDialog({
  open,
  conversationId,
  onClose,
}: {
  open: boolean
  conversationId: string
  onClose: () => void
}) {
  const t = useTranslations('chat.compaction')
  const [archives, setArchives] = React.useState<CompactionArchiveItem[] | null>(null)
  const [listLoading, setListLoading] = React.useState(false)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [detailMessages, setDetailMessages] = React.useState<CompactionArchiveMessage[] | null>(
    null,
  )
  const [detailLoading, setDetailLoading] = React.useState(false)

  // 弹层打开时拉取归档列表(失败按空态降级,不打断交互)
  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    setSelectedId(null)
    setDetailMessages(null)
    setListLoading(true)
    listCompactionArchives(conversationId)
      .then((res) => {
        if (!cancelled) setArchives(res.success ? (res.data.archives ?? []) : [])
      })
      .catch(() => {
        if (!cancelled) setArchives([])
      })
      .finally(() => {
        if (!cancelled) setListLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, conversationId])

  const openDetail = (archiveId: string) => {
    setSelectedId(archiveId)
    setDetailLoading(true)
    getCompactionArchive(conversationId, archiveId)
      .then((res) => setDetailMessages(res.success ? (res.data.archive?.messages ?? []) : []))
      .catch(() => setDetailMessages([]))
      .finally(() => setDetailLoading(false))
  }

  return (
    <Modal open={open} onClose={onClose} title={t('archiveTitle')} size="lg">
      {selectedId ? (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => {
              setSelectedId(null)
              setDetailMessages(null)
            }}
            aria-label={t('archiveTitle')}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          {detailLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t('archiveLoading')}</p>
          ) : (
            <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
              {(detailMessages ?? []).map((m, i) => (
                <div key={i} className="rounded-md border border-border p-2">
                  <span
                    className={cn(
                      'mb-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium',
                      ARCHIVE_ROLE_BADGE[m.role] ?? 'bg-muted text-muted-foreground',
                    )}
                  >
                    {m.role}
                  </span>
                  <p className="whitespace-pre-wrap break-words text-xs text-foreground/90">
                    {m.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : listLoading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{t('archiveLoading')}</p>
      ) : !archives || archives.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{t('archiveEmpty')}</p>
      ) : (
        <ul className="max-h-[55vh] space-y-1 overflow-y-auto pr-1">
          {archives.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => openDetail(a.id)}
                className="w-full rounded-md border border-border px-3 py-2 text-left text-xs transition-colors hover:bg-muted/50"
              >
                <span className="font-medium">{t('viewArchived', { count: a.messageCount })}</span>
                <span className="ml-2 text-muted-foreground">
                  {new Date(a.createdAt).toLocaleString()}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
