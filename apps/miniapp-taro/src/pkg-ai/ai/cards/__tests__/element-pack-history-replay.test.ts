// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * element-pack-history-replay.test.ts — D64 端内历史回放消费链路回归钉(2026-10-14)。
 *
 * 钉住三段:
 * ① 读侧守卫:metadata.elementPack.frames 形态判据(坏值按「无元素包」处理,不炸渲染);
 * ② 帧→卡重放:历史帧按落库序喂流式归并函数,回放结果与直播同一收敛逻辑
 *    (直播接线形态由 tests/sse-subagent-consumption.test.ts 钉住,两侧同判例表);
 * ③ 水合出口:mapServerMessage 把 metadata.elementPack 重放进 aiCards.subagentTasks,
 *    首屏回放与「更早一页」翻页共用该函数(链路见 server-chat-replay.ts)。
 */
import { describe, expect, it } from 'vitest'

import {
  ELEMENT_PACK_FRAMES_KEY,
  ELEMENT_PACK_METADATA_KEY,
  parseElementPackFrames,
  readSubagentTasksFromMetadata,
  replayElementPackFrames,
} from '../element-pack-history'
import { mapServerMessage } from '../../server-chat-replay'

const spawnFrame = {
  kind: 'subagent_spawn' as const,
  id: 'sa-1',
  role: 'validator',
  task: '校验第 3 步输出',
  timestamp: '2026-10-14T08:00:00.000Z',
}
const progressFrame = {
  kind: 'subagent_progress' as const,
  id: 'sa-1',
  phase: 'tool_call' as const,
  timestamp: '2026-10-14T08:00:01.000Z',
  tool: 'grep',
}
const endFrame = {
  kind: 'subagent_end' as const,
  id: 'sa-1',
  status: 'failed' as const,
  failureReason: 'boom',
  timestamp: '2026-10-14T08:00:02.000Z',
}

describe('读侧守卫:parseElementPackFrames', () => {
  it('键名出口钉死(与 shared 契约同值:metadata.elementPack.frames)', () => {
    expect(ELEMENT_PACK_METADATA_KEY).toBe('elementPack')
    expect(ELEMENT_PACK_FRAMES_KEY).toBe('frames')
  })

  it('合法帧数组原样读回', () => {
    const metadata = { [ELEMENT_PACK_METADATA_KEY]: { [ELEMENT_PACK_FRAMES_KEY]: [spawnFrame] } }
    expect(parseElementPackFrames(metadata)).toEqual([spawnFrame])
  })

  it.each([
    ['metadata 缺席', undefined],
    ['metadata 非对象', 'nope'],
    ['elementPack 键缺席', {}],
    ['elementPack 非对象', { [ELEMENT_PACK_METADATA_KEY]: 'x' }],
    ['frames 非数组', { [ELEMENT_PACK_METADATA_KEY]: { [ELEMENT_PACK_FRAMES_KEY]: 1 } }],
    [
      'frames 含非对象元素(落库 JSON 里的字符串/null/数字)',
      { [ELEMENT_PACK_METADATA_KEY]: { [ELEMENT_PACK_FRAMES_KEY]: ['junk', null, 42] } },
    ],
  ])('%s ⇒ 空数组(不抛)', (_name, metadata) => {
    expect(parseElementPackFrames(metadata)).toEqual([])
  })

  it('坏帧逐条丢弃,好帧保留(未知 kind / 缺 id / 缺 timestamp / phase 非契约值 / end.status 非法)', () => {
    const frames = [
      spawnFrame,
      { kind: 'unknown_kind', id: 'x', timestamp: 't' },
      { kind: 'subagent_spawn', timestamp: 't' }, // 缺 id
      { kind: 'subagent_progress', id: 'x', phase: 'bogus', timestamp: 't' }, // phase 非契约值
      { kind: 'subagent_end', id: 'x', status: 'nope', timestamp: 't' }, // status 非法
    ]
    expect(parseElementPackFrames({ [ELEMENT_PACK_METADATA_KEY]: { frames } })).toEqual([
      spawnFrame,
    ])
  })
})

