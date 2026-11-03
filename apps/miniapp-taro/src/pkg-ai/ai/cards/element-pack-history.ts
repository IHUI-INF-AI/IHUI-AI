// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 元素包历史回放读侧(D64 端内消费,2026-10-14 立)。
 *
 * assistant 消息 metadata.elementPack.frames 是随轮次落库的元素包帧(契约唯一
 * 实现在 packages/shared/src/chat/element-pack-history.ts 的读侧
 * parseElementPackFrames);本端历史水合点(server-chat-replay.mapServerMessage)
 * 把它读回并重放成八态子任务卡。
 *
 * 当前该共享层文件在 origin/main 被无关提交(292be30235)卷入删除,packages
 * 射程归他席在飞,故读侧守卫先在本子包内镜像同形实现;待共享层前向修复回
 * 主线后,parseElementPackFrames 改为一行 re-export 即可,帧→卡重放部分不动。
 * 同形判据由两侧测试的同一判例表钉住(帧种类封闭集 / 字段命名 / 坏帧按空处理)。
 *
 * 帧卡片的状态收敛不在此重写:历史帧按落库序喂给 cards/types.ts 的**流式归并
 * 函数**(upsertSubagentSpawn / applySubagentProgress / applySubagentEnd)——
 * 直播与回放共用同一份收敛逻辑,端内不存在第二份卡片实现。
 */

import {
  applySubagentEnd,
  applySubagentProgress,
  upsertSubagentSpawn,
  type SubagentTaskView,
} from './types'

/** metadata 里元素包的键名(与 shared 契约 ELEMENT_PACK_METADATA_KEY 同值) */
export const ELEMENT_PACK_METADATA_KEY = 'elementPack'

/** 元素包键内帧数组的键名(与 shared 契约 ELEMENT_PACK_FRAMES_KEY 同值) */
export const ELEMENT_PACK_FRAMES_KEY = 'frames'

/** 帧种类封闭集(与 shared 契约 ELEMENT_PACK_FRAME_KINDS 同值;新增种类两侧同步) */
const FRAME_KINDS = ['subagent_spawn', 'subagent_progress', 'subagent_end'] as const

const FRAME_KIND_SET: ReadonlySet<string> = new Set<string>(FRAME_KINDS)

/** spawn 帧(落库形态 camelCase,与 sse-parse 收窄后的 SubagentSpawnEvent 同族) */
export interface ElementPackSubagentSpawnFrame {
  readonly kind: 'subagent_spawn'
  readonly id: string
  readonly role: string
  readonly task: string
  readonly timestamp: string
}

/** progress 帧 */
export interface ElementPackSubagentProgressFrame {
  readonly kind: 'subagent_progress'
  readonly id: string
  readonly phase: 'thinking' | 'tool_call' | 'tool_result' | 'output_ready'
  readonly timestamp: string
  readonly iteration?: number
  readonly tool?: string
  readonly ok?: boolean
  readonly outputPreview?: string
  readonly agentName?: string
}

/** end 帧 */
export interface ElementPackSubagentEndFrame {
  readonly kind: 'subagent_end'
  readonly id: string
  readonly status: 'done' | 'failed'
  readonly failureReason?: string
  readonly timestamp: string
}

export type ElementPackFrame =
  | ElementPackSubagentSpawnFrame
  | ElementPackSubagentProgressFrame
  | ElementPackSubagentEndFrame

function isElementPackFrame(value: unknown): value is ElementPackFrame {
  if (typeof value !== 'object' || value === null) return false
  const o = value as Record<string, unknown>
  if (typeof o.kind !== 'string' || !FRAME_KIND_SET.has(o.kind)) return false
  if (typeof o.id !== 'string' || typeof o.timestamp !== 'string') return false
  if (o.kind === 'subagent_progress') {
    const phase = o.phase
    return (
      phase === 'thinking' ||
      phase === 'tool_call' ||
      phase === 'tool_result' ||
      phase === 'output_ready'
    )
  }
  if (o.kind === 'subagent_end') return o.status === 'done' || o.status === 'failed'
  return true // subagent_spawn:关键字段已在上两行判过
}

/**
 * 从一条消息 metadata 读回元素包帧数组(与 shared parseElementPackFrames 同形):
 * 键缺席 / 非对象 / frames 非数组 / 元素判不过 ⇒ 一律按「无元素包」返回空数组 ——
 * 回放是读路径,坏值不值得炸渲染。
 */
export function parseElementPackFrames(metadata: unknown): ElementPackFrame[] {
  if (typeof metadata !== 'object' || metadata === null) return []
  const pack = (metadata as Record<string, unknown>)[ELEMENT_PACK_METADATA_KEY]
  if (typeof pack !== 'object' || pack === null) return []
  const frames = (pack as Record<string, unknown>)[ELEMENT_PACK_FRAMES_KEY]
  if (!Array.isArray(frames)) return []
  return frames.filter(isElementPackFrame)
}

/**
 * 历史帧 → 八态卡(端内唯一重放出口):按落库序把每帧喂给流式归并函数,
 * 与 chat.tsx 直播链路共用同一份 upsert/progress/end 收敛逻辑。
 */
export function replayElementPackFrames(frames: readonly ElementPackFrame[]): SubagentTaskView[] {
  let tasks: SubagentTaskView[] = []
  for (const frame of frames) {
    if (frame.kind === 'subagent_spawn') {
      tasks = upsertSubagentSpawn(tasks, frame)
    } else if (frame.kind === 'subagent_progress') {
      tasks = applySubagentProgress(tasks, frame)
    } else {
      tasks = applySubagentEnd(tasks, frame)
    }
  }
  return tasks
}

/**
 * 历史水合入口(server-chat-replay.mapServerMessage 消费):metadata.elementPack
 * 有可回放帧才产出 subagentTasks,空数组不挂键 —— 与 ai-callback 落库侧
 * 「空不写键」同一纪律,回放侧空数组同样不渲染空态。
 */
export function readSubagentTasksFromMetadata(metadata: unknown): SubagentTaskView[] | undefined {
  const tasks = replayElementPackFrames(parseElementPackFrames(metadata))
  return tasks.length > 0 ? tasks : undefined
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
