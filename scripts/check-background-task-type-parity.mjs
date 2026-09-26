#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-background-task-type-parity.mjs — V3 #51 判据 6:后台任务类型「声明 ↔ 实现 ↔ 接线」对账
 *
 * 病根(票面):`run_in_background` 的 schema 写着 sleep/echo,实现也只有 sleep/echo。
 * 6 类真实 executor 落地后,如果没有任何尺子,注册表就变成第二份真相 ——
 * 「工具说支持的类型」与「实际分派得到的类型」再度分叉,而 typecheck / mypy 全都不会红。
 *
 * 判据(输入全部由被审面自身推导;唯一的手工清单是 P4 那张欠账账,它记的是别人手里的文件):
 *  P1 `IMPLEMENTED_TASK_TYPES`(字面量声明面)=== `_SPECS` 里 `task_type="…"` 的集合(实现面)。
 *     两个方向都红:声明了没实现 / 实现了没声明。同一 task_type 被登记两次也算红。
 *     stub 标记(`stub=True`)必须逐字等于 `STUB_TASK_TYPES` 字面量 —— 否则"把桩洗成真实能力"
 *     只需要翻一个布尔位,这条把它钉成两面必须同形。
 *  P2 `background_tasks.py` 必须**经注册表分派**(从 task_executors 引 get_spec + 定义
 *     run_in_background + 真的调用 get_spec)。若有人把白名单重新内联回工具层 ⇒ 红
 *     (第二个真相源是本仓所有对账门存在的理由)。
 *  P3 `mcp_server._BG_TASK_IMPLS` 的键必须 ⊆ 实现面:广告出去却没实现 = 真幽灵。
 *  P4 「实现面 − 广告面」必须**逐字等于** `EXPECTED_UNWIRED_IN_MCP_SERVER`:
 *     新增未接线类型没入账 ⇒ 红;已接线却仍挂账 ⇒ 红(清单腐烂)。
 *     这张账存在的理由很实在:`mcp_server.py` 由并行会话持有,本票结构上改不动它。
 *  P5 `dag_scheduler._default_executor` 必须走 `execute_for_kanban` 且其 Return 字面量里
 *     不得再有 `echo`;`api/dag.py` 必须走 `execute_task` 并保留 `executed: False` 自证。
 *     「造好没装车」是本仓最高频失效型(守门 64/70/81 同型)。
 *
 * 取材铁律(与守门 70/77/83/98/103/118 同口径):
 *   默认判 HEAD blob;`--staged` 判索引 blob;`--worktree` 仅人工逃生舱;两面旗同给 ⇒ exit 2;
 *   清单与内容同面同轮(一次 `cat-file --batch` 读满);任一面取不到 ⇒ exit 2「无法判定」且
 *   **绝不回落另一个面**(回落就是把"没判"写成"判过了");`--root` 只在 `--worktree` 档有效。
 *   判据面先剥 Python 行注释与三引号 docstring(等长遮罩,行号不变),**单行字符串保留**:
 *   注册表条目本身就写在单行字符串里,连字符串一起抹会让判据失明;而注释里出现的
 *   `task_type="…"` 不得被算成成员(否则门把"解释自己的散文"判成违规 —— 守门 70/131 同型)。
 *
 * 用法:
 *   node scripts/check-background-task-type-parity.mjs              全量(HEAD 面)
 *   node scripts/check-background-task-type-parity.mjs --staged      索引面(pre-commit 形态)
 *   node scripts/check-background-task-type-parity.mjs --self-test    构造面正反例,零副作用
 *   node scripts/check-background-task-type-parity.mjs --json         机器可读结论
 * 退出码:0 通过 / 1 违规 / 2 无法判定或脚本异常。
 * 跳过(应急):HUSKY_SKIP_BG_TASK_TYPE_PARITY=1
 */

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
import { join, resolve as resolvePath } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { Undetermined, catBatch, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

const ROOT_DEFAULT = join(fileURLToPath(import.meta.url), '..', '..')
const args = process.argv.slice(2)

export const PY_EXECUTORS = 'apps/ai-service/app/services/task_executors.py'
export const PY_BACKGROUND = 'apps/ai-service/app/services/background_tasks.py'
export const PY_MCP = 'apps/ai-service/app/services/mcp_server.py'
export const PY_DAG_SCHED = 'apps/ai-service/app/services/dag_scheduler.py'
export const PY_DAG_API = 'apps/ai-service/app/api/dag.py'
const INPUTS = [PY_EXECUTORS, PY_BACKGROUND, PY_MCP, PY_DAG_SCHED, PY_DAG_API]

/**
 * P4 欠账账本:实现已落地、但工具广告面(mcp_server)还没接上的类型。
 * 接线完成后必须删掉对应行,否则本门判「清单腐烂」红。
 */
export const EXPECTED_UNWIRED_IN_MCP_SERVER = Object.freeze([
  'batch_llm',
  'code_index',
  'long_running_command',
  'patrol',
  'test_suite',
  'web_batch',
])

// ---------------------------------------------------------------------------
// 遮噪:剥行注释 + 剥三引号串(等长,行号不变);单行字符串原样保留
// ---------------------------------------------------------------------------

export function maskPyNoise(src) {
  const out = src.split('')
  const n = src.length
  let i = 0
  while (i < n) {
    const ch = src[i]
    if (ch === '\n') {
      i += 1
      continue
    }
    if (ch === '#') {
      while (i < n && src[i] !== '\n') {
        out[i] = ' '
        i += 1
      }
      continue
    }
    if (ch === '"' || ch === "'") {
      const head = src.slice(i, i + 3)
      if (head === '"""' || head === "'''") {
        let j = i + 3
        while (j < n && src.slice(j, j + 3) !== head) j += 1
        const end = Math.min(n, j + 3)
        for (let k = i; k < end; k += 1) if (src[k] !== '\n') out[k] = ' '
        i = end
        continue
      }
      const quote = ch
      let j = i + 1
      while (j < n && src[j] !== quote && src[j] !== '\n') {
        if (src[j] === '\\') j += 1
        j += 1
      }
      i = j + 1
      continue
    }
    i += 1
  }
  return out.join('')
}

const TASK_TYPE_KW = /task_type\s*=\s*"([a-z0-9_]+)"/
const SPEC_OPEN = /ExecutorSpec\s*\(/g
const STUB_KW = /,\s*stub\s*=\s*True\b/
const LITERAL_IMPLEMENTED = /IMPLEMENTED_TASK_TYPES\s*:\s*Final\[tuple\[str,\s*\.\.\.\]\]\s*=\s*\(([\s\S]*?)\n\)/
const LITERAL_STUB = /STUB_TASK_TYPES\s*:\s*Final\[tuple\[str,\s*\.\.\.\]\]\s*=\s*\(([\s\S]*?)\)/
// 注:注解里嵌套了 dict[...] / Callable[...] 的 `]`,所以整行只认 `= {`,不再试图描述注解。
const ADVERTISED = /_BG_TASK_IMPLS\s*:[^\n]*=\s*\{([\s\S]*?)\n\}/

function tupleMembers(block) {
  const seen = new Set((block.match(/"([a-z0-9_]+)"/g) || []).map((s) => s.slice(1, -1)))
  return [...seen].sort()
}

/**
 * 按 `ExecutorSpec(` 边界切条,再在**每条内部**取 task_type / stub。
 *
 * 为什么不全局扫正则:① 全局 `task_type="x" … stub=True` 的窗口会**跨过**相邻条目,
 * 于是第一条会被最后一条的 `stub=True` 染色(写门时实测就是这么错的);
 * ② description 字符串里合法地写着 "自证 stub=True"(单行串必须保留,否则 task_type 也看不见),
 * 逗号锚点 + 条目边界把这个假阳挡掉。
 */
function splitSpecs(src) {
  const marks = []
  for (const m of src.matchAll(SPEC_OPEN)) marks.push(m.index)
  return marks.map((start, i) => src.slice(start, marks[i + 1] ?? src.length))
}

export function parseRegistryTypes(rawSrc) {
  const src = maskPyNoise(rawSrc)
  const specs = splitSpecs(src)
  const found = []
  const stubbed = []
  for (const chunk of specs) {
    const m = TASK_TYPE_KW.exec(chunk)
    if (!m) continue
    found.push(m[1])
    if (STUB_KW.test(chunk)) stubbed.push(m[1])
  }
  const decl = LITERAL_IMPLEMENTED.exec(src)
  const stubLiteral = LITERAL_STUB.exec(src)
  return {
    implemented: [...new Set(found)].sort(),
    specCount: found.length,
    declaredLiteral: decl ? tupleMembers(decl[1]) : null,
    stubs: {
      inline: [...new Set(stubbed)].sort(),
      literal: stubLiteral ? tupleMembers(stubLiteral[1]) : null,
    },
  }
}

export function parseAdvertised(rawSrc) {
  const src = maskPyNoise(rawSrc)
  const m = ADVERTISED.exec(src)
  if (m) return { kind: 'own-whitelist', keys: tupleMembers(m[1]) }
  // 接线完成后的形态:工具层不再自带白名单,而是把 arguments 整个交给
  // background_tasks.run_in_background。此时"广告面"就是注册表本身 ——
  // 必须认这种形态,否则接线那一枚提交会把本门变成恒红门(§12e 同型)。
  const tool = /async def _tool_run_in_background\([\s\S]*?\n(?=\S|$)/.exec(src)
  if (tool && /\brun_in_background\s*\(/.test(tool[0])) return { kind: 'delegated', keys: null }
  return { kind: 'unresolved', keys: null }
}

/**
 * 模型在 `tools/list` 里读到的是 schema **描述文字**里的白名单 —— 那才是"声明面"的可见形态。
 *
 * 刻意**只在 run_in_background 这一块里取**:全文件扫 `支持 X/Y` 会命中 40 多个无关 token
 * (写门时实测:"支持类型:class / function / interface / diff"、"支持 gif/png/webp" 全被捞进来),
 * 那种判据一出生就是假阳机 —— 假阳比漏报更贵(它指使人去"修"没坏的东西)。
 * 判据只取"广告了却没实现"这一方向;"prose 没列全"由 P4 的欠账账覆盖,不在这里重复计债。
 */
export function parseProseWhitelist(rawMcp) {
  const src = maskPyNoise(rawMcp)
  const start = src.indexOf('name="run_in_background"')
  if (start < 0) return { found: false, tokens: [] }
  const rest = src.slice(start + 1)
  const nextTool = rest.search(/\n\s{4}MCPTool\(/)
  const block = nextTool >= 0 ? rest.slice(0, nextTool) : rest.slice(0, 4000)
  const tokens = new Set()
  for (const m of block.matchAll(/(?:支持|白名单:)\s*([a-z0-9_]+(?:\/[a-z0-9_]+)*)/g)) {
    for (const tok of m[1].split('/')) if (tok) tokens.add(tok)
  }
  return { found: true, tokens: [...tokens].sort() }
}

export function parseDispatchSurface(rawBg) {
  const src = maskPyNoise(rawBg)
  return {
    importsRegistry: /from\s+\.task_executors\s+import[\s\S]{0,600}?\bget_spec\b/.test(src),
    definesTool: /async def run_in_background\(/.test(src),
    callsGetSpec: /\bget_spec\(/.test(src),
    exposesDeclaredAlias: /RUN_IN_BACKGROUND_TASK_TYPES/.test(src),
  }
}

/** 只看 `async def _default_executor` 函数体:Return 字面量里是否还有 echo。 */
export function parseDagWiring(rawSched, rawApi) {
  const sched = maskPyNoise(rawSched)
  const api = maskPyNoise(rawApi)
  const fn = /async def _default_executor\([\s\S]*?\n(?=\S)/.exec(sched)
  const body = fn ? fn[0] : ''
  const echoReturns = []
  for (const m of body.matchAll(/return\s+(\{[^{}]*\})/g)) {
    if (m[1].includes('"echo"')) echoReturns.push(m[1].replace(/\s+/g, ' ').slice(0, 90))
  }
  return {
    hasDefaultExecutorFn: Boolean(fn),
    delegatesToRegistry: /execute_for_kanban\s*\(/.test(body),
    echoReturns,
    apiDelegatesToRegistry: /execute_task\s*\(/.test(api),
    apiSelfProvesStub: /"executed":\s*False/.test(api),
  }
}

// ---------------------------------------------------------------------------
// 判据(纯函数:四个方向都能用构造面证明,不依赖仓库瞬时状态)
// ---------------------------------------------------------------------------

export function judge(inputs, ledger = EXPECTED_UNWIRED_IN_MCP_SERVER) {
  const violations = []
  const notes = []
  const reg = parseRegistryTypes(inputs[PY_EXECUTORS])

  if (!reg.declaredLiteral) {
    violations.push('P1 IMPLEMENTED_TASK_TYPES 字面量解析不到 ⇒ 声明面失明,不得记为通过')
  }
  if (reg.specCount === 0) {
    violations.push('P1 `_SPECS` 里一个 task_type="…" 都没解析到 ⇒ 判据失明(空扫不报绿)')
  }
  if (reg.implemented.length !== reg.specCount) {
    violations.push(
      `P1 同一 task_type 被重复登记(${reg.specCount} 条 / ${reg.implemented.length} 个唯一值)⇒ 注册表有副本`,
    )
  }
  const declared = reg.declaredLiteral || []
  const missingImpl = declared.filter((t) => !reg.implemented.includes(t))
  const missingDecl = reg.implemented.filter((t) => !declared.includes(t))
  if (missingImpl.length) violations.push(`P1 声明了却没有 executor:${missingImpl.join(', ')}`)
  if (missingDecl.length) violations.push(`P1 有 executor 却没进声明面:${missingDecl.join(', ')}`)

  if (!reg.stubs.literal) {
    violations.push('P1 STUB_TASK_TYPES 字面量找不到 ⇒ 分不清演示档与真实档,不得记为通过')
  } else if (reg.stubs.inline.join('|') !== reg.stubs.literal.join('|')) {
    violations.push(
      `P1 stub 标记与 STUB_TASK_TYPES 不一致:代码标了 [${reg.stubs.inline.join(', ')}] ` +
        `字面量写了 [${reg.stubs.literal.join(', ')}]`,
    )
  }
  const ghostStubs = (reg.stubs.literal || []).filter((t) => !reg.implemented.includes(t))
  if (ghostStubs.length) violations.push(`P1 stub 名单里有不存在的类型(清单腐烂):${ghostStubs.join(', ')}`)

  const dispatch = parseDispatchSurface(inputs[PY_BACKGROUND])
  if (!dispatch.importsRegistry) {
    violations.push('P2 background_tasks 未从 task_executors 引入 get_spec ⇒ 工具层可能又内联了一份白名单(第二个真相)')
  }
  if (!dispatch.definesTool) violations.push('P2 background_tasks.run_in_background 不在了 ⇒ 工具入口被摘线')
  if (!dispatch.callsGetSpec) violations.push('P2 run_in_background 未经注册表分派 ⇒ 退化成自判白名单')
  if (!dispatch.exposesDeclaredAlias) violations.push('P2 声明面别名 RUN_IN_BACKGROUND_TASK_TYPES 不见了')

  const advertisedInfo = parseAdvertised(inputs[PY_MCP])
  const advertised = advertisedInfo.kind === 'own-whitelist' ? advertisedInfo.keys : null
  if (advertisedInfo.kind === 'unresolved') {
    violations.push('P3 mcp_server 既没有 _BG_TASK_IMPLS,也没有把 arguments 交给 background_tasks.run_in_background ⇒ 广告面失明,不得记为通过')
  } else if (advertisedInfo.kind === 'delegated') {
    // 已接线:广告面 === 注册表。账本里再留任何一行都是腐烂。
    if (ledger.length) {
      violations.push(`P4 工具已改为整体委托 background_tasks.run_in_background,欠账账本仍挂着 ${ledger.length} 行(清单腐烂):${ledger.join(', ')}`)
    }
    notes.push('P4 广告面 = 注册表(mcp_server 已委托);未接线 0 类')
  } else {
    const ghosts = advertised.filter((t) => !reg.implemented.includes(t))
    if (ghosts.length) violations.push(`P3 工具广告了却没实现的任务类型(真幽灵):${ghosts.join(', ')}`)
    const unwired = reg.implemented.filter((t) => !advertised.includes(t))
    const extra = unwired.filter((t) => !ledger.includes(t))
    const stale = ledger.filter((t) => !unwired.includes(t))
    if (extra.length) violations.push(`P4 新增未接线类型未登记欠账(先接线,或显式入账):${extra.join(', ')}`)
    if (stale.length) violations.push(`P4 欠账清单腐烂(这些类型已接线,请删掉账本行):${stale.join(', ')}`)
    notes.push(`P4 在账未接线 ${unwired.length} 类(${unwired.join(', ') || '无'});广告面已接线 ${advertised.length} 类`)
  }

  const dag = parseDagWiring(inputs[PY_DAG_SCHED], inputs[PY_DAG_API])
  if (!dag.hasDefaultExecutorFn) {
    violations.push('P5 dag_scheduler._default_executor 解析不到 ⇒ 判据失明,不得记为通过')
  }
  if (dag.echoReturns.length) violations.push(`P5 默认 executor 仍在回显:${dag.echoReturns.join(' | ')}`)
  if (!dag.delegatesToRegistry) {
    violations.push('P5 默认 executor 未走 execute_for_kanban ⇒ 与工具面分叉(两条入口必须同一出口)')
  }
  if (!dag.apiDelegatesToRegistry) violations.push('P5 /dag/execute 节点未走 execute_task ⇒ DAG 面回到回显')
  if (!dag.apiSelfProvesStub) {
    violations.push('P5 /dag/execute 未声明类型的节点不再自证 executed:False ⇒ 桩可以重新伪装成成功')
  }

  return { violations, notes, reg, dispatch, advertised, advertisedKind: advertisedInfo.kind, dag }
}

// ---------------------------------------------------------------------------
// 取材(面 = HEAD / 索引 / 工作树;同面同轮读满)
// ---------------------------------------------------------------------------

export function pickFace(argv) {
  return selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
}

export function readInputs(root, face) {
  const out = {}
  if (face === 'worktree') {
    for (const rel of INPUTS) {
      const text = readWorktreeFile(root, rel)
      if (text === null || text === undefined) throw new Undetermined(`${rel} 在磁盘上不存在(工作树档)`)
      out[rel] = text
    }
    return out
  }
  const prefix = face === 'staged' ? ':' : 'HEAD:'
  const specs = INPUTS.map((rel) => prefix + rel)
  const got = catBatch(root, specs, { maxBuffer: 1 << 28 })
  for (let i = 0; i < INPUTS.length; i++) {
    const text = got.get(specs[i])
    if (text === null || text === undefined) {
      throw new Undetermined(`${face === 'staged' ? '索引' : 'HEAD'} 面取不到 ${INPUTS[i]}`)
    }
    out[INPUTS[i]] = text
  }
  return out
}

// ---------------------------------------------------------------------------
// 构造面夹具(每个判据方向各一对正反例)
// ---------------------------------------------------------------------------

export const FIXTURE_LEDGER = ['alpha', 'beta']

export function fixtureBase() {
  return {
    [PY_EXECUTORS]: [
      'IMPLEMENTED_TASK_TYPES: Final[tuple[str, ...]] = (',
      '    "alpha",',
      '    "beta",',
      '    "echo",',
      ')',
      'STUB_TASK_TYPES: Final[tuple[str, ...]] = ("echo",)',
      '_SPECS: tuple[ExecutorSpec, ...] = (',
      '    ExecutorSpec(task_type="alpha", description="真实", run=_exec_alpha),',
      '    ExecutorSpec(task_type="beta", description="真实", run=_exec_beta),',
      '    ExecutorSpec(task_type="echo", description="演示", run=_exec_echo, stub=True),',
      ')',
    ].join('\n'),
    [PY_BACKGROUND]: [
      'from .task_executors import (',
      '    TaskExecutionError,',
      '    compute_idempotency_key,',
      '    execute_task,',
      '    get_spec,',
      '    supported_task_types,',
      ')',
      '',
      'RUN_IN_BACKGROUND_TASK_TYPES: Final[tuple[str, ...]] = IMPLEMENTED_TASK_TYPES',
      '',
      'async def run_in_background(arguments: dict[str, Any]) -> dict[str, Any]:',
      '    spec = get_spec(str(arguments.get("task", "")))',
      '    return {}',
    ].join('\n'),
    [PY_MCP]: [
      '_BG_TASK_IMPLS: dict[str, Callable[[dict[str, Any]], Awaitable[Any]]] = {',
      '    "echo": _bg_impl_echo,',
      '}',
    ].join('\n'),
    [PY_DAG_SCHED]: [
      'async def _default_executor(task: KanbanTask) -> dict[str, Any]:',
      '    """旧实现回显 {"echo": payload} —— 这段散文不得被判成违规(遮噪有牙)。"""',
      '    from .task_executors import execute_for_kanban',
      '',
      '    return await execute_for_kanban(task)',
      '',
      '',
      'class WorkerPool:',
      '    pass',
    ].join('\n'),
    [PY_DAG_API]: [
      'async def _executor(context: dict[str, Any]) -> dict[str, Any]:',
      '    return {"executed": False, "stub": True}',
      '    return await execute_task(node_spec.task_type, args, task_id="x")',
    ].join('\n'),
  }
}

export function fixtureInputs(over = {}) {
  return { ...fixtureBase(), ...over }
}

export function report(out, face) {
  const lines = []
  lines.push(`后台任务类型对账 · 面=${face}`)
  lines.push(`  实现面 ${out.reg.implemented.length} 类:${out.reg.implemented.join(', ')}`)
  lines.push(
    `  声明面 ${(out.reg.declaredLiteral || []).length} 类 · 广告面 ${(out.advertised || []).length} 类` +
      ` · stub ${(out.reg.stubs.literal || []).length} 类`,
  )
  for (const n of out.notes) lines.push(`  · ${n}`)
  if (out.violations.length) {
    lines.push(`  违规 ${out.violations.length} 条:`)
    for (const v of out.violations) lines.push(`    - ${v}`)
  } else {
    lines.push('  结论:声明 ↔ 实现 ↔ 接线三面一致,回显未复潮')
  }
  return lines.join('\n')
}

export function buildJson(out, face) {
  return {
    face,
    implemented: out.reg.implemented,
    declaredLiteral: out.reg.declaredLiteral,
    advertised: out.advertised,
    advertisedKind: out.advertisedKind,
    stubs: out.reg.stubs,
    violations: out.violations,
    notes: out.notes,
  }
}

function selfTest() {
  const results = []
  const check = (name, cond) => results.push([name, cond === true])
  const has = (out, prefix) => out.violations.some((v) => v.startsWith(prefix))
  const base = fixtureBase()

  const clean = judge(fixtureInputs(), FIXTURE_LEDGER)
  check('S0a 干净夹具必须零违规(否则本门一出生就恒红)', clean.violations.length === 0)
  check('S0b docstring 里的 echo 字面量不得被判成回显(遮噪有牙)', !has(clean, 'P5 默认 executor 仍在回显'))

  const dupSource = base[PY_EXECUTORS].replace(
    '    ExecutorSpec(task_type="beta", description="真实", run=_exec_beta),',
    '    ExecutorSpec(task_type="beta", description="真实", run=_exec_beta),\n    ExecutorSpec(task_type="beta", description="副本", run=_exec_beta2),',
  )
  check('S1a 同一 task_type 重复登记 ⇒ 红',
    has(judge(fixtureInputs({ [PY_EXECUTORS]: dupSource }), FIXTURE_LEDGER), 'P1 同一 task_type 被重复登记'))

  const noImplSource = base[PY_EXECUTORS].replace(
    '    ExecutorSpec(task_type="beta", description="真实", run=_exec_beta),\n',
    '',
  )
  check('S1b 声明了却没实现 ⇒ 红(判据 6 的一半)',
    has(judge(fixtureInputs({ [PY_EXECUTORS]: noImplSource }), FIXTURE_LEDGER), 'P1 声明了却没有 executor'))

  const noDeclSource = base[PY_EXECUTORS].replace(
    '    ExecutorSpec(task_type="echo", description="演示", run=_exec_echo, stub=True),',
    '    ExecutorSpec(task_type="echo", description="演示", run=_exec_echo, stub=True),\n    ExecutorSpec(task_type="gamma", description="真实", run=_exec_gamma),',
  )
  check('S1c 有实现却没进声明面 ⇒ 红(判据 6 的另一半)',
    has(judge(fixtureInputs({ [PY_EXECUTORS]: noDeclSource }), ['alpha', 'beta', 'echo', 'gamma']),
      'P1 有 executor 却没进声明面'))

  const stubDrift = judge(fixtureInputs({
    [PY_EXECUTORS]: base[PY_EXECUTORS].replace('run=_exec_alpha)', 'run=_exec_alpha, stub=True)'),
  }), FIXTURE_LEDGER)
  check('S1d 只翻一个 stub 位就想把桩洗成真实能力 ⇒ 红', has(stubDrift, 'P1 stub 标记与 STUB_TASK_TYPES 不一致'))

  const ghost = judge(fixtureInputs({
    [PY_MCP]: '_BG_TASK_IMPLS: dict[str, Callable[[dict[str, Any]], Awaitable[Any]]] = {\n    "imaginary": _bg_impl,\n}',
  }), FIXTURE_LEDGER)
  check('S2 工具广告了却没实现的类型 ⇒ 红', has(ghost, 'P3 工具广告了却没实现'))

  check('S3a 新增未接线类型没入账 ⇒ 红',
    has(judge(fixtureInputs(), ['beta']), 'P4 新增未接线类型未登记欠账'))
  check('S3b 账本里已接线的行不删 ⇒ 红(清单腐烂)',
    has(judge(fixtureInputs(), ['alpha', 'beta', 'already_wired_entry']), 'P4 欠账清单腐烂'))

  // 接线完成后的形态(mcp_server 改为整体委托)必须为绿 —— 否则"修好它"反而制造恒红门
  const delegated = 'async def _tool_run_in_background(arguments: dict[str, Any]) -> dict[str, Any]:\n    from .background_tasks import run_in_background\n\n    return await run_in_background(arguments)\n'
  const delClean = judge(fixtureInputs({ [PY_MCP]: delegated }), [])
  check('S3c 工具层已整体委托 background_tasks.run_in_background ⇒ 必须为绿(不得因账变而红)',
    delClean.violations.length === 0 && delClean.advertisedKind === 'delegated')
  check('S3d 委托后账本仍留一行 ⇒ 红(清单腐烂)',
    has(judge(fixtureInputs({ [PY_MCP]: delegated }), ['alpha']), 'P4 工具已改为整体委托'))
  check('S3e 既无白名单也无委托 ⇒ 判"广告面失明",不得记绿',
    has(judge(fixtureInputs({ [PY_MCP]: 'x = 1\n' }), []), 'P3 mcp_server 既没有 _BG_TASK_IMPLS'))

  const inlined = judge(fixtureInputs({
    [PY_BACKGROUND]: 'ALLOWED = ("alpha", "beta")\n\nasync def run_in_background(a):\n    return {}',
  }), FIXTURE_LEDGER)
  check('S4a 工具层重新内联白名单 ⇒ 红', has(inlined, 'P2 background_tasks 未从 task_executors 引入'))
  check('S4b 分派调用被摘 ⇒ 红', has(inlined, 'P2 run_in_background 未经注册表分派'))

  const echoBack = judge(fixtureInputs({
    [PY_DAG_SCHED]: 'async def _default_executor(task: KanbanTask) -> dict[str, Any]:\n    return {"executed": True, "echo": task.payload}\n\n\nclass WorkerPool:\n    pass\n',
  }), FIXTURE_LEDGER)
  check('S5a 默认 executor 回显复潮 ⇒ 红', has(echoBack, 'P5 默认 executor 仍在回显'))
  check('S5b 同时必须喊「未走注册表」', has(echoBack, 'P5 默认 executor 未走 execute_for_kanban'))

  const apiEcho = judge(fixtureInputs({
    [PY_DAG_API]: 'async def _executor(context):\n    return {"executed": True, "contextKeys": list(context.keys())}',
  }), FIXTURE_LEDGER)
  check('S5c /dag/execute 回到回显 ⇒ 红', has(apiEcho, 'P5 /dag/execute 节点未走 execute_task'))
  check('S5d 未声明节点不再自证 ⇒ 红', has(apiEcho, 'P5 /dag/execute 未声明类型的节点不再自证'))

  const emptyScan = judge(fixtureInputs({ [PY_EXECUTORS]: 'x = 1\n' }), FIXTURE_LEDGER)
  check('S6a 空扫不得记绿(判据失明 = 不通过)', has(emptyScan, 'P1 `_SPECS` 里一个 task_type'))
  check('S6b 声明面字面量缺失必须红', has(emptyScan, 'P1 IMPLEMENTED_TASK_TYPES 字面量解析不到'))
  const noAdvertised = judge(fixtureInputs({ [PY_MCP]: 'nothing here\n' }), FIXTURE_LEDGER)
  check('S6c 广告面解析不到不得记绿', has(noAdvertised, 'P3 mcp_server 既没有 _BG_TASK_IMPLS'))
  const noDagFn = judge(fixtureInputs({ [PY_DAG_SCHED]: 'class WorkerPool:\n    pass\n' }), FIXTURE_LEDGER)
  check('S6d 默认 executor 找不到时不得记绿', has(noDagFn, 'P5 dag_scheduler._default_executor 解析不到'))

  const masked = maskPyNoise('# task_type="in_comment"\nREAL = task_type="in_code"\n')
  check('S7a 注释里的 task_type 不得被算成成员', !masked.includes('in_comment'))
  check('S7b 真代码里的 task_type 必须保留(否则判据失明)', masked.includes('task_type="in_code"'))

  const both = pickFace(['--staged', '--worktree'])
  check('S8a 两面旗同给 ⇒ 判死,不猜该看哪个面', both.face === null && Boolean(both.error))
  check('S8b 默认档必须是 HEAD', pickFace([]).face === 'head')
  check('S8c --staged 必须是索引面', pickFace(['--staged']).face === 'staged')
  check('S8d --worktree 只是人工逃生舱', pickFace(['--worktree']).face === 'worktree')

  const tailComment = judge(fixtureInputs({
    [PY_EXECUTORS]: base[PY_EXECUTORS] + '\n# 后面又写了一行提到 task_type="alpha" 的注释\n',
  }), FIXTURE_LEDGER)
  check('S9 追加注释不得改变结论(判据不锚行号/字节位)', tailComment.violations.length === clean.violations.length)

  const jsonable = JSON.stringify(buildJson(clean, 'head'))
  check('S10 --json 输出必须可 parse 且含三面', JSON.parse(jsonable).implemented.length === 3)

  const passed = results.filter(([, ok]) => ok).length
  for (const [name, ok] of results) console.log((ok ? 'PASS  ' : 'FAIL  ') + name)
  console.log('')
  console.log(`自检 ${passed}/${results.length} 通过`)
  return passed === results.length ? 0 : 1
}

export function main(argv = args) {
  if (argv.includes('--self-test')) return selfTest()
  if (process.env.HUSKY_SKIP_BG_TASK_TYPE_PARITY === '1') {
    console.log('跳过 后台任务类型对账(HUSKY_SKIP_BG_TASK_TYPE_PARITY=1)')
    return 0
  }
  const sel = pickFace(argv)
  if (sel.error) {
    console.error(`判定面自相矛盾 — ${sel.error}`)
    return 2
  }
  const rootIdx = argv.indexOf('--root')
  const hasRoot = rootIdx >= 0 && Boolean(argv[rootIdx + 1])
  if (hasRoot && sel.face !== 'worktree') {
    console.error('--root 只在 --worktree 档有效(换根却按 HEAD/索引读 = 双根分裂)')
    return 2
  }
  let inputs
  try {
    inputs = readInputs(hasRoot ? resolvePath(argv[rootIdx + 1]) : ROOT_DEFAULT, sel.face)
  } catch (e) {
    if (e instanceof Undetermined) {
      console.error(`无法判定(面=${sel.face}): ${e.message}`)
      return 2
    }
    console.error(`脚本异常: ${e && e.message ? e.message : String(e)}`)
    return 2
  }
  const out = judge(inputs)
  if (argv.includes('--json')) console.log(JSON.stringify(buildJson(out, sel.face), null, 2))
  else console.log(report(out, sel.face))
  return out.violations.length ? 1 : 0
}

export const isDirectRun = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  try {
    process.exitCode = main()
  } catch (e) {
    console.error(`脚本自身异常: ${e && e.stack ? e.stack : String(e)}`)
    process.exitCode = 2
  }
}

export const __test__ = {
  judge,
  parseRegistryTypes,
  parseAdvertised,
  parseDispatchSurface,
  parseDagWiring,
  maskPyNoise,
  fixtureInputs,
  fixtureBase,
  pickFace,
  readInputs,
  report,
  buildJson,
  selfTest,
  EXPECTED_UNWIRED_IN_MCP_SERVER,
  FIXTURE_LEDGER,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
