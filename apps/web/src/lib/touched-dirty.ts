// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * b75-1#2 touched-field dirty 判定(只比较用户碰过的字段)。
 *
 * 上游出处 zcode packages/ui/src/settings/automationEditDirtyState.ts:1-21。
 *
 * 机制:dirty 比较仅遍历 touchedFields,baseline 缺席字段不算修改,
 * 防表单初始化归一化(trim/默认值回填)误报 dirty。
 *
 * 纯函数,可脱离 React 单测。调用方在 onBlur/onChange 时把字段名加入 touched,
 * 提交时把 current 与 baseline 喂入本函数判断是否真有用户修改。
 */

export type FormValues = Record<string, unknown>

/**
 * 判定表单是否"被用户修改过"。
 *
 * 规则:
 *  1. touchedFields 为空 ⇒ false(用户什么都没碰,即使初始化归一化改变了值也不算 dirty)
 *  2. 仅遍历 touchedFields 中的键:
 *     - baseline 中该键为 undefined(字段初始化时被归一化回填) ⇒ 不算修改
 *     - 否则比较 current[field] !== baseline[field]
 *  3. 任意 touched 字段值与 baseline 不同 ⇒ true
 *
 * 这样:表单初始化把 "" 归一为默认值后 dirty 仍为 false;
 * 用户改过再改回原值 ⇒ 与 baseline 相等 ⇒ clean。
 */
export function isTouchedDirty(
  current: FormValues,
  baseline: FormValues,
  touchedFields: ReadonlySet<string> | readonly string[],
): boolean {
  const touched = Array.isArray(touchedFields) ? touchedFields : [...touchedFields]
  for (const field of touched) {
    if (!Object.prototype.hasOwnProperty.call(baseline, field)) {
      // baseline 缺席字段:初始化归一化回填,不算用户修改
      continue
    }
    if (current[field] !== baseline[field]) return true
  }
  return false
}

/**
 * 计算哪些 touched 字段发生了实际变化(用于高亮/错误定位)。
 * baseline 缺席字段不计入。
 */
export function diffTouchedFields(
  current: FormValues,
  baseline: FormValues,
  touchedFields: ReadonlySet<string> | readonly string[],
): string[] {
  const touched = Array.isArray(touchedFields) ? touchedFields : [...touchedFields]
  const out: string[] = []
  for (const field of touched) {
    if (!Object.prototype.hasOwnProperty.call(baseline, field)) continue
    if (current[field] !== baseline[field]) out.push(field)
  }
  return out
}

