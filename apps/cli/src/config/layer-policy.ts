// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-408① — 项目(工作目录)层配置的可写键策略,单一真相源。
 *
 * 为什么必须存在:第 3 层 `<cwd>/.ihui/settings.json` 是**仓库内容** —— 任何人 clone /
 * 共享 / 拷贝一个目录进来,就等于让 CLI 读一份别人写的配置。此前 `config/index.ts` 的
 * `loadSettingsFile` 对这一层**零键过滤、零枚举校验**,`permissionMode` / `allowDangerous`
 * 等同层可达;今天不构成提权**只因为** `.gitignore` 里有一行 `.ihui/*` ——
 * **防线在一行 ignore,不在判据里**。本文件把它落成封闭表。
 *
 * 三条语义:
 *  - 安全敏感键(绕过批准/沙箱/审计,或凭据域)只允许写在用户全局层
 *    (`~/.ihui/settings.json`)、session 注入与显式 CLI 参数层;项目层一律**拒绝并点名**;
 *  - 未知键(Settings 未声明的顶层键)⇒ 拒绝并点名 —— 白名单是封闭的,新键必须先登记表;
 *  - 枚举/类型值非法 ⇒ 拒绝该键并点名,**不得静默丢弃、不得静默接受**。
 *
 * 这是行为变更,且**刻意不提供环境变量开关** —— 给安全拒绝加静默开关,等于把拒绝本身
 * 变成攻击面。回退路径(语义不变):把该键移进 `~/.ihui/settings.json`(用户全局层),
 * 或经显式 CLI 参数传入。
 *
 * 已知覆盖上限(如实登记):对象型允许键(sampler/plugins/…)只校验"是普通对象",
 * 不逐嵌套字段校验;若某嵌套字段将来变成安全面,在本表扩列,不得在别处抄第二份表。
 */

import type { Settings } from '../commands/settings.js';

/** 项目层不得写入的 Settings 顶层键:绕过批准/沙箱/审计,或属凭据域。 */
export const SECURITY_SENSITIVE_SETTINGS_KEYS = [
  'allowDangerous',
  'yolo',
  'permissionMode',
  'autoApprovePlan',
  'sandbox',
  'folderTrust',
  'auditEnabled',
  'apiKey',
  'refreshToken',
  'apiSecret',
  'credentialKind',
  'serve',
] as const satisfies readonly (keyof Settings)[];

/** 项目层允许写入的封闭白名单 = Settings 顶层键 − 安全键。Settings 新增顶层键时本表必须同笔扩列。 */
export const PROJECT_ALLOWED_SETTINGS_KEYS = [
  'announcements',
  'apiUrl',
  'clipboard',
  'codegraphIncremental',
  'compactionV2',
  'defaultModel',
  'enableMcp',
  'fsWatcher',
  'localQwen',
  'locale',
  'maxIterations',
  'mcp',
  'mermaid',
  'nativeFunctionCalling',
  'offline',
  'planFirst',
  'pluginMarketplace',
  'plugins',
  'provider',
  'providerBaseUrl',
  'sampler',
  'subagentPrecedence',
  'telemetry',
  'toolHub',
  'voice',
  'worktreeFastPath',
] as const satisfies readonly (keyof Settings)[];

/** 校验失败时返回可读原因;通过返回 null。 */
export type ProjectKeyValidator = (value: unknown) => string | null;

const isBoolean: ProjectKeyValidator = (v) => (typeof v === 'boolean' ? null : '期望 boolean');
const isNonEmptyString: ProjectKeyValidator = (v) =>
  typeof v === 'string' && v.length > 0 ? null : '期望非空字符串';
const isHttpUrl: ProjectKeyValidator = (v) =>
  typeof v === 'string' && /^https?:\/\//i.test(v) ? null : '期望 http(s):// 开头的字符串';
const isPositiveInteger: ProjectKeyValidator = (v) =>
  typeof v === 'number' && Number.isInteger(v) && v > 0 ? null : '期望正整数';
