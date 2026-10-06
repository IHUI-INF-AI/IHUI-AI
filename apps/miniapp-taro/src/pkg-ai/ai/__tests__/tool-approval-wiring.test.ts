// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D136(2026-10-01 立)常驻判据:主对话流 `tool-approval` 帧在**小程序端**的落地成套性。
 *
 * 本端 vitest environment 是 'node'(无 DOM、@tarojs/components 不可渲染),所以"卡片真的渲染了
 * 什么"按端内既有纪律(见 cards/__tests__/terminal-interaction-degradation.test.ts 同一姿势)拆成
 * 两条互补的腿,两条都缺一腿就会留下"改了一堆没进渲染的东西,全绿而界面不变"的那一格:
 *  ① **进渲染的数据**:三档标签/载荷/记录行文本全部由纯函数产出,断言打在它们的返回值上;
 *  ② **接线自证**:源码级证明认领层→传输层→回调表→渲染位这条链每一环都真在位(把任一环改名
 *     或摘线,本用例必红)。
 *
 * 另含两条反向锁:close/cancel 不产生任何请求(本端没有"关闭"出口 ⇒ 断言渲染树上不存在该出口),
 * 以及**字段口径镜像锁** —— 端内认领层读的线字段必须与 api-client 那一腿读的逐字同集合
 * (两处各读一套是"跨端不同源"的成因,D113/D151 已经各栽过一次)。
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'

// 本端 environment 是 'node':@tarojs/taro 在 node 下加载即崩(dom-external 的
// ENABLE_INNER_HTML 未定义),而传输层 src/lib/sse.ts 顶部 import 它 —— 与
// src/lib/__tests__/sse.test.ts 同一套替身,只为把 SSEStreamParser 真跑起来。
vi.mock('@tarojs/taro', () => ({
  default: { getEnv: () => 'WEAPP', ENV_TYPE: { WEB: 'WEB' }, request: vi.fn() },
}))
vi.mock('@/utils/auth', () => ({ getToken: () => 'test-token' }))

import { SSEStreamParser } from '@/lib/sse'
import { parseToolApprovalLine } from '@/lib/tool-approval-frame'
import {
  APPROVAL_SCOPE_TIERS,
  appendApprovalRecord,
  buildApprovePayload,
  buildRejectPayload,
  dequeueApprovalRequest,
  enqueueApprovalRequest,
  offersManualOverride,
  resolveApprovalTexts,
  resolveApprovalTierLabels,
  resolveDangerLevelText,
  summarizeApprovalRecord,
  type ApprovalRecord,
  type ApprovalRequestView,
  type TranslateWithFallback,
} from '../tool-approval-text'

const HERE = dirname(fileURLToPath(import.meta.url))
const END_ROOT = resolve(HERE, '..', '..', '..', '..')
const REPO_ROOT = resolve(END_ROOT, '..', '..')

const src = (rel: string): string => readFileSync(join(END_ROOT, rel), 'utf8')
const CHAT_SRC = src('src/pkg-ai/ai/chat.tsx')
const API_SRC = src('src/api/index.ts')
const CARD_SRC = src('src/pkg-ai/ai/tool-approval-card.tsx')
const FRAME_SRC = src('src/lib/tool-approval-frame.ts')
const SSE_SRC = src('src/lib/sse.ts')
const API_CLIENT_SRC = readFileSync(
  join(REPO_ROOT, 'packages/api-client/src/client.ts'),
  'utf8',
)

function fakeTt(dict: Record<string, string> = {}): TranslateWithFallback {
  return (key, fallback) => dict[key] ?? fallback
}

const REQUEST: ApprovalRequestView = {
  approvalId: 'ap-1',
  toolName: 'run_command',
  toolCallId: 'tc-1',
  argsPreview: '{"command":"rm -rf /tmp/x"}',
  dangerLevel: 'high',
  sessionId: 's-9',
}

