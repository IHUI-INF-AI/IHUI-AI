// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 能力二：上下文压缩后的信息保真。
 *
 * 被测对象是**真实实现**，不做任何重写：
 *  - apps/cli/src/compaction-v2.ts 的 compressContextV2 / isDegenerateSummary / reductionGuard
 *  - apps/cli/src/context.ts 的 estimateMessagesTokens（压缩前后 token 的统一估算口径）
 *
 * 唯一的模型侧替身是确定性 `CompactionSampler`：摘要正文写死在
 * fixtures/scenarios/compaction/long-history-facts.json，不含网络 / 时间 / 随机。
 *
 * 判据（全部来自压缩产物本身，不放宽）：
 *  1. 事实保真：被压缩的 head 里的事实必须进入摘要正文；保留尾部的事实必须逐字留在尾部；
 *  2. 工具对完整：assistant.tool_calls[].id ↔ tool.tool_call_id 严格按顺序配对，
 *     压缩后既无孤 tool 消息，也无悬空 tool_call；
 *  3. 退化摘要：空串 / 占位正文由真实 isDegenerateSummary 判退化，V2 不得采用
 *     （reason 必须是 sampler-failed，占位文本不得出现在上下文里）；
 *  4. 真省 token：estimateMessagesTokens 实测的压缩前后差值必须为正，且 reductionGuard 接受。
 */
import {
  compressContextV2,
  isDegenerateSummary,
  reductionGuard,
  type ChatMessage,
  type CompactionSampler,
} from '@cli/compaction-v2.js'
import { estimateMessagesTokens } from '@cli/context.js'

import { loadScenario } from '../fixtures.js'
import { createCase, type CaseBuilder } from '../harness.js'
import type { CaseResult } from '../types.js'

interface FactSpec {
  id: string
  needle: string
  origin: 'head' | 'tail'
}

interface CompactionScenario {
  schemaVersion: 1
  contextLimit: number
  maxOutputTokens: number
  messages: ChatMessage[]
  facts: FactSpec[]
  samplerSummary: string
  degenerateSamples: string[]
}

const SUMMARY_PREFIX = '[上下文摘要 —'
const SCENARIO_PATH = 'compaction/long-history-facts'

function loadCompactionScenario(): CompactionScenario {
  const scenario = loadScenario<CompactionScenario>(SCENARIO_PATH)
  if (!scenario || scenario.schemaVersion !== 1)
    throw new Error(`${SCENARIO_PATH}: schemaVersion 必须为 1`)
  if (typeof scenario.contextLimit !== 'number' || scenario.contextLimit <= 0) {
    throw new Error(`${SCENARIO_PATH}: contextLimit 必须是正数`)
  }
  if (typeof scenario.maxOutputTokens !== 'number' || scenario.maxOutputTokens <= 0) {
    throw new Error(`${SCENARIO_PATH}: maxOutputTokens 必须是正数`)
  }
  if (!Array.isArray(scenario.messages) || scenario.messages.length === 0) {
    throw new Error(`${SCENARIO_PATH}: messages 不能为空`)
  }
  if (!Array.isArray(scenario.facts) || scenario.facts.length === 0) {
    throw new Error(`${SCENARIO_PATH}: facts 不能为空`)
  }
  for (const fact of scenario.facts) {
    if (typeof fact.id !== 'string' || typeof fact.needle !== 'string' || !fact.needle) {
      throw new Error(`${SCENARIO_PATH}: fact 缺少 id / needle`)
    }
    if (fact.origin !== 'head' && fact.origin !== 'tail') {
      throw new Error(`${SCENARIO_PATH}: fact ${fact.id} 的 origin 必须是 head / tail`)
    }
  }
  if (typeof scenario.samplerSummary !== 'string' || scenario.samplerSummary.length === 0) {
    throw new Error(`${SCENARIO_PATH}: samplerSummary 不能为空`)
  }
  if (!Array.isArray(scenario.degenerateSamples) || scenario.degenerateSamples.length === 0) {
    throw new Error(`${SCENARIO_PATH}: degenerateSamples 不能为空`)
  }
  return scenario
}

function cloneMessages(messages: ChatMessage[]): ChatMessage[] {
  return JSON.parse(JSON.stringify(messages)) as ChatMessage[]
}

/** 确定性 sampler：固定返回夹具正文，并记录被请求压缩的消息（供证据用） */
function createFixtureSampler(response: string): {
  sampler: CompactionSampler
  received: ChatMessage[][]
} {
  const received: ChatMessage[][] = []
  const sampler: CompactionSampler = {
    async sampleCompaction(messages) {
      received.push(messages.map((m) => ({ ...m })))
      return { response }
    },
  }
  return { sampler, received }
}

