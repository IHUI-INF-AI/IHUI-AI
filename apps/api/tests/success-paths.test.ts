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
// Mock @ihui/auth：跳过真实 JWT 签发/验证，返回固定 token 与 payload
// =============================================================================
vi.mock('@ihui/auth', () => ({
  signAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
  signRefreshToken: vi.fn().mockResolvedValue('mock-refresh-token'),
  verifyAccessToken: vi.fn().mockResolvedValue({
    userId: '00000000-0000-0000-0000-000000000001',
    phone: '13800000001',
    familyId: '00000000-0000-0000-0000-000000000002',
    roleId: 0,
  }),
  verifyRefreshToken: vi.fn().mockResolvedValue({
    userId: '00000000-0000-0000-0000-000000000001',
    phone: '13800000001',
    familyId: '00000000-0000-0000-0000-000000000002',
    roleId: 0,
  }),
  createFamilyId: vi.fn().mockReturnValue('00000000-0000-0000-0000-000000000002'),
}));

// =============================================================================
// Mock bcryptjs：避免真实 hash/compare 执行
// =============================================================================
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2a$10$mockedhashvalue'),
    compare: vi.fn().mockResolvedValue(true),
  },
}));

// =============================================================================
// Mock db/queries.js（用户相关查询）
// =============================================================================
vi.mock('../src/db/queries.js', () => ({
  findUserByPhone: vi.fn(),
  findUserByAccount: vi.fn(),
  findUserById: vi.fn(),
  findUserByEmail: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  saveRefreshToken: vi.fn().mockResolvedValue(undefined),
  findRefreshToken: vi.fn(),
  revokeRefreshToken: vi.fn().mockResolvedValue(undefined),
}));

// =============================================================================
// Mock db/billing-queries.js
// =============================================================================
vi.mock('../src/db/billing-queries.js', () => ({
  findPlans: vi.fn(),
  findPlanById: vi.fn(),
  createOrder: vi.fn(),
  findOrdersByUser: vi.fn(),
  findOrderById: vi.fn(),
  updateOrderStatus: vi.fn(),
  createPayment: vi.fn(),
  findAllOrdersForAdmin: vi.fn(),
}));

// =============================================================================
// Mock db/content-queries.js
// =============================================================================
vi.mock('../src/db/content-queries.js', () => ({
  findAnnouncements: vi.fn(),
  findAnnouncementById: vi.fn(),
  createAnnouncement: vi.fn(),
  updateAnnouncement: vi.fn(),
  deleteAnnouncement: vi.fn(),
  findHelpCategories: vi.fn(),
  findHelpCategoryById: vi.fn(),
  findHelpCategoryBySlug: vi.fn(),
  createHelpCategory: vi.fn(),
  updateHelpCategory: vi.fn(),
  deleteHelpCategory: vi.fn(),
  findHelpArticles: vi.fn(),
  findHelpArticleBySlug: vi.fn(),
  findHelpArticleById: vi.fn(),
  createHelpArticle: vi.fn(),
  updateHelpArticle: vi.fn(),
  deleteHelpArticle: vi.fn(),
  incrementHelpArticleView: vi.fn().mockResolvedValue(undefined),
  findDocs: vi.fn(),
  findDocBySlug: vi.fn(),
  findDocById: vi.fn(),
  createDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  incrementDocView: vi.fn().mockResolvedValue(undefined),
  markAnnouncementRead: vi.fn().mockResolvedValue(undefined),
  findReadAnnouncementIds: vi.fn().mockResolvedValue([]),
  countUnreadAnnouncements: vi.fn(),
}));

// =============================================================================
// Mock db/promotion-queries.js（auth register 邀请码 + billing 优惠券）
// =============================================================================
vi.mock('../src/db/promotion-queries.js', () => ({
  createInvitationCode: vi.fn(),
  findInvitationCodesByUser: vi.fn(),
  findInvitationByCode: vi.fn(),
  markInvitationUsed: vi.fn(),
  findInviteesByUser: vi.fn(),
  findActivities: vi.fn(),
  findActivityBySlug: vi.fn(),
  findActivityById: vi.fn(),
  createActivity: vi.fn(),
  updateActivity: vi.fn(),
  deleteActivity: vi.fn(),
  joinActivity: vi.fn(),
  leaveActivity: vi.fn(),
  findActivityParticipants: vi.fn(),
  createCoupon: vi.fn(),
  findCoupons: vi.fn(),
  findCouponByCode: vi.fn(),
  verifyCoupon: vi.fn(),
  incrementCouponUsedCount: vi.fn(),
}));

// =============================================================================
// Mock services/points-service.js（auth register 邀请奖励）
// =============================================================================
vi.mock('../src/services/points-service.js', () => ({
  earnPoints: vi.fn().mockResolvedValue(undefined),
  spendPoints: vi.fn().mockResolvedValue(undefined),
}));

