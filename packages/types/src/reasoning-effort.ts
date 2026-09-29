// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 推理强度档位(reasoning effort)的唯一封闭集合(D130,2026-09-30 立)。
//
// 立因:用户在输入区选"想深一点/快一点"这一维,此前**前端零通道** ——
// `git grep -inE "reasoningEffort|reasoning_effort" HEAD -- packages/api-client packages/types
// apps/web/src packages/shared` 零命中,而后端钉扎体系早已在位
// (apps/ai-service/app/core/reasoning_effort_pin.py 的 known_efforts 与消费点
// services/agent_loop_v2.py)。档位表当时存三处字面量:
//   ① apps/ai-service/app/core/reasoning_effort_pin.py  known_efforts
//   ② apps/cli/src/subagents/precedence.ts              REASONING_EFFORTS(运行时数组)
//   ③ apps/cli/src/subagents/types.ts                   type ReasoningEffort(编译期联合)
// ②③ 之间靠 `as ReasoningEffort` 强转相连,数组加一档而联合漏一档时 typecheck 结构上看不见。
//
// 本文件是**契约层**(跨端 wire 值域)的第四落点:api-client / apps/api / miniapp 都从这里取,
// 不得在端内再抄第五份。它与既有三处必须逐名等值,由 scripts/check-model-capacity-parity.mjs
// 的 C5/C6 对账(该门已把本文件登记为第四个输入,立门与扩展同枚提交 —— 加了类型不加门,
// 新落点天然脱离尺子)。
//
// 值域来源:与 Python 侧 known_efforts 同值。改档必须四处同笔,顺序无例外。

/** 推理强度档位封闭联合(wire 值域):minimal / low / medium / high。 */
export type ReasoningEffort = 'minimal' | 'low' | 'medium' | 'high'

/**
 * 同一封闭集合的运行时投影,供 zod `z.enum(...)` 与"是否合法档位"判定使用。
 * `satisfies` 保证它只能是上面联合的子集且每项都写出 —— 这是**投影**不是第二份真相:
 * 加一档必须同时改联合,否则 typecheck 当场红(不像 cli 那处的 `as` 强转会静默放过)。
 */
export const REASONING_EFFORT_VALUES = ['minimal', 'low', 'medium', 'high'] as const satisfies readonly ReasoningEffort[]

/** 档位 → 输入区第三轴的词表键后缀(控件与 i18n 共用一份顺序,不得在端内各排各的序)。 */
export const REASONING_EFFORT_ORDER: readonly ReasoningEffort[] = REASONING_EFFORT_VALUES

/** 运行时判定:值是否为合法档位(入站参数归一用,不抛错)。 */
export function isReasoningEffort(value: unknown): value is ReasoningEffort {
  return typeof value === 'string' && (REASONING_EFFORT_VALUES as readonly string[]).includes(value)
}

/**
 * "未知不误藏"判定(D130 拍板口径,沿用 apps/web/src/components/chat/model-tier-utils.ts
 * 的 filterByCapabilities 语义):
 * - `capabilities` 整体缺失(老后端 / 降级种子数据)→ 视为**未知**,不置灰;
 * - 对象在位而 `reasoning !== true`(缺键 / false / 非布尔)→ 置灰并给原因。
 *
 * 只有这一处实现。端内不得再写 `caps?.reasoning !== true` 之类的近似式 ——
 * 那一写法会把"对象缺失"也判成不支持,正是本函数刻意区分的两态。
 */
export function reasoningEffortSelectable(capabilities?: { reasoning?: boolean } | null): boolean {
  if (capabilities === undefined || capabilities === null) return true
  return capabilities.reasoning === true
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
