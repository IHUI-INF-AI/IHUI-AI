// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 导入会话来源标识条(D28 补齐层第 2 条,2026-10-03)
 *
 * **为什么必须有**:导入管道把外部会话(微信群聊 / Claude Code / Codex …)落进
 * `chat_conversations`,侧栏与消息区渲染时与用户自建的 AI 对话**完全同形**。
 * 用户点开一条"看起来像自己跟 AI 聊过"的会话,实际读到的是别人在群里的对话 ——
 * 这是幻觉级误导。`importedFrom` / `importedVia` 落库时写了但全仓只写不读,
 * 本组件是它们的第一个消费面。
 *
 * 渲染口径(诚实性优先):
 *  - 读不出 `importedFrom`(自建会话)→ **整条不渲染**,不用"未知来源"占位
 *  - 读得出 → 显示 来源 · 文件名 · 时间跨度 ·(wechat)发言人清单
 *  - 发言人/时间跨度为 0 条时**不显示该片段**,不用"无"冒充有
 *
 * 发言人识别与时间跨度都在 `lib/import-analysis.ts` 的 `readImportProvenance` 里
 * (从消息正文 `昵称：正文` 前缀与消息时间戳现算),本组件只负责排版。
 */
import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Download, MessagesSquare, Users } from 'lucide-react'

import { cn } from '@/lib/utils'
import { formatSpeakerList, type ImportProvenance } from '@ihui/shared/import-analysis'

/** i18n key → 来源枚举(wechat 之外的四源标签在 conversationImport 命名空间里已有,复用不重复造) */
const SOURCE_LABEL_KEY: Record<ImportProvenance['source'], string> = {
  claude_code: 'sourceClaudeCode',
  codex: 'sourceCodex',
  cursor: 'sourceCursor',
  aider: 'sourceAider',
  wechat: 'sourceWechat',
}

/** 时间跨度的展示格式(短日期;跨年时由 toLocaleDateString 自动带年) */
const DATE_FORMAT: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit' }

export interface ImportSourceBannerProps {
  readonly provenance: ImportProvenance
  /** 紧凑模式:只给一行(移动端/窗格拆分时用),隐藏发言人明细 */
  readonly compact?: boolean
  readonly className?: string
}

export function ImportSourceBanner({
  provenance,
  compact = false,
  className,
}: ImportSourceBannerProps) {
  const t = useTranslations('conversationImport')

  // 五个来源的短标签在 conversationImport 命名空间里已存在(sourceClaudeCode 等,导入面板
  // 选来源时就在用),这里复用同一批 key,不另造一套来源名 —— 同一来源在两处显示不同名字
  // 比多写一个 key 更容易让人误以为是两样东西。
  const sourceLabel = t(SOURCE_LABEL_KEY[provenance.source])

  const isWechat = provenance.source === 'wechat'
  const hasSpeakerLine = !compact && isWechat && provenance.speakers.length > 0
  const hasRange = provenance.startedAt !== null && provenance.endedAt !== null

  return (
    <div
      // role="note":这是对当前会话性质的补充说明,不是可交互控件
      role="note"
      data-testid="import-source-banner"
      data-source={provenance.source}
      className={cn(
        'flex flex-col gap-1 rounded-md border border-amber-500/30 bg-amber-500/5 px-2.5 py-2 text-[11px] leading-relaxed text-amber-800 dark:text-amber-300',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <Download className="h-3 w-3 shrink-0" aria-hidden />
        {/* 这一句是本组件的全部要点:不是你自己跟 AI 聊的,是导入的外部记录 */}
        <span className="font-medium">
          {t('bannerPrefix', { source: sourceLabel })}
        </span>
        {provenance.fileName && (
          <>
            <span aria-hidden>·</span>
            <span className="min-w-0 truncate" title={provenance.fileName}>
              {provenance.fileName}
            </span>
          </>
        )}
      </div>

      {/* wechat 专属:让用户知道这是群聊记录、谁在说、跨了多久 —— 缺了这段就退化成"一段文字" */}
      {isWechat && !compact && (
        <div className="flex flex-col gap-0.5 text-muted-foreground">
          {hasSpeakerLine && (
            <span className="flex items-start gap-1" data-testid="import-source-speakers">
              <Users className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
              <span className="min-w-0">
                {t('bannerSpeakers', {
                  count: provenance.speakers.length,
                  names: formatSpeakerList(provenance.speakers),
                })}
              </span>
            </span>
          )}
          {!hasSpeakerLine && (
            <span className="flex items-start gap-1" data-testid="import-source-no-speaker">
              <MessagesSquare className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
              <span>{t('bannerChatLogHint')}</span>
            </span>
          )}
        </div>
      )}

      {/* 时间跨度:只有真的解析出首末时间才显示(不拿"导入时刻"冒充"记录时间") */}
      {hasRange && (
        <p className="text-muted-foreground" data-testid="import-source-range">
          {t('bannerRange', {
            from: new Date(provenance.startedAt!).toLocaleDateString(undefined, DATE_FORMAT),
            to: new Date(provenance.endedAt!).toLocaleDateString(undefined, DATE_FORMAT),
          })}
        </p>
      )}

      {/* 导入通道(网页面板 / CLI):绝大多数用户不需要,收进 title 只在 hover 时可见 */}
      <span className="sr-only" title={t('bannerVia', { via: provenance.via })}>
        {t('bannerVia', { via: provenance.via })}
      </span>
    </div>
  )
}

export default ImportSourceBanner
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
