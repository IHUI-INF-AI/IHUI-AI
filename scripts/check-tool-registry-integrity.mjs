#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-tool-registry-integrity.mjs — 工具名可用性与可达性对账门
 *
 * 病理(V3 #49,2026-09-26 立):
 *   ai-service 的 fs 类工具存在**两个相交但不对等的可达面**,此前没有任何地方说明:
 *     (a) 本地注册面 —— 名字在 `mcp_server._TOOL_HANDLERS` 里,任何部署形态都可执行;
 *     (b) 浏览器委托面 —— 名字**不在**本地注册表,仅在请求携带 `workspace_context` 时
 *         由前端 `apps/web/src/lib/workspace-tool-executor.ts` 执行。
 *   后果:`apply_patch` / `create_file` / `delete_file` / `move_file` 属于 (b) 而非 (a),
 *   于是桌面端/本地工作区(无 workspace_context)下调它们会一路走到 `_mcp.call_tool`
 *   拿到模糊的「未知工具」—— 模型不知道为什么失败,也不知道该换成哪个工具,只会
 *   原地重试到 max_iterations 打满。
 *   同类次生病害:别名表 `_TOOL_ALIASES` 原先只有 2 条,且**没有任何东西校验它的值域**
 *   ——一旦有人写 `"xxx": "not_a_real_tool"`,模型调 xxx 会静默变成调一个不存在的工具。
 *
 * 判据(三面互相咬死,任一侧单边改名都会被抓):
 *   J1 `_FS_DEPENDENT_TOOLS` 每个成员必须至少有一个落点:∈ 本地注册表 **或** ∈ 前端 case。
 *      两者皆无 = 真幽灵(任何部署形态下都不可达)。
 *   J2 `_TOOL_ALIASES` 的**值域**必须 ⊆ 本地注册表 —— 别名不许指向空气。
 *   J3 `_TOOL_ALIASES` 的**键**不得命中已注册的真工具名(否则会静默屏蔽真工具的调用)。
 *   J4 `_TOOL_ALIASES` 的键/值都不得是委托专有成员(键命中会窃取委托语义;值命中会让
 *      本地路径去调一个本地不存在的名字)。
 *      (V3 #47 第三格,2026-09-26:J2/J3/J4 的取材面从 PY_LLM 移到 PY_MCP ——
 *       别名表已合成全仓唯一一份,住在 mcp_server.py,llm.py 改为 import。)
 *   J11 `apps/ai-service/app` 内 `_TOOL_ALIASES` 的**模块级定义必须恰好 1 处**
 *      (行首 `_TOOL_ALIASES` + 可选注解 + `=`;注释经 stripLineComments 剥除,
 *       `from … import _TOOL_ALIASES` 与缩进的消费行都不算定义)。出现第 2 处即红
 *       并点名全部路径 —— 本票的产出就是把两份独立真相合成一份,这条防止它再长回去:
 *       合表前 llm.py(26 条)与 mcp_server.py(2 条)各一份、公共 2 条取值相同纯属巧合,
 *       同一个别名在 A 内核被归一、经 call_tool 不被归一,「未知工具」随机出现。
 *   J5 `_DELEGATE_ONLY_TOOLS` ⊆ `_FS_DEPENDENT_TOOLS`、⊆ 前端 case、且 ∩ 本地注册表 = ∅
 *      —— 这三条一起定义什么叫「委托专有」,任一破都说明常量已与实际脱节。
 *   J6 前端实现了的工具必须 ∈ `_FS_DEPENDENT_TOOLS` ∪ 本地注册表 —— 否则前端那支实现
 *      永远不会被调到,是死代码。
 *   J7 `_DELEGATE_ONLY_HINTS` 的键集合 === `_DELEGATE_ONLY_TOOLS`(提示文案不许漏新老)。
 *   J8 `BUILTIN_ENGINE_TOOLS` 的每个成员必须在 `ENGINE_TOOL_BRIDGE` 有条目,且桥表不得留
 *      已不在这个名单里的旧条目(V3 #47 —— 引擎内核自带的名字此前对全部门禁盲视:实测
 *      `unified_exec` / `run_code` / `apply_patch` 既不在 `_ADMIN_ONLY_TOOLS` 也不在
 *      `_DEFAULT_HIGH_RISK_TOOLS`,于是**永不进审批门**,而同一能力经 run_command / file_edit
 *      进主链路时要审批 —— 授权面随入口而变就是 #47 的病根)。
 *   J9 桥表声明的注册表等价物必须真在 `_TOOL_HANDLERS` 里(回查落到空气上=等价声明没写)。
 *   J10 等价物为 None 的条目必须带理由字符串(否则「注册表确实没有」与「漏登记」在账面同形)。
 *   J12 内置名单只允许有一处字面量清单(V3 #47 第一格,2026-09-26):
 *      a) `agent_engine.py` 的代码面(已抹注释与 docstring)出现 `"内置名": self.` ⇒ 红
 *         —— 那正是被消除的 `builders` dict 形态:名单改一处、构造表改另一处时,
 *         表现是"某个内置名永远构造不出来",而 J8 读的是名单,看不见这张表;
 *      b) 除 `BUILTIN_ENGINE_TOOLS` 外任何模块级字面量集合含 ≥3 个内置名 ⇒ 红(第二份清单;
 *         阈值 3 放过单个名字的巧合性引用,如宿主同名覆盖判定)。
 *      判结构前必须抹 docstring:本仓的说明文字会照着写出被禁形态,按全文判会把
 *      "解释自己的散文"判成违规(守门 131/70 同一型假阳)。
 *   J13 唯一解析出口必须真装车(V3 #47 第二格):桥模块要定义 `resolve_engine_tool`,
 *      且"名字是否已注册"必须现读 `mcp_server._TOOL_HANDLERS`(不许在桥里再抄一份注册清单);
 *      A/B 共用的执行入口 `mcp_server` 必须**既 import 又调用**它 —— 只 import 不构成接线。
 *      没有这条,票面那句"C 的内置名在 A/B 一个都调不到"原样成立而账面多了一张漂亮的表
 *      (守门 64/70/81 的"造好没装车"同型)。
 *   J14 处置结论(mode ∈ BRIDGE_MODES,现读自桥模块,不抄第二份)与「有没有注册表等价物」
 *      必须双向咬合:port/map ⇒ 必有等价物;local ⇒ 必无等价物。否则 mode 就是一列
 *      可以随时改口的标签 —— 把 local 涂成 map 就等于宣称"已归一"。
 *   J15 票面末格「JSON-RPC 只留协议适配层」(V3 #47,2026-09-27):
 *      agent_engine 是 JSON-RPC 协议层,它的内置工具面必须**只由处置表 + 唯一注册表驱动**:
 *        a) 代码面每一处 `ToolDefinition(name=<字面量> …)` 构造必须落在 BUILTIN_ENGINE_TOOLS
 *           在案的内置名的 `_<name>_tool` 构造函数里,且字面量名 == 构造函数名 —— 新增一个
 *           未登记的构造函数(RPC 面又自带工具定义)= 红;
 *        b) 处置为 'port' 的名字,其构造函数**不得**再内联 `ToolDefinition(`(name/description
 *           的唯一来源是注册表),必须走 `engine_tool_bridge.port_tool_definition`;桥模块
 *           必须定义该出口(出口没了而 port 条目还在 = 判据落空,红);
 *        c) map/local 的构造必须存在且恰好一处(0 处 = "名单里有、构造不出来",
 *           ≥2 处 = 同名双定义,都红)。
 *      `name=` 非字面量的构造(如 `_build_host_tool_definitions` 把**客户端注册**的
 *      HostToolSpec 转成循环定义)正是"协议 ↔ 内部调用"的适配层本体 —— 只如实报数,
 *      绝不判红(一刀切会把这个票禁止删的东西删没,§7 三问)。
 *      判构造前必须抹 docstring:说明文字里会出现 `ToolDefinition(执行体回调客户端)`
 *      这种带括号的提法(真仓 6815 行就有),按全文判就是"解释自己的散文被判违规"。
 *
 * 形态漂移也是判据:桥表的值被改成裸字符串/构造调用时逐条记 malformed 并判红,
 * 因为"解析器读空"在这套判据里的表现就是 0 处违规 = 假绿。
 *
 * 取材铁律:Python 侧一律经 Python 自身的 `ast.literal_eval` 取集合成员,**不靠整行 grep**。
 *   `_FS_DEPENDENT_TOOLS` 上方有一段注释里写着 `list_files`(2026-08-06 移出说明),
 *   裸 grep 会把注释里的名字算成集合成员,直接造成假绿/假红。
 *
 * 用法:
 *   node scripts/check-tool-registry-integrity.mjs             (报告模式, 漂移 exit 1)
 *   node scripts/check-tool-registry-integrity.mjs --quiet     (无漂移时静默, 供 pre-commit)
 *   node scripts/check-tool-registry-integrity.mjs --self-test (自检, 变异验证咬住各判据)
 *   node scripts/check-tool-registry-integrity.mjs --root <dir>(改取材根目录, 供夹具)
 * 集成位置:scripts/lib/pre-commit-hook.js(blocking,V3 #49)。
 * 跳过: HUSKY_SKIP_TOOL_REGISTRY_INTEGRITY=1
 */

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve as resolvePath } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { COLORS as C } from './lib/logger.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'
import { Undetermined, catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

const ROOT_DEFAULT = join(fileURLToPath(import.meta.url), '..', '..')
const args = process.argv.slice(2)
const quiet = args.includes('--quiet')
const selfTest = args.includes('--self-test')
const rootFlagIdx = args.indexOf('--root')
const HAS_ROOT_FLAG = rootFlagIdx >= 0 && Boolean(args[rootFlagIdx + 1])
const ROOT = HAS_ROOT_FLAG ? resolvePath(args[rootFlagIdx + 1]) : ROOT_DEFAULT

/**
 * 判定面(2026-09-26 收口)。原来三份被审文件是 readFileSync(join(ROOT, …)) 按**磁盘**读的,
 * 于是并发会话手里一份未提交的 llm.py(整个 _DELEGATE_ONLY_TOOLS 字面量被删)会把**无关**提交
 * 判成"无法判定"并 exit 1 —— 实测今晚连挡两枚提交,而守门批 162 道全绿、红在批外那一步,
 * 唯一出路被写成跳门(一次跳门≈全部守门对该提交作废,§12e 同型)。
 * 现:默认判 HEAD blob、--staged 判索引 blob、--worktree 只作人工逃生舱,两面旗同给判死;
 * --root 只在 --worktree 档有效(换根却按 HEAD/索引读 = 双根分裂)。
 * 面取不到 ⇒ exit 2「无法判定」,不冒红也不记绿;而"面里真没有那个字面量"仍是判据红(exit 1)。
 */
export function pickFace(argv) {
  return selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
}

/** 三份被审文件按同一个面、同一轮读满;取不到一律抛 Undetermined(绝不回落另一个面)。 */
function inputRels() {
  // 不在模块顶层求值:PY_LLM/PY_MCP/TS_EXEC 声明在本函数之后,顶层数组会撞 TDZ。
  return [PY_LLM, PY_MCP, TS_EXEC, PY_ENGINE, PY_BRIDGE]
}
function readInputs(root, face) {
  const rels = inputRels()
  if (face === 'worktree') {
    const out = {}
    for (const rel of rels) {
      const text = readWorktreeFile(root, rel)
      if (text === null || text === undefined)
        throw new Undetermined(rel + ' 在磁盘上不存在(工作树档)')
      out[rel] = text
    }
    return out
  }
  const prefix = face === 'staged' ? ':' : 'HEAD:'
  const specs = rels.map((rel) => prefix + rel)
  const got = catBatch(root, specs, { maxBuffer: 1 << 28 })
  const out = {}
  for (let i = 0; i < rels.length; i++) {
    const text = got.get(specs[i])
    if (text === null || text === undefined)
      throw new Undetermined((face === 'staged' ? '索引' : 'HEAD') + ' 取不到 ' + rels[i])
    out[rels[i]] = text
  }
  return out
}

const PY_LLM = 'apps/ai-service/app/routers/llm.py'
const PY_MCP = 'apps/ai-service/app/services/mcp_server.py'
const TS_EXEC = 'apps/web/src/lib/workspace-tool-executor.ts'
// J11 的枚举面(V3 #47 第三格):别名表的模块级定义只允许存在于这个包内的一处。
const APP_PY_DIR = 'apps/ai-service/app'
// V3 #47(2026-09-26 并入):引擎内核自带的内置名,与「能力归口」声明表。
// 这张表存在的理由就是本门此前对 C 内核全盲 —— 全文 BUILTIN 0 命中,
// 于是 unified_exec / run_code / apply_patch 三个「起 shell、跑代码、写文件」
// 的名字在两条链上套着不同判定而无人看守。
const PY_ENGINE = 'apps/ai-service/app/services/agent_engine.py'
const PY_BRIDGE = 'apps/ai-service/app/services/engine_tool_bridge.py'

/**
 * 剥掉 Python 行注释(保留字符串内部的 `#`)。
 * 这不是洁癖:`_FS_DEPENDENT_TOOLS` 上方就有一句注释写着 `list_files`
 * (2026-08-06 把它移出本集合的说明),不剥会让已移出的名字重新被读成成员。
 */
function stripLineComments(src) {
  const out = []
  for (const line of src.split('\n')) {
    let buf = ''
    let quote = null
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (quote) {
        if (ch === '\\') {
          buf += ch + (line[i + 1] ?? '')
          i++
          continue
        }
        if (ch === quote) quote = null
        buf += ch
        continue
      }
      if (ch === '"' || ch === "'") {
        quote = ch
        buf += ch
        continue
      }
      if (ch === '#') break
      buf += ch
    }
    out.push(buf)
  }
  return out.join('\n')
}

