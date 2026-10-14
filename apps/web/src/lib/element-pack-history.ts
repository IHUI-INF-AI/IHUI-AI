// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:web 端元素包历史回放读侧

/**
 * D64⑤ 元素包历史回放 —— web 端读侧收窄与子代理卡等价换算(2026-10-14 立)。
 *
 * 背景:assistant 消息 metadata.elementPack.frames 落库了 subagent 帧族
 * (spawn/progress/end,契约唯一实现见 packages/shared/src/chat/element-pack-history.ts
 * 的 D64⑤ 落库票)。web 历史水合(use-chat/history-message.ts)据此把帧序列
 * 折叠成与流式侧 store(chat.ts 的 addSubagentSpawn → updateSubagentProgress →
 * markSubagentEnd)终态等价的 SubAgentActivity[],交给 MessageItem 既有的
 * SubAgentActivityFeed 渲染 —— 回放形态与流式侧同一组件同一数据形状,零新增 UI。
 *
 * 判据与 shared 读侧守卫逐字段同形(id/timestamp 必 string、progress.phase 四值、
 * end.status 二值归一);任何形态不合按"无元素包"返回 undefined,坏值不炸渲染。
 * 本文件只做读侧消费,不参与落库写侧。
 */
import type { SubAgentActivity } from '@/components/ai/types'

/** 元素包在 chat_messages.metadata 里的键名(与 shared 契约同名)。 */
const ELEMENT_PACK_METADATA_KEY = 'elementPack'

/** 元素包键内的帧数组键名(与 shared 契约同名)。 */
const ELEMENT_PACK_FRAMES_KEY = 'frames'

/** 已落库的 subagent 帧种类封闭集(与 shared ELEMENT_PACK_FRAME_KINDS 同集)。 */
const SUBAGENT_FRAME_KINDS: ReadonlySet<string> = new Set([
  'subagent_spawn',
  'subagent_progress',
  'subagent_end',
])

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v !== '' ? v : undefined
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

/** 读侧一帧的最小可辨形状:kind/id/timestamp 三键齐 + 关键枚举合法才算数。 */
export interface ElementPackFrame {
  readonly kind: string
  readonly id: string
  readonly timestamp: string
  // subagent_progress 专属
  readonly phase?: 'thinking' | 'tool_call' | 'tool_result' | 'output_ready'
  readonly iteration?: number
  readonly tool?: string
  readonly ok?: boolean
  readonly outputPreview?: string
  // subagent_spawn / progress 专属
  readonly role?: string
  readonly task?: string
  readonly agentName?: string
  // subagent_end 专属
  readonly status?: 'done' | 'failed'
  readonly failureReason?: string
}

function isElementPackFrame(value: unknown): ElementPackFrame | null {
  if (typeof value !== 'object' || value === null) return null
  const o = value as Record<string, unknown>
  const kind = o.kind
  const id = str(o.id)
  const timestamp = str(o.timestamp)
  if (typeof kind !== 'string' || kind === '' || id === undefined || timestamp === undefined) {
    return null
  }
  const frame: {
    kind: string
    id: string
    timestamp: string
    [key: string]: unknown
  } = { kind, id, timestamp }
  if (kind === 'subagent_progress') {
    const phase = o.phase
    if (
      phase !== 'thinking' &&
      phase !== 'tool_call' &&
      phase !== 'tool_result' &&
      phase !== 'output_ready'
    ) {
      return null
    }
    frame.phase = phase
    if (num(o.iteration) !== undefined) frame.iteration = num(o.iteration)
    if (str(o.tool) !== undefined) frame.tool = str(o.tool)
    if (typeof o.ok === 'boolean') frame.ok = o.ok
    if (str(o.outputPreview) !== undefined) frame.outputPreview = str(o.outputPreview)
    if (str(o.agentName) !== undefined) frame.agentName = str(o.agentName)
  } else if (kind === 'subagent_spawn') {
    if (str(o.role) !== undefined) frame.role = str(o.role)
    if (str(o.task) !== undefined) frame.task = str(o.task)
  } else if (kind === 'subagent_end') {
    // status 归一(sse-parse 同判据 —— 非 'failed' 一律 'done')
    frame.status = o.status === 'failed' ? 'failed' : 'done'
    if (str(o.failureReason) !== undefined) frame.failureReason = str(o.failureReason)
  } else if (!SUBAGENT_FRAME_KINDS.has(kind)) {
    // 未知种类:保留为降级帧(渲染位给最小降级卡),不丢 —— 帧是有意落库的信息
  }
  return frame as ElementPackFrame
}

/**
 * 从一条消息 metadata 读回元素包帧数组(按落库顺序)。
 * 键缺席/非对象/frames 非数组 → 空数组;元素判不过的逐条丢弃,不抛。
 */
