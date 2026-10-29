// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 连接器读写分组段(D81 ⑤ 的 web 生产宿主,2026-10-29 接线)。
 *
 * 立因:`packages/shared/src/chat/tool-category.ts` 的 `groupToolActivitiesByConnector`
 * 判据早就写好并有用例,但生产侧零消费者(自述注释如实登记过) —— 本仓最高频的
 * "判据在、消费者为 0" 那一型。此处把它落成类目卡区块旁的一段分组头:
 * 一条消息里多枚带连接器来源的工具卡,按「连接器 × 读/写方向」分组显示。
 *
 * 纪律(§0.6 单一真相源,本文件零名单):
 *  - 分组键与分组顺序 = 共享层 `groupToolActivitiesByConnector`(不重写分组逻辑);
 *  - 读/写方向 = 共享层 `FILE_WRITE_TOOLS` 白名单(与 `tool-call-card.tsx` 同一把尺子);
 *  - 分组头文案 = 既有 `ActivityConnectorGroupLabel`(taskStatus 的五语言词包);
 *  - 只有 `serverSource` 为 mcp / plugin 的调用才算"带连接器来源",其余不进分组
 *    —— 空来源一律在构造期剔除,故共享层的 `__none__` 兜底桶在本段结构上不可能出现
 *    (渲染层把那枚内部标记当标签打出去就是用户可见垃圾,契约见 connector-grouping.test.ts)。
 */
import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  FILE_WRITE_TOOLS,
  groupToolActivitiesByConnector,
  toolDisplayKey,
  type ConnectorActivityGroup,
  type ConnectorActivityItem,
} from '@ihui/shared/chat'
import { ActivityConnectorGroupLabel } from '../tool-activity-line'

/** 本段需要的最小工具调用形状(与 ToolCallSummaryCard 的 toolCalls 同源) */
export interface ConnectorCallLike {
  id?: string
  toolName: string
  serverSource?: string
  serverId?: string
  serverName?: string
}

/**
 * 工具调用 → 分组输入。
 * 只保留有连接器来源的调用;方向判据取共享层 `FILE_WRITE_TOOLS`(缺失即 read)。
 * 纯函数,可单测(不含取词)。
 */
export function toConnectorActivityItems(
  calls: readonly ConnectorCallLike[],
): ConnectorActivityItem[] {
  const items: ConnectorActivityItem[] = []
  for (let i = 0; i < calls.length; i += 1) {
    const call = calls[i]
    if (!call) continue
    const sourced = call.serverSource === 'mcp' || call.serverSource === 'plugin'
    const connector = sourced ? (call.serverName ?? call.serverId ?? '').trim() : ''
    if (connector === '') continue
    items.push({
      id: call.id ?? `${call.toolName}-${i}`,
      connector,
      direction: FILE_WRITE_TOOLS.has(call.toolName) ? 'write' : 'read',
      label: call.toolName,
    })
  }
  return items
}

/** 分组 key(与共享层的分组键同构;此处只用于 React key 与 data-testid,不参与分组) */
function groupDomKey(group: ConnectorActivityGroup): string {
  return `${group.connector}::${group.direction}`
}

interface ConnectorGroupSectionProps {
  toolCalls?: readonly ConnectorCallLike[]
  'data-testid'?: string
}

/**
 * 连接器分组段。没有任何带来源的调用时**整段不出现**(不渲染空壳分组头)。
 * 可独立挂载:只吃 toolCalls,不依赖 ToolCallSummaryCard 的其它状态。
 */
export function ConnectorGroupSection({
  toolCalls,
  'data-testid': testId = 'connector-group-section',
}: ConnectorGroupSectionProps) {
  const tStatus = useTranslations('taskStatus')
  // 依赖内容指纹而非数组引用:父级每个 token 都会造新数组,引用依赖会白重算
  const fingerprint = React.useMemo(
    () =>
      (toolCalls ?? [])
        .map(
          (c) => `${c.toolName}|${c.serverSource ?? ''}|${c.serverName ?? ''}|${c.serverId ?? ''}`,
        )
        .join('~'),
    [toolCalls],
  )
  const groups = React.useMemo<ConnectorActivityGroup[]>(() => {
    const items = toConnectorActivityItems(toolCalls ?? [])
    return items.length === 0 ? [] : groupToolActivitiesByConnector(items)
  }, [fingerprint, toolCalls]) // eslint-disable-line react-hooks/exhaustive-deps -- 有意基于指纹比较

  if (groups.length === 0) return null

  return (
    <div className="space-y-1" data-testid={testId}>
      {groups.map((group) => (
        <div
          key={groupDomKey(group)}
          data-testid={`connector-group-${group.direction}-${group.connector}`}
          data-direction={group.direction}
          className="rounded-sm bg-muted/15 px-2 py-0.5"
        >
          <div className="flex items-center gap-1.5">
            <ActivityConnectorGroupLabel
              connector={group.connector}
              direction={group.direction}
              testId="connector-group-label"
            />
            <span className="shrink-0 tabular-nums text-[10px] text-muted-foreground/60">
              ×{group.items.length}
            </span>
          </div>
          <div className="space-y-0.5 text-[11px]">
            {group.items.map((item) => {
              const key = toolDisplayKey(item.label)
              return (
                <div
                  key={item.id}
                  className="truncate text-muted-foreground/70"
                  data-testid={`connector-group-item-${item.id}`}
                >
                  {key ? tStatus(key) : item.label}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export default ConnectorGroupSection
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
