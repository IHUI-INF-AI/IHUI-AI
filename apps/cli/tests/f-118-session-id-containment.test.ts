// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-118 回归锁:sessionId 未收敛,可读写任意 `.json`。
 *
 * 钉四件事:
 *   - `..` 逃逸 / 绝对路径 / 含 `/` 或 `\` 的 id,在 `share`、`--resume`、ACP `session/load`
 *     三个入口都**不给出会话**(报错点名 id,不静默回退到"最近一场"或 `default`);
 *   - 被载文件的 `id` 含 `..` 时,后续 `saveSession` 的落点仍在 sessions 目录内;
 *   - `.` / `..` 这类收敛后仍是特殊目录段的 id 直接拒绝;
 *   - 合法 id 的读写 / 分享 / ACP 载入不受影响。
 *
 * 判据唯一实现:`apps/cli/src/util/path-guard.ts`(经 `commands/session.ts:sessionFilePath` 收口)。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

// 夹具唯一落点(AGENTS §26):一律不写 os.tmpdir()。
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28

import {
  createSession,
  deleteSession,
  getSessionsDir,
  loadSession,
  saveSession,
  type Session,
} from '../src/commands/session.js';
import { ShareManager } from '../src/commands/share.js';
import { IhuiAcpAgent } from '../src/acp/server.js';
import { resolveSession } from '../src/index.js';

let rootDir: string;
let sessionsDir: string;
let workspaceDir: string;
let prevSessionsDir: string | undefined;

/** 目录外受害者:一个"任意可读 .json"的等价物(内容无聊,但能被读出来就是漏洞)。 */
function seedOutsideVictim(name = 'victim'): string {
  const file = path.join(rootDir, `${name}.json`);
  fs.writeFileSync(
    file,
    JSON.stringify({
      id: name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      workspacePath: rootDir,
      modelId: 'secret-model',
      history: [{ role: 'user', content: 'TOP-SECRET-OUTSIDE-CONTENT' }],
    }),
    'utf-8',
  );
  return file;
}

function makeSession(id: string): Session {
  const now = new Date().toISOString();
  return {
    id,
    createdAt: now,
    updatedAt: now,
    workspacePath: workspaceDir,
    modelId: 'test-model',
    history: [{ role: 'user', content: '正常内容' }],
  };
}

/** 所有落在 sessions 目录内的条目(递归一层即可:合法落点只应是单段文件)。 */
function sessionsDirEntries(): string[] {
  if (!fs.existsSync(sessionsDir)) return [];
  return fs.readdirSync(sessionsDir);
}

function expectNoEntryOutsideSessions(): void {
  // rootDir 是 sessionsDir 的父目录;目录外不得出现任何会话文件落点。
  const outside = fs
    .readdirSync(rootDir)
    .filter((f) => f.endsWith('.json') && f !== path.basename(sessionsDir));
  expect(outside).toEqual([]);
}

beforeEach(() => {
  rootDir = mkScratch('f118-root-');
  sessionsDir = path.join(rootDir, 'sessions');
  workspaceDir = path.join(rootDir, 'workspace');
  fs.mkdirSync(sessionsDir, { recursive: true });
  fs.mkdirSync(workspaceDir, { recursive: true });
  prevSessionsDir = process.env.IHUI_CLI_SESSIONS_DIR;
  process.env.IHUI_CLI_SESSIONS_DIR = sessionsDir;
});

afterEach(() => {
  if (prevSessionsDir === undefined) delete process.env.IHUI_CLI_SESSIONS_DIR;
  else process.env.IHUI_CLI_SESSIONS_DIR = prevSessionsDir;
  vi.restoreAllMocks();
  rmScratch(rootDir);
});

/** 三个入口统一的"坏 id"清单。 */
const BAD_IDS = [
  '../../../../secret',
  '../victim',
  '..',
  '/etc/passwd',
  'C:\\Windows\\evil',
  'a/b',
  'a\\b',
];

describe('命令层:读写落点不出 sessions 目录', () => {
  it('`..` 逃逸读不到目录外的同名 .json', () => {
    seedOutsideVictim('victim');
    expect(loadSession('../victim')).toBeNull();
    expect(loadSession('../../../../secret')).toBeNull();
  });

  it('绝对路径 id 读不到任意 .json', () => {
    const victim = seedOutsideVictim('abs-secret');
    expect(loadSession(victim)).toBeNull();
    expect(loadSession(victim.replace(/\.json$/, ''))).toBeNull();
  });

  it('`.` / `..` 收敛后仍是特殊目录段 ⇒ 直接拒绝(点名 id)', () => {
    expect(() => loadSession('..')).toThrow(/拒绝路径段/);
    expect(() => loadSession('.')).toThrow(/拒绝路径段/);
    expect(() => saveSession(makeSession('..'))).toThrow(/拒绝路径段/);
    expect(() => deleteSession('..')).toThrow(/拒绝路径段/);
  });

  it('被载文件 id 含 `..` 时,再保存不写目录外', () => {
    // 模拟"被篡改的存档":文件名合法,但文件里的 id 是穿越串。
    fs.writeFileSync(
      path.join(sessionsDir, 'tampered.json'),
      JSON.stringify({ ...makeSession('../../escaped'), id: '../../escaped' }),
      'utf-8',
    );
    const loaded = loadSession('tampered');
    expect(loaded?.id).toBe('../../escaped');

    saveSession(loaded!);

    expectNoEntryOutsideSessions();
    expect(fs.existsSync(path.join(path.dirname(rootDir), 'escaped.json'))).toBe(false);
    for (const entry of sessionsDirEntries()) {
      expect(path.resolve(sessionsDir, entry).startsWith(path.resolve(sessionsDir) + path.sep)).toBe(true);
    }
  });

  it('正常 id 读写删照常', () => {
    const s = createSession(workspaceDir, 'm');
    saveSession(s);
    expect(loadSession(s.id)?.id).toBe(s.id);
    expect(getSessionsDir()).toBe(sessionsDir);
    deleteSession(s.id);
    expect(loadSession(s.id)).toBeNull();
  });
});

describe('share 入口', () => {
  it.each(BAD_IDS.filter((id) => id !== '..' && id !== '.'))(
    'id %s 不出会话(报错点名 id)',
    async (bad) => {
      seedOutsideVictim('victim');
      const mgr = new ShareManager(workspaceDir);
      await expect(mgr.share(bad)).rejects.toThrow(/会话不存在|拒绝路径段/);
      // 目录外受害者没有被当成会话读出来:分享产物目录里不该有它的内容。
      const sharedDir = path.join(workspaceDir, '.ihui-agent', 'shared');
      const leaked = fs.existsSync(sharedDir)
        ? fs.readdirSync(sharedDir).some((f) => fs.readFileSync(path.join(sharedDir, f), 'utf-8').includes('TOP-SECRET-OUTSIDE-CONTENT'))
        : false;
      expect(leaked).toBe(false);
    },
  );

  it('`.`. / `..` 直接抛错', async () => {
    const mgr = new ShareManager(workspaceDir);
    await expect(mgr.share('..')).rejects.toThrow(/拒绝路径段/);
    await expect(mgr.share('.')).rejects.toThrow(/拒绝路径段/);
  });

  it('正常 id 照常生成分享', async () => {
    const s = createSession(workspaceDir, 'm');
    s.history = [{ role: 'user', content: '可分享内容' }];
    saveSession(s);
    const mgr = new ShareManager(workspaceDir);
    const result = await mgr.share(s.id);
    expect(result.markdown).toContain('可分享内容');
    expect(result.hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('--resume 入口(resolveSession)', () => {
  function runResume(id: string): { stderr: string[]; thrown: unknown } {
    const stderr: string[] = [];
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      stderr.push(args.map((a) => String(a)).join(' '));
    });
    // errorExit 的收尾是 process.exit(1):换成异常,便于断言"拒了"而不是"进程没了"。
    vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit(${code})`);
    }) as never);
    try {
      return { stderr, thrown: resolveSession({ resume: id }) };
    } catch (error) {
      return { stderr, thrown: error };
    }
  }

  it.each(BAD_IDS.filter((id) => id !== '.'))(
    'id %s 不出会话且报错点名',
    (bad) => {
      seedOutsideVictim('victim');
      const { stderr, thrown } = runResume(bad);
      expect(thrown).toBeInstanceOf(Error);
      // `.`/`..` 走路径段拒绝分支,其余走"未找到 <id>"(stderr 机械可读)。
      if (bad === '..') {
        expect(String((thrown as Error).message)).toContain('拒绝路径段');
      } else {
        expect(stderr.join('\n')).toContain(bad);
        expect(stderr.join('\n')).toContain('未找到');
      }
    },
  );

  it('正常 id 照常 resume', () => {
    const s = createSession(workspaceDir, 'm');
    s.history = [{ role: 'user', content: '恢复我' }];
    saveSession(s);
    const resolved = resolveSession({ resume: s.id });
    expect(resolved.sessionId).toBe(s.id);
    expect(resolved.history?.[0]?.content).toBe('恢复我');
  });
});

