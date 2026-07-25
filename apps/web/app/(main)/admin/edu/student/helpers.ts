import type { SForm } from './types'

export const EMPTY: SForm = {
  nickname: '',
  phone: '',
  email: '',
  password: '',
  level: '1',
  status: 1,
}

export const PAGE_SIZE = 10

export const LEVEL_MAP: Record<number, string> = {
  1: 'beginner',
  2: 'intermediate',
  3: 'advanced',
  4: 'expert',
}

/**
 * 学生等级 i18n key 静态映射表(字符串枚值):level.${name} — 用于消除 `t(\`level.${var}\`)` 动态拼接
 */
export const LEVEL_KEY: Record<string, string> = Object.fromEntries(
  Object.values(LEVEL_MAP).map((v) => [v, `level.${v}`]),
)

/**
 * 学生等级 i18n key 静态映射表(数字枚值,详情页用):level.${num} — 用于消除 `t(\`level.${var}\`)` 动态拼接
 */
export const LEVEL_NUM_KEY: Record<number, string> = Object.fromEntries(
  Object.keys(LEVEL_MAP).map((k) => [Number(k), `level.${k}`]),
)
