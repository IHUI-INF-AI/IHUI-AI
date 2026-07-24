import { describe, it, expect } from 'vitest'
import {
  buildSensitiveKeySet,
  isSensitiveKey,
  maskValue,
  createMaskRule,
  applyMaskStrategy,
  sanitizeData,
  MaskStrategy,
  DataMaskingPipeline,
  DEFAULT_SENSITIVE_KEYS,
} from '../src/plugins/response-sanitizer.js'

describe('response-sanitizer — buildSensitiveKeySet', () => {
  it('包含默认敏感字段', () => {
    const keys = buildSensitiveKeySet()
    expect(keys.has('password')).toBe(true)
    expect(keys.has('phone')).toBe(true)
    expect(keys.has('idcard')).toBe(true)
    expect(keys.has('bankcard')).toBe(true)
    expect(keys.has('email')).toBe(true)
    expect(keys.has('token')).toBe(true)
    expect(keys.has('secret')).toBe(true)
  })

  it('合并 extraKeys', () => {
    const keys = buildSensitiveKeySet(['apikey', 'sessionid'])
    expect(keys.has('apikey')).toBe(true)
    expect(keys.has('sessionid')).toBe(true)
    expect(keys.has('password')).toBe(true)
  })

  it('extraKeys 大小写归一化', () => {
    const keys = buildSensitiveKeySet(['APIKey'])
    expect(keys.has('apikey')).toBe(true)
  })
})

describe('response-sanitizer — isSensitiveKey', () => {
  const keys = buildSensitiveKeySet()

  it('精确匹配', () => {
    expect(isSensitiveKey('password', keys)).toBe(true)
  })

  it('子串匹配 (passwordHash)', () => {
    expect(isSensitiveKey('passwordHash', keys)).toBe(true)
  })

  it('大小写不敏感', () => {
    expect(isSensitiveKey('PASSWORD', keys)).toBe(true)
    expect(isSensitiveKey('UserPhone', keys)).toBe(true)
  })

  it('非敏感字段', () => {
    expect(isSensitiveKey('username', keys)).toBe(false)
    expect(isSensitiveKey('createdAt', keys)).toBe(false)
  })
})

describe('response-sanitizer — maskValue (旧版简单脱敏)', () => {
  it('phone 保留前 3 后 4', () => {
    expect(maskValue('phone', '13812345678')).toBe('138****5678')
  })

  it('phone 短号码直接掩码', () => {
    expect(maskValue('phone', '12345')).toBe('***')
  })

  it('email 保留首字符+域名', () => {
    expect(maskValue('email', 'user@example.com')).toBe('u***@example.com')
  })

  it('email 无 @ 符号', () => {
    expect(maskValue('email', 'noemail')).toBe('***')
  })

  it('idcard 保留前 6 后 4', () => {
    const result = maskValue('idCard', '110101199001011234') as string
    expect(result.startsWith('110101')).toBe(true)
    expect(result.endsWith('1234')).toBe(true)
    expect(result).toContain('*')
  })

  it('非字符串值返回 ***', () => {
    expect(maskValue('password', 12345)).toBe('***')
    expect(maskValue('password', null)).toBe('***')
    expect(maskValue('password', { a: 1 })).toBe('***')
  })

  it('其他敏感字段统一 ***', () => {
    expect(maskValue('password', 'secret123')).toBe('***')
    expect(maskValue('token', 'jwt-payload')).toBe('***')
  })
})

describe('response-sanitizer — createMaskRule', () => {
  it('默认策略 FULL', () => {
    const rule = createMaskRule('password')
    expect(rule.field).toBe('password')
    expect(rule.strategy).toBe(MaskStrategy.FULL)
    expect(rule.keepPrefix).toBe(0)
    expect(rule.keepSuffix).toBe(0)
    expect(rule.enabled).toBe(true)
  })

  it('指定策略+选项', () => {
    const rule = createMaskRule('phone', MaskStrategy.PARTIAL, {
      keepPrefix: 3,
      keepSuffix: 4,
      enabled: false,
    })
    expect(rule.strategy).toBe(MaskStrategy.PARTIAL)
    expect(rule.keepPrefix).toBe(3)
    expect(rule.keepSuffix).toBe(4)
    expect(rule.enabled).toBe(false)
  })
})

