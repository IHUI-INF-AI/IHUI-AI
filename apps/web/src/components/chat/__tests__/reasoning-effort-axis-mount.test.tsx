// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
//
// D130(2026-09-30 立)—— 推理强度第三轴的**装车证明 + 行为判据**。
//
// 这张票的病不是"没有控件",而是"控件写完了、零消费方":展示件 / store / 网关通道 / 后端接住
// 全都在盘上,typecheck、lint、单测一路绿,而用户选了档什么都没发生。这正是守门 64/70/81/115
// 反复记的那一型(组件在、判据对、无人调用)。所以本文件的①③两条**同时**判行为与挂载:
// 挂载那行(message-input 里的一句 JSX)被摘掉时,①③必红 —— 见每条里的 mountEvidence 判据。
//
// 取材口径:挂载判据读的是**被判文件的代码面**(剥注释后的原文,测试专用最小遮蔽器,
// 只用于"这行 JSX 还在不在"这一格)。注释里提到组件名不构成装车 —— 本仓最高频失效型就是
// "看起来有、其实没接"。
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ReasoningEffortInputAxis } from '@/components/chat/reasoning-effort-input-axis'
import { getSamplingParams, useSamplingParamsStore } from '@/stores/sampling-params'
import { useChatStore } from '@/stores/chat'
// D130⑦⑧:被审的**生产实现**(不是它的源码文本)—— 续答链跑一次才有"通知上没上屏"的结论。
import { createSendAnswer } from '@/hooks/use-chat/send-answer'
import type { ChatActionContext } from '@/hooks/use-chat/types'
import type { ReasoningEffortNotice, StreamChatOptions } from '@ihui/api-client'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const MESSAGE_INPUT_SRC = path.resolve(HERE, '..', 'message-input.tsx')
const SEND_MESSAGE_SRC = path.resolve(HERE, '..', '..', '..', 'hooks', 'use-chat', 'send-message.ts')
const WEB_SRC_ROOT = path.resolve(HERE, '..', '..', '..')
// D130 F1 补刀(2026-09-29 现读的两处确证缺口):② 续答链没带档位 ⇒ 同一条回复里
// "停止/重新生成/续答"把用户选的推理强度静默丢掉;① 传输层的回落通知类型没从包入口递出
// ⇒ 下一个 `import { ReasoningEffortNotice } from '@ihui/api-client'` 的人拿到 undefined
// (守门 149 那一型:入口是**显式命名清单**,漏一条编译期不一定红)。
const SEND_ANSWER_SRC = path.resolve(HERE, '..', '..', '..', 'hooks', 'use-chat', 'send-answer.ts')
// HERE = apps/web/src/components/chat/__tests__ ⇒ 上六层是仓库根(与本文件词包取径同一层数)
const API_CLIENT_INDEX_SRC = path.resolve(HERE, '../../../../../../packages/api-client/src/index.ts')
const API_CLIENT_SRC = path.resolve(HERE, '../../../../../../packages/api-client/src/client.ts')

/** 测试用词表:next-intl 换成**真词包**(packages/i18n/messages/web/zh-CN.json)。
 *  不用 `key=>key` 的桩 —— 那样文案断言会退化成"键名相等",新键漏进词包也测不出(§19)。 */
vi.mock('next-intl', async () => {
  const { formatIcu: renderIcu } = await import('@ihui/i18n')
  const { readFileSync: readFile } = await import('node:fs')
  const { dirname: dir, join: cat } = await import('node:path')
  const { fileURLToPath: toPath } = await import('node:url')
  const pack = cat(dir(toPath(import.meta.url)), '../../../../../../packages/i18n/messages/web/zh-CN.json')
  const root = JSON.parse(readFile(pack, 'utf8')) as Record<string, unknown>
  const resolve = (ns: string): Record<string, unknown> | undefined =>
    ns
      .split('.')
      .reduce<Record<string, unknown> | undefined>(
        (node, part) =>
          node && typeof node === 'object' ? (node[part] as Record<string, unknown>) : undefined,
        root,
      )
  return {
    useTranslations:
      (ns: string) =>
      (key: string, values?: Record<string, string | number>): string => {
        const raw = resolve(ns)?.[key]
        if (typeof raw !== 'string' || raw === '') return key
        return renderIcu(raw, values ?? {}, { locale: 'zh-CN' })
      },
    useLocale: () => 'zh-CN',
  }
})

