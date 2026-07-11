import { describe, it, expect, afterAll, vi } from 'vitest'
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

import { remoteDeviceRoutes } from '../src/routes/remote-device'

describe('Remote device routes (M-87)', () => {
  const server = Fastify({ logger: false })

  afterAll(async () => {
    await server.close()
  })

  it('GET /api/remote-devices 未登录返回 401', async () => {
    await server.register(remoteDeviceRoutes, { prefix: '/api' })
    await server.ready()

    const res = await server.inject({ method: 'GET', url: '/api/remote-devices' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/remote-devices/:id 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/remote-devices/00000000-0000-0000-0000-000000000000',
    })
    expect(res.statusCode).toBe(401)
  })

  it('POST /api/remote-devices 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/remote-devices',
      body: { deviceNo: 'DEVICE-001', deviceName: '测试设备' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('PUT /api/remote-devices/:id 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'PUT',
      url: '/api/remote-devices/00000000-0000-0000-0000-000000000000',
      body: { deviceName: '更新设备' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('DELETE /api/remote-devices/:id 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'DELETE',
      url: '/api/remote-devices/00000000-0000-0000-0000-000000000000',
    })
    expect(res.statusCode).toBe(401)
  })

  it('POST /api/remote-devices/:id/heartbeat 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/remote-devices/00000000-0000-0000-0000-000000000000/heartbeat',
      body: { batteryLevel: 80, signalStrength: -50 },
    })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/remote-devices/:id/tasks 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/remote-devices/00000000-0000-0000-0000-000000000000/tasks',
    })
    expect(res.statusCode).toBe(401)
  })

  it('POST /api/remote-devices/:id/tasks 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/remote-devices/00000000-0000-0000-0000-000000000000/tasks',
      body: { taskType: 'reboot', title: '远程重启' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/remote-device-tasks/:taskId 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/remote-device-tasks/00000000-0000-0000-0000-000000000000',
    })
    expect(res.statusCode).toBe(401)
  })

  it('PUT /api/remote-device-tasks/:taskId/status 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'PUT',
      url: '/api/remote-device-tasks/00000000-0000-0000-0000-000000000000/status',
      body: { status: 'completed' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('DELETE /api/remote-device-tasks/:taskId 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'DELETE',
      url: '/api/remote-device-tasks/00000000-0000-0000-0000-000000000000',
    })
    expect(res.statusCode).toBe(401)
  })

  it('POST /api/remote-device-tasks/:taskId/retry 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/remote-device-tasks/00000000-0000-0000-0000-000000000000/retry',
    })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/remote-device-tasks/pending 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/remote-device-tasks/pending' })
    expect(res.statusCode).toBe(401)
  })
})