describe('D136 ① 三档作用域:逐档对齐 web,拒绝不带 scope', () => {
  it('三档齐(once/session/always),键就是 web 用的那三把共享键', () => {
    expect(APPROVAL_SCOPE_TIERS.map((t) => t.scope)).toEqual(['once', 'session', 'always'])
    expect(APPROVAL_SCOPE_TIERS.map((t) => t.key)).toEqual([
      'editor.toolApproval.scopeOnce',
      'editor.toolApproval.scopeSession',
      'editor.toolApproval.scopeAlways',
    ])
    // 反向对照:共享词包里这三把必须真取得到词,否则端内显示的只是中文兜底(parity 未做)
    for (const tier of APPROVAL_SCOPE_TIERS) {
      const zh = JSON.parse(
        readFileSync(join(REPO_ROOT, 'packages/i18n/messages/shared/zh-CN.json'), 'utf8'),
      ) as Record<string, { toolApproval?: Record<string, string> }>
      expect(typeof zh.editor?.toolApproval?.[tier.key.split('.').pop() as string]).toBe('string')
    }
  })

  it('三档逐个产出正确的回传载荷(decision=approve + 对应 scope + sessionId 寻址)', () => {
    for (const tier of APPROVAL_SCOPE_TIERS) {
      expect(buildApprovePayload(REQUEST, tier.scope)).toEqual({
        sessionId: 's-9',
        approvalId: 'ap-1',
        decision: 'approve',
        scope: tier.scope,
      })
    }
  })

  it('拒绝载荷**不得**带 scope 键,也不得带空 reason', () => {
    const payload = buildRejectPayload(REQUEST)
    expect(payload.decision).toBe('reject')
    expect('scope' in payload).toBe(false)
    expect(Object.keys(payload).sort()).toEqual(['approvalId', 'decision', 'sessionId'])
    expect(buildRejectPayload(REQUEST, '   ').reason).toBeUndefined()
    expect(buildApprovePayload(REQUEST, 'once', '  ').reason).toBeUndefined()
    expect(buildApprovePayload(REQUEST, 'always', ' 只读目录 ').reason).toBe('只读目录')
  })

  it('sessionId 缺席时载荷给空串而不是伪造一个(寻址不了就由回传那一腿判失败)', () => {
    const { sessionId: _omit, ...noSession } = REQUEST
    expect(buildApprovePayload(noSession, 'session').sessionId).toBe('')
  })
})

describe('D136 ② 进渲染的数据:档位标签 / 危险档 / 结算态文案', () => {
  it('词表齐时逐档取词,不吐 raw key', () => {
    const labels = resolveApprovalTierLabels(
      fakeTt({
        'editor.toolApproval.scopeOnce': 'ONCE',
        'editor.toolApproval.scopeSession': 'SESSION',
        'editor.toolApproval.scopeAlways': 'ALWAYS',
      }),
    )
    expect(labels.map((l) => l.label)).toEqual(['ONCE', 'SESSION', 'ALWAYS'])
  })

  it('缺键时回落端内中文(离线包过期时界面不得出现 editor.toolApproval.* 这类 raw key)', () => {
    const labels = resolveApprovalTierLabels(fakeTt({}))
    expect(labels.map((l) => l.label)).toEqual(['允许一次', '允许此对话', '始终允许'])
    const texts = resolveApprovalTexts(
      // tt 返回 raw key 的形状(词包缺键时 @ihui/shared 的 loader 就这么回)
      (key) => key,
    )
    for (const value of Object.values(texts)) {
      expect(value).not.toMatch(/^(ai|editor)\.toolApproval\./u)
    }
  })

  it('危险档三档都有中文措辞(后端英文枚举不得直接上界面)', () => {
    const tt = fakeTt({})
    expect(['high', 'medium', 'low'].map((l) => resolveDangerLevelText(l as 'high', tt))).toEqual([
      '高危',
      '中危',
      '低危',
    ])
  })

  it('结算态三档各说各的事实:"送出了"不等于"生效了"', () => {
    const texts = resolveApprovalTexts(fakeTt({}))
    const mk = (outcome: ApprovalRecord['outcome']): ApprovalRecord => ({
      ...REQUEST,
      toolName: REQUEST.toolName,
      decision: 'approve',
      scope: 'once',
      outcome,
      overrideCount: 0,
    })
    expect(summarizeApprovalRecord(mk('approved'), texts).text).toBe('已批准:该操作将执行')
    expect(summarizeApprovalRecord(mk('rejected'), texts).text).toBe('已拒绝:该操作未执行')
    // 送出失败必须是 warn 档且不得复用"已批准/已拒绝"任何一句
    const failed = summarizeApprovalRecord(mk('send-failed'), texts)
    expect(failed.tone).toBe('warn')
    expect(failed.text).not.toContain('已批准')
    expect(failed.text).not.toContain('已拒绝')
  })
})

