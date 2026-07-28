/**
 * Theme/gender cross-end shared constants (batch 1).
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

export const THEME_STORAGE_KEY = 'ihui-theme'
export const LOCALE_STORAGE_KEY = 'ihui-locale'