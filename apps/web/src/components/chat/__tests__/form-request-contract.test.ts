// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// V3 #63(2026-09-27 立)—— form_request 契约登记段的**漂移锁**。
//
// 这一段是"契约补齐成一份真契约"里唯一能被自动化执行的那部分:
// 契约类型 (@ihui/shared 的 FormRequestFramePayload) 与解析通道形参
// (@ihui/api-client 的 StreamChatOptions['onFormRequest'] 形参) 必须逐字段同形。
// 任一侧改字段名/可选性而另一侧没跟上 ⇒ 下面两个编译期断言直接 tsc 红
// (红在类型层,不需要跑到运行时,正是本仓最贵的那一型:编译不红就一路漂)。
//
// 同时钉住一条**设计判断**:form_request 今天刻意不在 SSE_EVENTS 里。
// 判据是 parity 门 `scripts/check-agent-event-parity.mjs` 的对账 0
// (TS contract.ts 与 apps/ai-service sse_contract.py 的 SSE_EVENTS 必须逐名等值,
// blocking)与对账 0b(契约 ⊆ llm.py 生产面)—— 后端两侧对 form_request 零生产点,
// 单侧塞名字进去就是一台与任何提交都无关的恒红门(§12e 同型)。
// **本条断言翻红是好消息**:说明解阻前置三条(contract.ts 注释③)已落地,
// 正确处置是把该帧并入 SSE_EVENTS + sse_contract.py,并删掉本用例。
import { describe, expect, it } from 'vitest'

import type { StreamChatOptions } from '@ihui/api-client'
import { FORM_FRAME_EVENTS, SSE_EVENT_NAMES, type FormRequestFramePayload } from '@ihui/shared'

/** 解析通道回调的形参类型(api-client 内部命名 FormRequestEvent,未列进 index 导出面) */
type WireFormRequestEvent = NonNullable<StreamChatOptions['onFormRequest']> extends (
  event: infer E,
) => void
  ? E
  : never

// —— 编译期双向可赋值(值必须是 true,写不出 true 就是 tsc 红)——
const CONTRACT_MATCHES_WIRE: FormRequestFramePayload extends WireFormRequestEvent ? true : false =
  true
const WIRE_MATCHES_CONTRACT: WireFormRequestEvent extends FormRequestFramePayload ? true : false =
  true

describe('V3 #63 form_request 契约登记 / 漂移锁', () => {
  it('契约类型与 api-client 解析通道形参逐字段同形(双向,编译期)', () => {
    expect(CONTRACT_MATCHES_WIRE).toBe(true)
    expect(WIRE_MATCHES_CONTRACT).toBe(true)
  })

  it('两帧判别名按登记值出线(端内不得再写第三处字面量)', () => {
    expect(FORM_FRAME_EVENTS.REQUEST).toBe('form_request')
    expect(FORM_FRAME_EVENTS.RESPONSE).toBe('form_response')
  })

  it('form_request 尚未并入跨语言 SSE_EVENTS(生产点未落地;并入即应删本用例)', () => {
    expect(SSE_EVENT_NAMES as readonly string[]).not.toContain(FORM_FRAME_EVENTS.REQUEST)
  })

  it('登记段成员不污染既有契约集合(SSE_EVENTS 的 28 个成员一个不多一个不少)', () => {
    // 本票只"新增一段独立登记",不得改既有成员形状 —— 这一格是那条约束的反向锁:
    // 若有人图省事把 form_request 塞进 SSE_EVENTS,这里先红(而不是等 parity 门红)。
    expect(SSE_EVENT_NAMES).toHaveLength(28)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
