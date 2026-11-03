// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import {
  ELEMENT_PACK_FRAME_KINDS,
  ELEMENT_PACK_METADATA_KEY,
  ELEMENT_PACK_FRAMES_KEY,
  collectElementPackFrame,
  parseElementPackFrames,
  buildElementPackMetadata,
} from '../element-pack-history'

/**
 * D64⑤ 元素包历史落库 —— 判定层用例(2026-10-14 立)。
 *
 * 收窄判据与 packages/shared/src/utils/sse-parse.ts 的 subagent 三分支逐字段同形;
 * 漂移的表现是"网关落库的帧与端内解析的帧不一致",两侧测试共用同一判例表钉住。
 */
describe('collectElementPackFrame(写侧收窄)', () => {
  it('subagent_spawn:关键字段收窄,缺 timestamp 补 ISO', () => {
    const f = collectElementPackFrame({
      type: 'subagent_spawn',
      id: 'sa1',
      role: 'researcher',
      task: '查资料',
    })
    expect(f).not.toBeNull()
    expect(f!.kind).toBe('subagent_spawn')
    expect(f!.id).toBe('sa1')
    expect((f as { role: string }).role).toBe('researcher')
    expect((f as { task: string }).task).toBe('查资料')
    expect(typeof (f as { timestamp: string }).timestamp).toBe('string')
  })

  it('subagent_progress:四个契约 phase 全放行;snake_case output_preview 映射 outputPreview', () => {
    for (const phase of ['thinking', 'tool_call', 'tool_result', 'output_ready'] as const) {
      const f = collectElementPackFrame({ type: 'subagent_progress', id: 'sa1', phase })
      expect(f).not.toBeNull()
      expect((f as { phase: string }).phase).toBe(phase)
    }
    const f = collectElementPackFrame({
      type: 'subagent_progress',
      id: 'sa1',
      phase: 'tool_result',
      ok: false,
      output_preview: 'stdout 片段',
      agentName: '搜索代理',
      iteration: 2,
    })
    expect(f).toMatchObject({
      phase: 'tool_result',
      ok: false,
      outputPreview: 'stdout 片段',
      agentName: '搜索代理',
      iteration: 2,
    })
  })

  it('subagent_progress:表外 phase ⇒ null(不造残帧)', () => {
    expect(collectElementPackFrame({ type: 'subagent_progress', id: 'sa1', phase: 'running' })).toBeNull()
  })

  it('subagent_end:status 非 failed 归一为 done;failureReason 透传', () => {
    const done = collectElementPackFrame({ type: 'subagent_end', id: 'sa1' })
    expect((done as { status: string }).status).toBe('done')
    const failed = collectElementPackFrame({
      type: 'subagent_end',
      id: 'sa1',
      status: 'failed',
      failureReason: 'timeout',
    })
    expect((failed as { status: string }).status).toBe('failed')
    expect((failed as { failureReason?: string }).failureReason).toBe('timeout')
  })

  it('未知种类 / 缺 id / 非对象 ⇒ null', () => {
    expect(collectElementPackFrame({ type: 'chunk', id: 'x' })).toBeNull()
    expect(collectElementPackFrame({ type: 'subagent_spawn' })).toBeNull()
    expect(collectElementPackFrame('subagent_spawn')).toBeNull()
    expect(collectElementPackFrame(null)).toBeNull()
  })

  it('种类封闭集恒为三帧族', () => {
    expect([...ELEMENT_PACK_FRAME_KINDS]).toEqual([
      'subagent_spawn',
      'subagent_progress',
      'subagent_end',
    ])
  })
})

describe('parseElementPackFrames(读侧守卫)', () => {
  const frame = { kind: 'subagent_spawn', id: 'sa1', role: 'r', task: 't', timestamp: '2026-10-14T00:00:00.000Z' }

  it('合法 metadata.elementPack.frames 全量读回', () => {
    const meta = { [ELEMENT_PACK_METADATA_KEY]: { [ELEMENT_PACK_FRAMES_KEY]: [frame] } }
    expect(parseElementPackFrames(meta)).toEqual([frame])
  })

  it('键缺席 / 非 metadata / frames 非数组 / 元素判不过 ⇒ 空数组(不抛)', () => {
    expect(parseElementPackFrames(null)).toEqual([])
    expect(parseElementPackFrames({})).toEqual([])
    expect(parseElementPackFrames({ elementPack: { frames: 'x' } })).toEqual([])
    expect(
      parseElementPackFrames({
        elementPack: { frames: [{ kind: 'unknown_kind', id: 'x', timestamp: 't' }, frame] },
      }),
    ).toEqual([frame])
  })
})

describe('buildElementPackMetadata(落库形状唯一出口)', () => {
  it('空数组 ⇒ null(无内容不写 key)', () => {
    expect(buildElementPackMetadata([])).toBeNull()
  })

  it('非空 ⇒ { frames: [...] }', () => {
    const frame = { kind: 'subagent_end', id: 'sa1', status: 'done', timestamp: 't' } as const
    expect(buildElementPackMetadata([frame])).toEqual({ frames: [frame] })
  })
})