/** 模型能力口的测试替身:置灰判据的输入只有 capabilities,所以这一格必须可造三种态。 */
const fetchSelectorModelsMock = vi.fn(
  async (): Promise<Array<{ id: string; capabilities?: unknown }>> => [
    { id: 'gpt-test', capabilities: { reasoning: true } },
  ],
)
vi.mock('@/lib/models-api', () => ({
  fetchSelectorModels: () => fetchSelectorModelsMock(),
}))

// D130⑦⑧(2026-09-29 补,F1 最后一格):①②两条判据要**真的跑一次续答**,而不是读源码。
// 只把传输层的 `streamChat` 换成可编程替身 —— `importOriginal` 保留其余全部导出
// (getModelContextCapacity / formatSSEError / getMessages / postToolResult 与 send-answer
// 的整条 import 面照旧可达),所以"通知帧 → store"是跑出来的结论。
// 用 vi.hoisted:工厂在 import 阶段执行,普通 const 那时还没初始化。
const { streamChatMock } = vi.hoisted(() => ({ streamChatMock: vi.fn() }))
vi.mock('@ihui/api-client', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, streamChat: (options: unknown) => streamChatMock(options) }
})

// ---------------------------------------------------------------------------
// 判据用的小工具
// ---------------------------------------------------------------------------

/** 剥掉行注释与块注释(不碰字符串字面量 —— 挂载判据要看的正是引号里的模块说明符)。
 *  逐行扫:双斜杠之后的内容丢弃;跨行的块注释段整体丢弃。 */
function codeFace(src: string): string {
  const out: string[] = []
  let inBlock = false
  for (const line of src.split(/\r?\n/)) {
    let text = ''
    for (let i = 0; i < line.length; i += 1) {
      const two = line.slice(i, i + 2)
      if (inBlock) {
        if (two === '*/') {
          inBlock = false
          i += 1
        }
        continue
      }
      if (two === '//') break
      if (two === '/*') {
        inBlock = true
        i += 1
        continue
      }
      text += line[i]
    }
    out.push(text)
  }
  return out.join('\n')
}

/** 从 `streamChat({` 起做括号配平,取出**那一次调用的实参对象文本**。
 *  判"传没传 reasoningEffort"必须在这一个对象里判 —— 全文搜到键名会把它处的同名键算进来。 */
function callArgObject(src: string, callName: string): string | null {
  const at = src.indexOf(`${callName}({`)
  if (at === -1) return null
  let depth = 0
  let started = false
  for (let i = at + callName.length; i < src.length; i += 1) {
    const ch = src[i]
    if (ch === '{') {
      depth += 1
      started = true
    } else if (ch === '}') {
      depth -= 1
      if (started && depth === 0) return src.slice(at + callName.length + 1, i + 1)
    }
  }
  return null
}

/** 挂载判据(①③共用):message-input 必须**既 import 又真的在 JSX 里挂上**这句。
 *  反向对照要的就是这两条 —— 摘掉 JSX 那一行,①③ 一起红。 */
function mountEvidence(): { imported: boolean; mounted: boolean } {
  const face = codeFace(fs.readFileSync(MESSAGE_INPUT_SRC, 'utf8'))
  return {
    imported:
      /import\s*\{[^}]*\bReasoningEffortInputAxis\b[^}]*\}\s*from\s*['"]@\/components\/chat\/reasoning-effort-input-axis['"]/.test(
        face,
      ),
    mounted: /<ReasoningEffortInputAxis\b[\s\S]{0,160}?model=\{model\}/.test(face),
  }
}

function tierButtons(): HTMLButtonElement[] {
  return ['minimal', 'low', 'medium', 'high']
    .map((t) => screen.queryByTestId(`reasoning-effort-${t}`))
    .filter((el): el is HTMLButtonElement => el !== null)
}

async function renderAxis(model = 'gpt-test') {
  render(<ReasoningEffortInputAxis model={model} />)
  await waitFor(() => expect(tierButtons()).toHaveLength(4))
}

beforeEach(() => {
  window.localStorage.clear()
  fetchSelectorModelsMock.mockReset()
  fetchSelectorModelsMock.mockResolvedValue([{ id: 'gpt-test', capabilities: { reasoning: true } }])
  useSamplingParamsStore.setState({ defaults: {}, byConversation: {} })
  useChatStore.getState().setReasoningEffortNotice(null)
})

afterEach(() => {
  cleanup()
  useSamplingParamsStore.setState({ defaults: {}, byConversation: {} })
  useChatStore.getState().setReasoningEffortNotice(null)
})

