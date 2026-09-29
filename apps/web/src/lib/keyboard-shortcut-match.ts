// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 键盘平台隔离主快捷键匹配器(2026-09-30 立,吸收批次 b74-W4 票 G-977974)。
 *
 * 吸收判据:
 * - 平台判定 platform + UA 双源(先 platform 词面,再 UA 兜底,iPadOS 谎报 MacIntel 时靠 UA);
 * - 主快捷键按平台隔离:macOS meta-only,Windows/Linux ctrl-only;
 *   macOS 的 Ctrl 保留给系统 Emacs 风格文本编辑,不能当主修饰键;
 *   Ctrl 与 Command 同按不视作主快捷键(避免两平台语义叠加误触发);
 * - `event.key` 可能被键盘布局/Option 改写(如 key 变成非拉丁字符),
 *   此时按物理 `code` 兜底匹配(KeyA..KeyZ / Digit0-9 / BracketLeft / BracketRight);
 * - Option(alt)参与的组合与 Shift 一样不进主快捷键判据(Option 是文本输入修饰键);
 * - 统一 label 格式化:Apple 用 "⌘ B",其余用 "Ctrl+B"。
 */

export interface ShortcutPlatformInfo {
  platform?: string
  userAgent?: string
}

export interface ShortcutKeyEventLike {
  key: string
  code?: string
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
}

function readNavigatorPlatformInfo(): ShortcutPlatformInfo {
  if (typeof navigator === 'undefined') {
    return {}
  }
  return {
    platform: navigator.platform,
    userAgent: navigator.userAgent,
  }
}

/** 是否 Apple 键盘平台:platform 词面优先,UA 兜底(双源,防其中一方缺失/谎报)。 */
export function isAppleKeyboardPlatform(
  platformInfo: ShortcutPlatformInfo = readNavigatorPlatformInfo(),
): boolean {
  const platform = platformInfo.platform?.toLowerCase() ?? '';
  if (
    platform.includes('mac') ||
    platform.includes('iphone') ||
    platform.includes('ipad') ||
    platform.includes('ipod')
  ) {
    return true;
  }
  return /Mac|iPhone|iPad|iPod/.test(platformInfo.userAgent ?? '');
}

/** 主修饰键判定:mac meta-only / 其余 ctrl-only,两修饰键同按一律不触发。 */
function matchesPrimaryModifier(
  event: ShortcutKeyEventLike,
  platformInfo?: ShortcutPlatformInfo,
): boolean {
  const isApple = isAppleKeyboardPlatform(platformInfo);
  return isApple ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
}

/**
 * 快捷键 key 匹配:event.key 优先,布局/Option 改写场景按物理 code 兜底。
 * 单独导出供修饰键层之外复用与测试(⌥⌘B 的 key 改写也走这一层命中)。
 */
export function matchesShortcutKeyCode(
  event: Pick<ShortcutKeyEventLike, 'key' | 'code'>,
  key: string,
): boolean {
  if (event.key.toLowerCase() === key.toLowerCase()) {
    return true;
  }
  const expectedCode = getExpectedShortcutCode(key.toLowerCase());
  return expectedCode != null && event.code === expectedCode;
}

function getExpectedShortcutCode(key: string): string | null {
  if (key.length === 1) {
    if (key >= 'a' && key <= 'z') {
      return `Key${key.toUpperCase()}`;
    }
    if (key >= '0' && key <= '9') {
      return `Digit${key}`;
    }
  }
  switch (key) {
    case '[':
      return 'BracketLeft';
    case ']':
      return 'BracketRight';
    default:
      return null;
  }
}

/**
 * 主快捷键匹配(mac:⌘K / win:Ctrl+K)。
 * Shift 与 Option 参与的组合一律不算主快捷键。
 */
export function matchesPrimaryShortcut(
  event: ShortcutKeyEventLike,
  key: string,
  platformInfo?: ShortcutPlatformInfo,
): boolean {
  return (
    matchesPrimaryModifier(event, platformInfo) &&
    !event.shiftKey &&
    !event.altKey &&
    matchesShortcutKeyCode(event, key)
  );
}

/** Ctrl 风格次级快捷键:Ctrl 独占(meta 不同按,Shift/Alt 不参与)。 */
export function matchesCtrlShortcut(event: ShortcutKeyEventLike, key: string): boolean {
  return (
    event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey &&
    !event.altKey &&
    matchesShortcutKeyCode(event, key)
  );
}

function formatShortcutKeyLabel(key: string): string {
  if (key === '[' || key === ']') {
    return key;
  }
  return key.toUpperCase();
}

/** 统一快捷键 label:Apple 形如 "⌘ B",Windows/Linux 形如 "Ctrl+B"。 */
export function formatCommandShortcutLabel(
  key: string,
  platformInfo?: ShortcutPlatformInfo,
): string {
  if (isAppleKeyboardPlatform(platformInfo)) {
    return `⌘ ${formatShortcutKeyLabel(key)}`;
  }
  return `Ctrl+${formatShortcutKeyLabel(key)}`;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
