// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 主会话 Session 持久化测试 — save/load/list/delete/prune + 路径兼容 + 边界。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import {
  saveSession,
  loadSession,
  listSessions,
  deleteSession,
  pruneOldSessions,
  getSessionStateDir,
  getSessionStatePath,
  newSessionId,
  patchSession,
  type SessionState,
  type SessionMessage,
} from '../src/sessions/index.js';

let tmpStateDir: string;

beforeEach(() => {
  tmpStateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-sess-test-'));
  process.env.IHUI_SESSION_STATE_DIR = tmpStateDir;
});

afterEach(() => {
  delete process.env.IHUI_SESSION_STATE_DIR;
  if (tmpStateDir && fs.existsSync(tmpStateDir)) {
    fs.rmSync(tmpStateDir, { recursive: true, force: true });
  }
});

function makeMessage(role: SessionMessage['role'], content: string): SessionMessage {
  return { role, content, timestamp: new Date().toISOString() };
}

function makeSession(overrides: Partial<SessionState> = {}): SessionState {
  const now = new Date().toISOString();
  return {
    id: newSessionId(),
    sessionId: 'sess-' + Math.random().toString(36).slice(2),
    createdAt: now,
    updatedAt: now,
    model: 'test-model',
    messages: [],
    status: 'running',
    ...overrides,
  };
}

describe('saveSession + loadSession 往返一致性', () => {
  it('保存后加载应保持完全一致', () => {
    const s = makeSession({
      messages: [makeMessage('user', 'hello'), makeMessage('assistant', 'hi there')],
    });
    saveSession(s);
    const loaded = loadSession(s.id);
    expect(loaded).not.toBeNull();
    expect(loaded).toEqual(s);
  });

  it('toolState 与 cwd 字段保留', () => {
    const s = makeSession({
      toolState: { foo: 'bar', n: 42, nested: { a: 1 } },
      cwd: '/tmp/work/dir',
    });
    saveSession(s);
    const loaded = loadSession(s.id);
    expect(loaded!.toolState).toEqual({ foo: 'bar', n: 42, nested: { a: 1 } });
    expect(loaded!.cwd).toBe('/tmp/work/dir');
  });

  it('model 与 sessionId 保留', () => {
    const s = makeSession({ model: 'gpt-4o', sessionId: 'sess-xyz-123' });
    saveSession(s);
    const loaded = loadSession(s.id);
    expect(loaded!.model).toBe('gpt-4o');
    expect(loaded!.sessionId).toBe('sess-xyz-123');
  });
});

describe('loadSession 不存在', () => {
  it('返回 null', () => {
    expect(loadSession('nonexistent-id-12345')).toBeNull();
  });
});

describe('listSessions', () => {
  it('返回摘要且不含 messages 字段', () => {
    const s = makeSession({
      messages: [makeMessage('user', 'a'), makeMessage('assistant', 'b')],
    });
    saveSession(s);
    const list = listSessions();
    expect(list).toHaveLength(1);
    expect(list[0]!.id).toBe(s.id);
    expect(list[0]!.createdAt).toBe(s.createdAt);
    expect(list[0]!.updatedAt).toBe(s.updatedAt);
    expect(list[0]!.status).toBe(s.status);
    expect((list[0] as unknown as Record<string, unknown>).messages).toBeUndefined();
  });

  it('无目录时返回空数组', () => {
    process.env.IHUI_SESSION_STATE_DIR = path.join(os.tmpdir(), 'ihui-sess-empty-' + Date.now());
    expect(listSessions()).toEqual([]);
  });

  it('跳过非 .json 文件', () => {
    fs.writeFileSync(path.join(tmpStateDir, 'readme.txt'), 'ignore me');
    fs.writeFileSync(path.join(tmpStateDir, 'broken.json'), '{not valid');
    const s = makeSession();
    saveSession(s);
    const list = listSessions();
    expect(list).toHaveLength(1);
    expect(list[0]!.id).toBe(s.id);
  });

  it('多条 session 全部列出', () => {
    const a = makeSession();
    const b = makeSession();
    const c = makeSession();
    for (const s of [a, b, c]) saveSession(s);
    const list = listSessions();
    expect(list).toHaveLength(3);
    const ids = list.map((x) => x.id);
    expect(ids).toContain(a.id);
    expect(ids).toContain(b.id);
    expect(ids).toContain(c.id);
  });
});

