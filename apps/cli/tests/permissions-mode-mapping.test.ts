import { describe, it, expect } from 'vitest';
import { mapCliModeToBackendMode } from '../src/tools/permissions.js';

describe('mapCliModeToBackendMode(D3 权限模式对齐)', () => {
  it('default → default', () => {
    expect(mapCliModeToBackendMode('default')).toBe('default');
  });

  it('acceptEdits → auto(编辑放行,最近似后端 auto 档)', () => {
    expect(mapCliModeToBackendMode('acceptEdits')).toBe('auto');
  });

  it('bypassPermissions → auto(全免语义由 CLI 审批门特判补齐)', () => {
    expect(mapCliModeToBackendMode('bypassPermissions')).toBe('auto');
  });

  it('plan → plan(1:1)', () => {
    expect(mapCliModeToBackendMode('plan')).toBe('plan');
  });

  it('manual → default(CLI ask-everything 由本地矩阵保证,后端退化为 default)', () => {
    expect(mapCliModeToBackendMode('manual')).toBe('default');
  });
});
