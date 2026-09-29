// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 权限请求选项显示归一与排序(2026-09-30 立,吸收批次 b74-W4 票 G-977975)。
 *
 * 吸收判据:
 * - kind 词典归一:allow/approve × always 组合映射到固定显示种类
 *   (allowOnce / allowAlways / rejectOnce / rejectAlways / custom);
 * - generic 名称让位稳定文案:模型输出的 "Allow" / "Allow once" 这类泛化名称
 *   不如产品稳定文案可信,只有 custom kind(或名称不在 generic 词表内)才优先显示 name;
 * - 固定排序 allowOnce → allowAlways → rejectOnce → rejectAlways → custom,
 *   full access 选项固定插在 1.5 槽位(allowAlways 与 rejectOnce 之间),同序保原 index。
 */

export type PermissionOptionDisplayKind =
  | 'allowOnce'
  | 'allowAlways'
  | 'rejectOnce'
  | 'rejectAlways'
  | 'custom'

/** 权限选项渲染所需的最小字段集。 */
export interface PermissionOptionLike {
  /** 选项稳定 id(协议侧主键) */
  optionId: string
  /** 协议侧 kind 字符串(允许任意词面,经词典归一) */
  kind: string
  /** 模型/协议输出的选项名称 */
  name: string
}

/** full access 选项的我方稳定 id;排序时固定占 1.5 槽位。 */
export const PERMISSION_FULL_ACCESS_OPTION_ID = 'permission-full-access';

/** 各显示种类下,模型输出视为 generic 的名称词表(小写、空白折叠后比较)。 */
const GENERIC_PERMISSION_OPTION_NAMES: Record<PermissionOptionDisplayKind, ReadonlySet<string>> = {
  allowOnce: new Set(['allow', 'allow once', 'approve']),
  allowAlways: new Set(['always allow', 'allow always', 'approve always']),
  rejectOnce: new Set(['deny', 'deny once', 'reject', 'reject once']),
  rejectAlways: new Set(['always deny', 'deny always', 'always reject', 'reject always']),
  custom: new Set(),
};

/** 各显示种类对应的产品稳定文案;generic 名称让位到这里。 */
export const PERMISSION_OPTION_DEFAULT_LABELS: Record<PermissionOptionDisplayKind, string> = {
  allowOnce: '本次允许',
  allowAlways: '始终允许',
  rejectOnce: '本次拒绝',
  rejectAlways: '始终拒绝',
  custom: '',
};

function normalizeInlineText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

/** kind 词面 → 固定显示种类;allow/approve 与 reject/deny 同义,always 决定 once/always。 */
export function getPermissionOptionDisplayKind(kind: string): PermissionOptionDisplayKind {
  const normalizedKind = kind.trim().toLowerCase();
  const isAllow = normalizedKind.includes('allow') || normalizedKind.includes('approve');
  const isReject = normalizedKind.includes('reject') || normalizedKind.includes('deny');
  const isAlways = normalizedKind.includes('always');

  if (isAllow && isAlways) {
    return 'allowAlways';
  }
  if (isAllow) {
    return 'allowOnce';
  }
  if (isReject && isAlways) {
    return 'rejectAlways';
  }
  if (isReject) {
    return 'rejectOnce';
  }
  return 'custom';
}

/**
 * 该选项是否应优先显示模型/协议给的 name。
 * custom kind 一律信 name;标准 kind 只有 name 不在 generic 词表内才信
 * (模型输出的 "Allow"/"Allow once" 不顶替稳定文案)。
 */
export function shouldPreferPermissionOptionName(
  option: Pick<PermissionOptionLike, 'kind' | 'name'>,
): boolean {
  const normalizedName = normalizeInlineText(option.name).toLowerCase();
  if (normalizedName.length === 0) {
    return false;
  }
  const displayKind = getPermissionOptionDisplayKind(option.kind);
  if (displayKind === 'custom') {
    return true;
  }
  return !GENERIC_PERMISSION_OPTION_NAMES[displayKind].has(normalizedName);
}

function getPermissionOptionSortPriority(option: PermissionOptionLike): number {
  if (option.optionId === PERMISSION_FULL_ACCESS_OPTION_ID) {
    // full access 语义上是"允许一切",排在 once 类允许之后、always 类拒绝之前。
    return 1.5;
  }
  switch (getPermissionOptionDisplayKind(option.kind)) {
    case 'allowOnce':
      return 0;
    case 'allowAlways':
      return 1;
    case 'rejectOnce':
      return 2;
    case 'rejectAlways':
      return 3;
    default:
      return 4;
  }
}

/** 固定语义排序;同优先级按原数组顺序(快照稳定,防 UI 选项跳动)。 */
export function sortPermissionOptions(
  options: readonly PermissionOptionLike[],
): PermissionOptionLike[] {
  return options
    .map((option, index) => ({ option, index }))
    .sort((left, right) => {
      const priorityDelta = getPermissionOptionSortPriority(left.option) - getPermissionOptionSortPriority(right.option);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }
      return left.index - right.index;
    })
    .map(({ option }) => option);
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
