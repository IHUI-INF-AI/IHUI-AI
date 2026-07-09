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
// Mock @ihui/auth:roleId=1 为管理员,以便 GET /api/admin/logs 通过权限校验
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
// Mock db/system-queries.js(logs 相关查询)
// =============================================================================
vi.mock('../src/db/system-queries.js', () => ({
  findPublicConfigs: vi.fn().mockResolvedValue([]),
  findConfigs: vi.fn(),
  createConfig: vi.fn(),
  updateConfig: vi.fn(),
  deleteConfig: vi.fn(),
  findConfigById: vi.fn(),
  findConfigByKey: vi.fn(),
  findIntegrations: vi.fn(),
  findIntegrationById: vi.fn(),
  findIntegrationByName: vi.fn(),
  createIntegration: vi.fn(),
  updateIntegration: vi.fn(),
  deleteIntegration: vi.fn(),
  findApiLogs: vi.fn(),
  findSystemEvents: vi.fn(),
  createSystemEvent: vi.fn(),
}));

// =============================================================================
// Mock db/content-queries.js(公告/帮助文章/文档相关查询)
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
// 导入被测路由与 mock 函数(vi.mock 在导入前生效)
// =============================================================================
import { adminSystemRoutes } from '../src/routes/system';
import { contentRoutes } from '../src/routes/content';
import { findApiLogs } from '../src/db/system-queries';
import {
  findAnnouncements,
  findAnnouncementById,
  findHelpArticles,
  findDocs,
} from '../src/db/content-queries';

// =============================================================================
// 常量与测试数据
// =============================================================================
const SAMPLE_UUID = '00000000-0000-0000-0000-000000000001';
const NONEXIST_UUID = '00000000-0000-0000-0000-000000000000';
const AUTH_HEADERS = { authorization: 'Bearer mock-access-token' };

/** 生成 n 条模拟日志 */
function makeLogs(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: SAMPLE_UUID,
    method: 'GET',
    path: `/api/test/${i}`,
    statusCode: 200,
    duration: 10 + i,
    userId: null,
    ip: '127.0.0.1',
    createdAt: new Date(),
  }));
}

