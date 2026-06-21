export type PlatformType = 'web' | 'android' | 'third_wechat' | 'third_ali' | 'mp_weixin'

export function normalizePlatformType(loginType?: string | null, fallback: PlatformType = 'android'): PlatformType {
  switch (loginType) {
    case 'web':
    case 'android':
    case 'third_wechat':
    case 'third_ali':
    case 'mp_weixin':
      return loginType
    default:
      return fallback
  }
}
