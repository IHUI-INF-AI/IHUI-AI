import { describe, it, expect } from 'vitest';
import {
  generateOutTradeNo,
  isWechatPayConfigured,
  decryptCallback,
  buildJsapiSign,
} from '../src/services/wechat-pay.js';

describe('wechat-pay service', () => {
  it('generateOutTradeNo 应生成带前缀的订单号', () => {
    const no = generateOutTradeNo('WX');
    expect(no.startsWith('WX')).toBe(true);
    expect(no.length).toBeGreaterThan(10);
  });

  it('generateOutTradeNo 不同前缀', () => {
    const no = generateOutTradeNo('ALI');
    expect(no.startsWith('ALI')).toBe(true);
  });

  it('isWechatPayConfigured 在无密钥时返回 false', () => {
    // 测试环境无 WX_SHOP_ID
    expect(isWechatPayConfigured()).toBe(false);
  });

  it('buildJsapiSign 返回签名结构', () => {
    // 无私钥时抛错，验证函数存在且参数校验
    expect(() => buildJsapiSign('test_prepay_id')).toThrow();
  });

  it('decryptCallback 在无 key 时抛错', () => {
    expect(() => decryptCallback('invalid', 'nonce', 'ad')).toThrow();
  });
});
