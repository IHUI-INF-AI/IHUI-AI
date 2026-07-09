import { describe, it, expect, afterAll, beforeAll, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';

// =============================================================================
// Mock config 避免 env 校验触发 process.exit(1)
// =============================================================================
vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8080,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:3000',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8000',
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
  },
}));

// =============================================================================
// Mock @ihui/auth：跳过真实 JWT 验证，返回固定 payload（roleId=1 为管理员，
// 以便 GET /api/admin/coupons 通过权限校验）
// =============================================================================
vi.mock('@ihui/auth', () => ({
  signAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
  signRefreshToken: vi.fn().mockResolvedValue('mock-refresh-token'),
  verifyAccessToken: vi.fn().mockResolvedValue({
    userId: '00000000-0000-0000-0000-000000000001',
    phone: '13800000001',
    familyId: '00000000-0000-0000-0000-000000000002',
    roleId: 1,
  }),
  verifyRefreshToken: vi.fn().mockResolvedValue({
    userId: '00000000-0000-0000-0000-000000000001',
    phone: '13800000001',
    familyId: '00000000-0000-0000-0000-000000000002',
    roleId: 1,
  }),
  createFamilyId: vi.fn().mockReturnValue('00000000-0000-0000-0000-000000000002'),
}));

// =============================================================================
// Mock db/gamification-queries.js（签到相关查询）
// =============================================================================
vi.mock('../src/db/gamification-queries.js', () => ({
  ensureUserPoints: vi.fn(),
  findPointTransactions: vi.fn(),
  findLeaderboard: vi.fn(),
  findTodaySignIn: vi.fn(),
  findSignInRecord: vi.fn().mockResolvedValue(undefined),
  findSignInHistory: vi.fn(),
  findRecentSignInRecords: vi.fn().mockResolvedValue([]),
  calculateConsecutiveDays: vi.fn(),
  createSignInRecord: vi.fn(),
  findLevels: vi.fn(),
  findCurrentLevel: vi.fn(),
  todayString: vi.fn().mockReturnValue('2026-07-08'),
  shiftDate: vi.fn((dateStr: string, deltaDays: number) => {
    const d = new Date(dateStr + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + deltaDays);
    return d.toISOString().slice(0, 10);
  }),
  // points-service 内部依赖（不会被直接调用，但 mock 以防链式导入）
  findUserPoints: vi.fn(),
  adjustPoints: vi.fn(),
  findLevelByExperience: vi.fn(),
  setUserLevel: vi.fn(),
}));

// =============================================================================
// Mock db/promotion-queries.js（优惠券相关查询）
// =============================================================================
vi.mock('../src/db/promotion-queries.js', () => ({
  createInvitationCode: vi.fn(),
  findInvitationCodesByUser: vi.fn(),
  findInvitationByCode: vi.fn(),
  findInviteesByUser: vi.fn(),
  findActivities: vi.fn().mockResolvedValue([]),
  findActivityBySlug: vi.fn(),
  findActivityById: vi.fn(),
  joinActivity: vi.fn(),
  leaveActivity: vi.fn(),
  findActivityParticipants: vi.fn(),
  createActivity: vi.fn(),
  updateActivity: vi.fn(),
  deleteActivity: vi.fn(),
  createCoupon: vi.fn(),
  findCoupons: vi.fn(),
  verifyCoupon: vi.fn(),
}));

// =============================================================================
// Mock services/points-service.js（签到奖励发放）
// =============================================================================
vi.mock('../src/services/points-service.js', () => ({
  earnPoints: vi.fn(),
  spendPoints: vi.fn(),
}));

// =============================================================================
// 导入被测路由与 mock 函数
// =============================================================================
import { gamificationRoutes } from '../src/routes/gamification';
import { promotionRoutes, adminPromotionRoutes } from '../src/routes/promotions';
import {
  findTodaySignIn,
  findSignInHistory,
  calculateConsecutiveDays,
  createSignInRecord,
} from '../src/db/gamification-queries';
import { findCoupons, verifyCoupon } from '../src/db/promotion-queries';
import { earnPoints } from '../src/services/points-service';

