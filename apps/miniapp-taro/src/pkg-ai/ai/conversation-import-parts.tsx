// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会话导入页的展示层组件(预览区 / 导入历史)。
 *
 * 为什么从页面里拆出来:AGENTS.md §4「每个页面 < 250 行」,而导入的
 * 四步流全塞进一个组件会把页面顶到四百行。这两个区块是**纯展示** ——
 * 取词、判序、传输都在页面与 conversation-import-core 里,这里只渲染,
 * 于是可以脱离平台依赖单测(夹具只需给 t 与数据)。
 */
import { View, Text, Button } from '@tarojs/components'
import LineIcon from '@/components/LineIcon'
import ThemeRoot from '@/components/ThemeRoot'
import {
  toHistoryStatus,
  type CommittedImportConversation,
  type ImportHistoryStatus,
  type ImportPreviewRow,
} from './conversation-import-core'
import type { ConversationImportHistoryItem } from '@ihui/api-client'
import type { TtFn } from '@/i18n'

/** 一条 warn/truncated 提示条(端内既有胶囊形态:命中块用 View、文案用 Text) */
function NoticeBar({ text, testId }: { text: string; testId?: string }) {
  return (
    <ThemeRoot className="flex items-start gap-[12rpx] p-[16rpx] mb-[12rpx] bg-card rounded-md">
      <View className="flex-shrink-0 mt-[4rpx]">
        <LineIcon name="triangle-alert" size={26} color="var(--color-destructive)" />
      </View>
      <Text className="flex-1 text-[length:24rpx] text-destructive" data-testid={testId}>
        {text}
      </Text>
    </ThemeRoot>
  )
}

export interface ImportPreviewListProps {
  rows: readonly ImportPreviewRow[]
  selected: readonly number[]
  truncated: boolean
  warnings: readonly string[]
  committing: boolean
  progress: { done: number; total: number }
  tt: TtFn
  onToggle: (id: number) => void
  onToggleAll: () => void
  onCommit: () => void
}

/**
 * 解析预览 + 逐会话导入。
 *
 * 小程序没有 hover、没有原生 checkbox,所以选中态是自绘方块(View + LineIcon),
 * 命中区给整行而不是只给方块 —— 手指目标必须够大。
 */
export function ImportPreviewList({
  rows,
  selected,
  truncated,
  warnings,
  committing,
  progress,
  tt,
  onToggle,
  onToggleAll,
  onCommit,
}: ImportPreviewListProps) {
  if (rows.length === 0) return null
  const allSelected = selected.length === rows.length
  return (
    <View className="mb-[32rpx]">
      <View className="flex items-center justify-between mb-[12rpx]">
        <Text className="text-[length:28rpx] text-foreground font-semibold">
          {tt('conversationImport.previewTitle', '解析预览')}
        </Text>
        <View onClick={onToggleAll} hoverClass="opacity-60" className="py-[8rpx] px-[16rpx]">
          <Text className="text-[length:24rpx] text-primary">
            {allSelected
              ? tt('conversationImport.deselectAll', '全不选')
              : tt('conversationImport.selectAll', '全选')}
          </Text>
        </View>
      </View>
      <Text className="block text-[length:24rpx] text-muted-foreground mb-[12rpx]">
        {tt('conversationImport.selected', '已选 {count}/{total}', {
          count: selected.length,
          total: rows.length,
        })}
      </Text>

      {truncated ? (
        <NoticeBar
          testId="import-truncated"
          text={tt(
            'conversationImport.truncatedWarning',
            '文件过大,仅解析出部分会话,请拆分导出文件后重试',
          )}
        />
      ) : null}

      {warnings.map((w, i) => (
        <NoticeBar key={`w-${i}`} testId={`import-warning-${i}`} text={w} />
      ))}

      {rows.map((r) => {
        const checked = selected.includes(r.id)
        return (
          <ThemeRoot
            key={r.id}
            className="flex items-center p-[20rpx] mb-[12rpx] bg-card rounded-md"
          >
            <View
              className={`w-[36rpx] h-[36rpx] rounded-sm flex items-center justify-center mr-[16rpx] flex-shrink-0 ${
                checked ? 'bg-primary' : 'bg-background'
              }`}
              onClick={() => onToggle(r.id)}
              hoverClass="opacity-60"
            >
              {checked ? (
                <LineIcon name="check-success" size={24} color="var(--color-foreground)" />
              ) : null}
            </View>
            <View className="flex-1 min-w-0" onClick={() => onToggle(r.id)}>
              <Text className="block text-[length:26rpx] text-foreground truncate">
                {r.title || tt('conversationImport.conversationUntitled', '未命名会话')}
              </Text>
              <Text className="block text-[length:22rpx] text-muted-foreground mt-[4rpx]">
                {tt('conversationImport.messagesCount', '{count} 条消息', {
                  count: r.messageCount,
                })}
                {r.createdAt ? ` · ${r.createdAt}` : ''}
              </Text>
            </View>
          </ThemeRoot>
        )
      })}

      <Button
        className="mt-[12rpx] h-[88rpx] leading-[88rpx] bg-primary text-[length:28rpx] rounded-sm"
        disabled={selected.length === 0 || committing}
        onClick={onCommit}
      >
        {committing
          ? tt('conversationImport.committing', '导入中...({done}/{total})', {
              done: progress.done,
              total: progress.total,
            })
          : tt('conversationImport.commit', '导入所选')}
      </Button>
    </View>
  )
}

