// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 设置导入期的「扩展 ID 集合」过滤(goal-b49 Z27b,2026-11-06 立)。
 *
 * 承 Z4-triage「T1 §4 #4」行 + Z20 §④ 的「缺宿主」裁决:「导入期按扩展 ID 过滤」缺的从来不是
 * 判据,是**消费它的宿主**。本文件 + `layer-policy.ts` 的接线就是那一格宿主。
 *
 * 判据零复算(§0.6):哪枚扩展依赖哪个能力面住在 `@ihui/types` 的 `IMPORT_GATED_EXTENSIONS`
 * (单源),放行/跳过/未判定的三态住在同一份 `evaluateExtensionImportGate`(它再转
 * `evaluateProductFormCapability` 那张布尔表)。本层**只做一件事**:把项目层设置里 `plugins.extensions`
 * 的扩展 ID 逐枚交给那把尺子,再据裁决把不该合入的摘掉并**具名出声**。这里不写第二份名单,
 * 也不自己判「某形态能不能跑某能力」。
 *
 * 宿主范围 = 项目层(仓库内容)。`<cwd>/.ihui/settings.json` 是别人写的一份配置(clone / 共享 /
 * 拷贝目录进来即导入它),与 `layer-policy.ts` 拒绝 apiUrl / mcp 等同一条信任边界:导入前按当前
 * 产品形态把它声明的扩展过滤一遍。用户全局层(`~/.ihui/settings.json`)是本机自己的配置,不归本闸。
 *
 * 失效方向(§0.3 / §0.10):形态未登记 ⇒ 名内扩展判 `unjudged` ⇒ **不放行**并点名;
 * 名外扩展 ⇒ 照常合入(零回归,绝不为消红顺手砍掉没登记的扩展)。
 */

import { evaluateExtensionImportGate, type ExtensionImportGateVerdict } from '@ihui/types';

import { resolveProductForm, type ResolvedProductForm } from '../lib/product-form.js';

/** 项目层里承载「待启用扩展 ID 列表」的字段名(住在 `plugins` 对象内;layer-policy 只把 plugins 校验成普通对象)。 */
const PLUGINS_EXTENSIONS_FIELD = 'extensions';

/** 被导入期跳过的扩展(带被跳过的 id 与三态依据,供出声与测试读数)。 */
export interface SkippedImportedExtension {
  readonly id: string;
  readonly decision: 'skipped' | 'unjudged';
  readonly capability: string;
  readonly reason: string;
}

export interface ExtensionImportGateResult {
  /** 过滤后的 plugins 取值:原对象但 `extensions` 只留放行项(无扩展列表时逐字原样返回) */
  readonly value: unknown;
  readonly skipped: SkippedImportedExtension[];
  /** 本次判定的产品形态(未登记时是原样取值,便于点名) */
  readonly form: string;
}

/** 是否普通对象(非 null / 非数组)。 */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 纯函数:把一份项目层 `plugins` 取值里的扩展 ID 列表按当前产品形态过滤。
 *
 * - 没有 `plugins` / 不是对象 / 没有 `extensions` 数组 ⇒ **逐字原样返回**,skipped 为空
 *   (零回归:绝大多数仓库配置根本不带这一格);
 * - `extensions` 里的**字符串项**逐枚交 `evaluateExtensionImportGate` 判:
 *   `kept` 留下,`skipped` / `unjudged` 摘掉并入 `skipped`(未判定 = 不放行,§0.3);
 * - **非字符串项**(数字 / 对象 / …)原样保留 —— 它们不是扩展 ID,不归本闸管辖,也不得被顺手丢弃。
 *
 * 出声由 `gateImportedExtensionsForProjectLayer` 负责,保持本函数可测、零副作用。
 */
export function filterImportedExtensionIds(
  pluginsValue: unknown,
  resolved: ResolvedProductForm = resolveProductForm(),
): ExtensionImportGateResult {
  if (!isPlainRecord(pluginsValue)) {
    return { value: pluginsValue, skipped: [], form: resolved.form };
  }
  const rawExtensions = pluginsValue[PLUGINS_EXTENSIONS_FIELD];
  if (!Array.isArray(rawExtensions)) {
    return { value: pluginsValue, skipped: [], form: resolved.form };
  }

  const kept: unknown[] = [];
  const skipped: SkippedImportedExtension[] = [];
  for (const item of rawExtensions) {
    if (typeof item !== 'string') {
      kept.push(item);
      continue;
    }
    const verdict: ExtensionImportGateVerdict = evaluateExtensionImportGate(item, resolved.form);
    if (verdict.decision === 'kept') {
      kept.push(item);
    } else {
      skipped.push({
        id: item,
        decision: verdict.decision,
        capability: verdict.capability,
        reason: verdict.reason,
      });
    }
  }

  return {
    value: { ...pluginsValue, [PLUGINS_EXTENSIONS_FIELD]: kept },
    skipped,
    form: resolved.form,
  };
}

/**
 * 消费点出口:过滤 + 具名出声。被跳过/未判定的扩展必须喊出来(静默丢弃 = 让仓库作者换个 id
 * 再来,与 `layer-policy.ts` 的「拒绝必须可见」同一条纪律)。默认落 `console.warn`;`emit` 仅供
 * 测试注入。返回过滤结果供调用方替换 `accepted.plugins`。
 */
export function gateImportedExtensionsForProjectLayer(
  pluginsValue: unknown,
  resolved: ResolvedProductForm = resolveProductForm(),
  emit: (line: string) => void = (line) => console.warn(line),
): ExtensionImportGateResult {
  const result = filterImportedExtensionIds(pluginsValue, resolved);
  if (result.skipped.length === 0) return result;
  emit(
    `[config] 项目层设置导入按产品形态(${result.form})跳过 ${result.skipped.length} 枚扩展(未合入配置):\n` +
      result.skipped
        .map(
          (s) =>
            `  - ${s.id}(${s.decision === 'unjudged' ? '未判定⇒不放行' : '能力未开'} · ${s.capability}): ${s.reason}`,
        )
        .join('\n'),
  );
  return result;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