// =============================================================================
// 常量与测试数据
// =============================================================================
const SAMPLE_UUID = '00000000-0000-0000-0000-000000000001';
const AUTH_HEADERS = { authorization: 'Bearer mock-access-token' };
const TODAY = '2026-07-08';

const mockSignInRecord = {
  id: SAMPLE_UUID,
  userId: SAMPLE_UUID,
  signInDate: TODAY,
  consecutiveDays: 1,
  rewardPoints: 10,
  createdAt: new Date(),
};

const mockPointsResult = {
  points: {
    id: SAMPLE_UUID,
    userId: SAMPLE_UUID,
    points: 10,
    totalEarned: 10,
    totalSpent: 0,
    level: 1,
    experience: 10,
    updatedAt: new Date(),
  },
  transaction: {
    id: SAMPLE_UUID,
    userId: SAMPLE_UUID,
    type: 'earn' as const,
    source: 'signin',
    amount: 10,
    balanceAfter: 10,
    description: '每日签到奖励',
    referenceId: SAMPLE_UUID,
    createdAt: new Date(),
  },
};

const mockCoupon = {
  id: SAMPLE_UUID,
  code: 'SAVE10',
  name: '满10减10',
  type: 'fixed' as const,
  value: 10,
  minAmount: 0,
  maxUses: 100,
  usedCount: 0,
  startsAt: new Date('2026-01-01'),
  endsAt: new Date('2026-12-31'),
  isActive: true,
  createdAt: new Date(),
};

