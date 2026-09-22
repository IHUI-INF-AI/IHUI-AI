// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// cli 权限档 ↔ 服务端档位一致性(G-161 cli 归一,2026-09-22 重写)
//
// 本文件原来断言的是**折叠映射**:acceptEdits → auto、bypassPermissions → auto、
// manual → default。那张表把 cli 的 5 档压成服务端旧词表的 3 档,后果是
// "用户在全屏免批档,服务端按只读免批跑" —— 一次静默降档,而且被测试写成了期望。
// 现服务端已收规范档(唯一真源),映射必须是恒等;保留本测试就是为了让
// "cli 档 ≠ 线上档"再次出现时先在这里红。
import { describe, it, expect } from 'vitest';

import { PERMISSION_MODES } from '@ihui/types/permission-mode';

import {
  mapCliModeToBackendMode,
  parsePermissionMode,
  type PermissionMode,
} from '../src/tools/permissions.js';

describe('mapCliModeToBackendMode(G-161 后为恒等,不得再降档)', () => {
  it('五档逐一直映,没有任何一档被折叠', () => {
    for (const mode of PERMISSION_MODES) {
      expect(mapCliModeToBackendMode(mode)).toBe(mode);
    }
  });

  it('发出值域 ⊆ 唯一真源成员(不可能再把 auto 发上线)', () => {
    const sent = PERMISSION_MODES.map((m) => mapCliModeToBackendMode(m as PermissionMode));
    for (const value of sent) {
      expect(PERMISSION_MODES).toContain(value);
    }
    expect(sent).not.toContain('auto');
  });
});

describe('parsePermissionMode(注册表归一,不再只认 camelCase)', () => {
  it('规范档原样解析', () => {
    for (const mode of PERMISSION_MODES) {
      expect(parsePermissionMode(mode)).toBe(mode);
    }
  });

  it('web 的 kebab 拼写与历史/文档别名都认(此前写 accept-edits 会被判非法并静默回落 default)', () => {
    expect(parsePermissionMode('accept-edits')).toBe('acceptEdits');
    expect(parsePermissionMode('bypass-permissions')).toBe('bypassPermissions');
    expect(parsePermissionMode('auto')).toBe('acceptEdits');
    expect(parsePermissionMode('plan-only')).toBe('plan');
    expect(parsePermissionMode('read-only')).toBe('plan');
    expect(parsePermissionMode('accept-all')).toBe('bypassPermissions');
  });

  it('省略/空白/未知一律 undefined,由调用方决定是否回落', () => {
    expect(parsePermissionMode(undefined)).toBeUndefined();
    expect(parsePermissionMode('')).toBeUndefined();
    expect(parsePermissionMode('   ')).toBeUndefined();
    expect(parsePermissionMode('yolo-mode')).toBeUndefined();
    expect(parsePermissionMode('bypass-permission')).toBeUndefined();
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
