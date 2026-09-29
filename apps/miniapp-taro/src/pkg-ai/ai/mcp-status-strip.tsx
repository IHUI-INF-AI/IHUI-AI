// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * McpStatusStrip — miniapp-taro 的 MCP 连接状态行(D154 第 5 栏「至少显示状态行 + 桌面端管理提示」)。
 *
 * 立票凭据:`mcpStatusLedger.snapshot()` 在此前的**生产面零渲染点** —— 状态只以一次性 toast
 * 出现一次就消失,而账本那一半(D154 §8「回退=摘渲染保状态表」里被保住的东西)一直在积累
 * 却无人读取。本文件把那一半接上屏幕:toast 会过期,状态行不会。
 *
 * 三条不可漂的写法(AGENTS §3 共享层优先,门 151/138 同族):
 *  ① **状态只取共享账本那一份**:`mcpStatusLedger.subscribe` + `snapshot()` 经
 *     `useSyncExternalStore` 消费。本文件不 `new WebSocket`、不 `Taro.connectSocket`、
 *     不自 parse、不抄第二份事件名清单 —— 帧怎么进账本是 `src/lib/user-broadcast.ts` 那条
 *     唯一接线(共享出口 `subscribeUserBroadcast`)的事,渲染侧只看表。
 *  ② **取词只用共享出口**:`mcpStatusMessage`(state→词表键那张表住在
 *     `@ihui/shared/chat/user-broadcast-store` 的 `MCP_STATUS_MESSAGE_KEYS`)+
 *     `MCP_MOBILE_SETTINGS_HINT_KEY`。本端**不得**把那张表重抄一份(端内出现 state→键
 *     的字面量映射 = 第二份真相),由 `tests/mcp-status-strip.test.tsx` 的结构扫锁钉死(两端同判)。
 *  ③ **认不出的一档不得静默**:ledger 只会存解析通过的帧,所以 `mcpStatusMessage` 返回
 *     null 在这里意味着「表没有这句话」。这一格计入 `undetermined` 并点名(logger.warn),
 *     绝不渲染空白行冒充"已显示",也绝不把它读成"没有异常"。
 *
 * 空表 ⇒ 返回 null,整条不挂载、零占位(与 TaskStatusBar 同一纪律:连上不是要提示的事)。
 * 去重发生在账本层:同一 server 只有一行(`Map<server,row>`),重复同状态帧 `apply()` 返回
 * false 且不 publish ⇒ 本组件天然「一 server 一条」。
 */
import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { View, Text } from '@tarojs/components'
import { mcpStatusEvent, type McpStatusEvent } from '@ihui/types'
import {
  MCP_MOBILE_SETTINGS_HINT_KEY,
  mcpStatusLedger,
  mcpStatusMessage,
  type McpStatusRow,
} from '@ihui/shared/chat'
import { useI18n } from '@/i18n'
import { logger } from '@/utils/logger'

/** useSyncExternalStore 的两个口必须是**稳定引用**,所以提在模块级而不是每次渲染新建 */
const subscribeMcpStatus = (onStoreChange: () => void): (() => void) =>
  mcpStatusLedger.subscribe(onStoreChange)
const getMcpStatusSnapshot = (): readonly McpStatusRow[] => mcpStatusLedger.snapshot()

/**
 * 账本行 → `mcp:status` 事件形。
 *
 * 为什么要有这一步(而不是在本端写一张 state→键 的表):词表映射的**唯一持有者**是共享层的
 * `mcpStatusMessage`,它吃的入参是事件。这里只做字段投影(逐键搬运,缺失的键不补默认值 ——
 * 补了就是把"生产面漏了"洗成"看起来完整"),`mcpStatusEvent` 是 @ihui/types 里构造该事件的
 * 唯一出口(它同时保证"带 attempt 必带 maxAttempts",否则文案只有分子)。
 */
export function mcpStatusRowToEvent(row: McpStatusRow): McpStatusEvent {
  return mcpStatusEvent({
    server: row.server,
    state: row.state,
    ...(row.reason !== undefined ? { reason: row.reason } : {}),
    ...(row.attempt !== undefined ? { attempt: row.attempt } : {}),
    ...(row.maxAttempts !== undefined ? { maxAttempts: row.maxAttempts } : {}),
    ...(row.tools !== undefined ? { tools: row.tools } : {}),
  })
}

export interface McpStatusLine {
  readonly server: string
  readonly text: string
}

export interface McpStatusView {
  readonly lines: readonly McpStatusLine[]
  /**
   * 认不出句子的一档行(逐行点名 server)。`lines.length` 少一条不等于"没有异常":
   * 这一格必须可被外部读到,否则"把没判写成判过了"就发生在渲染层自己身上。
   */
  readonly undeterminedServers: readonly string[]
}

/** 纯派生出口(渲染与用例共用一份,用例因此测的是渲染真正吃的那条路径) */
export function deriveMcpStatusView(
  rows: readonly McpStatusRow[],
  translate: (key: string, params?: Record<string, string | number>) => string,
): McpStatusView {
  const lines: McpStatusLine[] = []
  const undeterminedServers: string[] = []
  for (const row of rows) {
    const message = mcpStatusMessage(mcpStatusRowToEvent(row))
    if (!message) {
      undeterminedServers.push(row.server)
      continue
    }
    lines.push({ server: row.server, text: translate(message.key, message.params) })
  }
  return { lines, undeterminedServers }
}

export default function McpStatusStrip() {
  const { t } = useI18n()
  // 第三参 server snapshot = 同一个 snapshot:snapshot() 只读表、不碰 window/Date,
  // 服务端与客户端取值恒等 ⇒ 不写"服务器给空表、客户端再补"这种自欺分叉。
  // 不传它会让本组件在 renderToStaticMarkup 下直接抛 Missing getServerSnapshot。
  const rows = useSyncExternalStore(subscribeMcpStatus, getMcpStatusSnapshot, getMcpStatusSnapshot)
  const view = useMemo(() => deriveMcpStatusView(rows, t), [rows, t])

  useEffect(() => {
    if (view.undeterminedServers.length > 0) {
      // 只打 server 名,不打载荷内容(载荷可能带用户数据);签名见 @ihui/shared/utils/logger
      logger.warn('mcp-status-strip', 'frame state unmapped', view.undeterminedServers.join(','))
    }
  }, [view])

  if (view.lines.length === 0) return null
  const hint = t(MCP_MOBILE_SETTINGS_HINT_KEY)

  return (
    <View data-testid="mcp-status-strip" className="mx-[20rpx] mt-[8rpx] rounded-md bg-muted px-[16rpx] py-[8rpx]">
      {view.lines.map((line) => (
        <Text
          key={`mcp-status-${line.server}`}
          data-testid="mcp-status-line"
          className="block text-[length:22rpx] text-muted-foreground"
        >
          {line.text}
        </Text>
      ))}
      {hint.length > 0 ? (
        <Text
          data-testid="mcp-settings-hint"
          className="mt-[4rpx] block text-[length:22rpx] text-foreground"
        >
          {hint}
        </Text>
      ) : null}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
