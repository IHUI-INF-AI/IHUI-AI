/**
 * apply_patch 4 级模糊匹配(seek_sequence)。
 *
 * 灵感来源:grok-build port 自 openai/codex 的 `apply_patch/seek_sequence.rs`。
 * 问题:LLM 生成 patch 时,SEARCH 块常因源文件含 typographic 标点(– — '' "" nbsp)
 * 或行尾空白差异导致精确匹配失败,触发 "未找到匹配的文本" 错误,迫使用户手动修改。
 *
 * 策略(4 级回退,严格度递减):
 *   1. exact      — 原始字符串 indexOf(零开销快路径)
 *   2. rstrip     — 每行末尾空白无关(rtrim 比较)
 *   3. trim       — 每行前后空白无关(trim 比较)
 *   4. unicode    — Unicode 归一化(typographic → ASCII)+ trim
 *
 * 做减法:不实现 codex 的 line-index 索引/散列加速(纯字符串场景 indexOf 已足够快)。
 * 仅在 exact 失败时回退到行级比较,避免 hot path 损耗。
 */

export type MatchLevel = 'exact' | 'rstrip' | 'trim' | 'unicode';

export interface SeekResult {
  /** 匹配在 haystack 中的字符起始位置 */
  index: number;
  /** 匹配的原始长度(用于 slice 替换) */
  length: number;
  /** 命中的匹配级别 */
  level: MatchLevel;
}

/**
 * Unicode 归一化:把常见 typographic 字符映射回 ASCII 等价物。
 * 不依赖完整 unicode-normalize 库(做减法),只处理高频痛点字符。
 */
export function normalizeForUnicode(s: string): string {
  return s
    // dashes
    .replace(/[\u2010-\u2015]/g, '-') // ‐ ‑ ‒ – — ―
    .replace(/\u2212/g, '-')          // minus sign
    // single quotes
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'") // ' ' ‚ ‛
    // double quotes
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"') // " " „ ‟
    // whitespace
    .replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, ' ') // nbsp + 各种 space
    .replace(/\u2028/g, '\n') // line separator
    .replace(/\u2029/g, '\n') // paragraph separator
    // 其他常见混淆
    .replace(/\u00B7/g, '*')  // middle dot → asterisk
    .replace(/\u2026/g, '...') // ellipsis → three dots
    .replace(/\u00D7/g, 'x')   // multiplication sign
    .replace(/\u2013/g, '-');  // en dash (redundant but explicit)
}

function rtrim(s: string): string {
  return s.replace(/\s+$/, '');
}

function lineEquals(a: string, b: string, level: MatchLevel): boolean {
  if (level === 'rstrip') return rtrim(a) === rtrim(b);
  if (level === 'trim') return a.trim() === b.trim();
  // unicode
  return normalizeForUnicode(a).trim() === normalizeForUnicode(b).trim();
}

/**
 * 在 haystack 中查找 needle 的连续行序列匹配,使用指定级别比较。
 * 返回首字符索引和原始长度;未找到返回 null。
 *
 * 实现思路:把 haystack 和 needle 按行拆分,在 haystack 行数组中滑动窗口找连续 needle.length 行匹配。
 * 命中后通过累加行长度 + 行分隔符长度还原字符索引。
 */
function seekByLines(haystack: string, needle: string, level: MatchLevel): SeekResult | null {
  // 拆行时保留 \n 信息:用 split('\n') 即可,行数 = split 结果
  const hayLines = haystack.split('\n');
  const needleLines = needle.split('\n');
  const n = needleLines.length;
  if (n === 0 || n > hayLines.length) return null;

  for (let start = 0; start <= hayLines.length - n; start++) {
    let ok = true;
    for (let i = 0; i < n; i++) {
      if (!lineEquals(hayLines[start + i]!, needleLines[i]!, level)) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;

    // 还原字符索引:累加前 start 行长度 + start 个 \n
    let charIndex = 0;
    for (let i = 0; i < start; i++) {
      charIndex += hayLines[i]!.length + 1; // +1 for \n
    }
    // 匹配的原始长度:前 n-1 行长度 + n-1 个 \n + 最后一行长度
    let length = 0;
    for (let i = 0; i < n - 1; i++) {
      length += hayLines[start + i]!.length + 1;
    }
    length += hayLines[start + n - 1]!.length;

    return { index: charIndex, length, level };
  }
  return null;
}

/**
 * 4 级回退匹配:exact → rstrip → trim → unicode。
 * 第一级(exact)走 indexOf 快路径;后三级走行级比较。
 */
export function seekSequence(haystack: string, needle: string): SeekResult | null {
  if (needle.length === 0) return null;

  // Level 1: exact
  const exactIdx = haystack.indexOf(needle);
  if (exactIdx !== -1) {
    return { index: exactIdx, length: needle.length, level: 'exact' };
  }

  // Level 2: rstrip
  const rstripResult = seekByLines(haystack, needle, 'rstrip');
  if (rstripResult) return rstripResult;

  // Level 3: trim
  const trimResult = seekByLines(haystack, needle, 'trim');
  if (trimResult) return trimResult;

  // Level 4: unicode
  return seekByLines(haystack, needle, 'unicode');
}
