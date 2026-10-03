// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-815966 反向用例:证明「状态 → 展示」映射漏一档会被编译器挡住,而不是运行时兜底。
 *
 * 本文件只做两件事:
 *   1. **反向用例**:`@ts-expect-error` 标注的故意漏一档赋值。若 `ToolCall['status']`
 *      新增一档而 `TRACE_STATUS` 没跟上,被抑制的那条错误会消失 ⇒ `@ts-expect-error`
 *      变成「此处无错误可抑制」⇒ `tsc --noEmit` 判红(`ts2578`)。
 *   2. **运行时用例**:遍历封闭集每一档,确认展示非空(挡 `''` / `undefined`)。
 *
 * ⚠️ 反向用例的价值全在 `@ts-expect-error` 那几行**保持可编译通过**。谁把 `TRACE_STATUS`
 *    改回 `Partial<Record<…>>`(即本卡要消灭的形态),漏一档就不再是错误 ⇒ 抑制失效 ⇒ 判红。
 *    这就是"缺一档可判"的机械构造面。
 */
import { describe, expect, it } from 'vitest'
import type { ToolCall } from '@ihui/types'
import { TRACE_STATUS } from '../trace-replay'

/** `ToolCall['status']` 的运行时封闭集(联合类型本身在编译期,测试要遍历须有一份值列表)。 */
const TOOL_CALL_STATUSES = ['running', 'success', 'error', 'cancelled'] as const

describe('G-815966 / TRACE_STATUS 完备性(反向用例)', () => {
  it('故意漏掉 cancelled 一档 ⇒ 必须编译期报错(此处无错可抑制则本卡失效)', () => {
    // ⚠️ 关键是类型注解写 `typeof TRACE_STATUS`(生产表自身类型),**不是**在测试里
    //    重抄一遍 `Record<ToolCall['status'], StreamStatus>`。
    //    重抄的那份与生产无关:生产改成 Partial 时测试照样绿,守卫形同虚设
    //    (2026-10-03 实测踩过这个坑,见本卡交付说明)。
    //    绑 `typeof` 后:生产是完备 Record ⇒ 漏一档报错 ⇒ 被抑制;
    //    生产退回 Partial ⇒ 漏一档不再是错误 ⇒ 本行 ts2578「无错误可抑制」⇒ 判红。
    // @ts-expect-error 故意漏一档:完备 Record<Union, T> 缺键必须报错。
    const _missingOne: typeof TRACE_STATUS = {
      running: 'running',
      success: 'success',
      error: 'error',
    }
    // 仅为避免 noUnusedLocals 报错,断言它确实不完整:漏的那档取值恒为 undefined。
    expect(_missingOne.cancelled).toBeUndefined()
  })

  it('封闭集联合类型新增一档时,这行必须判红(判据=Exclude 归零)', () => {
    // 这是"新增一档"的第一道闸:与 TRACE_STATUS 的写法无关,只盯 ToolCall['status']。
    // Exclude 为 never ⇒ true;一旦联合类型多出一档,类型退化成 { missing: … },
    // 赋 true 即 ts2322 判红。
    type Unhandled = Exclude<
      ToolCall['status'],
      'running' | 'success' | 'error' | 'cancelled'
    >
    const _noUnhandledStatus: Unhandled extends never ? true : { missing: Unhandled } = true
    expect(_noUnhandledStatus).toBe(true)
  })

  it('故意多出一档不在联合类型里的键 ⇒ 也必须报错(防止随便加键糊过去)', () => {
    const _extraKey: typeof TRACE_STATUS = {
      running: 'running',
      success: 'success',
      error: 'error',
      cancelled: 'skipped',
      // ⚠️ 抑制注释必须贴在这一行:多余键的 ts2353 报在**属性所在行**,不是声明行。
      //贴在对象声明那行会变成「无错误可抑制」(ts2578)—— 实测踩过。
      // @ts-expect-error 'archived' 不在 ToolCall['status'] 联合类型内,赋值应被拒。
      archived: 'skipped',
    }
    expect(Object.keys(_extraKey)).toHaveLength(5)
  })
})

describe('G-815966 / TRACE_STATUS 完备性(运行时)', () => {
  it('封闭集每一档都有展示,且键集与联合类型完全一致(不多不少)', () => {
    // 键数一致 ⇒ 没漏(漏了键数就少);键集相等 ⇒ 没多(多出来的键上面那条已挡)。
    expect(Object.keys(TRACE_STATUS).sort()).toEqual([...TOOL_CALL_STATUSES].sort())
  })

  it('每一档都映射到非空 StreamStatus(挡空串 / undefined 占位)', () => {
    for (const status of TOOL_CALL_STATUSES) {
      const display = TRACE_STATUS[status]
      expect(display, `状态 ${status} 未配展示`).toBeTruthy()
      expect(typeof display, `状态 ${status} 的展示不是字符串`).toBe('string')
      // 消费点是 <StreamRow status=…>:StreamStatus 是五档封闭集,映射出去的值必须是其中一档。
      expect(
        ['pending', 'running', 'success', 'error', 'skipped'],
        `状态 ${status} 映射到了 StreamStatus 之外的档:${display}`,
      ).toContain(display)
    }
  })

  it('cancelled 归一到 skipped(终态不冒充进行中/失败)', () => {
    expect(TRACE_STATUS.cancelled).toBe('skipped')
  })

  it('映射不因查表而丢档:查表结果恒非 undefined(消费点已无 `?? 兜底`可依赖)', () => {
    // 反向意义:旧的 `Partial` + `?? 'pending'` 组合会让这里出现 undefined。
    // 现在完备 Record 下,四档查表必须全部命中。
    for (const status of TOOL_CALL_STATUSES) {
      expect(TRACE_STATUS[status]).toBeDefined()
    }
  })
})