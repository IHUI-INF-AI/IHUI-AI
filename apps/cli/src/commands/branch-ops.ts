// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D44 会话分叉(branch) — cli(终端)端操作面
//
// 后端与客户端出口早已入库,本端只补宿主:
//   · 端点 apps/api/src/routes/chat.ts `POST /api/chat/conversations/:id/branch`
//     载荷 `{ messageId, title?, model? }`;messageId 必须是**服务端消息 UUID**(z.uuid 校验),
//     语义 = 以「该消息(含)之前」的内容创建新会话,旧会话原样保留。
//   · 客户端出口走 @ihui/api-client 的 branchConversation / getMessages / listConversations /
//     getConversation —— cli 不得自行拼 fetch(§4 守门 73)。
//
// 为什么不是"分叉本地 session":cli REPL 的 state.history 是**纯本地**会话
// (saveSession → ~/.ihui;全端零 conversationId 引用,可 grep 复测),服务端没有这份对话,
// 因此没有可传的 conversationId/messageId。本命令的"当前会话"取**账号内最近活跃的远端会话**
// (listConversations 首项),并在输出里点名解析到了哪个会话,绝不假装分叉了本地历史。
// 本地历史那一路已由既有 `/fork` 承载(repl.ts forkHistory),两者语义不重叠。

import {
  branchConversation,
  getConversation,
  getMessages,
  listConversations,
  type ConversationDetail,
  type ConversationMessage,
} from '@ihui/api-client';

import { t } from '../i18n/index.js';

/** 服务端 idParam / branchSchema 的 UUID 口径(uuid 列,非 UUID 必然 400) */
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** 一次取多少条历史来找分叉点(与 getMessages 单页上限同值) */
const ANCHOR_SCAN_PAGE_SIZE = 100;

/** 标题长度上限与 branchSchema 同值(z.string().max(255)) */
const TITLE_MAX_LEN = 255;

export function isServerUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** 失败分类键 —— 与 messages/cli/*.json 的 `cli.branch.<键>` 逐字同名(守门 74 词表可解析) */
export type BranchFailureKey =
  | 'errUnknownFlag'
  | 'errBadConversationId'
  | 'errBadTitle'
  | 'errNoConversations'
  | 'errNoMessages'
  | 'errNoBranchable'
  | 'errRequestFailed'
  | 'errTransportFailed';

export interface BranchArgs {
  readonly conversationId: string | null;
  readonly title: string | null;
}

export type BranchArgsParse =
  | { readonly ok: true; readonly args: BranchArgs }
  | { readonly ok: false; readonly reasonKey: BranchFailureKey; readonly detail?: string };

/**
 * `/branch [标题] | /branch -c <会话id> [标题]`
 *
 * 判据(全部可单测):
 *   · `-c`/`--conversation` 缺值、值又是 flag、未知 flag、标题超长 → ok:false + 分类键,
 *     绝不落脏状态;
 *   · 会话 id 必须是 UUID —— 服务端是 z.uuid,递个本地 id 过去只会换来一个难诊断的 400;
 *   · 标题为空等价未给:不注入 `{ title: '' }` 这种脏载荷,交服务端默认命名。
 */
export function parseBranchArgs(argv: readonly string[]): BranchArgsParse {
  let conversationId: string | null = null;
  const titleParts: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i] ?? '';
    if (token === '-c' || token === '--conversation') {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('-')) {
        return { ok: false, reasonKey: 'errUnknownFlag', detail: token };
      }
      if (!isServerUuid(value)) {
        return { ok: false, reasonKey: 'errBadConversationId', detail: value };
      }
      conversationId = value;
      i += 1;
      continue;
    }
    if (token.startsWith('-')) {
      return { ok: false, reasonKey: 'errUnknownFlag', detail: token };
    }
    titleParts.push(token);
  }

  const title = titleParts.join(' ').trim();
  if (title.length > TITLE_MAX_LEN) {
    return { ok: false, reasonKey: 'errBadTitle', detail: String(title.length) };
  }
  return { ok: true, args: { conversationId, title: title.length > 0 ? title : null } };
}

