// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ihui import sessions 单测 — 外部会话导入 CLI 端(D28)。
 *
 * 网络调用一律经 vi.mock('@ihui/api-client') 拦截,不触真实后端。
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type {
  ConversationImportCommitPayload,
  ConversationImportCommitResult,
  ConversationImportHistoryResult,
  ConversationImportParseResult,
  ConversationImportSource,
} from '@ihui/api-client';
import type { ApiResult } from '@ihui/types';

type ParseFn = (
  file: File,
  source: ConversationImportSource,
) => Promise<ApiResult<ConversationImportParseResult>>;
type CommitFn = (
  payload: ConversationImportCommitPayload,
) => Promise<ApiResult<ConversationImportCommitResult>>;
type HistoryFn = () => Promise<ApiResult<ConversationImportHistoryResult>>;

const { parseMock, commitMock, historyMock } = vi.hoisted(() => ({
  parseMock: vi.fn<ParseFn>(),
  commitMock: vi.fn<CommitFn>(),
  historyMock: vi.fn<HistoryFn>(),
}));

vi.mock('@ihui/api-client', () => ({
  fetchApi: vi.fn(),
  parseConversationImport: parseMock,
  commitConversationImport: commitMock,
  getConversationImportHistory: historyMock,
}));

import {
  buildCommitPayload,
  checkUploadSize,
  discoverSessionCandidates,
  discoverSessionFiles,
  expandTilde,
  isSessionSource,
  parseOnlySpec,
  resolveExportFile,
  resolveSelection,
  runSessionsCommit,
  runSessionsDiscover,
  runSessionsHistory,
  runSessionsParse,
  runSessionsSources,
} from '../src/commands/import-sessions.js';

const ANSI = /\u001B\[[0-9;]*m/g;

interface ConsoleSpy {
  info: string[];
  error: string[];
}

function captureConsole(): ConsoleSpy {
  const spy: ConsoleSpy = { info: [], error: [] };
  vi.spyOn(console, 'info').mockImplementation((...args: unknown[]) => {
    spy.info.push(args.map((a) => String(a).replace(ANSI, '')).join(' '));
  });
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    spy.error.push(args.map((a) => String(a).replace(ANSI, '')).join(' '));
  });
  return spy;
}

const tmpRoot = await mkdtemp(path.join(os.tmpdir(), 'ihui-cli-sessions-'));

async function makeFixture(rel: string, content = '{}', mtime?: Date): Promise<string> {
  const abs = path.join(tmpRoot, rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, content, 'utf8');
  if (mtime) {
    const epoch = mtime.getTime() / 1000;
    await utimes(abs, epoch, epoch);
  }
  return abs;
}

function buildParseResult(
  conversations: ConversationImportParseResult['conversations'],
  extra?: { truncated?: boolean; warnings?: string[] },
): ApiResult<ConversationImportParseResult> {
  return {
    success: true,
    data: {
      conversations,
      truncated: extra?.truncated ?? false,
      warnings: extra?.warnings ?? [],
    },
  };
}

const okCommit = (n: number): ApiResult<ConversationImportCommitResult> => ({
  success: true,
  data: { importId: `imp-${n}`, conversationId: `conv-${n}`, importedMessages: n },
});

beforeEach(() => {
  vi.restoreAllMocks();
  parseMock.mockReset();
  commitMock.mockReset();
  historyMock.mockReset();
  // 非交互:多候选必须报错而不是挂起等输入
  process.stdin.isTTY = false;
});

afterAll(async () => {
  await rm(tmpRoot, { recursive: true, force: true });
});

