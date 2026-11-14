// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-034:会话保存无 CAS —— 同毫秒双写双双"成功",后写者把先写者的更新覆盖回旧快照。
 * F-035:update-check 缓存损坏后永久拒写 —— 修前 mergeWriteCache 只 warn + return。
 *
 * 本文件钉住三件事:
 *   ① 并发双写同一会话:至少一方被检出冲突(或双方更新都不丢);
 *   ② 缓存损坏后仍能写入成功,且下一次启动可读;
 *   ③ 原子写失败不留半截(tmp 不残留、目标保持旧内容)。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type * as FsModule from 'node:fs';
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边
import {
  SessionWriteConflictError,
  getSessionStatePath,
  loadSession,
  newSessionId,
  patchSession,
  saveSession,
  sessionContentToken,
} from '../src/sessions/state-store.js';
import type { SessionMessage, SessionState } from '../src/sessions/types.js';

/** rename 注入面:置为错误码即让本次 rename 失败(③ 用),未置时走真实实现。 */
type RenameFailGlobal = { __f034RenameFailCode?: string };

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof FsModule>();
  const renameSync = ((from: fs.PathLike, to: fs.PathLike) => {
    const code = (globalThis as RenameFailGlobal).__f034RenameFailCode;
    if (code) {
      const err = new Error(`${code}: simulated rename failure`) as NodeJS.ErrnoException;
      err.code = code;
      throw err;
    }
    return actual.renameSync(from, to);
  }) as typeof actual.renameSync;
  return { ...actual, renameSync };
});

let scratch = '';
const prevStateDir = process.env.IHUI_SESSION_STATE_DIR;
const prevPrune = process.env.IHUI_SESSION_PRUNE_DISABLED;
const prevHome = process.env.HOME;
const prevUserProfile = process.env.USERPROFILE;

function makeMessage(content: string): SessionMessage {
  return { role: 'user', content, timestamp: '2026-01-01T00:00:00.000Z' };
}

function makeSession(overrides: Partial<SessionState> = {}): SessionState {
  const now = new Date().toISOString();
  return {
    id: newSessionId(),
    sessionId: 'sess-' + Math.random().toString(36).slice(2),
    createdAt: now,
    updatedAt: now,
    model: 'm-1',
    messages: [],
    status: 'running',
    ...overrides,
  };
}

function setHome(home: string): void {
  process.env.HOME = home;
  process.env.USERPROFILE = home;
}

function tmpLeftovers(dir: string): string[] {
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((name) => name.includes('.tmp-')) : [];
}

beforeEach(() => {
  scratch = mkScratch('f-034-035-');
  process.env.IHUI_SESSION_STATE_DIR = scratch;
  process.env.IHUI_SESSION_PRUNE_DISABLED = '1';
  (globalThis as RenameFailGlobal).__f034RenameFailCode = undefined;
  vi.resetModules();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  (globalThis as RenameFailGlobal).__f034RenameFailCode = undefined;
  if (prevStateDir === undefined) delete process.env.IHUI_SESSION_STATE_DIR;
  else process.env.IHUI_SESSION_STATE_DIR = prevStateDir;
  if (prevPrune === undefined) delete process.env.IHUI_SESSION_PRUNE_DISABLED;
  else process.env.IHUI_SESSION_PRUNE_DISABLED = prevPrune;
  if (prevHome === undefined) delete process.env.HOME;
  else process.env.HOME = prevHome;
  if (prevUserProfile === undefined) delete process.env.USERPROFILE;
  else process.env.USERPROFILE = prevUserProfile;
  try {
    rmScratch(scratch);
  } catch {
    // 夹具清理失败不影响判定
  }
});

