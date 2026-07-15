import { describe, it, expect, beforeEach } from 'vitest'
import { sql } from 'drizzle-orm'
import { db } from '../src/db/index.js'
import {
  hashPassword,
  findMembers,
  findUnauditedMembers,
  findMemberById,
  findMemberByUsername,
  findMemberByMobile,
  findMembersByIds,
  findAuthMembers,
  createMember,
  updateMember,
  setMemberStatus,
  resetMemberPassword,
  deleteMember,
  registerMember,
  registerMemberByMobile,
  MemberConflictError,
  findMemberCompanies,
  findMemberLevels,
  findMemberLevelById,
  createMemberLevel,
  updateMemberLevel,
  deleteMemberLevel,
  getMemberStatistics,
  findCompanies,
  findCompanyById,
  createCompany,
  updateCompany,
  deleteCompany,
  findDepartments,
  findDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  findSystemUserById,
  createSystemUser,
  updateSystemUser,
  resetSystemUserPassword,
  deleteSystemUser,
} from '../src/db/member-queries.js'

describe('member-queries — 真实 DB 集成测试', () => {
  beforeEach(async () => {
    // 按外键依赖顺序清空:members → departments → companies → member_levels → users
    await db.execute(sql`DELETE FROM edu_members`)
    await db.execute(sql`DELETE FROM edu_departments`)
    await db.execute(sql`DELETE FROM edu_companies`)
    await db.execute(sql`DELETE FROM edu_member_levels`)
    await db.execute(sql`DELETE FROM user_profiles`)
    await db.execute(sql`DELETE FROM users WHERE is_system_admin = false`)
  })

  describe('hashPassword', () => {
    it('sha256 哈希 — 空字符串返回空', () => {
      expect(hashPassword('')).toBe('')
      // sha256('123456') = 8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92
      expect(hashPassword('123456')).toBe(
        '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92',
      )
    })
  })

  describe('会员 CRUD', () => {
    it('createMember + findMemberById — 密码自动 sha256 哈希', async () => {
      const m = await createMember({ username: 'alice', password: '123456', status: 1 })
      expect(m.username).toBe('alice')
      expect(m.password).toBe(hashPassword('123456'))
      expect(m.status).toBe(1)
      const found = await findMemberById(m.id)
      expect(found?.username).toBe('alice')
    })

    it('findMemberByUsername + findMemberByMobile + findMembersByIds', async () => {
      const m1 = await createMember({ username: 'bob', password: 'pw', mobile: '13800000001' })
      const m2 = await createMember({ username: 'carol', password: 'pw', mobile: '13800000002' })
      expect((await findMemberByUsername('bob'))?.id).toBe(m1.id)
      expect((await findMemberByMobile('13800000002'))?.id).toBe(m2.id)
      const list = await findMembersByIds([m1.id, m2.id])
      expect(list).toHaveLength(2)
      // 空数组返回空
      expect(await findMembersByIds([])).toEqual([])
    })

    it('findMembers — username/mobile 模糊搜索 + status 过滤 + 分页', async () => {
      await createMember({ username: 'search_user1', password: 'pw', status: 1 })
      await createMember({
        username: 'search_user2',
        password: 'pw',
        status: 0,
        mobile: '13900000000',
      })
      const r1 = await findMembers({ page: 1, pageSize: 10, username: 'search_user' })
      expect(r1.total).toBe(2)
      expect(r1.list).toHaveLength(2)
      const r2 = await findMembers({ page: 1, pageSize: 10, status: 0 })
      expect(r2.total).toBe(1)
      expect(r2.list[0].username).toBe('search_user2')
      const r3 = await findMembers({ page: 1, pageSize: 10, mobile: '1390000' })
      expect(r3.total).toBe(1)
      // 分页
      const r4 = await findMembers({ page: 1, pageSize: 1 })
      expect(r4.list).toHaveLength(1)
      expect(r4.total).toBe(2)
    })

    it('findUnauditedMembers — 仅返回 status=0', async () => {
      await createMember({ username: 'pending1', password: 'pw', status: 0 })
      await createMember({ username: 'active1', password: 'pw', status: 1 })
      const r = await findUnauditedMembers({ page: 1, pageSize: 10 })
      expect(r.total).toBe(1)
      expect(r.list[0].username).toBe('pending1')
    })

    it('findAuthMembers — 仅 status=1 + keyword 模糊搜索(username/mobile/nickname)', async () => {
      await createMember({ username: 'auth1', password: 'pw', status: 1, nickname: 'NickA' })
      await createMember({ username: 'auth2', password: 'pw', status: 0, mobile: '13700000000' })
      const r1 = await findAuthMembers({ page: 1, pageSize: 10 })
      expect(r1.total).toBe(1) // 只含 status=1
      const r2 = await findAuthMembers({ page: 1, pageSize: 10, keyword: 'NickA' })
      expect(r2.total).toBe(1)
    })

    it('updateMember — 部分字段更新', async () => {
      const m = await createMember({ username: 'upd', password: 'pw' })
      const updated = await updateMember(m.id, { nickname: 'NewNick', gender: 1 })
      expect(updated?.nickname).toBe('NewNick')
      expect(updated?.gender).toBe(1)
      expect(updated?.username).toBe('upd') // 未更新字段保留
    })

    it('setMemberStatus — 封禁/解封', async () => {
      const m = await createMember({ username: 'stat', password: 'pw', status: 1 })
      const banned = await setMemberStatus(m.id, 2)
      expect(banned?.status).toBe(2)
      const unbanned = await setMemberStatus(m.id, 1)
      expect(unbanned?.status).toBe(1)
    })

    it('resetMemberPassword — 重新 sha256 哈希', async () => {
      const m = await createMember({ username: 'reset', password: 'old' })
      const r = await resetMemberPassword(m.id, 'newpass')
      expect(r?.password).toBe(hashPassword('newpass'))
      expect(r?.password).not.toBe(hashPassword('old'))
    })

    it('deleteMember — 删除后查不到', async () => {
      const m = await createMember({ username: 'del', password: 'pw' })
      await deleteMember(m.id)
      expect(await findMemberById(m.id)).toBeUndefined()
    })
  })

  describe('注册', () => {
    it('registerMember — 用户名注册成功 + 默认 status=1', async () => {
      const m = await registerMember({ username: 'newuser', password: 'pw', nickname: 'New' })
      expect(m.username).toBe('newuser')
      expect(m.nickname).toBe('New')
      expect(m.status).toBe(1)
      expect(m.password).toBe(hashPassword('pw'))
    })

    it('registerMember — 用户名重复抛 MemberConflictError', async () => {
      await registerMember({ username: 'dup', password: 'pw' })
      await expect(registerMember({ username: 'dup', password: 'pw' })).rejects.toThrow(
        MemberConflictError,
      )
    })

    it('registerMemberByMobile — 手机号注册 + 重复抛错', async () => {
      const m = await registerMemberByMobile({ mobile: '13800001111', password: 'pw' })
      expect(m.mobile).toBe('13800001111')
      expect(m.username).toBe('13800001111') // username 默认 = mobile
      await expect(
        registerMemberByMobile({ mobile: '13800001111', password: 'pw' }),
      ).rejects.toThrow(MemberConflictError)
    })
  })

  describe('会员等级', () => {
    it('createMemberLevel + findMemberLevelById + findMemberLevels(按 sort 排序)', async () => {
      const lv1 = await createMemberLevel({ name: '青铜', growthValue: 0, sort: 1 })
      const _lv2 = await createMemberLevel({ name: '黄金', growthValue: 1000, sort: 2 })
      expect(lv1.name).toBe('青铜')
      expect(lv1.discount).toBe('1.00') // 默认值
      const found = await findMemberLevelById(lv1.id)
      expect(found?.name).toBe('青铜')
      const all = await findMemberLevels()
      expect(all).toHaveLength(2)
      expect(all[0].sort).toBe(1) // 按 sort 升序
      expect(all[1].sort).toBe(2)
    })

    it('updateMemberLevel + deleteMemberLevel', async () => {
      const lv = await createMemberLevel({ name: 'Old', sort: 1 })
      const updated = await updateMemberLevel(lv.id, { name: 'New', discount: '0.80' })
      expect(updated?.name).toBe('New')
      expect(updated?.discount).toBe('0.80')
      await deleteMemberLevel(lv.id)
      expect(await findMemberLevelById(lv.id)).toBeUndefined()
    })
  })

  describe('会员统计', () => {
    it('getMemberStatistics — total/active/pending/sealed 计数', async () => {
      await createMember({ username: 's1', password: 'pw', status: 1 })
      await createMember({ username: 's2', password: 'pw', status: 1 })
      await createMember({ username: 's3', password: 'pw', status: 0 })
      await createMember({ username: 's4', password: 'pw', status: 2 })
      const stat = await getMemberStatistics()
      expect(stat.total).toBe(4)
      expect(stat.active).toBe(2)
      expect(stat.pending).toBe(1)
      expect(stat.sealed).toBe(1)
    })
  })

  describe('会员企业列表', () => {
    it('findMemberCompanies — 按 company_id 聚合 + nickname 模糊搜索', async () => {
      const c1 = await createCompany({ name: 'CorpA' })
      const c2 = await createCompany({ name: 'CorpB' })
      await createMember({ username: 'c1u1', password: 'pw', companyId: c1.id, nickname: 'Alice' })
      await createMember({ username: 'c1u2', password: 'pw', companyId: c1.id, nickname: 'Bob' })
      await createMember({ username: 'c2u1', password: 'pw', companyId: c2.id, nickname: 'Alice2' })
      // 无 companyId 的不计入
      await createMember({ username: 'noc', password: 'pw' })
      const r1 = await findMemberCompanies({ page: 1, pageSize: 10 })
      expect(r1.total).toBe(2) // 2 个企业
      const corpA = r1.list.find((c) => c.companyId === c1.id)
      expect(corpA?.memberCount).toBe(2)
      const r2 = await findMemberCompanies({ page: 1, pageSize: 10, name: 'Alice' })
      expect(r2.total).toBeGreaterThanOrEqual(1)
    })
  })

  describe('企业 CRUD', () => {
    it('createCompany + findCompanyById + findCompanies(name 搜索/状态过滤)', async () => {
      const c = await createCompany({ name: 'TestCorp', contactName: 'CT', status: 1 })
      expect(c.name).toBe('TestCorp')
      expect((await findCompanyById(c.id))?.name).toBe('TestCorp')
      const r1 = await findCompanies({ page: 1, pageSize: 10 })
      expect(r1.total).toBe(1)
      const r2 = await findCompanies({ page: 1, pageSize: 10, name: 'Test' })
      expect(r2.total).toBe(1)
      const r3 = await findCompanies({ page: 1, pageSize: 10, status: 0 })
      expect(r3.total).toBe(0) // 默认 status=1
    })

    it('updateCompany + deleteCompany', async () => {
      const c = await createCompany({ name: 'Upd', status: 1 })
      const updated = await updateCompany(c.id, { name: 'Upd2', status: 0 })
      expect(updated?.name).toBe('Upd2')
      expect(updated?.status).toBe(0)
      await deleteCompany(c.id)
      expect(await findCompanyById(c.id)).toBeUndefined()
    })
  })

  describe('部门 CRUD', () => {
    it('createDepartment + findDepartmentById + findDepartments(companyId/name 过滤)', async () => {
      const c = await createCompany({ name: 'DeptCorp' })
      const d = await createDepartment({ companyId: c.id, name: '研发部', sort: 1 })
      expect(d.name).toBe('研发部')
      expect((await findDepartmentById(d.id))?.name).toBe('研发部')
      const r1 = await findDepartments({ page: 1, pageSize: 10, companyId: c.id })
      expect(r1.total).toBe(1)
      const r2 = await findDepartments({ page: 1, pageSize: 10, name: '研发' })
      expect(r2.total).toBe(1)
      const r3 = await findDepartments({
        page: 1,
        pageSize: 10,
        companyId: '00000000-0000-0000-0000-000000000000',
      })
      expect(r3.total).toBe(0)
    })

    it('updateDepartment + deleteDepartment', async () => {
      const c = await createCompany({ name: 'DelCorp' })
      const d = await createDepartment({ companyId: c.id, name: 'Old' })
      const updated = await updateDepartment(d.id, { name: 'New', status: 0 })
      expect(updated?.name).toBe('New')
      expect(updated?.status).toBe(0)
      await deleteDepartment(d.id)
      expect(await findDepartmentById(d.id)).toBeUndefined()
    })
  })

  describe('系统用户(users 表)', () => {
    it('createSystemUser + findSystemUserById — 默认 roleId=0/status=1', async () => {
      const u = await createSystemUser({ username: 'admin1', nickname: 'Admin' })
      expect(u.username).toBe('admin1')
      expect(u.roleId).toBe(0) // 默认
      expect(u.status).toBe(1) // 默认
      expect((await findSystemUserById(u.id))?.username).toBe('admin1')
    })

    it('updateSystemUser — 部分字段更新', async () => {
      const u = await createSystemUser({ username: 'upd', nickname: 'Old' })
      const updated = await updateSystemUser(u.id, { nickname: 'New', roleId: 1 })
      expect(updated?.nickname).toBe('New')
      expect(updated?.roleId).toBe(1)
    })

    it('resetSystemUserPassword + deleteSystemUser', async () => {
      const u = await createSystemUser({ username: 'resetpw', passwordHash: 'old' })
      const r = await resetSystemUserPassword(u.id, 'newhash')
      expect(r?.passwordHash).toBe('newhash')
      await deleteSystemUser(u.id)
      expect(await findSystemUserById(u.id)).toBeUndefined()
    })
  })
})