describe('来源与参数解析', () => {
  it('isSessionSource 只认后端枚举的四个来源', () => {
    expect(isSessionSource('claude_code')).toBe(true);
    expect(isSessionSource('codex')).toBe(true);
    expect(isSessionSource('cursor')).toBe(true);
    expect(isSessionSource('aider')).toBe(true);
    expect(isSessionSource('claude-cli')).toBe(false);
    expect(isSessionSource('')).toBe(false);
  });

  it('expandTilde 用 os.homedir 展开,不依赖 shell', () => {
    expect(expandTilde('~')).toBe(os.homedir());
    expect(expandTilde(path.join('~', '.claude'))).toBe(path.join(os.homedir(), '.claude'));
    expect(expandTilde('/abs/path')).toBe('/abs/path');
  });

  it('parseOnlySpec 支持逗号与区间,去重升序', () => {
    expect(parseOnlySpec('3,1,2')).toEqual([1, 2, 3]);
    expect(parseOnlySpec('1,3-5')).toEqual([1, 3, 4, 5]);
    expect(parseOnlySpec('2-2')).toEqual([2]);
    expect(parseOnlySpec(' 4 , 2 ')).toEqual([2, 4]);
    expect(parseOnlySpec('2,2,3')).toEqual([2, 3]);
  });

  it('parseOnlySpec 拒绝非法输入', () => {
    expect(parseOnlySpec('')).toBeNull();
    expect(parseOnlySpec('0')).toBeNull();
    expect(parseOnlySpec('a')).toBeNull();
    expect(parseOnlySpec('5-2')).toBeNull();
    expect(parseOnlySpec('1-2000')).toBeNull();
    expect(parseOnlySpec('1,abc')).toBeNull();
    // 尾随/重复逗号是宽容处理,不算非法
    expect(parseOnlySpec('1,,')).toEqual([1]);
  });

  it('resolveSelection 要求显式 --all / --only', () => {
    expect(resolveSelection({}, 5)).toBeNull();
    expect(resolveSelection({ all: true }, 5)).toEqual({ all: true, indices: [] });
    expect(resolveSelection({ only: '2,4' }, 5)).toEqual({ all: false, indices: [2, 4] });
  });

  it('resolveSelection 剔除越界序号并告警', () => {
    const spy = captureConsole();
    expect(resolveSelection({ only: '2,7' }, 5)?.indices).toEqual([2]);
    expect(spy.error.join('\n')).toContain('序号超出范围: 7');
  });
});

describe('commit 请求体构建与上传预校验', () => {
  it('过滤空正文消息,截断 title/model,透传 createdAt', () => {
    const payload = buildCommitPayload(
      {
        title: `  ${'标'.repeat(300)}  `,
        model: 'm'.repeat(80),
        sourceCreatedAt: '2026-09-20T00:00:00.000Z',
        messages: [
          { role: 'user', content: '你好', createdAt: '2026-09-20T00:00:00.000Z' },
          { role: 'assistant', content: '   ' },
          { role: 'assistant', content: '在' },
        ],
      },
      'claude_code',
      'session.jsonl',
    );
    expect(payload).not.toBeNull();
    expect(payload?.source).toBe('claude_code');
    expect(payload?.fileName).toBe('session.jsonl');
    expect(payload?.title).toHaveLength(255);
    expect(payload?.model).toHaveLength(64);
    expect(payload?.createdAt).toBe('2026-09-20T00:00:00.000Z');
    expect(payload?.messages).toHaveLength(2);
    expect(payload?.messages[0]).toEqual({
      role: 'user',
      content: '你好',
      createdAt: '2026-09-20T00:00:00.000Z',
    });
  });

  it('缺 sourceCreatedAt 时回落 sourceUpdatedAt,空 title/model 不写入', () => {
    const payload = buildCommitPayload(
      { sourceUpdatedAt: '2026-09-21T00:00:00.000Z', messages: [{ role: 'user', content: 'hi' }] },
      'codex',
      'rollout.jsonl',
    );
    expect(payload?.createdAt).toBe('2026-09-21T00:00:00.000Z');
    expect(payload?.title).toBeUndefined();
    expect(payload?.model).toBeUndefined();
  });

  it('全空正文返回 null(该会话计失败但不抛异常)', () => {
    expect(buildCommitPayload({ messages: [{ role: 'user', content: '' }] }, 'aider', 'chat.md')).toBeNull();
  });

  it('checkUploadSize 20MB 上限', () => {
    expect(checkUploadSize(1024)).toBeNull();
    expect(checkUploadSize(20 * 1024 * 1024)).toBeNull();
    expect(checkUploadSize(20 * 1024 * 1024 + 1)?.slice(0, 4)).toBe('文件过大');
  });
});