/** D28 补齐层:导入结果区(取代"导完就没下文")。 */
export function ImportResultList({
  items,
  tt,
  onOpen,
  onAnalyze,
}: {
  items: readonly CommittedImportConversation[]
  tt: TtFn
  /** 打开会话:跳聊天页恢复该会话 */
  onOpen: (conversationId: string) => void
  /** 用场景分析:打开分析面板,目标为该会话 */
  onAnalyze: (target: CommittedImportConversation) => void
}) {
  if (items.length === 0) return null
  return (
    <View className="mb-[32rpx]">
      <Text className="block text-[length:28rpx] text-foreground font-semibold mb-[16rpx]">
        {tt('conversationImport.resultTitle', '已导入 {count} 个会话', { count: items.length })}
      </Text>
      {items.map((c) => (
        <ThemeRoot key={c.conversationId} className="p-[20rpx] mb-[12rpx] bg-card rounded-md">
          <Text className="block text-[length:26rpx] text-foreground font-semibold truncate">
            {c.title || tt('conversationImport.conversationUntitled', '未命名会话')}
          </Text>
          <Text className="block text-[length:22rpx] text-muted-foreground mt-[6rpx] mb-[16rpx]">
            {tt('conversationImport.messagesCount', '{count} 条消息', {
              count: c.messageCount,
            })}
          </Text>
          <View className="flex gap-[12rpx]">
            <View
              onClick={() => onOpen(c.conversationId)}
              hoverClass="opacity-80"
              className="flex-1 h-[76rpx] flex items-center justify-center rounded-md border border-border"
            >
              <Text className="text-[length:26rpx] text-foreground">
                {tt('conversationImport.resultOpen', '打开会话')}
              </Text>
            </View>
            <View
              onClick={() => onAnalyze(c)}
              hoverClass="opacity-80"
              className="flex-1 h-[76rpx] flex items-center justify-center gap-[8rpx] rounded-md bg-primary"
            >
              <LineIcon name="sparkles" size={26} color="var(--color-foreground)" />
              <Text className="text-[length:26rpx] text-foreground font-semibold">
                {tt('conversationImport.analysisOpen', '用场景分析')}
              </Text>
            </View>
          </View>
        </ThemeRoot>
      ))}
    </View>
  )
}

/** 未知状态回退显示服务端原文,不猜(§5e 诚实交代) */
export function historyStatusLabel(status: ImportHistoryStatus, raw: string, tt: TtFn): string {
  if (status === 'success') return tt('conversationImport.statusSuccess', '成功')
  if (status === 'partial') return tt('conversationImport.statusPartial', '部分成功')
  if (status === 'failed') return tt('conversationImport.statusFailed', '失败')
  return raw
}

/**
 * 导入历史。
 *
 * 失败批次必须带 errorMessage 原文上屏 —— 只显示"失败:12"用户无法判断
 * 是自己的文件问题还是服务端故障。
 */
export function ImportHistoryList({
  items,
  tt,
}: {
  items: readonly ConversationImportHistoryItem[]
  tt: TtFn
}) {
  return (
    <View>
      <Text className="block text-[length:28rpx] text-foreground font-semibold mb-[16rpx]">
        {tt('conversationImport.historyTitle', '导入历史')}
      </Text>
      {items.length === 0 ? (
        <Text className="block text-[length:24rpx] text-muted-foreground">
          {tt('conversationImport.historyEmpty', '暂无导入记录')}
        </Text>
      ) : (
        items.map((h) => (
          <ThemeRoot key={h.id} className="p-[20rpx] mb-[12rpx] bg-card rounded-md">
            <View className="flex items-center justify-between gap-[16rpx]">
              <Text className="flex-1 text-[length:26rpx] text-foreground truncate">
                {h.fileName || '—'}
              </Text>
              <Text className="flex-shrink-0 text-[length:22rpx] text-muted-foreground">
                {historyStatusLabel(toHistoryStatus(h.status), h.status, tt)}
              </Text>
            </View>
            <Text className="block text-[length:22rpx] text-muted-foreground mt-[8rpx]">
              {tt('conversationImport.historyParsed', '解析')}: {h.parsedCount} ·{' '}
              {tt('conversationImport.historyImported', '导入')}: {h.importedCount} ·{' '}
              {tt('conversationImport.historyFailed', '失败')}: {h.failedCount}
              {h.errorMessage ? ` · ${h.errorMessage}` : ''}
            </Text>
          </ThemeRoot>
        ))
      )}
    </View>
  )
}
// PLACEHOLDER-TAIL
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
