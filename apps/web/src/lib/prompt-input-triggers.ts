// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * prompt 输入触发符提取与模糊匹配评分(2026-09-30 立,吸收批次 b74-W4 票 G-977973)。
 *
 * 吸收判据:
 * - 触发符 `/ @ $ # ¥￥`;¥/￥ 只把触发语义归一为 $,不改写用户实际输入字符;
 * - 中文输入通常不在句中插空格,仅对 @ 放宽"紧邻汉字/中文标点"触发;
 * - 汉字紧邻 @ 时拒绝域名形态 query(`联系邮箱@example.com` 不是 mention),
 *   中文标点后(`看看,@foo.bar`)与空格后仍触发;
 * - tail 替换长度只删"候选未输入后缀"能对上的那一小段(`/go|al` 补全只删 al),
 *   裸触发符后光标处的正文不算 tail;
 * - 四权重模糊评分:value 原分 / label+50 / description+250 / keyword+450,
 *   前缀 < 子串 < 子序列;同分按原数组顺序稳定排序。
 */

export type PromptInputTrigger = '/' | '@' | '$' | '#'

export interface ActivePromptInputTrigger {
  trigger: PromptInputTrigger
  query: string
}

export interface PromptInputSuggestionItem {
  id: string
  trigger: PromptInputTrigger
  value: string
  label: string
  description: string
  keywords?: string[]
}