describe('F-034 会话保存 CAS', () => {
  it('同毫秒双写:内容令牌让后写者被检出冲突,先写者的列不被覆盖', () => {
    // 冻结在同一毫秒:updatedAt 令牌在这一档完全不可分辨(修前的已知 1ms 窗口)。
    vi.useFakeTimers({ now: new Date('2026-01-01T00:00:00.000Z') });
    const s = makeSession({ model: 'm-1', status: 'running' });
    saveSession(s);
    const token = sessionContentToken(s.id);
    expect(token).not.toBeNull();

    const first = patchSession(s.id, { status: 'completed' }, token);
    expect(first).not.toBeNull();
    expect(first!.updatedAt).toBe(s.updatedAt); // 同毫秒:钟值没变,旧令牌无法区分
    expect(sessionContentToken(s.id)).not.toBe(token); // 但内容令牌变了

    expect(patchSession(s.id, { model: 'm-2' }, token)).toBeNull(); // 旧令牌 ⇒ 冲突被检出

    const after = loadSession(s.id)!;
    expect(after.status).toBe('completed');
    expect(after.model).toBe('m-1');
  });

  it('saveSession 带基线:旧基线不成立 ⇒ 抛冲突且不覆盖先写者的消息', () => {
    vi.useFakeTimers({ now: new Date('2026-01-01T00:00:00.000Z') });
    const s = makeSession();
    saveSession(s);
    const snapshot = loadSession(s.id)!;
    const token = sessionContentToken(s.id)!;

    // 两个写者都基于同一份快照(同一毫秒)各追加一条消息
    saveSession({ ...snapshot, messages: [...snapshot.messages, makeMessage('A')] }, token);

    let caught: unknown = null;
    try {
      saveSession({ ...snapshot, messages: [...snapshot.messages, makeMessage('B')] }, token);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(SessionWriteConflictError);
    expect((caught as SessionWriteConflictError).code).toBe('session_write_conflict');

    // 修前:第二次写静默成功,A 被覆盖回旧快照(只有 B)。
    const after = loadSession(s.id)!;
    const contents = after.messages.map((m) => m.content);
    expect(contents).toContain('A');
    expect(contents).not.toContain('B');
  });

  it('无令牌的两笔 patch:各自声明的列都保留', () => {
    const s = makeSession({ model: 'm-1', status: 'running' });
    saveSession(s);
    expect(patchSession(s.id, { status: 'completed' })).not.toBeNull();
    expect(patchSession(s.id, { model: 'm-2' })).not.toBeNull();
    const after = loadSession(s.id)!;
    expect(after.status).toBe('completed');
    expect(after.model).toBe('m-2');
  });

  it('原子写失败不留半截:目标保持旧内容,且无 tmp 残留', () => {
    const s = makeSession();
    saveSession(s);
    const file = getSessionStatePath(s.id);
    const before = fs.readFileSync(file);

    (globalThis as RenameFailGlobal).__f034RenameFailCode = 'EIO';
    expect(() => saveSession({ ...s, status: 'failed' })).toThrow(/EIO/);

    expect(fs.readFileSync(file).equals(before)).toBe(true);
    expect(tmpLeftovers(path.dirname(file))).toEqual([]);
  });
});

describe('F-035 update-check 缓存', () => {
  const CACHE_REL = path.join('.ihui', '.update-check.json');

  function prepareHome(): { home: string; file: string; dir: string } {
    const home = scratch;
    setHome(home);
    const dir = path.join(home, '.ihui');
    fs.mkdirSync(dir, { recursive: true });
    return { home, file: path.join(home, CACHE_REL), dir };
  }

  function stubRegistry(latest: string): ReturnType<typeof vi.fn> {
    const fn = vi.fn(async () => ({
      ok: true,
      json: async () => ({ 'dist-tags': { latest } }),
    }));
    vi.stubGlobal('fetch', fn);
    return fn;
  }

  it('坏档隔离后仍写入成功,下一次启动可读', async () => {
    const { file, dir } = prepareHome();
    fs.writeFileSync(file, '{"checkedAt": 1,', 'utf-8');
    stubRegistry('9.9.9');
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const updater = await import('../src/updater.js');
    const result = await updater.checkForUpdates('ihui-cli', {
      forceRefresh: true,
      registryUrl: 'https://registry.example.invalid',
    });
    expect(result.latestVersion).toBe('9.9.9');

    // 坏档被隔离,正式缓存已重建为完整 JSON
    expect(fs.readdirSync(dir).filter((n) => n.includes('.corrupt-'))).toHaveLength(1);
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8')) as { latestVersion?: string };
    expect(parsed.latestVersion).toBe('9.9.9');
    expect(stderrSpy.mock.calls.flat().map(String).join('\n')).toContain('已隔离为');

    // 下一次启动:缓存可读 ⇒ 不再打 registry
    const fetchSpy = stubRegistry('1.0.0');
    const second = await updater.checkForUpdates('ihui-cli', {
      registryUrl: 'https://registry.example.invalid',
    });
    expect(second.latestVersion).toBe('9.9.9');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(tmpLeftovers(dir)).toEqual([]);
  });

  it('缓存原子写失败不留半截:坏档原字节保留、无 tmp、只留痕', async () => {
    const { file, dir } = prepareHome();
    const corrupt = '{"checkedAt": 1,';
    fs.writeFileSync(file, corrupt, 'utf-8');
    const before = fs.readFileSync(file);
    (globalThis as RenameFailGlobal).__f034RenameFailCode = 'EIO';
    stubRegistry('9.9.9');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const updater = await import('../src/updater.js');
    const result = await updater.checkForUpdates('ihui-cli', {
      forceRefresh: true,
      registryUrl: 'https://registry.example.invalid',
    });
    expect(result.latestVersion).toBe('9.9.9'); // 写失败不影响本次结论

    expect(fs.readFileSync(file).equals(before)).toBe(true);
    expect(tmpLeftovers(dir)).toEqual([]);
    expect(warnSpy.mock.calls.flat().map(String).join('\n')).toContain(file);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