describe('deleteSession', () => {
  it('已存在返回 true 且删除后加载为 null', () => {
    const s = makeSession();
    saveSession(s);
    expect(deleteSession(s.id)).toBe(true);
    expect(loadSession(s.id)).toBeNull();
  });

  it('不存在返回 false', () => {
    expect(deleteSession('nope-' + Date.now())).toBe(false);
  });

  it('删除一个不影响其他', () => {
    const a = makeSession();
    const b = makeSession();
    saveSession(a);
    saveSession(b);
    expect(deleteSession(a.id)).toBe(true);
    expect(loadSession(b.id)).not.toBeNull();
    expect(listSessions()).toHaveLength(1);
  });
});

describe('pruneOldSessions', () => {
  it('清理超龄 session,保留新的', () => {
    const oldTime = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const old = makeSession({ updatedAt: oldTime });
    saveSession(old);
    const recent = makeSession();
    saveSession(recent);
    const removed = pruneOldSessions(7 * 24 * 60 * 60 * 1000);
    expect(removed).toBe(1);
    expect(loadSession(old.id)).toBeNull();
    expect(loadSession(recent.id)).not.toBeNull();
  });

  it('无目录时返回 0', () => {
    process.env.IHUI_SESSION_STATE_DIR = path.join(os.tmpdir(), 'ihui-sess-none-' + Date.now());
    expect(pruneOldSessions(1000)).toBe(0);
  });

  it('默认 7 天清理(不传参)', () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const old = makeSession({ updatedAt: eightDaysAgo });
    saveSession(old);
    const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString();
    const recent = makeSession({ updatedAt: sixDaysAgo });
    saveSession(recent);
    const removed = pruneOldSessions();
    expect(removed).toBe(1);
    expect(loadSession(old.id)).toBeNull();
    expect(loadSession(recent.id)).not.toBeNull();
  });

  it('updatedAt 无效时跳过(不删除)', () => {
    const s = makeSession({ updatedAt: 'not-a-date' });
    saveSession(s);
    const removed = pruneOldSessions(1);
    expect(removed).toBe(0);
    expect(loadSession(s.id)).not.toBeNull();
  });
});

describe('Windows 路径兼容(USERPROFILE vs HOME)', () => {
  it('IHUI_SESSION_STATE_DIR 优先级最高', () => {
    process.env.IHUI_SESSION_STATE_DIR = '/custom/session/dir';
    expect(getSessionStateDir()).toBe('/custom/session/dir');
  });

  it('默认路径位于 os.homedir() 下', () => {
    delete process.env.IHUI_SESSION_STATE_DIR;
    const dir = getSessionStateDir();
    expect(dir).toContain('.ihui');
    expect(dir).toContain('sessions');
    expect(dir.startsWith(os.homedir())).toBe(true);
  });

  it.skipIf(process.platform !== 'win32')(
    'Windows 下 USERPROFILE 影响默认路径',
    () => {
      const original = process.env.USERPROFILE;
      try {
        process.env.USERPROFILE = 'X:\\fake-profile';
        delete process.env.IHUI_SESSION_STATE_DIR;
        const dir = getSessionStateDir();
        expect(dir.toLowerCase()).toContain('x:\\fake-profile'.toLowerCase());
      } finally {
        if (original === undefined) delete process.env.USERPROFILE;
        else process.env.USERPROFILE = original;
      }
    },
  );
});

describe('多 session 并发保存不冲突', () => {
  it('连续保存多个 session 互不覆盖', () => {
    const sessions = Array.from({ length: 5 }, () => makeSession());
    for (const s of sessions) saveSession(s);
    expect(listSessions()).toHaveLength(5);
    for (const s of sessions) {
      expect(loadSession(s.id)).toEqual(s);
    }
  });

  it('覆盖保存同 id 不产生多余文件', () => {
    const s = makeSession();
    saveSession(s);
    saveSession({ ...s, status: 'completed', updatedAt: new Date().toISOString() });
    expect(listSessions()).toHaveLength(1);
    expect(loadSession(s.id)!.status).toBe('completed');
  });

  it('交替保存/删除不串号', () => {
    const a = makeSession();
    const b = makeSession();
    saveSession(a);
    saveSession(b);
    deleteSession(a.id);
    saveSession(makeSession());
    expect(listSessions()).toHaveLength(2);
    expect(loadSession(b.id)).not.toBeNull();
  });
});

