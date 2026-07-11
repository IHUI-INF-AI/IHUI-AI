/**
 * i18n 语言静态元数据。
 *
 * 提供 RTL/复数规则/货币位置/分隔符/每周首日 等运行时元数据，
 * 与 apps/web/src/i18n/request.ts 支持的 5 语言（zh-CN, zh-TW, en, ja, ko）对齐。
 * 无需任何后端依赖，无网络/无后端时同样可用。
 *
 * 数据源：旧架构 client/src/constants/i18nLanguages.ts + CLDR 公开标准默认值。
 */

export interface LanguageMeta {
  code: string
  name: string
  nativeName: string
  rtl: boolean
  pluralRule: 'one' | 'few' | 'many' | 'other'
  currencyPosition: 'before' | 'after'
  decimalSeparator: string
  thousandSeparator: string
  firstDayOfWeek: number
}

export const LANGUAGES: LanguageMeta[] = [
  {
    code: 'zh-CN',
    name: 'Chinese (Simplified)',
    nativeName: '简体中文',
    rtl: false,
    pluralRule: 'other',
    currencyPosition: 'before',
    decimalSeparator: '.',
    thousandSeparator: ',',
    firstDayOfWeek: 1,
  },
  {
    code: 'zh-TW',
    name: 'Chinese (Traditional)',
    nativeName: '繁體中文',
    rtl: false,
    pluralRule: 'other',
    currencyPosition: 'before',
    decimalSeparator: '.',
    thousandSeparator: ',',
    firstDayOfWeek: 1,
  },
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    rtl: false,
    pluralRule: 'one',
    currencyPosition: 'before',
    decimalSeparator: '.',
    thousandSeparator: ',',
    firstDayOfWeek: 0,
  },
  {
    code: 'ja',
    name: 'Japanese',
    nativeName: '日本語',
    rtl: false,
    pluralRule: 'other',
    currencyPosition: 'before',
    decimalSeparator: '.',
    thousandSeparator: ',',
    firstDayOfWeek: 0,
  },
  {
    code: 'ko',
    name: 'Korean',
    nativeName: '한국어',
    rtl: false,
    pluralRule: 'other',
    currencyPosition: 'before',
    decimalSeparator: '.',
    thousandSeparator: ',',
    firstDayOfWeek: 0,
  },
]

/** 根据 code 查找语言元数据，未命中返回 undefined */
export function getLanguageMeta(code: string): LanguageMeta | undefined {
  return LANGUAGES.find((m) => m.code === code)
}