describe('D136 ③ 队列与记录:关卡之后仍在,且人工放行出口不消失', () => {
  const rec = (over: Partial<ApprovalRecord>): ApprovalRecord => ({
    approvalId: 'ap-1',
    sessionId: 's-9',
    toolName: 'run_command',
    decision: 'reject',
    outcome: 'rejected',
    overrideCount: 0,
    ...over,
  })

  it('入队按 approvalId 去重、重复帧同一引用(无谓新引用=无谓重渲染)', () => {
    const once = enqueueApprovalRequest([], REQUEST)
    expect(once).toHaveLength(1)
    expect(enqueueApprovalRequest(once, REQUEST)).toBe(once)
    expect(enqueueApprovalRequest(once, { ...REQUEST, approvalId: '' })).toBe(once)
    expect(enqueueApprovalRequest(once, { ...REQUEST, approvalId: 'ap-2' })).toHaveLength(2)
  })

  it('决策后从队列摘掉,记录另存 —— 队列清空后记录仍可见(关卡不丢)', () => {
    const queue = enqueueApprovalRequest(enqueueApprovalRequest([], REQUEST), {
      ...REQUEST,
      approvalId: 'ap-2',
    })
    const afterFirst = dequeueApprovalRequest(queue, 'ap-1')
    expect(afterFirst.map((r) => r.approvalId)).toEqual(['ap-2'])
    const records = appendApprovalRecord([], rec({}))
    expect(records).toHaveLength(1)
    // 关掉卡(队列清空)后记录不减:页级持有,渲染在卡体外
    expect(dequeueApprovalRequest(afterFirst, 'ap-2')).toHaveLength(0)
    expect(records).toHaveLength(1)
  })

  it('同一条被人工放行重送时覆盖记录并累计次数,出口对未生效/被拒的条目恒在(§30)', () => {
    const rejected = appendApprovalRecord([], rec({}))
    expect(offersManualOverride(rejected[0] as ApprovalRecord)).toBe(true)
    // 第二次送出这一条(= 走过人工放行出口):页层按"prev 已有记录"上送 overrideCount: 1
    const overridden = appendApprovalRecord(
      rejected,
      rec({ outcome: 'approved', scope: 'once', overrideCount: 1 }),
    )
    expect(overridden).toHaveLength(1)
    expect(overridden[0]?.overrideCount).toBe(1)
    expect(overridden[0]?.outcome).toBe('approved')
    expect(offersManualOverride(overridden[0] as ApprovalRecord)).toBe(false)
    expect(
      offersManualOverride(rec({ outcome: 'send-failed', decision: 'approve', scope: 'always' })),
    ).toBe(true)
  })
})

