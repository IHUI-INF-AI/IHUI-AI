// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 系统 locale 读取链的唯一实现(2026-09-26 收口)。
 *
 * 立票缘由:同一件事实("这台机器的界面语言是什么")在本端曾有**两份**实现 ——
 * `voice/language.ts` 自带 `LC_ALL > LC_MESSAGES > LANG` 环境变量链,
 * 而 `i18n/index.ts` 只读 `Intl.DateTimeFormat()`。两份实现必然随时间漂移(一处认 LANG、
 * 一处认 Intl),表现为"语音识别按 A 语言走、界面文案按 B 语言走"。本模块是那条链的单一真相源。
 *
 * 语义选择(全部有理由,勿当默认抄走):
 * - 空串按"未设置"处理,不 mask 低优先级变量(POSIX 惯例)。
 * - `LANGUAGE` 刻意**不**进链:它是 GNU gettext 私有扩展(冒号分隔偏好列表),
 *   本仓文案不靠 gettext 目录查找,纳进来等于给一条无人消费的变量赋予优先级。
 * - `C` / `POSIX` / `C.UTF-8` 一律判"无语言信息"返回 null:它们携带的是编码/排序档,
 *   不是界面语言;把 `C.UTF-8` 读成语言 `c` 会静默落到调用方的兜底分支,
 *   看起来对、实际上是巧合。
 */

/** POSIX 环境变量链的优先级顺序(高 → 低)。 */
const ENV_CHAIN = ['LC_ALL', 'LC_MESSAGES', 'LANG'] as const;

/** 无语言信息的 locale 取值(C/POSIX 及其带编码后缀的形态)。 */
const NO_LANGUAGE_RE = /^(?:C|POSIX)(?:[.@].*)?$/i;

/**
 * 读系统环境变量里的 locale 原始值。
 * @param env 可注入的环境对象(默认 `process.env`),便于测试与"服务身份/交互身份不同 env"的对照取证。
 * @returns 原始 locale 串(如 `fr_FR.UTF-8`);链上全空或只命中 C/POSIX 档时返回 null。
 */
export function readSystemLocaleEnv(
  env: Record<string, string | undefined> = process.env,
): string | null {
  for (const key of ENV_CHAIN) {
    const raw = env[key];
    if (raw === undefined) continue;
    const trimmed = raw.trim();
    if (trimmed === '') continue;
    return NO_LANGUAGE_RE.test(trimmed) ? null : trimmed;
  }
  return null;
}

/**
 * 从 locale 串提取 primary subtag:`fr_FR.UTF-8` → `fr`、`zh-Hans-CN` → `zh`。
 * 分隔符按 POSIX/BCP-47 两族一起剥(`_` `-` `.` `@`),但不做子标签校验
 * (校验属调用方的语言目录职责,本模块只负责"把这条链算对")。
 */
export function extractPrimarySubtag(locale: string | null | undefined): string | null {
  if (locale === null || locale === undefined) return null;
  const trimmed = locale.trim();
  if (trimmed === '' || NO_LANGUAGE_RE.test(trimmed)) return null;
  const primary = trimmed.split(/[_.@-]/)[0];
  if (!primary) return null;
  return primary.toLowerCase();
}

/**
 * Intl 兜底值(浏览器/Node ICU)。与 env 链的组合顺序由调用方决定,
 * 本模块不预设"env 一定赢过 Intl"以外的策略,避免把两处判断焊死成一处。
 */
export function readIntlLocale(): string {
  return new Intl.DateTimeFormat().resolvedOptions().locale;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
