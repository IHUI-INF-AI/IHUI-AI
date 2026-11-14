// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 差距① 发送准入回执(admission)帧 · 小程序端接线锁(2026-11-13 立)。
 *
 * 立此锁的因由:本端此前**四条腿全缺** —— 发送体不带 `inputId`、不带
 * `metadata.conversationId`、共享解析层不认领 `admission`、dispatch 无该分支,
 * 于是服务端结构上永远不会向本端发出这一帧。台账里那句「本端四腿现读为凭」记的就是这台现场。
 *
 * 本锁钉四件事:
 *   ① 上行:`inputId` 进请求体,且**只有带 inputId 时**才补 `metadata.conversationId`
 *     (只补 inputId 的端拿到的是恒 accepted 常量 —— 那是没有信息量的出口);
 *   ② 解析:`parseAdmissionLine` 认这一族,且形状判据走共享层(端内不复制四档值域);
 *   ③ 分发:onRawLine 旁路真的把它交给 `onSendAdmissionReceipt`;
 *   ④ 呈现:回调把 queued/rejected/duplicate 上屏,而 accepted 不上屏
 *     (与"我发出去了"同义反复,重复报是噪音)。
 *
 * 反向对照:形状坏的载荷必须判 null(不许把解析失败读成 accepted)。
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { parseAdmissionLine } from '../src/lib/tool-approval-frame'

const ROOT = join(__dirname, '..')
const API = readFileSync(join(ROOT, 'src/api/index.ts'), 'utf8')
const CHAT = readFileSync(join(ROOT, 'src/pkg-ai/ai/chat.tsx'), 'utf8')

/** 造一行 admission SSE 文本 */
const line = (payload: Record<string, unknown>) => `data: ${JSON.stringify(payload)}`

