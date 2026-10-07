// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-815966 镜像判据(asks 面):证明「状态 → 展示」映射漏一档会被编译器挡住,
 * 而不是运行时 `?? 默认` 兜底。同族先例:apps/web/src/components/ai/__tests__/trace-status-exhaustive.test.ts。
 *
 * 本文件做三件事:
 *   1. **反向用例**:`@ts-expect-error` 故意漏一档/多一档。若 `AskStatus` 新增一档而
 *      `STATUS_META` 没跟上 ⇒ 被抑制的错误消失 ⇒ `@ts-expect-error` 变成
 *      「无错误可抑制」⇒ `tsc --noEmit` 判红(ts2578)。
 *   2. **封闭集双向对账**:`AskStatus`(来自 @ihui/shared/validation/ask-schema 的
 *      zod 字面量联合)与运行时值清单 `ASK_STATUS_VALUES` 必须互为镜像,挡"schema
 *      加档而运行时清单没跟上"(或反向)的漂移。
 *   3. **运行时用例**:遍历封闭集每一档,确认展示非空、查表恒命中(消费点
 *      AsksTable 已无 `?? 兜底` 可依赖)。
 *
 * ⚠️ 用例 1/2 的价值全在 `@ts-expect-error` 那几行**保持可编译**。类型断言注解绑的
 *    是 `typeof STATUS_META`(生产表自身类型),不是测试里重抄的 Record —— 生产若退回
 *    Partial,漏一档不再报错 ⇒ 抑制失效 ⇒ 判红。运行侧由 vitest 验证,类型侧由
 *    `pnpm --filter @ihui/web typecheck` 验证(与 trace-status-exhaustive 同一机制)。
 */
import { describe, expect, it } from 'vitest'
import { STATUS_META } from '../helpers'
import { ASK_STATUS_VALUES, type AskFormValues, type AskStatus } from '@/lib/form-schemas/ask'

/** `AskStatus` 的运行时封闭集(联合类型在编译期,遍历须有一份值列表)。 */
const ASK_STATUSES = [-1, 0, 1] as const

describe('G-815966 / STATUS_META 完备性(反向用例)', () => {
  it('故意漏掉 0(隐藏)一档 ⇒ 必须编译期报错(此处无错可抑制则本卡失效)', () => {
    // ⚠️ 类型注解写 `typeof STATUS_META`(生产表自身类型),不重抄 Record。
    //    生产是完备 Record<AskStatus, AskStatusMeta> ⇒ 漏一档报错 ⇒ 被抑制;
    //    生产退回 Partial/宽 Record ⇒ 漏一档不再是错误 ⇒ 本行 ts2578 判红。
    // @ts-expect-error 故意漏一档:完备 Record<Union, T> 缺键必须报错。
    const _missingOne: typeof STATUS_META = {
      [-1]: { label: 'statusDeleted', cls: 'bg-red-500/10 text-red-600 dark:text-red-400' },
      1: { label: 'statusApproved', cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500' },
    }
    // 仅为避免 noUnusedLocals 报错,断言漏掉的那档取值确实为 undefined。
    expect(_missingOne[0]).toBeUndefined()
  })

  it('故意多出一档不在联合类型里的键 ⇒ 也必须报错(防止随便加键糊过去)', () => {
    const _extraKey: typeof STATUS_META = {
      [-1]: { label: 'statusDeleted', cls: 'x' },
      0: { label: 'statusHidden', cls: 'y' },
      1: { label: 'statusApproved', cls: 'z' },
      // ⚠️ 抑制注释必须贴在这一行:多余键的 ts2353 报在属性所在行,不是声明行。
      // @ts-expect-error 'archived' 不在 AskStatus 联合类型内,赋值应被拒。
      archived: { label: 'statusHidden', cls: 'y' },
    }
    expect(Object.keys(_extraKey)).toHaveLength(4)
  })

  it('封闭集联合类型新增一档时,这行必须判红(判据=Exclude 归零)', () => {
    // 与 STATUS_META 的写法无关,只盯 AskStatus 本身:shared 的 schema 联合加一档
    // ⇒ Exclude 不再是 never ⇒ 类型退化成 { missing: … },赋 true 即 ts2322 判红。
    type Unhandled = Exclude<AskStatus, -1 | 0 | 1>
    const _noUnhandledStatus: Unhandled extends never ? true : { missing: Unhandled } = true
    expect(_noUnhandledStatus).toBe(true)
  })
})

describe('G-815966 / 封闭集双向对账(schema 联合 ↔ 运行时清单)', () => {
  it('AskFormValues["status"](zod 联合)的每一档都在 ASK_STATUS_VALUES 里', () => {
    type UnhandledInList = Exclude<AskFormValues['status'], (typeof ASK_STATUS_VALUES)[number]>
    const _covered: UnhandledInList extends never ? true : { missing: UnhandledInList } = true
    expect(_covered).toBe(true)
  })

  it('ASK_STATUS_VALUES 的每一档都被 AskFormValues["status"] 承认', () => {
    type UnhandledInSchema = Exclude<(typeof ASK_STATUS_VALUES)[number], AskFormValues['status']>
    const _covered: UnhandledInSchema extends never ? true : { missing: UnhandledInSchema } = true
    expect(_covered).toBe(true)
  })
})

describe('G-815966 / STATUS_META 完备性(运行时)', () => {
  it('键集与封闭集完全一致(不多不少)', () => {
    expect(Object.keys(STATUS_META).map(Number).sort((a, b) => a - b)).toEqual(
      [...ASK_STATUS_VALUES].sort((a, b) => a - b),
    )
  })

  it('每一档都映射到非空 label / cls(挡空串 / undefined 占位)', () => {
    for (const status of ASK_STATUSES) {
      const meta = STATUS_META[status]
      expect(meta, `状态 ${status} 未配展示`).toBeTruthy()
      expect(meta.label.length, `状态 ${status} 的 label 为空`).toBeGreaterThan(0)
      expect(meta.cls.length, `状态 ${status} 的 cls 为空`).toBeGreaterThan(0)
    }
  })

  it('查表结果恒非 undefined(消费点 AsksTable 已无 `?? 兜底` 可依赖)', () => {
    for (const status of ASK_STATUSES) {
      expect(STATUS_META[status]).toBeDefined()
    }
  })
})