/** 参数行错误 → 终端一行(原因取自词表;detail 是用户自己打的 token 原文,不属翻译文案) */
export function formatBranchArgsError(fail: Extract<BranchArgsParse, { ok: false }>): string {
  const reason = t(`cli.branch.${fail.reasonKey}`);
  return fail.detail === undefined ? reason : t('cli.branch.withDetail', { reason, detail: fail.detail });
}

/** 用法行(空参与参数错误两处共用,单一词表来源) */
export function usageLine(): string {
  return t('cli.branch.usage');
}

/** 时间正序(同刻按 id 稳定兜底);不把"服务端页内顺序"当前提 */
function compareMessages(a: ConversationMessage, b: ConversationMessage): number {
  const ta = Date.parse(a.createdAt);
  const tb = Date.parse(b.createdAt);
  if (!Number.isNaN(ta) && !Number.isNaN(tb) && ta !== tb) return ta - tb;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

export type BranchAnchor =
  | { readonly ok: true; readonly messageId: string; readonly role: 'assistant' | 'user' }
  | {
      readonly ok: false;
      readonly reasonKey: 'errNoMessages' | 'errNoBranchable';
      readonly nonUuidCount: number;
    };

/**
 * 分叉点选取:最近一条 **assistant** 服务端消息;整页没有 assistant 时退到最近一条 user 消息
 * (仍能分叉,不因"只问未答"就无路可走)。
 *
 * 非 UUID 的 id 一律跳过 —— 服务端 branchSchema 是 `z.uuid()`,把本地占位 id 递过去
 * 只会换来一个 400,而"为什么 400"在终端里比"这里没有可用的服务端消息"更难诊断。
 */
export function pickBranchAnchor(messages: readonly ConversationMessage[]): BranchAnchor {
  if (messages.length === 0) return { ok: false, reasonKey: 'errNoMessages', nonUuidCount: 0 };
  const nonUuidCount = messages.filter((m) => !isServerUuid(m.id)).length;

  const ordered = [...messages].sort(compareMessages);
  let fallbackUserId: string | null = null;
  for (let i = ordered.length - 1; i >= 0; i--) {
    const message = ordered[i];
    if (!message || !isServerUuid(message.id)) continue;
    if (message.role === 'assistant') return { ok: true, messageId: message.id, role: 'assistant' };
    if (message.role === 'user' && fallbackUserId === null) fallbackUserId = message.id;
  }
  if (fallbackUserId !== null) return { ok: true, messageId: fallbackUserId, role: 'user' };
  return { ok: false, reasonKey: 'errNoBranchable', nonUuidCount };
}

export type BranchOutcome =
  | {
      readonly ok: true;
      readonly source: ConversationDetail;
      readonly branch: ConversationDetail;
      readonly anchorMessageId: string;
      readonly anchorRole: 'assistant' | 'user';
      /** true = 未显式指定会话,取了账号内最近活跃的远端会话 */
      readonly usedFallbackConversation: boolean;
    }
  | {
      readonly ok: false;
      readonly reasonKey: BranchFailureKey;
      /** 已解析到的源会话(未解析到则 null)—— 失败也要说清"在动谁" */
      readonly source: ConversationDetail | null;
      readonly apiError?: string;
      readonly status?: number;
    };

type BranchFailure = Extract<BranchOutcome, { ok: false }>;

/** 失败结果构造:status 缺失时**不写该键**(而非写 undefined),避免"有状态码"与"无状态码"两态被抹平 */
function fail(
  reasonKey: BranchFailureKey,
  source: ConversationDetail | null,
  apiError?: string,
  status?: number,
): BranchFailure {
  return {
    ok: false,
    reasonKey,
    source,
    ...(apiError === undefined ? {} : { apiError }),
    ...(status === undefined ? {} : { status }),
  };
}

function transportMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * 编排一次分叉:解析源会话 → 取历史找分叉点 → 调 branchConversation。
 *
 * 全程不抛异常:传输层异常折成 errTransportFailed 交给调用方打印 —— 失败要响,
 * 但不允许一次分叉失败把 REPL 打成崩溃。
 */
export async function runBranch(args: BranchArgs): Promise<BranchOutcome> {
  let source: ConversationDetail;
  try {
    if (args.conversationId !== null) {
      const res = await getConversation(args.conversationId);
      if (!res.success) return fail('errRequestFailed', null, res.error, res.status);
      source = res.data.conversation;
    } else {
      const res = await listConversations({ page: 1, pageSize: 1 });
      if (!res.success) return fail('errRequestFailed', null, res.error, res.status);
      const latest = res.data.conversations[0];
      if (!latest) return fail('errNoConversations', null);
      source = latest;
    }
  } catch (err) {
    return fail('errTransportFailed', null, transportMessage(err));
  }

  let anchor: BranchAnchor;
  try {
    const res = await getMessages(source.id, { page: 1, pageSize: ANCHOR_SCAN_PAGE_SIZE });
    if (!res.success) return fail('errRequestFailed', source, res.error, res.status);
    anchor = pickBranchAnchor(res.data.messages);
  } catch (err) {
    return fail('errTransportFailed', source, transportMessage(err));
  }

  if (!anchor.ok) {
    // 分类键本身已说明"没有可用的服务端消息 id"(词表里带该细节),不再混入计数噪音
    return fail(anchor.reasonKey, source);
  }

  try {
    const res = await branchConversation(
      source.id,
      anchor.messageId,
      args.title !== null ? { title: args.title } : undefined,
    );
    if (!res.success) return fail('errRequestFailed', source, res.error, res.status);
    return {
      ok: true,
      source,
      branch: res.data.conversation,
      anchorMessageId: anchor.messageId,
      anchorRole: anchor.role,
      usedFallbackConversation: args.conversationId === null,
    };
  } catch (err) {
    return fail('errTransportFailed', source, transportMessage(err));
  }
}

/**
 * 失败行文案的唯一出口(便于单测断言"原因 + 状态码都打出来了")。
 * 状态码缺失时不得打印 `{status}` 残迹 —— 传输层失败本就没有状态码。
 */
export function formatBranchFailure(outcome: BranchFailure): string {
  const reason = t(`cli.branch.${outcome.reasonKey}`);
  const detail = outcome.apiError && outcome.apiError.length > 0 ? ` — ${outcome.apiError}` : '';
  if (outcome.status !== undefined) {
    return t('cli.branch.failedWithStatus', { reason: reason + detail, status: outcome.status });
  }
  return t('cli.branch.failedNoStatus', { reason: reason + detail });
}

/** 成功行文案出口(与失败行同处一地,避免端内再抄一份拼接) */
export function formatBranchSuccess(outcome: Extract<BranchOutcome, { ok: true }>): string {
  return t('cli.branch.created', {
    sourceTitle: outcome.source.title,
    branchTitle: outcome.branch.title,
    branchId: outcome.branch.id,
    // 角色作为取词结果注入,不把 'assistant'/'user' 原文倒进终端(端内不自拼文案)
    anchor: t(outcome.anchorRole === 'assistant' ? 'cli.branch.roleAssistant' : 'cli.branch.roleUser'),
  });
}

/**
 * 源会话点名行:仅在走了"最近活跃远端会话"兜底时由调用方打印
 * (显式 `-c` 时用户已知动的是谁,再打一遍是噪音)。
 */
export function formatResolvedSource(outcome: Extract<BranchOutcome, { ok: true }>): string {
  return t('cli.branch.resolvedLatest', {
    sourceTitle: outcome.source.title,
    sourceId: outcome.source.id,
  });
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
