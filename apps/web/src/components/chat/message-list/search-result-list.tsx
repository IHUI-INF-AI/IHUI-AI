// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// V3 #62(2026-09-27 立)—— 会话内消息搜索的**结果预览列表**。
//
// 这块补的是既有搜索唯一缺的那一维:`MessageSearchBar` 只给「第 N/M 个匹配」计数,
// 用户看不到匹配的是什么内容就得逐个跳。本组件把当前查询投影成可点选的摘要列表,
// 点一下直接跳到那条消息(useChatSearch.scrollToMessage)。
//
// 刻意**不设第二个输入框、不加第二条快捷键**:搜索条可见态与 Ctrl+F/Cmd+F、
// Esc、上一个/下一个 全部归 `use-message-list-search.ts`(唯一入口,注册与持有证据
// 都在那一侧)。本组件只是那份查询的投影,查询由 MessageList 的 onSearch 桥进来。
//
// 样式纪律(AGENTS §4):紧凑;hover 只做背景变化,无蓝色发光;不用分割线
// (`gap-*` 分隔,不给 `border-t`);不用渐变遮罩;时间一律 `Intl.DateTimeFormat`
// (不手写「X 分钟前」这类中文串);按钮内无 svg,故无 icon+文字对齐补偿问题。

'use client'

import { useLocale, useTranslations } from 'next-intl'

import type { SearchResult } from '@/hooks/use-chat-search'

/** 列表最多渲染的条数:长会话里一个常见词能命中上百条,全渲染既没意义又拖慢输入 */
const MAX_VISIBLE_RESULTS = 8

interface SearchResultListProps {
  /** 当前查询的命中投影(空查询时上游即返回空数组,本组件随之不渲染) */
  results: SearchResult[]
  /** 最近一次跳转选中的消息(滚动定位后短暂高亮) */
  selectedId: string | null
  /** 点选某条结果 → 由上游滚动定位 */
  onPick: (messageId: string) => void
}

/**
 * 毫秒时间戳(或 Date/ISO 串)→ 按当前语言环境的短日期时间。
 * 解析不出来(旧数据只有字符串标题之类)就返回空串 —— 宁可不显示,不给 "Invalid Date"。
 */
function formatResultTime(raw: string, locale: string): string {
  if (!raw) return ''
  const ms = Number(raw)
  const date = Number.isFinite(ms) ? new Date(ms) : new Date(raw)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

/**
 * 会话内搜索结果列表。无命中(或查询为空)时**整段不渲染**,不占位、不给空框。
 */
export function SearchResultList({ results, selectedId, onPick }: SearchResultListProps) {
  const t = useTranslations('chatSearchBar')
  const locale = useLocale()

  if (results.length === 0) return null

  const shown = results.slice(0, MAX_VISIBLE_RESULTS)
  const hidden = results.length - shown.length

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-1" data-testid="chat-search-result-list">
      <ul aria-label={t('resultListLabel')} className="flex flex-col gap-0.5">
        {shown.map((result) => {
          const timeText = formatResultTime(result.createTime, locale)
          const isSelected = selectedId !== null && selectedId === result.id
          return (
            <li key={result.id}>
              <button
                type="button"
                onClick={() => onPick(result.id)}
                aria-current={isSelected ? 'true' : undefined}
                aria-label={timeText ? `${result.preview} · ${timeText}` : result.preview}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left transition-colors hover:bg-muted/50 data-[current=true]:bg-muted"
              >
                <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                  {result.preview}
                </span>
                {timeText ? (
                  <span className="shrink-0 whitespace-nowrap text-[10px] tabular-nums text-muted-foreground">
                    {timeText}
                  </span>
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>
      {hidden > 0 ? (
        <p className="px-2 pt-1 text-[10px] tabular-nums text-muted-foreground">
          {t('moreResults', { count: hidden })}
        </p>
      ) : null}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