// =============================================================================
// 导入被测路由与 mock 函数（vi.mock 在导入前生效）
// =============================================================================
import { authRoutes } from '../src/routes/auth';
import { billingRoutes } from '../src/routes/billing';
import { contentRoutes } from '../src/routes/content';
import bcrypt from 'bcryptjs';
import {
  findUserByPhone,
  findUserByAccount,
  createUser,
} from '../src/db/queries';
import { findPlans, findPlanById } from '../src/db/billing-queries';
import {
  findAnnouncements,
  findAnnouncementById,
  findHelpArticles,
  findHelpArticleBySlug,
  findDocs,
  findDocBySlug,
} from '../src/db/content-queries';

// =============================================================================
// 常量与测试数据
// =============================================================================
const SAMPLE_UUID = '00000000-0000-0000-0000-000000000001';

const mockUser = {
  id: SAMPLE_UUID,
  phone: '13800000001',
  email: null,
  passwordHash: '$2a$10$mockedhashvalue',
  nickname: '用户0001',
  avatar: null,
  familyId: '00000000-0000-0000-0000-000000000002',
  roleId: 0,
  status: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPlan = {
  id: SAMPLE_UUID,
  name: 'Pro',
  description: '专业版方案',
  price: 99,
  interval: 'month',
  features: ['feature1', 'feature2'],
  isActive: true,
  sortOrder: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockAnnouncement = {
  id: SAMPLE_UUID,
  title: '系统公告',
  content: '欢迎使用 IHUI AI',
  type: 'info',
  isPinned: false,
  isPublished: true,
  publishedAt: new Date(),
  expiresAt: null,
  createdBy: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockArticle = {
  id: SAMPLE_UUID,
  category: 'account',
  title: '账户帮助',
  slug: 'account-help',
  content: '账户相关帮助内容',
  sortOrder: 0,
  viewCount: 5,
  isPublished: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockDoc = {
  id: SAMPLE_UUID,
  category: 'guide',
  title: '入门指南',
  slug: 'getting-started',
  content: '快速上手指南',
  authorId: null,
  status: 'published',
  sortOrder: 0,
  viewCount: 10,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// =============================================================================
// 测试套件
// =============================================================================
describe('success paths', () => {
  const server = Fastify({ logger: false });

  beforeAll(async () => {
    // 与 server.ts 保持一致的错误处理器：将验证错误格式化为 { code, message }
    server.setErrorHandler((error, _request, reply) => {
      const statusCode =
        error.statusCode && error.statusCode >= 400 && error.statusCode < 600
          ? error.statusCode
          : 500;
      reply.status(statusCode).send({
        code: statusCode,
        message: statusCode >= 500 ? '服务器错误' : error.message,
      });
    });
    server.register(authRoutes, { prefix: '/api/auth' });
    server.register(billingRoutes, { prefix: '/api' });
    server.register(contentRoutes, { prefix: '/api' });
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // 重置 bcrypt 默认实现（可能被前一个测试覆盖）
    vi.mocked(bcrypt.hash).mockResolvedValue('$2a$10$mockedhashvalue');
    vi.mocked(bcrypt.compare).mockResolvedValue(true);
  });

  // ===========================================================================
  // auth 成功路径
  // ===========================================================================
  describe('auth routes', () => {
    it('POST /api/auth/register 成功注册返回 200 与 token', async () => {
      vi.mocked(findUserByPhone).mockResolvedValue(undefined);
      vi.mocked(createUser).mockResolvedValue(mockUser);

      const res = await server.inject({
        method: 'POST',
        url: '/api/auth/register',
        body: { phone: '13800000001', password: 'password123' },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.code).toBe(0);
      expect(body.data).toHaveProperty('accessToken');
      expect(body.data).toHaveProperty('refreshToken');
      expect(body.data.user.phone).toBe('13800000001');
      expect(body.data.user.id).toBe(SAMPLE_UUID);
    });

    it('POST /api/auth/register 重复手机号返回 409', async () => {
      vi.mocked(findUserByPhone).mockResolvedValue(mockUser);

      const res = await server.inject({
        method: 'POST',
        url: '/api/auth/register',
        body: { phone: '13800000001', password: 'password123' },
      });
      expect(res.statusCode).toBe(409);
      const body = res.json();
      expect(body.code).toBe(409);
      expect(body.message).toContain('已注册');
    });

    it('POST /api/auth/register 缺少字段返回 400', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/auth/register',
        body: { phone: '13800000001' },
      });
      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.code).toBe(400);
    });

    it('POST /api/auth/register 密码太短返回 400', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/auth/register',
        body: { phone: '13800000001', password: '123' },
      });
      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.code).toBe(400);
      expect(body.message).toContain('密码');
    });

    it('POST /api/auth/login 成功登录返回 200 与 token', async () => {
      vi.mocked(findUserByAccount).mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true);

      const res = await server.inject({
        method: 'POST',
        url: '/api/auth/login',
        body: { account: '13800000001', password: 'password123' },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.code).toBe(0);
      expect(body.data).toHaveProperty('accessToken');
      expect(body.data).toHaveProperty('refreshToken');
      expect(body.data.user.phone).toBe('13800000001');
    });

    it('POST /api/auth/login 密码错误返回 401', async () => {
      vi.mocked(findUserByAccount).mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(false);

      const res = await server.inject({
        method: 'POST',
        url: '/api/auth/login',
        body: { account: '13800000001', password: 'wrongpassword' },
      });
      expect(res.statusCode).toBe(401);
      const body = res.json();
      expect(body.code).toBe(401);
      expect(body.message).toContain('密码错误');
    });

    it('POST /api/auth/login 用户不存在返回 401', async () => {
      vi.mocked(findUserByAccount).mockResolvedValue(undefined);

      const res = await server.inject({
        method: 'POST',
        url: '/api/auth/login',
        body: { account: '13900000000', password: 'password123' },
      });
      expect(res.statusCode).toBe(401);
      const body = res.json();
      expect(body.code).toBe(401);
    });

    it('POST /api/auth/login 缺少字段返回 400', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/auth/login',
        body: { account: '13800000001' },
      });
      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.code).toBe(400);
    });
  });

  // ===========================================================================
  // billing 成功路径
  // ===========================================================================
  describe('billing routes', () => {
    it('GET /api/plans 成功获取方案列表返回 200', async () => {
      vi.mocked(findPlans).mockResolvedValue([mockPlan]);

      const res = await server.inject({ method: 'GET', url: '/api/plans' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.code).toBe(0);
      expect(body.data.plans).toHaveLength(1);
      expect(body.data.plans[0].name).toBe('Pro');
    });

    it('GET /api/plans/:id 成功获取方案详情返回 200', async () => {
      vi.mocked(findPlanById).mockResolvedValue(mockPlan);

      const res = await server.inject({
        method: 'GET',
        url: `/api/plans/${SAMPLE_UUID}`,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.code).toBe(0);
      expect(body.data.plan.id).toBe(SAMPLE_UUID);
      expect(body.data.plan.name).toBe('Pro');
    });

    it('GET /api/plans/:id 方案不存在返回 404', async () => {
      vi.mocked(findPlanById).mockResolvedValue(undefined);

      const res = await server.inject({
        method: 'GET',
        url: `/api/plans/${SAMPLE_UUID}`,
      });
      expect(res.statusCode).toBe(404);
      const body = res.json();
      expect(body.code).toBe(404);
      expect(body.message).toContain('不存在');
    });

    it('GET /api/plans/:id 非法 UUID 返回 400', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/plans/not-a-uuid',
      });
      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.code).toBe(400);
    });
  });

  // ===========================================================================
  // content 成功路径
  // ===========================================================================
  describe('content routes', () => {
    it('GET /api/announcements 成功获取公告列表返回 200', async () => {
      vi.mocked(findAnnouncements).mockResolvedValue([mockAnnouncement]);

      const res = await server.inject({ method: 'GET', url: '/api/announcements' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.code).toBe(0);
      expect(body.data.list).toHaveLength(1);
      expect(body.data.list[0].title).toBe('系统公告');
    });

    it('GET /api/announcements/:id 公告不存在返回 404', async () => {
      vi.mocked(findAnnouncementById).mockResolvedValue(undefined);

      const res = await server.inject({
        method: 'GET',
        url: `/api/announcements/${SAMPLE_UUID}`,
      });
      expect(res.statusCode).toBe(404);
      const body = res.json();
      expect(body.code).toBe(404);
      expect(body.message).toContain('不存在');
    });

    it('GET /api/announcements/:id 非法 UUID 返回 400', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/announcements/not-a-uuid',
      });
      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.code).toBe(400);
    });

    it('GET /api/help/articles 成功获取文章列表返回 200', async () => {
      vi.mocked(findHelpArticles).mockResolvedValue([mockArticle]);

      const res = await server.inject({ method: 'GET', url: '/api/help/articles' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.code).toBe(0);
      expect(body.data.list).toHaveLength(1);
      expect(body.data.list[0].title).toBe('账户帮助');
    });

    it('GET /api/help/articles 非法 category 返回 400', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/help/articles?category=invalid',
      });
      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.code).toBe(400);
    });

    it('GET /api/help/articles/:slug 文章不存在返回 404', async () => {
      vi.mocked(findHelpArticleBySlug).mockResolvedValue(undefined);

      const res = await server.inject({
        method: 'GET',
        url: '/api/help/articles/nonexistent-slug',
      });
      expect(res.statusCode).toBe(404);
      const body = res.json();
      expect(body.code).toBe(404);
      expect(body.message).toContain('不存在');
    });

    it('GET /api/docs 成功获取文档列表返回 200', async () => {
      vi.mocked(findDocs).mockResolvedValue([mockDoc]);

      const res = await server.inject({ method: 'GET', url: '/api/docs' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.code).toBe(0);
      expect(body.data.list).toHaveLength(1);
      expect(body.data.list[0].title).toBe('入门指南');
    });

    it('GET /api/docs/:slug 文档不存在返回 404', async () => {
      vi.mocked(findDocBySlug).mockResolvedValue(undefined);

      const res = await server.inject({
        method: 'GET',
        url: '/api/docs/nonexistent-slug',
      });
      expect(res.statusCode).toBe(404);
      const body = res.json();
      expect(body.code).toBe(404);
      expect(body.message).toContain('不存在');
    });
  });
});
