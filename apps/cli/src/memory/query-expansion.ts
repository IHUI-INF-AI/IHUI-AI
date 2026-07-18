/**
 * Query Expansion — 关键词提取 + 停用词过滤(P43)。
 *
 * 灵感来源:参考行业 hybrid_search 的 query preprocessing。
 * 简化策略(做减法):
 *   - 0 新依赖,纯 TS
 *   - 英文停用词表(40 个常见词)+ 中文单字停用词(的/了/是/在/等)
 *   - extractKeywords:分词 → 去停用词 → 长度过滤(>=2) → 纯数字过滤
 *   - isAllStopWords:所有 token 都是停用词 → true
 *   - 中文 2-gram:连续中文字符按 2-gram 切分(无分词器时的 fallback)
 */

/** 英文停用词(40 个高频无意义词) */
const EN_STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
  'may', 'might', 'must', 'can', 'shall', 'of', 'in', 'on', 'at', 'to',
  'for', 'with', 'by', 'from', 'as', 'that', 'this', 'these', 'those', 'it',
]);

/** 中文单字停用词 */
const ZH_STOPWORDS = new Set(['的', '了', '是', '在', '和', '与', '或', '也', '都', '就', '还', '把', '被', '让', '给']);

/** 判断字符串是否为纯数字 */
function isPureNumber(s: string): boolean {
  return /^\d+(\.\d+)?$/.test(s);
}

/** 简单分词:英文按空格/标点切分,中文按 2-gram 切分 */
function tokenize(query: string): string[] {
  const tokens: string[] = [];
  // 英文部分:按非字母数字分割
  const englishParts = query.split(/[^a-zA-Z0-9]+/).filter((s) => s.length > 0);
  for (const part of englishParts) {
    tokens.push(part.toLowerCase());
  }
  // 中文部分:提取连续中文字符串,做 2-gram
  const chineseChunks = query.match(/[\u4e00-\u9fff]+/g) ?? [];
  for (const chunk of chineseChunks) {
    if (chunk.length === 1) {
      tokens.push(chunk);
    } else {
      for (let i = 0; i < chunk.length - 1; i++) {
        tokens.push(chunk.substring(i, i + 2));
      }
    }
  }
  return tokens;
}

/** 判断单个 token 是否为停用词 */
function isStopword(token: string): boolean {
  if (EN_STOPWORDS.has(token.toLowerCase())) return true;
  if (ZH_STOPWORDS.has(token)) return true;
  return false;
}

/**
 * 判断 query 是否全部由停用词组成(无有意义关键词)。
 * 用于 hybrid_search 的回退判断:全停用词时回退到原文 tokenize。
 */
export function isAllStopWords(query: string): boolean {
  const tokens = tokenize(query);
  if (tokens.length === 0) return true;
  return tokens.every(isStopword);
}

/**
 * 从 query 中提取关键词(去停用词 + 长度过滤 + 纯数字过滤)。
 * 返回小写化的关键词列表(保留顺序,去重)。
 */
export function extractKeywords(query: string): string[] {
  const tokens = tokenize(query);
  const result: string[] = [];
  const seen = new Set<string>();
  for (const token of tokens) {
    // 跳过停用词
    if (isStopword(token)) continue;
    // 跳过纯数字
    if (isPureNumber(token)) continue;
    // 跳过长度 < 2 的英文 token(单字符英文通常无意义)
    if (/^[a-z]$/.test(token)) continue;
    // 去重
    if (seen.has(token)) continue;
    seen.add(token);
    result.push(token);
  }
  return result;
}
