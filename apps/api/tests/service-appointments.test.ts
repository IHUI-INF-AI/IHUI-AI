import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'

const {
  mockAuthenticate,
  mockSelectResult,
  mockUpdateReturning,
} = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  mockSelectResult: vi.fn().mockResolvedValue([]),
  mockUpdateReturning: vi.fn().mockResolvedValue([{ id: 'mock-id' }]),
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
}))

// Proxy-based chainable mock — db/dbRead.select().from().where()...limit() 链最终 await 走 mockSelectResult
function createChainableMock() {
  const thenFn = (resolve: (v: unknown) => void) => mockSelectResult().then(resolve)
  const make = (): Record<string, unknown> => {
    const proxy = new Proxy({} as Record<string, unknown>, {
      get(_target, prop: string) {
        if (prop === 'then') return thenFn
        return vi.fn().mockReturnValue(make())
      },
    })
    return proxy
  }
  return make()
}

vi.mock('../src/db/index.js', () => ({
  db: {
    select: vi.fn(() => createChainableMock()),
    update: vi.fn(() => ({
      set: vi.fn(() => ({ where: vi.fn(() => ({ returning: mockUpdateReturning })) })),
    })),
    execute: vi.fn().mockResolvedValue([]),
  },
  dbRead: {
    select: vi.fn(() => createChainableMock()),
  },
  dbClient: {},
}))

import { otherRoutes as frontendStubOtherRoutes } from '../src/routes/other/index.js'

const USER_ID = '00000000-0000-0000-0000-000000000001'
const APPT_ID = '11111111-1111-1111-1111-111111111111'

function mockAuthUser() {
  mockAuthenticate.mockImplementation(async (request: any) => {
    request.userId = USER_ID
    request.jwtPayload = { userId: USER_ID, roleId: 0 }
  })
}

function mockUnauthorized() {
  const err = new Error('Authentication required')
  ;(err as Error & { statusCode: number }).statusCode = 401
  mockAuthenticate.mockRejectedValue(err)
}

function makeAppointment(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: APPT_ID,
    userId: USER_ID,
    serviceType: 'consultation',
    title: '测试预约',
    description: null,
    appointmentTime: new Date('2026-08-01T10:00:00Z'),
    duration: 60,
    location: null,
    contactName: null,
    contactPhone: null,
    status: 'pending',
    remark: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('service-appointment routes', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(frontendStubOtherRoutes)
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    mockSelectResult.mockReset()
    mockSelectResult.mockResolvedValue([])
    mockUpdateReturning.mockReset()
    mockUpdateReturning.mockResolvedValue([{ id: 'mock-id' }])
    mockAuthenticate.mockReset()
  })

  it('未登录 GET /service-appointment/:id → 401', async () => {
    mockUnauthorized()
    const res = await server.inject({ method: 'GET', url: `/service-appointment/${APPT_ID}` })
    expect(res.statusCode).toBe(401)
    expect(mockSelectResult).not.toHaveBeenCalled()
  })

  it('GET /service-appointment/:id 存在 → 200', async () => {
    mockAuthUser()
    mockSelectResult.mockResolvedValueOnce([makeAppointment()])

    const res = await server.inject({ method: 'GET', url: `/service-appointment/${APPT_ID}` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.id).toBe(APPT_ID)
    expect(body.data.status).toBe('pending')
  })

  it('GET /service-appointment/:id 不存在 → 404', async () => {
    mockAuthUser()
    mockSelectResult.mockResolvedValueOnce([])

    const res = await server.inject({ method: 'GET', url: `/service-appointment/${APPT_ID}` })
    expect(res.statusCode).toBe(404)
    const body = res.json()
    expect(body.code).toBe(404)
  })

  it('GET /service-appointment/:id/cancel pending → 200 (status → cancelled)', async () => {
    mockAuthUser()
    mockSelectResult.mockResolvedValueOnce([makeAppointment({ status: 'pending' })])
    mockUpdateReturning.mockResolvedValueOnce([makeAppointment({ status: 'cancelled' })])

    const res = await server.inject({ method: 'GET', url: `/service-appointment/${APPT_ID}/cancel` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.status).toBe('cancelled')
    expect(mockUpdateReturning).toHaveBeenCalled()
  })

  it('GET /service-appointment/:id/confirm pending → 200 (status → confirmed)', async () => {
    mockAuthUser()
    mockSelectResult.mockResolvedValueOnce([makeAppointment({ status: 'pending' })])
    mockUpdateReturning.mockResolvedValueOnce([makeAppointment({ status: 'confirmed' })])

    const res = await server.inject({ method: 'GET', url: `/service-appointment/${APPT_ID}/confirm` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.status).toBe('confirmed')
  })

  it('GET /service-appointment/:id/complete confirmed → 200 (status → completed)', async () => {
    mockAuthUser()
    mockSelectResult.mockResolvedValueOnce([makeAppointment({ status: 'confirmed' })])
    mockUpdateReturning.mockResolvedValueOnce([makeAppointment({ status: 'completed' })])

    const res = await server.inject({ method: 'GET', url: `/service-appointment/${APPT_ID}/complete` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.status).toBe('completed')
  })

  it('GET /service-appointment/:id/confirm completed → 409 (状态不允许)', async () => {
    mockAuthUser()
    mockSelectResult.mockResolvedValueOnce([makeAppointment({ status: 'completed' })])

    const res = await server.inject({ method: 'GET', url: `/service-appointment/${APPT_ID}/confirm` })
    expect(res.statusCode).toBe(409)
    const body = res.json()
    expect(body.code).toBe(409)
    expect(mockUpdateReturning).not.toHaveBeenCalled()
  })

  it('GET /service-appointment/:id/cancel completed → 409 (状态不允许)', async () => {
    mockAuthUser()
    mockSelectResult.mockResolvedValueOnce([makeAppointment({ status: 'completed' })])

    const res = await server.inject({ method: 'GET', url: `/service-appointment/${APPT_ID}/cancel` })
    expect(res.statusCode).toBe(409)
    expect(mockUpdateReturning).not.toHaveBeenCalled()
  })
})