const mockAnnouncement = {
  id: SAMPLE_UUID,
  title: '系统公告',
  content: '欢迎使用 IHUI AI',
  type: 'info',
  isPinned: true,
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
describe('edge cases', () => {
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
    server.register(adminSystemRoutes, { prefix: '/api/admin' });
    server.register(contentRoutes, { prefix: '/api' });
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // 分页边界测试
  // ===========================================================================
  describe('pagination boundaries - GET /api/admin/logs', () => {
    it('page=1&pageSize=5 返回 200 与 5 条记录', async () => {
      vi.mocked(findApiLogs).mockResolvedValue({ list: makeLogs(5), total: 5 });

      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/logs?page=1&pageSize=5',
        headers: AUTH_HEADERS,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.code).toBe(0);
      expect(body.data.list).toHaveLength(5);
      expect(body.data.total).toBe(5);
      expect(body.data.page).toBe(1);
      expect(body.data.pageSize).toBe(5);
    });

    it('page=999 超出总页数返回 200 与空列表', async () => {
      vi.mocked(findApiLogs).mockResolvedValue({ list: [], total: 0 });

      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/logs?page=999',
        headers: AUTH_HEADERS,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.code).toBe(0);
      expect(body.data.list).toEqual([]);
      expect(body.data.total).toBe(0);
    });

    it('page=0 非法页码返回 400', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/logs?page=0',
        headers: AUTH_HEADERS,
      });
      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.code).toBe(400);
    });

    it('pageSize=0 非法 pageSize 返回 400', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/logs?pageSize=0',
        headers: AUTH_HEADERS,
      });
      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.code).toBe(400);
    });

    it('pageSize=200 超过上限返回 400', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/logs?pageSize=200',
        headers: AUTH_HEADERS,
      });
      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.code).toBe(400);
    });
  });

  // ===========================================================================
  // 筛选测试
  // ===========================================================================
  describe('filtering - GET /api/admin/logs', () => {
    it('statusCode=404 筛选 404 返回 200', async () => {
      vi.mocked(findApiLogs).mockResolvedValue({ list: makeLogs(2), total: 2 });

      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/logs?statusCode=404',
        headers: AUTH_HEADERS,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.code).toBe(0);
      expect(body.data.list).toHaveLength(2);
      // 确认筛选参数传入 mock
      expect(vi.mocked(findApiLogs)).toHaveBeenCalledWith(
        1,
        20,
        expect.objectContaining({ statusCode: 404 }),
      );
    });

    it('path=/api/auth 路径模糊搜索返回 200', async () => {
      vi.mocked(findApiLogs).mockResolvedValue({ list: makeLogs(3), total: 3 });

      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/logs?path=/api/auth',
        headers: AUTH_HEADERS,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.code).toBe(0);
      expect(body.data.list).toHaveLength(3);
      expect(vi.mocked(findApiLogs)).toHaveBeenCalledWith(
        1,
        20,
        expect.objectContaining({ path: '/api/auth' }),
      );
    });

    it('userId=<invalid-uuid> 非法 UUID 返回 400', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/logs?userId=not-a-uuid',
        headers: AUTH_HEADERS,
      });
      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.code).toBe(400);
    });
  });

  // ===========================================================================
  // 排序/分页组合
  // ===========================================================================
  describe('sort and category filtering', () => {
    it('GET /api/announcements 列表默认排序返回 200', async () => {
      vi.mocked(findAnnouncements).mockResolvedValue([mockAnnouncement]);

      const res = await server.inject({ method: 'GET', url: '/api/announcements' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.code).toBe(0);
      expect(body.data.list).toHaveLength(1);
      expect(body.data.list[0].title).toBe('系统公告');
    });

    it('GET /api/help/articles?category=account 分类筛选返回 200', async () => {
      vi.mocked(findHelpArticles).mockResolvedValue([mockArticle]);

      const res = await server.inject({
        method: 'GET',
        url: '/api/help/articles?category=account',
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.code).toBe(0);
      expect(body.data.list).toHaveLength(1);
      expect(body.data.list[0].category).toBe('account');
      expect(vi.mocked(findHelpArticles)).toHaveBeenCalledWith('account');
    });

    it('GET /api/help/articles?category=invalid 非法分类返回 400', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/help/articles?category=invalid',
      });
      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.code).toBe(400);
    });

    it('GET /api/docs?category=guide 分类筛选返回 200', async () => {
      vi.mocked(findDocs).mockResolvedValue([mockDoc]);

      const res = await server.inject({
        method: 'GET',
        url: '/api/docs?category=guide',
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.code).toBe(0);
      expect(body.data.list).toHaveLength(1);
      expect(body.data.list[0].category).toBe('guide');
      expect(vi.mocked(findDocs)).toHaveBeenCalledWith('guide');
    });
  });

  // ===========================================================================
  // UUID 参数测试
  // ===========================================================================
  describe('uuid parameter validation - GET /api/announcements/:id', () => {
    it('not-a-uuid 非法 UUID 返回 400', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/announcements/not-a-uuid',
      });
      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.code).toBe(400);
    });

    it('不存在的 UUID 返回 404', async () => {
      vi.mocked(findAnnouncementById).mockResolvedValue(undefined);

      const res = await server.inject({
        method: 'GET',
        url: `/api/announcements/${NONEXIST_UUID}`,
      });
      expect(res.statusCode).toBe(404);
      const body = res.json();
      expect(body.code).toBe(404);
      expect(body.message).toContain('不存在');
    });

    it('合法 UUID 且公告存在返回 200', async () => {
      vi.mocked(findAnnouncementById).mockResolvedValue(mockAnnouncement);

      const res = await server.inject({
        method: 'GET',
        url: `/api/announcements/${SAMPLE_UUID}`,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.code).toBe(0);
      expect(body.data.announcement.id).toBe(SAMPLE_UUID);
    });
  });
});
