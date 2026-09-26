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
import { fileURLToPath } from 'node:url'

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
 * 每条读两件事:第一个元组元素(注册表里的同一能力拥有者,或 None)、
 * 第二个元素是否存在(理由)。第二个元素的内容刻意不解析 ——
 * 理由里有多段隐式拼接的字符串,把它们当值读只会让判据随格式化漂移;
 * 本门要问的是「有没有交代」,不是「交代了什么」。
 */
function bridgeEntries(texts) {
  const src = texts[PY_BRIDGE]
  const lit = pyCollection(src, 'ENGINE_TOOL_BRIDGE')
  if (lit === null) {
    throw new Error(`${PY_BRIDGE}: 未找到 ENGINE_TOOL_BRIDGE 的字面量赋值(读空=判据失明,不记绿)`)
  }
  const out = new Map()
  const re =
    /"([A-Za-z0-9_]+)"\s*:\s*\(\s*(?:"([A-Za-z0-9_]+)"|None)\s*,\s*("(?:[^"\\]|\\.)*"|None)/g
  for (const m of lit.matchAll(re)) {
    out.set(m[1], {
      equivalent: m[2] ?? null,
      hasReason: typeof m[3] === 'string' && m[3][0] === '"',
    })
  }
  return out
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

function collect(texts) {
  const llm = texts[PY_LLM]
  const take = (name) => {
    const lit = pyCollection(llm, name)
    if (lit === null) throw new Error(`${PY_LLM}: 未找到 ${name} 的字面量赋值`)
    return lit
  }
  return {
    fs: setMembers(take('_FS_DEPENDENT_TOOLS')),
    delegateOnly: setMembers(take('_DELEGATE_ONLY_TOOLS')),
    hints: dictKeySet(PY_LLM, llm, '_DELEGATE_ONLY_HINTS'),
    // V3 #47 第三格(2026-09-26):别名表已合成全仓唯一一份,住在 mcp_server.py;
    // J2/J3/J4 的取材面随之从 PY_LLM 改到 PY_MCP(判据本体一字未动)。
    aliases: dictMap(PY_MCP, texts[PY_MCP], '_TOOL_ALIASES'),
    local: localRegistry(texts),
    frontend: frontendCases(texts),
    builtins: engineBuiltins(texts),
    bridge: bridgeEntries(texts),
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
const fixHandlers = (names, aliasBody = CLEAN_ALIAS_BODY) => `# -*- coding: utf-8 -*-
_TOOL_HANDLERS: dict[str, object] = {
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

const fixEngine = (names) => `# -*- coding: utf-8 -*-
BUILTIN_ENGINE_TOOLS: tuple[str, ...] = (
${names.map((n) => `    "${n}",`).join('\n')}
)
`

const fixBridge = (body) => `# -*- coding: utf-8 -*-
ENGINE_TOOL_BRIDGE: dict[str, tuple[str | None, str | None]] = {
${body}
}
`

const CLEAN_BRIDGE =
  '    "unified_exec": ("run_command", None),\n' +
  '    "view_image": ("read_file", None),\n' +
  '    "update_plan": (None, "协议对位件,注册表无 plan 类工具"),\n'

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
        [PY_BRIDGE]: fixBridge(CLEAN_BRIDGE + '    "retired_tool": ("read_file", None),\n'),
      },
      'J8 能力桥条目',
    ],
    [
      'J9 等价物不在注册表必红(回查落到空气上)',
      {
        ...cleanFiles,
        [PY_BRIDGE]: fixBridge(
          '    "unified_exec": ("no_such_tool", None),\n' +
            '    "view_image": ("read_file", None),\n' +
            '    "update_plan": (None, "协议对位件,注册表无 plan 类工具"),\n',
        ),
      },
      'J9 引擎内置名',
    ],
    [
      'J10 无等价物却不带理由必红(空位与漏登记必须不同形)',
      {
        ...cleanFiles,
        [PY_BRIDGE]: fixBridge(
          '    "unified_exec": ("run_command", None),\n' +
            '    "view_image": ("read_file", None),\n' +
            '    "update_plan": (None, None),\n',
        ),
      },
      'J10 引擎内置名',
    ],
    // 正向对照:J10 认隐式拼接的多段字符串(真表里 6 条就是这么写的)。
    // 若判据只认单段字面量,「有理由」会被读成「没理由」⇒ 一道对真实写法恒红的门。
    [
      'J10 多段拼接理由必须被认作已带理由(应零失败)',
      {
        ...cleanFiles,
        [PY_BRIDGE]: fixBridge(
          '    "unified_exec": ("run_command", None),\n' +
            '    "view_image": ("read_file", None),\n' +
            '    "update_plan": (\n        None,\n        "协议对位件;"\n        "注册表无 plan 类工具",\n    ),\n',
        ),
      },
      null,
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

if (selfTest) runSelfTest()

// --- 实跑 -------------------------------------------------------------------
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
    console.log(
      `${C.green}✅ 工具注册表完整性通过${C.reset} — 判定面 ${FACE_TXT[FACE_SEL.face]} / fs 委托集 ${d.fs.size} / 委托专有 ${d.delegateOnly.size} / 别名 ${Object.keys(d.aliases).length} 条 / 本地注册 ${d.local.size} / 前端实现 ${d.frontend.size}`,
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
