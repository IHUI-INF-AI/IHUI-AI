// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * McpStatusStrip — App(RN)端的 MCP 连接状态行(D154 第 5 栏「至少显示状态行 + 桌面端管理提示」)。
 *
 * 立票凭据:`mcpStatusLedger.snapshot()` 在此前的**生产面零渲染点** —— 状态只以一次性 FloatBox
 * toast 出现一次就消失。本文件把账本接上屏幕:toast 会过期,状态行不会。
 *
 * 与小程序端 `apps/miniapp-taro/src/pkg-ai/ai/mcp-status-strip.tsx` 同形(同名配对组件,
 * 守门 128 因此会按几何档对账 —— 两端的盒档逐档同值:10/8/4/11/2,小程序侧写作 20rpx/16rpx/8rpx/22rpx/4rpx):
 * 一份账本、两个薄渲染点,判据与取词都在共享层。
 *
 * 三条不可漂的写法(AGENTS §3,门 151/138 同族):
 *  ① 状态只取共享那一份 `mcpStatusLedger`(subscribe + snapshot),本端不建第二条连接、
 *    不自 parse、不抄事件名清单;
 *  ② 取词只用共享出口 `mcpStatusMessage` + `MCP_MOBILE_SETTINGS_HINT_KEY`,本端**不得**把
 *    state→词表键 那张表重抄一份(第二份真相由 `tests/mcp-status-strip.test.tsx` 的结构扫锁钉死);
 *  ③ 取不出文案的一档计入 `undeterminedServers` 并 console.warn 点名(与本端
 *    `use-user-broadcast-sync.ts` 的失败可见约定同一档),不渲染空白行冒充"已显示"。
 *
 * 空表 ⇒ 返回 null,零占位(连上不是要提示的事)。
 */
import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { rnRadius } from '@ihui/design-tokens'
import { mcpStatusEvent, type McpStatusEvent } from '@ihui/types'
import {
  MCP_MOBILE_SETTINGS_HINT_KEY,
  mcpStatusLedger,
  mcpStatusMessage,
  type McpStatusRow,
} from '@ihui/shared/chat'
import { useI18n } from '../i18n'
import { tokens } from '../theme/active-tokens'

/** useSyncExternalStore 的两个口必须是**稳定引用**,所以提在模块级而不是每次渲染新建 */
const subscribeMcpStatus = (onStoreChange: () => void): (() => void) =>
  mcpStatusLedger.subscribe(onStoreChange)
const getMcpStatusSnapshot = (): readonly McpStatusRow[] => mcpStatusLedger.snapshot()

/**
 * 账本行 → `mcp:status` 事件形(纯字段投影,缺失的键不补默认值)。
 * 词表映射的唯一持有者是共享层 `mcpStatusMessage`,它吃的入参是事件 —— 这里不另建 state→键 表。
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

const LOG_TAG = '[mcp-status-strip]'

export function McpStatusStrip() {
  const { t } = useI18n()
  // 第三参 server snapshot = 同一个 snapshot(与小程序端那一份同形:snapshot() 只读表、不碰平台 API)
  const rows = useSyncExternalStore(subscribeMcpStatus, getMcpStatusSnapshot, getMcpStatusSnapshot)
  const view = useMemo(() => deriveMcpStatusView(rows, t), [rows, t])

  useEffect(() => {
    if (view.undeterminedServers.length > 0) {
      // 只打 server 名,不打载荷内容。日志面一律 ASCII:本端 src 在「硬编码中文基线棘轮」
      // (守门 70)射程内,而新建文件的 HEAD 存量是 0 —— 中文串会把一行诊断文本变成新账。
      console.warn(`${LOG_TAG} unmapped state rows: ${view.undeterminedServers.join(',')}`)
    }
  }, [view])

  const hint = t(MCP_MOBILE_SETTINGS_HINT_KEY)

  if (view.lines.length === 0) return null

  return (
    <View testID="mcp-status-strip" style={styles.strip}>
      {view.lines.map((line) => (
        <Text key={`mcp-status-${line.server}`} testID="mcp-status-line" style={styles.line}>
          {line.text}
        </Text>
      ))}
      {hint.length > 0 ? (
        <Text testID="mcp-settings-hint" style={styles.hint}>
          {hint}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  // 盒档与小程序端逐档同值(10/8/4 + 11/11 字号),圆角走角色表 chip→md
  strip: {
    marginHorizontal: 10,
    marginTop: 4,
    borderRadius: rnRadius.md,
    backgroundColor: tokens.surface.muted,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  line: {
    fontSize: 11,
    color: tokens.text.secondary,
  },
  hint: {
    marginTop: 2,
    fontSize: 11,
    color: tokens.text.primary,
  },
})

export default McpStatusStrip
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
