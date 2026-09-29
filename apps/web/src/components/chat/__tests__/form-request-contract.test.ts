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
// 同时钉住一条**设计判断的历史**:form_request 曾刻意单列在 FORM_FRAME_EVENTS 一段里,
// 判据是 parity 门 `scripts/check-agent-event-parity.mjs` 的对账 0
// (TS contract.ts 与 apps/ai-service sse_contract.py 的 SSE_EVENTS 必须逐名等值,
// blocking)与对账 0b(契约 ⊆ llm.py 生产面)—— 当时后端两侧对 form_request 零生产点,
// 单侧塞名字进去就是一台与任何提交都无关的恒红门(§12e 同型)。
// 2026-09-27 V3 #63 落了生产点 ⇒ 该理由消失,帧已按 contract.ts 自己写在注释③(c)
// 的指令并入 SSE_EVENTS;本文件的判据随之**反向**(见下方用例组的注释)。
// 仍然成立的那半句:`form_response` 是上行 POST body,**不进** SSE_EVENTS。
import { describe, expect, it } from 'vitest'

import type { StreamChatOptions } from '@ihui/api-client'
import {
  FORM_FRAME_EVENTS,
  SSE_EVENTS,
  SSE_EVENT_NAMES,
  type FormRequestFramePayload,
} from '@ihui/shared'

/** 解析通道回调的形参类型(api-client 内部命名 FormRequestEvent,未列进 index 导出面) */
type WireFormRequestEvent =
  NonNullable<StreamChatOptions['onFormRequest']> extends (event: infer E) => void ? E : never

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

  it('form_request 已并入跨语言 SSE_EVENTS;上行那一条 form_response 仍在射程外', () => {
    // 本用例原本是 `not.toContain`,其自身注释写明"翻红是好消息 —— 解阻前置三条落地后
    // 应把该帧并入 SSE_EVENTS + sse_contract.py 并删掉本用例"。2026-09-27 V3 #63 那一票
    // 落了生产点(llm.py 的 request_business_form 拦截位)与 Python 契约登记,故按当时
    // 写下的指令把判据**反过来钉**:并回后若有人把它摘出去,这里红。
    // 反向半句同样必须有:form_response 是 POST body 不是 SSE 事件,列进 SSE_EVENTS
    // 会让「前端监听对账」把一次上行 POST 当成 SSE 监听去要后端 SSE 生产点。
    expect(SSE_EVENT_NAMES as readonly string[]).toContain(FORM_FRAME_EVENTS.REQUEST)
    expect(SSE_EVENT_NAMES as readonly string[]).not.toContain(FORM_FRAME_EVENTS.RESPONSE)
  })

  it('登记段与 SSE_EVENTS 共用一份字面量(不得留第二处 form_request 字符串)', () => {
    // 并回之后,REQUEST 必须是 SSE_EVENTS.FORM_REQUEST 的投影而不是又抄一遍字符串 ——
    // 两处各写一遍就是"同一事实两份真相",漂移时 parity 门与消费方看到不同名。
    expect(FORM_FRAME_EVENTS.REQUEST).toBe(SSE_EVENTS.FORM_REQUEST)
  })

  it('跨语言契约集合含 form_request,成员数按现读抬到 32', () => {
    // 注:这个绝对数是粗锁(任何一次合法新增事件都得跟着抬,D113 的 tool-delta 抬过一次,
    // D151 的 terminal_interaction 抬第二次);精确的那把锁是上面两条对成员在/不在的判定,
    // 它不随事件增减漂移。
    // 这一次抬 31→32 的原因是 `goal_updated` 由 `ff7bf27df2` 加进契约面:共享侧同名锁当场抬到 32,
    // web 侧这条漏改 ⇒ 它在干净 HEAD 上一直红(与任何人的提交内容都无关的红只会逼人跳钩子)。
    expect(SSE_EVENT_NAMES).toHaveLength(32)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
