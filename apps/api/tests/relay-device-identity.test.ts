// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 稳定设备身份派生的行为锁(2026-11-18 立)。
 *
 * 要钉住的不是覆盖率,而是四件「一破就成事故」的事:
 *   L1 稳定性  同 (uid, salt, realm) 恒等 —— 漂一次全池掉线。
 *   L2 隔离性  不同 uid 必不同 —— 撞一次就是跨账号关联。
 *   L3 域分离  三枚标识彼此不同,且任一枚变不了另一枚。
 *   L4 不降级  盐缺失/过短/uid 空 ⇒ 拒绝派生并点名原因,绝不退化成弱标识。
 */
import { describe, it, expect } from 'vitest'
import {
  deriveDeviceIdentity,
  isDeviceIdentityDerivable,
  DEVICE_IDENTITY_PURPOSES,
  MIN_DEVICE_SALT_CHARS,
  __test__,
} from '../src/services/relay-device-identity.js'

const SALT = 'relay-device-salt-0123456789abcdef'

describe('relay-device-identity', () => {
  it('L1 稳定性:同 (uid, salt, realm) 多次派生恒等', () => {
    const a = deriveDeviceIdentity({ uid: 'u-10086', salt: SALT, realm: 'cn' })
    const b = deriveDeviceIdentity({ uid: 'u-10086', salt: SALT, realm: 'cn' })
    expect(a.ok && b.ok).toBe(true)
    if (!a.ok || !b.ok) return
    expect(a).toEqual(b)
  })

  it('L2 隔离性:不同 uid 的机器码必不相同', () => {
    const a = deriveDeviceIdentity({ uid: 'u-10086', salt: SALT })
    const b = deriveDeviceIdentity({ uid: 'u-10087', salt: SALT })
    if (!a.ok || !b.ok) throw new Error('前置失败')
    expect(a.machineId).not.toBe(b.machineId)
    expect(a.machineToken).not.toBe(b.machineToken)
    expect(a.sessionId).not.toBe(b.sessionId)
  })

  it('L2b 盐不同 ⇒ 同 uid 也不同(盐是隔离维度)', () => {
    const a = deriveDeviceIdentity({ uid: 'u-1', salt: SALT })
    const b = deriveDeviceIdentity({ uid: 'u-1', salt: SALT + 'x' })
    if (!a.ok || !b.ok) throw new Error('前置失败')
    expect(a.machineId).not.toBe(b.machineId)
  })

  it('L2c 区参与派生:同 uid 跨区得到不同标识', () => {
    const cn = deriveDeviceIdentity({ uid: 'u-1', salt: SALT, realm: 'cn' })
    const global = deriveDeviceIdentity({ uid: 'u-1', salt: SALT, realm: 'global' })
    if (!cn.ok || !global.ok) throw new Error('前置失败')
    expect(cn.machineId).not.toBe(global.machineId)
  })

  it('L3 域分离:三枚标识彼此不同', () => {
    const r = deriveDeviceIdentity({ uid: 'u-1', salt: SALT })
    if (!r.ok) throw new Error('前置失败')
    const set = new Set([r.machineId, r.machineToken, r.sessionId])
    expect(set.size).toBe(3)
  })

  it('L3b 长度按 purpose 表:32/48/32,全 hex', () => {
    const r = deriveDeviceIdentity({ uid: 'u-1', salt: SALT })
    if (!r.ok) throw new Error('前置失败')
    expect(r.machineId).toMatch(/^[0-9a-f]{32}$/)
    expect(r.machineToken).toMatch(/^[0-9a-f]{48}$/)
    expect(r.sessionId).toMatch(/^[0-9a-f]{32}$/)
    expect(__test__.PURPOSE_HEX_LEN.machineid).toBe(32)
    expect(__test__.PURPOSE_HEX_LEN.machinetoken).toBe(48)
  })

  it('L4 不降级:盐缺失 ⇒ ok:false 且 code=missing-salt', () => {
    const r = deriveDeviceIdentity({ uid: 'u-1', salt: '' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.code).toBe('missing-salt')
    expect(r.reason).toContain('RELAY_DEVICE_SALT')
  })

  it('L4b 不降级:盐过短 ⇒ ok:false 且 code=weak-salt,并点名实际长度', () => {
    const short = 'abc'
    const r = deriveDeviceIdentity({ uid: 'u-1', salt: short })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.code).toBe('weak-salt')
    expect(r.reason).toContain(String(short.length))
    expect(short.length).toBeLessThan(MIN_DEVICE_SALT_CHARS)
  })

  it('L4c 不降级:uid 空/纯空白 ⇒ ok:false 且 code=missing-uid', () => {
    for (const uid of ['', '   ']) {
      const r = deriveDeviceIdentity({ uid, salt: SALT })
      expect(r.ok).toBe(false)
      if (r.ok) continue
      expect(r.code).toBe('missing-uid')
    }
  })

  it('L4d isDeviceIdentityDerivable 与 deriveDeviceIdentity 同判据(不另抄一份)', () => {
    expect(isDeviceIdentityDerivable({ uid: 'u-1', salt: SALT })).toBe(true)
    expect(isDeviceIdentityDerivable({ uid: '', salt: SALT })).toBe(false)
    expect(isDeviceIdentityDerivable({ uid: 'u-1', salt: 'x' })).toBe(false)
  })

  it('不可反推:输出里不出现 uid / 盐 明文', () => {
    const uid = 'account-uid-plain-1234567890'
    const r = deriveDeviceIdentity({ uid, salt: SALT })
    if (!r.ok) throw new Error('前置失败')
    for (const v of [r.machineId, r.machineToken, r.sessionId]) {
      expect(v).not.toContain(uid)
      expect(v).not.toContain(SALT)
    }
  })

  it('拼串无歧义:NUL 分隔符让「冒号注入」构不成碰撞', () => {
    // 若用 ':' 拼串,这两组输入可能撞同一串;NUL 分隔下必不相同。
    const a = deriveDeviceIdentity({ uid: 'acct:x', salt: SALT })
    const b = deriveDeviceIdentity({ uid: 'acct', salt: 'x' + SALT })
    if (!a.ok || !b.ok) throw new Error('前置失败')
    expect(a.machineId).not.toBe(b.machineId)
  })

  it('purpose 表是最终清单:三枚,且拼串里各用各的前缀', () => {
    expect([...DEVICE_IDENTITY_PURPOSES]).toEqual(['machineid', 'machinetoken', 'sessionid'])
    const input = { uid: 'u-1', salt: SALT }
    const ids = DEVICE_IDENTITY_PURPOSES.map((p) => __test__.deriveOne(p, input))
    expect(new Set(ids).size).toBe(3)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