/** 摘要消息正文（去掉首行「[上下文摘要 — 之前 N 条消息已压缩]」标记） */
function summaryBodyOf(content: string): string {
  const newline = content.indexOf('\n')
  return newline < 0 ? '' : content.slice(newline + 1)
}

/**
 * tool_call_id 严格配对扫描（按消息顺序）：
 *  - orphans：tool 消息的 tool_call_id 在前面找不到可用（未被消账）的 assistant tool_call；
 *  - dangling：assistant 声明了 tool_calls，但其后的 tool 结果没有全部到齐。
 */
interface PairReport {
  orphans: string[]
  dangling: string[]
  pairs: number
}

function pairReport(messages: ChatMessage[]): PairReport {
  const pending = new Map<string, number>()
  const orphans: string[] = []
  let pairs = 0
  for (const message of messages) {
    if (Array.isArray(message.tool_calls)) {
      for (const call of message.tool_calls) {
        const id = typeof call?.id === 'string' ? call.id : ''
        if (!id) continue
        pairs += 1
        pending.set(id, (pending.get(id) ?? 0) + 1)
      }
    }
    if (message.role === 'tool') {
      const id = typeof message.tool_call_id === 'string' ? message.tool_call_id : ''
      const available = pending.get(id) ?? 0
      if (available <= 0) {
        orphans.push(id || '<missing-tool-call-id>')
        continue
      }
      pending.set(id, available - 1)
    }
  }
  const dangling = [...pending.entries()].filter(([, count]) => count > 0).map(([id]) => id)
  return { orphans, dangling, pairs }
}

function pairIntegrityOk(report: PairReport): boolean {
  return report.orphans.length === 0 && report.dangling.length === 0
}

function findSummaryIndex(messages: ChatMessage[]): number {
  return messages.findIndex((m) => m.role === 'user' && m.content.startsWith(SUMMARY_PREFIX))
}

function checkPairIntegrity(
  builder: CaseBuilder,
  label: string,
  report: PairReport,
  detail: Record<string, unknown>,
): void {
  builder.check(label, pairIntegrityOk(report), {
    ...detail,
    orphans: report.orphans,
    dangling: report.dangling,
  })
}

