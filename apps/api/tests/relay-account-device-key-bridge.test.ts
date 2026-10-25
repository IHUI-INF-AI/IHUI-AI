// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 设备密钥过桥链路镜像测试(2026-10-26 立)。
 *
 * 立因:Trae 桌面渠道签发的票只能由签发它的设备身份续(ExchangeToken 带 DeviceProof)。
 * 号池 → 签到侧 → 个人池回灌这条链原本只搬 deviceId/machineId,不搬密钥对
 * ⇒ 生产池里的 Trae 号永远刷不动。本测试锁"两把 PEM 全程不丢"。
 *
 * 判据一律 import 源实现(§22c),不在测试里复制映射。
 */
import { describe, it, expect } from 'vitest'
import { __test__ as userPoolRoute } from '../src/routes/internal-relay-user-pool.js'
import {
  buildPoolSyncAccount,
  parseSecretsEnc,
  pemFromSecrets,
} from '../src/services/relay-account-pool-checkin-sync.js'

describe('设备密钥过桥(号池 ↔ 签到侧)', () => {
  it('deviceKeysToImportKeys:两把 PEM 齐才产出,缺一把即不产出半成品', () => {
    expect(
      userPoolRoute.deviceKeysToImportKeys({
        pool_device_key_pem: 'PRIV',
        pool_device_pub_pem: 'PUB',
      }),
    ).toEqual({ deviceKeyPem: 'PRIV', devicePubPem: 'PUB' })
    expect(userPoolRoute.deviceKeysToImportKeys({ pool_device_key_pem: 'PRIV' })).toEqual({
      deviceKeyPem: 'PRIV',
    })
    expect(userPoolRoute.deviceKeysToImportKeys({})).toEqual({})
    // 非字符串/空串一律不认
    expect(
      userPoolRoute.deviceKeysToImportKeys({ pool_device_key_pem: 123, pool_device_pub_pem: '' }),
    ).toEqual({})
  })

  it('buildPoolSyncAccount:给了密钥就带出去,没给则不写键(旧行为不变)', () => {
    const base = {
      id: 'a1',
      ownerUserId: null,
      uid: 'u1',
      name: 'n',
      token: 't',
      refreshToken: 'r',
      credVersion: 1,
      enabled: true,
      proxyUrl: null,
      deviceId: 'dev-1',
      machineId: 'mac-1',
      cosy: null,
      tokenExpiresAt: null,
    }
    const without = buildPoolSyncAccount(base)
    expect('deviceKeyPem' in without).toBe(false)
    expect('devicePubPem' in without).toBe(false)

    const withKeys = buildPoolSyncAccount({
      ...base,
      deviceKeyPem: 'PRIV',
      devicePubPem: 'PUB',
    })
    expect(withKeys.deviceKeyPem).toBe('PRIV')
    expect(withKeys.devicePubPem).toBe('PUB')

    // 空串按"没有"处理,不把空值推过去
    const empty = buildPoolSyncAccount({ ...base, deviceKeyPem: '', devicePubPem: null })
    expect('deviceKeyPem' in empty).toBe(false)
  })

  it('pemFromSecrets:只认非空字符串;parseSecretsEnc 解不开 → null(不抛)', () => {
    expect(pemFromSecrets({ deviceKeyPem: ' P ' }, 'deviceKeyPem')).toBe(' P ')
    expect(pemFromSecrets({ deviceKeyPem: '   ' }, 'deviceKeyPem')).toBeNull()
    expect(pemFromSecrets(null, 'devicePubPem')).toBeNull()
    expect(parseSecretsEnc(null)).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
