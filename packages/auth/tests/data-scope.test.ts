// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import { DataScope, getDataScopeForRole, buildScopeFilter, canAccess } from '../src/data-scope'

describe('data-scope', () => {
  describe('getDataScopeForRole', () => {
    it('admin (roleId=1) → ALL', () => {
      expect(getDataScopeForRole(1)).toBe(DataScope.ALL)
    })

    it('manager (roleId=2) → ORGANIZATION', () => {
      expect(getDataScopeForRole(2)).toBe(DataScope.ORGANIZATION)
    })

    it('普通用户 (其他 roleId) → SELF', () => {
      expect(getDataScopeForRole(0)).toBe(DataScope.SELF)
      expect(getDataScopeForRole(99)).toBe(DataScope.SELF)
    })
  })

  describe('buildScopeFilter', () => {
    it('ALL: 仅返回 scope，无过滤字段', () => {
      const f = buildScopeFilter(DataScope.ALL, 'u1')
      expect(f.scope).toBe(DataScope.ALL)
      expect(f.userId).toBeUndefined()
      expect(f.familyId).toBeUndefined()
    })

    it('SELF: 回传 userId', () => {
      const f = buildScopeFilter(DataScope.SELF, 'u1')
      expect(f.scope).toBe(DataScope.SELF)
      expect(f.userId).toBe('u1')
    })

    it('FAMILY: 回传 familyId', () => {
      const f = buildScopeFilter(DataScope.FAMILY, 'u1', 'fam-1')
      expect(f.scope).toBe(DataScope.FAMILY)
      expect(f.familyId).toBe('fam-1')
    })

    it('NONE: 仅返回 scope（调用方应返回空结果集）', () => {
      const f = buildScopeFilter(DataScope.NONE, 'u1')
      expect(f.scope).toBe(DataScope.NONE)
    })
  })

  describe('canAccess', () => {
    it('ALL / ORGANIZATION / DEPARTMENT 始终放行', () => {
      expect(canAccess(DataScope.ALL, 'owner1', 'u1')).toBe(true)
      expect(canAccess(DataScope.ORGANIZATION, 'owner1', 'u1')).toBe(true)
      expect(canAccess(DataScope.DEPARTMENT, 'owner1', 'u1')).toBe(true)
    })

    it('SELF: 仅本人数据放行', () => {
      expect(canAccess(DataScope.SELF, 'u1', 'u1')).toBe(true)
      expect(canAccess(DataScope.SELF, 'owner1', 'u1')).toBe(false)
    })

    it('NONE: 始终拒绝', () => {
      expect(canAccess(DataScope.NONE, 'u1', 'u1')).toBe(false)
    })

    // 2026-11-07 DBG-25 回归锁: FAMILY 分支原实现两分支同值、currentFamilyId 形参被忽略,
    // family 级隔离从未生效。现两侧 familyId 齐备时做真判定,缺资源侧退化为本人兜底。
    it('FAMILY: 两侧 familyId 齐备时做真隔离判定', () => {
      // 同 family 的他人资源: family 成员可见
      expect(canAccess(DataScope.FAMILY, 'owner2', 'u1', 'fam-1', 'fam-1')).toBe(true)
      // 跨 family 资源: 拒绝(旧行为在此会错误放行 owner2==owner2? 否——旧行为按 ownerId 比,
      // u1≠owner2 拒绝;真正的缺陷是同 family 他人资源也被拒。此行锁新语义防回归。)
      expect(canAccess(DataScope.FAMILY, 'owner2', 'u1', 'fam-1', 'fam-2')).toBe(false)
    })

    it('FAMILY: 缺资源侧 familyId 时退化为本人兜底(保守不放行他人)', () => {
      expect(canAccess(DataScope.FAMILY, 'u1', 'u1', 'fam-1')).toBe(true)
      expect(canAccess(DataScope.FAMILY, 'owner2', 'u1', 'fam-1')).toBe(false)
      expect(canAccess(DataScope.FAMILY, 'u1', 'u1')).toBe(true)
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
