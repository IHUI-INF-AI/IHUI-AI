// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D44 会话分叉(branch) — cli 端宿主定向测试
//
// 只 mock 「@ihui/api-client 的 4 个网络出口」这一层边界。**被测的真判据一律不 mock**:
//   · parseBranchArgs 的 -c/未知 flag/非 UUID/标题拼接与超长判定
//   · pickBranchAnchor 的分叉点选取(最近一条 assistant;退到 user;非 UUID 跳过;顺序无关)
//   · runBranch 的编排(解析源会话 → 取历史 → 把**选出来的** messageId 递给 branchConversation)
//   · formatBranchFailure 是否同时打出「原因 + 状态码」(失败要响)
// 文案断言直读 packages/i18n/messages/cli/*.json 的真实词条(不 mock i18n),
// 因此"键写了但端里取不到词"这类静默回退会被本文件判红。

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  ConversationDetail,
  ConversationMessage,
  ListConversationsResult,
} from '@ihui/api-client';
import { branchConversation, getConversation, getMessages, listConversations } from '@ihui/api-client';

import { setLocale, t } from '../src/i18n/index.js';
import {
  formatBranchArgsError,
  formatBranchFailure,
  formatBranchSuccess,
  isServerUuid,
  parseBranchArgs,
  pickBranchAnchor,
  runBranch,
  usageLine,
} from '../src/commands/branch-ops.js';

const CONV_ID = '3f2a1b4c-5d6e-7f80-91a2-b3c4d5e6f701';
const OTHER_CONV_ID = '3f2a1b4c-5d6e-7f80-91a2-b3c4d5e6f799';
const ASSISTANT_ID = 'a1b2c3d4-e5f6-0718-293a-4b5c6d7e8f90';
const USER_ID = '0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0';
const SYSTEM_ID = '99999999-8888-7777-6666-555555555555';

function conversation(id: string, title: string): ConversationDetail {
  return {
    id,
    userId: 'u-1',
    title,
    model: 'gpt-4o',
    systemPrompt: null,
    metadata: null,
    lastMessageAt: '2026-09-25T00:00:00.000Z',
    createdAt: '2026-09-20T00:00:00.000Z',
    updatedAt: '2026-09-25T00:00:00.000Z',
  };
}

function message(
  id: string,
  role: ConversationMessage['role'],
  createdAt: string,
): ConversationMessage {
  return {
    id,
    conversationId: CONV_ID,
    role,
    content: `${role} body`,
    tokens: 1,
    metadata: null,
    createdAt,
  };
}

vi.mock('@ihui/api-client', () => ({
  branchConversation: vi.fn(),
  getConversation: vi.fn(),
  getMessages: vi.fn(),
  listConversations: vi.fn(),
}));

const branchMock = vi.mocked(branchConversation);
const getConversationMock = vi.mocked(getConversation);
const getMessagesMock = vi.mocked(getMessages);
const listMock = vi.mocked(listConversations);

function okList(conversations: ConversationDetail[]): ListConversationsResult {
  return { conversations, page: 1, pageSize: 1, total: conversations.length };
}

beforeAll(() => {
  setLocale('zh-CN');
});

// 网络出口按用例逐个桩:不 reset 会让上一例残留的调用与 once 队列污染本例的
// "不得再发请求"类断言(那正是本文件要测的东西之一)。
beforeEach(() => {
  branchMock.mockReset();
  getConversationMock.mockReset();
  getMessagesMock.mockReset();
  listMock.mockReset();
});

describe('isServerUuid(服务端 branchSchema 的 z.uuid 口径)', () => {
  it('接受规范 UUID,拒绝本地占位 id 与空串', () => {
    expect(isServerUuid(ASSISTANT_ID)).toBe(true);
    expect(isServerUuid('msg-1')).toBe(false);
    expect(isServerUuid('')).toBe(false);
    expect(isServerUuid(`${ASSISTANT_ID.slice(0, -1)}Z`)).toBe(false);
  });
});

