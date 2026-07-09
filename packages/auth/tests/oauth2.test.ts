import { describe, it, expect } from 'vitest';
import {
  generateAuthorizationCode,
  generatePkceVerifier,
  generatePkceChallenge,
  validatePkce,
} from '../src/oauth2';

describe('oauth2', () => {
  describe('generateAuthorizationCode', () => {
    it('返回非空字符串', () => {
      const code = generateAuthorizationCode('cli1', 'u1', 'openid', 'https://example.com/cb');
      expect(typeof code).toBe('string');
      expect(code.length).toBeGreaterThan(0);
    });

    it('使用 base64url 字符集', () => {
      const code = generateAuthorizationCode('cli1', 'u1', 'openid', 'https://example.com/cb');
      expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });

  describe('PKCE generatePkceVerifier', () => {
    it('默认长度处于 43-128 区间', () => {
      const v = generatePkceVerifier();
      expect(v.length).toBeGreaterThanOrEqual(43);
      expect(v.length).toBeLessThanOrEqual(128);
    });

    it('字符集合法 [A-Za-z0-9-._~]', () => {
      expect(generatePkceVerifier()).toMatch(/^[A-Za-z0-9-._~]+$/);
    });

    it('非法长度抛错', () => {
      expect(() => generatePkceVerifier(10)).toThrow();
      expect(() => generatePkceVerifier(200)).toThrow();
    });
  });

  describe('validatePkce', () => {
    it('S256: 正确配对通过', () => {
      const verifier = generatePkceVerifier();
      const challenge = generatePkceChallenge(verifier, 'S256');
      expect(validatePkce(verifier, challenge, 'S256')).toBe(true);
    });

    it('S256: 错误配对拒绝', () => {
      const verifier = generatePkceVerifier();
      const wrongChallenge = generatePkceChallenge(generatePkceVerifier(), 'S256');
      expect(validatePkce(verifier, wrongChallenge, 'S256')).toBe(false);
    });

    it('plain: 正确配对通过', () => {
      const verifier = generatePkceVerifier();
      expect(validatePkce(verifier, verifier, 'plain')).toBe(true);
    });

    it('空值拒绝', () => {
      expect(validatePkce('', 'anything', 'S256')).toBe(false);
    });
  });
});