describe('response-sanitizer — applyMaskStrategy', () => {
  const secretKey = Buffer.from('test-secret-key-32-bytes-long!!!!', 'utf8')

  it('FULL → [REDACTED]', () => {
    const rule = createMaskRule('x', MaskStrategy.FULL)
    expect(applyMaskStrategy(rule, 'anything', secretKey)).toBe('[REDACTED]')
  })

  it('PARTIAL 保留前缀+后缀', () => {
    const rule = createMaskRule('x', MaskStrategy.PARTIAL, { keepPrefix: 2, keepSuffix: 2 })
    expect(applyMaskStrategy(rule, 'abcdefgh', secretKey)).toBe('ab****gh')
  })

  it('PARTIAL 过短时返回 ***', () => {
    const rule = createMaskRule('x', MaskStrategy.PARTIAL, { keepPrefix: 5, keepSuffix: 5 })
    expect(applyMaskStrategy(rule, 'abc', secretKey)).toBe('***')
  })

  it('KEEP_PREFIX 保留前 N', () => {
    const rule = createMaskRule('x', MaskStrategy.KEEP_PREFIX, { keepPrefix: 3 })
    expect(applyMaskStrategy(rule, 'abcdefg', secretKey)).toBe('abc***')
  })

  it('KEEP_PREFIX 过短返回 ***', () => {
    const rule = createMaskRule('x', MaskStrategy.KEEP_PREFIX, { keepPrefix: 10 })
    expect(applyMaskStrategy(rule, 'abc', secretKey)).toBe('***')
  })

  it('HASH 返回 sha256 截断 16 位', () => {
    const rule = createMaskRule('x', MaskStrategy.HASH)
    const result = applyMaskStrategy(rule, 'test', secretKey)
    expect(result).toHaveLength(16)
    expect(result).toMatch(/^[0-9a-f]{16}$/)
  })

  it('HMAC 返回 hmac 截断 16 位', () => {
    const rule = createMaskRule('x', MaskStrategy.HMAC)
    const result = applyMaskStrategy(rule, 'test', secretKey)
    expect(result).toHaveLength(16)
    expect(result).toMatch(/^[0-9a-f]{16}$/)
  })

  it('AES 返回 AES: 前缀 + base64', () => {
    const rule = createMaskRule('x', MaskStrategy.AES)
    const result = applyMaskStrategy(rule, 'test', secretKey)
    expect(result.startsWith('AES:')).toBe(true)
  })

  it('EMAIL 邮箱脱敏', () => {
    const rule = createMaskRule('x', MaskStrategy.EMAIL)
    expect(applyMaskStrategy(rule, 'user@example.com', secretKey)).toBe('u***@example.com')
  })

  it('PHONE 手机脱敏', () => {
    const rule = createMaskRule('x', MaskStrategy.PHONE)
    expect(applyMaskStrategy(rule, '13812345678', secretKey)).toBe('138****5678')
  })

  it('ID_CARD 身份证脱敏', () => {
    const rule = createMaskRule('x', MaskStrategy.ID_CARD)
    const result = applyMaskStrategy(rule, '110101199001011234', secretKey) as string
    expect(result.startsWith('110101')).toBe(true)
    expect(result.endsWith('1234')).toBe(true)
  })

  it('CUSTOM 自定义函数', () => {
    const rule = createMaskRule('x', MaskStrategy.CUSTOM, {
      customFn: (v) => `CUSTOM:${String(v).toUpperCase()}`,
    })
    expect(applyMaskStrategy(rule, 'hello', secretKey)).toBe('CUSTOM:HELLO')
  })

  it('CUSTOM 无函数返回 [REDACTED]', () => {
    const rule = createMaskRule('x', MaskStrategy.CUSTOM)
    expect(applyMaskStrategy(rule, 'hello', secretKey)).toBe('[REDACTED]')
  })

  it('CUSTOM 函数抛错返回 [ERROR]', () => {
    const rule = createMaskRule('x', MaskStrategy.CUSTOM, {
      customFn: () => {
        throw new Error('boom')
      },
    })
    expect(applyMaskStrategy(rule, 'hello', secretKey)).toBe('[ERROR]')
  })
})

describe('response-sanitizer — sanitizeData (递归脱敏)', () => {
  const keys = buildSensitiveKeySet()

  it('递归处理嵌套对象', () => {
    const data = {
      user: 'alice',
      password: 'secret',
      profile: { phone: '13812345678', bio: 'hello' },
    }
    const out = sanitizeData(data, keys) as Record<string, unknown>
    expect(out.user).toBe('alice')
    expect(out.password).toBe('***')
    const profile = out.profile as Record<string, unknown>
    expect(profile.phone).toBe('138****5678')
    expect(profile.bio).toBe('hello')
  })

  it('递归处理数组', () => {
    const data = [
      { username: 'a', token: 't1' },
      { username: 'b', token: 't2' },
    ]
    const out = sanitizeData(data, keys) as Array<Record<string, unknown>>
    expect(out[0]!.username).toBe('a')
    expect(out[0]!.token).toBe('***')
    expect(out[1]!.token).toBe('***')
  })

  it('字段级规则优先于默认 maskValue', () => {
    const rules = [createMaskRule('password', MaskStrategy.HASH)]
    const out = sanitizeData({ password: 'secret' }, keys, { rules }) as Record<string, unknown>
    expect(out.password).toMatch(/^[0-9a-f]{16}$/)
  })

  it('disabled 规则回退到默认 maskValue', () => {
    const rules = [createMaskRule('password', MaskStrategy.HASH, { enabled: false })]
    const out = sanitizeData({ password: 'secret' }, keys, { rules }) as Record<string, unknown>
    expect(out.password).toBe('***')
  })

  it('非对象/数组原样返回', () => {
    expect(sanitizeData('hello', keys)).toBe('hello')
    expect(sanitizeData(42, keys)).toBe(42)
    expect(sanitizeData(null, keys)).toBe(null)
  })

  it('空对象返回空对象', () => {
    expect(sanitizeData({}, keys)).toEqual({})
  })

  it('空数组返回空数组', () => {
    expect(sanitizeData([], keys)).toEqual([])
  })
})