/**
 * 剥掉 Python 的**三引号 docstring 内容**与行注释,单行字符串**原样保留**。
 * 只给 J12 用:"内置名被抄成第二份名单"是**代码结构**问题 —— 而代码里的 dict 键正是
 * 单行字符串,所以不能连单行串一起抹(抹了判据就瞎);要抹的是散文的载体:注释与
 * docstring。本仓的说明文字里会照着写出被禁形态(agent_engine 的 docstring 就写着
 * "改前这里是一张 …"),按全文判会把"解释自己的散文"判成违规 —— 守门 131/70 同一型
 * 假阳,而散文一改判据就漂绿。
 */
function stripPyDocstrings(src) {
  const out = []
  let i = 0
  while (i < src.length) {
    const ch = src[i]
    if (ch === '#') {
      while (i < src.length && src[i] !== '\n') i++
      continue
    }
    if (ch === '"' || ch === "'") {
      const triple = src.slice(i, i + 3) === ch.repeat(3)
      if (triple) {
        out.push(ch.repeat(3))
        i += 3
        while (i < src.length && !src.startsWith(ch.repeat(3), i)) i++
        i += 3
        out.push(ch.repeat(3))
        continue
      }
      // 单行字符串 = 代码(键名/取值都在这一层),逐字留下
      out.push(ch)
      i++
      while (i < src.length && src[i] !== ch && src[i] !== '\n') {
        if (src[i] === '\\') {
          out.push(src[i], src[i + 1] ?? '')
          i += 2
          continue
        }
        out.push(src[i])
        i++
      }
      if (i < src.length && src[i] === ch) {
        out.push(ch)
        i++
      }
      continue
    }
    out.push(ch)
    i++
  }
  return out.join('')
}

/**
 * 取出某个模块级 set/dict 字面量的原始文本(括号配对,跳过字符串内的括号)。
 * @returns {string|null} 找不到返回 null
 */
function pyCollection(src, varName) {
  const lines = stripLineComments(src)
  const decl = new RegExp(`^${varName}\\s*(?::[^=\\n]*)?=\\s*([{\\[(])`, 'm')
  const m = decl.exec(lines)
  if (!m) return null
  const openIdx = lines.indexOf(m[1], m.index)
  const open = m[1]
  const close = open === '{' ? '}' : open === '[' ? ']' : ')'
  let depth = 0
  let quote = null
  for (let i = openIdx; i < lines.length; i++) {
    const ch = lines[i]
    if (quote) {
      if (ch === '\\') i++
      else if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === "'") quote = ch
    else if (ch === open) depth++
    else if (ch === close) {
      depth--
      if (depth === 0) return lines.slice(openIdx, i + 1)
    }
  }
  return null
}

/** set 字面量的成员(所有字符串 token)。 */
function setMembers(lit) {
  const names = new Set()
  for (const m of lit.matchAll(/"([^"\n]+)"|'([^'\n]+)'/g)) names.add(m[1] ?? m[2])
  return names
}

/** dict 字面量的 key 集合。 */
function dictKeySet(fileAbs, src, varName) {
  const lit = pyCollection(src, varName)
  if (lit === null) throw new Error(`${fileAbs}: 未找到 ${varName} 的字面量赋值`)
  const keys = new Set()
  for (const m of lit.matchAll(/(?:"([A-Za-z0-9_]+)"|'([A-Za-z0-9_]+)')\s*:/g))
    keys.add(m[1] ?? m[2])
  return keys
}

/** dict 字面量的键值对(用于 alias 别名表)。 */
function dictMap(fileAbs, src, varName) {
  const lit = pyCollection(src, varName)
  if (lit === null) throw new Error(`${fileAbs}: 未找到 ${varName} 的字面量赋值`)
  const out = {}
  for (const m of lit.matchAll(
    /(?:"([A-Za-z0-9_]+)"|'([A-Za-z0-9_]+)')\s*:\s*(?:"([A-Za-z0-9_]+)"|'([A-Za-z0-9_]+)')/g,
  )) {
    out[m[1] ?? m[2]] = m[3] ?? m[4]
  }
  return out
}

/** 前端 switch-case 里实现了的工具名。 */
function frontendCases(texts) {
  const src = texts[TS_EXEC]
  const names = new Set()
  for (const m of src.matchAll(/^\s*case '([A-Za-z0-9_]+)':/gm)) names.add(m[1])
  return names
}

/**
 * J11(V3 #47 第三格,2026-09-26):枚举 `apps/ai-service/app` 内**模块级**
 * `_TOOL_ALIASES` 定义(`行首标识符 + 可选注解 + =`)出现在哪些文件、各几处。
 * 判"定义"而非判"提到":
 *   - `from ..services.mcp_server import _TOOL_ALIASES` 行首是 `from`,不算;
 *   - 缩进的消费行(`tool_name = _TOOL_ALIASES.get(...)`)不匹配行首锚定,不算;
 *   - 注释里的 `_TOOL_ALIASES = ...` 先经 stripLineComments 剥除,不算(与本门
 *     取材铁律同源 —— 裸 grep 会把说明文字读成代码)。
 * 取材面纪律照本文件既有规矩:全量判 HEAD blob、--staged 判索引 blob、--worktree
 * 只走磁盘;清单与内容同面同轮,任一处取不到 ⇒ Undetermined(exit 2),不回落。
 * 枚举到 0 个 .py 判"无法判定"而非"0 处定义"的红 —— 空扫是尺子坏了,不是世界坏了。
 * @returns {Array<{path: string, count: number}>} 含定义的文件(相对路径,posix 分隔)
 */
