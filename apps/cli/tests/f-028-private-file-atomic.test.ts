// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-028 回归钉:凭据文件写入口 = 原子替换 + 新建即 0600 + chmod 兜底存量文件。
 *
 * 为什么全部用 mock 而不是真实落盘:
 *   - 本票要钉的是**调用契约**(谁被调、收到什么参数、失败是否被吞),不是文件系统语义;
 *   - Windows 没有 POSIX 权限位,真跑 chmod 观测不到 0600(会变成"看起来通过"的假绿);
 *   - chmod 抛 EPERM 的分支只有打桩才可复现,真机上恰恰是偶发。
 *
 * 生产模块是 `import * as fs from 'node:fs'` 的命名空间导入,`vi.spyOn` 打不进去,
 * 故按本仓既有写法(f-005-state-file-mode.test.ts)`vi.mock` 包一层并原样委托真实实现。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as AtomicWriteModule from '../src/util/atomic-write.js';
import type * as NodeFs from 'node:fs';

const h = vi.hoisted(() => ({
  writeFileAtomicSync: vi.fn(),
  chmodSync: vi.fn(),
}));

vi.mock('../src/util/atomic-write.js', async (importOriginal) => {
  const actual = await importOriginal<typeof AtomicWriteModule>();
  return { ...actual, writeFileAtomicSync: h.writeFileAtomicSync };
});

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof NodeFs>();
  return { ...actual, chmodSync: h.chmodSync, default: actual };
});

import { writePrivateFile } from '../src/lib/private-file.js';

const FILE = 'f-028-fixture/settings.json';
const TEXT = JSON.stringify({ apiKey: '中文与 emoji 🔐', nested: { n: 1 } }, null, 2) + '\n';

beforeEach(() => {
  h.writeFileAtomicSync.mockReset();
  h.chmodSync.mockReset();
});

describe('F-028 writePrivateFile 走原子写并钉 0600', () => {
  it('writeFileAtomicSync 恰好被调用一次,参数为 (filePath, text, { mode: 0o600 })', () => {
    writePrivateFile(FILE, TEXT);

    expect(h.writeFileAtomicSync).toHaveBeenCalledTimes(1);
    expect(h.writeFileAtomicSync.mock.calls[0]).toEqual([FILE, TEXT, { mode: 0o600 }]);
  });

  it('chmodSync 收到 (filePath, 0o600) —— 存量文件权限位的唯一纠偏点', () => {
    writePrivateFile(FILE, TEXT);

    expect(h.chmodSync).toHaveBeenCalledTimes(1);
    expect(h.chmodSync.mock.calls[0]).toEqual([FILE, 0o600]);
  });

  it('chmodSync 抛错(Windows 上的 EPERM)⇒ 调用方不抛,写入已完成即成功', () => {
    h.chmodSync.mockImplementation(() => {
      const err = new Error('EPERM: operation not permitted, chmod');
      Object.assign(err, { code: 'EPERM' });
      throw err;
    });

    expect(() => writePrivateFile(FILE, TEXT)).not.toThrow();
    expect(h.writeFileAtomicSync).toHaveBeenCalledTimes(1);
  });

  it('内容逐字透传:writeFileAtomicSync 收到的 text 与入参一致', () => {
    writePrivateFile(FILE, TEXT);

    const received = h.writeFileAtomicSync.mock.calls[0]?.[1];
    expect(received).toBe(TEXT);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
