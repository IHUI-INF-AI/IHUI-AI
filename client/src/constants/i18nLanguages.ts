/**
 * 9 语言静态元数据（V1 本地方案）
 *
 * 用途: 替代 useI18nV2 中后端 /api/v1/i18n-v2/languages 接口,
 * 提供 RTL/复数规则/货币位置/分隔符/显示名 等运行时元数据,
 * 无需任何后端依赖, 在任何时候（无网络/无后端）都好使。
 *
 * 数据源: 来自 useI18nV2 测试样例 (SAMPLE_LANGUAGES) + CLDR 公开标准默认值。
 */

export type LanguageDirection = 'ltr' | 'rtl'
export type CurrencyPosition = 'before' | 'after'

export interface LanguageMeta {
  code: string
  display_name: string
  english_name: string
  direction: LanguageDirection
  is_rtl: boolean
  decimal_separator: string
  thousands_separator: string
  currency_position: CurrencyPosition
  first_day_of_week: number
  plural_rule: string
  number_grouping: number
}

export const I18N_LANGUAGES: LanguageMeta[] = [
  {
    code: 'zh-CN',
    display_name: '简体中文',
    english_name: 'Chinese (Simplified)',
    direction: 'ltr',
    is_rtl: false,
    decimal_separator: '.',
    thousands_separator: ',',
    currency_position: 'before',
    first_day_of_week: 1,
    plural_rule: 'other_only',
    number_grouping: 3,
  },
  {
    code: 'zh-TW',
    display_name: '繁體中文',
    english_name: 'Chinese (Traditional)',
    direction: 'ltr',
    is_rtl: false,
    decimal_separator: '.',
    thousands_separator: ',',
    currency_position: 'before',
    first_day_of_week: 1,
    plural_rule: 'other_only',
    number_grouping: 3,
  },
  {
    code: 'en-US',
    display_name: 'English',
    english_name: 'English (US)',
    direction: 'ltr',
    is_rtl: false,
    decimal_separator: '.',
    thousands_separator: ',',
    currency_position: 'before',
    first_day_of_week: 0,
    plural_rule: 'one_other',
    number_grouping: 3,
  },
  {
    code: 'ja',
    display_name: '日本語',
    english_name: 'Japanese',
    direction: 'ltr',
    is_rtl: false,
    decimal_separator: '.',
    thousands_separator: ',',
    currency_position: 'before',
    first_day_of_week: 0,
    plural_rule: 'other_only',
    number_grouping: 3,
  },
  {
    code: 'ko',
    display_name: '한국어',
    english_name: 'Korean',
    direction: 'ltr',
    is_rtl: false,
    decimal_separator: '.',
    thousands_separator: ',',
    currency_position: 'before',
    first_day_of_week: 0,
    plural_rule: 'other_only',
    number_grouping: 3,
  },
  {
    code: 'ar',
    display_name: 'العربية',
    english_name: 'Arabic',
    direction: 'rtl',
    is_rtl: true,
    decimal_separator: '٫',
    thousands_separator: '٬',
    currency_position: 'after',
    first_day_of_week: 6,
    plural_rule: 'arabic',
    number_grouping: 3,
  },
  {
    code: 'he',
    display_name: 'עברית',
    english_name: 'Hebrew',
    direction: 'rtl',
    is_rtl: true,
    decimal_separator: '.',
    thousands_separator: ',',
    currency_position: 'after',
    first_day_of_week: 0,
    plural_rule: 'hebrew',
    number_grouping: 3,
  },
  {
    code: 'fr',
    display_name: 'Français',
    english_name: 'French',
    direction: 'ltr',
    is_rtl: false,
    decimal_separator: ',',
    thousands_separator: ' ',
    currency_position: 'after',
    first_day_of_week: 1,
    plural_rule: 'french',
    number_grouping: 3,
  },
  {
    code: 'es',
    display_name: 'Español',
    english_name: 'Spanish',
    direction: 'ltr',
    is_rtl: false,
    decimal_separator: ',',
    thousands_separator: '.',
    currency_position: 'after',
    first_day_of_week: 1,
    plural_rule: 'one_other',
    number_grouping: 3,
  },
]

// 快速查找表 (按 code 索引)
export const I18N_LANGUAGE_MAP: Readonly<Record<string, LanguageMeta>> = I18N_LANGUAGES.reduce(
  (acc, m) => {
    acc[m.code] = m
    return acc
  },
  {} as Record<string, LanguageMeta>,
)

/**
 * 根据 code 查找语言元数据，未命中返回 undefined
 */
export const getLanguageMeta = (code: string): LanguageMeta | undefined => I18N_LANGUAGE_MAP[code]