describe('本地导出文件自动发现', () => {
  it('递归扫描后缀匹配文件,跳过 node_modules,按 mtime 倒序', async () => {
    const dir = path.join(tmpRoot, 'discover', 'projects');
    await makeFixture(path.join('discover', 'projects', 'old.jsonl'), '{}', new Date('2026-01-01'));
    await makeFixture(path.join('discover', 'projects', 'new.jsonl'), '{}', new Date('2026-09-09'));
    await makeFixture(
      path.join('discover', 'projects', 'deep', 'nested.jsonl'),
      '{}',
      new Date('2026-05-05'),
    );
    await makeFixture(path.join('discover', 'projects', 'node_modules', 'pkg.jsonl'));
    await makeFixture(path.join('discover', 'projects', 'notes.txt'));

    const found = await discoverSessionFiles('claude_code', dir, 20);
    expect(found.map((f) => path.basename(f))).toEqual(['new.jsonl', 'nested.jsonl', 'old.jsonl']);
    expect(found.every((f) => f.startsWith(dir))).toBe(true);

    const limited = await discoverSessionCandidates('claude_code', dir, 2);
    expect(limited).toHaveLength(2);
    expect(limited[0]?.mtimeMs).toBeGreaterThan(limited[1]?.mtimeMs ?? 0);
  });

  it('传入具体文件路径时直接命中,后缀不符则无候选', async () => {
    const hit = await makeFixture('discover/single/export.jsonl', '{"a":1}');
    expect(await discoverSessionFiles('codex', hit, 20)).toEqual([hit]);
    const miss = await makeFixture('discover/single/readme.txt');
    expect(await discoverSessionFiles('codex', miss, 20)).toEqual([]);
  });

  it('目录不存在时返回空数组(不抛异常)', async () => {
    expect(await discoverSessionFiles('cursor', path.join(tmpRoot, 'ghost'), 10)).toEqual([]);
  });
});

describe('文件定位与候选选择', () => {
  it('多候选 + 非交互:列清单后报错返回 null,不挂起', async () => {
    await makeFixture('multi/a.jsonl');
    await makeFixture('multi/b.jsonl');
    const spy = captureConsole();
    expect(await resolveExportFile('claude_code', path.join(tmpRoot, 'multi'))).toBeNull();
    const out = spy.error.join('\n');
    expect(out).toContain('非交互环境无法选择');
    expect(out).toContain('ihui import sessions parse <source> <文件路径>');
  });

  it('唯一候选时自动选中', async () => {
    const only = await makeFixture('only-one/only.jsonl');
    const spy = captureConsole();
    expect(await resolveExportFile('claude_code', path.join(tmpRoot, 'only-one'))).toBe(only);
    expect(spy.info.join('\n')).toContain('自动发现导出文件');
  });

  it('路径不存在时明确报错', async () => {
    const spy = captureConsole();
    expect(await resolveExportFile('claude_code', path.join(tmpRoot, 'nope.jsonl'))).toBeNull();
    expect(spy.error.join('\n')).toContain('路径不存在');
  });

  it('目录内无候选时提示已扫描目录与可接受后缀', async () => {
    const dir = path.join(tmpRoot, 'empty-dir');
    await mkdir(dir, { recursive: true });
    const spy = captureConsole();
    expect(await resolveExportFile('claude_code', dir)).toBeNull();
    const out = spy.error.join('\n');
    expect(out).toContain('未找到可导入的导出文件');
    expect(out).toContain('.jsonl');
  });
});

describe('sessions sources / discover', () => {
  it('sources 列出四个来源与各自可接受后缀', async () => {
    const spy = captureConsole();
    expect(await runSessionsSources()).toBe(true);
    const out = spy.info.join('\n');
    for (const s of ['claude_code', 'codex', 'cursor', 'aider']) expect(out).toContain(s);
    expect(out).toContain('.jsonl');
    expect(out).toContain('.vscdb');
    expect(out).toContain('.md');
    expect(out).toContain(path.join('.claude', 'projects'));
  });

  it('discover 指定来源时只扫该来源', async () => {
    await makeFixture('disc/x.jsonl');
    const spy = captureConsole();
    expect(await runSessionsDiscover('claude_code', { path: path.join(tmpRoot, 'disc') })).toBe(true);
    const out = spy.info.join('\n');
    expect(out).toContain('claude_code');
    expect(out).toContain('x.jsonl');
    expect(out).not.toContain('aider');
  });

  it('discover 非法来源直接失败且不发请求', async () => {
    const spy = captureConsole();
    expect(await runSessionsDiscover('not-a-source', { path: tmpRoot })).toBe(false);
    expect(spy.error.join('\n')).toContain('无效的会话来源: not-a-source');
    expect(parseMock).not.toHaveBeenCalled();
  });
});