/** 用例一：长对话压缩后，关键事实全部落在「保留尾部」或「摘要」里 */
async function longHistoryFactsCase(): Promise<CaseResult> {
  const builder = createCase('compaction.long-history-facts', 'compaction')
  const scenario = loadCompactionScenario()
  const input = cloneMessages(scenario.messages)
  const beforeTokens = estimateMessagesTokens(input)
  const probe = createFixtureSampler(scenario.samplerSummary)

  const result = await compressContextV2(input, {
    contextLimit: scenario.contextLimit,
    maxOutputTokens: scenario.maxOutputTokens,
    sampler: probe.sampler,
    // 回收阶段只把旧工具结果正文换成占位串（零模型请求），不属于摘要保真路径；
    // 本用例要判「摘要是否保住事实」，显式关闭回收，避免两件事混在一个结论里。
    reclaimEnabled: false,
  })

  const afterTokens = estimateMessagesTokens(result.messages)
  const summaryIndex = findSummaryIndex(result.messages)
  const summaryContent = summaryIndex >= 0 ? result.messages[summaryIndex]!.content : ''
  const summaryBody = summaryBodyOf(summaryContent)
  const tailMessages = summaryIndex >= 0 ? result.messages.slice(summaryIndex + 1) : []
  const tailContent = tailMessages.map((m) => m.content).join('\n')

  builder.check('真实实现触发了压缩', result.compressed === true, {
    compressed: result.compressed,
    trigger: result.trigger,
    reason: result.reason,
    messagesBefore: input.length,
    messagesAfter: result.messages.length,
  })
  builder.check(
    '压缩由 V2 摘要路径完成（未被 fallback 接管）',
    result.reason === 'above-threshold',
    result.reason,
  )
  builder.check('压缩产物包含摘要消息', summaryIndex >= 0, {
    summaryIndex,
    roles: result.messages.map((m) => m.role),
  })
  builder.check('采样器恰好被调用一次', probe.received.length === 1, probe.received.length)
  builder.check('压缩后 token 数与真实实现自报一致', afterTokens === result.compressedTokens, {
    afterTokens,
    compressedTokens: result.compressedTokens,
  })

  // 1) 事实保真：head 事实必须进摘要；tail 事实必须原样留在保留尾部
  let retained = 0
  const factEvidence: Array<Record<string, unknown>> = []
  for (const fact of scenario.facts) {
    const inSummary = summaryBody.includes(fact.needle)
    const inTail = tailContent.includes(fact.needle)
    if (fact.origin === 'head') {
      builder.check(`被压缩的 head 事实进入摘要: ${fact.id}`, inSummary, {
        needle: fact.needle,
        inSummary,
        inTail,
      })
    } else {
      builder.check(`保留尾部的事实逐字保留: ${fact.id}`, inTail, {
        needle: fact.needle,
        inSummary,
        inTail,
      })
    }
    if (inSummary || inTail) retained += 1
    factEvidence.push({ id: fact.id, origin: fact.origin, inSummary, inTail })
  }
  builder.check('全部事实均被保留', retained === scenario.facts.length, {
    retained,
    total: scenario.facts.length,
  })

  // 2) 尾部必须是原始消息的逐字后缀：压缩只允许改写 head
  const inputTail = input.slice(input.length - tailMessages.length)
  builder.check(
    '保留尾部与原始消息逐字节一致（只压 head）',
    tailMessages.length >= 6 && JSON.stringify(tailMessages) === JSON.stringify(inputTail),
    { tailLength: tailMessages.length, keepRecentFloor: 6 },
  )

  // 3) 摘要自身不得退化（真实判定函数）
  const summaryDegenerate = isDegenerateSummary(summaryBody)
  builder.check('摘要正文未被真实实现判为退化', summaryDegenerate === false, {
    summaryChars: summaryBody.length,
    summaryDegenerate,
  })

  // 4) tool_call ↔ tool 结果配对完整（压缩前夹具本身可判，压缩后必须仍然完整）
  const pairsBefore = pairReport(input)
  const pairsAfter = pairReport(result.messages)
  checkPairIntegrity(builder, '夹具自身 tool 配对完整', pairsBefore, {
    pairsBefore: pairsBefore.pairs,
  })
  checkPairIntegrity(builder, '压缩后无孤 tool 消息 / 无悬空 tool_call', pairsAfter, {
    pairsAfter: pairsAfter.pairs,
  })
  builder.check('压缩确实移除了配对组（不是空转）', pairsAfter.pairs < pairsBefore.pairs, {
    pairsBefore: pairsBefore.pairs,
    pairsAfter: pairsAfter.pairs,
  })

  // 5) 真省 token，且通过真实 reductionGuard
  const tokenReduction = beforeTokens - afterTokens
  const guard = reductionGuard(beforeTokens, afterTokens)
  builder.check('压缩后估算 token 下降', tokenReduction > 0, {
    beforeTokens,
    afterTokens,
    tokenReduction,
  })
  builder.check('reductionGuard 接受本次压缩', guard.accepted === true, {
    ratio: guard.ratio,
    beforeTokens,
    afterTokens,
  })

  builder.metric('compaction.retained_facts', retained)
  builder.metric('compaction.retention_ratio', retained / scenario.facts.length)
  builder.metric('compaction.compressed', result.compressed)
  builder.metric('compaction.degenerate_summary', summaryDegenerate)
  builder.metric('compaction.tool_pair_integrity', pairIntegrityOk(pairsAfter))
  builder.metric('compaction.token_reduction', tokenReduction)

  builder.evidence('summary_first_line', summaryContent.split('\n')[0] ?? '')
  builder.evidence('summary_chars', summaryBody.length)
  builder.evidence('facts', factEvidence)
  builder.evidence('messages_before', input.length)
  builder.evidence('messages_after', result.messages.length)
  builder.evidence('removed_count', result.removedCount)
  builder.evidence('tokens_before', beforeTokens)
  builder.evidence('tokens_after', afterTokens)
  builder.evidence('reduction_ratio', guard.ratio)
  builder.evidence('trigger', result.trigger)
  builder.evidence('reason', result.reason)
  builder.evidence('tool_pairs_before', pairsBefore.pairs)
  builder.evidence('tool_pairs_after', pairsAfter.pairs)
  builder.evidence('orphan_tool_call_ids', pairsAfter.orphans)
  builder.evidence('dangling_tool_call_ids', pairsAfter.dangling)
  builder.evidence('sampler_calls', probe.received.length)
  builder.evidence('sampler_input_count', probe.received[0]?.length ?? 0)
  builder.evidence('sampler_input_roles', probe.received[0]?.map((m) => m.role) ?? [])
  return builder.finish()
}

