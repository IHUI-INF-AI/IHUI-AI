// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-317-② 充值地址形态校验双网络分流。
 *
 * TRC20(Tron Base58)与 ERC20(0x + 40 hex)形态规则完全不同,各走各的正则;
 * 本测试钉住「一条正则不误拒另一条」与「未知网络放行」三条边界。
 */
import { describe, it, expect } from 'vitest'
import { assertUsdtAddressFormat, isTronAddress, isErc20Address } from '../payment-usdt-service.js'

const VALID_TRON = 'TMtTpPEMduWurHLi6Fe8XjfcP5Y5AMMnbG'
const VALID_ERC20_LOWER = '0x26e359a5c69cf903d8709a286f5fd2d7554579dd'
const VALID_ERC20_UPPER = '0x26E359A5C69CF903D8709A286F5FD2D7554579DD'

describe('isErc20Address', () => {
  it('接受小写/大写/混排的 0x+40hex', () => {
    expect(isErc20Address(VALID_ERC20_LOWER)).toBe(true)
    expect(isErc20Address(VALID_ERC20_UPPER)).toBe(true)
    expect(isErc20Address('0x' + 'a'.repeat(40))).toBe(true)
  })

  it('拒绝无前缀/截断/非hex/混入TRC20地址', () => {
    expect(isErc20Address('26e359a5c69cf903d8709a286f5fd2d7554579dd')).toBe(false)
    expect(isErc20Address('0x' + 'a'.repeat(39))).toBe(false)
    expect(isErc20Address('0x' + 'g'.repeat(40))).toBe(false)
    expect(isErc20Address(VALID_TRON)).toBe(false)
  })
})

describe('assertUsdtAddressFormat 双网络分流', () => {
  it('TRC20 合法地址放行、非法抛 400', () => {
    expect(() => assertUsdtAddressFormat('TRC20', VALID_TRON)).not.toThrow()
    const bad = (() => {
      try {
        assertUsdtAddressFormat('TRC20', VALID_ERC20_LOWER)
      } catch (e) {
        return e as { statusCode?: number; message: string }
      }
      return null
    })()
    expect(bad?.statusCode).toBe(400)
    expect(bad?.message).toContain('TRC20')
  })

  it('ERC20 合法地址放行、非法抛 400(旧实现误放)', () => {
    expect(() => assertUsdtAddressFormat('ERC20', VALID_ERC20_LOWER)).not.toThrow()
    const bad = (() => {
      try {
        assertUsdtAddressFormat('ERC20', '0x' + 'a'.repeat(39))
      } catch (e) {
        return e as { statusCode?: number; message: string }
      }
      return null
    })()
    expect(bad?.statusCode).toBe(400)
    expect(bad?.message).toContain('ERC20')
  })

  it('大小写网络标识归一化:erc20 / trc20 同样分流', () => {
    expect(() => assertUsdtAddressFormat('erc20', VALID_ERC20_UPPER)).not.toThrow()
    expect(() => assertUsdtAddressFormat('trc20', VALID_TRON)).not.toThrow()
  })

  it('未知网络显式放行,不抛错', () => {
    expect(() => assertUsdtAddressFormat('BEP20', 'whatever')).not.toThrow()
    expect(() => assertUsdtAddressFormat('', VALID_TRON)).not.toThrow()
  })

  it('TRC20 判定函数只认 Base58,不把 ERC20 误判为真', () => {
    expect(isTronAddress(VALID_TRON)).toBe(true)
    expect(isTronAddress(VALID_ERC20_LOWER)).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
