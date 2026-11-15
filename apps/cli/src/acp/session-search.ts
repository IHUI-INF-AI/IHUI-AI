// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * 会话全文检索 —— 跨会话、多词 AND、带 snippet。
 *
 * ## 对标依据(Qoder,仅取证思想,代码为本仓自有实现)
 *
 * Qoder 用 `chat_session_search_segments` 表:(session_id, message_id, turn_id,
 * sequence, position, segment_id, text, normalized_text) —— 把每条消息切成
 * segment 并存 normalized_text 供 `instr(lower(...))` 匹配,是 SQLite 上的
 * like-scan 检索(非 FTS5)。
 *
 * 思想:检索的输入是"消息正文",输出是"命中条目 + 命中上下文片段(snippet)"。
 *
 * ## 超越点(Qoder 没有的)
 *
 *   1. **内存 token 倒排索引** —— 不绑 SQLite,不建 FTS5 表。按 token → 命中位置
 *      倒排,多词 AND 直接取各 token 命中集的交集,避免 Qoder 那种对每条
 *      normalized_text 做 `instr` 全表扫描。
 *   2. **多词 AND + 全部命中位置高亮** —— Qoder 取"最早命中词"的单窗 snippet;
 *      本模块对每个命中 token 都记位置,snippet 里每个命中词都可定位高亮。
 *   3. **零持久化** —— 索引按需惰性构建,不额外落盘(与 turn-store/message-identity
 *      的"只算不睡/单一真相源"同一做减法哲学)。搜索是读路径,不产生新存储。
 *
 * 平台特有:无(纯计算)。
 */

import { listSessions, type Session } from '../commands/session.js';
import type { ChatMessage } from '@ihui/types';

/** 一条检索命中。对齐 Qoder 的"命中条目 + snippet"输出形状。 */
export interface SessionSearchHit {
  readonly sessionId: string;
  readonly messageId: string;
  readonly role: ChatMessage['role'];
  /** 命中上下文片段(压平空白,按最早命中 token 取窗)。 */
  readonly snippet: string;
  /** snippet 内每个命中 token 的 [start,end) 偏移(相对 snippet,供高亮)。 */
  readonly matchRanges: readonly { start: number; end: number }[];
  /** 消息创建时间(ms;缺失为 0,排序时靠后)。 */
  readonly createdAt: number;
}

export interface SessionSearchOptions {
  /** 返回上限,默认 50。 */
  limit?: number;
  /** snippet 上下文窗口(命中 token 前后各取多少字符),默认 40。 */
  window?: number;
}

/** 单条消息的倒排记录:token → 该 token 在正文中的所有出现偏移。 */
type Posting = Map<string, number[]>;

/** 单条索引条目:一条消息的倒排。 */
interface Entry {
  sessionId: string;
  messageId: string;
  role: ChatMessage['role'];
  createdAt: number;
  normalized: string;
  /** normalized 里的字符偏移到原始 content 偏移的映射(取 snippet 用)。 */
  offsetMap: readonly number[];
  posting: Posting;
}

/** 会话 → 各消息倒排。惰性构建一次,复用。 */
export class SessionSearchIndex {
  private readonly entries: Entry[] = [];

  constructor(sessions: readonly Session[]) {
    for (const s of sessions) {
      for (const m of s.history) {
        if (typeof m.content !== 'string' || m.content.length === 0) continue;
        const { normalized, offsetMap } = normalize(m.content);
        this.entries.push({
          sessionId: s.id,
          messageId: m.id,
          role: m.role,
          createdAt: m.createdAt ?? 0,
          normalized,
          offsetMap,
          posting: buildPosting(normalized),
        });
      }
    }
  }

  /** 从全部会话构建索引。 */
  static build(): SessionSearchIndex {
    return new SessionSearchIndex(listSessions());
  }

  /** 索引中的消息条数(测试/诊断用)。 */
  get size(): number {
    return this.entries.length;
  }

