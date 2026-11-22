// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-031:会话读盘三态(ok / missing / corrupt)+ 列表点名与损坏件隔离。
 * 修前:JSON.parse 失败静默 return null ⇒ resume/列表把"文件损坏"说成"会话不存在"。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import {
  saveSession,
  loadSession,
  loadSessionForResume,
  listSessions,
  getSessionStateDir,
  getSessionStatePath,
  newSessionId,
  type SessionState,
} from '../src/sessions/index.js';

let tmpStateDir: string;

beforeEach(() => {
  tmpStateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-f031-'));
  process.env.IHUI_SESSION_STATE_DIR = tmpStateDir;
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.IHUI_SESSION_STATE_DIR;
  if (tmpStateDir && fs.existsSync(tmpStateDir)) {
    fs.rmSync(tmpStateDir, { recursive: true, force: true });
  }
});

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

function quarantineEntries(): string[] {
  return fs.readdirSync(tmpStateDir).filter((f) => /\.corrupt-\d+(?:-\d+)?\.json$/.test(f));
}

describe('F-031 损坏会话:resume 报"损坏"而非"不存在"', () => {
  it('截断 JSON ⇒ corrupt 三态带可诊断文案,loadSession 仍按旧契约返回 null', () => {
    const id = 'truncated-session';
    const file = getSessionStatePath(id);
    // 模拟写到一半被截断(原文件逐字节保留,用于隔离后比对)
    const body = Buffer.from(
      '{"id":"truncated-session","createdAt":"2026-11-12T00:00:00.000Z","messages":[{"role":"user","content":"hi"',
      'utf8',
    );
    fs.writeFileSync(file, body);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const resume = loadSessionForResume(id);
    expect(resume.kind).toBe('corrupt');
    if (resume.kind !== 'corrupt') throw new Error('expected corrupt');
    expect(resume.id).toBe(id);
    expect(resume.path).toBe(file);
    expect(resume.reason).toMatch(/JSON 解析失败/);
    expect(resume.message).toContain('损坏');
    expect(resume.message).not.toMatch(/没有这场会话/);

    // 兼容:旧入口返回值不变(损坏 ⇒ null),但必须留下 warn 证据
    expect(loadSession(id)).toBeNull();
    expect(warn.mock.calls.flat().join('\n')).toContain('truncated-session.json');
  });

  it('列表点名损坏文件并隔离为 .corrupt-<ts>.json,内容逐字节一致,正常会话不受影响', () => {
    const good = makeSession();
    saveSession(good);
    const goodFile = getSessionStatePath(good.id);
    const goodBytes = fs.readFileSync(goodFile);

    const badId = 'hand-edited';
    const badFile = getSessionStatePath(badId);
    const badBytes = Buffer.from('{ "id": "hand-edited", "messages": [ oops ] }', 'utf8');
    fs.writeFileSync(badFile, badBytes);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const list = listSessions();
    expect(list.map((s) => s.id)).toEqual([good.id]);

    const warned = warn.mock.calls.flat().join('\n');
    expect(warned).toContain('hand-edited.json');
    expect(warned).toContain('损坏');
    expect(warned).toContain('已隔离');

    // 原损坏件已改名,隔离件存在且与损坏前逐字节一致
    expect(fs.existsSync(badFile)).toBe(false);
    const quarantined = quarantineEntries();
    expect(quarantined).toHaveLength(1);
    expect(quarantined[0]).toMatch(/^hand-edited\.corrupt-\d+(?:-\d+)?\.json$/);
    const quarantinedBytes = fs.readFileSync(path.join(tmpStateDir, quarantined[0]!));
    expect(quarantinedBytes.equals(badBytes)).toBe(true);

    // 正常会话文件与内容均未被波及
    expect(fs.existsSync(goodFile)).toBe(true);
    expect(fs.readFileSync(goodFile).equals(goodBytes)).toBe(true);
    expect(loadSessionForResume(good.id).kind).toBe('ok');
  });

  it('重复列表不会二次隔离(.corrupt-* 不再被当成会话)', () => {
    fs.writeFileSync(getSessionStatePath('bad-again'), 'not json at all');
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(listSessions()).toEqual([]);
    const afterFirst = fs.readdirSync(tmpStateDir).sort();
    expect(quarantineEntries()).toHaveLength(1);

    expect(listSessions()).toEqual([]);
    expect(fs.readdirSync(tmpStateDir).sort()).toEqual(afterFirst);
  });

  it('合法 JSON 但结构不是会话(缺 id / 数组)同样算 corrupt', () => {
    fs.writeFileSync(getSessionStatePath('no-id'), JSON.stringify({ createdAt: 'x' }));
    fs.writeFileSync(getSessionStatePath('array-json'), '[]');

    expect(loadSessionForResume('no-id').kind).toBe('corrupt');
    expect(loadSessionForResume('array-json').kind).toBe('corrupt');
  });
});

describe('F-031 正常会话与不存在会话行为不变', () => {
  it('正常会话 ⇒ ok,可正常列出,不产生隔离件', () => {
    const s = makeSession({ status: 'completed' });
    saveSession(s);

    const resume = loadSessionForResume(s.id);
    expect(resume.kind).toBe('ok');
    if (resume.kind !== 'ok') throw new Error('expected ok');
    expect(resume.session.id).toBe(s.id);

    expect(loadSession(s.id)).toEqual(s);
    expect(listSessions().map((x) => x.id)).toEqual([s.id]);
    expect(quarantineEntries()).toEqual([]);
  });

  it('不存在会话 ⇒ missing(不报损坏),loadSession 仍为 null', () => {
    const resume = loadSessionForResume('no-such-session');
    expect(resume.kind).toBe('missing');
    if (resume.kind !== 'missing') throw new Error('expected missing');
    expect(resume.path).toBe(getSessionStatePath('no-such-session'));

    expect(loadSession('no-such-session')).toBeNull();
    expect(listSessions()).toEqual([]);
    expect(quarantineEntries()).toEqual([]);
    expect(fs.readdirSync(getSessionStateDir())).toEqual([]);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
