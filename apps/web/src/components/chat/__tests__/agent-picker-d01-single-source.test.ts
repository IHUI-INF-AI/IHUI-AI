// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
//
// D01(G-228) 对话内 Agent 选择器 —— 收口三格(2026-10-27 现读后补)。
//
// 前置事实:选择器本体(agent-picker.tsx)、交代条(agent-notice-bar.tsx)、store 状态、
// 发送链路 personaId、api-client 传输槽、网关 schema、ai-service 并入都在盘上并有绿测。
// 本文件只咬剩下三处**原判据没覆盖到**的格子:
//
//  ① 选中 persona ⇒ 请求体真带 agentId —— 用**store 真相**驱动,不手写常量传入。
//     原判据(d01-agent-persona-payload)是静态读宿主源码 + 单独传 personaId 两段,
//     中间"store 里的值"到"payload 里的值"这一跳靠人眼对齐;这里跑成一整条。
//  ② 切回默认 ⇒ 请求体**不带** agentId(不是带 null)。这条单独成格:null 会被网关
//     zod(`z.string().optional()`)拒成 400,或被上游读成"有个 agentId 但值为空"。
//  ③ persona 数据面单一真相 —— 票面明令"禁止第二份 persona 定义"。原判据只有后端一句
//     `assert contract.tools`(等于没守)。这里双端各判一次:
//     前端三个 D01 文件不得出现任何 persona id / 工具名(只能消费 /llm/personas 投影);
//     后端 PERSONAS_CONTRACTS 只有一处定义,/personas 与 /llm/personas 共用同一投影出口,
//     llm.py 不得自立注册表。
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setBaseUrl, setStreamBaseUrl, streamChat } from '@ihui/api-client'

import { useChatStore } from '@/stores/chat'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const WEB_SRC_ROOT = path.resolve(HERE, '..', '..', '..')
// apps/web/src → apps/web → apps → 仓库根
const REPO_ROOT = path.resolve(WEB_SRC_ROOT, '..', '..', '..')

/**
 * 剥掉行注释与块注释(不碰字符串字面量 —— 判据要看的正是引号里的 id 与工具名)。
 * 本仓最高频失效型是"注释里登记过 ≠ 接上了",所以凡静态判据一律在代码面上判。
 */
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

function walk(dirPath: string): string[] {
  const out: string[] = []
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const full = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'tests' || entry.name === 'node_modules')
        continue
      out.push(...walk(full))
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec)\.(ts|tsx)$/.test(entry.name)) {
      out.push(full)
    }
  }
  return out
}

// ═══════════════════════════════════════════════════════════════════════════
// ①② store 真相 → 请求体
// ═══════════════════════════════════════════════════════════════════════════

function sseResponse(): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode('data: [DONE]\n'))
      controller.close()
    },
  })
  return {
    ok: true,
    status: 200,
    body: stream,
    headers: { get: () => null },
    text: async () => '',
  } as unknown as Response
}

/** 复刻 send-message.ts / send-answer.ts 调用点的**同一表达式**,不手写常量。 */
async function sendAsHost(): Promise<void> {
  await streamChat({
    model: 'test-model',
    messages: [{ role: 'user', content: 'hi' }],
    onDelta: () => {},
    personaId: useChatStore.getState().selectedAgentId ?? undefined,
  })
}

function bodyOf(fetchMock: ReturnType<typeof vi.fn>, call = 0): Record<string, unknown> {
  const init = fetchMock.mock.calls[call]?.[1] as RequestInit | undefined
  return JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
}

