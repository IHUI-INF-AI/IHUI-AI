// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票 B02(V2 #23)余面①(2026-10-25):送信契约对 chat-sync 帧名的**引用锁**。
 *
 * 立因:`packages/shared/src/sse/contract.ts` 此前对 `message:created` / `message:patched`
 * 零命中 —— 两套帧名分居两个包,只靠"值恰好相同"保持自洽。本锁判四格:
 *   A **引用同一对象**(`toBe`,不是 `toEqual`):有人在本文件重写一份同值字面量,
 *     引用立刻不等 —— 值相同骗不过 A;
 *   B 值逐字锁定(从消费侧再看一遍,防上游被改成别的名字而这里悄悄跟随),
 *     含 terminal(v2 独立帧)的族内互异;
 *   C **不并进 `SSE_EVENTS`**:`isSSEEventName` 对三枚必须 false(`SSE_EVENTS` 与
 *     ai-service 逐名对账,并进去 = parity 恒红;分发层也不该把消息面帧当生成流处理);
 *     正控:既有生成流帧(chunk/done)判定照旧 true —— 旧行为不被误伤;
 *   D 形状锁:本包 `contract.ts` 源码不得出现三枚帧名的**引号字面量**
 *     (值只许在 `@ihui/types` 的 `CHAT_SYNC_EVENT_NAMES` 定义一处)。
 */
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'
import { CHAT_SYNC_EVENT_NAMES } from '@ihui/types'

import { SSE_CHAT_SYNC_EVENT_NAMES, SSE_EVENT_NAMES, isSSEEventName } from '../contract'

describe('帧名引用 A:与 @ihui/types 是同一个对象', () => {
  it('SSE_CHAT_SYNC_EVENT_NAMES === CHAT_SYNC_EVENT_NAMES(引用级)', () => {
    expect(SSE_CHAT_SYNC_EVENT_NAMES).toBe(CHAT_SYNC_EVENT_NAMES)
  })
})

describe('帧名引用 B:值逐字锁定', () => {
  it('两枚值就是线上锚点,且互不相同', () => {
    expect(SSE_CHAT_SYNC_EVENT_NAMES.MESSAGE_CREATED).toBe('message:created')
    expect(SSE_CHAT_SYNC_EVENT_NAMES.MESSAGE_PATCHED).toBe('message:patched')
    expect(SSE_CHAT_SYNC_EVENT_NAMES.MESSAGE_CREATED).not.toBe(
      SSE_CHAT_SYNC_EVENT_NAMES.MESSAGE_PATCHED,
    )
  })

  it('terminal 帧名属于同一族且逐字锁定(v2 独立帧,不得写回 patched)', () => {
    expect(SSE_CHAT_SYNC_EVENT_NAMES.MESSAGE_TERMINAL).toBe('message:terminal')
    const names = Object.values(SSE_CHAT_SYNC_EVENT_NAMES)
    // 同族三枚互不相同:把 terminal 并回 patched 的可选字段会在这里当场露馅
    expect(new Set(names).size).toBe(names.length)
    expect(SSE_CHAT_SYNC_EVENT_NAMES.MESSAGE_TERMINAL).not.toBe(
      SSE_CHAT_SYNC_EVENT_NAMES.MESSAGE_PATCHED,
    )
  })
})

describe('帧名引用 C:不并进 SSE_EVENTS(isSSEEventName 判 false)', () => {
  it('三枚帧名都不在生成流词汇表里', () => {
    for (const name of Object.values(SSE_CHAT_SYNC_EVENT_NAMES)) {
      expect(SSE_EVENT_NAMES as readonly string[]).not.toContain(name)
      expect(isSSEEventName(name)).toBe(false)
    }
  })

  it('负控:无前缀兜底 —— 同族但未登记的名字也不得被判成 SSE 事件', () => {
    expect(isSSEEventName('message:unknown')).toBe(false)
  })

  it('正控:既有生成流帧判定不受影响', () => {
    expect(isSSEEventName('chunk')).toBe(true)
    expect(isSSEEventName('done')).toBe(true)
  })
})

describe('帧名引用 D:contract.ts 源码不重复定义帧名字面量', () => {
  it("源码中不出现 'message:created' / 'message:patched' / 'message:terminal' 的引号字面量", () => {
    const source = readFileSync(new URL('../contract.ts', import.meta.url), 'utf8')
    // 只判**带引号**的字面量:注释里叙述帧名(不带引号)不是第二份值。
    expect(source).not.toMatch(/['"]message:(?:created|patched|terminal)['"]/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
