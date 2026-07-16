import { describe, expect, it } from 'vitest'
import { redactSecrets, redactObject } from '../src/redact.js'

describe('redactSecrets', () => {
  it('脱敏 OpenAI/sk- 前缀 key,保留前 11 字符(sk- + 8)', () => {
    // 不用 api_key= 前缀,避免与 api_key 模式冲突
    // 用 <your-xxx-api-key> 风格的占位串,避免被 check:api-key-leak 误判为真实 key
    const text = 'token: sk-projAAAAAAAAAAAAAAAAAAAA-BBBBCCCCDDDDEEEEFFFFGGGGHHHH'
    const result = redactSecrets(text)
    expect(result).toContain('sk-projAAA') // sk- + 8 chars
    expect(result).toContain('***REDACTED***')
    expect(result).not.toContain('BBBBCCCCDDDDEEEEFFFFGGGGHHHH')
  })

  it('脱敏 Bearer token', () => {
    const text = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature'
    const result = redactSecrets(text)
    expect(result).toContain('Bearer eyJh')
    expect(result).toContain('***REDACTED***')
    expect(result).not.toContain('payload.signature')
  })

  it('脱敏 password= 形式', () => {
    const text = 'config: password=SuperSecret123'
    const result = redactSecrets(text)
    expect(result).toContain('password=Su')
    expect(result).toContain('***REDACTED***')
    expect(result).not.toContain('SuperSecret123')
  })

  it('脱敏 AWS access key', () => {
    const text = 'aws_access_key_id=AKIAIOSFODNN7EXAMPLE'
    const result = redactSecrets(text)
    expect(result).toContain('AKIA')
    expect(result).toContain('***REDACTED***')
    expect(result).not.toContain('IOSFODNN7EXAMPLE')
  })

  it('脱敏 Basic Auth', () => {
    const text = 'Authorization: Basic dXNlcjpwYXNz'
    const result = redactSecrets(text)
    expect(result).toContain('Basic ***REDACTED***')
  })

  it('不做修改非敏感字符串', () => {
    const text = 'normal text without secrets'
    expect(redactSecrets(text)).toBe(text)
  })

  it('空字符串安全', () => {
    expect(redactSecrets('')).toBe('')
  })
})

describe('redactObject', () => {
  it('递归脱敏对象中所有 string 字段', () => {
    const obj = {
      name: 'test',
      token: 'sk-1234567890abcdefghijklmnop',
      nested: { key: 'sk-abcdefghijklmnopqrstuvwxyz', value: 42 },
    }
    const result = redactObject(obj)
    expect(result.name).toBe('test')
    expect(result.token).toContain('***REDACTED***')
    expect((result.nested as { key: string }).key).toContain('***REDACTED***')
    expect((result.nested as { value: number }).value).toBe(42)
  })

  it('数组非 object 不递归', () => {
    const obj = { tags: ['a', 'b'], secret: 'sk-abcdefghijklmnopqrstuv' }
    const result = redactObject(obj)
    expect(result.tags).toEqual(['a', 'b'])
  })
})