function listAppPyRels(root, face) {
  if (face === 'worktree') {
    const out = []
    const walk = (dirAbs, relPrefix) => {
      let entries
      try {
        entries = readdirSync(dirAbs, { withFileTypes: true })
      } catch {
        throw new Undetermined(`工作树枚举 ${relPrefix} 失败(目录不存在或不可读)`)
      }
      for (const e of entries) {
        const rel = relPrefix + '/' + e.name
        if (e.isDirectory()) walk(join(dirAbs, e.name), rel)
        else if (e.isFile() && e.name.endsWith('.py')) out.push(rel)
      }
    }
    walk(join(root, APP_PY_DIR), APP_PY_DIR)
    if (out.length === 0) throw new Undetermined(`工作树 ${APP_PY_DIR} 枚举到 0 个 .py(空扫不判)`)
    return out.sort()
  }
  const args =
    face === 'staged'
      ? ['ls-files', '-z', '--', APP_PY_DIR]
      : ['ls-tree', '-r', '--name-only', '-z', 'HEAD', '--', APP_PY_DIR]
  const out = gitRaw(args, root)
  const rels = [...new Set(out.split('\0').filter(Boolean))].filter((p) => p.endsWith('.py'))
  if (rels.length === 0)
    throw new Undetermined(
      `${face === 'staged' ? '索引' : 'HEAD'} 面 ${APP_PY_DIR} 枚举到 0 个 .py(空扫不判)`,
    )
  return rels.sort()
}

const MODULE_ALIAS_DEF_LINE = /^_TOOL_ALIASES[ \t]*(?::[^=\n]*)?[ \t]*=/

function scanAliasDefinitions(root, face) {
  const rels = listAppPyRels(root, face)
  const contents = new Map()
  if (face === 'worktree') {
    for (const rel of rels) {
      const text = readWorktreeFile(root, rel)
      if (text === null || text === undefined) throw new Undetermined(`${rel} 磁盘读取失败(工作树档)`)
      contents.set(rel, text)
    }
  } else {
    const prefix = face === 'staged' ? ':' : 'HEAD:'
    const specs = rels.map((rel) => prefix + rel)
    const got = catBatch(root, specs, { maxBuffer: 1 << 28 })
    for (let i = 0; i < rels.length; i++) {
      const text = got.get(specs[i])
      if (text === null || text === undefined)
        throw new Undetermined(
          `${rels[i]} 在 ${face === 'staged' ? '索引' : 'HEAD'} 取不到(清单与内容必须同面读满)`,
        )
      contents.set(rels[i], text)
    }
  }
  const defs = []
  for (const rel of rels) {
    let count = 0
    for (const line of stripLineComments(contents.get(rel)).split('\n'))
      if (MODULE_ALIAS_DEF_LINE.test(line)) count++
    if (count > 0) defs.push({ path: rel, count })
  }
  return defs
}

/** Python 侧本地注册的工具名:`_TOOL_HANDLERS` 的 key。 */
function localRegistry(texts) {
  return dictKeySet(PY_MCP, texts[PY_MCP], '_TOOL_HANDLERS')
}

/**
 * 引擎能力桥表 `ENGINE_TOOL_BRIDGE` 的条目。
 *
 * 每条读三件事:
 *  - `equivalent` —— 第一个元组元素(注册表里的同一能力拥有者,或 None);
 *  - `hasReason`  —— 第二个元素是否给了字符串(理由里有多段隐式拼接,内容刻意不解析:
 *                    把它们当值读只会让判据随格式化漂移,本门问「有没有交代」);
 *  - `mode`       —— 第三个元素的处置结论(port/map/local),V3 #47 第二格新增。
 *
 * 为什么不再用一条正则:真表里的理由带 ASCII 括号(`scope(sandbox_full_access / …)`)
 * 且跨多行隐式拼接,任何"到闭合括号为止"的正则都会在那里断掉 —— 而断掉的形态是
 * **少读几条**,在门上表现为"0 处违规 = 假绿"。改成串/括号感知的逐条扫描。
 */
function bridgeEntries(texts) {
  const src = texts[PY_BRIDGE]
  const lit = pyCollection(src, 'ENGINE_TOOL_BRIDGE')
  if (lit === null) {
    throw new Error(`${PY_BRIDGE}: 未找到 ENGINE_TOOL_BRIDGE 的字面量赋值(读空=判据失明,不记绿)`)
  }
  const out = new Map()
  for (const { key, body } of scanTupleEntries(lit)) {
    if (body === null) {
      // 值不是元组形态(被改成裸字符串 / 构造调用)—— 记一条"读不全"而不是静默跳过:
      // 静默跳过就是形态漂了而账面全绿(§22c 归档器 11 天扫到 0 条同一型)。
      out.set(key, { equivalent: null, hasReason: false, mode: null, malformed: true })
      continue
    }
    const elems = splitTupleElements(body)
    const first = elems[0] ?? 'None'
    const second = elems[1] ?? 'None'
    const third = elems[2] ?? 'None'
    out.set(key, {
      equivalent: /^"([A-Za-z0-9_]+)"$/.exec(first)?.[1] ?? null,
      hasReason: second.startsWith('"'),
      mode: /^"([a-z_]+)"$/.exec(third)?.[1] ?? null,
      malformed: false,
    })
  }
  return out
}

/** 在 dict 字面量里逐条扫 `"key": <value>`;value 是元组时返回其内部文本,否则返回 null。 */
function scanTupleEntries(lit) {
  const found = []
  let i = 0
  while (i < lit.length) {
    const ch = lit[i]
    if (ch === '"' || ch === "'") {
      const key = lit.slice(i + 1, skipString(lit, i) - 1)
      const after = skipString(lit, i)
      let j = after
      while (j < lit.length && /\s/.test(lit[j])) j++
      if (lit[j] !== ':') {
        // 不是"键:"位置(例如理由里的拼接片段、集合成员)—— 跳过整段字符串继续
        i = after
        continue
      }
      let k = j + 1
      while (k < lit.length && /\s/.test(lit[k])) k++
      if (lit[k] === '(') {
        const end = matchBracket(lit, k, '(', ')')
        if (end < 0) return found
        found.push({ key, body: lit.slice(k + 1, end) })
        i = end + 1
        continue
      }
      // 值不是元组(被改成裸字符串 / None / 构造调用):记一条 malformed,
      // 静默跳过等于"表读空而账面全绿"—— 本仓最高频的判据失效形态。
      found.push({ key, body: null })
      let m = k
      while (m < lit.length && lit[m] !== ',' && lit[m] !== '}') m++
      i = m
      continue
    }
    i++
  }
  return found
}

/** 跳过一段字符串,返回结束后的下标(未闭合则返回文末)。 */
function skipString(text, start) {
  const quote = text[start]
  const triple = text.slice(start, start + 3) === quote.repeat(3)
  const delim = triple ? quote.repeat(3) : quote
  let i = start + delim.length
  while (i < text.length) {
    if (text[i] === '\\') {
      i += 2
      continue
    }
    if (text.startsWith(delim, i)) return i + delim.length
    if (!triple && text[i] === '\n') return i
    i++
  }
  return text.length
}

/** 括号配对:返回与 start 处开括号匹配的闭括号下标(找不到返回 -1)。 */
function matchBracket(text, start, open, close) {
  let depth = 0
  let i = start
  while (i < text.length) {
    const ch = text[i]
    if (ch === '"' || ch === "'") {
      i = skipString(text, i)
      continue
    }
    if (ch === open) depth++
    else if (ch === close) {
      depth--
      if (depth === 0) return i
    }
    i++
  }
  return -1
}

/** 按**顶层逗号**切元组元素(括号/字符串内的逗号不算)。 */
function splitTupleElements(tuple) {
  const parts = []
  let depth = 0
  let buf = ''
  let i = 0
  while (i < tuple.length) {
    const ch = tuple[i]
    if (ch === '"' || ch === "'") {
      const end = skipString(tuple, i)
      buf += tuple.slice(i, end)
      i = end
      continue
    }
    if (ch === '(' || ch === '[' || ch === '{') depth++
    else if (ch === ')' || ch === ']' || ch === '}') depth--
    if (ch === ',' && depth === 0) {
      parts.push(buf.trim())
      buf = ''
      i++
      continue
    }
    buf += ch
    i++
  }
  if (buf.trim() !== '') parts.push(buf.trim())
  return parts
}

/** 引擎内核自带的内置名(`BUILTIN_ENGINE_TOOLS` 元组成员)。 */
function engineBuiltins(texts) {
  const src = texts[PY_ENGINE]
  const lit = pyCollection(src, 'BUILTIN_ENGINE_TOOLS')
  if (lit === null) {
    throw new Error(`${PY_ENGINE}: 未找到 BUILTIN_ENGINE_TOOLS 的字面量赋值(读空=判据失明,不记绿)`)
  }
  return setMembers(lit)
}

/**
 * 处置结论的封闭集 —— **现读** `engine_tool_bridge.BRIDGE_MODES`,不在本门里抄第二份
 * (抄了就会漂移:Python 侧加一档、门不知道,新形态在门上表现为"mode 不合法"或更糟的
 * "读不到 mode 而放过")。读不到即抛:那正是"对着空气打分"。
 */
function bridgeModeSet(texts) {
  const lit = pyCollection(texts[PY_BRIDGE], 'BRIDGE_MODES')
  if (lit === null) {
    throw new Error(
      `${PY_BRIDGE}: 未找到 BRIDGE_MODES 的字面量赋值 —— 处置结论的封闭集读空时 J14 无判据,不记绿`,
    )
  }
  return setMembers(lit)
}

/**
 * J12 的取材:某个模块级字面量集合里出现的内置名(≥3 个才算"另抄的一份名单";
 * 1-2 个是巧合性引用,比如 host 覆盖判定里的单个名字,把它算成第二份真相就是假阳)。
 */