describe('差距① 上行两把键(inputId + metadata.conversationId)', () => {
  it('inputId 声明在 options 侧(MiniappStreamOptions),不是 callbacks 侧', () => {
    // callbacks 接口里不该有 inputId —— 它是上行键,不是回调
    const callbacksStart = API.indexOf('export interface StreamEventCallbacks')
    const optionsStart = API.indexOf('export interface MiniappStreamOptions')
    expect(optionsStart).toBeGreaterThanOrEqual(0)
    const optionsBlock = API.slice(optionsStart, API.indexOf('}\n', optionsStart) + 2)
    // MiniappStreamOptions 是 extends ChatOptions 的短接口,inputId 可能在父接口里
    const hasInputId =
      optionsBlock.includes('inputId') || API.slice(0, callbacksStart).includes('inputId?: string')
    expect(hasInputId, 'inputId 必须能被 chatStream 的 options 接受').toBe(true)
  })

  it('buildBody 把 inputId 发上去', () => {
    expect(API).toContain('inputId: options.inputId,')
  })

  it('只有带 inputId 时才补 metadata.conversationId(否则请求体与改造前一致)', () => {
    // 判据:赋值必须出现在 `if (options.inputId !== undefined && sessionId)` 的分支里。
    // 反向断言不能写成"全文不得出现 md.conversationId = sessionId"(那会把正确实现也咬掉),
    // 而要写"该赋值不得出现在条件之外" —— 用缩进层级证明它在 if 体内。
    expect(API).toMatch(/if \(options\.inputId !== undefined && sessionId\) md\.conversationId = sessionId/)
    // 去掉那一条正确语句后,全文不得再有第二处给 conversationId 赋值(防"另起一路无条件补")
    const withoutBranch = API.replace(
      /if \(options\.inputId !== undefined && sessionId\) md\.conversationId = sessionId/g,
      '',
    )
    expect(withoutBranch).not.toMatch(/conversationId\s*=\s*sessionId/)
    // 且没有在别处无条件塞进 metadata 字面量
    expect(withoutBranch).not.toMatch(/metadata:\s*\{[^}]*conversationId/)
  })

  it('chat.tsx 用共享 createInputId() 生成,不自己造 id', () => {
    expect(CHAT).toContain("import { createInputId } from '@ihui/shared/chat/send-admission'")
    expect(CHAT).toContain('const roundInputId = createInputId()')
    expect(CHAT).toContain('inputId: roundInputId,')
    // 反向:端内不得自造 UUID/timestamp id
    expect(CHAT).not.toMatch(/const roundInputId = `in-/)
  })
})

describe('差距① 解析腿:走共享判据,不复制四档值域', () => {
  it('accepted 回执被认领', () => {
    const got = parseAdmissionLine(line({ type: 'admission', inputId: 'i-1', disposition: 'accepted' }))
    expect(got).not.toBeNull()
    expect(got?.disposition).toBe('accepted')
    expect(got?.inputId).toBe('i-1')
  })

  it('queued 回执带 ahead 与 queuedTurnId 时原样透传', () => {
    const got = parseAdmissionLine(
      line({ type: 'admission', inputId: 'i-2', disposition: 'queued', ahead: 2, queuedTurnId: 'q-9' }),
    )
    expect(got?.disposition).toBe('queued')
    expect(got?.ahead).toBe(2)
    expect(got?.queuedTurnId).toBe('q-9')
  })

  it('rejected 回执带 reason 时透传', () => {
    const got = parseAdmissionLine(
      line({ type: 'admission', inputId: 'i-3', disposition: 'rejected', reason: 'queue_full' }),
    )
    expect(got?.disposition).toBe('rejected')
    expect(got?.reason).toBe('queue_full')
  })

  it('反向:disposition 越界必须判 null(不许读成 accepted)', () => {
    expect(parseAdmissionLine(line({ type: 'admission', inputId: 'i-4', disposition: 'bogus' }))).toBeNull()
  })

  it('反向:inputId 空串或缺席必须判 null(没有配对标 = 不该留)', () => {
    expect(parseAdmissionLine(line({ type: 'admission', inputId: '', disposition: 'accepted' }))).toBeNull()
    expect(parseAdmissionLine(line({ type: 'admission', disposition: 'accepted' }))).toBeNull()
  })

  it('反向:非 admission 帧不得被误认(即使碰巧带 inputId+disposition)', () => {
    expect(parseAdmissionLine(line({ type: 'chunk', inputId: 'i-5', disposition: 'accepted' }))).toBeNull()
    expect(parseAdmissionLine('data: {"content":"hi"}')).toBeNull()
    expect(parseAdmissionLine('event: admission')).toBeNull()
    expect(parseAdmissionLine('')).toBeNull()
  })
})

describe('差距① 分发腿与呈现腿', () => {
  it('onRawLine 旁路把回执交给 onSendAdmissionReceipt', () => {
    expect(API).toContain('const admission = parseAdmissionLine(line)')
    expect(API).toContain('callbacks.onSendAdmissionReceipt(admission)')
  })

  it('呈现:accepted 不上屏新提示,其余三档上屏(否则回执落进没人读的内存键)', () => {
    expect(CHAT).toContain('onSendAdmissionReceipt: (receipt) => {')
    // accepted 档不进 pushStreamActivity(与"我发出去了"同义反复)
    expect(CHAT).toMatch(/if \(receipt\.disposition === 'accepted'\) \{/)
    // 其余走既有 pushStreamActivity(执行过程列表 = 有可见出口)
    expect(CHAT).toMatch(/pushStreamActivity\(text\)/)
  })

  /**
   * 晋升撤回(2026-11-13 立)。这是我自己引入过的一个真实缺陷:
   * queued 推进活动列表后,后端晋升时发 accepted —— 旧实现直接 return,
   * 那条"已排队"就**永久留在列表里**,用户看着"已排队"而回答早在跑。
   */
  it('晋升:accepted 必须按 queuedTurnId 撤回那条排队提示(否则提示永久停留)', () => {
    // 有配对表
    expect(CHAT).toContain('const queuedActivityRef = useRef<Record<string, string>>({})')
    // queued 时登记
    expect(CHAT).toMatch(/queuedActivityRef\.current\[receipt\.queuedTurnId\] = activityId/)
    // accepted 时撤回并清表
    expect(CHAT).toMatch(/dropStreamActivity\(queuedActivityRef\.current\[qid\]\)/)
    expect(CHAT).toMatch(/delete queuedActivityRef\.current\[qid\]/)
    // 撤回出口本身存在且按 id 过滤(签名现在跨行,按片段判)
    expect(CHAT).toContain('const dropStreamActivity = useCallback(')
    expect(CHAT).toMatch(/prev\.filter\(\(a\) => a\.id !== id\)/)
  })

  it('晋升撤回不得误伤其它活动(只在 qid 登记过时才动)', () => {
    // 条件是 `if (qid && queuedActivityRef.current[qid])` —— 两个守卫缺一不可:
    // 少了 qid 判断会把无 id 的 accepted 当成本轮排队;少了查表判断会删掉不存在的项
    expect(CHAT).toMatch(/if \(qid && queuedActivityRef\.current\[qid\]\)/)
  })

  it('呈现:词表用共享 streamErrors.admission.*,未命中原样回显处置码(不吞数据)', () => {
    expect(CHAT).toContain('streamErrors.admission.${receipt.disposition}')
    expect(CHAT).toMatch(/label === `streamErrors\.admission\.\$\{receipt\.disposition\}`/)
  })
})

describe('差距① 登记与门禁一致', () => {
  it('onSendAdmissionReceipt 已从小程序端 missing 台账删除', () => {
    const ledger = JSON.parse(
      readFileSync(join(ROOT, '..', '..', 'scripts/data/sse-dispatch-coverage.json'), 'utf8'),
    ) as { missing: Record<string, Record<string, string>> }
    expect(ledger.missing['miniapp-taro']).not.toHaveProperty('onSendAdmissionReceipt')
  })
})

/**
 * 中间态收回(2026-11-13 立)。
 *
 * queued 缺陷暴露了一个模式:**凡写未来时的提示,都必须有人收回**。
 * 本端还有两条同型:`onReconnect`("X 秒后重连")与 `onRetryScheduled`("X 秒后继续")。
 * 它们的共同点是条件一满足就失效,但文案不会自己改 —— 留在执行过程列表里会一直说"X 秒后"。
 */
describe('中间态提示必须有收回出口', () => {
  it('reconnect / retryScheduled 都是 pending 态,必须登记进 pendingActivityRef', () => {
    expect(CHAT).toContain('const pendingActivityRef = useRef<string[]>([])')
    // 两处都要 push(各自一条)
    const pushes = CHAT.match(/pendingActivityRef\.current\.push\(id\)/g) ?? []
    expect(pushes.length, 'reconnect 与 retryScheduled 各需 push 一次').toBe(2)
  })

  it('首个正文 delta 到达时撤回 pending 态(连接已通/重试已成功)', () => {
    // 判据:onDelta 内有清 pending 的代码,且在 batch(delta) 之前
    const deltaIdx = CHAT.indexOf('contentBatcher.batch(delta)')
    const drainIdx = CHAT.indexOf('pendingActivityRef.current.length > 0')
    expect(drainIdx, 'onDelta 内没有撤回 pending 的逻辑').toBeGreaterThan(0)
    expect(drainIdx).toBeLessThan(deltaIdx)
    // 撤回是"清 ref + 从列表过滤",两件都要做
    expect(CHAT).toMatch(/pendingActivityRef\.current = \[\]/)
    expect(CHAT).toMatch(/prev\.filter\(\(a\) => !stale\.includes\(a\.id\)\)/)
  })

  it('新一轮开始清列表时必须同批清配对表(否则 ref 残留无效 id)', () => {
    const clearIdx = CHAT.indexOf('setStreamActivities([])')
    expect(clearIdx).toBeGreaterThan(0)
    // 清列表之后的 200 字符内应能看到两张表的复位
    const after = CHAT.slice(clearIdx, clearIdx + 400)
    expect(after).toContain('pendingActivityRef.current = []')
    expect(after).toContain('queuedActivityRef.current = {}')
  })

  it('撤回只碰 pending 态,不碰已完成的实事实行', () => {
    // 反向:不得出现"清空整个 streamActivities"的撤回式写法(那会抹掉工具结果等事实)
    expect(CHAT).not.toMatch(/pendingActivityRef\.current\.length > 0\) \{\s*setStreamActivities\(\[\]\)/)
  })
})

/**
 * 工具活动行原位更新(2026-11-13 立)。
 *
 * 工具调用的 start 与 result 是**同一次调用**的两个阶段。旧实现两次都 push,
 * 活动列表里留下"调用中"与"已完成"两行,读起来像调用了两次。
 * card 层(toolCalls)早已按 toolCallId 原位 upsert,活动列表没跟上 —— 这套是本端特有
 * (web 端无 streamActivities),所以按 card 层同一语义收敛。
 */
describe('工具活动行必须原位更新,不留两行', () => {
  it('start 与 result 都走 upsert,toolCallId 作业务键', () => {
    const upserts = CHAT.match(/upsertStreamActivity\(/g) ?? []
    // start + result 两处(不含定义本身时是 2 次调用)
    expect(upserts.length, '工具 start/result 应各调一次 upsert').toBeGreaterThanOrEqual(2)
    expect(CHAT).toContain('`tool:${evt.toolCallId}`')
  })

  it('反向:带 toolCallId 的工具行不得再走 pushStreamActivity(那会留两行)', () => {
    // 收窄射程:onToolDelegate 是**一次性委派事件**且没有 toolCallId(载荷 id 恒空串),
    // 它本来就该 push 一行;这里只看"有 toolCallId 却用 push"的那两处。
    // 判据:onToolCallStart / onToolResult 两个回调块内不得出现 pushStreamActivity。
    const startIdx = CHAT.indexOf('onToolCallStart: (evt) => {')
    const resultIdx = CHAT.indexOf('onToolResult: (evt) => {')
    expect(startIdx).toBeGreaterThan(0)
    expect(resultIdx).toBeGreaterThan(startIdx)
    const startBlock = CHAT.slice(startIdx, CHAT.indexOf('onToolDelta:', startIdx))
    const resultBlock = CHAT.slice(resultIdx, CHAT.indexOf('onToolDelta:', resultIdx))
    expect(startBlock, 'start 仍在 push ⇒ 会留 running 行').not.toContain('pushStreamActivity(')
    expect(resultBlock, 'result 仍在 push ⇒ 会留完成行').not.toContain('pushStreamActivity(')
    // 且都用了 upsert
    expect(startBlock).toContain('upsertStreamActivity(')
    expect(resultBlock).toContain('upsertStreamActivity(')
  })

  it('upsert 必须处理"旧行已被 20 条上限裁掉"的情形', () => {
    // 若只更新不在列表里的 id,这次工具结果会静默不显示
    expect(CHAT).toContain('streamActivitiesRef.current.some((a) => a.id === existing)')
  })

  it('活动列表有唯一写入出口,state 与镜像 ref 同批更新', () => {
    expect(CHAT).toContain('const commitActivities = useCallback(')
    expect(CHAT).toMatch(/streamActivitiesRef\.current = next\s*\n\s*setStreamActivities\(next\)/)
    // 清空时镜像也要复位
    const clearIdx = CHAT.indexOf('setStreamActivities([])')
    expect(clearIdx).toBeGreaterThan(0)
    expect(CHAT.slice(clearIdx, clearIdx + 200)).toContain('streamActivitiesRef.current = []')
  })

  it('工具汇总一轮只一行(重复 summary 帧不堆行)', () => {
    expect(CHAT).toContain("'tool-summary'")
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
