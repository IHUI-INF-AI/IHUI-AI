// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-130:分享产物(HTML/MD/JSON)含完整会话正文,不得按默认权限落盘,也不得非原子写。
 *
 * 判据分两层:
 *   ① 接线:每一次落盘都走 writeFileAtomicSync 且显式传 mode 0o600(跨平台可断言);
 *   ② 事实:POSIX 下目录 0700、文件 0600,已存在的 0755 目录被纠偏;落盘不留 tmp 半成品。
 * file:// 短链的对外形态不在本票射程(仍是本地路径),断言只锁"仍指向 hash8.html"。
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点,属测试面而非生产依赖边

/** 记录 share.ts 每次落盘的目标与 mode(生产实现仍由 actual 执行) */
const atomicCalls = vi.hoisted(() => [] as Array<{ file: string; mode: number | undefined }>);

vi.mock('../src/util/atomic-write.js', async (importOriginal) => {
  const actual = await importOriginal<typeof AtomicWriteModule>();
  return {
    ...actual,
    writeFileAtomicSync: (
      filePath: string,
      content: string,
      opts: { mode?: number } = {},
    ): void => {
      atomicCalls.push({ file: filePath, mode: opts.mode });
      actual.writeFileAtomicSync(filePath, content, opts);
    },
  };
});

import { ShareManager } from '../src/commands/share.js';
import type * as AtomicWriteModule from '../src/util/atomic-write.js';

const SESSION_ID = 'f130-share-perms';
const SECRET_LINE = 'F130 会话正文·只在分享产物里出现';
const POSIX_ONLY = process.platform === 'win32' ? it.skip : it;

let scratch = '';
let workspace = '';
let sessionsDir = '';
let prevSessionsDir: string | undefined;

beforeAll(() => {
  scratch = mkScratch('f130-share-');
  workspace = path.join(scratch, 'workspace');
  sessionsDir = path.join(scratch, 'sessions');
  fs.mkdirSync(workspace, { recursive: true });
  fs.mkdirSync(sessionsDir, { recursive: true });
  prevSessionsDir = process.env.IHUI_CLI_SESSIONS_DIR;
  process.env.IHUI_CLI_SESSIONS_DIR = sessionsDir;
  fs.writeFileSync(
    path.join(sessionsDir, `${SESSION_ID}.json`),
    JSON.stringify(
      {
        id: SESSION_ID,
        createdAt: '2026-11-05T00:00:00.000Z',
        updatedAt: '2026-11-05T00:00:00.000Z',
        workspacePath: workspace,
        modelId: 'qoder-test',
        history: [
          { role: 'system', content: '系统提示不应出现在分享产物' },
          { role: 'user', content: SECRET_LINE },
          { role: 'assistant', content: '已按 F-130 收口权限。' },
        ],
      },
      null,
      2,
    ),
    'utf-8',
  );
});

afterAll(() => {
  if (prevSessionsDir === undefined) delete process.env.IHUI_CLI_SESSIONS_DIR;
  else process.env.IHUI_CLI_SESSIONS_DIR = prevSessionsDir;
  rmScratch(scratch);
});

function sharedDir(): string {
  return path.join(workspace, '.ihui-agent', 'shared');
}

describe('F-130 分享产物落盘权限与原子性', () => {
  it('HTML/MD/JSON 全部走原子写且显式 0600,短链仍指 hash8.html', async () => {
    atomicCalls.length = 0;
    const mgr = new ShareManager(workspace);

    const mdResult = await mgr.share(SESSION_ID, { format: 'markdown' });
    const jsonResult = await mgr.share(SESSION_ID, { format: 'json' });
    expect(jsonResult.hash).toBe(mdResult.hash);

    const hash8 = mdResult.hash.slice(0, 8);
    const expected = [`${hash8}.html`, `${hash8}.md`, `${hash8}.json`];
    const written = new Set(atomicCalls.map((call) => path.basename(call.file)));

    for (const name of expected) expect(written.has(name), `应通过原子写落盘 ${name}`).toBe(true);
    expect(atomicCalls.every((call) => call.mode === 0o600)).toBe(true);
    // 附带产物(JSON 用例的 html)也在同一把尺子下
    expect(atomicCalls.length).toBeGreaterThanOrEqual(3);

    for (const name of expected) {
      const target = path.join(sharedDir(), name);
      expect(fs.existsSync(target)).toBe(true);
      expect(fs.readFileSync(target, 'utf-8')).toContain(SECRET_LINE);
    }
    expect(mdResult.url).toBe(`file://${path.join(sharedDir(), `${hash8}.html`).replace(/\\/g, '/')}`);
  });

  it('落盘不留 tmp 半成品', async () => {
    const leftovers = fs
      .readdirSync(sharedDir())
      .filter((name) => name.includes('.tmp-'));
    expect(leftovers).toEqual([]);
  });

  POSIX_ONLY('POSIX:目录 0700、文件 0600;已存在的 0755 目录被纠偏', async () => {
    const dir = sharedDir();
    fs.chmodSync(dir, 0o755);

    const result = await new ShareManager(workspace).share(SESSION_ID, { format: 'markdown' });
    const hash8 = result.hash.slice(0, 8);

    expect(fs.statSync(dir).mode & 0o777).toBe(0o700);
    expect(fs.statSync(path.join(dir, `${hash8}.html`)).mode & 0o777).toBe(0o600);
    expect(fs.statSync(path.join(dir, `${hash8}.md`)).mode & 0o777).toBe(0o600);
  });
});