const ACTIVE_TRIGGER_RE = /(^|\s)([/@$#¥￥])([^\s/@$#¥￥]*)$/;
// 中文输入通常不在句中插入空格;仅放宽 @ 的紧邻触发,避免改变 slash/skill 面板的触发边界。
const ACTIVE_MENTION_TRIGGER_RE =
  /(^|[\s\p{Script=Han}\u3000-\u303f\uff00-\uffef])(@)([^\s/@$#¥￥]*)$/u;
// 放宽汉字紧邻 @ 后,`联系邮箱@example.com` 会被当成 mention;仅在汉字直接紧邻 @ 时
// 拒绝域名形态(x.y)的 query,中文标点后与空格后不拒绝。
const DOMAIN_LIKE_QUERY_RE = /\S\.\S/;
const HAN_PREFIX_RE = /\p{Script=Han}/u;
const ACTIVE_TRIGGER_TAIL_RE = /^[^\s/@$#¥￥]*/;
const LEADING_TRIGGER_CHARS_RE = /^[/@$#¥￥]+/;

function normalizeTriggerAlias(trigger: string): PromptInputTrigger {
  if (trigger === '¥' || trigger === '￥') {
    // 部分键盘/输入法输入 skill 触发符时会产生 `¥` 或全角 `￥`;
    // 只把触发语义归一为 $,不在输入层改写用户实际输入的字符。
    return '$';
  }
  return trigger as PromptInputTrigger;
}

/** 单字段模糊评分:前缀命中按剩余长度给分,子串命中 100+偏移,子序列命中 200+间隙。 */
function scoreFuzzyMatch(text: string, query: string): number | null {
  const normalizedText = text.trim().toLowerCase();
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedText) {
    return null;
  }
  if (!normalizedQuery) {
    return 0;
  }
  if (normalizedText.startsWith(normalizedQuery)) {
    return normalizedText.length - normalizedQuery.length;
  }

  const substringIndex = normalizedText.indexOf(normalizedQuery);
  if (substringIndex !== -1) {
    return 100 + substringIndex;
  }

  let score = 200;
  let searchStart = 0;
  for (const char of normalizedQuery) {
    const foundIndex = normalizedText.indexOf(char, searchStart);
    if (foundIndex === -1) {
      return null;
    }
    score += foundIndex - searchStart;
    searchStart = foundIndex + 1;
  }
  return score + (normalizedText.length - normalizedQuery.length);
}

/**
 * 汇总一条建议的四源评分,取最小(最优):
 * value 原分,label+50,description+250,keywords 取最优+450。
 * 权重表达"命中字段越具体越靠前";全源未命中返回 null。
 */
function scoreSuggestion(suggestion: PromptInputSuggestionItem, query: string): number | null {
  const valueScore = scoreFuzzyMatch(suggestion.value, query);
  const labelScore = scoreFuzzyMatch(suggestion.label, query);
  const descriptionScore = scoreFuzzyMatch(suggestion.description, query);
  const keywordScore = Math.min(
    ...(suggestion.keywords ?? []).map((keyword) => {
      const score = scoreFuzzyMatch(keyword, query);
      return score === null ? Number.POSITIVE_INFINITY : score + 450;
    }),
    Number.POSITIVE_INFINITY,
  );
  const bestScore = Math.min(
    valueScore ?? Number.POSITIVE_INFINITY,
    labelScore !== null ? labelScore + 50 : Number.POSITIVE_INFINITY,
    descriptionScore !== null ? descriptionScore + 250 : Number.POSITIVE_INFINITY,
    keywordScore,
  );
  return Number.isFinite(bestScore) ? bestScore : null;
}

/** 从光标前文本提取当前激活的触发符与 query;无激活触发符时返回 null。 */
export function extractActivePromptInputTrigger(
  textBeforeCursor: string,
): ActivePromptInputTrigger | null {
  const match =
    ACTIVE_MENTION_TRIGGER_RE.exec(textBeforeCursor) ?? ACTIVE_TRIGGER_RE.exec(textBeforeCursor);
  if (!match) {
    return null;
  }
  if (HAN_PREFIX_RE.test(match[1] ?? '') && DOMAIN_LIKE_QUERY_RE.test(match[3] ?? '')) {
    return null;
  }
  return {
    trigger: normalizeTriggerAlias(match[2] ?? ''),
    query: match[3] ?? '',
  };
}

/**
 * 计算补全候选命中时需要替换的光标后 tail 长度。
 * 只删除"候选未输入后缀"能对上的那一小段,比如 `/go|al` 里的 `al`;
 * 裸触发符(query 为空)后光标处的正文不是当前 token 的补全部分,一律不删。
 */
export function getActivePromptInputTokenTailLength(
  activeTrigger: ActivePromptInputTrigger,
  textAfterCursor: string,
  replacementCandidates: string | readonly string[],
): number {
  if (activeTrigger.query.length === 0) {
    return 0;
  }

  const tailText = ACTIVE_TRIGGER_TAIL_RE.exec(textAfterCursor)?.[0] ?? '';
  if (!tailText) {
    return 0;
  }

  const normalizedQuery = activeTrigger.query.toLowerCase();
  const candidates = Array.isArray(replacementCandidates)
    ? replacementCandidates
    : [replacementCandidates];
  let matchedTailLength = 0;

  for (const rawCandidate of candidates) {
    const candidate = rawCandidate.trim().replace(LEADING_TRIGGER_CHARS_RE, '');
    if (!candidate) {
      continue;
    }
    if (!candidate.toLowerCase().startsWith(normalizedQuery)) {
      continue;
    }

    const expectedTail = candidate.slice(activeTrigger.query.length);
    if (!expectedTail) {
      continue;
    }
    const comparableLength = Math.min(tailText.length, expectedTail.length);
    const typedTail = tailText.slice(0, comparableLength);
    // 完整候选后紧贴的正文若被当作同一 token 的 tail 会整段误删;
    // 这里只删除候选未输入后缀能对上的那一小段。
    if (expectedTail.toLowerCase().startsWith(typedTail.toLowerCase())) {
      matchedTailLength = Math.max(matchedTailLength, comparableLength);
    }
  }

  return matchedTailLength;
}

/** 按 query 过滤并排序建议;query 为 null(无激活触发符)返回空,空 query 返回原序。 */
export function filterPromptInputSuggestions(
  suggestions: PromptInputSuggestionItem[],
  query: string | null,
): PromptInputSuggestionItem[] {
  if (query === null) {
    return [];
  }
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return suggestions;
  }

  return suggestions
    .map((suggestion, index) => {
      const score = scoreSuggestion(suggestion, normalizedQuery);
      return score === null ? null : { index, score, suggestion };
    })
    .filter((item): item is { index: number; score: number; suggestion: PromptInputSuggestionItem } => item !== null)
    .sort((left, right) => {
      if (left.score !== right.score) {
        return left.score - right.score;
      }
      // 同分保原序(稳定),避免候选列表在连续输入时来回跳。
      return left.index - right.index;
    })
    .map((item) => item.suggestion);
}

/** 返回最优建议在原数组中的下标;无 query 或全部未命中时落在首位。 */
export function getBestPromptInputSuggestionIndex(
  suggestions: PromptInputSuggestionItem[],
  query: string | null,
): number {
  const normalizedQuery = query?.trim().toLowerCase() ?? '';
  if (!normalizedQuery) {
    return 0;
  }

  let bestIndex = 0;
  let bestScore = Number.POSITIVE_INFINITY;
  suggestions.forEach((suggestion, index) => {
    const score = scoreSuggestion(suggestion, normalizedQuery);
    if (score === null) {
      return;
    }
    if (score < bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  return bestIndex;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
