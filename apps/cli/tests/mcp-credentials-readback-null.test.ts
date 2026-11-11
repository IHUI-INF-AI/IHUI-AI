// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { __test__ } from '../src/tools/mcp-credentials.js';
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边
import type * as ChildProcessModule from 'node:child_process';
import type * as FsModule from 'node:fs';

const h = vi.hoisted(() => ({ keyPath: '', keyReads: 0 }));

// 解密边界可注入:DPAPI 只经由 node:child_process 的 execFile,用一个"原样回显"的假子进程
// 就能让 protect/unprotect 往返恒成立,与真实引擎无关;这样「回读为 null」才是唯一变量。
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof ChildProcessModule>();
  const execFile = ((_engine: string, args: string[], _opts: unknown, cb: (err: Error | null, out?: string) => void) => {
    const payload = args[args.length - 1] ?? '';
    const child = {
      stdin: { end: (p: string) => void queueMicrotask(() => cb(null, p || payload)) },
      on: () => undefined,
      kill: () => undefined,
    };
    return child;
  }) as unknown as typeof actual.execFile;
  return { ...actual, execFile };
});

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof FsModule>();
  const readFile = (async (p: unknown, opts?: unknown) => {
    if (h.keyPath && String(p) === h.keyPath) {
      h.keyReads += 1;
      // 第 1 次是"有没有旧封套"⇒ ENOENT 走新建;第 2 次是"刚写下的那份"⇒ 读不到
      const code = h.keyReads === 1 ? 'ENOENT' : 'EIO';
      const err = new Error(`${code}: forced by fixture`) as NodeJS.ErrnoException;
      err.code = code;
      throw err;
    }
    return actual.promises.readFile(p as never, opts as never);
  }) as typeof actual.promises.readFile;
  return { ...actual, promises: { ...actual.promises, readFile } };
});

let scratch = '';
const prevHome = process.env.HOME;
const prevUserProfile = process.env.USERPROFILE;

// 真实(机器上原本的)主密钥路径:必须在 beforeEach 改 HOME/USERPROFILE 之前取样。
// 用途:证明本夹具的写盘只落在 mkScratch() 的 IHUI_HOME 里,没有污染本机 ~/.ihui。
// 不存在记 ABSENT(同样要求前后一致)。
const REAL_KEY_PATH = path.join(
  process.env.USERPROFILE || process.env.HOME || os.homedir(),
  '.ihui',
  'mcp-cred-master.dpapi'
);
const realKeyState = (): string => {
  try {
    return createHash('sha256').update(fs.readFileSync(REAL_KEY_PATH)).digest('hex');
  } catch {
    return 'ABSENT';
  }
};
const REAL_KEY_BEFORE = realKeyState();
const prevIhuiHome = process.env.IHUI_HOME;
const prevBackend = process.env.IHUI_MCP_CRED_BACKEND;
const platformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform');

beforeEach(() => {
  scratch = mkScratch('mcp-readback-null-');
  process.env.HOME = scratch;
  process.env.USERPROFILE = scratch;
  process.env.IHUI_HOME = scratch;
  delete process.env.IHUI_MCP_CRED_BACKEND;
  h.keyPath = path.join(scratch, 'mcp-cred-master.dpapi');
  h.keyReads = 0;
  // probeOsTier 在非 win32 上会在进入 DPAPI 之前返回 unavailable,先把平台钉成 win32
  Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
});

afterAll(() => {
  if (prevHome === undefined) delete process.env.HOME;
  else process.env.HOME = prevHome;
  if (prevUserProfile === undefined) delete process.env.USERPROFILE;
  else process.env.USERPROFILE = prevUserProfile;
  if (prevIhuiHome === undefined) delete process.env.IHUI_HOME;
  else process.env.IHUI_HOME = prevIhuiHome;
  if (prevBackend === undefined) delete process.env.IHUI_MCP_CRED_BACKEND;
  else process.env.IHUI_MCP_CRED_BACKEND = prevBackend;
  if (platformDescriptor) Object.defineProperty(process, 'platform', platformDescriptor);
  try {
    rmScratch(scratch);
  } catch (err) {
    console.warn(`[mcp-readback-null] 夹具目录清理失败(忽略,不影响判定): ${String(err)}`);
  }
});

describe('DBG-39 主密钥落盘后回读为 null', () => {
  it('走 ok:false(os-key-readback-mismatch),不把"读不到"当成读到空凭证', async () => {
    const attempt = await __test__.tryOsTier(false);

    expect(attempt.ok).toBe(false);
    expect(attempt.created).toBe(false);
    expect(attempt.material).toBeNull();
    expect(attempt.reasonCode).toBe('os-key-readback-mismatch');
    expect(String(attempt.detail)).toContain('回读写不到');
    expect(h.keyReads).toBe(2);
    // 主密钥文件确实被写下去了(否则测的不是回读分支)。
    // 注意:写的是 h.keyPath(= IHUI_HOME/mcp-cred-master.dpapi,IHUI_HOME 指向 mkScratch 目录),
    // 是真文件、但只落在临时目录;不是用户真实主密钥路径。
    expect(path.dirname(path.resolve(h.keyPath))).toBe(path.resolve(scratch));
    expect(fs.existsSync(h.keyPath)).toBe(true);
    // 反向钉死:真实 ~/.ihui/mcp-cred-master.dpapi 前后 sha256 一致(不存在则始终 ABSENT)。
    expect(realKeyState()).toBe(REAL_KEY_BEFORE);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
