// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * JsonCode — 流式 JSON 预览的轻量语法高亮(2026-11-15 立)。
 *
 * 用途:tool-call-card 的 partialArgs 预览(工具入参逐分片构建过程)。partialArgs 是
 * `JSON.stringify(...,null,2)` 的稳定输出,用纯正则 tokenizer 分色即可,无需引
 * react-syntax-highlighter(重依赖 + 每帧重解析)。流式稳定:完整合法 JSON 的 token
 * 边界不会因新增字符而改变前缀分色,不会闪烁。
 *
 * 色板(沿用仓库 token 习惯,明暗双档):
 *   key      → teal     (键名)
 *   string   → amber    (字符串值)
 *   number   → violet   (数字)
 *   boolean  → sky      (true/false/null)
 *   punct    → muted    ({}[],: 标点)
 *   plain    → foreground/75 (兜底)
 */

type TokKind = 'key' | 'string' | 'number' | 'boolean' | 'punct' | 'plain'

interface Tok {
  k: TokKind
  t: string
}

/** 逐段扫一遍 JSON 文本产 token。顺序敏感:key 永远先于 string 匹配(键名是紧随
 * `"` 前有 `:` 的串,这里简化为「冒号前的字符串=key、冒号后的字符串=值」——
 * JSON.stringify 的稳定输出满足该形态)。 */
function tokenizeJson(src: string): Tok[] {
  const toks: Tok[] = []
  const n = src.length
  let i = 0
  // 记录每个 string 之后是否紧跟 `:`(key 形态),需要向前看一个非空白字符。
  const isColonNext = (from: number): boolean => {
    let j = from
    while (j < n && (src.charAt(j) === ' ' || src.charAt(j) === '\t')) j++
    return src.charAt(j) === ':'
  }
  while (i < n) {
    const c = src.charAt(i)
    if (c === '"') {
      // 找到闭合引号(处理 \" 转义)
      let j = i + 1
      while (j < n) {
        if (src.charAt(j) === '\\') {
          j += 2
          continue
        }
        if (src.charAt(j) === '"') {
          j++
          break
        }
        j++
      }
      const text = src.slice(i, j)
      toks.push({ k: isColonNext(j) ? 'key' : 'string', t: text })
      i = j
      continue
    }
    if (c === '-' || (c >= '0' && c <= '9')) {
      let j = i + 1
      while (j < n && /[0-9.eE+\-]/.test(src.charAt(j))) j++
      toks.push({ k: 'number', t: src.slice(i, j) })
      i = j
      continue
    }
    if (/[a-zA-Z_]/.test(c)) {
      let j = i + 1
      while (j < n && /[a-zA-Z_]/.test(src.charAt(j))) j++
      const word = src.slice(i, j)
      toks.push({
        k: word === 'true' || word === 'false' || word === 'null' ? 'boolean' : 'plain',
        t: word,
      })
      i = j
      continue
    }
    if (c === '{' || c === '}' || c === '[' || c === ']' || c === ':' || c === ',') {
      toks.push({ k: 'punct', t: c })
      i++
      continue
    }
    // 空白/换行/其他:原样保留以保换行与缩进
    let j = i + 1
    while (j < n && !/["0-9\-a-zA-Z_{\[:,]/.test(src.charAt(j))) j++
    toks.push({ k: 'plain', t: src.slice(i, j) })
    i = j
  }
  return toks
}

const KIND_CLASS: Record<TokKind, string> = {
  key: 'text-teal-600 dark:text-teal-300',
  string: 'text-amber-600 dark:text-amber-300',
  number: 'text-violet-600 dark:text-violet-300',
  boolean: 'text-sky-600 dark:text-sky-300',
  punct: 'text-muted-foreground/60',
  plain: 'text-foreground/75',
}

/** 占位行高估算(仅用于稳定 min-height,避免首帧跳变)。实际高度仍由内容决定。 */
export function JsonCode({
  text,
  className,
  testId,
  streaming = false,
  autoScrollToBottom = false,
}: {
  text: string
  className?: string
  testId?: string
  streaming?: boolean
  autoScrollToBottom?: boolean
}) {
  const ref = React.useRef<HTMLPreElement>(null)
  React.useEffect(() => {
    if (!autoScrollToBottom) return
    const el = ref.current
    if (el) el.scrollTop = el.scrollHeight
  }, [text, autoScrollToBottom])

  // memo:同 text 不重复 tokenize(流式下 text 每帧变,但单帧只算一次)
  const toks = React.useMemo(() => tokenizeJson(text), [text])

  return (
    <pre
      ref={ref}
      className={cn(
        'max-h-[200px] overflow-auto whitespace-pre-wrap break-all rounded-sm bg-background/60 p-1.5 font-mono text-label leading-relaxed',
        // 流式进行中:左侧 accent 边(teal)与 partialDiff 预览同形,强化"正在生成"锚点
        streaming && 'border-l-2 border-l-teal-500/60 dark:border-l-teal-400/60',
        className,
      )}
      data-testid={testId}
    >
      {toks.map((tk, idx) => (
        <span key={idx} className={KIND_CLASS[tk.k]}>
          {tk.t}
        </span>
      ))}
      {streaming && (
        // 与 StreamCode 同谱:cursor-blink 硬切 + var(--color-primary) token 色
        <span
          aria-hidden="true"
          className="ml-0.5 inline-block h-[0.95em] w-[2px] translate-y-[0.12em] animate-cursor-blink bg-[var(--color-primary)]"
        />
      )}
    </pre>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​ placeholder-watermark