function strayBuiltinLists(texts, builtins) {
  const src = stripPyDocstrings(texts[PY_ENGINE])
  const out = []
  const decl = /^([A-Za-z_][A-Za-z0-9_]*)\s*(?::[^\n=]*)?=\s*([{[(])/gm
  for (const m of [...src.matchAll(decl)]) {
    const name = m[1]
    if (name === 'BUILTIN_ENGINE_TOOLS') continue
    const lit = pyCollection(src, name)
    if (lit === null) continue
    const hit = [...setMembers(lit)].filter((x) => builtins.has(x))
    if (hit.length >= 3) out.push({ name, hit: hit.sort() })
  }
  return out
}

/**
 * J15 的取材(V3 #47 末格):把 `_*_tool` 构造函数按 4 空格缩进的 def 切段,
 * 找出每段里的 `ToolDefinition(` 构造与它的 `name=` 字面量。
 * 只在**已抹 docstring** 的代码面上跑 —— 真仓 `_build_host_tool_definitions` 的
 * docstring 里就写着「转成主循环的 ToolDefinition(执行体回调客户端)」,
 * 不抹会把说明文字判成构造点(本仓 131/70 同型假阳)。
 */
function definitionSites(strippedEngineSrc) {
  const defs = []
  for (const m of strippedEngineSrc.matchAll(/^ {4}(?:async )?def ([A-Za-z0-9_]+)\(/gm))
    defs.push({ name: m[1], idx: m.index })
  const sites = []
  for (const m of strippedEngineSrc.matchAll(/ToolDefinition\s*\(/g)) {
    const openIdx = m.index + m[0].length - 1
    const closeIdx = matchBracket(strippedEngineSrc, openIdx, '(', ')')
    const body =
      closeIdx === -1
        ? strippedEngineSrc.slice(openIdx + 1)
        : strippedEngineSrc.slice(openIdx + 1, closeIdx)
    let owner = null
    for (const dd of defs) {
      if (dd.idx < m.index) owner = dd
      else break
    }
    const lit = /(?:^|[(,])\s*name\s*=\s*(["'])([^"']+)\1/.exec(body)
    sites.push({
      owner: owner ? owner.name : null,
      nameLit: lit ? lit[2] : null,
      idx: m.index,
    })
  }
  return { defs, sites }
}

function collect(texts) {
  const llm = texts[PY_LLM]
  const take = (name) => {
    const lit = pyCollection(llm, name)
    if (lit === null) throw new Error(`${PY_LLM}: 未找到 ${name} 的字面量赋值`)
    return lit
  }
  const builtins = engineBuiltins(texts)
  return {
    fs: setMembers(take('_FS_DEPENDENT_TOOLS')),
    delegateOnly: setMembers(take('_DELEGATE_ONLY_TOOLS')),
    hints: dictKeySet(PY_LLM, llm, '_DELEGATE_ONLY_HINTS'),
    // V3 #47 第三格(2026-09-26):别名表已合成全仓唯一一份,住在 mcp_server.py;
    // J2/J3/J4 的取材面随之从 PY_LLM 改到 PY_MCP(判据本体一字未动)。
    aliases: dictMap(PY_MCP, texts[PY_MCP], '_TOOL_ALIASES'),
    local: localRegistry(texts),
    frontend: frontendCases(texts),
    builtins,
    bridge: bridgeEntries(texts),
    // V3 #47 第二格(2026-09-26):处置结论的封闭集 + J12/J13 的取材面。
    modes: bridgeModeSet(texts),
    engineSrc: texts[PY_ENGINE],
    mcpSrc: texts[PY_MCP],
    bridgeSrc: texts[PY_BRIDGE],
    // 「另抄的一份内置名清单」(J12):同一次取材里算,避免两处读不同版本
    strayLists: strayBuiltinLists(texts, builtins),
  }
}

function check(d, aliasDefs) {
  const failures = []
  const sorted = (s) => [...s].sort()

  // J1 —— 真幽灵:本地不注册、前端也不实现
  for (const name of sorted(d.fs)) {
    if (!d.local.has(name) && !d.frontend.has(name)) {
      failures.push(
        `J1 真幽灵工具名 '${name}':既不在 ${PY_MCP}._TOOL_HANDLERS,也不在 ${TS_EXEC} 的 case 里 —— 任何部署形态都不可达`,
      )
    }
  }

  // J2 —— 别名值域不许指向空气
  for (const [alias, target] of Object.entries(d.aliases)) {
    if (!d.local.has(target)) {
      failures.push(
        `J2 别名 '${alias}' → '${target}',但 '${target}' 不在本地注册表 —— 别名指向空气`,
      )
    }
  }

  // J3 —— 别名键不该是已注册的真工具名
  for (const alias of Object.keys(d.aliases)) {
    if (d.local.has(alias)) {
      failures.push(`J3 别名键 '${alias}' 同时是已注册真工具名 —— 归一化会静默改写掉真工具的调用`)
    }
  }

  // J4 —— 别名不许碰委托专有工具
  for (const [alias, target] of Object.entries(d.aliases)) {
    if (d.delegateOnly.has(alias)) {
      failures.push(`J4 别名键 '${alias}' 是委托专有工具 —— 会窃取浏览器委托语义`)
    }
    if (d.delegateOnly.has(target)) {
      failures.push(
        `J4 别名 '${alias}' → '${target}' 是委托专有工具 —— 本地路径会调到本地不存在的名字`,
      )
    }
  }

  // J5 —— 「委托专有」的三条定义
  for (const name of sorted(d.delegateOnly)) {
    if (!d.fs.has(name)) {
      failures.push(
        `J5 '${name}' 在 _DELEGATE_ONLY_TOOLS 却不在 _FS_DEPENDENT_TOOLS —— 永远不会走委托分支`,
      )
    }
    if (!d.frontend.has(name)) {
      failures.push(
        `J5 '${name}' 标为委托专有,但 ${TS_EXEC} 没有对应 case —— 委托过去只会得到「浏览器端不支持」`,
      )
    }
    if (d.local.has(name)) {
      failures.push(
        `J5 '${name}' 已在本地注册表,却仍标为委托专有 —— 语义失效,应移出 _DELEGATE_ONLY_TOOLS`,
      )
    }
  }

  // J6 —— 前端实现了却没人会调到 = 死代码
  for (const name of sorted(d.frontend)) {
    if (!d.fs.has(name) && !d.local.has(name)) {
      failures.push(
        `J6 ${TS_EXEC} 实现了 '${name}',但它既不可委托也不在本地注册 —— 该实现永远执行不到`,
      )
    }
  }

  // J7 —— 提示文案必须与集合同步(双向)
  for (const name of sorted(d.delegateOnly)) {
    if (!d.hints.has(name)) {
      failures.push(
        `J7 _DELEGATE_ONLY_HINTS 缺 '${name}' 的等价建议 —— 报错时模型拿不到「该换哪个工具」`,
      )
    }
  }
  for (const name of sorted(d.hints)) {
    if (!d.delegateOnly.has(name)) {
      failures.push(
        `J7 _DELEGATE_ONLY_HINTS 多出 '${name}' —— 已不在 _DELEGATE_ONLY_TOOLS,属过期条目`,
      )
    }
  }

  // J8 —— 引擎内置名与能力桥双向对账(V3 #47,2026-09-26 并入)。
  // 只查「内置名有没有条目」是单向的:内置名被删或改名后,桥表会留一条无人认领的旧映射;
  // 而新内置名照样能悄悄加进 BUILTIN_ENGINE_TOOLS 不登记 —— 两个方向各判一次。
  for (const name of sorted(d.builtins)) {
    if (!d.bridge.has(name)) {
      failures.push(
        `J8 引擎内置名 '${name}'(${PY_ENGINE} 的 BUILTIN_ENGINE_TOOLS)在 ${PY_BRIDGE} 没有能力桥条目 ` +
          '—— 它绕开统一注册表的判定,授权面随入口而变',
      )
    }
  }
  for (const name of sorted(d.bridge.keys())) {
    if (!d.builtins.has(name)) {
      failures.push(
        `J8 能力桥条目 '${name}' 已不在 ${PY_ENGINE} 的 BUILTIN_ENGINE_TOOLS —— 清单腐烂(登记比现实旧)`,
      )
    }
  }

  // J9 —— 桥表声明的等价物必须真在注册表里,否则「回查」回查到空气,判定静默不变。
  for (const [name, entry] of [...d.bridge.entries()].sort()) {
    if (entry.equivalent !== null && !d.local.has(entry.equivalent)) {
      failures.push(
        `J9 引擎内置名 '${name}' 声明等价物 '${entry.equivalent}',但它不在 ${PY_MCP}._TOOL_HANDLERS ` +
          '—— 等价声明等于没写',
      )
    }
  }

  // J10 —— 无等价物必须带理由:「注册表确实没有」与「有人漏登记」在账面必须不同形。
  for (const [name, entry] of [...d.bridge.entries()].sort()) {
    if (entry.equivalent === null && !entry.hasReason) {
      failures.push(
        `J10 引擎内置名 '${name}' 登记为「仅引擎本地」却没写理由 —— 空位与漏登记无法区分`,
      )
    }
  }

  // J14 —— 处置结论(mode)的纪律(V3 #47 第二格,2026-09-26)。
  // 票面要求"逐个点名处置结论:映射 / 移植 / 确属引擎专有",所以每条必须落在
  // BRIDGE_MODES 那个**现读**的封闭集里,且与"有没有注册表等价物"双向一致:
  //   port/map ⇒ 必有等价物(否则"归口"归到空气上);local ⇒ 必无等价物(否则该写 map)。
  // 没有这条,mode 就是一列可以随时改口的注释 —— 把 local 涂成 map 就等于宣称已归一。
  for (const [name, entry] of [...d.bridge.entries()].sort()) {
    if (entry.malformed) {
      failures.push(
        `J14 引擎内置名 '${name}' 的桥表值不是三元组字面量(${PY_BRIDGE})—— ` +
          '本表的形态约束是"纯字面量 dict",改成别的形态门就读空,而读空在门上表现为 0 处违规',
      )
      continue
    }
    if (entry.mode === null) {
      failures.push(
        `J14 引擎内置名 '${name}' 没有第三个字段(处置结论)—— 票面要求逐个点名映射/移植/引擎专有,不许留空`,
      )
      continue
    }
    if (!d.modes.has(entry.mode)) {
      failures.push(
        `J14 引擎内置名 '${name}' 的处置结论 '${entry.mode}' 不在 ${PY_BRIDGE}.BRIDGE_MODES ` +
          `(${[...d.modes].sort().join(' / ')})—— 封闭集外的标签无判据`,
      )
      continue
    }
    if (entry.mode !== 'local' && entry.equivalent === null) {
      failures.push(
        `J14 引擎内置名 '${name}' 处置为 '${entry.mode}' 却没有注册表等价物 —— 「归口」落到了空气上`,
      )
    }
    if (entry.mode === 'local' && entry.equivalent !== null) {
      failures.push(
        `J14 引擎内置名 '${name}' 处置为 'local'(注册表无此能力)却登记了等价物 '${entry.equivalent}' —— 两个字段互相推翻`,
      )
    }
  }

  // J12 —— 引擎内置名单只允许有一处字面量清单(V3 #47 第一格,2026-09-26)。
  // 立因:`agent_engine._builtin_tool_definitions` 里曾有一张把 14 个内置名**又抄一遍**的
  // builders dict,而 `BUILTIN_ENGINE_TOOLS` 只是"名单"。J8 读的是名单 —— 名单与构造表
  // 分叉时(加名字只改一处),表现是"某个内置名永远构造不出来"或运行时 KeyError,
  // 而门一路报绿。两条判据合起来才封住这一型:
  //   a) 代码面(已抹字符串,散文里写出那个形态不算)出现 `"内置名": self.` ⇒ 又抄了一份;
  //   b) 除 BUILTIN_ENGINE_TOOLS 外,任何模块级字面量集合含 ≥3 个内置名 ⇒ 第二份清单
  //      (阈值 3 是为了放过"单个名字的巧合性引用",比如宿主同名覆盖判定)。
  for (const name of sorted(d.builtins)) {
    const re = new RegExp(`"${name}"\\s*:\\s*self\\.`)
    if (re.test(stripPyDocstrings(d.engineSrc ?? ''))) {
      failures.push(
        `J12 引擎内置名 '${name}' 在 ${PY_ENGINE} 里又被抄成第二份字面量清单(` +
          '"内置名": self._x_tool 形态)—— 内置名单的唯一真相是 BUILTIN_ENGINE_TOOLS,构造必须按命名约定由它单向推导',
      )
    }
  }
  for (const { name, hit } of d.strayLists ?? []) {
    failures.push(
      `J12 ${PY_ENGINE} 的模块级字面量 '${name}' 含 ${hit.length} 个引擎内置名(${hit.join(', ')})` +
        ' —— 这是第二份内置名清单;删掉它,让 BUILTIN_ENGINE_TOOLS 唯一',
    )
  }

  // J13 —— 「唯一解析出口」必须真装车(V3 #47 第二格,2026-09-26)。
  // 桥表写出来不等于 A/B 调得到:`resolve_engine_tool` 若没有任何执行面调用它,
  // 「C 的内置名在 A/B 一个都调不到」这句话就原样成立,而账面多了一份漂亮的表。
  // 本仓最高频的失效型就是"造好没装车"(守门 64/70/81 同型),所以这里判的是调用点:
  //   a) 桥模块必须**定义**它,且"是否已注册"现读 `_TOOL_HANDLERS`(不许在桥里再抄一份注册清单);
  //   b) 三内核共用的执行入口 `mcp_server` 必须 import 它 **且** 调用它(只 import 不调用 = 没接)。
  if (!/def resolve_engine_tool\b/.test(d.bridgeSrc ?? '')) {
    failures.push(
      `J13 ${PY_BRIDGE} 未定义 resolve_engine_tool —— 唯一解析出口不见了,"映射"退回到只有表没有路`,
    )
  }
  if (!/\bin\s+_TOOL_HANDLERS\b|\bset\(\s*_TOOL_HANDLERS\b/.test(d.bridgeSrc ?? '')) {
    // 判"是否真拿它做成员检查",而不是判文件里出现过这个名字 —— 只 import 不用同样构成
    // 第二份真相(名字清单被写死在函数体里),而按"提到过"判会放过那一型。
    failures.push(
      `J13 ${PY_BRIDGE} 没有把 mcp_server._TOOL_HANDLERS 当成员判据现读 —— ` +
        '「名字是否已注册」一旦抄成第二份清单,注册表改了桥就是错的',
    )
  }
  const importsResolver = /from \.engine_tool_bridge import[^#\n]*resolve_engine_tool/.test(
    d.mcpSrc ?? '',
  )
  const callsResolver = /resolve_engine_tool\s*\(/.test(d.mcpSrc ?? '')
  if (!importsResolver || !callsResolver) {
    failures.push(
      `J13 ${PY_MCP} 未接上 resolve_engine_tool(import ${importsResolver ? '在' : '缺'}` +
        ` / 调用 ${callsResolver ? '在' : '缺'})` +
        ` —— 桥表与解析出口都在,但 A/B 主链路的 call_tool 不查它,「C 的内置名在 A/B 一个都调不到」原样成立`,
    )
  }

  // J11 —— 别名表的模块级定义必须恰好 1 处(V3 #47 第三格,2026-09-26)。
  // 本票的全部意义在于把 llm.py(26 条)与 mcp_server.py(2 条)两份独立真相合成
  // 一份;这条判据防的是"合成后又长回两份":任何第二处 `^_TOOL_ALIASES … =` 都红,
  // 且失败文案点名**全部**命中路径(两处都要被指名,不许只报一个)。
  // 0 处同样是红(表被删了,J2/J3/J4 就在对着空气打分)—— 判据不区分"多"与"无",
  // 只认"恰好 1"这一个事实。
  const aliasDefTotal = (aliasDefs ?? []).reduce((s, e) => s + e.count, 0)
  if (aliasDefTotal !== 1) {
    const where =
      aliasDefs && aliasDefs.length > 0
        ? aliasDefs.map((e) => `${e.path}(×${e.count})`).join(' + ')
        : '(一处也没有)'
    failures.push(
      `J11 ${APP_PY_DIR} 内 _TOOL_ALIASES 的模块级定义必须恰好 1 处,实测 ${aliasDefTotal} 处:${where} ` +
        '—— 两份表 = 同一个别名在 A 内核(llm tool loop)与 call_tool 两个入口结论不同,「未知工具」随机出现;合成本票的成果不得再被拆回去',
    )
  }

  // J15 —— JSON-RPC 面只留协议适配层(V3 #47 末格,2026-09-27)。
  // 票面原文:"JSON-RPC 只留协议适配层,工具定义一律来自唯一注册表"。前三格把**名单、
  // 授权解析、执行入口**收了口,但 RPC 面(agent_engine)仍逐条手抄自己的工具定义 ——
  // 其中处置为 'port' 的 web_search 与注册表**同名**,承载层合并时引擎面遮蔽注册表面,
  // 于是注册表那条 MCPTool 定义成了死元数据(第二份真相,且两份会长得越来越不像)。
  // 本判据把"自带定义"钉成三条结构事实(见文件头 J15);name 非字面量的构造是
  // 客户端 tools/register 的适配层(§7 不可删),只报数。
  const j15 = definitionSites(stripPyDocstrings(d.engineSrc ?? ''))
  // **偏移一致性**:stripPyDocstrings 是"删内容"不是"等长遮罩",defs/sites 的下标都在
  // 抹后的面上算,region 就必须从同一份抹后的面切 —— 拿 raw engineSrc 配 stripped 下标
  // 会切错窗口(本门第一版在真仓 web_search 上就是这么假红的)。
  const j15CodeFace = stripPyDocstrings(d.engineSrc ?? '')
  const literalSites = j15.sites.filter((s) => s.nameLit !== null)
  const dataDrivenSites = j15.sites.length - literalSites.length
  const ctorCountByBuilder = new Map()
  for (const s of literalSites) {
    const nm = s.nameLit
    const builder = s.owner
    const derived =
      builder !== null && builder !== undefined && builder.startsWith('_') && builder.endsWith('_tool')
        ? builder.slice(1, -'_tool'.length)
        : null
    if (derived === null) {
      failures.push(
        `J15 ${PY_ENGINE} 的构造 name="${nm}" 落在 \`_*_tool\` 构造函数之外(${builder ?? '模块/类级别'}) ` +
          '—— JSON-RPC 面的自带工具定义只能住在登记于名单的构造函数里,别处出现即第二份真相',
      )
      continue
    }
    if (derived !== nm) {
      failures.push(
        `J15 ${PY_ENGINE} 的构造函数 _${derived}_tool 里构造的名字是 "${nm}" —— 构造函数与定义名分叉,` +
          '表现是"改了一处另一处静默不跟随"(与 J12 消除的 builders dict 同型)',
      )
      continue
    }
    if (!d.builtins.has(nm)) {
      failures.push(
        `J15 RPC 面又自带工具定义:name="${nm}" 有 _${nm}_tool 构造,却不在 BUILTIN_ENGINE_TOOLS —— ` +
          '新增内置能力必须先过处置表(J8/J14),协议层不得自己长工具',
      )
      continue
    }
    const mode = d.bridge.get(nm)?.mode
    if (mode === 'port') {
      failures.push(
        `J15 port 工具 "${nm}" 的定义不得内联 —— 处置为 port 意味着"执行体与定义就是注册表那一份",` +
          `必须经 ${PY_BRIDGE}.port_tool_definition 现读唯一注册表;内联 name/description 就是第二份真相 ` +
          '(承载层合并时引擎面遮蔽注册表面,注册表那条退化成死元数据)',
      )
      continue
    }
    ctorCountByBuilder.set(`_${nm}_tool`, (ctorCountByBuilder.get(`_${nm}_tool`) ?? 0) + 1)
  }
  for (const name of sorted(d.builtins)) {
    const entry = d.bridge.get(name)
    if (!entry || entry.malformed || entry.mode === null) continue // J8/J14 已各自点名,不重复定罪
    const builderDef = j15.defs.find((dd) => dd.name === `_${name}_tool`)
    if (!builderDef) {
      failures.push(
        `J15 内置名 '${name}' 没有 _${name}_tool 构造函数 —— 运行时会 fail-fast(RuntimeError),` +
          '但那是"到第一次构造才炸";名单与实现分叉必须在提交前就红',
      )
      continue
    }
    if (entry.mode === 'port') {
      const nextIdx = j15.defs
        .map((dd) => dd.idx)
        .filter((x) => x > builderDef.idx)
        .sort((a, b) => a - b)[0]
      const region = j15CodeFace.slice(builderDef.idx, nextIdx ?? j15CodeFace.length)
      if (!/port_tool_definition\s*\(/.test(region)) {
        failures.push(
          `J15 port 工具 '${name}' 的构造函数没有调用 port_tool_definition —— 唯一定义出口没装车,` +
            '"工具定义一律来自唯一注册表"就只是一句注释(守门 13/64/70/81 的"造好没装车"同型)',
        )
      }
      continue
    }
    const ctors = ctorCountByBuilder.get(`_${name}_tool`) ?? 0
    if (ctors !== 1) {
      failures.push(
        `J15 内置名 '${name}'(mode=${entry.mode})的字面量定义构造应恰好 1 处,实测 ${ctors} 处 —— ` +
          '0 处 = 名单里有而定义构造不出来;≥2 处 = 同名双定义,最后一处静默覆盖前一处',
      )
    }
  }
  if (!/def port_tool_definition\b/.test(d.bridgeSrc ?? '')) {
    failures.push(
      `J15 ${PY_BRIDGE} 未定义 port_tool_definition —— port 档的唯一定义出口不存在,` +
        '而票面还有 mode=port 的条目,那条"定义来自唯一注册表"无处执行',
    )
  }
  d.j15DataDriven = dataDrivenSites
  return failures
}

// --- 自检(夹具 + 变异验证) -------------------------------------------------
function buildFixture(files) {
  const dir = mkScratch('tool-registry-integrity')
  for (const [rel, content] of Object.entries(files)) {
    const full = join(dir, rel)
    mkdirSync(join(full, '..'), { recursive: true })
    writeFileSync(full, content, 'utf8')
  }
  return dir
}

// V3 #47 第三格(2026-09-26):`_TOOL_ALIASES` 的唯一真实落点在 mcp_server.py,
// 所以夹具把它放进 fixHandlers(PY_MCP)而不是 fixPy(PY_LLM)—— 判据住哪侧,
// 夹具就必须长哪侧,否则自检测的是已经不存在的旧形态。
const CLEAN_ALIAS_BODY = '    "execute_command": "run_command",'
const fixPy = (fsBody, doBody, hintBody) => `# -*- coding: utf-8 -*-
_FS_DEPENDENT_TOOLS = {
${fsBody}
}
_DELEGATE_ONLY_TOOLS = {
${doBody}
}
_DELEGATE_ONLY_HINTS = {
${hintBody}
}
`
// V3 #47 第二格(2026-09-26):夹具必须与真仓同形 —— 桥表现在是三元组(带处置结论),
// 而 call_tool 必须真的 import + 调用 resolve_engine_tool。夹具若是旧二项形态,
// J13/J14 就只在真仓上判、自检里从未跑过,而"基线干净"那例会假绿。
const RESOLVER_WIRING =
  'from .engine_tool_bridge import resolve_engine_tool\n' +
  '    resolved = resolve_engine_tool(name)\n'

const fixHandlers = (names, aliasBody = CLEAN_ALIAS_BODY, extra = RESOLVER_WIRING) => `# -*- coding: utf-8 -*-
${extra}_TOOL_HANDLERS: dict[str, object] = {
${names.map((n) => `    "${n}": _tool_${n},`).join('\n')}
}
_TOOL_ALIASES: dict[str, str] = {
${aliasBody}
}
`
const fixTs = (cases) => `switch (toolName) {
${cases.map((n) => `    case '${n}':`).join('\n')}
    default:
      return { result: null, error: \`浏览器端不支持工具: \${toolName}\` }
}
`

// withBuilders=true 时还原 #47 第一格要消除的那一型:内置名被**再抄一遍**的构造表。
// J15(V3 #47 末格)起,夹具必须与真仓同形:每个内置名都有一个 `_<name>_tool` 构造函数;
// portNames 里的名字走 port_tool_definition 出口,其余内联 ToolDefinition 构造。
// 默认 portNames=['view_image'] 与 CLEAN_BRIDGE 里 view_image 的 'port' 处置对齐;
// 自定义桥面把 view_image 改判 map 的用例要显式传 [] ,否则夹具自己就不自洽。
const fixEngine = (names, withBuilders = false, portNames = ['view_image']) => `# -*- coding: utf-8 -*-
BUILTIN_ENGINE_TOOLS: tuple[str, ...] = (
${names.map((n) => `    "${n}",`).join('\n')}
)
class AgentEngine:
${names
  .map((n) =>
    portNames.includes(n)
      ? `    def _${n}_tool(self, thread):\n` +
        '        from .engine_tool_bridge import port_tool_definition\n\n' +
        '        async def _exec(args):\n            return await _registry_impl(args)\n\n' +
        `        return port_tool_definition(\n            "${n}",\n            parameters={"type": "object", "properties": {}},\n            executor=_exec,\n        )\n`
      : `    def _${n}_tool(self, thread):\n` +
        '        from .agent_loop_v2 import ToolDefinition\n\n' +
        '        async def _exec(args):\n            return {}\n\n' +
        `        return ToolDefinition(\n            name="${n}",\n            description="fixture",\n            parameters={"type": "object", "properties": {}},\n            executor=_exec,\n        )\n`,
  )
  .join('\n')}
${
  withBuilders
    ? `class AgentEngineLegacy:\n    def _x(self):\n        return {\n${names
        .map((n) => `            "${n}": self._${n}_tool,`)
        .join('\n')}\n        }\n`
    : ''
}
`

const fixBridge = (body) => `# -*- coding: utf-8 -*-
BRIDGE_MODES: tuple[str, str, str] = ("port", "map", "local")

def resolve_engine_tool(name: str) -> str | None:
    from .mcp_server import _TOOL_HANDLERS

    return name if name in _TOOL_HANDLERS else None

def port_tool_definition(engine_name: str, *, parameters: dict, executor) -> object:
    raise RuntimeError("fixture")

ENGINE_TOOL_BRIDGE: dict[str, tuple[str | None, str | None, str]] = {
${body}
}
`

const CLEAN_BRIDGE =
  '    "unified_exec": ("run_command", None, "map"),\n' +
  '    "view_image": ("read_file", None, "port"),\n' +
  '    "update_plan": (None, "协议对位件,注册表无 plan 类工具", "local"),\n'

function runSelfTest() {
  const cleanFiles = {
    [PY_LLM]: fixPy(
      '    "read_file",\n    "apply_patch",',
      '    "apply_patch",',
      '    "apply_patch": "用 file_edit",',
    ),
    [PY_MCP]: fixHandlers(['read_file', 'write_file', 'run_command']),
    [TS_EXEC]: fixTs(['read_file', 'write_file', 'apply_patch']),
    [PY_ENGINE]: fixEngine(['unified_exec', 'view_image', 'update_plan']),
    [PY_BRIDGE]: fixBridge(CLEAN_BRIDGE),
  }

  // [用例名, 变更后的文件, 期望命中的失败子串(或子串数组=同一条失败里都要在);null = 期望零失败]
  const cases = [
    ['基线干净(应零失败)', cleanFiles, null],
    [
      'J1 真幽灵名必红',
      {
        ...cleanFiles,
        [PY_LLM]: fixPy('    "ghost_tool",', '    "apply_patch",', '    "apply_patch": "用 file_edit",'),
      },
      'J1 真幽灵工具名',
    ],
    [
      'J2 别名指向空气必红',
      {
        ...cleanFiles,
        [PY_MCP]: fixHandlers(
          ['read_file', 'write_file', 'run_command'],
          '    "execute_command": "no_such_tool",',
        ),
      },
      'J2 别名',
    ],
    [
      'J3 别名键抢占真工具名必红',
      {
        ...cleanFiles,
        [PY_MCP]: fixHandlers(
          ['read_file', 'write_file', 'run_command'],
          '    "read_file": "run_command",',
        ),
      },
      'J3 别名键',
    ],
    [
      'J4 别名值指向委托专有必红',
      {
        ...cleanFiles,
        [PY_MCP]: fixHandlers(
          ['read_file', 'write_file', 'run_command'],
          '    "execute_command": "apply_patch",',
        ),
      },
      'J4 别名',
    ],
    [
      'J5 委托专有却已本地注册必红',
      {
        ...cleanFiles,
        [PY_LLM]: fixPy(
          '    "read_file",\n    "apply_patch",',
          '    "read_file",',
          '    "apply_patch": "用 file_edit",',
        ),
      },
      'J5',
    ],
    [
      'J5 委托专有但前端无实现必红',
      { ...cleanFiles, [TS_EXEC]: fixTs(['read_file', 'write_file']) },
      'J5',
    ],
    [
      'J6 前端死实现必红',
      {
        ...cleanFiles,
        [TS_EXEC]: fixTs(['read_file', 'write_file', 'apply_patch', 'never_called']),
      },
      'J6',
    ],
    [
      'J7 提示表缺项必红',
      {
        ...cleanFiles,
        [PY_LLM]: fixPy(
          '    "read_file",\n    "apply_patch",',
          '    "apply_patch",',
          '',
        ),
      },
      'J7',
    ],
    // 变异验证:注释里提到的名字不得被读成集合成员 —— 这是本门取材铁律的执行凭据。
    // 若 stripLineComments 失效,`ghost_in_comment` 会被算进 _FS_DEPENDENT_TOOLS 并触发 J1。
    [
      '注释里的名字不被误吸(应零失败)',
      {
        [PY_LLM]:
          '# 2026-08-06:ghost_in_comment 移出本集合 —— 它曾经在这里,现在别读了\n' +
          fixPy(
            '    "read_file",\n    "apply_patch",',
            '    "apply_patch",',
            '    "apply_patch": "用 file_edit",',
          ),
        [PY_MCP]: fixHandlers(['read_file', 'write_file', 'run_command']),
        [TS_EXEC]: fixTs(['read_file', 'write_file', 'apply_patch']),
        [PY_ENGINE]: fixEngine(['unified_exec', 'view_image', 'update_plan']),
        [PY_BRIDGE]: fixBridge(CLEAN_BRIDGE),
      },
      null,
    ],
    [
      'J8 内置名缺桥条目必红(V3 #47 的立项型:引擎自带名字此前对全部门禁盲视)',
      {
        ...cleanFiles,
        [PY_ENGINE]: fixEngine(['unified_exec', 'view_image', 'update_plan', 'new_tool_no_bridge']),
      },
      'J8 引擎内置名',
    ],
    [
      'J8 桥表留旧条目必红(清单腐烂)',
      {
        ...cleanFiles,
        [PY_BRIDGE]: fixBridge(CLEAN_BRIDGE + '    "retired_tool": ("read_file", None, "map"),\n'),
      },
      'J8 能力桥条目',
    ],
    [
      'J9 等价物不在注册表必红(回查落到空气上)',
      {
        ...cleanFiles,
        [PY_BRIDGE]: fixBridge(
          '    "unified_exec": ("no_such_tool", None, "map"),\n' +
            '    "view_image": ("read_file", None, "map"),\n' +
            '    "update_plan": (None, "协议对位件,注册表无 plan 类工具", "local"),\n',
        ),
      },
      'J9 引擎内置名',
    ],
    [
      'J10 无等价物却不带理由必红(空位与漏登记必须不同形)',
      {
        ...cleanFiles,
        [PY_BRIDGE]: fixBridge(
          '    "unified_exec": ("run_command", None, "map"),\n' +
            '    "view_image": ("read_file", None, "map"),\n' +
            '    "update_plan": (None, None, "local"),\n',
        ),
      },
      'J10 引擎内置名',
    ],
    // 正向对照:J10 认隐式拼接的多段字符串(真表里 6 条就是这么写的)。
    // 若判据只认单段字面量,「有理由」会被读成「没理由」⇒ 一道对真实写法恒红的门。
    // 三元组的第三项也在同一条多行形态里 —— 它同时是"解析器必须跨行读元组"的对照。
    [
      'J10 多段拼接理由必须被认作已带理由(应零失败)',
      {
        ...cleanFiles,
        // 该用例的桥面把 view_image 记成 map —— 夹具的构造函数必须同形走内联
        // (portNames=[]),否则 J15 会因"夹具自身不自洽"红,测不到 J10 本尊。
        [PY_ENGINE]: fixEngine(['unified_exec', 'view_image', 'update_plan'], false, []),
        [PY_BRIDGE]: fixBridge(
          '    "unified_exec": ("run_command", None, "map"),\n' +
            '    "view_image": ("read_file", None, "map"),\n' +
            '    "update_plan": (\n        None,\n        "协议对位件;"\n        "注册表无 plan 类工具",\n        "local",\n    ),\n',
        ),
      },
      null,
    ],
    // ── J14(V3 #47 第二格):处置结论的纪律 —— 四型各一红一绿 ──────────────
    [
      'J14 缺第三个字段(旧二项形态)必红 —— 形态漂了不许读成"没有 mode 就放过"',
      {
        ...cleanFiles,
        [PY_BRIDGE]: fixBridge(
          '    "unified_exec": ("run_command", None),\n' +
            '    "view_image": ("read_file", None, "map"),\n' +
            '    "update_plan": (None, "协议对位件", "local"),\n',
        ),
      },
      'J14 引擎内置名',
    ],
    [
      'J14 封闭集外的处置结论必红(标签不许随口造)',
      {
        ...cleanFiles,
        [PY_BRIDGE]: fixBridge(
          '    "unified_exec": ("run_command", None, "merged"),\n' +
            '    "view_image": ("read_file", None, "map"),\n' +
            '    "update_plan": (None, "协议对位件", "local"),\n',
        ),
      },
      ['J14', 'merged', 'BRIDGE_MODES'],
    ],
    [
      'J14 处置为 map 却没有等价物必红("归口"落到空气上)',
      {
        ...cleanFiles,
        [PY_BRIDGE]: fixBridge(
          '    "unified_exec": (None, "注册表确实没有对位件", "map"),\n' +
            '    "view_image": ("read_file", None, "map"),\n' +
            '    "update_plan": (None, "协议对位件", "local"),\n',
        ),
      },
      "处置为 'map' 却没有注册表等价物",
    ],
    [
      'J14 处置为 local 却有等价物必红(两个字段互相推翻)',
      {
        ...cleanFiles,
        [PY_BRIDGE]: fixBridge(
          '    "unified_exec": ("run_command", None, "local"),\n' +
            '    "view_image": ("read_file", None, "map"),\n' +
            '    "update_plan": (None, "协议对位件", "local"),\n',
        ),
      },
      "却登记了等价物",
    ],
    [
      'J14 桥表值被改成裸字符串(非元组)必红 —— 读空不得表现为零违规',
      {
        ...cleanFiles,
        [PY_BRIDGE]: fixBridge(
          '    "unified_exec": "run_command",\n' +
            '    "view_image": ("read_file", None, "map"),\n' +
            '    "update_plan": (None, "协议对位件", "local"),\n',
        ),
      },
      'J14',
    ],
    // ── J12(V3 #47 第一格):内置名单只允许一处 ────────────────────────────
    [
      'J12 builders dict 回潮必红(名单与构造表分叉时门必须看得见)',
      {
        ...cleanFiles,
        [PY_ENGINE]: fixEngine(['unified_exec', 'view_image', 'update_plan'], true),
      },
      'J12',
    ],
    [
      'J12 散文里写出该形态不算第二份清单(字符串面必须抹掉后再判)',
      {
        ...cleanFiles,
        [PY_ENGINE]:
          fixEngine(['unified_exec', 'view_image', 'update_plan']) +
          'def _doc():\n' +
          '    """改前这里是 {"unified_exec": self._unified_exec_tool} —— 已在 #47 消除。"""\n' +
          '    return None\n',
      },
      null,
    ],
    // ── J13(V3 #47 第二格):解析出口必须真装车 ────────────────────────────
    [
      'J13 call_tool 不 import 解析出口必红(有表没路 = 造好没装车)',
      {
        ...cleanFiles,
        [PY_MCP]: fixHandlers(['read_file', 'write_file', 'run_command'], undefined, ''),
      },
      'J13',
    ],
    [
      'J13 只 import 不调用必红(import 语句不构成接线)',
      {
        ...cleanFiles,
        [PY_MCP]: fixHandlers(
          ['read_file', 'write_file', 'run_command'],
          undefined,
          'from .engine_tool_bridge import resolve_engine_tool\n',
        ),
      },
      'J13',
    ],
    [
      'J13 桥模块不再现读注册表必红(抄一份注册清单就是第二份真相)',
      {
        ...cleanFiles,
        [PY_BRIDGE]: fixBridge(CLEAN_BRIDGE).replace(
          '    return name if name in _TOOL_HANDLERS else None',
          '    return name if name in {"run_command", "read_file"} else None',
        ),
      },
      ['J13', '_TOOL_HANDLERS'],
    ],
    // ── J11(V3 #47 第三格):成对用例 —— 第二处定义必红 / 唯一一处必绿 ──────
    // 红例复刻本票立项时的真实形态:llm.py 与 mcp_server.py 各留一份模块级定义。
    // 失败文案必须**同时点名两处路径**(数组期望=同一条失败里全部子串都要在),
    // 只点一处的报告会把另一半留在暗处。
    [
      'J11 出现第二处模块级定义必红(两份真相 = 本票要防的病)',
      {
        ...cleanFiles,
        [PY_LLM]:
          fixPy(
            '    "read_file",\n    "apply_patch",',
            '    "apply_patch",',
            '    "apply_patch": "用 file_edit",',
          ) +
          '_TOOL_ALIASES: dict[str, str] = {\n    "list_directory": "list_files",\n}\n',
      },
      ['J11', PY_LLM, PY_MCP],
    ],
    [
      'J11 import 与注释提到表名不算定义,唯一一处在位(应零失败)',
      {
        ...cleanFiles,
        [PY_LLM]:
          '# 本文件的 _TOOL_ALIASES 唯一定义在 services/mcp_server.py,这里只 import。\n' +
          'from ..services.mcp_server import _TOOL_ALIASES\n' +
          fixPy(
            '    "read_file",\n    "apply_patch",',
            '    "apply_patch",',
            '    "apply_patch": "用 file_edit",',
          ),
      },
      null,
    ],
    // ── J15(V3 #47 末格):RPC 面只留协议适配层 —— 阳性对照逐型 ─────────────
    [
      'J15 阳性对照:RPC 面又自带一个工具定义(新构造函数,名字没进名单)必红',
      {
        ...cleanFiles,
        [PY_ENGINE]:
          fixEngine(['unified_exec', 'view_image', 'update_plan']) +
          'class AgentEngineRogue:\n' +
          '    def _rogue_tool(self, thread):\n' +
          '        from .agent_loop_v2 import ToolDefinition\n\n' +
          '        return ToolDefinition(\n' +
          '            name="rogue_tool",\n' +
          '            description="协议层自己长出来的工具",\n' +
          '            parameters={"type": "object", "properties": {}},\n' +
          '            executor=None,\n' +
          '        )\n',
      },
      'J15',
    ],
    [
      'J15 port 定义退回内联手抄必红(第二份真相回潮)',
      {
        ...cleanFiles,
        // 桥面 CLEAN_BRIDGE 记 view_image 为 port,而夹具改走内联构造(portNames=[])
        [PY_ENGINE]: fixEngine(['unified_exec', 'view_image', 'update_plan'], false, []),
      },
      'J15 port 工具',
    ],
    [
      'J15 桥模块摘掉唯一定义出口必红(port 无处归口,判据不得对着空气绿)',
      {
        ...cleanFiles,
        [PY_BRIDGE]: fixBridge(CLEAN_BRIDGE).replace(
          'def port_tool_definition(engine_name: str, *, parameters: dict, executor) -> object:\n    raise RuntimeError("fixture")\n\n',
          '',
        ),
      },
      ['J15', 'port_tool_definition'],
    ],
    [
      'J15 构造名与构造函数名分叉必红(_update_plan_tool 里造 "update_plan_x")',
      {
        ...cleanFiles,
        [PY_ENGINE]:
          fixEngine(['unified_exec', 'view_image', 'update_plan']) +
          'class AgentEngineFork:\n' +
          '    def _update_plan_tool(self, thread):\n' +
          '        from .agent_loop_v2 import ToolDefinition\n\n' +
          '        return ToolDefinition(\n' +
          '            name="update_plan_x",\n' +
          '            description="d",\n' +
          '            parameters={},\n' +
          '            executor=None,\n' +
          '        )\n',
      },
      'J15',
    ],
    [
      'J15 name 非字面量的宿主适配构造不算自带定义(应零失败)',
      {
        ...cleanFiles,
        [PY_ENGINE]:
          fixEngine(['unified_exec', 'view_image', 'update_plan']) +
          'class AgentEngineAdapter:\n' +
          '    def _build_host_tool_definitions(self, thread):\n' +
          '        from .agent_loop_v2 import ToolDefinition\n\n' +
          '        return ToolDefinition(\n' +
          '            name=name,\n' +
          '            description=spec.description,\n' +
          '            parameters=spec.parameters,\n' +
          '            executor=_execute,\n' +
          '        )\n',
      },
      null,
    ],
    [
      'J15 docstring 里写出 ToolDefinition( 带括号也不算构造(散文不判红)',
      {
        ...cleanFiles,
        [PY_ENGINE]:
          fixEngine(['unified_exec', 'view_image', 'update_plan']) +
          'class AgentEngineProse:\n' +
          '    def _note(self, thread):\n' +
          '        """说明:把宿主工具转成 ToolDefinition(执行体回调客户端)是适配层。"""\n' +
          '        return None\n',
      },
      null,
    ],
  ]

  let bad = 0
  const hitExpect = (f, expect) =>
    Array.isArray(expect) ? expect.every((s) => f.includes(s)) : f.includes(expect)
  const describeExpect = (expect) => (Array.isArray(expect) ? expect.join(' ∧ ') : expect)
  for (const [name, files, expect] of cases) {
    const dir = buildFixture(files)
    let fails = []
    try {
      const texts = readInputs(dir, 'worktree')
      fails = check(collect(texts), scanAliasDefinitions(dir, 'worktree'))
    } catch (e) {
      fails = [`抛出: ${e.message}`]
    } finally {
      rmScratch(dir)
    }
    const ok = expect === null ? fails.length === 0 : fails.some((f) => hitExpect(f, expect))
    if (ok) {
      console.log(`  ${C.green}✓${C.reset} ${name}`)
    } else {
      bad++
      console.log(
        `  ${C.red}✗${C.reset} ${name} — ${expect === null ? `期望零失败,实际: ${fails[0] ?? '(无)'}` : `未命中 ${describeExpect(expect)},实际: ${fails[0] ?? '未报错'}`}`,
      )
    }
  }
  console.log(
    bad === 0
      ? `${C.green}✅ 自检通过 ${cases.length}/${cases.length}${C.reset}`
      : `${C.red}❌ 自检失败 ${bad}/${cases.length}${C.reset}`,
  )
  process.exit(bad === 0 ? 0 : 1)
}

/**
 * §22d `isDirectRun`:本文件既要被 CLI 直接跑(提交链 spawn 它),也要被镜像测试 import
 * (§22c —— 镜像测试不得再抄一份判据,而判据全部是本文件的模块级私有函数)。
 * 没有这层守卫,测试一 import 就会跑完整实跑并 process.exit,把测试进程带走。
 */
const isDirectRun = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun && selfTest) runSelfTest()

// --- 实跑(只在直接执行时) -------------------------------------------------
if (isDirectRun) {
const FACE_SEL = pickFace(args)
if (FACE_SEL.error) {
  console.log(`${C.red}${C.bold}❌ 判定面自相矛盾${C.reset} — ${FACE_SEL.error}`)
  process.exit(2)
}
if (HAS_ROOT_FLAG && FACE_SEL.face !== 'worktree') {
  console.log(
    `${C.red}${C.bold}❌ --root 只在 --worktree 档有效${C.reset} — 换根却按 HEAD/索引读 = 双根分裂`,
  )
  process.exit(2)
}
const FACE_TXT = {
  head: 'HEAD blob(全量审计)',
  staged: '索引 blob(本次提交会带走的那一份)',
  worktree: '工作树(人工逃生舱,提交链不走这档)',
}
let texts
let failures
try {
  texts = readInputs(ROOT, FACE_SEL.face)
  failures = check(collect(texts), scanAliasDefinitions(ROOT, FACE_SEL.face))
} catch (e) {
  if (e instanceof Undetermined) {
    // "面取不到"与"面里没有那个字面量"是两件事:前者无法判定,后者是判据红。
    console.log(
      `${C.red}${C.bold}❌ 工具注册表完整性无法判定(不冒红也不记绿)${C.reset} — ${e.message}`,
    )
    process.exit(2)
  }
  console.log(`${C.red}${C.bold}❌ 工具注册表完整性无法判定${C.reset} — ${e.message}`)
  process.exit(1)
}

if (failures.length === 0) {
  if (!quiet) {
    const d = collect(texts)
    const j15n = definitionSites(stripPyDocstrings(d.engineSrc)).sites.length
    const j15literal = definitionSites(stripPyDocstrings(d.engineSrc)).sites.filter(
      (s) => s.nameLit !== null,
    ).length
    console.log(
      `${C.green}✅ 工具注册表完整性通过${C.reset} — 判定面 ${FACE_TXT[FACE_SEL.face]} / fs 委托集 ${d.fs.size} / 委托专有 ${d.delegateOnly.size} / 别名 ${Object.keys(d.aliases).length} 条 / 本地注册 ${d.local.size} / 前端实现 ${d.frontend.size} / RPC 面定义构造 ${j15literal} 处(应 = 内置名数 − port 数)/ 宿主适配构造 ${j15n - j15literal} 处(只报数不计红)`,
    )
  }
  process.exit(0)
}

console.log(`${C.red}${C.bold}❌ 工具注册表完整性失败 — ${failures.length} 项${C.reset}`)
for (const f of failures) console.log(`  • ${f}`)
console.log('')
console.log(
  `${C.dim}修复:对齐落点 —— ${PY_MCP} 的 _TOOL_ALIASES(全仓唯一一份模块级定义)/ _TOOL_HANDLERS ↔ ${PY_LLM} 的 _FS_DEPENDENT_TOOLS / _DELEGATE_ONLY_TOOLS / _DELEGATE_ONLY_HINTS ↔ ${TS_EXEC} 的 case;llm.py 只 import,不得再抄第二份${C.reset}`,
)
process.exit(1)
}

// §22c:暴露判据本体给镜像测试(必须放在 isDirectRun 守卫之后)。
export const __test__ = {
  paths: { PY_LLM, PY_MCP, PY_ENGINE, PY_BRIDGE, TS_EXEC, APP_PY_DIR },
  pickFace,
  readInputs,
  inputRels,
  stripLineComments,
  stripPyDocstrings,
  pyCollection,
  setMembers,
  dictKeySet,
  dictMap,
  frontendCases,
  scanTupleEntries,
  splitTupleElements,
  bridgeEntries,
  engineBuiltins,
  bridgeModeSet,
  strayBuiltinLists,
  definitionSites,
  localRegistry,
  collect,
  check,
  scanAliasDefinitions,
  buildFixture,
  rmScratch,
  fixtures: { fixPy, fixHandlers, fixTs, fixEngine, fixBridge, CLEAN_BRIDGE, RESOLVER_WIRING },
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
