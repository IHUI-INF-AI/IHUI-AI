import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  getJwtSecret,
  type JWTPayload,
} from '../src/jwt';

const TEST_SECRET = 'test-jwt-secret-at-least-32-characters-long!!!';
const originalSecret = process.env.JWT_SECRET;

const basePayload: JWTPayload = {
  userId: 'user-uuid-1',
  phone: '13800000000',
  familyId: '11111111-1111-1111-1111-111111111111',
  roleId: 0,
};

describe('jwt', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = TEST_SECRET;
  });

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  });

  describe('signAccessToken / verifyAccessToken', () => {
    it('签发后能正确验证并还原 payload', async () => {
      const token = await signAccessToken(basePayload);
      const decoded = await verifyAccessToken(token);
      expect(decoded.userId).toBe(basePayload.userId);
      expect(decoded.phone).toBe(basePayload.phone);
      expect(decoded.familyId).toBe(basePayload.familyId);
      expect(decoded.roleId).toBe(basePayload.roleId);
    });
  });

  describe('signRefreshToken / verifyRefreshToken', () => {
    it('签发后能正确验证并还原 payload', async () => {
      const token = await signRefreshToken(basePayload);
      const decoded = await verifyRefreshToken(token);
      expect(decoded.userId).toBe(basePayload.userId);
      expect(decoded.familyId).toBe(basePayload.familyId);
      expect(decoded.roleId).toBe(basePayload.roleId);
    });
  });

  describe('token 类型隔离', () => {
    it('verifyAccessToken 拒绝 refresh token', async () => {
      const refresh = await signRefreshToken(basePayload);
      await expect(verifyAccessToken(refresh)).rejects.toThrow();
    });

    it('verifyRefreshToken 拒绝 access token', async () => {
      const access = await signAccessToken(basePayload);
      await expect(verifyRefreshToken(access)).rejects.toThrow();
    });
  });

  describe('getJwtSecret', () => {
    it('有 JWT_SECRET 时返回 Uint8Array', () => {
      const secret = getJwtSecret();
      expect(secret).toBeInstanceOf(Uint8Array);
      expect(secret.length).toBeGreaterThan(0);
    });

    it('无 JWT_SECRET 时抛错', () => {
      const saved = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;
      expect(() => getJwtSecret()).toThrow();
      process.env.JWT_SECRET = saved;
    });
  });
});