describe('D01② 选中/切回默认 ⇒ 请求体是否承载 agentId(store 真相驱动)', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    localStorage.clear()
    useChatStore.setState({ selectedAgentId: null })
    setBaseUrl('http://localhost:8803')
    setStreamBaseUrl('http://localhost:8803')
    // 每轮都要一条**新** Response:同一对象第二次 getReader() 会抛 ReadableStream is locked
    fetchMock = vi.fn().mockImplementation(() => Promise.resolve(sseResponse()))
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    useChatStore.setState({ selectedAgentId: null })
  })

  it('选中 coder 后发一轮 ⇒ body.agentId = coder', async () => {
    useChatStore.getState().setSelectedAgentId('coder')
    await sendAsHost()
    expect(bodyOf(fetchMock).agentId).toBe('coder')
  })

  it('切回默认后发一轮 ⇒ body 里没有 agentId 这个键(不是带 null)', async () => {
    // 先选一次,再切回默认 —— 顺序保证"切回"这一步真的被执行过,不是从没选过
    useChatStore.getState().setSelectedAgentId('coder')
    await sendAsHost()
    expect(bodyOf(fetchMock, 0).agentId).toBe('coder')

    useChatStore.getState().setSelectedAgentId(null)
    expect(useChatStore.getState().selectedAgentId).toBeNull()
    await sendAsHost()

    const body = bodyOf(fetchMock, 1)
    expect(Object.prototype.hasOwnProperty.call(body, 'agentId')).toBe(false)
    // 连 null 都不许出现:网关 schema 是 z.string().optional(),null 会被判非法
    expect(JSON.stringify(body)).not.toContain('"agentId"')
  })

  it('宿主调用点用 `?? undefined` 收口(写成 `?? null` 会带一个空 agentId 上行)', () => {
    // 上一条跑的是本文件复刻的表达式;这一条直接咬真实宿主源码,防"两边各写一份"。
    for (const rel of ['send-message.ts', 'send-answer.ts']) {
      const face = codeFace(
        fs.readFileSync(path.join(WEB_SRC_ROOT, 'hooks', 'use-chat', rel), 'utf8'),
      )
      expect(face, `${rel} 的 personaId 未用 ?? undefined 收口`).toMatch(
        /personaId:\s*chatStore\.getState\(\)\.selectedAgentId\s*\?\?\s*undefined/,
      )
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// ③ persona 数据面单一真相
// ═══════════════════════════════════════════════════════════════════════════

const PERSONA_IDS = ['researcher', 'coder', 'reviewer', 'architect', 'debugger']

/** 只出现在 PERSONAS_CONTRACTS 白名单里的工具名(用于识别"抄了一份映射") */
const PERSONA_TOOL_NAMES = [
  'read_file',
  'list_files',
  'search_codebase',
  'analyze_code',
  'parse_document',
  'file_edit',
  'write_file',
  'run_command',
  'generate_test',
  'review_pr',
]

/**
 * 结构判据:**同一个数组/对象字面量里出现 ≥2 个工具名,且 240 字上下文里出现 persona id**,
 * 才算"第二份 persona→工具映射"。
 *
 * 为什么不用裸子串:本仓生产面有 `dispatch-subagent-dialog.tsx`(5 个 subagent 角色选项)
 * 与 `sub-agent-activity-feed.tsx`(6 条专家泳道)成规模出现 persona 名 —— 那是 subagent
 * 角色词表,不含工具白名单,判进来会把本票的门钉成恒红,唯一结局是逼人绕过钩子。
 */
function personaToolTableHits(face: string): string[] {
  const hits: string[] = []
  for (const m of face.matchAll(/\[[^[\]\n]*\]/g)) {
    const literal = m[0]
    const tools = PERSONA_TOOL_NAMES.filter((t) => new RegExp(`['"\`]${t}['"\`]`).test(literal))
    if (tools.length < 2) continue
    const at = m.index ?? 0
    const context = face.slice(Math.max(0, at - 240), at + literal.length)
    const personas = PERSONA_IDS.filter((p) =>
      new RegExp(`['"\`]${p}['"\`]|\\b${p}\\s*:`).test(context),
    )
    if (personas.length === 0) continue
    hits.push(`persona=[${personas.join(',')}] tools=[${tools.join(',')}]`)
  }
  return hits
}

function literalIdHits(face: string, ids: string[]): string[] {
  return ids.filter((id) => new RegExp(`['"\`]${id}['"\`]`).test(face))
}

describe('D01① 装车证明:两个组件真的被宿主渲染', () => {
  const SRC = path.join(WEB_SRC_ROOT, 'components', 'chat', 'message-input.tsx')

  it('<AgentPicker /> 在输入区恰好挂 1 处,且位于模型选择器之前(胶囊挨着模型选择器)', () => {
    const face = codeFace(fs.readFileSync(SRC, 'utf8'))
    const mounts = face.match(/<AgentPicker\s*\/>/g) ?? []
    expect(mounts, 'message-input 里没有 <AgentPicker /> ⇒ 组件在、无人调用').toHaveLength(1)
    expect(face.indexOf('<AgentPicker />')).toBeLessThan(face.indexOf('<ModelSelector'))
  })

  it('<AgentNoticeBar /> 恰好挂 1 处(未选专家时组件自渲染为 null,不留占位)', () => {
    const face = codeFace(fs.readFileSync(SRC, 'utf8'))
    expect(face.match(/<AgentNoticeBar\s*\/>/g) ?? []).toHaveLength(1)
  })
})

describe('D01③ 前端不得持有第二份 persona 定义', () => {
  const D01_FILES = [
    path.join(WEB_SRC_ROOT, 'components', 'chat', 'agent-picker.tsx'),
    path.join(WEB_SRC_ROOT, 'components', 'chat', 'agent-notice-bar.tsx'),
    path.join(WEB_SRC_ROOT, 'lib', 'personas-api.ts'),
  ]

  it('三个 D01 文件里没有任何 persona id / 工具名字面量(只能消费 /llm/personas 投影)', () => {
    const offenders: string[] = []
    for (const file of D01_FILES) {
      const face = codeFace(fs.readFileSync(file, 'utf8'))
      const ids = literalIdHits(face, PERSONA_IDS)
      const tools = literalIdHits(face, PERSONA_TOOL_NAMES)
      if (ids.length > 0 || tools.length > 0) {
        offenders.push(`${path.basename(file)}: persona=${ids.join('|')} tools=${tools.join('|')}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('选择器与交代条都经 fetchPersonaCatalog 取数,且路径与后端路由同名', () => {
    for (const name of ['agent-picker.tsx', 'agent-notice-bar.tsx']) {
      const face = codeFace(
        fs.readFileSync(path.join(WEB_SRC_ROOT, 'components', 'chat', name), 'utf8'),
      )
      expect(face, `${name} 未经 personas-api 取数`).toContain('fetchPersonaCatalog')
    }
    const apiFace = codeFace(
      fs.readFileSync(path.join(WEB_SRC_ROOT, 'lib', 'personas-api.ts'), 'utf8'),
    )
    // 前后端同一路径:ai-service 里就是 @router.get("/llm/personas")
    expect(apiFace).toContain('/llm/personas')
  })

  it('apps/web/src 生产面没有任何 persona→工具映射表', () => {
    const files = walk(WEB_SRC_ROOT)
    // 扫不到面 = 判据空转,不接受"0 命中即通过"
    expect(files.length).toBeGreaterThan(200)
    const offenders = files
      .map((f) => ({ f, hits: personaToolTableHits(codeFace(fs.readFileSync(f, 'utf8'))) }))
      .filter((x) => x.hits.length > 0)
      .map((x) => `${path.relative(WEB_SRC_ROOT, x.f)}: ${x.hits.join(' | ')}`)
    expect(offenders).toEqual([])
  })

  it('判据自身有牙:抄一份映射必被抓到,subagent 角色词表不得误伤', () => {
    const offenders = [
      `const PERSONA_TOOLS = { coder: ['read_file', 'file_edit'] }\n`,
      `const TABLE: Record<string, string[]> = { researcher: ['search_codebase', 'parse_document'] }\n`,
    ]
    const ok = [
      `const EXPERT_ROLES = [{ value: 'researcher' }, { value: 'coder' }]\n`,
      `const LANES = [{ key: 'coder' }, { key: 'reviewer' }]\n`,
    ]
    expect(offenders.map((s) => personaToolTableHits(s).length)).toEqual([1, 1])
    expect(ok.map((s) => personaToolTableHits(s).length)).toEqual([0, 0])
  })
})

describe('D01③ 后端 PERSONAS_CONTRACTS 是唯一定义', () => {
  const REGISTRY = path.join(
    REPO_ROOT,
    'apps',
    'ai-service',
    'app',
    'services',
    'persona_registry.py',
  )
  const PERSONAS_ROUTER = path.join(
    REPO_ROOT,
    'apps',
    'ai-service',
    'app',
    'routers',
    'personas.py',
  )
  const LLM_ROUTER = path.join(REPO_ROOT, 'apps', 'ai-service', 'app', 'routers', 'llm.py')

  it('注册表只有一处声明,三个派生函数各只有一处定义', () => {
    const src = fs.readFileSync(REGISTRY, 'utf8')
    expect(
      src.match(/^PERSONAS_CONTRACTS: dict\[str, PersonaContract\] = \{/gm) ?? [],
    ).toHaveLength(1)
    for (const fn of ['persona_catalog', 'build_persona_chat_hint', 'merge_persona_tools']) {
      expect(
        src.match(new RegExp(`^def ${fn}\\(`, 'gm')) ?? [],
        `${fn} 定义了不止一份`,
      ).toHaveLength(1)
    }
  })

  it('/personas 与 /llm/personas 共用同一投影出口(同一份 persona_catalog)', () => {
    const src = fs.readFileSync(PERSONAS_ROUTER, 'utf8')
    // 整个文件只允许一次 persona_catalog() 调用 —— 在 _catalog_response 里
    expect(src.match(/persona_catalog\(\)/g) ?? []).toHaveLength(1)
    // def 一行 + 两个端点各 return 一次
    expect(src.match(/_catalog_response\(\)/g) ?? []).toHaveLength(3)
    expect(src).toContain('@router.get("/llm/personas")')
  })

  it('llm.py 不自立注册表:只 import 注册表的派生函数,不复制白名单', () => {
    const src = codeFace(fs.readFileSync(LLM_ROUTER, 'utf8'))
    expect(src).not.toMatch(/PERSONAS_CONTRACTS\s*=/)
    expect(src).toContain('build_persona_chat_hint as _persona_chat_hint')
    expect(src).toContain('merge_persona_tools as _merge_persona_tools')
    // 并入点确实在本轮请求里跑过(不是只有 import)
    expect(src).toContain('_persona_chat_hint(_persona_id)')
    expect(src).toContain('_merge_persona_tools(_persona_id, agent_tools)')
  })

  it('工具并入从注册表读,不是本地表:merge_persona_tools 经 get_persona_contract 取白名单', () => {
    const src = fs.readFileSync(REGISTRY, 'utf8')
    const start = src.indexOf('def merge_persona_tools(')
    expect(start, 'merge_persona_tools 不存在').toBeGreaterThan(-1)
    const rest = src.slice(start)
    // 切到下一个顶层定义为止(docstring 里出现的字符串不算)
    const end = rest.search(/\n(?:def |# ═)/)
    const body = end > 0 ? rest.slice(0, end) : rest
    expect(body).toContain('get_persona_contract(persona)')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
