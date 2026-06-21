// 手机号验证修复脚本
// 修复国际手机号验证、国家代码选择和输入体验问题

export const phoneValidationFixes = {
  // 增强的手机号验证函数
  validatePhoneByCountryCode(phone, countryCode) {
    if (!phone || phone.trim() === '') return false

    // 移除国家代码前缀和空格
    const phoneWithoutCode = phone.replace(/^\+\d+/, '').replace(/\s+/g, '')

    // 检查是否全为数字
    if (!/^\d+$/.test(phoneWithoutCode)) return false

    const dialCode = countryCode.dialCode.replace(/^\+/, '')

    // 详细的国家手机号验证规则
    const validationRules = {
      86: {
        // 中国
        pattern: /^1[3-9]\d{9}$/,
        length: 11,
        description: '11位，以1开头，第二位是3-9',
      },
      1: {
        // 美国/加拿大
        pattern: /^\d{10}$/,
        length: 10,
        description: '10位数字',
      },
      44: {
        // 英国
        pattern: /^[1-9]\d{9,10}$/,
        length: [10, 11],
        description: '10-11位数字',
      },
      81: {
        // 日本
        pattern: /^[1-9]\d{9,10}$/,
        length: [10, 11],
        description: '10-11位数字',
      },
      82: {
        // 韩国
        pattern: /^[1-9]\d{8,9}$/,
        length: [9, 10],
        description: '9-10位数字',
      },
      852: {
        // 香港
        pattern: /^[2-9]\d{7}$/,
        length: 8,
        description: '8位数字，以2-9开头',
      },
      853: {
        // 澳门
        pattern: /^[2-9]\d{7}$/,
        length: 8,
        description: '8位数字，以2-9开头',
      },
      886: {
        // 台湾
        pattern: /^9\d{8}$/,
        length: 9,
        description: '9位数字，以9开头',
      },
      65: {
        // 新加坡
        pattern: /^[3689]\d{7}$/,
        length: 8,
        description: '8位数字，以3、6、8、9开头',
      },
      60: {
        // 马来西亚
        pattern: /^1[0-9]\d{7,8}$/,
        length: [9, 10],
        description: '9-10位数字，以1开头',
      },
      66: {
        // 泰国
        pattern: /^[689]\d{8}$/,
        length: 9,
        description: '9位数字，以6、8、9开头',
      },
      84: {
        // 越南
        pattern: /^[1-9]\d{8,9}$/,
        length: [9, 10],
        description: '9-10位数字',
      },
      91: {
        // 印度
        pattern: /^[6-9]\d{9}$/,
        length: 10,
        description: '10位数字，以6-9开头',
      },
      61: {
        // 澳大利亚
        pattern: /^4\d{8}$/,
        length: 9,
        description: '9位数字，以4开头',
      },
      64: {
        // 新西兰
        pattern: /^2[0-9]\d{7,8}$/,
        length: [9, 10],
        description: '9-10位数字，以2开头',
      },
    }

    const rule = validationRules[dialCode]

    if (rule) {
      // 使用具体规则验证
      if (rule.pattern) {
        return rule.pattern.test(phoneWithoutCode)
      }

      // 备用长度验证
      if (Array.isArray(rule.length)) {
        return rule.length.includes(phoneWithoutCode.length)
      } else {
        return phoneWithoutCode.length === rule.length
      }
    } else {
      // 通用验证：6-15位数字
      return phoneWithoutCode.length >= 6 && phoneWithoutCode.length <= 15
    }
  },

  // 自动检测国家代码
  autoDetectCountryCode(phoneNumber, countryCodes) {
    if (!phoneNumber || !phoneNumber.startsWith('+')) {
      return null
    }

    // 按长度从长到短排序，优先匹配更长的国家代码
    const sortedCodes = [...countryCodes].sort((a, b) => b.dialCode.length - a.dialCode.length)

    for (const country of sortedCodes) {
      if (phoneNumber.startsWith(country.dialCode)) {
        return {
          country,
          phoneWithoutCode: phoneNumber.substring(country.dialCode.length),
        }
      }
    }

    return null
  },

  // 格式化手机号显示
  formatPhoneNumber(phone, countryCode) {
    if (!phone) return ''

    const dialCode = countryCode.dialCode.replace(/^\+/, '')
    const cleanPhone = phone.replace(/\D/g, '')

    // 根据国家代码格式化显示
    switch (dialCode) {
      case '86': // 中国: 138 0013 8000
        return cleanPhone.replace(/(\d{3})(\d{4})(\d{4})/, '$1 $2 $3')
      case '1': // 美国: (555) 123-4567
        return cleanPhone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')
      case '44': // 英国: 07700 900123
        if (cleanPhone.length === 11) {
          return cleanPhone.replace(/(\d{5})(\d{6})/, '$1 $2')
        }
        return cleanPhone.replace(/(\d{4})(\d{6})/, '$1 $2')
      default:
        // 通用格式：每4位加空格
        return cleanPhone.replace(/(\d{4})/g, '$1 ').trim()
    }
  },

  // 获取手机号验证错误信息
  getPhoneValidationError(phone, countryCode, t) {
    if (!phone || phone.trim() === '') {
      return t('auth.validation.phoneRequired')
    }

    const cleanPhone = phone.replace(/^\+\d+/, '').replace(/\s+/g, '')

    if (!/^\d+$/.test(cleanPhone)) {
      return t('auth.validation.phoneOnlyNumbers')
    }

    if (!this.validatePhoneByCountryCode(phone, countryCode)) {
      const dialCode = countryCode.dialCode.replace(/^\+/, '')
      const rules = {
        86: '请输入正确的中国手机号（11位，以1开头）',
        1: '请输入正确的美国/加拿大手机号（10位数字）',
        44: '请输入正确的英国手机号（10-11位数字）',
      }

      return rules[dialCode] || t('auth.validation.phoneInvalid')
    }

    return null
  },

  // 手机号输入处理
  handlePhoneInput(value, countryCode, setPhone, setCountryCode, countryCodes) {
    // 自动检测国家代码
    if (value.startsWith('+')) {
      const detected = this.autoDetectCountryCode(value, countryCodes)
      if (detected) {
        setCountryCode(detected.country)
        setPhone(detected.phoneWithoutCode)
        return
      }
    }

    // 只保留数字和空格
    const cleanValue = value.replace(/[^\d\s]/g, '')
    setPhone(cleanValue)
  },

  // 国家代码搜索过滤
  filterCountryCodes(query, countryCodes, isChineseLanguage) {
    if (!query) return countryCodes

    const lowerQuery = query.toLowerCase()

    return countryCodes.filter(country => {
      const name = isChineseLanguage ? country.name : country.nameEn
      const dialCode = country.dialCode

      return (
        name.toLowerCase().includes(lowerQuery) ||
        dialCode.includes(query) ||
        country.code.toLowerCase().includes(lowerQuery)
      )
    })
  },

  // 获取常用国家代码（根据用户地区）
  getPopularCountryCodes(countryCodes, userRegion = 'CN') {
    const popularCodes = {
      CN: ['86', '852', '853', '886'], // 中国大陆、香港、澳门、台湾
      US: ['1', '86', '44', '81'], // 美国、中国、英国、日本
      EU: ['44', '49', '33', '39'], // 英国、德国、法国、意大利
      ASIA: ['86', '81', '82', '65'], // 中国、日本、韩国、新加坡
    }

    const codes = popularCodes[userRegion] || popularCodes['CN']
    const popular = []
    const others = []

    countryCodes.forEach(country => {
      const dialCode = country.dialCode.replace(/^\+/, '')
      if (codes.includes(dialCode)) {
        popular.push(country)
      } else {
        others.push(country)
      }
    })

    // 按指定顺序排列常用国家代码
    const sortedPopular = codes
      .map(code => popular.find(country => country.dialCode === `+${code}`))
      .filter(Boolean)

    return [...sortedPopular, ...others]
  },
}
