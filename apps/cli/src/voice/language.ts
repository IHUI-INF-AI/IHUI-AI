/**
 * Voice STT 语言目录 + 规范化(P43)。
 *
 * 灵感来源:参考行业 voice/language.rs。
 * 简化策略(做减法):
 *   - 25 种语言(2026 年 5 月文档)
 *   - canonicalizeSttLanguage:BCP-47/POSIX → primary subtag
 *   - auto → 系统环境语言(LC_ALL > LC_MESSAGES > LANG)
 *   - 不在目录中的语言 → 'en' 兜底
 *   - Tagalog(tl)→ Filipino(fil)别名解析
 */

/** STT 语言条目 */
export interface SttLanguage {
  /** BCP-47 primary subtag,如 'en' / 'ja' / 'fil' */
  code: string;
  /** 显示名,如 'English' / 'Japanese' / 'Filipino' */
  name: string;
}

/** auto 模式的 sentinel 值(canonicalizeSttLanguage 返回) */
export const STT_LANGUAGE_AUTO = '__auto__';

/** 默认语言(兜底) */
export const STT_LANGUAGE_DEFAULT = 'en';

/** 25 种 STT 语言(2026 年 5 月文档) */
export const STT_LANGUAGES: readonly SttLanguage[] = [
  { code: 'ar', name: 'Arabic' },
  { code: 'cs', name: 'Czech' },
  { code: 'da', name: 'Danish' },
  { code: 'nl', name: 'Dutch' },
  { code: 'en', name: 'English' },
  { code: 'fil', name: 'Filipino' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'hi', name: 'Hindi' },
  { code: 'id', name: 'Indonesian' },
  { code: 'it', name: 'Italian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'mk', name: 'Macedonian' },
  { code: 'ms', name: 'Malay' },
  { code: 'fa', name: 'Persian' },
  { code: 'pl', name: 'Polish' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ro', name: 'Romanian' },
  { code: 'ru', name: 'Russian' },
  { code: 'es', name: 'Spanish' },
  { code: 'sv', name: 'Swedish' },
  { code: 'th', name: 'Thai' },
  { code: 'tr', name: 'Turkish' },
  { code: 'vi', name: 'Vietnamese' },
] as const;

/** code → SttLanguage 查找表 */
const CODE_INDEX: Map<string, SttLanguage> = new Map(
  STT_LANGUAGES.map((l) => [l.code, l]),
);

/** 别名:tl(Tagalog)→ fil(Filipino) */
const ALIASES: Map<string, string> = new Map([
  ['tl', 'fil'],
]);

/** 按精确 code 查找(大小写敏感) */
export function sttLanguageByCode(code: string): SttLanguage | undefined {
  return CODE_INDEX.get(code);
}

/** 判断 code 是否在目录中(大小写敏感) */
function isKnownCode(code: string): boolean {
  return CODE_INDEX.has(code);
}

/**
 * 从环境变量读取系统 locale(LC_ALL > LC_MESSAGES > LANG)。
 * 空字符串视为未设置(不 mask 低优先级变量)。
 * 返回 BCP-47/POSIX 形式的 locale,如 'fr_FR.UTF-8' / 'ja_JP.UTF-8' / null。
 */
function getSystemLocale(): string | null {
  const lcAll = process.env.LC_ALL;
  if (lcAll && lcAll.trim() !== '') return lcAll;
  const lcMessages = process.env.LC_MESSAGES;
  if (lcMessages && lcMessages.trim() !== '') return lcMessages;
  const lang = process.env.LANG;
  if (lang && lang.trim() !== '') return lang;
  return null;
}

/**
 * 从 locale 字符串提取 primary subtag。
 * 'fr_FR.UTF-8' → 'fr'
 * 'ja_JP.UTF-8' → 'ja'
 * 'C' → null(POSIX C locale,无语言信息)
 * 'POSIX' → null
 */
function extractPrimarySubtag(locale: string): string | null {
  if (locale === 'C' || locale === 'POSIX') return null;
  const primary = locale.split(/[_.@-]/)[0];
  if (!primary || primary.length === 0) return null;
  return primary.toLowerCase();
}

/**
 * 规范化 STT 语言输入。
 *
 * - null/undefined/blank → 'en'(默认)
 * - 'auto'(any case)→ STT_LANGUAGE_AUTO sentinel
 * - 精确 code(any case,自动 trim)→ 该 code(小写)
 * - BCP-47/POSIX(en-US / pt_BR.UTF-8)→ primary subtag
 * - 别名(tl → fil)→ 解析后的 code
 * - 不在目录中的语言(zh 等)→ 'en'(兜底)
 */
export function canonicalizeSttLanguage(input: string | null | undefined): string {
  // 1. null/undefined/blank → 默认
  if (input === null || input === undefined) return STT_LANGUAGE_DEFAULT;
  const trimmed = input.trim();
  if (trimmed === '') return STT_LANGUAGE_DEFAULT;

  // 2. auto(any case)→ sentinel
  if (trimmed.toLowerCase() === 'auto') return STT_LANGUAGE_AUTO;

  // 3. 提取 primary subtag(处理 BCP-47 / POSIX)
  const primary = extractPrimarySubtag(trimmed);
  if (!primary) return STT_LANGUAGE_DEFAULT;

  // 4. 别名解析(tl → fil)
  const aliased = ALIASES.get(primary) ?? primary;

  // 5. 精确匹配目录 → 该 code
  if (isKnownCode(aliased)) return aliased;

  // 6. 不在目录中 → 默认
  return STT_LANGUAGE_DEFAULT;
}

/**
 * 返回 API 调用用的语言代码(永不返回 'auto')。
 *
 * - 'auto' → 系统环境语言(解析失败则 'en')
 * - 已知 code → 该 code
 * - 未知/空 → 'en'
 */
export function languageForApi(input: string | null | undefined): string {
  const canonical = canonicalizeSttLanguage(input);
  if (canonical !== STT_LANGUAGE_AUTO) return canonical;

  // auto → 系统环境语言
  const locale = getSystemLocale();
  if (!locale) return STT_LANGUAGE_DEFAULT;
  const primary = extractPrimarySubtag(locale);
  if (!primary) return STT_LANGUAGE_DEFAULT;
  const aliased = ALIASES.get(primary) ?? primary;
  if (isKnownCode(aliased)) return aliased;
  return STT_LANGUAGE_DEFAULT;
}