describe('D136 ④ 帧认领与传输层:帧到设备不再静默丢弃', () => {
  const FRAME =
    'data: {"type":"tool-approval","approval_id":"ap-1","tool_name":"run_command","tool_call_id":"tc-1","args_preview":"{\\"command\\":\\"ls\\"}","danger_level":"high","session_id":"s-9"}'

  it('整行 → 视图字段逐字正确(snake→camel,danger_level 缺省 high)', () => {
    const evt = parseToolApprovalLine(FRAME)
    if (!evt) throw new Error('认领层一帧都没产出 ⇒ 本票要消灭的静默丢弃仍在')
    expect(evt).toMatchObject({
      type: 'tool-approval',
      approvalId: 'ap-1',
      toolName: 'run_command',
      toolCallId: 'tc-1',
      argsPreview: '{"command":"ls"}',
      dangerLevel: 'high',
      sessionId: 's-9',
    })
    expect(parseToolApprovalLine('data: {"type":"tool-approval","tool_name":"x"}')).toBeNull()
    expect(parseToolApprovalLine('data: {"type":"chunk","content":"hi"}')).toBeNull()
    expect(parseToolApprovalLine('data: not-json')).toBeNull()
    expect(
      parseToolApprovalLine(
        'data: {"type":"tool-approval","approval_id":"a","danger_level":"low"}',
      )?.dangerLevel,
    ).toBe('low')
  })

  it('半包不重复递、粘包不漏递(旁路观察点只在整行被消费后触发一次)', () => {
    const seen: string[] = []
    const parser = new SSEStreamParser((line) => seen.push(line))
    const head = 'data: {"type":"tool-approval","approval_id":"a"'
    const tail = ',"tool_name":"t"}\n\n'
    expect(parser.push(head)).toHaveLength(0)
    expect(seen).toEqual([])
    expect(parser.push(tail)).toHaveLength(0) // 共享解析面不认领这族帧 ⇒ events 里不该有它
    expect(seen).toHaveLength(1)
    const evt = parseToolApprovalLine(seen[0] as string)
    expect(evt?.approvalId).toBe('a')
    // 粘包:两条一次到,只各递一次
    seen.length = 0
    parser.push('data: {"type":"chunk","content":"x"}\n\ndata: {"type":"done"}\n\n')
    expect(seen).toHaveLength(2)
    // 收尾残余(末帧没有换行)也必须递出去
    seen.length = 0
    parser.push(head + ',"tool_name":"z"}')
    expect(seen).toEqual([])
    parser.flush()
    expect(seen).toHaveLength(1)
    expect(parseToolApprovalLine(seen[0] as string)?.toolName).toBe('z')
  })

  it('镜像锁:端内认领层读的线字段 = api-client 那一腿读的同一集合', () => {
    const wireKeys = [
      'approval_id',
      'tool_name',
      'tool_call_id',
      'args_preview',
      'danger_level',
      'session_id',
    ] as const
    for (const key of wireKeys) {
      // api-client 的 chat-stream 解析腿(权威口径)必须还在读这个键
      expect(API_CLIENT_SRC).toContain(`json.${key}`)
      // 端内认领层也必须读同一个键(漏一个 ⇒ 该字段在本端结构上永远是缺省值)
      expect(FRAME_SRC).toContain(`json.${key}`)
    }
    // 反向:共享解析面至今没认领这一族帧(本端认领层存在的理由,写死在这里防"改了共享面还留着两份")
    const sharedParse = readFileSync(
      join(REPO_ROOT, 'packages/shared/src/utils/sse-parse.ts'),
      'utf8',
    )
    expect(sharedParse).not.toContain("'tool-approval'")
  })
})

