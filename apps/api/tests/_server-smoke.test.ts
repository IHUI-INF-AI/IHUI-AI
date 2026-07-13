import { describe, it, expect, vi } from 'vitest'

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
}))

vi.mock('@ihui/auth', () => ({
  signAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
  signRefreshToken: vi.fn().mockResolvedValue('mock-refresh-token'),
  verifyAccessToken: vi.fn().mockResolvedValue({ sub: 'admin', roleId: 1 }),
  createFamilyId: vi.fn().mockReturnValue('00000000-0000-0000-0000-000000000002'),
}))

vi.mock('../src/db/index.js', () => ({
  db: new Proxy({}, { get: () => () => new Proxy({}, { get: () => () => Promise.resolve([]) }) }),
}))

describe('server smoke', () => {
  it('buildServer() can start without route conflicts', async () => {
    const { buildServer } = await import('../src/server.js')
    const server = await buildServer()
    expect(server).toBeDefined()
    await server.close()
  }, 30000)
})
