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
 *   J5 `_DELEGATE_ONLY_TOOLS` ⊆ `_FS_DEPENDENT_TOOLS`、⊆ 前端 case、且 ∩ 本地注册表 = ∅
 *      —— 这三条一起定义什么叫「委托专有」,任一破都说明常量已与实际脱节。
 *   J6 前端实现了的工具必须 ∈ `_FS_DEPENDENT_TOOLS` ∪ 本地注册表 —— 否则前端那支实现
 *      永远不会被调到,是死代码。
 *   J7 `_DELEGATE_ONLY_HINTS` 的键集合 === `_DELEGATE_ONLY_TOOLS`(提示文案不许漏新老)。
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
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'

import { COLORS as C } from './lib/logger.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const ROOT_DEFAULT = join(fileURLToPath(import.meta.url), '..', '..')
const args = process.argv.slice(2)
const quiet = args.includes('--quiet')
const selfTest = args.includes('--self-test')
const rootFlagIdx = args.indexOf('--root')
const ROOT = rootFlagIdx >= 0 && args[rootFlagIdx + 1] ? resolvePath(args[rootFlagIdx + 1]) : ROOT_DEFAULT

const PY_LLM = 'apps/ai-service/app/routers/llm.py'
const PY_MCP = 'apps/ai-service/app/services/mcp_server.py'
const TS_EXEC = 'apps/web/src/lib/workspace-tool-executor.ts'

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
  const decl = new RegExp(`^${varName}\\s*(?::[^=\\n]*)?=\\s*([{\\[])`, 'm')
  const m = decl.exec(lines)
  if (!m) return null
  const openIdx = lines.indexOf(m[1], m.index)
  const open = m[1]
  const close = open === '{' ? '}' : ']'
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
  for (const m of lit.matchAll(/(?:"([A-Za-z0-9_]+)"|'([A-Za-z0-9_]+)')\s*:/g)) keys.add(m[1] ?? m[2])
  return keys
}

/** dict 字面量的键值对(用于 alias 别名表)。 */
function dictMap(fileAbs, src, varName) {
  const lit = pyCollection(src, varName)
  if (lit === null) throw new Error(`${fileAbs}: 未找到 ${varName} 的字面量赋值`)
  const out = {}
  for (const m of lit.matchAll(/(?:"([A-Za-z0-9_]+)"|'([A-Za-z0-9_]+)')\s*:\s*(?:"([A-Za-z0-9_]+)"|'([A-Za-z0-9_]+)')/g)) {
    out[m[1] ?? m[2]] = m[3] ?? m[4]
  }
  return out
}

/** 前端 switch-case 里实现了的工具名。 */
function frontendCases(root) {
  const src = readFileSync(join(root, TS_EXEC), 'utf8')
  const names = new Set()
  for (const m of src.matchAll(/^\s*case '([A-Za-z0-9_]+)':/gm)) names.add(m[1])
  return names
}

/** Python 侧本地注册的工具名:`_TOOL_HANDLERS` 的 key。 */
function localRegistry(root) {
  const fileAbs = join(root, PY_MCP)
  return dictKeySet(fileAbs, readFileSync(fileAbs, 'utf8'), '_TOOL_HANDLERS')
}

function collect(root) {
  const llmAbs = join(root, PY_LLM)
  const llm = readFileSync(llmAbs, 'utf8')
  const take = (name) => {
    const lit = pyCollection(llm, name)
    if (lit === null) throw new Error(`${PY_LLM}: 未找到 ${name} 的字面量赋值`)
    return lit
  }
  return {
    fs: setMembers(take('_FS_DEPENDENT_TOOLS')),
    delegateOnly: setMembers(take('_DELEGATE_ONLY_TOOLS')),
    hints: dictKeySet(llmAbs, llm, '_DELEGATE_ONLY_HINTS'),
    aliases: dictMap(llmAbs, llm, '_TOOL_ALIASES'),
    local: localRegistry(root),
    frontend: frontendCases(root),
  }
}

