// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-005 回归钉:状态/凭据文件落盘的 POSIX 权限位。
 *
 * Windows 上 chmod 只映射只读位、`statSync().mode` 不反映 POSIX 权限 ⇒ 不赌平台行为,分两层钉:
 *   ① 可观测层:mode 是否真的被传给 `chmodSync`(Windows 上同样可观测,不是假绿);
 *   ② 结构层:状态写点是否真的传了 0o600 / 目录 0o700(读源码正则断言,容忍空白但不整段相等)。
 *
 * 生产模块是 `import * as fs from 'node:fs'` 的命名空间导入,`vi.spyOn` 打不进去,
 * 故用 `vi.mock` 包一层 node:fs,并把真实实现原样委托出去(Windows 上 chmod 无副作用)。
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileAtomicSync } from '../src/util/atomic-write.js';
import { saveSession } from '../src/sessions/state-store.js';
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof fs>();
  return { ...actual, chmodSync: vi.fn(actual.chmodSync), default: actual };
});

const HERE = path.dirname(fileURLToPath(import.meta.url));
const IS_WINDOWS = process.platform === 'win32';
// Windows:chmod 只映射只读位,且 existingMode() 恒返回 null ⇒ "目标已存在时沿用原 mode"这一分支
// 在 Windows 上根本无法被观测,显式 skip 并写明原因,绝不写成通过(不允许假绿)。
const itPosix = IS_WINDOWS ? it.skip : it;

const chmodSpy = fs.chmodSync as unknown as Mock;

let CWD = '';
beforeAll(() => {
  CWD = mkScratch('f-005-state-file-mode-');
});
afterAll(() => {
  try {
    rmScratch(CWD);
  } catch (err) {
    console.warn(`[f-005-state-file-mode] 夹具目录清理失败(忽略,不影响判定): ${String(err)}`);
  }
});
beforeEach(() => {
  chmodSpy.mockClear();
});

function chmodCall(i: number): [string, number] {
  return chmodSpy.mock.calls[i] as [string, number];
}

describe('F-005 ① 显式 mode 必须真的传给 chmodSync', () => {
  it('writeFileAtomicSync(..., { mode: 0o600 }) ⇒ chmodSync 收到 0o600,且内容落盘成功', () => {
    const target = path.join(CWD, 'explicit-0600.txt');
    writeFileAtomicSync(target, 'x', { mode: 0o600 });

    expect(chmodSpy).toHaveBeenCalledTimes(1);
    const [tmpArg, modeArg] = chmodCall(0);
    expect(modeArg).toBe(0o600);
    // chmod 打在 rename 之前的同目录 tmp 上(tmp 已被换走,只剩名字可断言)
    expect(path.basename(tmpArg)).toContain('.explicit-0600.txt.tmp-');
    expect(fs.readFileSync(target, 'utf-8')).toBe('x');
  });

  it('不传 mode 且目标不存在 ⇒ 不进 chmod 分支(默认 0o666;缺失目标在 POSIX 上 existingMode 同样为 null)', () => {
    const target = path.join(CWD, 'default-mode.txt');
    expect(fs.existsSync(target)).toBe(false);

    writeFileAtomicSync(target, 'x');

    expect(chmodSpy).not.toHaveBeenCalled();
    expect(fs.readFileSync(target, 'utf-8')).toBe('x');
  });

  itPosix('POSIX 专属:目标已存在时沿用原 mode(0o640),不硬编码回 0o666 [Windows 显式 skip:chmod/statSync mode 语义不同,该分支不可观测]', () => {
    const target = path.join(CWD, 'existing-0640.txt');
    fs.writeFileSync(target, 'old', 'utf-8');
    fs.chmodSync(target, 0o640); // 经委托的真实实现设置基线权限
    chmodSpy.mockClear();

    writeFileAtomicSync(target, 'new');

    expect(chmodSpy).toHaveBeenCalledTimes(1);
    expect(chmodCall(0)[1]).toBe(0o640);
    expect(fs.statSync(target).mode & 0o777).toBe(0o640);
    expect(fs.readFileSync(target, 'utf-8')).toBe('new');
  });

  it('saveSession 新建会话文件时 chmod 收到 0o600(状态写点的行为钉)', () => {
    const dir = path.join(CWD, 'state-store');
    const prevDir = process.env.IHUI_SESSION_STATE_DIR;
    const prevPrune = process.env.IHUI_SESSION_PRUNE_DISABLED;
    process.env.IHUI_SESSION_STATE_DIR = dir;
    process.env.IHUI_SESSION_PRUNE_DISABLED = '1';
    try {
      saveSession({
        id: 'f005-session',
        sessionId: 'f005-session',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        status: 'running',
        messages: [],
      });
    } finally {
      if (prevDir === undefined) delete process.env.IHUI_SESSION_STATE_DIR;
      else process.env.IHUI_SESSION_STATE_DIR = prevDir;
      if (prevPrune === undefined) delete process.env.IHUI_SESSION_PRUNE_DISABLED;
      else process.env.IHUI_SESSION_PRUNE_DISABLED = prevPrune;
    }

    expect(chmodSpy).toHaveBeenCalledTimes(1);
    expect(chmodCall(0)[1]).toBe(0o600);
    expect(fs.existsSync(path.join(dir, 'f005-session.json'))).toBe(true);
  });
});

describe('F-005 ② 结构钉:state-store 写点仍显式带权限参数', () => {
  const source = fs.readFileSync(path.join(HERE, '..', 'src', 'sessions', 'state-store.ts'), 'utf-8');

  it('会话状态文件写入仍传 { mode: 0o600 }', () => {
    expect(source, 'state-store.ts 的 writeFileAtomicSync 不再显式传 mode: 0o600').toMatch(
      /writeFileAtomicSync\s*\([^;]*?\{\s*mode\s*:\s*0o600\s*\}\s*\)/,
    );
  });

  it('状态目录创建仍传 { recursive: true, mode: 0o700 }', () => {
    expect(source, 'state-store.ts 的 mkdirSync 不再显式传 mode: 0o700').toMatch(
      /fs\.mkdirSync\s*\([^;]*?\{\s*recursive\s*:\s*true\s*,\s*mode\s*:\s*0o700\s*\}\s*\)/,
    );
  });
});