describe('D130① 选档 ⇒ 请求真的带该值(链路两端 + 挂载)', () => {
  it('点档位 ⇒ 会话级参数快照里落该档,且发送链把同一个快照字段喂进 streamChat', async () => {
    const mount = mountEvidence()
    expect(mount.imported).toBe(true)
    // 这一条就是反向对照的靶心:把 message-input 里那句 <ReasoningEffortInputAxis/> 摘掉 ⇒ 红
    expect(mount.mounted).toBe(true)

    await renderAxis()
    act(() => {
      fireEvent.click(screen.getByTestId('reasoning-effort-high'))
    })
    // 控件 → store(与 temperature/topP 同一份快照,不是另起一套实时值)
    expect(getSamplingParams(null).reasoningEffort).toBe('high')

    // store → 请求:发送链必须在 streamChat 的**实参对象里**带 reasoningEffort,
    // 且取的就是那份快照 —— 括号配平取对象,不对全文搜键名(键名在别处出现不算传过)。
    const face = codeFace(fs.readFileSync(SEND_MESSAGE_SRC, 'utf8'))
    const args = callArgObject(face, 'streamChat')
    expect(args).not.toBeNull()
    const passed = /reasoningEffort:\s*([A-Za-z_][\w.]*)/.exec(args ?? '')
    expect(passed, 'streamChat 实参里没有 reasoningEffort 这一档 ⇒ 选了档也进不了请求').not.toBeNull()
    expect(passed![1]).toMatch(/^samplingParams\.reasoningEffort$|^params\.reasoningEffort$/)
    // 同一份快照的另一半:那个标识符必须由 getSamplingParams(conversationId) 得到
    expect(/const\s+samplingParams\s*=\s*getSamplingParams\(conversationId\)/.test(face)).toBe(true)
  })

  it('再点一次同一档 ⇒ 清除选择(回到默认档),快照里不再带该键', async () => {
    await renderAxis()
    act(() => {
      fireEvent.click(screen.getByTestId('reasoning-effort-low'))
    })
    expect(getSamplingParams(null).reasoningEffort).toBe('low')
    act(() => {
      fireEvent.click(screen.getByTestId('reasoning-effort-low'))
    })
    expect(getSamplingParams(null).reasoningEffort).toBeUndefined()
    expect('reasoningEffort' in getSamplingParams(null)).toBe(false)
  })
})

describe('D130② 置灰只由 capabilities.reasoning 决定(未知不误藏)', () => {
  it('capabilities 整体缺失(老后端/拉取失败)⇒ 不置灰', async () => {
    fetchSelectorModelsMock.mockResolvedValue([])
    await renderAxis()
    const axis = screen.getByTestId('reasoning-effort-axis')
    expect(axis.getAttribute('data-selectable')).toBe('true')
    // 未知不误藏:一个档位都不许 disable(藏了等于替用户做了"不支持"的结论)
    expect(tierButtons()).toHaveLength(4)
    expect(tierButtons().every((b) => !b.disabled)).toBe(true)
    expect(screen.queryByTestId('reasoning-effort-unsupported')).toBeNull()
  })

  it('capabilities 在位而 reasoning 不为 true ⇒ 逐档置灰并给原因文案', async () => {
    fetchSelectorModelsMock.mockResolvedValue([{ id: 'gpt-test', capabilities: { vision: true } }])
    await renderAxis()
    const axis = screen.getByTestId('reasoning-effort-axis')
    expect(axis.getAttribute('data-selectable')).toBe('false')
    expect(tierButtons().every((b) => b.disabled)).toBe(true)
    expect(screen.getByTestId('reasoning-effort-unsupported').textContent).toBe(
      '该模型不支持选择推理强度',
    )
  })

  it('reasoning:true ⇒ 可用;模型不在列表里同样按"未知"不藏', async () => {
    await renderAxis()
    expect(screen.getByTestId('reasoning-effort-axis').getAttribute('data-selectable')).toBe('true')

    fetchSelectorModelsMock.mockResolvedValue([{ id: 'other-model', capabilities: {} }])
    cleanup()
    // 选中的模型不在列表里(新接入的模型 / 列表还没刷到)⇒ 拿不到能力位 = **未知**,
    // 轴必须照常可用;把它读成"不支持"就是替用户下了后端没给的结论。
    await renderAxis('gpt-test')
    expect(screen.getByTestId('reasoning-effort-axis').getAttribute('data-selectable')).toBe('true')
    expect(tierButtons().every((b) => !b.disabled)).toBe(true)
  })
})