describe('response-sanitizer — DataMaskingPipeline', () => {
  it('addRule + mask 应用规则', () => {
    const pipeline = new DataMaskingPipeline()
    pipeline.addRule(createMaskRule('ssn', MaskStrategy.FULL))
    const out = pipeline.mask({ ssn: '123-45-6789', name: 'alice' }) as Record<string, unknown>
    expect(out.ssn).toBe('[REDACTED]')
    expect(out.name).toBe('alice')
  })

  it('removeRule 移除规则', () => {
    const pipeline = new DataMaskingPipeline()
    pipeline.addRule(createMaskRule('ssn', MaskStrategy.FULL))
    expect(pipeline.removeRule('ssn')).toBe(true)
    expect(pipeline.removeRule('ssn')).toBe(false)
    const out = pipeline.mask({ ssn: '123' }) as Record<string, unknown>
    expect(out.ssn).toBe('123')
  })

  it('mask 递归处理嵌套对象', () => {
    const pipeline = new DataMaskingPipeline()
    pipeline.addRule(createMaskRule('password', MaskStrategy.FULL))
    const out = pipeline.mask({ a: { password: 'x' }, b: [{ password: 'y' }] }) as Record<
      string,
      unknown
    >
    const a = out.a as Record<string, unknown>
    const b = out.b as Array<Record<string, unknown>>
    expect(a.password).toBe('[REDACTED]')
    expect(b[0]!.password).toBe('[REDACTED]')
  })

  it('maskRows 过滤行', () => {
    const pipeline = new DataMaskingPipeline()
    pipeline.addRule(createMaskRule('secret', MaskStrategy.FULL))
    pipeline.addRowFilter((row) => row.deleted === true)
    const rows = [
      { name: 'a', secret: 'x', deleted: false },
      { name: 'b', secret: 'y', deleted: true },
    ]
    const out = pipeline.maskRows(rows)
    expect(out).toHaveLength(1)
    expect(out[0]!.name).toBe('a')
    expect(out[0]!.secret).toBe('[REDACTED]')
  })

  it('listAudits 返回审计记录', () => {
    const pipeline = new DataMaskingPipeline()
    pipeline.addRule(createMaskRule('password', MaskStrategy.FULL))
    pipeline.mask({ password: 'secret' })
    const audits = pipeline.listAudits()
    expect(audits.length).toBe(1)
    expect(audits[0]!.field).toBe('password')
    expect(audits[0]!.strategy).toBe(MaskStrategy.FULL)
    expect(audits[0]!.originalHash).toHaveLength(12)
    expect(audits[0]!.replaced).toBe('[REDACTED]')
  })

  it('stats 返回统计', () => {
    const pipeline = new DataMaskingPipeline()
    pipeline.addRule(createMaskRule('password', MaskStrategy.FULL))
    pipeline.addRule(createMaskRule('token', MaskStrategy.HASH))
    pipeline.mask({ password: 'x', name: 'alice' })
    pipeline.mask({ token: 'y' })
    const stats = pipeline.stats()
    expect(stats.ruleCount).toBe(2)
    expect(stats.totalMasked).toBe(2)
    expect(stats.totalSkipped).toBe(1)
    expect(stats.totalFiltered).toBe(0)
  })

  it('无规则时跳过脱敏', () => {
    const pipeline = new DataMaskingPipeline()
    const out = pipeline.mask({ password: 'secret' }) as Record<string, unknown>
    expect(out.password).toBe('secret')
    expect(pipeline.stats().totalSkipped).toBe(1)
  })

  it('DEFAULT_SENSITIVE_KEYS 包含 8 个默认键', () => {
    expect(DEFAULT_SENSITIVE_KEYS).toHaveLength(8)
    expect(DEFAULT_SENSITIVE_KEYS).toContain('password')
    expect(DEFAULT_SENSITIVE_KEYS).toContain('phone')
    expect(DEFAULT_SENSITIVE_KEYS).toContain('idcard')
    expect(DEFAULT_SENSITIVE_KEYS).toContain('bankcard')
    expect(DEFAULT_SENSITIVE_KEYS).toContain('email')
    expect(DEFAULT_SENSITIVE_KEYS).toContain('token')
    expect(DEFAULT_SENSITIVE_KEYS).toContain('secret')
    expect(DEFAULT_SENSITIVE_KEYS).toContain('apikey')
  })
})