describe('帧→卡重放:replayElementPackFrames(与直播同一套归并函数)', () => {
  it('spawn→progress→end 按落库序收敛:failed end 带 failureReason,终态不回退', () => {
    const tasks = replayElementPackFrames([spawnFrame, progressFrame, endFrame])
    expect(tasks).toEqual([
      {
        id: 'sa-1',
        role: 'validator',
        task: '校验第 3 步输出',
        status: 'failed',
        currentPhase: 'tool_call',
        failureReason: 'boom',
      },
    ])
  })

  it('end.status=done 收敛为 completed(八态 success tone 由 backgroundTaskView 判定,此处不重复)', () => {
    const tasks = replayElementPackFrames([
      spawnFrame,
      { ...endFrame, status: 'done' as const, failureReason: undefined },
    ])
    expect(tasks[0]?.status).toBe('completed')
  })

  it('多 id 各成一卡,顺序与落库序一致', () => {
    const tasks = replayElementPackFrames([
      spawnFrame,
      { ...spawnFrame, id: 'sa-2', role: 'reviewer' },
    ])
    expect(tasks.map((t) => t.id)).toEqual(['sa-1', 'sa-2'])
    expect(tasks[1]?.status).toBe('running') // 无 end 帧:历史快照停在运行态
  })
})

describe('水合出口:mapServerMessage 消费 metadata.elementPack', () => {
  const base = {
    id: 'm1',
    conversationId: 'conv-1',
    role: 'assistant' as const,
    content: '完成',
    tokens: 0,
    createdAt: '2026-10-14T08:00:03.000Z',
  }

  it('带 elementPack 的历史消息重放出 aiCards.subagentTasks', () => {
    const msg = mapServerMessage({
      ...base,
      metadata: {
        [ELEMENT_PACK_METADATA_KEY]: { [ELEMENT_PACK_FRAMES_KEY]: [spawnFrame, endFrame] },
      },
    })
    expect(msg?.aiCards?.subagentTasks).toEqual([
      {
        id: 'sa-1',
        role: 'validator',
        task: '校验第 3 步输出',
        status: 'failed',
        failureReason: 'boom',
      },
    ])
  })

  it('无 elementPack 不挂 subagentTasks 键(空不写键,不渲染空态)', () => {
    const msg = mapServerMessage({ ...base, metadata: {} })
    expect(msg?.aiCards).toBeUndefined()
  })

  it('elementPack 全坏帧 ⇒ 同「无元素包」处理', () => {
    const msg = mapServerMessage({
      ...base,
      metadata: {
        [ELEMENT_PACK_METADATA_KEY]: {
          [ELEMENT_PACK_FRAMES_KEY]: [{ kind: 'not_a_frame', id: 'x' }],
        },
      },
    })
    expect(msg?.aiCards).toBeUndefined()
  })

  it('只有 elementPack、无其他卡族的消息也立 aiCards(否则八态卡整块消失)', () => {
    const msg = mapServerMessage({
      ...base,
      metadata: { [ELEMENT_PACK_METADATA_KEY]: { [ELEMENT_PACK_FRAMES_KEY]: [spawnFrame] } },
    })
    expect(msg?.aiCards?.planSteps).toEqual([])
    expect(msg?.aiCards?.subagentTasks).toHaveLength(1)
  })

  it('readSubagentTasksFromMetadata:有帧才产出,空帧返回 undefined', () => {
    expect(readSubagentTasksFromMetadata(undefined)).toBeUndefined()
    const only = readSubagentTasksFromMetadata({
      [ELEMENT_PACK_METADATA_KEY]: { [ELEMENT_PACK_FRAMES_KEY]: [spawnFrame] },
    })
    expect(only).toHaveLength(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