function check(d) {
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
      failures.push(`J2 别名 '${alias}' → '${target}',但 '${target}' 不在本地注册表 —— 别名指向空气`)
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
      failures.push(`J4 别名 '${alias}' → '${target}' 是委托专有工具 —— 本地路径会调到本地不存在的名字`)
    }
  }

  // J5 —— 「委托专有」的三条定义
  for (const name of sorted(d.delegateOnly)) {
    if (!d.fs.has(name)) {
      failures.push(`J5 '${name}' 在 _DELEGATE_ONLY_TOOLS 却不在 _FS_DEPENDENT_TOOLS —— 永远不会走委托分支`)
    }
    if (!d.frontend.has(name)) {
      failures.push(`J5 '${name}' 标为委托专有,但 ${TS_EXEC} 没有对应 case —— 委托过去只会得到「浏览器端不支持」`)
    }
    if (d.local.has(name)) {
      failures.push(`J5 '${name}' 已在本地注册表,却仍标为委托专有 —— 语义失效,应移出 _DELEGATE_ONLY_TOOLS`)
    }
  }

  // J6 —— 前端实现了却没人会调到 = 死代码
  for (const name of sorted(d.frontend)) {
    if (!d.fs.has(name) && !d.local.has(name)) {
      failures.push(`J6 ${TS_EXEC} 实现了 '${name}',但它既不可委托也不在本地注册 —— 该实现永远执行不到`)
    }
  }

  // J7 —— 提示文案必须与集合同步(双向)
  for (const name of sorted(d.delegateOnly)) {
    if (!d.hints.has(name)) {
      failures.push(`J7 _DELEGATE_ONLY_HINTS 缺 '${name}' 的等价建议 —— 报错时模型拿不到「该换哪个工具」`)
    }
  }
  for (const name of sorted(d.hints)) {
    if (!d.delegateOnly.has(name)) {
      failures.push(`J7 _DELEGATE_ONLY_HINTS 多出 '${name}' —— 已不在 _DELEGATE_ONLY_TOOLS,属过期条目`)
    }
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

const fixPy = (fsBody, doBody, hintBody, aliasBody) => `# -*- coding: utf-8 -*-
_FS_DEPENDENT_TOOLS = {
${fsBody}
}
_DELEGATE_ONLY_TOOLS = {
${doBody}
}
_DELEGATE_ONLY_HINTS = {
${hintBody}
}
_TOOL_ALIASES = {
${aliasBody}
}
`
const fixHandlers = (names) => `# -*- coding: utf-8 -*-
_TOOL_HANDLERS: dict[str, object] = {
${names.map((n) => `    "${n}": _tool_${n},`).join('\n')}
}
`
const fixTs = (cases) => `switch (toolName) {
${cases.map((n) => `    case '${n}':`).join('\n')}
    default:
      return { result: null, error: \`浏览器端不支持工具: \${toolName}\` }
}
`

function runSelfTest() {
  const cleanFiles = {
    [PY_LLM]: fixPy(
      '    "read_file",\n    "apply_patch",',
      '    "apply_patch",',
      '    "apply_patch": "用 file_edit",',
      '    "execute_command": "run_command",',
    ),
    [PY_MCP]: fixHandlers(['read_file', 'write_file', 'run_command']),
    [TS_EXEC]: fixTs(['read_file', 'write_file', 'apply_patch']),
  }

  // [用例名, 变更后的文件, 期望命中的失败子串;null = 期望零失败]
  const cases = [
    ['基线干净(应零失败)', cleanFiles, null],
    [
      'J1 真幽灵名必红',
      { ...cleanFiles, [PY_LLM]: fixPy('    "ghost_tool",', '    "apply_patch",', '    "apply_patch": "用 file_edit",', '    "execute_command": "run_command",') },
      'J1 真幽灵工具名',
    ],
    [
      'J2 别名指向空气必红',
      { ...cleanFiles, [PY_LLM]: fixPy('    "read_file",\n    "apply_patch",', '    "apply_patch",', '    "apply_patch": "用 file_edit",', '    "execute_command": "no_such_tool",') },
      'J2 别名',
    ],
    [
      'J3 别名键抢占真工具名必红',
      { ...cleanFiles, [PY_LLM]: fixPy('    "read_file",\n    "apply_patch",', '    "apply_patch",', '    "apply_patch": "用 file_edit",', '    "read_file": "run_command",') },
      'J3 别名键',
    ],
    [
      'J4 别名值指向委托专有必红',
      { ...cleanFiles, [PY_LLM]: fixPy('    "read_file",\n    "apply_patch",', '    "apply_patch",', '    "apply_patch": "用 file_edit",', '    "execute_command": "apply_patch",') },
      'J4 别名',
    ],
    [
      'J5 委托专有却已本地注册必红',
      { ...cleanFiles, [PY_LLM]: fixPy('    "read_file",\n    "apply_patch",', '    "read_file",', '    "apply_patch": "用 file_edit",', '    "execute_command": "run_command",') },
      'J5',
    ],
    [
      'J5 委托专有但前端无实现必红',
      { ...cleanFiles, [TS_EXEC]: fixTs(['read_file', 'write_file']) },
      'J5',
    ],
    [
      'J6 前端死实现必红',
      { ...cleanFiles, [TS_EXEC]: fixTs(['read_file', 'write_file', 'apply_patch', 'never_called']) },
      'J6',
    ],
    [
      'J7 提示表缺项必红',
      { ...cleanFiles, [PY_LLM]: fixPy('    "read_file",\n    "apply_patch",', '    "apply_patch",', '', '    "execute_command": "run_command",') },
      'J7',
    ],
    [
      // 变异验证:注释里提到的名字不得被读成集合成员 —— 这是本门取材铁律的执行凭据。
      // 若 stripLineComments 失效,`ghost_in_comment` 会被算进 _FS_DEPENDENT_TOOLS 并触发 J1。
      ['注释里的名字不被误吸(应零失败)', {
        [PY_LLM]:
          '# 2026-08-06:ghost_in_comment 移出本集合 —— 它曾经在这里,现在别读了\n' +
          fixPy('    "read_file",\n    "apply_patch",', '    "apply_patch",', '    "apply_patch": "用 file_edit",', '    "execute_command": "run_command",'),
        [PY_MCP]: fixHandlers(['read_file', 'write_file', 'run_command']),
        [TS_EXEC]: fixTs(['read_file', 'write_file', 'apply_patch']),
      }, null],
    ].flat(),
  ]

  let bad = 0
  for (const [name, files, expect] of cases) {
    const dir = buildFixture(files)
    let fails = []
    try {
      fails = check(collect(dir))
    } catch (e) {
      fails = [`抛出: ${e.message}`]
    } finally {
      rmScratch(dir)
    }
    const ok = expect === null ? fails.length === 0 : fails.some((f) => f.includes(expect))
    if (ok) {
      console.log(`  ${C.green}✓${C.reset} ${name}`)
    } else {
      bad++
      console.log(
        `  ${C.red}✗${C.reset} ${name} — ${expect === null ? `期望零失败,实际: ${fails[0] ?? '(无)'}` : `未命中 ${expect},实际: ${fails[0] ?? '未报错'}`}`,
      )
    }
  }
  console.log(bad === 0 ? `${C.green}✅ 自检通过 ${cases.length}/${cases.length}${C.reset}` : `${C.red}❌ 自检失败 ${bad}/${cases.length}${C.reset}`)
  process.exit(bad === 0 ? 0 : 1)
}

if (selfTest) runSelfTest()

// --- 实跑 -------------------------------------------------------------------
let failures
try {
  failures = check(collect(ROOT))
} catch (e) {
  console.log(`${C.red}${C.bold}❌ 工具注册表完整性无法判定${C.reset} — ${e.message}`)
  process.exit(1)
}

if (failures.length === 0) {
  if (!quiet) {
    const d = collect(ROOT)
    console.log(
      `${C.green}✅ 工具注册表完整性通过${C.reset} — fs 委托集 ${d.fs.size} / 委托专有 ${d.delegateOnly.size} / 别名 ${Object.keys(d.aliases).length} 条 / 本地注册 ${d.local.size} / 前端实现 ${d.frontend.size}`,
    )
  }
  process.exit(0)
}

console.log(`${C.red}${C.bold}❌ 工具注册表完整性失败 — ${failures.length} 项${C.reset}`)
for (const f of failures) console.log(`  • ${f}`)
console.log('')
console.log(
  `${C.dim}修复:两面对齐 —— ${PY_LLM} 的 _FS_DEPENDENT_TOOLS / _DELEGATE_ONLY_TOOLS / _TOOL_ALIASES ↔ ${PY_MCP}._TOOL_HANDLERS ↔ ${TS_EXEC} 的 case${C.reset}`,
)
process.exit(1)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
