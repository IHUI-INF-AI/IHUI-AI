/**
 * Theme/gender cross-end shared constants.
 *
 * 被 packages/shared/src/constants.ts、storage-keys.ts 等多处引用,
 * 必须存在否则阻塞全仓 typecheck。
 */

export type Gender = 0 | 1 | 2

export const GENDERS: ReadonlyArray<{ value: Gender; key: 'male' | 'female' | 'secret' }> = [
  { value: 1, key: 'male' },
  { value: 2, key: 'female' },
  { value: 0, key: 'secret' },
] as const

export const GENDER_KEYS: Record<'male' | 'female' | 'secret', string> = {
  male: 'profileEdit.gender_male',
  female: 'profileEdit.gender_female',
  secret: 'profileEdit.gender_secret',
}

/**
 * 主题持久化 key(各端 theme store 持久化用,与 web/miniapp-taro/extension 一致)。
 */
export const THEME_STORAGE_KEY = 'ihui-theme'

/**
 * 语言持久化 key(各端 i18n 持久化用,与 web/miniapp-taro/extension 一致)。
 */
export const LOCALE_STORAGE_KEY = 'ihui-locale'
