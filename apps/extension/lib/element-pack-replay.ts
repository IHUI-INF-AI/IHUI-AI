// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D64⑤ 消费票(2026-10-14 立):extension 聊天**历史回放**侧的元素包帧归并层。
 *
 * 数据源:assistant 消息 `metadata.elementPack.frames`(D64⑤ 落库,读端点经
 * serializeMessage 原样透传)。解析走共享守卫 `parseElementPackFrames`
 * (`@ihui/shared/chat/element-pack-history`,唯一真相源,端内不复制判据);
 * 本文件只负责把帧序列折算成与流式侧等价的 `SubAgentActivity[]` —— 折算完
 * 挂进 message.subagentActivities,渲染自动走 MessageContent 既有的
 * SubagentBlockView(buildRenderModel 的 subagent 块),与流式侧同一张卡。
 *
 * 折算口径与 web 流式侧(stores/chat.ts 的 addSubagentSpawn /
 * updateSubagentProgress / markSubagentEnd)逐字段同形 —— 步骤文案、
 * completedSteps 推入、toolCallsCount 计数都是那一套,不许端内自造第二形态:
 *  1. spawn:新建 running 活动(name 取 role 缺省 `Subagent {id 尾 6}`;type
 *     'worker';currentStep 取 task 缺省「执行中…」)。同 id 已存在**原样保留**
 *     (web addSubagentSpawn 的去重分支同口径)。
 *  2. progress:按 phase 构造 currentStep 文案(thinking/tool_call/tool_result/
 *     output_ready),tool_result 追加 completedSteps 并 +1 toolCallsCount,
 *     outputPreview 只增不减。
 *  3. end:status 归一 completed/failed;失败 currentStep 换错误摘要(截 200),
 *     完成 currentStep 推入 completedSteps 后清空;streamingDone 置 true。
 *  4. **无主帧不凭空造条目**:progress/end 的 id 没有对应 spawn ⇒ 整帧丢弃
 *     (与 lib/tool-call-frames.ts 第 2 条口径同源)。全部帧都无主时消息原样返回。
 *
 * 为什么单拆一个文件:与 tool-call-frames.ts(D113)同一理由 —— "历史帧怎么折"
 * 的语义只能靠读代码保证,拆成纯函数后可被单测钉住,宿主接线只剩薄薄一层。
 */
import type { SubAgentActivity } from '@ihui/types/ai'
import { parseElementPackFrames } from '@ihui/shared/chat/element-pack-history'
import type { ElementPackFrame } from '@ihui/shared/chat/element-pack-history'

/** 历史回放消息的最小投影(ConversationMessage / 端内 ChatMessage 的结构子集) */
export interface ElementPackReplayableMessage {
  id: string
  role: string
  metadata?: unknown
  subagentActivities?: SubAgentActivity[]
}

/** spawn 帧 → 新建 running 活动(web addSubagentSpawn 同形) */
function spawnActivity(
  frame: Extract<ElementPackFrame, { kind: 'subagent_spawn' }>,
): SubAgentActivity {
  return {
    agentId: frame.id,
    name: frame.role || `Subagent ${frame.id.slice(-6)}`,
    type: 'worker',
    status: 'running',
    currentStep: frame.task || '执行中…',
    completedSteps: [],
  }
}