describe('ACP session/load 入口', () => {
  function makeAgent(): IhuiAcpAgent {
    return new IhuiAcpAgent({ apiUrl: 'http://127.0.0.1:1', apiKey: 'k', modelId: 'test-model' } as never);
  }

  function makeCx(): { notify: () => Promise<void> } {
    return { notify: async () => {} };
  }

  it.each(BAD_IDS)('id %s 拒绝载入(报错点名 id)', async (bad) => {
    seedOutsideVictim('victim');
    const agent = makeAgent();
    await expect(
      agent.loadSession({ sessionId: bad } as never, makeCx() as never),
    ).rejects.toThrow(/拒绝路径段|not found/);
    // 报错文案必须点名 id(除 `..` 走"拒绝路径段"分支外,其余都是 "Session <id> not found")。
    if (bad !== '..' && bad !== '.') {
      await expect(
        agent.loadSession({ sessionId: bad } as never, makeCx() as never),
      ).rejects.toThrow(bad);
    }
  });

  it('正常 id 照常载入并回放历史', async () => {
    const s = createSession(workspaceDir, 'm');
    s.history = [{ role: 'user', content: '回放我' }];
    saveSession(s);

    const notify = vi.fn(async () => {});
    const agent = makeAgent();
    await expect(
      agent.loadSession({ sessionId: s.id } as never, { notify } as never),
    ).resolves.toEqual({});
    expect(notify).toHaveBeenCalled();
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