export function parseElementPackFrames(metadata: unknown): ElementPackFrame[] {
  if (typeof metadata !== 'object' || metadata === null) return []
  const pack = (metadata as Record<string, unknown>)[ELEMENT_PACK_METADATA_KEY]
  if (typeof pack !== 'object' || pack === null) return []
  const frames = (pack as Record<string, unknown>)[ELEMENT_PACK_FRAMES_KEY]
  if (!Array.isArray(frames)) return []
  const out: ElementPackFrame[] = []
  for (const item of frames) {
    const frame = isElementPackFrame(item)
    if (frame) out.push(frame)
  }
  return out
}

/** progress 阶段 → 人类可读 currentStep(与 store updateSubagentProgress 同文案)。 */
function progressStepText(frame: ElementPackFrame): string {
  const iter = frame.iteration ? ` (轮次 ${frame.iteration})` : ''
  switch (frame.phase) {
    case 'thinking':
      return `思考中…${iter}`
    case 'tool_call':
      return `调用工具: ${frame.tool ?? 'unknown'}${iter}`
    case 'tool_result':
      return `${frame.tool ?? 'unknown'} ${frame.ok ? '✓' : '✗'}${iter}`
    case 'output_ready':
      return '输出就绪'
    default:
      return ''
  }
}

/**
 * 帧序列 → SubAgentActivity[](流式侧 store 三 action 的终态等价折叠)。
 *
 * 与流式侧逐行为对齐:
 * - spawn  ≙ addSubagentSpawn(name=role 兜底、currentStep=task、status=running)
 * - progress ≙ updateSubagentProgress(stepText/completedSteps/toolCallsCount/outputPreview)
 * - end    ≙ markSubagentEnd(done→completedSteps 收口;failed→currentStep=失败摘要)
 * - 未知 kind 帧 ≙ 最小降级条目(完成的占位卡,不伪装成运行中/失败)
 */
export function elementPackFramesToSubagentActivities(
  frames: readonly ElementPackFrame[],
): SubAgentActivity[] {
  const map = new Map<string, SubAgentActivity>()
  const degraded: SubAgentActivity[] = []
  for (const frame of frames) {
    const existing = map.get(frame.id)
    if (frame.kind === 'subagent_spawn') {
      if (existing) continue
      map.set(frame.id, {
        agentId: frame.id,
        name: frame.role || `Subagent ${frame.id.slice(-6)}`,
        type: 'worker',
        status: 'running',
        currentStep: frame.task || '执行中…',
        completedSteps: [],
      })
      continue
    }
    if (frame.kind === 'subagent_progress') {
      if (!existing) continue
      existing.currentStep = progressStepText(frame) || existing.currentStep
      existing.progressPhase = frame.phase
      if (frame.iteration !== undefined) existing.progressIteration = frame.iteration
      if (frame.tool !== undefined) existing.progressTool = frame.tool
      if (frame.outputPreview !== undefined) existing.outputPreview = frame.outputPreview
      if (frame.phase === 'tool_result') {
        existing.toolCallsCount = (existing.toolCallsCount ?? 0) + 1
        existing.completedSteps = [
          ...existing.completedSteps,
          {
            stepAction: `${frame.tool ?? 'unknown'} ${frame.ok ? '✓' : '✗'}`,
            createdAt: frame.timestamp,
            status: frame.ok ? ('completed' as const) : ('failed' as const),
          },
        ]
      }
      continue
    }
    if (frame.kind === 'subagent_end') {
      if (!existing) continue
      existing.status = frame.status === 'failed' ? 'failed' : 'completed'
      if (frame.status === 'failed') {
        existing.currentStep = frame.failureReason
          ? `失败:${frame.failureReason.slice(0, 200)}`
          : '执行失败'
      } else {
        existing.completedSteps = [
          ...existing.completedSteps,
          ...(existing.currentStep
            ? [
                {
                  stepAction: existing.currentStep,
                  createdAt: frame.timestamp,
                  status: 'completed' as const,
                },
              ]
            : []),
        ]
        existing.currentStep = ''
      }
      existing.streamingDone = true
      continue
    }
    // 未知种类:最小降级卡(占位说明,不做运行中/失败的误导态)
    degraded.push({
      agentId: frame.id,
      name: frame.kind,
      type: 'worker',
      status: 'completed',
      currentStep: `该元素帧(${frame.kind})暂不支持回放`,
      completedSteps: [],
    })
  }
  // 顺序:按首个 spawn 出现序(= Map 插入序),降级条目按帧序尾随
  return [...map.values(), ...degraded]
}

/**
 * 消息 metadata → 历史回放 SubAgentActivity[]。
 * 无元素包 / 全部帧判不过 → undefined(不挂字段,不渲染空态垃圾)。
 */
export function readSubagentActivitiesFromMetadata(
  metadata: unknown,
): SubAgentActivity[] | undefined {
  const frames = parseElementPackFrames(metadata)
  if (frames.length === 0) return undefined
  const activities = elementPackFramesToSubagentActivities(frames)
  return activities.length > 0 ? activities : undefined
}
