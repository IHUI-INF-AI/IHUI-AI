/**
 * 国家代码和电话区号配置
 */

export interface CountryCode {
  code: string // ISO 3166-1 alpha-2 国家代码
  name: string // 中文名称
  nameEn: string // 英文名称
  dialCode: string // 电话区号
  flag: string // 国旗emoji
}

export const countryCodes: CountryCode[] = [
  {
    code: 'CN',
    name: '中国',
    nameEn: 'China',
    dialCode: '+86',
    flag: '🇨🇳',
  },
  {
    code: 'US',
    name: '美国',
    nameEn: 'United States',
    dialCode: '+1',
    flag: '🇺🇸',
  },
  {
    code: 'GB',
    name: '英国',
    nameEn: 'United Kingdom',
    dialCode: '+44',
    flag: '🇬🇧',
  },
  {
    code: 'JP',
    name: '日本',
    nameEn: 'Japan',
    dialCode: '+81',
    flag: '🇯🇵',
  },
  {
    code: 'KR',
    name: '韩国',
    nameEn: 'South Korea',
    dialCode: '+82',
    flag: '🇰🇷',
  },
  {
    code: 'HK',
    name: '香港',
    nameEn: 'Hong Kong',
    dialCode: '+852',
    flag: '🇭🇰',
  },
  {
    code: 'MO',
    name: '澳门',
    nameEn: 'Macao',
    dialCode: '+853',
    flag: '🇲🇴',
  },
  {
    code: 'TW',
    name: '台湾',
    nameEn: 'Taiwan',
    dialCode: '+886',
    flag: '🇹🇼',
  },
  {
    code: 'SG',
    name: '新加坡',
    nameEn: 'Singapore',
    dialCode: '+65',
    flag: '🇸🇬',
  },
  {
    code: 'MY',
    name: '马来西亚',
    nameEn: 'Malaysia',
    dialCode: '+60',
    flag: '🇲🇾',
  },
  {
    code: 'TH',
    name: '泰国',
    nameEn: 'Thailand',
    dialCode: '+66',
    flag: '🇹🇭',
  },
  {
    code: 'VN',
    name: '越南',
    nameEn: 'Vietnam',
    dialCode: '+84',
    flag: '🇻🇳',
  },
  {
    code: 'IN',
    name: '印度',
    nameEn: 'India',
    dialCode: '+91',
    flag: '🇮🇳',
  },
  {
    code: 'AU',
    name: '澳大利亚',
    nameEn: 'Australia',
    dialCode: '+61',
    flag: '🇦🇺',
  },
  {
    code: 'NZ',
    name: '新西兰',
    nameEn: 'New Zealand',
    dialCode: '+64',
    flag: '🇳🇿',
  },
  {
    code: 'CA',
    name: '加拿大',
    nameEn: 'Canada',
    dialCode: '+1',
    flag: '🇨🇦',
  },
  {
    code: 'DE',
    name: '德国',
    nameEn: 'Germany',
    dialCode: '+49',
    flag: '🇩🇪',
  },
  {
    code: 'FR',
    name: '法国',
    nameEn: 'France',
    dialCode: '+33',
    flag: '🇫🇷',
  },
  {
    code: 'IT',
    name: '意大利',
    nameEn: 'Italy',
    dialCode: '+39',
    flag: '🇮🇹',
  },
  {
    code: 'ES',
    name: '西班牙',
    nameEn: 'Spain',
    dialCode: '+34',
    flag: '🇪🇸',
  },
  {
    code: 'RU',
    name: '俄罗斯',
    nameEn: 'Russia',
    dialCode: '+7',
    flag: '🇷🇺',
  },
  {
    code: 'BR',
    name: '巴西',
    nameEn: 'Brazil',
    dialCode: '+55',
    flag: '🇧🇷',
  },
]

/**
 * 根据国家代码获取国家信息
 */
export function getCountryByCode(code: string): CountryCode | undefined {
  return countryCodes.find(country => country.code === code)
}

/**
 * 根据电话区号获取国家信息
 */
export function getCountryByDialCode(dialCode: string): CountryCode | undefined {
  const cleanDialCode = dialCode.startsWith('+') ? dialCode : `+${dialCode}`
  return countryCodes.find(country => country.dialCode === cleanDialCode)
}

/**
 * 获取默认国家代码（中国）
 */
export function getDefaultCountryCode(): CountryCode {
  return getCountryByCode('CN') || countryCodes[0]
}

/**
 * 搜索国家（支持中英文名称和区号）
 */
export function searchCountries(query: string): CountryCode[] {
  if (!query) return countryCodes

  const lowerQuery = query.toLowerCase()
  return countryCodes.filter(
    country =>
      country.name.toLowerCase().includes(lowerQuery) ||
      country.nameEn.toLowerCase().includes(lowerQuery) ||
      country.dialCode.includes(lowerQuery) ||
      country.code.toLowerCase().includes(lowerQuery)
  )
}

/**
 * 格式化电话号码显示
 */
export function formatPhoneNumber(phone: string, countryCode: CountryCode): string {
  if (!phone) return ''

  const cleanPhone = phone.replace(/\D/g, '')

  // 根据不同国家的格式规则进行格式化
  switch (countryCode.code) {
    case 'CN':
      // 中国手机号格式：138 0013 8000
      if (cleanPhone.length === 11) {
        return `${cleanPhone.slice(0, 3)} ${cleanPhone.slice(3, 7)} ${cleanPhone.slice(7)}`
      }
      break
    case 'US':
    case 'CA':
      // 美国/加拿大格式：(555) 123-4567
      if (cleanPhone.length === 10) {
        return `(${cleanPhone.slice(0, 3)}) ${cleanPhone.slice(3, 6)}-${cleanPhone.slice(6)}`
      }
      break
    default:
      // 默认格式：每4位一组
      return cleanPhone.replace(/(\d{4})(?=\d)/g, '$1 ')
  }

  return cleanPhone
}

/**
 * 验证电话号码格式
 */
export function validatePhoneFormat(phone: string, countryCode: CountryCode): boolean {
  const cleanPhone = phone.replace(/\D/g, '')

  switch (countryCode.code) {
    case 'CN':
      return /^1[3-9]\d{9}$/.test(cleanPhone)
    case 'US':
    case 'CA':
      return /^\d{10}$/.test(cleanPhone)
    case 'GB':
      return /^[1-9]\d{9,10}$/.test(cleanPhone)
    case 'JP':
      return /^[1-9]\d{9,10}$/.test(cleanPhone)
    case 'KR':
      return /^[1-9]\d{8,9}$/.test(cleanPhone)
    case 'HK':
      return /^[2-9]\d{7}$/.test(cleanPhone)
    case 'MO':
      return /^[2-9]\d{7}$/.test(cleanPhone)
    case 'TW':
      return /^9\d{8}$/.test(cleanPhone)
    case 'SG':
      return /^[3689]\d{7}$/.test(cleanPhone)
    case 'MY':
      return /^1[0-9]\d{7,8}$/.test(cleanPhone)
    case 'TH':
      return /^[689]\d{8}$/.test(cleanPhone)
    case 'VN':
      return /^[1-9]\d{8,9}$/.test(cleanPhone)
    case 'IN':
      return /^[6-9]\d{9}$/.test(cleanPhone)
    case 'AU':
      return /^4\d{8}$/.test(cleanPhone)
    case 'NZ':
      return /^2[0-9]\d{7,8}$/.test(cleanPhone)
    default:
      // 通用验证：6-15位数字
      return cleanPhone.length >= 6 && cleanPhone.length <= 15
  }
}
