// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * DB-35 回归锁(2026-11-14):第三方凭据写库加密。
 *
 * 病灶:ai_user_model_chat_config.api_key / education_platform.api_key|api_secret /
 * im_adapters.credentials_json 里的 webhookSecret|botToken|appSecret 全部明文落库,
 * 一次 dump 即泄露可用的第三方密钥。
 *
 * 本用例只做两件事:
 *  1) 纯函数锁:encryptCredential/decryptCredential 的往返、幂等、存量透传、篡改抛错、
 *     长度上限抛错(且错误信息不含明文);
 *  2) 源码形状锁:三个生产文件的目标写入点必须调用 encryptCredential、读取点必须调用
 *     decryptCredential,且目标列不再直接写入原始变量(防止后续改动把加密摘掉)。
 * 不连真实 DB/Redis。
 */

import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

vi.mock('../src/config/index.js', () => ({
  config: {
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
  },
}))

import {
  encryptCredential,
  decryptCredential,
  encryptField,
  decryptField,
} from '../src/utils/crypto.js'

const CREDENTIAL_FORMAT =
  /^enc:v1:[A-Za-z0-9+/]+={0,2}:[A-Za-z0-9+/]+={0,2}:[A-Za-z0-9+/]+={0,2}$/

const SRC_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../src')
const readSource = (rel: string): string => readFileSync(resolve(SRC_DIR, rel), 'utf8')
const countOf = (haystack: string, needle: string): number => haystack.split(needle).length - 1

describe('DB-35 encryptCredential / decryptCredential', () => {
  it('往返:密文符合 enc:v1 三段格式且能还原明文', () => {
    const plain = 'sk-live-0123456789abcdef'
    const stored = encryptCredential(plain)
    expect(stored).toMatch(CREDENTIAL_FORMAT)
    expect(stored.startsWith('enc:v1:')).toBe(true)
    expect(decryptCredential(stored)).toBe(plain)
  })

  it('同一明文两次加密得到不同 IV(密文不相等)', () => {
    const plain = 'same-secret'
    expect(encryptCredential(plain)).not.toBe(encryptCredential(plain))
  })

  it('空串原样返回', () => {
    expect(encryptCredential('')).toBe('')
    expect(decryptCredential('')).toBe('')
  })

  it('幂等:已带 enc:v1: 前缀的值不再二次加密', () => {
    const once = encryptCredential('sk-idempotent')
    const twice = encryptCredential(once)
    expect(twice).toBe(once)
    expect(decryptCredential(twice)).toBe('sk-idempotent')
  })

  it('存量明文(非 enc:v1: 前缀)原样透传,包括含冒号的明文', () => {
    expect(decryptCredential('sk-legacy-plaintext')).toBe('sk-legacy-plaintext')
    expect(decryptCredential('legacy:with:colons')).toBe('legacy:with:colons')
  })

  it('篡改 ciphertext 必须抛错,不回落成明文', () => {
    const stored = encryptCredential('sk-tamper')
    const parts = stored.split(':')
    const ct = parts[4]
    const flipped = (ct[0] === 'A' ? 'B' : 'A') + ct.slice(1)
    const tampered = [...parts.slice(0, 4), flipped].join(':')
    expect(tampered).not.toBe(stored)
    expect(() => decryptCredential(tampered)).toThrow()
  })

  it('篡改 tag 必须抛错', () => {
    const stored = encryptCredential('sk-tag')
    const parts = stored.split(':')
    const tag = parts[3]
    const flipped = (tag[0] === 'A' ? 'B' : 'A') + tag.slice(1)
    const tampered = [...parts.slice(0, 3), flipped, parts[4]].join(':')
    expect(() => decryptCredential(tampered)).toThrow()
  })

  it('前缀匹配但字段数不对必须抛错', () => {
    expect(() => decryptCredential('enc:v1:only-two-parts')).toThrow()
  })

  it('maxStoredLength 内正常写入', () => {
    const stored = encryptCredential('k'.repeat(150), 256)
    expect(stored.length).toBeLessThanOrEqual(256)
    expect(decryptCredential(stored)).toBe('k'.repeat(150))
  })

  it('maxStoredLength 超限抛错,错误信息含上限值且不含明文/密文', () => {
    const plain = `sk-${'k'.repeat(300)}`
    let message = ''
    try {
      encryptCredential(plain, 256)
      throw new Error('应该抛错但没有抛')
    } catch (e) {
      message = (e as Error).message
    }
    expect(message).toContain('256')
    expect(message).not.toContain('sk-kkkk')
    expect(message).not.toContain('enc:v1:')
  })

  it('encryptField/decryptField 行为不变(不受本次改动影响)', () => {
    const stored = encryptField('张三')
    expect(decryptField(stored)).toBe('张三')
    expect(decryptField('存量明文')).toBe('存量明文')
    expect(stored.startsWith('enc:v1:')).toBe(false)
  })
})