describe('D136 ⑤ 接线自证:回调表 → 渲染位 → 唯一回传出口', () => {
  it('api/index.ts 把整行旁路接进 streamSSE 并注册 onToolApproval(不注册就等于没接)', () => {
    expect(API_SRC).toContain('onRawLine:')
    expect(API_SRC).toContain('parseToolApprovalLine(line)')
    expect(API_SRC).toContain('callbacks.onToolApproval(evt)')
    expect(API_SRC).toContain('onToolApproval?: (evt: ToolApprovalEvent) => void')
    // 传输层必须有整行旁路出口(sse.ts):没有它认领层拿不到原始行,上面三条全是死字
    expect(SSE_SRC).toContain('onRawLine')
    // 决策回传走 @ihui/api-client,端内不另起传输层
    expect(API_SRC).toMatch(/export\s*\{[\s\S]{0,160}postToolApprovalResponse[\s\S]{0,80}\} from '@ihui\/api-client'/u)
  })

  it('chat.tsx 的回调表里有 onToolApproval 代码行,且真的入队', () => {
    expect(CHAT_SRC).toMatch(/^\s*onToolApproval: \(evt\) => \{$/mu)
    expect(CHAT_SRC).toContain('setApprovalQueue((prev) => enqueueApprovalRequest(prev, view))')
  })

  it('渲染位在,且卡片的三档/批准/拒绝/人工放行都真挂上数据', () => {
    expect(CHAT_SRC).toContain('<ToolApprovalCard')
    expect(CHAT_SRC).toContain('request={approvalQueue[0] ?? null}')
    expect(CHAT_SRC).toContain('records={approvalRecords}')
    expect(CARD_SRC).toContain('data-testid="tool-approval-card"')
    expect(CARD_SRC).toContain('data-testid={`tool-approval-scope-${tier.scope}`}')
    expect(CARD_SRC).toContain('data-testid="tool-approval-approve"')
    expect(CARD_SRC).toContain('data-testid="tool-approval-reject"')
    expect(CARD_SRC).toContain('data-testid="tool-approval-records"')
    expect(CARD_SRC).toContain('data-testid={`tool-approval-override-${record.approvalId}`}')
    expect(CARD_SRC).toContain('onDecision(buildRejectPayload(request))')
    expect(CARD_SRC).toContain('onDecision(buildApprovePayload(request, scope))')
  })

  it('没有"关闭/跳过"出口 —— 审批不能被关掉绕过(与 web 那侧同一结论)', () => {
    // 判据打在**剥注释后的代码面**上:卡片头注会逐字提到 web 的 onClose,拿原文匹配就是
    // 源码锁咬自己注释那一型(本仓记过一次)。
    const code = CARD_SRC.replace(/^\s*\/\/.*$/gmu, '').replace(/\/\*[\s\S]*?\*\//gmu, '')
    // 卡上除批准/拒绝/人工放行外不得出现任何 dismiss 出口
    expect(code).not.toMatch(/onClose|dismiss|setVisible\(false\)/u)
    // 反向对照:批准/拒绝两个出口确实在(否则"没有关闭"只是因为整张卡没做)
    expect(code).toContain('tool-approval-approve')
    expect(code).toContain('tool-approval-reject')
  })

  it('图标只取端内既有 LineIcon 资产,不用 emoji 顶替', () => {
    const icons = readFileSync(join(END_ROOT, 'src/components/LineIcon/icons.ts'), 'utf8')
    for (const name of ['triangle-alert', 'check-success', 'x-error']) {
      expect(icons).toContain(`'${name}':`)
      expect(CARD_SRC).toContain(`name="${name}"`)
    }
    expect(CARD_SRC).not.toMatch(/[👍👎✅❌⚠️🔒🛡]/u)
  })

  it('圆角只取 var(--radius-*) 单一真源,静态描边不取墨档', () => {
    const css = src('src/pkg-ai/ai/tool-approval-card.css')
    const radii = [...css.matchAll(/border-radius:\s*([^;]+);/g)].map((m) => m[1]?.trim())
    expect(radii.length).toBeGreaterThan(0)
    for (const value of radii) expect(value).toMatch(/^var\(--radius-(xs|sm|md|lg|xl|2xl)\)$/)
    // 墨档描边只允许出现在输入框聚焦态;本卡没有输入控件 ⇒ 一行都不许有
    expect(css).not.toMatch(/border[^;]*var\(--color-(primary|foreground)\)/u)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
