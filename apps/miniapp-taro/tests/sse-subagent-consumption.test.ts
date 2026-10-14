// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * sse-subagent-consumption.test.ts — D64④ miniapp 子任务帧(subagent)消费链路回归钉
 *
 * 立票背景(2026-09-25,台账 D64④):
 *   判据 = miniapp 端对共享 SSE 层的子任务帧(subagent_spawn / subagent_progress /
 *   subagent_end,契约定义在 packages/shared/src/sse/contract.ts)至少**显式消费**
 *   (映射到 UI 或通用状态行),不是静默丢弃。
 *
 *   取证结论(本测试立项当轮):
 *   - 契约:contract.ts SSE_EVENTS.SUBAGENT_SPAWN/PROGRESS/END(事件名在 HEAD)。
 *   - 解析:packages/shared/src/utils/sse-parse.ts 识别三帧(端内 @/utils/sse-parse 仅 re-export)。
 *   - 分发:src/api/index.ts dispatch → onSubagentSpawn/Progress/End 回调(该文件他人在飞,本测试不 import 它,
 *     以免测到未提交改动)。
 *   - 消费:src/pkg-ai/ai/chat.tsx 三回调 → pushStreamActivity(t('ai.stream.subagent', { phase }))。
 *
 *   本测试钉住链路两端中**稳定可测**的三段:解析行为(经 re-export 的共享解析器)、
 *   chat.tsx 消费接线(源码锚,判据同守门风格)、五语言文案键齐。
 *   分发层(api/index.ts)刻意不 import —— vitest 按磁盘运行,该文件在飞,测它等于测别人未提交的代码。
 */