// =============================================================================
// 测试套件
// =============================================================================
describe('business logic', () => {
  const server = Fastify({ logger: false });

  beforeAll(async () => {
    server.register(gamificationRoutes, { prefix: '/api' });
    server.register(promotionRoutes, { prefix: '/api' });
    server.register(adminPromotionRoutes, { prefix: '/api/admin' });
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // 签到奖励
  // ===========================================================================
  describe('sign-in rewards', () => {
    it('POST /api/sign-in 成功签到返回 201 与积分', async () => {
      vi.mocked(findTodaySignIn).mockResolvedValue(undefined);
      vi.mocked(calculateConsecutiveDays).mockResolvedValue(1);
      vi.mocked(createSignInRecord).mockResolvedValue(mockSignInRecord);
      vi.mocked(earnPoints).mockResolvedValue(mockPointsResult);

      const res = await server.inject({
        method: 'POST',
        url: '/api/sign-in',
        headers: AUTH_HEADERS,
      });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.code).toBe(0);
      expect(body.data.record.signInDate).toBe(TODAY);
      expect(body.data.record.rewardPoints).toBe(10);
      expect(body.data.points.points).toBe(10);
      // earnPoints 应以 signin 来源、签到记录 id 调用
      expect(vi.mocked(earnPoints)).toHaveBeenCalledWith(
        SAMPLE_UUID,
        10,
        'signin',
        '每日签到奖励',
        SAMPLE_UUID,
      );
    });

    it('POST /api/sign-in 当天重复签到返回 409', async () => {
      vi.mocked(findTodaySignIn).mockResolvedValue(mockSignInRecord);

      const res = await server.inject({
        method: 'POST',
        url: '/api/sign-in',
        headers: AUTH_HEADERS,
      });
      expect(res.statusCode).toBe(409);
      const body = res.json();
      expect(body.code).toBe(409);
      expect(body.message).toContain('已签到');
      // 重复签到不应发放奖励
      expect(vi.mocked(earnPoints)).not.toHaveBeenCalled();
    });

    it('GET /api/sign-in/today 获取签到状态返回 200', async () => {
      vi.mocked(findTodaySignIn).mockResolvedValue(undefined);

      const res = await server.inject({
        method: 'GET',
        url: '/api/sign-in/today',
        headers: AUTH_HEADERS,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.code).toBe(0);
      expect(body.data.signedIn).toBe(false);
      expect(body.data.record).toBeFalsy();
    });

    it('GET /api/sign-in/today 已签到时返回 signedIn=true 与记录', async () => {
      vi.mocked(findTodaySignIn).mockResolvedValue(mockSignInRecord);

      const res = await server.inject({
        method: 'GET',
        url: '/api/sign-in/today',
        headers: AUTH_HEADERS,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.code).toBe(0);
      expect(body.data.signedIn).toBe(true);
      expect(body.data.record.signInDate).toBe(TODAY);
    });

    it('GET /api/sign-in/history 获取签到日历返回 200', async () => {
      vi.mocked(findSignInHistory).mockResolvedValue({
        list: [mockSignInRecord],
        total: 1,
      });

      const res = await server.inject({
        method: 'GET',
        url: '/api/sign-in/history',
        headers: AUTH_HEADERS,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.code).toBe(0);
      expect(body.data.list).toHaveLength(1);
      expect(body.data.list[0].signInDate).toBe(TODAY);
      expect(body.data.total).toBe(1);
    });
  });

  // ===========================================================================
  // 优惠券核销
  // ===========================================================================
  describe('coupon verification', () => {
    it('GET /api/admin/coupons 获取优惠券列表返回 200', async () => {
      vi.mocked(findCoupons).mockResolvedValue({ list: [mockCoupon], total: 1 });

      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/coupons',
        headers: AUTH_HEADERS,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.code).toBe(0);
      expect(body.data.list).toHaveLength(1);
      expect(body.data.list[0].code).toBe('SAVE10');
      expect(body.data.total).toBe(1);
    });

    it('POST /api/coupons/verify 验证有效优惠券返回 200 与 discountAmount', async () => {
      vi.mocked(verifyCoupon).mockResolvedValue({
        valid: true,
        coupon: mockCoupon,
        discountAmount: 10,
      });

      const res = await server.inject({
        method: 'POST',
        url: '/api/coupons/verify',
        headers: AUTH_HEADERS,
        body: { code: 'SAVE10', amount: 100 },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.code).toBe(0);
      expect(body.data.valid).toBe(true);
      expect(body.data.discountAmount).toBe(10);
      expect(body.data.finalAmount).toBe(90);
    });

    it('POST /api/coupons/verify 验证不存在的优惠券返回 valid=false', async () => {
      vi.mocked(verifyCoupon).mockResolvedValue({
        valid: false,
        reason: '优惠券不存在',
        discountAmount: 0,
      });

      const res = await server.inject({
        method: 'POST',
        url: '/api/coupons/verify',
        headers: AUTH_HEADERS,
        body: { code: 'NOTEXIST', amount: 100 },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.code).toBe(0);
      expect(body.data.valid).toBe(false);
      expect(body.data.discountAmount).toBe(0);
      expect(body.data.reason).toContain('不存在');
    });

    it('POST /api/coupons/verify 验证过期优惠券返回 valid=false', async () => {
      vi.mocked(verifyCoupon).mockResolvedValue({
        valid: false,
        reason: '优惠券已过期',
        coupon: mockCoupon,
        discountAmount: 0,
      });

      const res = await server.inject({
        method: 'POST',
        url: '/api/coupons/verify',
        headers: AUTH_HEADERS,
        body: { code: 'SAVE10', amount: 100 },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.code).toBe(0);
      expect(body.data.valid).toBe(false);
      expect(body.data.reason).toContain('过期');
    });

    it('POST /api/coupons/verify 验证已用完优惠券返回 valid=false', async () => {
      vi.mocked(verifyCoupon).mockResolvedValue({
        valid: false,
        reason: '优惠券已被领完',
        coupon: mockCoupon,
        discountAmount: 0,
      });

      const res = await server.inject({
        method: 'POST',
        url: '/api/coupons/verify',
        headers: AUTH_HEADERS,
        body: { code: 'SAVE10', amount: 100 },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.code).toBe(0);
      expect(body.data.valid).toBe(false);
      expect(body.data.reason).toContain('领完');
    });

    it('POST /api/coupons/verify 参数错误返回 400', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/coupons/verify',
        headers: AUTH_HEADERS,
        body: { code: '', amount: 100 },
      });
      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.code).toBe(400);
    });
  });
});
