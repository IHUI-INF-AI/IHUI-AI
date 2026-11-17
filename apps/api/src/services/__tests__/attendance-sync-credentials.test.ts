// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 考勤同步器 · IM 适配器凭证读取钉子(2026-11-17 立)。
 *
 * 钉住一个真实断点:IM 网关 upsert 时 `appSecret` 走 `encryptCredential()` 存成
 * `enc:v1:…`,而同步器若直接把它当密钥调第三方,会遇到"库里看着有凭证、调用恒失败"。
 * 契约:
 *   · 明文存量 → 原样直通(不破坏历史数据);
 *   · 密文 → 解密后返回;
 *   · 密文格式非法/密钥不匹配 → 抛 SYNC_CREDENTIALS_INVALID,**绝不回落明文**;
 *   · 未配置/未启用/缺字段 → 各自的显式错误码。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../config/index.js', () => ({
  config: { CREDENTIALS_ENCRYPTION_KEY: 'test-key-0123456789abcdef0123456789' },
}))

const state = vi.hoisted(() => ({ rows: [] as unknown[] }))

vi.mock('../../db/index.js', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => state.rows }),
      }),
    }),
  },
}))

import { encryptCredential } from '../../utils/crypto.js'
import { loadPlatformCredentials } from '../attendance-sync/im-adapter-credentials.js'

function adapterRow(credentialsJson: Record<string, unknown>, enabled = true) {
  return { platform: 'dingtalk', enabled, credentialsJson }
}

beforeEach(() => {
  state.rows = []
})

describe('loadPlatformCredentials:未配置/未启用', () => {
  it('没有适配器行 → SYNC_ADAPTER_NOT_ENABLED', async () => {
    await expect(loadPlatformCredentials('u-1', 'dingtalk')).rejects.toThrow(
      /未配置或未启用/,
    )
  })

  it('有行但 enabled=false → SYNC_ADAPTER_NOT_ENABLED', async () => {
    state.rows = [adapterRow({ appId: 'a', appSecret: 's' }, false)]
    await expect(loadPlatformCredentials('u-1', 'dingtalk')).rejects.toThrow(
      /未配置或未启用/,
    )
  })
})

describe('loadPlatformCredentials:字段完整性', () => {
  it('只有 appId 没有 appSecret → SYNC_CREDENTIALS_INCOMPLETE(不带着半截凭证去调接口)', async () => {
    state.rows = [adapterRow({ appId: 'ding-app' })]
    await expect(loadPlatformCredentials('u-1', 'dingtalk')).rejects.toThrow(
      /缺少 appId\/appSecret/,
    )
  })
})

describe('loadPlatformCredentials:加密兼容', () => {
  it('明文存量原样返回(历史数据不被破坏)', async () => {
    state.rows = [adapterRow({ appId: 'ding-app', appSecret: 'plain-secret' })]
    await expect(loadPlatformCredentials('u-1', 'dingtalk')).resolves.toEqual({
      appId: 'ding-app',
      appSecret: 'plain-secret',
      agentId: undefined,
    })
  })

  it('enc:v1: 密文被解密成明文(网关写入形态可直接被同步器消费)', async () => {
    const stored = encryptCredential('real-secret-value')
    expect(stored.startsWith('enc:v1:')).toBe(true)
    state.rows = [adapterRow({ appId: 'ding-app', appSecret: stored, agentId: encryptCredential('4012') })]
    await expect(loadPlatformCredentials('u-1', 'dingtalk')).resolves.toEqual({
      appId: 'ding-app',
      appSecret: 'real-secret-value',
      agentId: '4012',
    })
  })

  it('密文格式非法 → SYNC_CREDENTIALS_INVALID,绝不回落成明文', async () => {
    state.rows = [adapterRow({ appId: 'ding-app', appSecret: 'enc:v1:broken' })]
    await expect(loadPlatformCredentials('u-1', 'dingtalk')).rejects.toThrow(/无法解密/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
