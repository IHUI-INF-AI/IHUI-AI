import { describe, it, expect } from 'vitest';
import {
  generateClientId,
  generateClientSecret,
  generateUserSk,
  generateAuthCode,
  generateState,
  isGoogleConfigured,
  isWechatMiniConfigured,
  isWecomConfigured,
  isDingtalkConfigured,
  isFeishuConfigured,
} from '../src/services/oauth-providers.js';
import {
  generateCaptchaKey,
  generateCaptchaCode,
  generateCaptchaImage,
  verifyCaptcha,
  isCaptchaEnabled,
} from '../src/services/captcha.js';

describe('oauth-providers service', () => {
  it('generateClientId 应生成 zhs_ 前缀', () => {
    const id = generateClientId();
    expect(id.startsWith('zhs_')).toBe(true);
    expect(id.length).toBeGreaterThan(10);
  });

  it('generateClientSecret 应生成 64 位 hex', () => {
    const secret = generateClientSecret();
    expect(secret.length).toBe(64);
    expect(/^[0-9a-f]+$/.test(secret)).toBe(true);
  });

  it('generateUserSk 应生成 sk- 前缀', () => {
    const sk = generateUserSk();
    expect(sk.startsWith('sk-')).toBe(true);
  });

  it('generateAuthCode 应生成 16 位 hex', () => {
    const code = generateAuthCode();
    expect(code.length).toBe(16);
    expect(/^[0-9a-f]+$/.test(code)).toBe(true);
  });

  it('generateState 应生成 32 位 hex', () => {
    const state = generateState();
    expect(state.length).toBe(32);
  });

  it('isGoogleConfigured 在无密钥时返回 false', () => {
    expect(isGoogleConfigured()).toBe(false);
  });

  it('isWechatMiniConfigured 在无密钥时返回 false', () => {
    expect(isWechatMiniConfigured()).toBe(false);
  });

  it('isWecomConfigured 在无密钥时返回 false', () => {
    expect(isWecomConfigured()).toBe(false);
  });

  it('isDingtalkConfigured 在无密钥时返回 false', () => {
    expect(isDingtalkConfigured()).toBe(false);
  });

  it('isFeishuConfigured 在无密钥时返回 false', () => {
    expect(isFeishuConfigured()).toBe(false);
  });
});

describe('captcha service', () => {
  it('generateCaptchaKey 应生成 32 位 hex', () => {
    const key = generateCaptchaKey();
    expect(key.length).toBe(32);
  });

  it('generateCaptchaCode 应生成 4 位字符', () => {
    const code = generateCaptchaCode();
    expect(code.length).toBe(4);
  });

  it('generateCaptchaImage 应返回 data URI', () => {
    const img = generateCaptchaImage('ABCD');
    expect(img.startsWith('data:image/svg+xml;base64,')).toBe(true);
  });

  it('verifyCaptcha 大小写不敏感', () => {
    expect(verifyCaptcha('abcd', 'ABCD')).toBe(true);
    expect(verifyCaptcha('XYZW', 'xyzw')).toBe(true);
    expect(verifyCaptcha('abcd', 'wxyz')).toBe(false);
  });

  it('isCaptchaEnabled 默认启用', () => {
    expect(isCaptchaEnabled()).toBe(true);
  });
});