describe('messages 边界', () => {
  it('空 messages 数组往返一致', () => {
    const s = makeSession({ messages: [] });
    saveSession(s);
    const loaded = loadSession(s.id);
    expect(loaded!.messages).toEqual([]);
  });

  it('大 messages 数组(150 条)序列化/反序列化', () => {
    const messages: SessionMessage[] = Array.from({ length: 150 }, (_, i) =>
      makeMessage(i % 2 === 0 ? 'user' : 'assistant', `msg-${i}-内容-${i}`),
    );
    const s = makeSession({ messages });
    saveSession(s);
    const loaded = loadSession(s.id);
    expect(loaded!.messages).toHaveLength(150);
    expect(loaded!.messages[0]).toEqual(messages[0]);
    expect(loaded!.messages[149]).toEqual(messages[149]);
    expect(loaded!.messages[74]!.content).toBe('msg-74-内容-74');
  });

  it('含 tool 角色消息保留 toolName/toolCallId', () => {
    const s = makeSession({
      messages: [
        { role: 'tool', content: 'result', toolName: 'read_file', toolCallId: 'call-1' },
      ],
    });
    saveSession(s);
    const loaded = loadSession(s.id);
    expect(loaded!.messages[0]).toEqual({
      role: 'tool',
      content: 'result',
      toolName: 'read_file',
      toolCallId: 'call-1',
    });
  });
});

describe('status 枚举', () => {
  for (const status of ['running', 'completed', 'failed', 'cancelled'] as const) {
    it(`status=${status} 往返一致`, () => {
      const s = makeSession({ status });
      saveSession(s);
      expect(loadSession(s.id)!.status).toBe(status);
    });
  }
});

describe('损坏文件处理', () => {
  it('非 JSON 内容返回 null', () => {
    fs.writeFileSync(path.join(tmpStateDir, 'broken.json'), 'not json{');
    expect(loadSession('broken')).toBeNull();
  });

  it('JSON 数组(非 object)返回 null', () => {
    fs.writeFileSync(path.join(tmpStateDir, 'arr.json'), '[]');
    expect(loadSession('arr')).toBeNull();
  });

  it('缺 id 字段返回 null', () => {
    fs.writeFileSync(path.join(tmpStateDir, 'noid.json'), JSON.stringify({ createdAt: 'x' }));
    expect(loadSession('noid')).toBeNull();
  });

  it('listSessions 跳过损坏文件', () => {
    fs.writeFileSync(path.join(tmpStateDir, 'bad.json'), '!!!');
    const s = makeSession();
    saveSession(s);
    const list = listSessions();
    expect(list).toHaveLength(1);
    expect(list[0]!.id).toBe(s.id);
  });
});

describe('路径与 ID 工具', () => {
  it('getSessionStatePath 拼接 <id>.json', () => {
    process.env.IHUI_SESSION_STATE_DIR = '/abc';
    expect(getSessionStatePath('xyz')).toBe(path.join('/abc', 'xyz.json'));
  });

  it('newSessionId 返回唯一非空字符串', () => {
    const a = newSessionId();
    const b = newSessionId();
    expect(typeof a).toBe('string');
    expect(a.length).toBeGreaterThan(0);
    expect(a).not.toBe(b);
  });

  it('saveSession 自动创建嵌套目录', () => {
    const nested = path.join(tmpStateDir, 'nested', 'deep');
    process.env.IHUI_SESSION_STATE_DIR = nested;
    const s = makeSession();
    saveSession(s);
    expect(fs.existsSync(path.join(nested, `${s.id}.json`))).toBe(true);
    expect(loadSession(s.id)).toEqual(s);
  });
});