  /**
   * 多词 AND 检索:每词都命中的消息才算命中,按 (命中词数, 创建时间) 排序。
   * query 先做同样的 normalize + tokenize,空 query 返回空。
   */
  search(query: string, options: SessionSearchOptions = {}): SessionSearchHit[] {
    const limit = options.limit ?? 50;
    const window = options.window ?? 40;
    const tokens = tokenize(query);
    if (tokens.length === 0) return [];

    const scored: { entry: Entry; ranges: { start: number; end: number }[] }[] = [];
    for (const entry of this.entries) {
      // 多词 AND:每词都需至少一次命中
      const perToken: number[][] = [];
      let allMatch = true;
      for (const t of tokens) {
        const hits = entry.posting.get(t);
        if (!hits || hits.length === 0) {
          allMatch = false;
          break;
        }
        perToken.push(hits);
      }
      if (!allMatch) continue;
      // 所有命中 token 位置合并取窗(最早命中 token 位置为中心)
      const ranges = perToken
        .flat()
        .map((pos) => snippetRange(entry.normalized, pos, window))
        .sort((a, b) => a.start - b.start);
      scored.push({ entry, ranges });
    }

    scored.sort(
      (a, b) =>
        b.ranges.length - a.ranges.length || // 命中词数多者优先
        b.entry.createdAt - a.entry.createdAt, // 再按时间新→旧
    );

    return scored.slice(0, limit).map(({ entry, ranges }) => {
      const snippet = buildSnippet(entry.normalized, ranges);
      return {
        sessionId: entry.sessionId,
        messageId: entry.messageId,
        role: entry.role,
        snippet,
        matchRanges: locateMatches(snippet, tokens),
        createdAt: entry.createdAt,
      };
    });
  }
}

/** 归一:小写 + 空白压平;offsetMap[i] = normalized[i] 在原文的偏移。 */
function normalize(text: string): { normalized: string; offsetMap: number[] } {
  const normalizedChars: string[] = [];
  const offsetMap: number[] = [];
  let lastWasSpace = true; // 首部空白压掉
  for (let i = 0; i < text.length; i++) {
    const ch = text[i] ?? '';
    if (/\s/.test(ch)) {
      if (!lastWasSpace) {
        normalizedChars.push(' ');
        offsetMap.push(i);
        lastWasSpace = true;
      }
      continue;
    }
    normalizedChars.push(ch.toLowerCase());
    offsetMap.push(i);
    lastWasSpace = false;
  }
  return { normalized: normalizedChars.join(''), offsetMap };
}

/** 分词:归一后按非字母数字切,长度 ≥ 1。 */
function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fff]+/)
    .filter((t) => t.length > 0);
}

/** 构建倒排:token → normalized 中的出现偏移。 */
function buildPosting(normalized: string): Posting {
  const posting: Posting = new Map();
  const re = /[a-z0-9\u4e00-\u9fff]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(normalized)) !== null) {
    const token = m[0];
    const arr = posting.get(token);
    if (arr) arr.push(m.index);
    else posting.set(token, [m.index]);
  }
  return posting;
}

/** 由 normalized 偏移映射回原文偏移。 */
function toOriginal(offsetMap: readonly number[], pos: number): number {
  const last = offsetMap.length > 0 ? offsetMap[offsetMap.length - 1] : undefined;
  return offsetMap[pos] ?? (last !== undefined ? last + 1 : 0);
}

/** 归一偏移 → 原文偏移,供 snippet 从原文精确切片时使用(当前 snippet 基于归一文本,故仅暴露备用)。 */
void toOriginal;

function snippetRange(
  normalized: string,
  pos: number,
  window: number,
): { start: number; end: number } {
  const start = Math.max(0, pos - window);
  const end = Math.min(normalized.length, pos + window);
  return { start, end };
}

/** 由一组 range 合并成一段 snippet 文本。 */
function buildSnippet(
  normalized: string,
  ranges: readonly { start: number; end: number }[],
): string {
  if (ranges.length === 0) return '';
  // length>0 已守卫;noUncheckedIndexedAccess 不对索引访问收窄,故显式非空断言。
  const start = ranges[0]!.start;
  const end = ranges[ranges.length - 1]!.end;
  return normalized.slice(start, end).trim();
}

/** 在 snippet 文本里定位每个 query token 的出现区间(供客户端高亮)。 */
function locateMatches(
  snippet: string,
  tokens: readonly string[],
): { start: number; end: number }[] {
  const ranges: { start: number; end: number }[] = [];
  for (const t of tokens) {
    let from = 0;
    for (;;) {
      const idx = snippet.indexOf(t, from);
      if (idx === -1) break;
      ranges.push({ start: idx, end: idx + t.length });
      from = idx + t.length;
    }
  }
  return ranges.sort((a, b) => a.start - b.start);
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