describe('D130③ 后端钉档回落必须上屏可见', () => {
  it('store 里有回落通知 ⇒ 轴上出现 requested→effective,且挂载点在输入区', async () => {
    const mount = mountEvidence()
    expect(mount.mounted).toBe(true) // 摘掉挂载那行 ⇒ 本条必红

    useChatStore.getState().setReasoningEffortNotice({
      requested: 'high',
      effective: 'low',
      fallback: true,
      reason: 'pinned',
    })
    await renderAxis()
    const notice = screen.getByTestId('reasoning-effort-fallback')
    expect(notice.textContent).toContain('high')
    expect(notice.textContent).toContain('low')
    // 真词包(不是键名桩):断言的是文案本身,新键没进语言包这里就红
    expect(notice.getAttribute('role')).toBe('status')
  })

  it('没有回落 ⇒ 轴上什么都不挂(不给一条假提示)', async () => {
    await renderAxis()
    expect(screen.queryByTestId('reasoning-effort-fallback')).toBeNull()
    expect(screen.queryByTestId('reasoning-effort-unsupported')).toBeNull()
  })
})

describe('D130④ 端内不得有第二份档位字面量', () => {
  const TIERS = ['minimal', 'low', 'medium', 'high'] as const

  function walk(dirPath: string): string[] {
    const out: string[] = []
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      const full = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === 'tests' || entry.name === 'node_modules') continue
        out.push(...walk(full))
      } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec)\.(ts|tsx)$/.test(entry.name)) {
        out.push(full)
      }
    }
    return out
  }

  /** 结构判据:**同一个构造**(数组字面量 / 联合类型段 / z.enum)里成规模地出现档位字面量,
   *  才算"第二份档位表"。裸子串判据(文件里出现 'high')在这里一律不成立 —— 现测 web 生产面
   *  有 14 个文件把 low/medium/high 用作**优先级/风险**词表(KanbanBoard、RiskBadge、
   *  context-usage-ring 等),按裸子串判就会把这张票的门钉成恒红,唯一结局是逼人绕过钩子。
   *  两条特征各自有牙:
   *   A) 同一构造里含 `minimal` 且另有 ≥1 个档名 —— minimal 是推理强度独有的档;
   *   B) 所在声明的名字带 effort/reasoning 语义,且构造里 ≥2 个档名 —— 专抓"抄了一份但漏了 minimal"。 */
  function scanFace(face: string, label: string): string[] {
    const hits: string[] = []
    const nameish = /reasoning|effort/i
    const patterns = [/\[[^\[\]\n]*\]/g, /=\s*([^\n=;]*\|[^\n=;]*)/g]
    for (const re of patterns) {
      for (const m of face.matchAll(re)) {
        const text = m[0]
        const found = TIERS.filter((t) => new RegExp(`['"\`]${t}['"\`]`).test(text))
        if (found.length < 2) continue
        const declared = nameish.test(face.slice(Math.max(0, (m.index ?? 0) - 200), m.index ?? 0))
        const distinctive = found.includes('minimal')
        if (distinctive || declared) {
          hits.push(`${label} ⇒ ${found.join(',')} (${text.slice(0, 60)})`)
        }
      }
    }
    return hits
  }

  function secondTableHits(file: string): string[] {
    return scanFace(codeFace(fs.readFileSync(file, 'utf8')), path.relative(WEB_SRC_ROOT, file))
  }

  /** 判据有牙证明:构造面(不是仓库文件)必须能命中 —— 一段真抄的档位表要被抓到,
   *  而 low/medium/high 的**优先级/风险**词表不得被抓到。用纯函数 + 构造面,不落任何临时文件。 */
  it('判据自身:抄一份档位表必被抓到,优先级词表不得误伤', () => {
    const offenders = [
      `const EFFORTS = ['minimal', 'low', 'medium', 'high']\n`,
      `type ReasoningEffort = 'minimal' | 'low' | 'medium' | 'high'\n`,
      `const reasoningEfforts = ['low', 'medium', 'high']\n`,
    ]
    const ok = [
      `const PRIORITY = ['low', 'normal', 'high', 'urgent']\n`,
      `type Risk = 'low' | 'medium' | 'high'\nexport const RISK_LEVELS: Risk[] = ['low', 'medium', 'high']\n`,
    ]
    expect(offenders.map((t) => scanFace(codeFace(t), 'probe').length)).toEqual([1, 1, 1])
    expect(ok.map((t) => scanFace(codeFace(t), 'probe').length)).toEqual([0, 0])
  })

  it('apps/web/src 生产面没有任何第二份档位集合', () => {
    const files = walk(WEB_SRC_ROOT)
    expect(files.length).toBeGreaterThan(50) // 扫不到面 = 判据空转,不接受"0 命中即通过"
    const offenders = files.filter((f) => secondTableHits(f).length > 0)
    expect(offenders.map((f) => `${path.relative(WEB_SRC_ROOT, f)}: ${secondTableHits(f).join(' | ')}`)).toEqual(
      [],
    )
  })
})