describe('sessions parse', () => {
  it('非法来源:报错且不发请求', async () => {
    const spy = captureConsole();
    expect(await runSessionsParse('bogus', 'x.jsonl')).toBe(false);
    expect(spy.error.join('\n')).toContain('无效的会话来源');
    expect(parseMock).not.toHaveBeenCalled();
  });

  it('打印元信息但不泄露消息正文', async () => {
    const file = await makeFixture('parse/session.jsonl', '{"lines":[]}');
    parseMock.mockResolvedValueOnce(
      buildParseResult([
        {
          title: '重构登录页',
          model: 'claude-sonnet-4',
          sourceCreatedAt: '2026-09-18T10:00:00.000Z',
          messages: [
            { role: 'user', content: '这是不应出现在终端的正文内容' },
            { role: 'assistant', content: 'secret-body' },
          ],
        },
        { messages: [{ role: 'user', content: 'x' }] },
      ]),
    );
    const spy = captureConsole();
    expect(await runSessionsParse('claude_code', file)).toBe(true);

    expect(parseMock).toHaveBeenCalledTimes(1);
    const uploaded = parseMock.mock.calls[0]?.[0];
    expect(uploaded).toBeInstanceOf(File);
    expect(uploaded?.name).toBe('session.jsonl');
    expect(parseMock.mock.calls[0]?.[1]).toBe('claude_code');

    const out = spy.info.join('\n');
    expect(out).toContain('1. 重构登录页');
    expect(out).toContain('2 条消息');
    expect(out).toContain('claude-sonnet-4');
    expect(out).toContain('2. (无标题)');
    expect(out).not.toContain('secret-body');
    expect(out).not.toContain('不应出现在终端');
  });

  it('透传 truncated 与 warnings', async () => {
    const file = await makeFixture('parse/warn.jsonl');
    parseMock.mockResolvedValueOnce(
      buildParseResult([{ messages: [{ role: 'user', content: 'a' }] }], {
        truncated: true,
        warnings: ['第 2 条消息缺少时间戳'],
      }),
    );
    const spy = captureConsole();
    expect(await runSessionsParse('codex', file)).toBe(true);
    const out = spy.info.join('\n');
    expect(out).toContain('已截断');
    expect(out).toContain('第 2 条消息缺少时间戳');
  });

  it('后端解析失败时打印错误并返回 false', async () => {
    const file = await makeFixture('parse/bad.jsonl');
    parseMock.mockResolvedValueOnce({ success: false, error: 'unsupported format' });
    const spy = captureConsole();
    expect(await runSessionsParse('cursor', file)).toBe(false);
    expect(spy.error.join('\n')).toContain('解析失败: unsupported format');
  });

  it('未解析到会话时给出空态', async () => {
    const file = await makeFixture('parse/none.jsonl');
    parseMock.mockResolvedValueOnce(buildParseResult([]));
    const spy = captureConsole();
    expect(await runSessionsParse('aider', file)).toBe(true);
    expect(spy.info.join('\n')).toContain('未解析到任何会话');
  });
});

