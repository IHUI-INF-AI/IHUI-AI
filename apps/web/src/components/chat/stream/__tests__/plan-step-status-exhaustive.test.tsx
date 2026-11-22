// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-815966 反向用例:plan 步骤状态 → 活动行状态的归一必须是**穷尽 switch**,不是 default 兜底。
 *
 * 原写法是一条 if 链末尾 `return 'pending'`。那是运行时兜底:`PlanStepStatus` 新增一档时,
 * 新档会被静默归一成 `pending`(界面上看起来像"还没开始"),`tsc` 零报错。
 * 现在 `pending` 与其余四档一起逐档显式列出,`default` 分支把残值赋给 `never`。
 */
import { describe, expect, it } from 'vitest'
// 用 Vite 的 ?raw 通道读源码文本(不走 node:fs —— happy-dom + brokered-fs shim 下
// readFileSync 相对路径会被拦),把"default 里是 never 还是 return 初始态"钉成可判断言。
import streamUiSource from '../stream-ui.tsx?raw'
import type { PlanStepStatus } from '@ihui/types'
import { planStepStreamStatus } from '../stream-ui'
import type { StreamStatus } from '../stream-ui'

/** `PlanStepStatus` 五档封闭集的运行时值列表(联合类型在编译期,遍历须有一份值列表)。 */
const PLAN_STEP_STATUSES = [
  'pending',
  'in_progress',
  'completed',
  'skipped',
  'failed',
] as const satisfies readonly PlanStepStatus[]

describe('G-815966 / planStepStreamStatus 穷尽性(反向用例)', () => {
  it('把一档不在联合类型里的状态塞进入参类型 ⇒ 编译期就该报错', () => {
    // @ts-expect-error 'archived' 不在 PlanStepStatus 联合类型内。
    const _badInput: { status: PlanStepStatus } = { status: 'archived' }
    expect(_badInput.status).toBe('archived')
  })

  it('PlanStepStatus 新增一档时,这行必须判红(判据=Exclude 归零)', () => {
    // 这才是"缺一档可判"在**测试面**的构造面。生产侧的穷尽性写在
    // `const exhaustive: never = step.status`,那行只在生产文件被 typecheck 时生效;
    // 这里另钉一道 Exclude 断言,使"联合类型多出一档 ⇒ 测试面也判红"可判。
    type Unhandled = Exclude<
      PlanStepStatus,
      'pending' | 'in_progress' | 'completed' | 'skipped' | 'failed'
    >
    const _noUnhandledStatus: Unhandled extends never ? true : { missing: Unhandled } = true
    expect(_noUnhandledStatus).toBe(true)
  })

  it('生产函数用的是 never 兜底而非 default 兜底,且五档逐档显式列出', () => {
    // 纯文本断言:把"default 里是 never 还是 return 某个初始态"钉死。
    // 有人把 `const exhaustive: never = step.status` 换回 `return 'pending'` 时判红。
    const start = streamUiSource.indexOf('export function planStepStreamStatus')
    expect(start, '未找到 planStepStreamStatus').toBeGreaterThan(-1)
    // 取到下一个顶层 `export function` / `export const` 之前,避开 default 块内部的 `}`。
    const rest = streamUiSource.slice(start)
    const next = rest.search(/\nexport (function|const) /)
    const fn = next === -1 ? rest : rest.slice(0, next)
    expect(fn, '穷尽兜底被换成了普通 default 兜底').toMatch(
      /const\s+exhaustive:\s*never\s*=\s*step\.status/,
    )
    // 五档必须逐档显式列出,不能只靠 default
    for (const c of ['in_progress', 'completed', 'skipped', 'pending']) {
      expect(fn, `switch 未显式列出 ${c} 档`).toContain(`case '${c}'`)
    }
  })

  it('五档每一档都映射到非空 StreamStatus(穷尽 switch 的运行时对照)', () => {
    for (const status of PLAN_STEP_STATUSES) {
      const mapped = planStepStreamStatus({ status })
      expect(typeof mapped, `状态 ${status} 的归一结果不是字符串`).toBe('string')
      expect(mapped.length, `状态 ${status} 的归一结果是空串`).toBeGreaterThan(0)
    }
  })
})

describe('G-815966 / planStepStreamStatus 穷尽性(运行时)', () => {
  it('逐档归一结果与预期一致(五档都显式登记,没有一档靠兜底)', () => {
    expect(planStepStreamStatus({ status: 'pending' })).toBe('pending')
    expect(planStepStreamStatus({ status: 'in_progress' })).toBe('running')
    expect(planStepStreamStatus({ status: 'completed' })).toBe('success')
    expect(planStepStreamStatus({ status: 'skipped' })).toBe('skipped')
    expect(planStepStreamStatus({ status: 'failed' })).toBe('error')
  })

  it('error=true 与显式 failed 都归一到 error(旧 if 链保留的语义不变)', () => {
    expect(planStepStreamStatus({ status: 'pending', error: true })).toBe('error')
    expect(planStepStreamStatus({ status: 'completed', error: true })).toBe('error')
    expect(planStepStreamStatus({ status: 'failed' })).toBe('error')
    // error 缺省不触发归一(不能把 undefined 当 true)
    expect(planStepStreamStatus({ status: 'completed' })).toBe('success')
  })

  it('error=false 时按状态本身归一(不吞掉后续判断)', () => {
    expect(planStepStreamStatus({ status: 'in_progress', error: false })).toBe('running')
  })

  it('归一结果恒落在 StreamStatus 五档内(消费点 StreamRow 的契约)', () => {
    const allowed: readonly StreamStatus[] = ['pending', 'running', 'success', 'error', 'skipped']
    for (const status of PLAN_STEP_STATUSES) {
      expect(allowed, `状态 ${status} 被归一到 StreamStatus 之外的档`).toContain(
        planStepStreamStatus({ status }),
      )
    }
  })
})