// ---------------------------------------------------------------------------
// F1 补刀(2026-09-29):两处现读确证的缺口 —— 判据先立,接线后必须绿
// ---------------------------------------------------------------------------

/** 从某个 use-chat 文件的 `streamChat({…})` **实参对象内**取出 reasoningEffort 的取值表达式。
 *  返回 null = 那一次调用根本没带这一档(不是"全文搜不到键名",那会把它处的同名键算进来)。
 *  第二项 = 档位是不是**发送时快照字段**(而非端内自抄的字面量)。 */
function effortArgOf(file: string): { expr: string | null; fromSnapshot: boolean } {
  const face = codeFace(fs.readFileSync(file, 'utf8'))
  const args = callArgObject(face, 'streamChat')
  if (args === null) return { expr: null, fromSnapshot: false }
  const m = /reasoningEffort:\s*([A-Za-z_][\w.]*)/.exec(args)
  const literal = /reasoningEffort:\s*['"](minimal|low|medium|high)['"]/.test(args)
  return { expr: m?.[1] ?? null, fromSnapshot: m !== null && !literal }
}

describe('D130⑤ 续答链必须带与首答**同一来源**的推理强度档位(F1 缺口二)', () => {
  it('send-answer 的 streamChat 实参带 reasoningEffort,取值表达式与 send-message 逐字相同', () => {
    const first = effortArgOf(SEND_MESSAGE_SRC)
    const again = effortArgOf(SEND_ANSWER_SRC)
    // 首答那一侧是既有判据(上面①已锁),这里只把它当**基准**读,不重复判它
    expect(first.expr, '基准丢失:send-message 不再从快照取档 ⇒ 本条的比较没有意义').not.toBeNull()
    expect(
      again.expr,
      '续答请求体没带 reasoningEffort ⇒ 用户选的推理强度在"续答"这一轮被静默丢掉(同一条回复里 停止/重新生成/续答 会换档)',
    ).not.toBeNull()
    // "同一来源"判的是**表达式逐字等值**,不是"两边各自看起来像快照字段" ——
    // 后者会让续答读实时值、首答读快照而两条都过(流途中改档即分叉,两边都读不出错)。
    expect(again.expr).toBe(first.expr)
    expect(again.fromSnapshot, '档位取值不得是端内抄的字面量').toBe(true)
    // 那个标识符在两个文件里都必须由同一份会话级快照得到(§"两处算同一件事必须共用一份实现")
    for (const file of [SEND_MESSAGE_SRC, SEND_ANSWER_SRC]) {
      const face = codeFace(fs.readFileSync(file, 'utf8'))
      expect(
        /const\s+samplingParams\s*=\s*getSamplingParams\(/.test(face),
        `${path.basename(file)}: samplingParams 不是 getSamplingParams(...) 的产物 ⇒ 上面那条等值只比了个名字`,
      ).toBe(true)
    }
  })

  it('判据自身:摘掉那行接线 ⇒ 必红(有牙证明,不接受恒绿)', () => {
    // 构造面(不碰真文件):同一份 callArgObject 判据喂"带档"与"没带档"两份文本,
    // 前者必须取出表达式、后者必须是 null —— 否则上面那条红的断言只是运气好。
    const withTier = 'streamChat({\n model: m,\n reasoningEffort: samplingParams.reasoningEffort,\n})'
    const withoutTier = 'streamChat({\n model: m,\n temperature: samplingParams.temperature,\n})'
    const probe = (src: string): string | null => {
      const args = callArgObject(src, 'streamChat')
      return /reasoningEffort:\s*([A-Za-z_][\w.]*)/.exec(args ?? '')?.[1] ?? null
    }
    expect(probe(withTier)).toBe('samplingParams.reasoningEffort')
    expect(probe(withoutTier)).toBeNull()
  })
})

describe('D130⑥ ReasoningEffortNotice 必须从 @ihui/api-client 入口递出(F1 缺口一)', () => {
  /** 入口是**显式命名清单**;只在 `from './client.js'` 那几个清单里判(全文搜名字会把它处
   *  的同名标识符 —— 例如 client.ts 里的注释或形参 —— 算成"已递出")。 */
  function clientListBlocks(file: string, typeOnly: boolean): string[] {
    const face = codeFace(fs.readFileSync(file, 'utf8'))
    const re = typeOnly
      ? /export\s+type\s*\{([^}]*)\}\s*from\s*['"]\.\/client\.js['"]/g
      : /export\s*\{([^}]*)\}\s*from\s*['"]\.\/client\.js['"]/g
    return [...face.matchAll(re)].map((m) => m[1] ?? '')
  }

  it('client.ts 真导出该类型(否则入口递出的是个不存在的名字)', () => {
    const face = codeFace(fs.readFileSync(API_CLIENT_SRC, 'utf8'))
    expect(
      /export\s+(?:interface|type)\s+ReasoningEffortNotice\b/.test(face),
      'client.ts 不再 export ReasoningEffortNotice ⇒ 下面的入口清单判据等于在给空气背书',
    ).toBe(true)
  })

  it('packages/api-client/src/index.ts 的类型清单里含 ReasoningEffortNotice 与 StreamChatOptions', () => {
    const blocks = clientListBlocks(API_CLIENT_INDEX_SRC, true)
    // 枚举到 0 个清单 = 判据空转(守门 149/98 同一条禁令:扫不到面不接受"0 命中即通过")
    expect(blocks.length, '入口找不到 `export type {…} from ./client.js` 清单 ⇒ 尺子没扫到面').toBeGreaterThan(0)
    const joined = blocks.join(',')
    expect(
      /\bReasoningEffortNotice\b/.test(joined),
      'ReasoningEffortNotice 没从 barrel 递出:本包入口是显式命名清单,漏一条端内拿到 undefined,而 `next.config.ts` 的 ignoreBuildErrors 吞掉 TS2724(守门 149 记过的同一型)',
    ).toBe(true)
    // onReasoningEffortNotice 是 StreamChatOptions 的**字段**(不是独立符号),所以递出
    // StreamChatOptions 就是递出这个回调的入参类型 —— 点名它是为了锁住"别再按名字找符号"。
    expect(/\bStreamChatOptions\b/.test(joined), 'StreamChatOptions 未递出 ⇒ onReasoningEffortNotice 无处可取类型').toBe(true)
  })
})

// ---------------------------------------------------------------------------
// D130⑦⑧(2026-09-29 补):续答链的档位回落通知 —— 报告 §6.4-2 点名的最后一格。
//
// 病形:⑤ 补上行了(续答请求体带档),但**下行**没接 —— 后端把 high 钉回默认档时,
// 首答那一轮轴上会喊,续答这一轮什么都不说;而 typecheck / lint / 其余门全绿
// (回调字段是可选的,不注册就是 api-client 侧 `typeof opts.onReasoningEffortNotice === 'function'`
// 判假、整帧不解析,连一次错误都不产生)。所以本节的前两条用例**跑真的 sendAnswer**,
// 只把 streamChat 换成替身(见文件顶部 importOriginal 工厂),判据落在 store + 轴上。
//
// 本节第三条用源码面比**逐字等值**:行为面证不了"没抄第二份文案 / 没另起第二个 store 键"
// —— 那两型在运行时的表现与正确写法完全相同,只有写法本身能暴露(§"两处算同一件事必须共用一份实现")。
// ---------------------------------------------------------------------------

/** 后端钉档时 api-client 会回调的那一份 info(与 ReasoningEffortNotice 同形,不做二次判等)。 */
const PINNED_NOTICE: ReasoningEffortNotice = {
  requested: 'high',
  effective: 'low',
  fallback: true,
  reason: 'pinned',
}

/** sendAnswer 只解构 ctx 的 5 个字段,其余按 ChatActionContext 类型补齐(不给 any 兜底,AGENTS §3)。 */
function makeChatActionContext(): ChatActionContext {
  return {
    t: (key: string) => key,
    router: {} as ChatActionContext['router'],
    queryClient: {} as ChatActionContext['queryClient'],
    setFallbackNotice: vi.fn(),
    abortRef: { current: null },
    lastSentContentRef: { current: '' },
    lastSentAnswerRef: { current: null },
    sendInFlightRef: { current: false },
    streamGenerationRef: { current: 0 },
    streamConversationRef: { current: null },
  }
}

/** 挂一个挂起提问后**真的**跑一次续答(等价于用户在 AI 提问弹窗里点了"回答")。
 *  **刻意不在这里收尾清理**:`clearMessages()` 会把 reasoningEffortNotice 一起归零
 *  (store 里那条"新建对话必须清掉上一轮钉档"的判据),把它放进 finally 就等于
 *  在断言之前把被断言的东西擦掉 —— ⑦ 会假红、⑧ 的第二条会假绿。
 *  回收由用例自己在断言之后调 `resetChatRunState()` 做。 */
async function runSendAnswer(ctx: ChatActionContext): Promise<void> {
  const store = useChatStore.getState()
  store.setPendingQuestion({
    questionId: 'q-d130',
    prompt: '需要你确认一下',
    options: [{ id: 'a', label: 'A' }],
    allowCustom: true,
    allowMultiple: false,
  })
  await createSendAnswer(ctx)('我的续答内容')
}

/** 跑完之后回收:消息/提问/通知都归位,免得污染同一文件里其它用例共用的 store 单例。
 *  走 store 自己的出口(clearMessages 内含 RUN_SCOPED_RESET + reasoningEffortNotice 那份清单),
 *  不在测试里各抄一行键名。 */
function resetChatRunState(): void {
  useChatStore.getState().clearMessages()
  useChatStore.getState().setPendingQuestion(null)
}

/** 从 `streamChat({…})` 实参对象里取出某个回调的**函数体文本**(花括号配平)。
 *  返回 null = 那一次调用没注册这个回调 —— 与 effortArgOf 同一条取向:
 *  全文搜键名会把它处的同名标识符算成"已接"。 */
function callbackBodyOf(argsText: string | null, key: string): string | null {
  if (argsText === null) return null
  const at = argsText.indexOf(`${key}:`)
  if (at === -1) return null
  const brace = argsText.indexOf('{', at)
  if (brace === -1) return null
  let depth = 0
  for (let i = brace; i < argsText.length; i += 1) {
    if (argsText[i] === '{') depth += 1
    else if (argsText[i] === '}') {
      depth -= 1
      if (depth === 0) return argsText.slice(brace + 1, i)
    }
  }
  return null
}

/** 两端(首答 / 续答)`streamChat` 实参对象的代码面。 */
function streamArgsOf(file: string): string | null {
  return callArgObject(codeFace(fs.readFileSync(file, 'utf8')), 'streamChat')
}

const normWs = (s: string): string => s.replace(/\s+/g, ' ').trim()

describe('D130⑦ 续答收到钉档通知帧 ⇒ 必须上屏(行为,非源码面)', () => {
  it('streamChat 回调 onReasoningEffortNotice ⇒ store 写入该档通知且输入区轴渲染出来', async () => {
    streamChatMock.mockReset()
    streamChatMock.mockImplementation(async (options: StreamChatOptions) => {
      options.onReasoningEffortNotice?.(PINNED_NOTICE)
    })

    try {
      await runSendAnswer(makeChatActionContext())

      expect(streamChatMock).toHaveBeenCalledTimes(1)
      // store 这一维:续答链写的是**同一个** reasoningEffortNotice 键
      expect(useChatStore.getState().reasoningEffortNotice).toEqual(PINNED_NOTICE)
      // 界面这一维:轴组件把通知摆出来(摘掉接线 ⇒ 这里取不到节点 ⇒ 本条必红)
      await renderAxis()
      const notice = screen.getByTestId('reasoning-effort-fallback')
      expect(notice.textContent).toContain('high')
      expect(notice.textContent).toContain('low')
    } finally {
      resetChatRunState()
    }
  })

  it('与首答同一份形态:回调体逐字同形、写唯一出口、不另起第二个 setter(源码面)', () => {
    const first = callbackBodyOf(streamArgsOf(SEND_MESSAGE_SRC), 'onReasoningEffortNotice')
    const again = callbackBodyOf(streamArgsOf(SEND_ANSWER_SRC), 'onReasoningEffortNotice')
    expect(first, '基准丢失:send-message 不再注册该回调 ⇒ 比较没有意义').not.toBeNull()
    expect(
      again,
      '续答链没接 onReasoningEffortNotice ⇒ 后端钉档时那一轮界面上什么都没说(请求体带档也照样静默)',
    ).not.toBeNull()
    // 逐字等值(不是"两边都长得像"):两端各写一份就必然漂移,而漂移的表现是"手机上改了 web 没改"
    expect(normWs(again!)).toBe(normWs(first!))
    // 唯一出口 + 不得有第二个档位通知键(第二真相)
    expect(/setReasoningEffortNotice\(/.test(again!)).toBe(true)
    const againFace = codeFace(fs.readFileSync(SEND_ANSWER_SRC, 'utf8'))
    expect(
      /setReasoningEffort(?!Notice)[A-Za-z]*\(/.test(againFace),
      '续答支出现 setReasoningEffort* 的第二种 setter ⇒ 抄了第二份形态',
    ).toBe(false)
    // 不得在端内抄档位文案(§19 词表唯一):接线里出现档位字面量 = 第二个真相
    expect(
      /['"](minimal|low|medium|high)['"]/.test(callbackBodyOf(streamArgsOf(SEND_ANSWER_SRC), 'onReasoningEffortNotice') ?? ''),
      '回调体里出现档位字面量 ⇒ 文案被抄进接线,轴上的词不再走词包',
    ).toBe(false)
  })

  it('判据自身:摘掉接线 ⇒ 提取式为 null(有牙证明,不接受恒绿)', () => {
    const withCb =
      'streamChat({\n onFallback: () => {},\n onReasoningEffortNotice: (info) => { store.setReasoningEffortNotice(info) },\n})'
    const withoutCb = 'streamChat({\n onFallback: (e) => set(e),\n onSteer: () => {},\n})'
    expect(callbackBodyOf(callArgObject(withCb, 'streamChat'), 'onReasoningEffortNotice'), '带回调却没提取出来 = 尺子没看见').not.toBeNull()
    expect(callbackBodyOf(callArgObject(withoutCb, 'streamChat'), 'onReasoningEffortNotice'), '没接却提取出东西 = 尺子在给空气背书').toBeNull()
    // 同一把尺子必须能区分"注册了"与"只是注释里提到" —— 剥注释那一层由 codeFace 承担
    const commentOnly = 'streamChat({\n // onReasoningEffortNotice: 以前这里接过\n})'
    expect(callbackBodyOf(callArgObject(codeFace(commentOnly), 'onReasoningEffortNotice'), 'onReasoningEffortNotice')).toBeNull()
  })
})

describe('D130⑧ 新一轮续答开始前必须清掉上一轮的通知', () => {
  it('上一轮挂着钉档通知 ⇒ 本轮 streamChat 被调用那一刻 store 已是 null(旧通知不得冒充本轮)', async () => {
    // 上一轮留下的通知(与本轮无关)
    useChatStore.getState().setReasoningEffortNotice(PINNED_NOTICE)
    expect(useChatStore.getState().reasoningEffortNotice).toEqual(PINNED_NOTICE)

    let noticeAtSend: ReasoningEffortNotice | null = PINNED_NOTICE
    streamChatMock.mockReset()
    streamChatMock.mockImplementation(async () => {
      // 取样点=请求真正发出的那一刻:清晚了(在流之后)同样被抓到
      noticeAtSend = useChatStore.getState().reasoningEffortNotice
    })

    try {
      await runSendAnswer(makeChatActionContext())

      expect(
        noticeAtSend,
        '续答发起时上一轮的钉档通知还挂着 ⇒ 轴上那条提示读起来像本轮发生的(本仓"上一轮瞬时态挂到下一轮卡上"同型)',
      ).toBeNull()
      // 本轮没收到通知帧 ⇒ 保持 null,不得被旧值"回填"(这一条在**清理之前**断言 ——
      // clearMessages 自己也会把它归零,放在清理之后就恒真了)
      expect(useChatStore.getState().reasoningEffortNotice).toBeNull()
    } finally {
      resetChatRunState()
    }
  })

  it('清通知写的是同一个 store 出口,两端(首答/续答)都有这一格', () => {
    for (const [label, file] of [
      ['首答 send-message', SEND_MESSAGE_SRC],
      ['续答 send-answer', SEND_ANSWER_SRC],
    ] as const) {
      const face = codeFace(fs.readFileSync(file, 'utf8'))
      expect(
        /setReasoningEffortNotice\(\s*null\s*\)/.test(face),
        `${label}: 发起前没清上一轮通知 ⇒ 旧通知冒充本轮`,
      ).toBe(true)
    }
  })
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
