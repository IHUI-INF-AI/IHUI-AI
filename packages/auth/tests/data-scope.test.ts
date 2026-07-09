import { describe, it, expect } from 'vitest';
import {
  DataScope,
  getDataScopeForRole,
  buildScopeFilter,
  canAccess,
} from '../src/data-scope';

describe('data-scope', () => {
  describe('getDataScopeForRole', () => {
    it('admin (roleId=1) → ALL', () => {
      expect(getDataScopeForRole(1)).toBe(DataScope.ALL);
    });

    it('manager (roleId=2) → ORGANIZATION', () => {
      expect(getDataScopeForRole(2)).toBe(DataScope.ORGANIZATION);
    });

    it('普通用户 (其他 roleId) → SELF', () => {
      expect(getDataScopeForRole(0)).toBe(DataScope.SELF);
      expect(getDataScopeForRole(99)).toBe(DataScope.SELF);
    });
  });

  describe('buildScopeFilter', () => {
    it('ALL: 仅返回 scope，无过滤字段', () => {
      const f = buildScopeFilter(DataScope.ALL, 'u1');
      expect(f.scope).toBe(DataScope.ALL);
      expect(f.userId).toBeUndefined();
      expect(f.familyId).toBeUndefined();
    });

    it('SELF: 回传 userId', () => {
      const f = buildScopeFilter(DataScope.SELF, 'u1');
      expect(f.scope).toBe(DataScope.SELF);
      expect(f.userId).toBe('u1');
    });

    it('FAMILY: 回传 familyId', () => {
      const f = buildScopeFilter(DataScope.FAMILY, 'u1', 'fam-1');
      expect(f.scope).toBe(DataScope.FAMILY);
      expect(f.familyId).toBe('fam-1');
    });

    it('NONE: 仅返回 scope（调用方应返回空结果集）', () => {
      const f = buildScopeFilter(DataScope.NONE, 'u1');
      expect(f.scope).toBe(DataScope.NONE);
    });
  });

  describe('canAccess', () => {
    it('ALL / ORGANIZATION / DEPARTMENT 始终放行', () => {
      expect(canAccess(DataScope.ALL, 'owner1', 'u1')).toBe(true);
      expect(canAccess(DataScope.ORGANIZATION, 'owner1', 'u1')).toBe(true);
      expect(canAccess(DataScope.DEPARTMENT, 'owner1', 'u1')).toBe(true);
    });

    it('SELF: 仅本人数据放行', () => {
      expect(canAccess(DataScope.SELF, 'u1', 'u1')).toBe(true);
      expect(canAccess(DataScope.SELF, 'owner1', 'u1')).toBe(false);
    });

    it('NONE: 始终拒绝', () => {
      expect(canAccess(DataScope.NONE, 'u1', 'u1')).toBe(false);
    });
  });
});
