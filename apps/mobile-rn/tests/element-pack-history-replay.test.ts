// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// D64⑤ 收口:元素包历史回放(RN 端)。
// 链路:chat_messages.metadata.elementPack.frames(后端 D64⑤ 落库)
//   → shared parseElementPackFrames 收窄守卫(坏形态按空数组处理)
//   → 本端 foldElementPackFrames 按 id 归并成最小回放视图(spawn/progress/end → 终值)
//   → subagentReplayRow 出一行一代理文案(状态词复用 elementPack.backgroundTask 八态同族)。
// 另锁 D38 收口的词包读面:inputNotices.queue.denied.* 已落 shared 五语言词包。
import { describe, expect, it } from 'vitest'

import sharedZhCN from '@ihui/i18n/messages/shared/zh-CN.json'
import sharedEn from '@ihui/i18n/messages/shared/en.json'
import {
  parseElementPackFrames,
  type ElementPackFrame,
} from '@ihui/shared/chat/element-pack-history'
import {
  foldElementPackFrames,
  subagentReplayRow,
  type SubagentReplayItem,
} from '../src/utils/chat-render-model'

const FRAMES: ElementPackFrame[] = [
  {
    kind: 'subagent_spawn',
    id: 'sa-1',
    role: 'coder',
    task: '修复登录超时',
    timestamp: '2026-10-14T08:00:00.000Z',
  },
  {
    kind: 'subagent_progress',
    id: 'sa-1',
    phase: 'tool_call',
    timestamp: '2026-10-14T08:00:01.000Z',
    tool: 'grep',
  },
  {
    kind: 'subagent_progress',
    id: 'sa-1',
    phase: 'tool_result',
    timestamp: '2026-10-14T08:00:02.000Z',
    tool: 'read_file',
    outputPreview: '...(30 行)',
  },
  { kind: 'subagent_end', id: 'sa-1', status: 'done', timestamp: '2026-10-14T08:00:03.000Z' },
  {
    kind: 'subagent_spawn',
    id: 'sa-2',
    role: 'reviewer',
    task: '复查补丁',
    timestamp: '2026-10-14T08:00:04.000Z',
  },
  {
    kind: 'subagent_end',
    id: 'sa-2',
    status: 'failed',
    failureReason: '补丁与主分支冲突',
    timestamp: '2026-10-14T08:00:05.000Z',
  },
]

describe('parseElementPackFrames(D64⑤ shared 读侧守卫,本端只消费)', () => {
  it('metadata.elementPack.frames 合法载荷 → 帧数组原样收窄', () => {
    const metadata = { elementPack: { frames: FRAMES } }
    expect(parseElementPackFrames(metadata)).toEqual(FRAMES)
  })

  it('键缺席 / 非对象 / frames 非数组 / 元素判不过 → 空数组(不炸渲染)', () => {
    expect(parseElementPackFrames(undefined)).toEqual([])
    expect(parseElementPackFrames(null)).toEqual([])
    expect(parseElementPackFrames({})).toEqual([])
    expect(parseElementPackFrames({ elementPack: { frames: 'nope' } })).toEqual([])
    expect(
      parseElementPackFrames({ elementPack: { frames: [{ kind: 'subagent_spawn', id: 7 }] } }),
    ).toEqual([])
  })
})

describe('foldElementPackFrames(本端渲染归并:按 id 折成终值视图)', () => {
  it('spawn/progress/end 归并成一项:task 承接、progress 保最后一次的 tool/phase、end 给终态', () => {
    const items = foldElementPackFrames(FRAMES)
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({
      id: 'sa-1',
      role: 'coder',
      task: '修复登录超时',
      lastPhase: 'tool_result',
      lastTool: 'read_file',
      outputPreview: '...(30 行)',
      status: 'done',
      progressCount: 2,
    })
    expect(items[1]).toMatchObject({
      id: 'sa-2',
      task: '复查补丁',
      status: 'failed',
      failureReason: '补丁与主分支冲突',
    })
  })

  it('保持首次出现顺序(spawn 先到者排前)', () => {
    expect(foldElementPackFrames(FRAMES).map((x) => x.id)).toEqual(['sa-1', 'sa-2'])
  })

  it('残帧最小降级:无 spawn(只有 progress/end)也成项,task 缺省、progressCount 照记', () => {
    const items = foldElementPackFrames([
      {
        kind: 'subagent_progress',
        id: 'orphan',
        phase: 'thinking',
        timestamp: '2026-10-14T08:00:00.000Z',
      },
      { kind: 'subagent_end', id: 'orphan', status: 'done', timestamp: '2026-10-14T08:01:00.000Z' },
    ])
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ id: 'orphan', status: 'done', progressCount: 1 })
    expect(items[0]?.task).toBeUndefined()
  })

  it('空帧数组 → 空视图(不渲染空态)', () => {
    expect(foldElementPackFrames([])).toEqual([])
  })
})

describe('subagentReplayRow(回放行文案:状态词复用 backgroundTask 八态同族)', () => {
  const t = (key: string): string => key

  it('done → completed 键(+最后工具);failed → failed 键 + 失败原因;无 end → running 键 + 最后工具', () => {
    const items = foldElementPackFrames(FRAMES)
    expect(subagentReplayRow(items[0] as SubagentReplayItem, t)).toBe(
      '修复登录超时 · ai.pane.elementPack.backgroundTask.state.completed · read_file',
    )
    expect(subagentReplayRow(items[1] as SubagentReplayItem, t)).toBe(
      '复查补丁 · ai.pane.elementPack.backgroundTask.state.failed · 补丁与主分支冲突',
    )
    const running = foldElementPackFrames([
      {
        kind: 'subagent_progress',
        id: 'wip',
        phase: 'tool_call',
        timestamp: '2026-10-14T08:00:00.000Z',
        tool: 'grep',
      },
    ])[0] as SubagentReplayItem
    expect(subagentReplayRow(running, t)).toBe(
      'wip · ai.pane.elementPack.backgroundTask.state.running · grep',
    )
  })

  it('head 兜底链:task 缺 → agentName → id', () => {
    const byName = foldElementPackFrames([
      {
        kind: 'subagent_progress',
        id: 'x',
        phase: 'output_ready',
        timestamp: '2026-10-14T08:00:00.000Z',
        agentName: '巡检员',
      },
    ])[0] as SubagentReplayItem
    expect(subagentReplayRow(byName, t).startsWith('巡检员 · ')).toBe(true)
  })
})

describe('inputNotices.queue.denied 词包已落 shared(D38 收口,RN 深合并后直取)', () => {
  const pick = (pack: Record<string, unknown>): unknown =>
    (pack as { ai?: { pane?: { inputNotices?: { queue?: { denied?: unknown } } } } })?.ai?.pane
      ?.inputNotices?.queue?.denied

  it('zh-CN / en 词包含 denied 六键(reorder/undo/interject + cause 三因)', () => {
    for (const pack of [sharedZhCN, sharedEn] as Array<Record<string, unknown>>) {
      const denied = pick(pack) as Record<string, unknown> | undefined
      expect(denied).toBeDefined()
      expect(denied?.reorder).toBeTruthy()
      expect(denied?.undo).toBeTruthy()
      expect(denied?.interject).toBeTruthy()
      const cause = denied?.cause as Record<string, unknown> | undefined
      expect(cause?.streaming).toBeTruthy()
      expect(cause?.emptyQueue).toBeTruthy()
      expect(cause?.runtimeNoInterject).toBeTruthy()
    }
  })
})
