// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-720 · 「被截断」账目由执行器边界产出(2026-10-01 立)。
 *
 * 钉住的四型:
 *  ① 结论住在边界,不住在 handler —— handler 只报事实(`truncationFacts`),
 *     `truncated` 由边界从两条字节数推导,事实字段在结果离开边界时被摘掉;
 *  ② 不产 false 噪音 —— 未截时整块缺席,而不是写一枚 `false`;
 *  ③ 拒算 —— 算不出来的账不记(既不冒"已截"也不冒"未截"),且不得留下半条事实让下游猜;
 *  ④ 装车证明 —— 断言走**生产入口** `executeToolCall` 与真实 `read_file`,不走 mock 内部函数
 *     (与 `tool-result-budget-contract-wiring.test.ts` 同一条口径:摘掉边界接线这些断言必须红)。
 *
 * 每组正向断言都配一条"喂坏形态必红"的对照。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import {
  applyToolResultBudget,
  clearTools,
  executeToolCall,
  executeWithinExecBudget,
  normalizeToolResultTruncation,
  registerTools,
  resetRateLimiter,
  type Tool,
  type ToolContext,
  type ToolResult,
} from '../src/tools/index.js'
import { MAX_READ_BYTES, read_file } from '../src/tools/builtins.js'
import type { ToolContract, ToolResultBudgetContract } from '@ihui/types'

const ctx: ToolContext = { workspacePath: '.' }

function makeBudget(overrides: Partial<ToolResultBudgetContract> = {}): ToolResultBudgetContract {
  return {
    inlineLimitBytes: 100,
    providerVisibleLimitBytes: 1_000_000,
    policy: 'truncate',
    preview: { bytes: 64, lines: 3, from: 'head' },
    ...overrides,
  }
}

function makeContract(resultBudget: ToolResultBudgetContract): ToolContract {
  return {
    shape: { visibleToProvider: true, input: { type: 'object' } },
    permission: {
      permissionKey: 'test:truncation',
      reason: 'test-only contract',
      riskLevel: 'read',
      effectScope: 'none',
      requiresApproval: false,
    },
    resultBudget,
  }
}

/** 带自述事实的 handler:模拟"读了 N 中的 M 字节"这一类工具自己的截断。 */
function makeFactsTool(name: string, output: string, facts: ToolResult['truncationFacts']): Tool {
  return {
    name,
    description: 'G-720 truncation test tool',
    parameters: {},
    required: [],
    execute: async () => ({ success: true, output, ...(facts ? { truncationFacts: facts } : {}) }),
  }
}

const createdDirs: string[] = []

function mkWorkspace(): { dir: string; wsCtx: ToolContext } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-g720-'))
  createdDirs.push(dir)
  return { dir, wsCtx: { workspacePath: dir } }
}

beforeEach(() => {
  clearTools()
  resetRateLimiter()
})

