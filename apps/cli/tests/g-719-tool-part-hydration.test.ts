// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-719(2026-10-03):会话水合读侧唯一入口(hydrateToolStateMap)与双读侧接线的回归钉。
 *
 * 判据(逐字取自台账):镜像两条成对断言在这里以**读侧行为**再钉一遍 ——
 *   内层未知键 ⇒ 整块拒(该条 display 放弃,外层 passthrough 字段保留,行照常读出);
 *   顶层未知键 ⇒ 保留(随 hydrated 值透传)。
 * 版本号必须有消费者:未知/缺席版本 ⇒ 单独的 `version` 档(不是混在 invalid 里)。
 * 非本族形状的 toolState 条目 ⇒ untouched(不误伤其他用途)。
 * 双读侧接线(subagents/state-store.decodeStateRow + sessions/state-store.load)
 * 用真夹具端到端:降级条目剥 display 后**整行照常读出**,行为不变量不破。
 * 全程零生产目录(IHUI_SUBAGENT_STATE_DIR / 会话目录都指临时夹具)。
 */

import assert from 'node:assert/strict'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'vitest'
import { hydratePersistedToolPart, hydrateToolStateMap } from '../src/sessions/tool-part-hydration.js'
import { readSubagentState } from '../src/subagents/state-store.js'
import { load as _loadSession } from '../src/sessions/state-store.js'

const V1_PAYLOAD = {
  schemaVersion: 1,
  toolCallId: 'call_1',
  toolName: 'edit_file',
  display: { kind: 'text', text: '已写入 3 处' },
}

describe('hydratePersistedToolPart —— 单条三态', () => {
  it('内层未知键 ⇒ degraded/invalid(整块拒;display 放弃)', () => {
    const r = hydratePersistedToolPart('call_1', {
      ...V1_PAYLOAD,
      display: { ...V1_PAYLOAD.display, ghostField: 1 },
    })
    assert.equal(r.outcome, 'degraded')
    assert.ok(r.outcome === 'degraded' && r.reason === 'invalid')
    assert.ok(r.outcome === 'degraded' && r.issues?.some((i) => i.includes('ghostField')))
  })

  it('顶层未知键 ⇒ hydrated 且 passthrough 字段保留', () => {
    const r = hydratePersistedToolPart('call_1', { ...V1_PAYLOAD, futureTopField: { a: 1 } })
    assert.ok(r.outcome === 'hydrated')
    assert.ok(
      r.outcome === 'hydrated' &&
        (r.value as unknown as Record<string, unknown>)['futureTopField'] !== undefined,
    )
  })

  it('未知/缺席 schemaVersion ⇒ degraded/version(版本号有真实消费者,不是空支票)', () => {
    for (const schemaVersion of [2, undefined]) {
      const r = hydratePersistedToolPart('call_x', { ...V1_PAYLOAD, schemaVersion })
      assert.ok(r.outcome === 'degraded' && r.reason === 'version', `schemaVersion=${schemaVersion}`)
    }
  })

  it('非本族形状(无 toolName/display)⇒ untouched,一个字节不动', () => {
    const v = { nested: { deep: true }, count: 3 }
    const r = hydratePersistedToolPart('some-tool', v)
    assert.ok(r.outcome === 'untouched')
  })
})

describe('hydrateToolStateMap —— 整表水合', () => {
  it('混合表:合法条目水合、非法条目剥 display 保外层、普通条目透传', () => {
    const { toolState, report } = hydrateToolStateMap({
      good: V1_PAYLOAD,
      bad: { ...V1_PAYLOAD, display: { kind: 'text', text: 'x', ghost: 2 } },
      plain: { whatever: 1 },
    })
    assert.equal(report.hydrated, 1)
    assert.equal(report.degraded, 1)
    assert.equal(report.untouched, 1)
    // 降级条目:display 被剥,外层字段(toolCallId/toolName)保留
    const degraded = toolState['bad'] as Record<string, unknown>
    assert.equal('display' in degraded, false)
    assert.equal(degraded['toolName'], 'edit_file')
    assert.equal(degraded['toolCallId'], 'call_1')
  })

  it('undefined/空表 ⇒ 空映射 + 零报告', () => {
    for (const input of [undefined, {}]) {
      const { report } = hydrateToolStateMap(input as Record<string, unknown> | undefined)
      assert.equal(report.hydrated + report.degraded + report.untouched, 0)
    }
  })
})

describe('双读侧接线端到端(真夹具)', () => {
  let tmpDir = ''
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'g719-state-'))
    process.env.IHUI_SUBAGENT_STATE_DIR = tmpDir
  })
  afterEach(() => {
    delete process.env.IHUI_SUBAGENT_STATE_DIR
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('decodeStateRow:toolState 带非法 display 的元数据 ⇒ 行照常读出,display 被剥', () => {
    const row = {
      id: 'sa-1',
      parentId: 'parent-1',
      persona: 'coder',
      capabilityMode: 'default',
      isolation: 'none',
      transcript: [],
      status: 'running',
      startedAt: '2026-10-03T00:00:00Z',
      toolState: {
        bad: { ...V1_PAYLOAD, display: { kind: 'text', text: 'x', ghost: 2 } },
      },
    }
    fs.writeFileSync(path.join(tmpDir, 'sa-1.json'), JSON.stringify(row))
    const r = readSubagentState('sa-1')
    assert.equal(r.stateKnown, true)
    assert.ok(r.state)
    const toolState = (r.state as { toolState?: Record<string, unknown> }).toolState
    assert.equal('display' in (toolState?.['bad'] as Record<string, unknown>), false)
  })

  it('decodeStateRow:合法 v1 元数据 ⇒ 原样透传(行读出且字段都在)', () => {
    const row = {
      id: 'sa-2',
      parentId: 'parent-1',
      persona: 'coder',
      capabilityMode: 'default',
      isolation: 'none',
      transcript: [],
      status: 'completed',
      startedAt: '2026-10-03T00:00:00Z',
      toolState: { good: V1_PAYLOAD },
    }
    fs.writeFileSync(path.join(tmpDir, 'sa-2.json'), JSON.stringify(row))
    const r = readSubagentState('sa-2')
    assert.equal(r.stateKnown, true)
    const toolState = (r.state as { toolState?: Record<string, unknown> }).toolState
    assert.deepEqual(toolState?.['good'], V1_PAYLOAD)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