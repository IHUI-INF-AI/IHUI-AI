import type { CForm } from './types'

export const EMPTY: CForm = {
  userId: '',
  title: '',
  recipientName: '',
  source: 'manual',
  templateId: '',
  issuedAt: '',
}

export const PAGE_SIZE = 10

/** 证书来源 i18n key 静态映射表:sourceLabel.${source} — 用于消除 `t(`sourceLabel.${var}`)` 动态拼接 */
export const SOURCE_LABEL_KEY: Record<string, string> = {
  manual: 'sourceLabel.manual',
  exam: 'sourceLabel.exam',
  learn: 'sourceLabel.learn',
}
