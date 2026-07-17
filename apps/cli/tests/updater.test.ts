/**
 * updater 单元测试 — 版本比较 / 缓存 / npm registry 检查 / minimum_version 警告。
 * 全程 mock fetch(不访问 npm registry),mock fs(隔离缓存与 package.json 读取)。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type * as fsType from 'node:fs';

const state = vi.hoisted(() => ({
  pkgContent: {
    version: '1.0.0',
    engines: { minimumVersion: '1.0.0' },
  } as { version: string; engines?: { minimumVersion?: string } },
  cacheExists: false,
  cacheContent: '',
}));

vi.mock('node:fs', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof fsType;
  return {
    ...actual,
    readFileSync: vi.fn((p: any, ...args: any[]) => {
      if (typeof p === 'string' && p.endsWith('package.json')) {
        return JSON.stringify(state.pkgContent);
      }
      if (typeof p === 'string' && p.endsWith('.update-check.json')) {
        return state.cacheContent;
      }
      return (actual.readFileSync as any)(p, ...args);
    }),
    existsSync: vi.fn((p: any) => {
      if (typeof p === 'string' && p.endsWith('.update-check.json')) {
        return state.cacheExists;
      }
      return (actual.existsSync as any)(p);
    }),
    writeFileSync: vi.fn(() => undefined),
    mkdirSync: vi.fn(() => undefined as any),
  };
});

import {
  compareVersions,
  getCurrentVersion,
  checkForUpdates,
  notifyUpdates,
} from '../src/updater.js';

describe('updater', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let fetchMock: ReturnType<typeof vi.fn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalEnv = { ...process.env };
    delete process.env.IHUI_NO_UPDATE_CHECK;
    delete process.env.IHUI_REGISTRY_URL;
    state.pkgContent = {
      version: '1.0.0',
      engines: { minimumVersion: '1.0.0' },
    };
    state.cacheExists = false;
    state.cacheContent = '';

    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
    vi.unstubAllGlobals();
    process.env = originalEnv;
  });

  describe('compareVersions', () => {
    it('基本比较:1.0.0 vs 2.0.0 → -1,反向 → 1,相等 → 0', () => {
      expect(compareVersions('1.0.0', '2.0.0')).toBe(-1);
      expect(compareVersions('2.0.0', '1.0.0')).toBe(1);
      expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    });

    it('patch 比较:1.0.0 vs 1.0.1 → -1', () => {
      expect(compareVersions('1.0.0', '1.0.1')).toBe(-1);
    });

    it('minor 比较:1.0.0 vs 1.1.0 → -1', () => {
      expect(compareVersions('1.0.0', '1.1.0')).toBe(-1);
    });

    it('三段以外忽略:1.0.0 vs 1.0.0-beta → 0', () => {
      expect(compareVersions('1.0.0', '1.0.0-beta')).toBe(0);
    });

    it('非法版本不抛异常,返回数值', () => {
      const r = compareVersions('invalid', '1.0.0');
      expect(r).toBe(-1);
    });
  });

  describe('getCurrentVersion', () => {
    it('返回 package.json 的 version 字段', () => {
      expect(getCurrentVersion()).toBe('1.0.0');
    });
  });

  describe('checkForUpdates', () => {
    it('有更新:registry latest=1.2.0 → hasUpdate=true, belowMinimum=false', async () => {
      state.cacheExists = false;
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 'dist-tags': { latest: '1.2.0' } }),
      });
      const r = await checkForUpdates();
      expect(r.hasUpdate).toBe(true);
      expect(r.latestVersion).toBe('1.2.0');
      expect(r.belowMinimum).toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('无更新:registry latest=1.0.0 → hasUpdate=false', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 'dist-tags': { latest: '1.0.0' } }),
      });
      const r = await checkForUpdates();
      expect(r.hasUpdate).toBe(false);
      expect(r.latestVersion).toBe('1.0.0');
    });

    it('缓存命中(24h 内)不 fetch,返回缓存结果', async () => {
      state.cacheExists = true;
      state.cacheContent = JSON.stringify({
        checkedAt: Date.now(),
        latestVersion: '1.5.0',
      });
      const r = await checkForUpdates();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(r.latestVersion).toBe('1.5.0');
      expect(r.hasUpdate).toBe(true);
    });

    it('缓存过期(>24h)重新 fetch', async () => {
      const expired = Date.now() - 25 * 60 * 60 * 1000;
      state.cacheExists = true;
      state.cacheContent = JSON.stringify({
        checkedAt: expired,
        latestVersion: '1.5.0',
      });
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 'dist-tags': { latest: '1.3.0' } }),
      });
      const r = await checkForUpdates();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(r.latestVersion).toBe('1.3.0');
      expect(r.hasUpdate).toBe(true);
    });

    it('fetch 失败返回 error 字段,hasUpdate=false', async () => {
      state.cacheExists = false;
      fetchMock.mockRejectedValueOnce(new Error('network error'));
      const r = await checkForUpdates();
      expect(r.hasUpdate).toBe(false);
      expect(r.error).toBeDefined();
      expect(r.error).toContain('network error');
    });

    it('minimum_version 警告:engines.minimumVersion=2.0.0 → belowMinimum=true', async () => {
      state.pkgContent = {
        version: '1.0.0',
        engines: { minimumVersion: '2.0.0' },
      };
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 'dist-tags': { latest: '1.0.0' } }),
      });
      const r = await checkForUpdates();
      expect(r.belowMinimum).toBe(true);
      expect(r.minimumVersion).toBe('2.0.0');
    });

    it('无 minimumVersion 字段 → belowMinimum=false', async () => {
      state.pkgContent = { version: '1.0.0', engines: {} };
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 'dist-tags': { latest: '1.0.0' } }),
      });
      const r = await checkForUpdates();
      expect(r.belowMinimum).toBe(false);
      expect(r.minimumVersion).toBeUndefined();
    });
  });

  describe('notifyUpdates', () => {
    it('IHUI_NO_UPDATE_CHECK=1 时跳过,不调用 checkForUpdates', async () => {
      process.env.IHUI_NO_UPDATE_CHECK = '1';
      notifyUpdates();
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));
      expect(warnSpy).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('有更新时输出 console.warn 含版本号', async () => {
      state.cacheExists = false;
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 'dist-tags': { latest: '2.0.0' } }),
      });
      notifyUpdates();
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));
      expect(warnSpy).toHaveBeenCalled();
      const callArg = String(warnSpy.mock.calls[0]?.[0] ?? '');
      expect(callArg).toContain('2.0.0');
      expect(callArg).toContain('1.0.0');
    });
  });
});