describe('DB-35 源码形状锁', () => {
  it('ai-user-model-chat:插入/更新写加密,列表/响应/聊天读解密', () => {
    const src = readSource('routes/ai-user-model-chat.ts')
    expect(src).toContain('apiKey: encryptCredential(parsed.data.apiKey, 256)')
    expect(src).toContain('updateData.apiKey = encryptCredential(body.data.apiKey, 256)')
    // 列表 + POST/PUT 响应共 3 处:先解密再 mask
    expect(countOf(src, 'maskKey(decryptCredential(apiKey))')).toBe(3)
    expect(src).toContain('apiKey: decryptCredential(config.apiKey)')
    // 原始变量不得再直接写目标列 / 直接送去下游
    expect(src).not.toContain('apiKey: parsed.data.apiKey,')
    expect(src).not.toContain('updateData.apiKey = body.data.apiKey')
    expect(src).not.toContain('apiKey: config.apiKey,')
    expect(src).not.toContain('maskKey(apiKey)')
  })

  it('education-platform:插入/更新写加密,列表读解密', () => {
    const src = readSource('routes/education-platform.ts')
    expect(countOf(src, 'encryptCredential(parsed.data.apiKey, 200)')).toBe(2)
    expect(countOf(src, 'encryptCredential(parsed.data.apiSecret, 200)')).toBe(2)
    expect(src).toContain('decryptCredential(row.apiKey)')
    expect(src).toContain('decryptCredential(row.apiSecret)')
    // 原始变量不得再直接写目标列
    expect(src).not.toContain('apiKey: parsed.data.apiKey,')
    expect(src).not.toContain('apiSecret: parsed.data.apiSecret,')
    expect(src).not.toContain('apiKey: parsed.data.apiKey }')
    expect(src).not.toContain('apiSecret: parsed.data.apiSecret }')
  })

  it('v1-ai-core:用户模型 apiKey 与 ai-user-model-chat 同表,写入加密/读取解密', () => {
    const src = readSource('routes/v1-ai-core.ts')
    // 插入(apiKey 变量)与更新(parsed.data.apiKey)两处写加密
    expect(src).toContain('apiKey: encryptCredential(apiKey, 256)')
    expect(src).toContain('updates.apiKey = encryptCredential(parsed.data.apiKey, 256)')
    // 列表 + 创建响应 + 更新响应共 3 处:先解密再 mask
    expect(countOf(src, 'maskKey(decryptCredential(')).toBe(3)
    // 原始变量不得再直接写目标列 / 直接 mask 落库值
    expect(src).not.toContain('apiKey: maskKey(r.apiKey)')
    expect(src).not.toContain('apiKey: maskKey(row!.apiKey)')
    expect(src).not.toContain('updates.apiKey = parsed.data.apiKey')
  })

  it('im-gateway:三个秘密字段写加密、读解密;appId/callbackUrl 保持明文', () => {
    const src = readSource('routes/im-gateway.ts')
    expect(src).toContain('encryptCredential(config.webhookSecret)')
    expect(src).toContain('encryptCredential(config.botToken)')
    expect(src).toContain('encryptCredential(config.appSecret)')
    expect(src).toContain('decryptCredential(cred.botToken)')
    expect(src).toContain('decryptCredential(cred.appSecret)')
    // dbRowToAdapter 与 webhook 验签候选两处都要解密 webhookSecret
    expect(countOf(src, 'decryptCredential(cred.webhookSecret)')).toBe(2)
    // 原始变量不得再直接写入 credentialsJson
    expect(src).not.toContain('credentialsJson.webhookSecret = config.webhookSecret')
    expect(src).not.toContain('credentialsJson.botToken = config.botToken')
    expect(src).not.toContain('credentialsJson.appSecret = config.appSecret')
    // 非秘密字段保持明文
    expect(src).toContain('credentialsJson.appId = config.appId')
    expect(src).toContain('credentialsJson.callbackUrl = config.callbackUrl')
    expect(src).not.toContain('decryptCredential(cred.appId)')
    expect(src).not.toContain('decryptCredential(cred.callbackUrl)')
  })
})