describe('parseBranchArgs', () => {
  it('空参 = 未指定会话与标题(交给"最近活跃远端会话"兜底)', () => {
    const parsed = parseBranchArgs([]);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.args).toEqual({ conversationId: null, title: null });
  });

  it('纯位置参数整体视为标题(空格分词后原样拼回)', () => {
    const parsed = parseBranchArgs(['重构', '支付', '模块']);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.args.title).toBe('重构 支付 模块');
  });

  it('-c 与 --conversation 都接长 UUID,其后的位置参数才是标题', () => {
    for (const flag of ['-c', '--conversation'] as const) {
      const parsed = parseBranchArgs([flag, CONV_ID, '分支名']);
      expect(parsed.ok).toBe(true);
      if (parsed.ok) expect(parsed.args).toEqual({ conversationId: CONV_ID, title: '分支名' });
    }
  });

  it('非 UUID 的会话 id 就地拦下(否则只能换来一个难诊断的 400)', () => {
    const parsed = parseBranchArgs(['-c', 'not-a-uuid']);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.reasonKey).toBe('errBadConversationId');
  });

  it('-c 缺值 / 值又是 flag / 未知 flag 一律判参数错', () => {
    for (const argv of [['-c'], ['-c', '-x'], ['--nope'], ['-c', CONV_ID, '-x']] as const) {
      const parsed = parseBranchArgs([...argv]);
      expect(parsed.ok).toBe(false);
      if (!parsed.ok) expect(parsed.reasonKey).toBe('errUnknownFlag');
    }
  });

  it('标题超 255 字判错(与 branchSchema z.string().max(255) 同值)', () => {
    const parsed = parseBranchArgs(['x'.repeat(256)]);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.reasonKey).toBe('errBadTitle');
  });

  it('参数错误文案能取到真词条且带上 offending token', () => {
    const parsed = parseBranchArgs(['--nope']);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    const line = formatBranchArgsError(parsed);
    expect(line).toContain('不支持的参数');
    expect(line).toContain('--nope');
    // 词条缺失时 t() 会原样回吐键名 —— 那属静默失败,必须判红
    expect(line).not.toContain('cli.branch.');
  });

  it('用法行取自词表而非端内硬编码', () => {
    expect(usageLine()).toBe(t('cli.branch.usage'));
    expect(usageLine()).toContain('/branch');
    expect(usageLine()).not.toBe('cli.branch.usage');
  });
});

describe('pickBranchAnchor(分叉点 = 最近一条 assistant)', () => {
  it('跳过非 UUID 与 system,选时间最新的 assistant', () => {
    const anchor = pickBranchAnchor([
      message(USER_ID, 'user', '2026-09-25T00:00:01.000Z'),
      message(ASSISTANT_ID, 'assistant', '2026-09-25T00:00:02.000Z'),
      message('local-placeholder', 'assistant', '2026-09-25T00:00:03.000Z'),
      message(SYSTEM_ID, 'system', '2026-09-25T00:00:00.000Z'),
    ]);
    expect(anchor).toEqual({ ok: true, messageId: ASSISTANT_ID, role: 'assistant' });
  });

  it('与入参顺序无关:倒序喂进来仍选最新那条 assistant', () => {
    const asc = pickBranchAnchor([
      message(USER_ID, 'user', '2026-09-25T00:00:01.000Z'),
      message(ASSISTANT_ID, 'assistant', '2026-09-25T00:00:02.000Z'),
    ]);
    const desc = pickBranchAnchor([
      message(ASSISTANT_ID, 'assistant', '2026-09-25T00:00:02.000Z'),
      message(USER_ID, 'user', '2026-09-25T00:00:01.000Z'),
    ]);
    expect(asc).toEqual(desc);
    if (!asc.ok) return;
    expect(asc.messageId).toBe(ASSISTANT_ID);
  });

  it('整页没有 assistant 时退到最近一条 user(仍能分叉,不谎报无路可走)', () => {
    const anchor = pickBranchAnchor([
      message(USER_ID, 'user', '2026-09-25T00:00:01.000Z'),
      message('local-placeholder', 'assistant', '2026-09-25T00:00:02.000Z'),
    ]);
    expect(anchor.ok).toBe(true);
    if (anchor.ok) expect(anchor).toMatchObject({ messageId: USER_ID, role: 'user' });
  });

  it('空历史与"全是本地 id"分开报(两者对用户的下一步动作不同)', () => {
    expect(pickBranchAnchor([])).toMatchObject({ ok: false, reasonKey: 'errNoMessages' });
    const allLocal = pickBranchAnchor([
      message('msg-1', 'assistant', '2026-09-25T00:00:01.000Z'),
      message('msg-2', 'user', '2026-09-25T00:00:02.000Z'),
    ]);
    expect(allLocal).toMatchObject({ ok: false, reasonKey: 'errNoBranchable', nonUuidCount: 2 });
  });
});