import { describe, it, expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// 端内解析入口(re-export @ihui/shared/utils/sse-parse)——与 tests/sse-parse.test.ts 同一 import 面
import { parseSSEChunk } from '../src/utils/sse-parse'

// 5 语言 JSON 直接 import(与 tests/i18n-icu-antipattern.test.tsx 同一路径面)
import msgsZhCN from '@ihui/i18n/messages/miniapp-taro/zh-CN.json'
import msgsEn from '@ihui/i18n/messages/miniapp-taro/en.json'
import msgsJa from '@ihui/i18n/messages/miniapp-taro/ja.json'
import msgsKo from '@ihui/i18n/messages/miniapp-taro/ko.json'
import msgsZhTW from '@ihui/i18n/messages/miniapp-taro/zh-TW.json'

const HERE = dirname(fileURLToPath(import.meta.url))

describe('D64④ miniapp 子任务帧消费链路', () => {
  describe('解析层:parseSSEChunk 识别 subagent 三帧(共享契约)', () => {
    it('subagent_spawn 帧解析为 subagentSpawn 载荷(id/role/task)', () => {
      const { events } = parseSSEChunk(
        'data: {"type":"subagent_spawn","id":"sa-1","role":"validator","task":"check result","timestamp":"2026-09-25T00:00:00Z"}\n',
      )
      expect(events).toHaveLength(1)
      const evt = events[0]!
      expect(evt.type).toBe('subagent_spawn')
      expect(evt.subagentSpawn?.id).toBe('sa-1')
      expect(evt.subagentSpawn?.role).toBe('validator')
      expect(evt.subagentSpawn?.task).toBe('check result')
    })

    it('subagent_progress 帧(phase=tool_call)解析为 subagentProgress 载荷', () => {
      const { events } = parseSSEChunk(
        'data: {"type":"subagent_progress","id":"sa-1","phase":"tool_call","tool":"grep","iteration":2,"timestamp":"2026-09-25T00:00:01Z"}\n',
      )
      expect(events).toHaveLength(1)
      const evt = events[0]!
      expect(evt.type).toBe('subagent_progress')
      expect(evt.subagentProgress?.phase).toBe('tool_call')
      expect(evt.subagentProgress?.tool).toBe('grep')
      expect(evt.subagentProgress?.iteration).toBe(2)
    })

    it('subagent_progress 帧(phase=output_ready)映射 snake_case output_preview', () => {
      const { events } = parseSSEChunk(
        'data: {"type":"subagent_progress","id":"sa-1","phase":"output_ready","output_preview":"final answer preview","timestamp":"2026-09-25T00:00:02Z"}\n',
      )
      const evt = events[0]!
      expect(evt.type).toBe('subagent_progress')
      expect(evt.subagentProgress?.outputPreview).toBe('final answer preview')
    })

    it('subagent_progress phase 非契约值不得产出 subagent_progress 事件', () => {
      const { events } = parseSSEChunk(
        'data: {"type":"subagent_progress","id":"sa-1","phase":"bogus_phase","timestamp":"2026-09-25T00:00:03Z"}\n',
      )
      expect(events.filter((e) => e.type === 'subagent_progress')).toHaveLength(0)
    })

    it('subagent_end 帧 status=failed 透传失败原因', () => {
      const { events } = parseSSEChunk(
        'data: {"type":"subagent_end","id":"sa-1","status":"failed","failureReason":"boom","timestamp":"2026-09-25T00:00:04Z"}\n',
      )
      expect(events).toHaveLength(1)
      const evt = events[0]!
      expect(evt.type).toBe('subagent_end')
      expect(evt.subagentEnd?.status).toBe('failed')
      expect(evt.subagentEnd?.failureReason).toBe('boom')
    })

    it('subagent_end 帧缺省 status 归一为 done', () => {
      const { events } = parseSSEChunk(
        'data: {"type":"subagent_end","id":"sa-1","timestamp":"2026-09-25T00:00:05Z"}\n',
      )
      const evt = events[0]!
      expect(evt.type).toBe('subagent_end')
      expect(evt.subagentEnd?.status).toBe('done')
    })
  })

  describe('消费层:chat.tsx 对三帧显式消费(非静默丢)', () => {
    it('onSubagentSpawn/Progress/End 均接线到 pushStreamActivity + ai.stream.subagent', async () => {
      const src = await readFile(join(HERE, '../src/pkg-ai/ai/chat.tsx'), 'utf-8')
      const callbackNames = ['onSubagentSpawn', 'onSubagentProgress', 'onSubagentEnd'] as const
      for (const name of callbackNames) {
        // 形态: onSubagentXxx: (evt) =>
        //            pushStreamActivity(t('ai.stream.subagent', { phase: evt.<field> })),
        const re = new RegExp(
          `${name}:\\s*\\(evt\\)\\s*=>\\s*pushStreamActivity\\(\\s*t\\('ai\\.stream\\.subagent'`,
        )
        expect(src, `${name} 子任务帧消费接线缺失(D64④:不得静默丢弃)`).toMatch(re)
      }
    })

    it('流式执行过程列表渲染出口在位(pushStreamActivity 写入 streamActivities)', async () => {
      const src = await readFile(join(HERE, '../src/pkg-ai/ai/chat.tsx'), 'utf-8')
      expect(src).toContain('const [streamActivities, setStreamActivities]')
      expect(src).toContain('setStreamActivities((prev) => [...prev, { id, text }]')
    })
  })

  describe('文案层:五语言 ai.stream.subagent 键齐且带 phase 占位符', () => {
    type Msgs = { ai?: { stream?: { subagent?: unknown } } }
    const table: ReadonlyArray<[string, Msgs]> = [
      ['zh-CN', msgsZhCN as Msgs],
      ['en', msgsEn as Msgs],
      ['ja', msgsJa as Msgs],
      ['ko', msgsKo as Msgs],
      ['zh-TW', msgsZhTW as Msgs],
    ]

    it.each(table)('%s:ai.stream.subagent 为非空字符串且含 {phase} 占位符', (_locale, msgs) => {
      const value = msgs.ai?.stream?.subagent
      expect(typeof value).toBe('string')
      expect(value as string).not.toBe('')
      expect(value as string).toContain('phase')
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