/** progress 帧 → 原位更新(web updateSubagentProgress 的 applyProgress 同形) */
function applyProgress(
  agent: SubAgentActivity,
  frame: Extract<ElementPackFrame, { kind: 'subagent_progress' }>,
): SubAgentActivity {
  const iter = frame.iteration ? ` (轮次 ${frame.iteration})` : ''
  let stepText = agent.currentStep
  switch (frame.phase) {
    case 'thinking':
      stepText = `思考中…${iter}`
      break
    case 'tool_call':
      stepText = `调用工具: ${frame.tool ?? 'unknown'}${iter}`
      break
    case 'tool_result':
      stepText = `${frame.tool ?? 'unknown'} ${frame.ok ? '✓' : '✗'}${iter}`
      break
    case 'output_ready':
      stepText = '输出就绪'
      break
  }
  const completedSteps =
    frame.phase === 'tool_result'
      ? [
          ...agent.completedSteps,
          {
            stepAction: `${frame.tool ?? 'unknown'} ${frame.ok ? '✓' : '✗'}`,
            createdAt: frame.timestamp,
            status: (frame.ok ? 'completed' : 'failed') as 'completed' | 'failed',
          },
        ]
      : agent.completedSteps
  return {
    ...agent,
    currentStep: stepText,
    progressPhase: frame.phase,
    progressIteration: frame.iteration ?? agent.progressIteration,
    progressTool: frame.tool ?? agent.progressTool,
    toolCallsCount:
      frame.phase === 'tool_result' ? (agent.toolCallsCount ?? 0) + 1 : (agent.toolCallsCount ?? 0),
    completedSteps,
    outputPreview: frame.outputPreview ?? agent.outputPreview,
  }
}

/** end 帧 → 结算(web markSubagentEnd 的 applyEnd 同形) */
function applyEnd(
  agent: SubAgentActivity,
  frame: Extract<ElementPackFrame, { kind: 'subagent_end' }>,
): SubAgentActivity {
  if (frame.status === 'failed') {
    return {
      ...agent,
      status: 'failed',
      currentStep: frame.failureReason ? `失败:${frame.failureReason.slice(0, 200)}` : '执行失败',
      streamingDone: true,
    }
  }
  return {
    ...agent,
    status: 'completed',
    completedSteps: [
      ...agent.completedSteps,
      ...(agent.currentStep
        ? [
            {
              stepAction: agent.currentStep,
              createdAt: frame.timestamp,
              status: 'completed' as const,
            },
          ]
        : []),
    ],
    currentStep: '',
    streamingDone: true,
  }
}

/**
 * 把一条消息的元素包帧序列按落库顺序折算进 SubAgentActivity[](纯函数)。
 * 帧 kind 封闭集内全部有等价卡(subagent 块);无主帧(缺 spawn)整帧丢弃,
 * 全部无主时返回与输入等长的空活动列表之外的原始引用语义由调用方兜住。
 */
export function foldElementPackFrames(
  activities: readonly SubAgentActivity[],
  frames: readonly ElementPackFrame[],
): SubAgentActivity[] {
  let list = [...activities]
  for (const frame of frames) {
    if (frame.kind === 'subagent_spawn') {
      // 同 id 已存在原样保留(web addSubagentSpawn 去重分支同口径),不重建
      if (list.some((a) => a.agentId === frame.id)) continue
      list = [...list, spawnActivity(frame)]
      continue
    }
    // 无主帧不凭空造条目(tool-call-frames 第 2 条口径同源)
    const idx = list.findIndex((a) => a.agentId === frame.id)
    if (idx < 0) continue
    list[idx] =
      frame.kind === 'subagent_progress'
        ? applyProgress(list[idx]!, frame)
        : applyEnd(list[idx]!, frame)
  }
  return list
}

/**
 * 历史消息列表的水合面:凡 assistant 消息带 `metadata.elementPack` 就解析并
 * 折算出等价元素帧卡(挂 subagentActivities,渲染走既有 subagent 块)。
 * 坏值/无帧/全无主帧的消息原样返回(读回是回放,坏值不值得炸渲染)。
 */
export function hydrateElementPackActivities<T extends ElementPackReplayableMessage>(
  messages: readonly T[],
): T[] {
  return messages.map((m) => {
    if (m.role !== 'assistant') return m
    const frames = parseElementPackFrames(m.metadata)
    if (frames.length === 0) return m
    const activities = foldElementPackFrames(m.subagentActivities ?? [], frames)
    if (activities.length === 0) return m
    return { ...m, subagentActivities: activities }
  })
}