describe('patchSession — G-820(2026-10-07)列所有权 + 单调钟 + 乐观护栏', () => {
  it('只合并声明的列,未声明列纹丝不动(文件面验证)', () => {
    const s = makeSession({ model: 'm-1', cwd: '/work/a', status: 'running' });
    saveSession(s);
    const patched = patchSession(s.id, { status: 'failed' });
    expect(patched!.status).toBe('failed');
    expect(patched!.model).toBe('m-1');
    expect(patched!.cwd).toBe('/work/a');
    expect(patched!.messages).toEqual(s.messages);
    const loaded = loadSession(s.id)!;
    expect(loaded.status).toBe('failed');
    expect(loaded.model).toBe('m-1');
    expect(loaded.cwd).toBe('/work/a');
    expect(loaded.messages).toEqual(s.messages);
  });

  it('toolState 等未声明列原样保留(读侧水合不渗进写回路)', () => {
    const s = makeSession({ toolState: { 'k:raw': { v: 1 } } });
    saveSession(s);
    patchSession(s.id, { status: 'failed' });
    expect(loadSession(s.id)!.toolState).toEqual({ 'k:raw': { v: 1 } });
  });

  it('时钟单调:文件里更晚的钟不被 patch 压回;普通 patch 至少推进到 now', () => {
    const s = makeSession();
    saveSession(s);
    const future = new Date(Date.now() + 3_600_000).toISOString();
    saveSession({ ...s, updatedAt: future }); // 模拟并发另一方刚把钟推进
    const patched = patchSession(s.id, { status: 'completed' });
    expect(Date.parse(patched!.updatedAt)).toBeGreaterThanOrEqual(Date.parse(future));

    const s2 = makeSession();
    saveSession(s2);
    const before = Date.parse(loadSession(s2.id)!.updatedAt);
    const patched2 = patchSession(s2.id, { status: 'failed' });
    expect(Date.parse(patched2!.updatedAt)).toBeGreaterThanOrEqual(before);
  });

  it('expected 不匹配 ⇒ 拒写(返回 null),文件保持他人写入后的样子', () => {
    const s = makeSession();
    saveSession(s);
    const snap = loadSession(s.id)!;
    const future = new Date(Date.now() + 3_600_000).toISOString();
    saveSession({ ...snap, status: 'completed', updatedAt: future }); // 他人先写一步
    expect(patchSession(s.id, { status: 'failed' }, snap.updatedAt)).toBeNull();
    const after = loadSession(s.id)!;
    expect(after.status).toBe('completed');
    expect(after.updatedAt).toBe(future);
  });

  it('expected 匹配 ⇒ 正常写入', () => {
    const s = makeSession();
    saveSession(s);
    const expected = loadSession(s.id)!.updatedAt;
    expect(patchSession(s.id, { status: 'cancelled' }, expected)!.status).toBe('cancelled');
    expect(loadSession(s.id)!.status).toBe('cancelled');
  });

  it('目标会话不存在 ⇒ null 且不代建文件(建会话只归 saveSession)', () => {
    const ghost = 'no-such-session-' + Date.now();
    expect(patchSession(ghost, { status: 'failed' })).toBeNull();
    expect(fs.existsSync(getSessionStatePath(ghost))).toBe(false);
  });
});

describe('saveSession 兼容路径 — G-820(2026-10-07)单调钟', () => {
  it('旧快照整份覆写时,不得把并发已推进的钟压回(其余列仍以调用方为准)', () => {
    const s = makeSession({ status: 'running' });
    saveSession(s);
    const future = new Date(Date.now() + 3_600_000).toISOString();
    saveSession({ ...s, updatedAt: future }); // 并发方推进钟
    saveSession({ ...s, status: 'completed', updatedAt: s.updatedAt }); // 旧快照回写
    const loaded = loadSession(s.id)!;
    expect(Date.parse(loaded.updatedAt)).toBeGreaterThanOrEqual(Date.parse(future));
    expect(loaded.status).toBe('completed'); // 兼容语义:除钟外仍整份覆盖
  });

  it('新建会话(文件尚不存在)行为不变', () => {
    const s = makeSession({ updatedAt: '2026-01-01T00:00:00.000Z' });
    saveSession(s);
    expect(loadSession(s.id)).toEqual(s);
  });

  it('同钟重写幂等(≥ 语义,钟不抖动)', () => {
    const s = makeSession();
    saveSession(s);
    const clock = loadSession(s.id)!.updatedAt;
    saveSession({ ...s, updatedAt: clock });
    expect(loadSession(s.id)!.updatedAt).toBe(clock);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