afterEach(() => {
  clearTools()
  for (const dir of createdDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

describe('normalizeToolResultTruncation:结论由边界推导', () => {
  it('没有事实 ⇒ 返回同一对象引用(零回归承诺不被削弱)', () => {
    const result: ToolResult = { success: true, output: 'hello' }
    expect(normalizeToolResultTruncation(result)).toBe(result)
  })

  it('事实成立 ⇒ 产出记录,且事实字段被摘干净', () => {
    const input: ToolResult = {
      success: true,
      output: 'part',
      truncationFacts: { originalBytes: 900, returnedBytes: 100, budgetStrategy: 'truncate' },
    }
    const out = normalizeToolResultTruncation(input)
    expect(out.truncation).toEqual({
      truncated: true,
      originalBytes: 900,
      returnedBytes: 100,
      budgetStrategy: 'truncate',
    })
    expect('truncationFacts' in out).toBe(false)
    // 输入对象不得被就地改写(它可能正被别人持有)
    expect(input.truncation).toBeUndefined()
    expect(input.truncationFacts).toBeDefined()
  })

  it('两数相等 ⇒ 记录在位而 truncated 整块缺席(不产 false 噪音)', () => {
    const out = normalizeToolResultTruncation({
      success: true,
      output: 'all',
      truncationFacts: { originalBytes: 50, returnedBytes: 50, budgetStrategy: 'inline' },
    })
    expect(out.truncation).toBeDefined()
    expect('truncated' in (out.truncation ?? {})).toBe(false)
    expect(out.truncation?.budgetStrategy).toBe('inline')
  })

  it('喂坏形态:returnedBytes 大于 originalBytes ⇒ 不记任何断言,且不留半条事实', () => {
    const out = normalizeToolResultTruncation({
      success: true,
      output: 'x',
      truncationFacts: { originalBytes: 10, returnedBytes: 999, budgetStrategy: 'truncate' },
    })
    expect(out.truncation).toBeUndefined()
    expect('truncationFacts' in out).toBe(false)
  })

  it('喂坏形态:策略不在值域上 ⇒ 同上(既不冒已截也不冒未截)', () => {
    // 运行时脏值:类型层不给它落脚,所以显式绕过编译期检查来模拟"别人塞进来的数据"
    const dirty = { originalBytes: 10, returnedBytes: 5, budgetStrategy: 'silently-drop' }
    const out = normalizeToolResultTruncation({
      success: true,
      output: 'x',
      truncationFacts: dirty as unknown as ToolResult['truncationFacts'],
    })
    expect(out.truncation).toBeUndefined()
    expect('truncationFacts' in out).toBe(false)
  })
})

describe('executeWithinExecBudget:边界是账目的唯一产出点', () => {
  it('handler 报事实 ⇒ 从边界出来时带推导结论', async () => {
    const tool = { name: 'facts_tool' }
    const out = await executeWithinExecBudget(tool, ctx, async () => ({
      success: true,
      output: 'part',
      truncationFacts: { originalBytes: 4096, returnedBytes: 512, budgetStrategy: 'truncate' as const },
    }))
    expect(out.truncation).toEqual({
      truncated: true,
      originalBytes: 4096,
      returnedBytes: 512,
      budgetStrategy: 'truncate',
    })
    expect('truncationFacts' in out).toBe(false)
  })

  it('handler 谎报(两数相等却自称截了)⇒ 推导否决,不写 truncated', async () => {
    const out = await executeWithinExecBudget({ name: 'liar' }, ctx, async () => ({
      success: true,
      output: 'whole',
      truncationFacts: { originalBytes: 77, returnedBytes: 77, budgetStrategy: 'truncate' as const },
    }))
    expect('truncated' in (out.truncation ?? {})).toBe(false)
  })

  it('handler 抛错仍原样冒泡(推导接线不得把异常代偿成结果)', async () => {
    await expect(
      executeWithinExecBudget({ name: 'boom' }, ctx, async () => {
        throw new Error('handler-blew-up')
      }),
    ).rejects.toThrow('handler-blew-up')
  })
})

describe('装车证明:executeToolCall 生产路径真消费 handler 事实', () => {
  it('注册带事实的工具 ⇒ 生产入口出来的结果带类型化账目', async () => {
    const executeSpy = vi.fn(async () => ({
      success: true as const,
      output: 'partial-view',
      truncationFacts: { originalBytes: 2048, returnedBytes: 256, budgetStrategy: 'truncate' as const },
    }))
    registerTools([{ ...makeFactsTool('e2e_facts_tool', 'partial-view', undefined), execute: executeSpy }])

    const result = await executeToolCall({ name: 'e2e_facts_tool', arguments: {} }, ctx)
    expect(executeSpy).toHaveBeenCalledTimes(1)
    expect(result.truncation).toEqual({
      truncated: true,
      originalBytes: 2048,
      returnedBytes: 256,
      budgetStrategy: 'truncate',
    })
    expect('truncationFacts' in result).toBe(false)
  })

  it('未报事实且未被预算裁剪的工具 ⇒ 结果不带任何截断断言(成对:不是恒报警)', async () => {
    const tool = makeFactsTool('e2e_clean_tool', 'plain', undefined)
    registerTools([tool])
    const result = await executeToolCall({ name: 'e2e_clean_tool', arguments: {} }, ctx)
    expect(result.truncation).toBeUndefined()
    expect('truncated' in (result.truncation ?? {})).toBe(false)
  })

  it('两笔截断同现(handler 事实 + 预算裁剪)⇒ 生产入口出来是一枚归并账,源字节不被改小', async () => {
    const rows = Array.from({ length: 60 }, (_, i) => `row-${i}`).join('\n')
    const contract = makeContract(
      makeBudget({ inlineLimitBytes: 50, preview: { bytes: 64, lines: 2, from: 'head' } }),
    )
    const executeSpy = vi.fn(async () => ({
      success: true as const,
      output: rows,
      truncationFacts: { originalBytes: 500_000, returnedBytes: 300_000, budgetStrategy: 'truncate' as const },
    }))
    registerTools([{ ...makeFactsTool('e2e_both_tool', rows, undefined), contract, execute: executeSpy }])

    const result = await executeToolCall({ name: 'e2e_both_tool', arguments: {} }, ctx)
    expect(executeSpy).toHaveBeenCalledTimes(1)
    // 散文两道都在(预算标注由 withToolResultBudget 收口时拼接)
    expect(result.output).toContain('[tool-result-budget]')
    // 账目归并成一枚:源字节取两者较大(handler 说的 500000 不得被本次 output 尺寸顶小),
    // 回传字节取最后一次的保留量;事实字段已被边界摘除。
    expect(result.truncation).toBeDefined()
    expect(result.truncation!.originalBytes).toBe(500_000)
    expect(result.truncation!.returnedBytes).toBeLessThan(500_000)
    expect(result.truncation!.truncated).toBe(true)
    expect('truncationFacts' in result).toBe(false)
  })
})

describe('applyToolResultBudget:预算裁剪也走同一枚账目', () => {
  const big = Array.from({ length: 60 }, (_, i) => `row-${i}`).join('\n')

  it('裁剪发生 ⇒ 账目记源字节与保留字节,散文注记原样保留', () => {
    const out = applyToolResultBudget(
      { success: true, output: big },
      makeBudget({ inlineLimitBytes: 50, preview: { bytes: 64, lines: 2, from: 'head' } }),
    )
    expect(out.output).toContain('[tool-result-budget]')
    expect(out.truncation).toBeDefined()
    expect(out.truncation!.truncated).toBe(true)
    expect(out.truncation!.originalBytes).toBe(Buffer.byteLength(big, 'utf8'))
    expect(out.truncation!.returnedBytes).toBeLessThan(out.truncation!.originalBytes)
    expect(out.truncation!.budgetStrategy).toBe('truncate')
    expect(out.truncation!.artifactPath).toBeUndefined()
  })

  it('声明 artifact 而存储未接线 ⇒ 记实际施加的 truncate(不得声称产出了一个不存在的文件)', () => {
    const out = applyToolResultBudget(
      { success: true, output: big },
      makeBudget({ policy: 'artifact', inlineLimitBytes: 50, preview: { bytes: 64, lines: 2, from: 'head' } }),
    )
    expect(out.output).toContain('truncate fallback')
    expect(out.truncation!.budgetStrategy).toBe('truncate')
    expect(out.truncation!.artifactPath).toBeUndefined()
  })

  it('归并:handler 已记的源字节不得被本次 output 尺寸改小', () => {
    const priorOriginal = 500_000
    const out = applyToolResultBudget(
      {
        success: true,
        output: big,
        truncation: { truncated: true, originalBytes: priorOriginal, returnedBytes: 1000, budgetStrategy: 'truncate' },
      },
      makeBudget({ inlineLimitBytes: 50, preview: { bytes: 64, lines: 2, from: 'head' } }),
    )
    expect(out.truncation!.originalBytes).toBe(priorOriginal)
    expect(out.truncation!.returnedBytes).toBeLessThan(priorOriginal)
  })

  it('未超限 ⇒ 不加记录(false 噪音的反面:什么都不写)', () => {
    const out = applyToolResultBudget({ success: true, output: 'tiny' }, makeBudget())
    expect(out.truncation).toBeUndefined()
  })
})

describe('read_file 字节闸:散文里的两个量落成字段(票面点名的站点)', () => {
  it('超限文件 ⇒ 字段与散文逐字同值,且结论由边界给出', async () => {
    const { dir, wsCtx } = mkWorkspace()
    const line = 'x'.repeat(200)
    const lineCount = Math.ceil(MAX_READ_BYTES / (line.length + 1)) + 50
    const body = Array.from({ length: lineCount }, (_, i) => `${i} ${line.slice(String(i).length)}`).join('\n')
    const abs = path.join(dir, 'big.txt')
    fs.writeFileSync(abs, `${body}\nTAIL-MUST-NOT-APPEAR`)
    const totalBytes = fs.statSync(abs).size
    expect(totalBytes).toBeGreaterThan(MAX_READ_BYTES)

    const result = await executeWithinExecBudget({ name: 'read_file' }, wsCtx, () =>
      read_file.execute({ path: 'big.txt' }, wsCtx),
    )
    expect(result.success).toBe(true)

    // ① 字段在位:源字节 = 文件真身,回传字节 = 实读的字节闸上限
    expect(result.truncation).toBeDefined()
    expect(result.truncation!.truncated).toBe(true)
    expect(result.truncation!.originalBytes).toBe(totalBytes)
    expect(result.truncation!.returnedBytes).toBe(MAX_READ_BYTES)
    expect(result.truncation!.budgetStrategy).toBe('truncate')
    expect('truncationFacts' in result).toBe(false)

    // ② 散文与字段逐字同值 —— 这两枚数一旦分叉,账目就成了自相矛盾的第二个真相
    const m = /truncated: file is (\d+) bytes, only the first (\d+) bytes/.exec(result.output)
    expect(m, `output 里应带散文注记:${result.output.slice(0, 80)}`).not.toBeNull()
    expect(Number(m![1])).toBe(result.truncation!.originalBytes)
    expect(Number(m![2])).toBe(result.truncation!.returnedBytes)
  })

  it('未超限的小文件 ⇒ 不带任何截断断言(成对:上限不是恒报警)', async () => {
    const { dir, wsCtx } = mkWorkspace()
    fs.writeFileSync(path.join(dir, 'small.txt'), 'one\ntwo\nthree')
    const result = await executeWithinExecBudget({ name: 'read_file' }, wsCtx, () =>
      read_file.execute({ path: 'small.txt' }, wsCtx),
    )
    expect(result.success).toBe(true)
    expect(result.truncation).toBeUndefined()
    expect(result.output).not.toContain('truncated:')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
