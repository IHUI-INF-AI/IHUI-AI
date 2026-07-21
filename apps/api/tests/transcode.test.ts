import { describe, it, expect, afterAll, beforeAll, vi } from 'vitest'
import Fastify from 'fastify'

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8080,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'info',
    CORS_ORIGIN: 'http://localhost:3000',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8000',
  },
}))

vi.mock('../src/services/transcode-service.js', () => ({
  isFfmpegAvailable: vi.fn().mockResolvedValue(false),
  createTranscodeJob: vi.fn().mockResolvedValue({
    id: 'job-test-001',
    inputPath: '/tmp/input.mp4',
    outputPath: '/tmp/output.mp4',
    preset: 'video/mp4',
    status: 'pending',
    progress: 0,
    createdAt: new Date().toISOString(),
    error: null,
  }),
  startTranscodeJob: vi.fn().mockResolvedValue(undefined),
  getTranscodeJob: vi.fn().mockImplementation((id: string) =>
    id === 'job-test-001'
      ? {
          id,
          inputPath: '/tmp/input.mp4',
          outputPath: '/tmp/output.mp4',
          preset: 'video/mp4',
          status: 'pending',
          progress: 0,
          createdAt: new Date().toISOString(),
          error: null,
        }
      : null,
  ),
  listTranscodeJobs: vi.fn().mockReturnValue([]),
  cancelTranscodeJob: vi.fn().mockResolvedValue({
    id: 'job-test-001',
    status: 'cancelled',
  }),
  deleteTranscodeJob: vi.fn().mockResolvedValue(true),
}))

import { transcodeRoutes, adminTranscodeRoutes } from '../src/routes/transcode'

describe('transcode routes', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    server.setErrorHandler((error, _request, reply) => {
      const statusCode =
        error.statusCode && error.statusCode >= 400 && error.statusCode < 600
          ? error.statusCode
          : 500
      reply.status(statusCode).send({
        code: statusCode,
        message: statusCode >= 500 ? '服务器错误' : error.message,
      })
    })
    await server.register(transcodeRoutes, { prefix: '/api' })
    await server.register(adminTranscodeRoutes, { prefix: '/api/admin' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  it('GET /api/transcode/health 未登录返回 401(2026-07-21 第十轮加固:转码 API 全部需 admin)', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/transcode/health' })
    expect(res.statusCode).toBe(401)
  })

  it('POST /api/transcode/jobs 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/transcode/jobs',
      body: { inputPath: '/tmp/input.mp4', preset: 'video/mp4' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/transcode/jobs/:jobId 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/transcode/jobs/job-test-001' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/transcode/jobs/:jobId/download 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/transcode/jobs/job-test-001/download',
    })
    expect(res.statusCode).toBe(401)
  })

  it('POST /api/transcode/jobs/:jobId/cancel 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/transcode/jobs/job-test-001/cancel',
    })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/admin/transcode/jobs 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/admin/transcode/jobs' })
    expect(res.statusCode).toBe(401)
  })

  it('DELETE /api/admin/transcode/jobs/:jobId 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'DELETE',
      url: '/api/admin/transcode/jobs/job-test-001',
    })
    expect(res.statusCode).toBe(401)
  })
})
