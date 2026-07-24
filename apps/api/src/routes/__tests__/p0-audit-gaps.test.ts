import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

vi.mock('@ihui/auth', () => ({
  verifyAccessToken: vi.fn(),
}))

// 修复(2026-07-24):authenticate 内部调用 jose.decodeJwt(token) 检查 challenge token,
// 'mock-admin-token' 非有效 JWT 会抛异常 → 401。mock decodeJwt 返回非 challenge payload 绕过。
vi.mock('jose', () => ({
  decodeJwt: vi.fn(() => ({ type: 'access' })),
}))

vi.mock('../../db/index.js', () => ({
  db: {
    execute: vi.fn().mockResolvedValue([]),
    select: vi.fn(() => createChain([])),
    insert: vi.fn(() => createChain([])),
    update: vi.fn(() => createChain([])),
    delete: vi.fn(() => createChain([])),
  },
}))

vi.mock('../../db/member-queries.js', () => {
  class MemberConflictError extends Error {
    statusCode = 409
    constructor(message: string) {
      super(message)
      this.name = 'MemberConflictError'
    }
  }
  return {
    findMembers: vi.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
    findUnauditedMembers: vi.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
    findMemberById: vi.fn(),
    findMembersByIds: vi.fn().mockResolvedValue([]),
    findAuthMembers: vi.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
    createMember: vi.fn(),
    updateMember: vi.fn(),
    setMemberStatus: vi.fn(),
    resetMemberPassword: vi.fn(),
    deleteMember: vi.fn(),
    registerMember: vi.fn(),
    registerMemberByMobile: vi.fn(),
    findMemberCompanies: vi.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
    findMemberLevels: vi.fn().mockResolvedValue([]),
    findMemberLevelById: vi.fn(),
    createMemberLevel: vi.fn(),
    updateMemberLevel: vi.fn(),
    deleteMemberLevel: vi.fn(),
    getMemberStatistics: vi.fn().mockResolvedValue({ total: 0, active: 0, pending: 0, sealed: 0 }),
    findCompanies: vi.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
    findCompanyById: vi.fn(),
    createCompany: vi.fn(),
    updateCompany: vi.fn(),
    deleteCompany: vi.fn(),
    findDepartments: vi.fn().mockResolvedValue([]),
    findDepartmentById: vi.fn(),
    createDepartment: vi.fn(),
    updateDepartment: vi.fn(),
    deleteDepartment: vi.fn(),
    findUsersByDepartment: vi.fn().mockResolvedValue([]),
    findSystemUserById: vi.fn(),
    createSystemUser: vi.fn(),
    updateSystemUser: vi.fn(),
    resetSystemUserPassword: vi.fn(),
    deleteSystemUser: vi.fn(),
    MemberConflictError,
  }
})

vi.mock('../../db/member-extended-queries.js', () => ({
  findGroupList: vi.fn().mockResolvedValue([]),
  findGroupById: vi.fn(),
  createGroup: vi.fn(),
  updateGroup: vi.fn(),
  deleteGroup: vi.fn(),
  findPostList: vi.fn().mockResolvedValue([]),
  findPostById: vi.fn(),
  createPost: vi.fn(),
  updatePost: vi.fn(),
  deletePost: vi.fn(),
  findTagList: vi.fn().mockResolvedValue([]),
  findTagById: vi.fn(),
  createTag: vi.fn(),
  updateTag: vi.fn(),
  deleteTag: vi.fn(),
  findTypeList: vi.fn().mockResolvedValue([]),
  findCompanyTypeList: vi.fn().mockResolvedValue([]),
  findCompanyTypeById: vi.fn(),
  createCompanyType: vi.fn(),
  updateCompanyType: vi.fn(),
  deleteCompanyType: vi.fn(),
  enableCompanyType: vi.fn(),
  disableCompanyType: vi.fn(),
}))

function createChain(result: unknown[] = []) {
  const chain: Record<string, unknown> = {
    then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(result).then(resolve),
  }
  for (const m of [
    'from',
    'where',
    'orderBy',
    'limit',
    'offset',
    'values',
    'set',
    'returning',
    'leftJoin',
    'innerJoin',
    'groupBy',
    'onConflictDoUpdate',
  ]) {
    chain[m] = () => chain
  }
  return chain
}

import multipart from '@fastify/multipart'
import { memberRoutes, adminMemberRoutes } from '../member.js'
import { verifyAccessToken } from '@ihui/auth'
import { createMember } from '../../db/member-queries.js'

const AUTH_HEADERS = { authorization: 'Bearer mock-token' }

function mockAuth(roleId = 1): void {
  vi.mocked(verifyAccessToken).mockResolvedValue({
    userId: '00000000-0000-0000-0000-000000000000',
    phone: '13800000000',
    familyId: '00000000-0000-0000-0000-000000000000',
    roleId,
  })
}

describe('P0 Audit Gaps — Member batch import', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } })
    await app.register(memberRoutes, { prefix: '/api' })
    await app.register(adminMemberRoutes, { prefix: '/api/admin' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('POST /api/admin/members/batch-import without auth returns 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/members/batch-import',
      payload: Buffer.from('username,password\ntest,123456'),
      headers: { 'content-type': 'multipart/form-data; boundary=----WebKitFormBoundary' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('POST /api/admin/members/batch-import CSV succeeds and returns imported counts', async () => {
    mockAuth(1)
    vi.mocked(createMember).mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000001',
    } as never)

    const boundary = '----WebKitFormBoundaryTest'
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="members.csv"',
      'Content-Type: text/csv',
      '',
      'username,password,mobile\ntest1,123456,13800000001\ntest2,123456,13800000002',
      `--${boundary}--`,
    ].join('\r\n')

    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/members/batch-import',
      payload: body,
      headers: {
        ...AUTH_HEADERS,
        'content-type': `multipart/form-data; boundary=${boundary}`,
        'content-length': String(Buffer.byteLength(body)),
      },
    })

    expect(res.statusCode).toBe(200)
    const json = res.json()
    expect(json.code).toBe(0)
    expect(json.data.imported).toBe(2)
    expect(json.data.failed).toBe(0)
  })

  it('POST /api/admin/members/batch-import rejects unsupported file type', async () => {
    mockAuth(1)
    const boundary = '----WebKitFormBoundaryTest'
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="members.txt"',
      'Content-Type: text/plain',
      '',
      'hello',
      `--${boundary}--`,
    ].join('\r\n')

    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/members/batch-import',
      payload: body,
      headers: {
        ...AUTH_HEADERS,
        'content-type': `multipart/form-data; boundary=${boundary}`,
        'content-length': String(Buffer.byteLength(body)),
      },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe(400)
  })
})
