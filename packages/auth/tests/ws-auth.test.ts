import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { generateWsToken, verifyWsToken } from '../src/ws-auth';
import { signAccessToken, type JWTPayload } from '../src/jwt';

const TEST_SECRET = 'test-jwt-secret-at-least-32-characters-long!!!';
const originalSecret = process.env.JWT_SECRET;

const basePayload: JWTPayload = {
  userId: 'user-uuid-1',
  phone: '13800000000',
  familyId: '11111111-1111-1111-1111-111111111111',
  roleId: 0,
};

describe('ws-auth', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = TEST_SECRET;
  });

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  });

  describe('generateWsToken', () => {
    it('返回非空字符串', async () => {
      const token = await generateWsToken('user-uuid-1');
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });
  });

  describe('verifyWsToken', () => {
    it('正确验证有效 ws token 并还原 userId', async () => {
      const token = await generateWsToken('user-uuid-1', { roleId: 1 });
      const result = await verifyWsToken(token);
      expect(result).not.toBeNull();
      expect(result?.userId).toBe('user-uuid-1');
    });

    it('拒绝过期 token', async () => {
      // 直接构造一个已过期的 ws token
      const { SignJWT } = await import('jose');
      const { getJwtSecret } = await import('../src/jwt');
      const expiredToken = await new SignJWT({ type: 'ws' })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject('user-uuid-1')
        .setIssuer('ihui-ai')
        .setIssuedAt()
        .setExpirationTime('0s')
        .sign(getJwtSecret());

      const result = await verifyWsToken(expiredToken);
      expect(result).toBeNull();
    });

    it('拒绝非 ws 类型 token（access token）', async () => {
      const access = await signAccessToken(basePayload);
      const result = await verifyWsToken(access);
      expect(result).toBeNull();
    });
  });
});