describe('sessions commit', () => {
  it('未指定 --all / --only 时拒绝执行', async () => {
    const spy = captureConsole();
    expect(await runSessionsCommit('claude_code', 'x.jsonl', {})).toBe(false);
    expect(spy.error.join('\n')).toContain('请显式指定导入范围');
    expect(parseMock).not.toHaveBeenCalled();
  });

  it('--only 格式非法时提前失败', async () => {
    const spy = captureConsole();
    expect(await runSessionsCommit('claude_code', 'x.jsonl', { only: 'a,b' })).toBe(false);
    expect(spy.error.join('\n')).toContain('无效的 --only 取值');
    expect(parseMock).not.toHaveBeenCalled();
  });

  it('--all 串行提交,单条失败不中断,末尾汇总', async () => {
    const file = await makeFixture('commit/mixed.jsonl');
    parseMock.mockResolvedValueOnce(
      buildParseResult([
        { title: 'A', messages: [{ role: 'user', content: 'a' }] },
        { title: 'B', messages: [{ role: 'user', content: '' }] },
        { title: 'C', messages: [{ role: 'user', content: 'c' }] },
      ]),
    );
    commitMock
      .mockResolvedValueOnce(okCommit(1))
      .mockResolvedValueOnce({ success: false, error: '模型不存在' });
    const spy = captureConsole();
    expect(await runSessionsCommit('claude_code', file, { all: true })).toBe(false);

    // 会话 2 正文为空 → 本地判定失败不发请求;会话 1/3 各发一次
    expect(commitMock).toHaveBeenCalledTimes(2);
    expect(commitMock.mock.calls[0]?.[0].title).toBe('A');
    expect(commitMock.mock.calls[1]?.[0].title).toBe('C');
    const out = spy.info.join('\n');
    expect(out).toContain('成功: 1');
    expect(out).toContain('失败: 2');
    expect(out).toContain('无有效消息内容');
    expect(out).toContain('#3 导入失败: 模型不存在');
  });

  it('--only 只提交指定序号', async () => {
    const file = await makeFixture('commit/pick.jsonl');
    parseMock.mockResolvedValueOnce(
      buildParseResult([
        { title: 'A', messages: [{ role: 'user', content: 'a' }] },
        { title: 'B', messages: [{ role: 'user', content: 'b' }] },
        { title: 'C', messages: [{ role: 'user', content: 'c' }] },
      ]),
    );
    commitMock.mockResolvedValue(okCommit(2));
    const spy = captureConsole();
    expect(await runSessionsCommit('codex', file, { only: '2' })).toBe(true);
    expect(commitMock).toHaveBeenCalledTimes(1);
    expect(commitMock.mock.calls[0]?.[0]).toMatchObject({
      source: 'codex',
      fileName: 'pick.jsonl',
      title: 'B',
    });
    expect(spy.info.join('\n')).toContain('成功: 1');
  });

  it('抛异常也计入失败并继续下一条', async () => {
    const file = await makeFixture('commit/throw.jsonl');
    parseMock.mockResolvedValueOnce(
      buildParseResult([
        { title: 'A', messages: [{ role: 'user', content: 'a' }] },
        { title: 'B', messages: [{ role: 'user', content: 'b' }] },
      ]),
    );
    commitMock.mockRejectedValueOnce(new Error('network-down')).mockResolvedValueOnce(okCommit(1));
    const spy = captureConsole();
    expect(await runSessionsCommit('aider', file, { all: true })).toBe(false);
    expect(commitMock).toHaveBeenCalledTimes(2);
    const out = spy.info.join('\n');
    expect(out).toContain('network-down');
    expect(out).toContain('成功: 1');
  });

  it('解析到 0 个会话时不发任何 commit', async () => {
    const file = await makeFixture('commit/empty.jsonl');
    parseMock.mockResolvedValueOnce(buildParseResult([]));
    const spy = captureConsole();
    expect(await runSessionsCommit('claude_code', file, { all: true })).toBe(false);
    expect(commitMock).not.toHaveBeenCalled();
    expect(spy.error.join('\n')).toContain('没有可导入的会话');
  });
});

describe('sessions history', () => {
  it('打印批次与状态', async () => {
    historyMock.mockResolvedValueOnce({
      success: true,
      data: {
        total: 42,
        list: [
          {
            id: 'i1',
            source: 'claude_code',
            conversationId: 'c1',
            fileName: 'a.jsonl',
            parsedCount: 3,
            importedCount: 3,
            failedCount: 0,
            status: 'success',
            errorMessage: null,
            importedAt: '2026-09-20T08:00:00.000Z',
          },
          {
            id: 'i2',
            source: 'codex',
            conversationId: 'c2',
            fileName: null,
            parsedCount: 2,
            importedCount: 1,
            failedCount: 1,
            status: 'partial',
            errorMessage: '模型不存在',
            importedAt: '2026-09-20T09:00:00.000Z',
          },
        ],
      },
    });
    const spy = captureConsole();
    expect(await runSessionsHistory()).toBe(true);
    const out = spy.info.join('\n');
    expect(out).toContain('claude_code [success]');
    expect(out).toContain('codex [partial]');
    expect(out).toContain('解析 3 · 成功 3 · 失败 0');
    expect(out).toContain('模型不存在');
    expect(out).toContain('共 42 条');
  });

  it('无记录时给出空态文案', async () => {
    historyMock.mockResolvedValueOnce({ success: true, data: { list: [], total: 0 } });
    const spy = captureConsole();
    expect(await runSessionsHistory()).toBe(true);
    expect(spy.info.join('\n')).toContain('暂无会话导入记录');
  });

  it('接口失败时返回 false', async () => {
    historyMock.mockResolvedValueOnce({ success: false, error: 'unauthorized' });
    const spy = captureConsole();
    expect(await runSessionsHistory()).toBe(false);
    expect(spy.error.join('\n')).toContain('unauthorized');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
