// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 产品形态能力闸的**端内装配层**(goal-b49 Y3,2026-11-05)。
 *
 * 判据本体在 `@ihui/types` 的 `product-form-capabilities`(表 + 纯函数 `evaluateProductFormCapability`);
 * 本文件**零判据** —— 只做三件事:
 *  1. **取值装配**:本次运行的产品形态从哪来(声明优先,缺省 CLI 自身形态);
 *  2. **调用封装**:把「形态 × 能力」交给真源判,拿回三态回执;
 *  3. **出声**:判定不是 `enabled` 时,点名「哪个形态 · 哪个能力」落 stderr 一次
 *     (纪律与 `sandbox/file-access-policy.ts` 的 `buildGuardUnjudgedNotice` /
 *     `announceGuardUnjudged` 同形:同一(形态 × 能力 × 位点)只报一次,不改判据结论)。
 *
 * 为什么形态是「声明值」而不是「探测值」:形态是**产品事实**(本次运行属于哪个产品形态),
 * 不是运行时可推出来的技术特征。声明面 = `IHUI_PRODUCT_FORM`(与
 * `IHUI_HOOK_SKIP_HOST_IDENTITY` 同一族的显式开关风格);未声明 ⇒ 缺省 `cli`
 * —— 本仓唯一带本机执行面的产品形态(与 `HOOK_HOST_PRODUCT_ID = 'ihui-cli'` 同一件事)。
 *
 * 失效方向(§0.10):形态声明成**未登记值**时,判定一律 `unjudged` ⇒ 消费点出声并**不挂载**
 * 该能力面。宁可"大声地不干活",也不把没声明的形态静默当成默认形态继续跑(§0.3)。
 */

import {
  evaluateProductFormCapability,
  isProductForm,
  PRODUCT_CAPABILITIES,
  PRODUCT_FORMS,
  type ProductCapability,
  type ProductCapabilityVerdict,
} from '@ihui/types';

/** 产品形态声明的环境变量名(声明面,不是探测面)。 */
export const PRODUCT_FORM_ENV = 'IHUI_PRODUCT_FORM';

/** 缺省形态:CLI 自身形态(本仓唯一带本机执行面的产品形态)。 */
export const DEFAULT_PRODUCT_FORM = 'cli';

/** 形态取值的三种来源状态。 */
export type ProductFormSource = 'declared' | 'defaulted' | 'unknown';

export interface ResolvedProductForm {
  /** 本次运行的形态取值(未登记时是原样取值,便于点名) */
  readonly form: string;
  /** 取值来源:显式声明 / 缺省 / 声明了但未登记 */
  readonly source: ProductFormSource;
  /** 人可读理由 */
  readonly reason: string;
}

/**
 * 解析本次运行的产品形态。
 *
 * - 未声明(空/缺省)⇒ `cli` + `defaulted`(本仓 CLI 的产品身份,见文件头注);
 * - 声明了且在册 ⇒ 原样 + `declared`;
 * - 声明了但**不在册** ⇒ 原样 + `unknown`(后续判定一律 `unjudged`,由消费点出声)。
 */
export function resolveProductForm(env: NodeJS.ProcessEnv = process.env): ResolvedProductForm {
  const raw = env[PRODUCT_FORM_ENV];
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (trimmed === '') {
    return {
      form: DEFAULT_PRODUCT_FORM,
      source: 'defaulted',
      reason: `产品形态未声明(${PRODUCT_FORM_ENV} 未设)⇒ 按缺省形态 ${DEFAULT_PRODUCT_FORM} 装配`,
    };
  }
  if (isProductForm(trimmed)) {
    return { form: trimmed, source: 'declared', reason: `产品形态已声明:${trimmed}` };
  }
  return {
    form: trimmed,
    source: 'unknown',
    reason: `产品形态未登记:${trimmed}(合法形态:${PRODUCT_FORMS.join('|')})`,
  };
}

/**
 * 判「当前形态 × 该能力」这一格(判据本体在 `@ihui/types`,本层只转发)。
 *
 * 形态未登记时,回执自然是 `unjudged` 并点名形态 —— 调用方**不许**自己兜底成默认形态。
 */
export function gateProductFormCapability(
  capability: ProductCapability,
  resolved: ResolvedProductForm = resolveProductForm(),
): ProductCapabilityVerdict {
  return evaluateProductFormCapability(resolved.form, capability);
}

/** 具名错误码:能力**未开**(判过,关)与能力**未登记**(没判)是两回事,码必须可区分。 */
export const PRODUCT_FORM_CAPABILITY_OFF = 'PRODUCT_FORM_CAPABILITY_OFF';
export const PRODUCT_FORM_CAPABILITY_UNJUDGED = 'PRODUCT_FORM_CAPABILITY_UNJUDGED';

/**
 * 组一条出声提示;判定为 `enabled` 时返回 null(不该出声的不该出声)。
 *
 * 文案必须点名「形态 · 能力」—— 只说"某个能力没开"等于没说(§0.9 静默 = 没判)。
 */
export function buildProductFormNotice(
  verdict: ProductCapabilityVerdict,
  site: string,
): string | null {
  if (verdict.state === 'enabled') return null;
  const code =
    verdict.state === 'disabled' ? PRODUCT_FORM_CAPABILITY_OFF : PRODUCT_FORM_CAPABILITY_UNJUDGED;
  const tail =
    verdict.state === 'disabled'
      ? '该能力面在本形态下判为关闭 ⇒ 不挂载。'
      : '该能力面在本形态下**未判定**(不是"关闭")⇒ 不挂载,并点名待登记。';
  return (
    `[product-form] ${code}: ${site}:${verdict.reason} — ${tail}` +
    `下一步:在 @ihui/types 的 PRODUCT_FORM_CAPABILITIES 为该形态登记这一格,` +
    `或纠正 ${PRODUCT_FORM_ENV} 的声明。`
  );
}

/** 同一(形态 × 能力 × 状态 × 位点)只出声一次(不每条工具调用都刷屏)。 */
const announcedProductFormGates = new Set<string>();

/**
 * 消费点用的出声动作:首次返回 true 并落 stderr,之后返回 false。
 * stderr 不可用不影响判定结论(与既有 advisory 出声同形)。
 */
export function announceProductFormGate(verdict: ProductCapabilityVerdict, site: string): boolean {
  const notice = buildProductFormNotice(verdict, site);
  if (notice === null) return false;
  const key = `${verdict.form}|${verdict.capability}|${verdict.state}|${site}`;
  if (announcedProductFormGates.has(key)) return false;
  announcedProductFormGates.add(key);
  try {
    process.stderr.write(`${notice}\n`);
  } catch {
    // 出声通道不可用不改判据结论
  }
  return true;
}

/** 清出声账(测试与"形态登记刚被补上"的场景用)。 */
export function clearProductFormAnnouncements(): void {
  announcedProductFormGates.clear();
}

/** 供消费点引用:合法形态与合法能力的值域(出声文案里要点名)。 */
export const PRODUCT_FORM_VALUE_HINTS = {
  forms: PRODUCT_FORMS.join('|'),
  capabilities: PRODUCT_CAPABILITIES.join('|'),
} as const;
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