const isPlainObject: ProjectKeyValidator = (v) =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? null : '期望对象';
const enumOf =
  (list: readonly string[]): ProjectKeyValidator =>
  (v) =>
    typeof v === 'string' && list.includes(v) ? null : `期望 ${list.map((x) => `'${x}'`).join(' | ')}`;
const isNativeFunctionCalling: ProjectKeyValidator = (v) =>
  typeof v === 'boolean' || v === 'auto' ? null : `期望 boolean | 'auto'`;

/** Settings 声明的五种界面语言(locale 的枚举域,与 packages/i18n 的语种集合同口径)。 */
const LOCALES = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW'] as const;

/**
 * 每个允许键一条校验器。测试锁"PROJECT_ALLOWED_SETTINGS_KEYS 与本表键集逐字等值"——
 * 表与校验器不同步,就等于白名单里有键没人管(静默接受)或校验器管着没入口的键(死表)。
 */
export const PROJECT_KEY_VALIDATORS: Readonly<Record<string, ProjectKeyValidator>> = {
  announcements: isPlainObject,
  apiUrl: isHttpUrl,
  clipboard: isPlainObject,
  codegraphIncremental: isPlainObject,
  compactionV2: isPlainObject,
  defaultModel: isNonEmptyString,
  enableMcp: isBoolean,
  fsWatcher: isPlainObject,
  localQwen: isPlainObject,
  locale: enumOf(LOCALES),
  maxIterations: isPositiveInteger,
  mcp: isPlainObject,
  mermaid: isPlainObject,
  nativeFunctionCalling: isNativeFunctionCalling,
  offline: isBoolean,
  planFirst: isBoolean,
  pluginMarketplace: isPlainObject,
  plugins: isPlainObject,
  provider: enumOf(['ollama', 'openai-compatible']),
  providerBaseUrl: isHttpUrl,
  sampler: isPlainObject,
  subagentPrecedence: isPlainObject,
  telemetry: isPlainObject,
  toolHub: isPlainObject,
  voice: isPlainObject,
  worktreeFastPath: isPlainObject,
};

export type RejectedProjectKeyCategory = 'security-sensitive' | 'unknown-key' | 'invalid-value';

export interface RejectedProjectKey {
  key: string;
  category: RejectedProjectKeyCategory;
  /** 点名给用户的拒绝原因(必须可读、可行动,不能只说"非法") */
  reason: string;
}

export interface ProjectLayerFilterResult {
  accepted: Partial<Settings>;
  rejected: RejectedProjectKey[];
}

const SECURITY_SET: ReadonlySet<string> = new Set<string>(SECURITY_SENSITIVE_SETTINGS_KEYS);
const SECURITY_DENY_REASON =
  '安全敏感键:项目层无权写入(绕过批准/沙箱/审计或属凭据域),请改设 ~/.ihui/settings.json(用户全局层)或显式 CLI 参数';

/**
 * 纯函数,零副作用:把一份从 `<cwd>/.ihui/settings.json` 解析出的对象拆成
 * "项目层有权写入的部分" 与 "必须点名拒绝的部分"。调用方负责把 rejected 吼出来。
 */
export function filterProjectLayerSettings(
  parsed: Record<string, unknown>,
): ProjectLayerFilterResult {
  const accepted: Record<string, unknown> = {};
  const rejected: RejectedProjectKey[] = [];
  for (const [key, value] of Object.entries(parsed)) {
    if (SECURITY_SET.has(key)) {
      rejected.push({ key, category: 'security-sensitive', reason: SECURITY_DENY_REASON });
      continue;
    }
    const validator = PROJECT_KEY_VALIDATORS[key];
    if (!validator) {
      rejected.push({
        key,
        category: 'unknown-key',
        reason: '未知顶层键:不在 Settings 声明的封闭白名单内(新增键须先登记 config/layer-policy.ts)',
      });
      continue;
    }
    const fail = validator(value);
    if (fail !== null) {
      rejected.push({ key, category: 'invalid-value', reason: fail });
      continue;
    }
    accepted[key] = value;
  }
  return { accepted: accepted as Partial<Settings>, rejected };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