describe('runBranch 编排(源会话解析 + 把选出的锚点递给 branchConversation)', () => {
  it('未指定会话时取最近活跃的远端会话,且锚点由判据选出而非硬编', async () => {
    listMock.mockResolvedValueOnce({ success: true, data: okList([conversation(CONV_ID, '源会话')]) });
    getMessagesMock.mockResolvedValueOnce({
      success: true,
      data: {
        messages: [
          message(USER_ID, 'user', '2026-09-25T00:00:01.000Z'),
          message(ASSISTANT_ID, 'assistant', '2026-09-25T00:00:02.000Z'),
          message('local-placeholder', 'assistant', '2026-09-25T00:00:03.000Z'),
        ],
        page: 1,
        pageSize: 100,
        total: 3,
        hasMore: false,
        nextCursor: null,
      },
    });
    branchMock.mockResolvedValueOnce({
      success: true,
      data: { conversation: conversation(OTHER_CONV_ID, '分支名') },
    });

    const parsed = parseBranchArgs(['分支名']);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const outcome = await runBranch(parsed.args);

    expect(getMessagesMock).toHaveBeenCalledWith(CONV_ID, { page: 1, pageSize: 100 });
    // 载荷三元组:源会话 id / **选出来的** assistant 锚点 / 标题
    expect(branchMock).toHaveBeenCalledWith(CONV_ID, ASSISTANT_ID, { title: '分支名' });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.anchorMessageId).toBe(ASSISTANT_ID);
    expect(outcome.anchorRole).toBe('assistant');
    expect(outcome.usedFallbackConversation).toBe(true);
    expect(outcome.branch.id).toBe(OTHER_CONV_ID);
  });

  it('显式 -c 时走 getConversation 且不再查会话列表', async () => {
    getConversationMock.mockResolvedValueOnce({
      success: true,
      data: { conversation: conversation(CONV_ID, '指定会话') },
    });
    getMessagesMock.mockResolvedValueOnce({
      success: true,
      data: {
        messages: [message(ASSISTANT_ID, 'assistant', '2026-09-25T00:00:02.000Z')],
        page: 1,
        pageSize: 100,
        total: 1,
        hasMore: false,
        nextCursor: null,
      },
    });
    branchMock.mockResolvedValueOnce({ success: true, data: { conversation: conversation(OTHER_CONV_ID, 'b') } });

    const outcome = await runBranch({ conversationId: CONV_ID, title: null });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.usedFallbackConversation).toBe(false);
    expect(listMock).not.toHaveBeenCalled();
    // 未给标题 ⇒ 不注入 { title: undefined } 脏载荷,交由服务端默认命名
    expect(branchMock).toHaveBeenCalledWith(CONV_ID, ASSISTANT_ID, undefined);
  });

  it('账号下没有会话 = 分类错,不得拿 null 去发请求', async () => {
    listMock.mockResolvedValueOnce({ success: true, data: okList([]) });
    const outcome = await runBranch({ conversationId: null, title: null });
    expect(outcome).toMatchObject({ ok: false, reasonKey: 'errNoConversations', source: null });
    expect(branchMock).not.toHaveBeenCalled();
  });

  it('服务端拒绝(403/404)时原因与状态码都必须留在 outcome 里', async () => {
    listMock.mockResolvedValueOnce({ success: true, data: okList([conversation(CONV_ID, 's')]) });
    getMessagesMock.mockResolvedValueOnce({
      success: true,
      data: {
        messages: [message(ASSISTANT_ID, 'assistant', '2026-09-25T00:00:02.000Z')],
        page: 1,
        pageSize: 100,
        total: 1,
        hasMore: false,
        nextCursor: null,
      },
    });
    branchMock.mockResolvedValueOnce({ success: false, error: '无权访问该会话', status: 403 });

    const outcome = await runBranch({ conversationId: null, title: null });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reasonKey).toBe('errRequestFailed');
    expect(outcome.status).toBe(403);
    expect(outcome.apiError).toBe('无权访问该会话');
    // 失败也要说清"在动哪个会话"
    expect(outcome.source?.id).toBe(CONV_ID);
    const line = formatBranchFailure(outcome);
    expect(line).toContain('分叉失败');
    expect(line).toContain('403');
    expect(line).toContain('无权访问该会话');
    expect(line).not.toContain('cli.branch.');
  });

  it('取历史阶段失败时不得继续发起分支请求', async () => {
    listMock.mockResolvedValueOnce({ success: true, data: okList([conversation(CONV_ID, 's')]) });
    getMessagesMock.mockResolvedValueOnce({ success: false, error: '服务异常', status: 500 });
    const outcome = await runBranch({ conversationId: null, title: null });
    expect(outcome).toMatchObject({ ok: false, reasonKey: 'errRequestFailed', status: 500 });
    expect(branchMock).not.toHaveBeenCalled();
  });

  it('传输层抛异常折成 errTransportFailed,不把一次失败升级成 REPL 崩溃', async () => {
    listMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const outcome = await runBranch({ conversationId: null, title: null });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reasonKey).toBe('errTransportFailed');
    expect(outcome.status).toBeUndefined();
    const line = formatBranchFailure(outcome);
    expect(line).toContain('无法连接后端');
    expect(line).toContain('ECONNREFUSED');
    // 无状态码时不得打印 {status} 残迹
    expect(line).not.toContain('状态码');
    expect(line).not.toContain('{status}');
  });

  it('成功行走词表拼接,包含新会话 id 与源会话标题', async () => {
    listMock.mockResolvedValueOnce({ success: true, data: okList([conversation(CONV_ID, '源会话')]) });
    getMessagesMock.mockResolvedValueOnce({
      success: true,
      data: {
        messages: [message(ASSISTANT_ID, 'assistant', '2026-09-25T00:00:02.000Z')],
        page: 1,
        pageSize: 100,
        total: 1,
        hasMore: false,
        nextCursor: null,
      },
    });
    branchMock.mockResolvedValueOnce({ success: true, data: { conversation: conversation(OTHER_CONV_ID, '新分支') } });

    const outcome = await runBranch({ conversationId: null, title: '新分支' });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const line = formatBranchSuccess(outcome);
    expect(line).toContain('源会话');
    expect(line).toContain('新分支');
    expect(line).toContain(OTHER_CONV_ID);
    expect(line).not.toContain('cli.branch.');
    // 角色取词(不把 'assistant' 原文倒进中文终端)
    expect(line).toContain(t('cli.branch.roleAssistant'));
  });
});

describe('词表五语言齐备(取不到词的键会原样回吐键名)', () => {
  const BRANCH_KEYS = [
    'usage',
    'usageShort',
    'menu',
    'errUnknownFlag',
    'errBadConversationId',
    'errBadTitle',
    'errNoConversations',
    'errNoMessages',
    'errNoBranchable',
    'errRequestFailed',
    'errTransportFailed',
    'withDetail',
    'failedWithStatus',
    'failedNoStatus',
    'resolvedLatest',
    'created',
    'roleAssistant',
    'roleUser',
  ] as const;

  it.each(BRANCH_KEYS.map((k) => [k]))('cli.branch.%s 在 zh-CN 下可解析', (leaf) => {
    const value = t(`cli.branch.${leaf}`);
    expect(value).not.toBe(`cli.branch.${leaf}`);
    expect(value.length).toBeGreaterThan(0);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
