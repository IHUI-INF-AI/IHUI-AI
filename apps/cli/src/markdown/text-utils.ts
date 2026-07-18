/**
 * P44-2 Markdown text utilities(纯函数,0 依赖)。
 *
 * 灵感来源:参考 cli-markdown/src/buffers.rs
 *   - count_trailing_blank_lines (L73-119)
 *   - floor_char_boundary / ceil_char_boundary (L259-278)
 *
 * 用途:
 *   - 配合 checkpoint-freezing.ts:决定 frozen 边界后多少空行可截断
 *   - 配合 stream-chunk.ts:UTF-8 边界 backtrack 兜底
 *   - 配合 redact.ts:重写后的字符串切到最近的字符边界(避免破坏代理对)
 *
 * 设计:
 *   - 纯函数,O(n) 一次扫描
 *   - 显式处理 \n / \r\n / 空白(tab/space)三种
 *   - 不依赖 Intl.Segmenter(零依赖启动更快)
 */

/**
 * 统计文本末尾的连续空行(空白行)数量。
 *
 * 定义:以 \n 分隔,每行是 "仅含空格/tab/零宽" 视为空行。
 * 末尾的无换行末尾行不计入。
 *
 * 用途:markdown 流式渲染时,frozen 推进后 tail 渲染需要从第一个非空行开始
 * (否则 frozen 边界上会出现连续的视觉空行,影响 UX)。
 */
export function countTrailingBlankLines(text: string): number {
  if (text.length === 0) return 0

  // 工作在 UTF-8 byte 视图(忽略代理对的代码点细节,只关心 \n 和 ASCII 空白)
  const bytes = text
  const n = bytes.length
  let pos = n
  let count = 0

  // 倒序扫描:
  // 1) 跳过后续 ASCII 空白(空格 / tab / \r — Windows CRLF 中的 \r 视为 line 空白一部分)
  // 2) 遇到 \n:扫描该 line,仅空白则 count++,否则 break
  // 3) 遇到非空白:break
  while (pos > 0) {
    pos -= 1
    const c = bytes.charCodeAt(pos)
    if (c === 0x20 || c === 0x09 || c === 0x0d) {
      // space / tab / \r
      continue
    }
    if (c === 0x0a) {
      // newline:扫描该 line 内容是否全空白
      let lineStart = pos
      while (lineStart > 0) {
        const prev = bytes.charCodeAt(lineStart - 1)
        if (prev === 0x0a || prev === 0x0d) break
        if (prev !== 0x20 && prev !== 0x09) {
          // 找到非空白字符,停止(此 line 不空)
          return count
        }
        lineStart -= 1
      }
      // lineStart..pos 范围内仅含空白(否则上面已 return)
      count += 1
      pos = lineStart
      continue
    }
    // 任何非空白字符 → 停止
    return count
  }
  return count
}

/**
 * 把 `index` 向下对齐到 `s` 的最近 UTF-8 字符边界。
 *
 * 等价于 Rust 1.91+ 的 `str::floor_char_boundary`。
 * 索引超过 `s.length` 时截到 `s.length`。
 *
 * 用途:外部输入(如 LLM 响应)被截断时,落到最近的字符边界,避免半个代理对。
 */
export function floorCharBoundary(s: string, index: number): number {
  let i = Math.min(index, s.length)
  while (i > 0 && !isCharBoundary(s, i)) {
    i -= 1
  }
  return i
}

/**
 * 把 `index` 向上对齐到 `s` 的最近 UTF-8 字符边界。
 *
 * 等价于 Rust 1.91+ 的 `str::ceil_char_boundary`。
 */
export function ceilCharBoundary(s: string, index: number): number {
  let i = Math.min(index, s.length)
  while (i < s.length && !isCharBoundary(s, i)) {
    i += 1
  }
  return i
}

function isCharBoundary(s: string, index: number): boolean {
  // JavaScript 的 `s[i]` 访问不会 split surrogate pair(返回 lone surrogate),
  // 因此 0 和 s.length 总是合法边界;
  // 其他位置:前一个 code unit 是 low surrogate(index 在 high 之后)→ 非法
  if (index <= 0 || index >= s.length) return true
  // 取得 index-1 处 code unit:若是 high surrogate (0xD800-0xDBFF),index 在其后
  const prev = s.charCodeAt(index - 1)
  if (prev >= 0xd800 && prev <= 0xdbff) return false
  return true
}
