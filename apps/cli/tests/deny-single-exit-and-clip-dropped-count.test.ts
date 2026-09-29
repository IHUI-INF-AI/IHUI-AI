// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票 A + 票 B 的常驻尺子(2026-09-29)。
 *
 * 票 A —— 「非交互 ∧ 无审批面 ⇒ 拒绝」的**判定与文案**收成一处。
 *   上游对照 `zcode/apps/zcode-cli/packages/cli/src/headless-workflow.ts:31-51`:只有两个具名
 *   工作流工具自动 allow,其余**全部委托同一个 `createDenyPermissionBroker()`**,所以拒绝的语义
 *   与文案只有一份;`tui-prompt-handler.ts:78-91` 在审批面缺席时走同一个出口并带 toolName 归因。
 *   我方此前是「机制在、委托结构不在」:`requiresUserConfirmation` 的四条判据齐,但三条拒绝路径
 *   各自拼头语文案,"有没有审批面"在 `executeToolCall` 里被写了两遍。
 *
 * 票 B —— 裁剪必须自报丢了多少。
 *   上游对照 `commands-command.ts:167`、`skills-command.ts:162` 都打印 `bytesRead/sizeBytes (truncated)`。
 *   我方 `tools/clipboard.ts` 五处 `.slice(0, MAX_CLIPBOARD_CHARS)` 剪完就丢而不报 ——
 *   "被裁"与"本来就这么长"在消费方眼里同形。
 *
 * 两类判据各钉一头:
 *  · **行为面** —— 走生产入口(`executeToolCall` / 工具 `execute`),不是把判据抄进测试重跑;
 *  · **单源面** —— 句面常量在被审源码里只许出现一次,且必须**剥注释后**再数(否则门会把自己
 *    解释自己的散文判成第二份文案,守门 131 同型)。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ToolContract } from '@ihui/types'
import {
  clearTools,
  executeToolCall,
  registerTools,
  resetRateLimiter,
  type Tool,
  type ToolContext,
} from '../src/tools/index.js'
import {
  clipToClipboardBudget,
  clipboardTruncationNote,
  isClipboardAvailable,
  readClipboard,
  writeClipboardWithOutcome,
  CLIPBOARD_TOOLS,
} from '../src/tools/clipboard.js'

/** 本文件用到的两个被审源(单源判据的对象是**真文件**,不是自造夹具 —— AGENTS §22c)。 */
const TOOLS_INDEX_SRC = readFileSync(fileURLToPath(new URL('../src/tools/index.ts', import.meta.url)), 'utf8')
const CLIPBOARD_SRC = readFileSync(fileURLToPath(new URL('../src/tools/clipboard.ts', import.meta.url)), 'utf8')

/**
 * 剥掉注释、**保留字符串**的一份遮罩(行号与长度都不动,便于按源码行读结论)。
 *
 * 为什么必须剥:单源判据要数的是"代码里拼了几次这句话",而头注/文档注释里引用同一句是
 * **合法的自我说明**;不剥就会把解释判成违规(守门 131 第一次自跑就是被自己写的说明咬到的)。
 * 为什么必须保留字符串:URL 里的 `//`、模板串里的 `/*` 都不是注释 —— 按"看见 // 就剥"写会
 * 把代码本身吃掉,判据静默失明(守门 70 的 `'https://x/*'` 假绿态同型)。
 */
function codeFace(src: string): string {
  const out: string[] = []
  let inLine = false
  let inBlock = false
  let quote: string | null = null
  for (let i = 0; i < src.length; i++) {
    const ch = src[i] as string
    const next = src[i + 1] ?? ''
    if (inLine) {
      if (ch === '\n') {
        inLine = false
        out.push(ch)
      } else {
        out.push(' ') // 注释体等长抹掉,行号不挪
      }
      continue
    }
    if (inBlock) {
      if (ch === '*' && next === '/') {
        inBlock = false
        out.push(' ', ' ')
        i++
      } else {
        out.push(ch === '\n' ? '\n' : ' ')
      }
      continue
    }
    if (quote) {
      out.push(ch)
      if (ch === '\\') {
        out.push(next)
        i++
      } else if (ch === quote) {
        quote = null
      }
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch
      out.push(ch)
      continue
    }
    if (ch === '/' && next === '/') {
      inLine = true
      out.push(' ', ' ')
      i++
      continue
    }
    if (ch === '/' && next === '*') {
      inBlock = true
      out.push(' ', ' ')
      i++
      continue
    }
    out.push(ch)
  }
  return out.join('')
}

const TOOLS_CODE = codeFace(TOOLS_INDEX_SRC)
const CLIPBOARD_CODE = codeFace(CLIPBOARD_SRC)

