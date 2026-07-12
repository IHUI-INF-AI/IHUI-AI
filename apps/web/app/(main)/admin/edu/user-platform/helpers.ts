import type { UserPlatform, CForm, SearchQ } from './types'

export const PAGE_SIZE = 10
export const PERM = 'course:userplatform:'

export const EMPTY_FORM: CForm = {
  userUuid: '',
  platformId: '',
  identityId: '',
  status: '0',
  isDel: '0',
  field1: '',
}

export const EMPTY_SEARCH: SearchQ = {
  userUuid: '',
  platformId: '',
  identityId: '',
  status: '',
}

export function fmt(s?: string | null): string {
  return s
    ? new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(s))
    : '-'
}

export function userPlatformToForm(r: UserPlatform): CForm {
  return {
    userUuid: r.userUuid,
    platformId: r.platformId,
    identityId: r.identityId,
    status: String(r.status),
    isDel: String(r.isDel),
    field1: r.field1 ?? '',
  }
}