/** 用例二：空串 / 占位摘要必须被真实的退化守卫挡下，不得当成有效压缩 */
async function degenerateSummaryCase(): Promise<CaseResult> {
  const builder = createCase('compaction.degenerate-summary-guard', 'compaction')
  const scenario = loadCompactionScenario()

  const runs: Array<{
    sample: string
    beforeTokens: number
    afterTokens: number
    result: Awaited<ReturnType<typeof compressContextV2>>
    samplerCalls: number
    summaryIndex: number
    summaryBody: string
    pairReport: PairReport
  }> = []

  for (const sample of scenario.degenerateSamples) {
    const input = cloneMessages(scenario.messages)
    const beforeTokens = estimateMessagesTokens(input)
    const probe = createFixtureSampler(sample)
    const result = await compressContextV2(input, {
      contextLimit: scenario.contextLimit,
      maxOutputTokens: scenario.maxOutputTokens,
      // V2 的分母会扣掉输出预留，而 V1 fallback 只认 contextLimit 原值。本用例验证的是
      // 「退化摘要被真实守卫拒绝后走的 fallback」本身，显式关掉预留让两条路径共用同一个
      // 分母，避免把两条触发线的差异误读成压缩结果差异。
      outputReserveEnabled: false,
      sampler: probe.sampler,
      reclaimEnabled: false,
    })
    const afterTokens = estimateMessagesTokens(result.messages)
    const summaryIndex = findSummaryIndex(result.messages)
    const summaryBody =
      summaryIndex >= 0 ? summaryBodyOf(result.messages[summaryIndex]!.content) : ''
    runs.push({
      sample,
      beforeTokens,
      afterTokens,
      result,
      samplerCalls: probe.received.length,
      summaryIndex,
      summaryBody,
      pairReport: pairReport(result.messages),
    })
  }

  // 1) 退化判定来自真实实现，而不是用例自说自话
  const allDegenerate = runs.every((run) => isDegenerateSummary(run.sample))
  builder.check('空串 / 占位正文均被真实 isDegenerateSummary 判为退化', allDegenerate, {
    samples: runs.map((run) => ({
      sample: run.sample,
      degenerate: isDegenerateSummary(run.sample),
    })),
  })

  for (const run of runs) {
    const label = run.sample.trim() === '' ? '<空串>' : run.sample
    builder.check(
      `${label}: V2 未采用退化摘要（fallback 接管）`,
      run.result.reason === 'sampler-failed',
      {
        reason: run.result.reason,
        trigger: run.result.trigger,
      },
    )
    builder.check(
      `${label}: 采样器各只调用一次（无成功重试）`,
      run.samplerCalls === 1,
      run.samplerCalls,
    )

    // 退化正文绝不允许出现在上下文里（空串本身无法用 includes 判定，跳过该样本）
    const placeholder = run.sample.trim()
    const leaked =
      placeholder.length > 0 &&
      run.result.messages
        .map((m) => m.content)
        .join('\n')
        .includes(placeholder)
    builder.check(`${label}: 占位正文未写进上下文`, leaked === false, leaked)

    // 压缩成立时必须有非空摘要正文，且是 fallback 的结构化摘要（[role] 行）
    const structuredSummary =
      run.summaryBody.includes('[user]') ||
      run.summaryBody.includes('[assistant]') ||
      run.summaryBody.includes('[tool]')
    builder.check(
      `${label}: 压缩产物是 fallback 的结构化摘要（非空、非占位）`,
      run.result.compressed
        ? run.summaryIndex >= 0 && run.summaryBody.length > 0 && structuredSummary
        : run.summaryIndex === -1,
      {
        compressed: run.result.compressed,
        summaryIndex: run.summaryIndex,
        summaryChars: run.summaryBody.length,
        structuredSummary,
      },
    )

    checkPairIntegrity(builder, `${label}: fallback 压缩后 tool 配对完整`, run.pairReport, {
      pairsAfter: run.pairReport.pairs,
    })

    const reduction = run.beforeTokens - run.afterTokens
    builder.check(
      `${label}: token 账目自洽（压缩则下降、未压缩则相等）`,
      run.result.compressed ? reduction > 0 : reduction === 0,
      {
        compressed: run.result.compressed,
        beforeTokens: run.beforeTokens,
        afterTokens: run.afterTokens,
      },
    )
  }

  const firstRun = runs[0]!
  builder.metric('compaction.degenerate_summary', allDegenerate)
  builder.metric('compaction.compressed', firstRun.result.compressed)
  builder.metric(
    'compaction.tool_pair_integrity',
    runs.every((run) => pairIntegrityOk(run.pairReport)),
  )
  builder.metric('compaction.token_reduction', firstRun.beforeTokens - firstRun.afterTokens)

  builder.evidence(
    'runs',
    runs.map((run) => ({
      sample: run.sample,
      degenerate: isDegenerateSummary(run.sample),
      compressed: run.result.compressed,
      trigger: run.result.trigger,
      reason: run.result.reason,
      samplerCalls: run.samplerCalls,
      messagesAfter: run.result.messages.length,
      summaryChars: run.summaryBody.length,
      removedCount: run.result.removedCount,
      beforeTokens: run.beforeTokens,
      afterTokens: run.afterTokens,
      orphanToolCallIds: run.pairReport.orphans,
      danglingToolCallIds: run.pairReport.dangling,
    })),
  )
  return builder.finish()
}

export async function run(): Promise<CaseResult[]> {
  return [await longHistoryFactsCase(), await degenerateSummaryCase()]
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
