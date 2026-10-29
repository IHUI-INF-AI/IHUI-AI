// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 投影行 → **渲染分组**(2026-10-29 立,`turn-presentation.ts` 的生产挂载层)。
 *
 * 为什么需要这一层,而不是让 `MessageList` 直接 `rows.map`:
 *
 * ① **窗口化坐标系一字不动**。`./windowing` 与 `use-message-list-scroll` 的
 *    offsets / `measureItem` / 补页锚点 / 键盘导航 / `data-message-id` 全部以
 *    "一条消息 = 一个窗口行"为坐标。投影行数与消息数并不一一对应(一个
 *    `thinkingAgent` 行代表 N 条消息,`activity-group` 行只是其中一条的语义附注)。
 *    若把窗口 count 换成行数,`heightMap` 按行 id 建索引而 DOM 里测高的仍是消息块,
 *    offset 链当场失真 —— 失效方向是"滚动条抖动 + 可见区间漂移",静默发生、
 *    截图判不出来。故本层的输入是**已切好的窗口内消息数组**,输出只是"这些消息
 *    在 DOM 里怎么分组",窗口那一侧零改动。
 *
 * ② **不变量:窗口内每条消息恰好出现一次、顺序不变**。遍历源是消息数组本身,
 *    不是投影行 —— 投影行只提供"归属"这一份附注。于是投影层任何未来退化
 *    (漏行/多行/乱序)的失效方向都是"少一层语义壳",绝不可能是"少一条消息"
 *    (本仓 §0.10:失效方向必须是多要一次说明,不是少渲染一次)。
 *
 * ③ **容器零布局影响**。`thinkingAgent` 分组在宿主侧渲染为 `display: contents`
 *    (Tailwind `contents`),不产生盒子、不引入 gap/padding/border。理由:容器若
 *    自带盒模型,它的 gap/padding 会加进真实高度,而 offsets 只累加消息块高度
 *    ⇒ 每组少算,`windowPaddings` 的占位与真实内容总高对不上(滚动条比例失真)。
 *    `contents` 让消息块直接参与祖父 flex 布局,**视觉与接入前逐像素一致**。
 *    真正的视觉壳(「N 个步骤」折叠面板)唯一住在 `MessageItem` 内的 `StreamGroup`,
 *    本层不重造第二套(§0.6 单一真相源)。
 *
 * 职责:纯函数,零 IO、零模块级状态、零判据复制。
 */

import type { ChatMessage } from '@/stores/chat'
import type { ActivityGroupRow, PresentationRow, ThinkingAgentRow } from './turn-presentation'

/** 一个消息块:既是既有 `renderItems` 的一项,又带投影语义附注。 */
export interface PresentationBlock {
  readonly message: ChatMessage
  readonly messageId: string
  /** 该消息的 `activity-group` 行(无工具调用 ⇒ null,不造空组)。 */
  readonly activity: ActivityGroupRow | null
  /** 收纳它的容器;游离消息(用户 / system / 不该聚合的助手消息)为 null。 */
  readonly container: ThinkingAgentRow | null
  /** 该消息此刻在**探索**(读文件/检索),取容器语义位 ∪ 自身活动组语义位。 */
  readonly isExploring: boolean
}

/**
 * 一个渲染分组。`key` 在同类内唯一且流式追加时稳定:
 * 容器取 `thinking-agent:<turnId>:<runIndex>`,游离消息取消息 id。
 */
export interface PresentationGroup {
  readonly key: string
  /** null ⇒ 游离消息(单块,不套容器)。 */
  readonly container: ThinkingAgentRow | null
  readonly blocks: readonly PresentationBlock[]
}

/**
 * 投影行 + 窗口内消息 → 渲染分组(纯函数)。
 *
 * @param rows 投影行(仅用作"归属附注",不作为遍历源)
 * @param messages 本帧要渲染的消息(**已按窗口切好**;未窗口化时是全集)
 */
export function buildPresentationGroups(
  rows: readonly PresentationRow[],
  messages: readonly ChatMessage[],
): PresentationGroup[] {
  // ① 归属映射:messageId → 容器行 + 该条的活动组行。一次 O(行数)。
  const containerByMessageId = new Map<string, ThinkingAgentRow>()
  const activityByMessageId = new Map<string, ActivityGroupRow>()
  for (const row of rows) {
    if (row.type === 'thinkingAgent') {
      for (const message of row.messages) containerByMessageId.set(message.id, row)
    } else if (row.type === 'activity-group') {
      activityByMessageId.set(row.messageId, row)
    }
  }

  // ② 按消息顺序聚组(遍历源是消息,不是行 —— 见头注 ②)。
  const groups: PresentationGroup[] = []
  let current: { key: string; container: ThinkingAgentRow; blocks: PresentationBlock[] } | null =
    null
  const flush = () => {
    if (!current) return
    groups.push({ key: current.key, container: current.container, blocks: current.blocks })
    current = null
  }

  for (const message of messages) {
    const container = containerByMessageId.get(message.id) ?? null
    const activity = activityByMessageId.get(message.id) ?? null
    const block: PresentationBlock = {
      message,
      messageId: message.id,
      activity,
      container,
      isExploring: (container?.isExploring ?? false) || (activity?.isExploring ?? false),
    }
    if (!container) {
      // 游离消息自成一组。先收尾上一个容器(容器内的消息在源数组里是连续的,
      // 一旦出现游离消息,该容器就到此为止)。
      flush()
      groups.push({ key: message.id, container: null, blocks: [block] })
      continue
    }
    if (current && current.container === container) {
      current.blocks.push(block)
      continue
    }
    flush()
    current = { key: container.id, container, blocks: [block] }
  }
  flush()
  return groups
}

/** 该分组是否携带"探索中"语义(容器位或任一子块的活动组位为真)。 */
export function groupIsExploring(group: PresentationGroup): boolean {
  if (group.container?.isExploring) return true
  return group.blocks.some((block) => block.isExploring)
}

export const __test__ = { buildPresentationGroups }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