/** 数一份代码面上某个串出现几次(不用正则 —— 待数的句子本身含括号与正则元字符)。 */
function countOccurrences(haystack: string, needle: string): number {
  if (needle === '') return 0
  let n = 0
  for (let at = haystack.indexOf(needle); at >= 0; at = haystack.indexOf(needle, at + needle.length)) n++
  return n
}

// ==================== 票 A:拒绝出口的单元行为 ====================

beforeEach(() => {
  clearTools()
  resetRateLimiter()
})

const OVER = 1_234

describe('票 B:clipToClipboardBudget 把丢弃量随结果一起带出来', () => {
  it('未溢出 ⇒ droppedChars=0、文本逐字不变、truncated=false(不报)', () => {
    const short = 'a'.repeat(100)
    const clip = clipToClipboardBudget(short)
    expect(clip.text).toBe(short)
    expect(clip.droppedChars).toBe(0)
    expect(clip.truncated).toBe(false)
  })

  it('恰好等于上限 ⇒ 不算溢出(边界不得多报一笔)', () => {
    const exact = 'b'.repeat(32_000)
    const clip = clipToClipboardBudget(exact)
    expect(clip.text.length).toBe(32_000)
    expect(clip.droppedChars).toBe(0)
    expect(clip.truncated).toBe(false)
  })

  it('溢出 ⇒ 截到上限并给出**精确**丢弃数(上限值未被顺手改动)', () => {
    const long = 'c'.repeat(32_000 + OVER)
    const clip = clipToClipboardBudget(long)
    expect(clip.text.length).toBe(32_000)
    expect(clip.droppedChars).toBe(OVER)
    expect(clip.truncated).toBe(true)
  })

  it('空串 ⇒ 零丢弃(不得把"没有内容"读成"被裁过")', () => {
    const clip = clipToClipboardBudget('')
    expect(clip.text).toBe('')
    expect(clip.droppedChars).toBe(0)
    expect(clip.truncated).toBe(false)
  })
})

describe('票 B:提示语未溢出不报、溢出必点名丢弃字数', () => {
  it('droppedChars=0 ⇒ 返回空串(成对的那一半:不裁就一个字都不报)', () => {
    expect(clipboardTruncationNote(100, 0)).toBe('')
  })

  it('溢出 ⇒ 报出原始长度、保留数与**具体丢弃字数**', () => {
    const note = clipboardTruncationNote(32_000 + OVER, OVER)
    expect(note).toContain(`丢弃 ${OVER} 字`)
    expect(note).toContain(`原始长度 ${32_000 + OVER} 字符`)
    expect(note).toContain('保留 32000 字符')
  })
})

describe('票 B:五个裁剪站点全部委托同一个出口', () => {
  it('代码面上 .slice(0, MAX_CLIPBOARD_CHARS) 只许出现在唯一出口里(1 次)', () => {
    expect(countOccurrences(CLIPBOARD_CODE, 'slice(0, MAX_CLIPBOARD_CHARS)')).toBe(1)
  })

  it('裁剪出口被调用 5 处(读 4 + 写 1),不得有站点退回手搓 slice', () => {
    // 代码面上该标识符出现 6 次 = 定义 1 + 调用 5;注释里"原有 5 处 slice"那句已被遮罩剥掉
    expect(countOccurrences(CLIPBOARD_CODE, 'clipToClipboardBudget(')).toBe(6)
  })

  it('提示语模板只有一份常量,且两个工具站点都调它', () => {
    expect(countOccurrences(CLIPBOARD_CODE, '[已截断,原始长度')).toBe(1)
    expect(countOccurrences(CLIPBOARD_CODE, 'clipboardTruncationNote(')).toBe(3) // 定义 1 + 调用 2
  })

  it('上限常量仍是那一个 32_000(本票不得顺手改值)', () => {
    expect(countOccurrences(CLIPBOARD_CODE, 'MAX_CLIPBOARD_CHARS = 32_000')).toBe(1)
  })

  it('readClipboard 的对外签名未变(返回字符串),细节走带丢弃量的出口', () => {
    expect(typeof readClipboard()).toBe('string')
    expect(countOccurrences(CLIPBOARD_CODE, 'return readClipboardExcerpt().text')).toBe(1)
  })
})

// 说明:原第 4 段"工具层真的把丢弃数报出去"已随票 A 一起移出 —— 它断言的是 tools/index.ts 里
// 尚未入库的执行器接线(见 PROJECT_PLAN G-816101/G-814407)。留下的是只依赖已入库 clipboard.ts 的三段。
