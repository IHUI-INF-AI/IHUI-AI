#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门:架构契约门(从声明反查违规)
 *
 * 与既有守门链的分工:其余门是**按违规模式堆出来的**(发现一类事故 → 写一条判据);
 * 本门读 config/architecture-policy.yaml 这张**声明表**,反过来从声明查违规:
 *   T1 表自洽性(声明与现实脱节即红)
 *   C1 单文件行上限 / C2 契约文件行上限 / C3 对外公开出口数
 *   D1 未声明的跨模块依赖 / D2 依赖方向违反层序 / D3 穿透公开入口的深导入 / D4 现实 import 成环
 *
 * 渐进收口(设计前提:**不得造出一台恒红的机器**)
 *   - 违规归属"发起 import 的那个文件所在模块";模块 managed:false ⇒ 只报数、不计退出码。
 *   - 全仓即时判红只有两条:C1(阈值高于 HEAD 实测最大文件)与 T1。存量债不得转嫁成无关提交的红。
 *   - 翻 managed:true 之前先跑 `--managed-trial <id>` 看看到底几条。
 *
 * 内容口径(与本仓高阶门同取向):全量判 **HEAD blob**,`--staged` 判**索引 blob**。
 *   共享工作树常年滞后 HEAD,按磁盘算会在恒红/假绿之间来回跳。
 *
 * 用法:
 *   node scripts/check-architecture-policy.mjs                  # 全量(判 HEAD)
 *   node scripts/check-architecture-policy.mjs --staged         # pre-commit(判索引,只咬暂存文件;暂存集为空 ⇒ 回退全量)
 *   node scripts/check-architecture-policy.mjs --json           # 机器可读报告
 *   node scripts/check-architecture-policy.mjs --managed-trial packages/sdk
 *   node scripts/check-architecture-policy.mjs --strict         # 未登记模块/存量债也判红(人工巡检用,默认关)
 *   node scripts/check-architecture-policy.mjs --self-test      # 成对正反例自检
 * 紧急跳过:HUSKY_SKIP_ARCH_POLICY=1 git commit ...
 */
import { readFileSync } from 'node:fs'
import { dirname as pDirname, resolve as pResolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { catBatch, gitRaw } from './lib/face-reader.mjs'

const ROOT = pResolve(pDirname(fileURLToPath(import.meta.url)), '..')
const POLICY_REL = 'config/architecture-policy.yaml'
const SELF_SKIP = 'HUSKY_SKIP_ARCH_POLICY'
const SRC_RE = /\.(ts|tsx|js|jsx|mjs|cjs)$/
const GIT_TIMEOUT = 180000
const RULES = {
  'table-integrity': 'T1 策略表与现实脱节',
  'file-lines': 'C1 单文件行上限',
  'contract-file-lines': 'C2 契约文件行上限',
  'public-exports': 'C3 对外公开出口数上限',
  'undeclared-dependency': 'D1 未声明的跨模块依赖',
  'layer-direction': 'D2 依赖方向违反层序',
  'deep-import': 'D3 穿透公开入口的深导入',
  'module-cycle': 'D4 现实 import 边成环',
  // ── 声明齐备性两判(2026-09-25 补,MECHANISM-SPEC-2 §4)──
  // 方向与 T1 同源:**表里写了什么,现实里就必须有什么**。此前 T1 只对账 `roots`,
  // 而 `public_entrypoints` 是 D3 深导入的唯一依据 —— 入口被改名/搬走而表没跟上时,
  // D3 就对着空气工作(判据存在而审的是不存在的对象 = 没有)。
  'entrypoint-missing': 'E1 声明的公开入口在取材面里不存在',
  'contract-artifact-missing': 'E2 纳管模块缺契约工件/声明的契约文件不存在',
}
/** 不受 managed 开关约束、全仓即时判红的规则 */
const ALWAYS_RED = new Set(['table-integrity', 'file-lines'])
/** 入口存在性判据的取用形态:仓库相对路径恒正斜杠,故扩展名表是**唯一**一份(module-context 复用) */
const ENTRY_EXTS = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.css', '/index.ts', '/index.tsx', '/index.js', '/index.mjs']
/** 模块自述/契约文档名(齐备性判据的合法工件之一;新增名字改这一处) */
const MODULE_DOC_NAMES = ['README.md', 'AGENTS.md', 'CONTEXT.md', 'CONTRACT.md']

/**
 * 一律经 `scripts/lib/face-reader.mjs`。此前本门把 git **硬编码成** `C:/Program Files/Git/cmd/git.exe`,
 * 那是"换机/换安装位置即失效"的一档 —— 层的 `gitBinary()` 认 PortableGit / IHUI_GIT_BIN / 绝对路径探测,
 * 并且 timeout / maxBuffer / quotepath / windowsHide 都在同一处封顶(本门一次要读 512MB 量级)。
 * 预算保持不变:180s / 1<<29,与原实现逐字同档,免得收口顺带把超时口径改了。
 */
const git = (args) => gitRaw(args, ROOT, { timeout: GIT_TIMEOUT, maxBuffer: 1 << 29 })

// ── 受限 YAML 子集解析器 ───────────────────────────────────────────────────────────────
// 只支持策略表实际用到的形态:缩进块、`key: value`、`key:` + 子块、`- 标量`、`- key: value`、
// 行内空列表 `[]`。**认不出的行一律抛错**(上层 exit 2「无法判定」),绝不静默跳行 ——
// 静默跳过的后果是"扫到 0 条却报绿",那是本仓反复踩过的同一类失效。
class YamlError extends Error {}

function parseYaml(src, label = 'policy') {
  const rows = []
  src.split(/\r?\n/).forEach((raw, i) => {
    if (!raw.trim() || /^\s*#/.test(raw)) return
    if (/^\t/.test(raw)) throw new YamlError(`${label}:${i + 1} 用了 Tab 缩进,YAML 只允许空格`)
    rows.push({ n: i + 1, indent: raw.length - raw.trimStart().length, text: raw.trim() })
  })
  if (!rows.length) throw new YamlError(`${label}:空文档`)
  let p = 0
  const scalar = (s, n) => {
    if (s === '[]') return []
    if (s === '{}') return {}
    if (/^-?\d+$/.test(s)) return Number(s)
    if (s === 'true' || s === 'false') return s === 'true'
    if (s === 'null' || s === '~') return null
    const q = s[0]
    if ((q === "'" || q === '"') && s.length >= 2 && s[s.length - 1] === q) return s.slice(1, -1)
    if (q === "'" || q === '"') throw new YamlError(`${label}:${n} 引号没有闭合: ${s}`)
    if (/[:#]\s/.test(s)) throw new YamlError(`${label}:${n} 裸标量含 ": " 会歧义,请加引号: ${s}`)
    return s
  }
  const parseBlock = (minIndent) => {
    const first = rows[p]
    if (!first || first.indent < minIndent) return null
    return first.text.startsWith('- ') ? parseList(first.indent) : parseMap(first.indent)
  }
  const parseMap = (indent) => {
    const out = {}
    while (p < rows.length) {
      const row = rows[p]
      if (row.indent < indent) break
      if (row.indent > indent) throw new YamlError(`${label}:${row.n} 缩进比父级更深,不是合法键值行: ${row.text}`)
      if (row.text.startsWith('- ')) break
      const m = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(row.text)
      if (!m) throw new YamlError(`${label}:${row.n} 不是 key: value 形态: ${row.text}`)
      p++
      const rest = m[2].trim()
      if (rest !== '') out[m[1]] = scalar(rest, row.n)
      else {
        const nxt = rows[p]
        if (!nxt) out[m[1]] = null
        else if (nxt.indent > row.indent) out[m[1]] = parseBlock(row.indent + 1)
        // 同缩进列表风格(`requires:` 与 `- 'x'` 齐平)也要认,否则换个写法就整表解析失败
        else if (nxt.indent === row.indent && nxt.text.startsWith('- ')) out[m[1]] = parseList(row.indent)
        else out[m[1]] = null
      }
    }
    return out
  }
  const parseList = (indent) => {
    const out = []
    while (p < rows.length) {
      const row = rows[p]
      if (row.indent < indent) break
      if (row.indent > indent) throw new YamlError(`${label}:${row.n} 列表项缩进异常: ${row.text}`)
      if (!row.text.startsWith('- ')) throw new YamlError(`${label}:${row.n} 期望 "- 项",实得: ${row.text}`)
      const body = row.text.slice(2).trim()
      if (body === '') throw new YamlError(`${label}:${row.n} 不支持裸 "-" 起手的嵌套列表项`)
      const inline = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(body)
      if (!inline) {
        out.push(scalar(body, row.n))
        p++
        continue
      }
      // `- key: value` ⇒ 映射项;其后续键与 "- " 后的列对齐(indent + 2)
      const itemIndent = row.indent + 2
      rows[p] = { n: row.n, indent: itemIndent, text: body }
      const first = rows[p]
      p++
      let item
      {
        const m = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(first.text)
        item = {}
        const rest = m[2].trim()
        if (rest !== '') item[m[1]] = scalar(rest, row.n)
        else {
          const nxt = rows[p]
          item[m[1]] = nxt && nxt.indent > itemIndent ? parseBlock(itemIndent + 1) : null
        }
      }
      Object.assign(item, parseMap(itemIndent))
      out.push(item)
    }
    return out
  }
  const doc = parseMap(rows[0].indent)
  if (p !== rows.length) throw new YamlError(`${label}:解析在第 ${rows[p].n} 行提前停下,判据不可信`)
  return doc
}

// ── glob:只支持 ** 与 * 两种通配;段内 * 不跨 "/" ──────────────────────────────────────
function globToRe(g) {
  const segs = g.split('/')
  let re = '^'
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i]
    const last = i === segs.length - 1
    if (s === '**') {
      if (last) return `${re}.*$`
      re += '(?:[^/]+/)*'
      continue
    }
    re += s.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]')
    if (!last) re += '/'
  }
  return `${re}$`
}
const mkMatcher = (patterns) => {
  const res = (patterns || []).map((g) => new RegExp(globToRe(g)))
  return (p) => res.some((r) => r.test(p))
}

/** 仓库相对路径恒为正斜杠,不得过 node:path 的 win32 语义(那会把分隔符换成反斜杠,
 *  于是 relFrom 的 `..` 归一在 Windows 上永远算不出跨模块路径 —— 判据静默失效)。 */
const relDir = (p) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '')

/** 仓库相对路径下的 `..` 归一(不依赖 node:path 的平台语义:表里的路径恒为正斜杠) */
export function relFrom(fromDir, spec) {
  const segs = fromDir.split('/').filter(Boolean)
  for (const s of spec.split('/')) {
    if (s === '' || s === '.') continue
    if (s === '..') segs.pop()
    else segs.push(s)
  }
  return segs.join('/')
}

// ── 导入说明符提取:行首锚定 + 反引号奇偶 + 注释跳过 ─────────────────────────────────────
// 宽松匹配会产出**假边**(2026-09-24 实测 4 类 12 处):JSDoc 里写的示例 import、
// lint 规则的提示文案、代码生成器拼的模板字符串、文档站的示例块。
function braceDepth(line) {
  const s = line.replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`/g, '""')
  return (s.match(/\{/g) || []).length - (s.match(/\}/g) || []).length
}
export function extractSpecs(text) {
  const lines = text.split('\n')
  const out = []
  let tick = 0
  for (let i = 0; i < lines.length; i++) {
    const first = lines[i]
    const inTpl = tick % 2 === 1
    tick += (first.match(/(?<!\\)`/g) || []).length
    if (inTpl) continue
    if (/^\s*(\/\/|\*|\/\*)/.test(first)) continue
    if (!/^import\b/.test(first) && !/^export\s+(?:type\s*)?[*{]/.test(first)) continue
    const bare = /^import\s+['"]([^'"]+)['"]/.exec(first)
    if (bare) {
      out.push({ spec: bare[1], line: i + 1 })
      continue
    }
    let stmt = first
    let j = i
    let depth = braceDepth(first)
    // 终止条件允许**行尾注释**:`import { x } from 'y' // arch-exempt: 原因` 是一条真导入,
    // 若只认 `from '...'` 结尾,加了豁免注释反而让这条导入消失 —— 豁免通道自己把判据关掉。
    while (!(depth === 0 && /from\s*['"][^'"]+['"]\s*;?\s*(?:\/\/.*)?$/.test(stmt))) {
      if (depth === 0) {
        stmt = '' // 括号已闭合却没有 from ⇒ 纯本地导出,不是导入语句
        break
      }
      j++
      if (j - i > 30 || j >= lines.length || /^\s*(\/\/|\*|\/\*)/.test(lines[j])) {
        stmt = ''
        break
      }
      stmt += '\n' + lines[j]
      depth += braceDepth(lines[j])
    }
    if (!stmt) continue
    const m = /from\s*['"]([^'"]+)['"]/.exec(stmt)
    if (m) out.push({ spec: m[1], line: i + 1 })
  }
  return out
}

// ── 策略装载 ───────────────────────────────────────────────────────────────────────────
export function loadPolicy(doc) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) throw new YamlError('策略表根节点必须是映射')
  if (typeof doc.version !== 'number') throw new YamlError('策略表缺 version(或不是数字)')
  if (!Array.isArray(doc.layers) || !doc.layers.length) throw new YamlError('策略表缺 layers —— 无层序声明时方向判据不成立,不得记为通过')
  if (!Array.isArray(doc.modules) || !doc.modules.length) throw new YamlError('策略表缺 modules —— 扫描面为空不得记为通过')
  const layers = new Map()
  for (const l of doc.layers) {
    if (!l || typeof l.id !== 'string' || typeof l.rank !== 'number') throw new YamlError(`layers 条目必须带 id 与数字 rank:${JSON.stringify(l)}`)
    layers.set(l.id, l.rank)
  }
  const modules = new Map()
  for (const m of doc.modules) {
    if (!m || typeof m.id !== 'string') throw new YamlError(`modules 条目缺 id:${JSON.stringify(m).slice(0, 60)}`)
    if (modules.has(m.id)) throw new YamlError(`模块 id 重复:${m.id}`)
    const roots = Array.isArray(m.roots) ? m.roots.map((r) => String(r).replace(/\/+$/, '')) : []
    modules.set(m.id, {
      id: m.id,
      pkg: typeof m.package === 'string' && m.package !== '-' ? m.package : null,
      layer: m.layer,
      rank: layers.has(m.layer) ? layers.get(m.layer) : null,
      exported: m.exported === true,
      managed: m.managed === true,
      roots,
      requires: new Set(Array.isArray(m.requires) ? m.requires : []),
      entrypoints: Array.isArray(m.public_entrypoints) ? m.public_entrypoints : [],
      // E2 的最小新增键:模块**显式声明**的契约/自述工件清单(可选)。
      // 语义与 public_entrypoints 同一族 —— 声明了就必须在取材面里存在;没声明的模块
      // 退而认 contract_file_patterns 命中或模块根下的自述文档(见 moduleContractArtifacts)。
      contractFiles: Array.isArray(m.contract_files) ? m.contract_files.map(String) : [],
    })
  }
  const cons = doc.constraints || {}
  for (const k of ['max_file_lines', 'max_contract_file_lines', 'max_public_exports'])
    if (typeof cons[k] !== 'number' || cons[k] <= 0) throw new YamlError(`constraints.${k} 缺失或不是正数`)
  return {
    version: doc.version,
    modules,
    layers,
    exceptions: Array.isArray(doc.exceptions) ? doc.exceptions : [],
    maxFileLines: cons.max_file_lines,
    maxContractLines: cons.max_contract_file_lines,
    maxPublicExports: cons.max_public_exports,
    contractPatterns: cons.contract_file_patterns || [],
    scanExcludes: cons.scan_excludes || [],
    testExempts: cons.deep_import_test_exempts || [],
    forbidCycles: cons.forbid_cycles !== false,
    forbidDeep: cons.forbid_deep_imports !== false,
  }
}

const exHit = (P, rule, file) => (P.exceptions || []).find((e) => e && e.rule === rule && (typeof e.file !== 'string' || e.file === file))
/** 一条都没命中的例外 = 清单腐烂候补(豁免的存在理由已经消失,却还挂在表上)。
 *  只在**全量面**报:暂存面里绝大多数例外天然不命中,按暂存面判会让每次提交都喊。 */
export function unusedExceptions(P, hitIds, face) {
  if (face !== 'HEAD') return []
  return (P.exceptions || []).filter((e) => e && e.id && !hitIds.has(e.id)).map((e) => e.id)
}

/** public_entrypoints 是"子路径白名单":'.' 只对应裸包名(不走本判据),'./x' 精确、'./x/*' 前缀 */
export function matchEntrypoint(m, sub) {
  return m.entrypoints.some((p) => {
    const pat = p === '.' ? null : String(p).replace(/^\./, '')
    if (pat === null || pat === '') return false
    if (!pat.includes('*')) return pat === sub
    return new RegExp('^' + pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$').test(sub)
  })
}

// ── T1:表与现实对账 ────────────────────────────────────────────────────────────────────
export function auditPolicy(P, existingPaths) {
  const v = []
  const existing = new Set(existingPaths)
  const push = (msg) => v.push({ rule: 'table-integrity', file: POLICY_REL, line: 0, managed: true, msg })
  for (const m of P.modules.values()) {
    if (m.rank === null) push(`模块 ${m.id} 的 layer "${m.layer}" 不在 layers 清单里`)
    if (!m.roots.length) push(`模块 ${m.id} 没声明 roots —— 它的文件永远不会被本门扫描`)
    for (const r of m.roots) {
      const hit = [...existing].some((p) => p === r || p.startsWith(r + '/') || p.startsWith(r + '.'))
      if (!hit) push(`模块 ${m.id} 声明的 roots/${r} 在当前取材面里不存在(表与现实脱节)`)
    }
    for (const d of m.requires) {
      const t = P.modules.get(d)
      if (!t) {
        push(`模块 ${m.id} requires 了未登记的模块 ${d}`)
        continue
      }
      if (m.rank !== null && t.rank !== null && t.rank > m.rank) push(`模块 ${m.id}(rank ${m.rank})声明依赖更上层的 ${d}(rank ${t.rank}) —— 层序自相矛盾`)
      if (!t.exported) push(`模块 ${m.id} 声明依赖 ${d},但 ${d} 标了 exported:false(端应用/工具不对外),这条声明本身就是违规`)
    }
  }
  const state = new Map()
  const walk = (id, chain) => {
    if (state.get(id) === 2) return
    if (state.get(id) === 1) {
      push(`requires 声明成环:${[...chain, id].join(' → ')}`)
      return
    }
    state.set(id, 1)
    const m = P.modules.get(id)
    for (const d of m ? m.requires : []) walk(d, [...chain, id])
    state.set(id, 2)
  }
  for (const id of P.modules.keys()) walk(id, [])
  const list = [...P.modules.values()]
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) {
      for (const a of list[i].roots)
        for (const b of list[j].roots) {
          if (a === b || a.startsWith(b + '/') || b.startsWith(a + '/')) push(`模块 ${list[i].id} 与 ${list[j].id} 的 roots 重叠(${a} / ${b})—— 文件归属会有歧义`)
        }
    }
  for (const e of P.exceptions) {
    if (!e || !e.id || !e.rule || !e.reason) {
      push(`exceptions 条目必须带 id / rule / reason:${JSON.stringify(e).slice(0, 80)}`)
      continue
    }
    if (!P.modules.has(e.module)) push(`例外 ${e.id} 指向未登记的模块 ${e.module}`)
    if (typeof e.file === 'string' && !existing.has(e.file))
      v.push({ rule: 'table-integrity', file: POLICY_REL, line: 0, soft: true, msg: `例外 ${e.id} 指向的 ${e.file} 已不在取材面里(清单腐烂,请删该条)` })
  }
  return v
}

// ── E1 / E2:声明齐备性(纯函数,取材面由调用方注入) ─────────────────────────
// 与 auditPolicy(T1) 的分工:T1 只对账 `roots`,这里对账**剩下的两格声明** ——
// `public_entrypoints`(E1)与契约工件(E2)。三条判据共用同一个 ctx:
//   ctx = { tracked:Set<路径>, allPaths:路径[], manifestOf:(moduleId)=>清单对象|null }
// 抽成 ctx 注入而不是在函数里派生 git,是为了让 `--self-test` 与镜像测试能**构造面**
// (本仓教训:证明取材面行为只能用纯函数 + 构造面,不得依赖仓库瞬时状态)。
const inRoots = (m, p) => m.roots.some((r) => p === r || p.startsWith(r + '/'))
/**
 * 子路径模式里的 `*` 按 npm exports 语义**跨段**匹配 —— 与 `matchEntrypoint`(D3)同一族口径。
 * 这跟 `globToRe` 的"段内 `*`"不是一回事:拿段内 `*` 去判存在性,会把
 * `./messages/*` → `packages/i18n/messages/api/en.json` 这种多层命中算成"入口不存在",
 * 即**解析口径错**而不是真缺(E1 首跑就抓到这一条,故单列一份实现并在此说明)。
 */
const subPathRe = (pat) => new RegExp(`^${String(pat).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`)
const stemOf = (p) => p.replace(/\.[^./]+$/, '')

const targetsOfExports = (v) => (typeof v === 'string' ? [v] : v && typeof v === 'object' ? Object.values(v).flatMap((x) => (typeof x === 'string' ? [x] : Array.isArray(x) ? x.filter((y) => typeof y === 'string') : [])) : [])

/** 一个 public_entrypoints 条目解析到取材面里的真实文件(解析不到即 state:'missing') */
export function resolveEntrypoint(m, ep, ctx) {
  const root = m.roots[0]
  if (!root) return { ep, state: 'missing', path: null, how: '无 roots(该模块由 T1 点名)' }
  const key = ep === '.' ? '.' : ep.startsWith('./') ? ep : './' + ep.replace(/^\//, '')
  const rel = key.replace(/^\.\//, '')
  // 1) 约定式:模块根与根下 src/ 两条前缀,扩展名表逐一试
  if (key !== '.') {
    if (!rel.includes('*')) {
      for (const e of ENTRY_EXTS) {
        for (const base of [`${root}/${rel}${e}`, `${root}/src/${rel}${e}`]) {
          if (ctx.tracked.has(base)) return { ep, state: 'ok', path: base, how: '约定式路径' }
        }
      }
    } else {
      const hit = ctx.allPaths.find((p) => subPathRe(`${root}/${rel}`).test(p) || subPathRe(`${root}/src/${rel}`).test(p))
      if (hit) return { ep, state: 'ok', path: hit, how: '约定式 glob 命中' }
    }
  }
  const j = ctx.manifestOf ? ctx.manifestOf(m.id) : null
  const ex = j && j.exports && typeof j.exports === 'object' ? j.exports : null
  // 2) 主入口:裸包名 '.' 走 package.json 的 exports['.'] / main,再退到 index 约定
  if (key === '.') {
    const vals = ex ? targetsOfExports(ex['.']) : []
    if (typeof j?.main === 'string') vals.push(j.main)
    for (const t of vals) {
      const cand = `${root}/${String(t).replace(/^\.\//, '')}`
      if (ctx.tracked.has(cand)) return { ep, state: 'ok', path: cand, how: '包清单主入口' }
    }
    for (const cand of [`${root}/src/index.ts`, `${root}/index.ts`, `${root}/src/index.tsx`, `${root}/src/index.js`, `${root}/index.js`, `${root}/index.mjs`]) {
      if (ctx.tracked.has(cand)) return { ep, state: 'ok', path: cand, how: '主入口 index 约定' }
    }
    return { ep, state: 'missing', path: null, how: '主入口既无清单也无 index 文件' }
  }
  // 3) 包清单 exports 的显式子路径键(精确键或 glob 键)
  if (ex) {
    const declaredKey = Object.prototype.hasOwnProperty.call(ex, key) ? key : Object.keys(ex).find((k) => k.includes('*') && subPathRe(k).test(key))
    if (declaredKey) {
      for (const t of targetsOfExports(ex[declaredKey])) {
        const rel2 = String(t).replace(/^\.\//, '')
        const cand = `${root}/${rel2}`
        if (rel2.includes('*')) {
          const hit = ctx.allPaths.find((p) => subPathRe(cand).test(p))
          if (hit) return { ep, state: 'ok', path: hit, how: `exports['${declaredKey}'] 映射` }
          continue
        }
        if (ctx.tracked.has(cand)) return { ep, state: 'ok', path: cand, how: `exports['${declaredKey}'] 映射` }
        const alt = ctx.allPaths.find((p) => stemOf(p) === stemOf(cand))
        if (alt) return { ep, state: 'ok', path: alt, how: `exports['${declaredKey}'] 映射(同干换扩展名)` }
      }
      return { ep, state: 'missing', path: null, how: `exports['${declaredKey}'] 映射到的文件不在取材面` }
    }
  }
  return { ep, state: 'missing', path: null, how: '既无约定式文件也无 exports 声明' }
}

/** 模块的契约工件面:显式声明 ∪ contract_file_patterns 命中 ∪ 模块根下的自述文档 */
export function moduleContractArtifacts(m, ctx, P) {
  const declared = m.contractFiles.map((f) => {
    const p = f.startsWith('/') ? f.slice(1) : m.roots.length && !f.startsWith(m.roots[0] + '/') ? `${m.roots[0]}/${f.replace(/^\.\//, '')}` : f.replace(/^\.\//, '')
    return { path: p, exists: ctx.tracked.has(p), source: '声明的 contract_files' }
  })
  const isContract = mkMatcher(P.contractPatterns)
  const patternHits = ctx.allPaths.filter((p) => inRoots(m, p) && isContract(p)).map((p) => ({ path: p, exists: true, source: 'contract_file_patterns 命中' }))
  const docs = []
  for (const r of m.roots) for (const d of MODULE_DOC_NAMES) if (ctx.tracked.has(`${r}/${d}`)) docs.push({ path: `${r}/${d}`, exists: true, source: '模块自述文档' })
  const bad = declared.filter((x) => !x.exists)
  return { declared, patternHits, docs, all: [...declared, ...patternHits, ...docs], sufficient: declared.length > 0 || patternHits.length > 0 || docs.length > 0, bad }
}

/**
 * E1 + E2 的判据面(返回违规数组,形状与 auditPolicy 一致,可直接并进表级报账)。
 * 问责前置(与全门同一条渐进收口制度):**只有 managed:true 的模块**的结果才计红;
 * managed:false / 未收口的模块一律 `soft: true`(只报数)。
 * 「未齐备」这一类**默认恒报数**:HEAD 实测有十几块纳管模块既没有 pattern 命中也没有
 * 自述文档,把它做成即时判红等于造一台恒红门(唯一结局是逼人 --no-verify);
 * 要按这一类问责请跑 `--strict`(人工巡检档),它的语义本就是"存量债也判红"。
 */
export function auditDeclarations(P, ctx, opts = {}) {
  const trial = new Set(opts.trialModules || [])
  const strict = opts.strict === true
  const v = []
  const counters = { entrypointsChecked: 0, entrypointMissing: 0, contractDeclaredMissing: 0, contractAbsentModules: 0 }
  for (const m of P.modules.values()) {
    const held = m.managed || trial.has(m.id)
    for (const ep of m.entrypoints) {
      counters.entrypointsChecked++
      const r = resolveEntrypoint(m, ep, ctx)
      if (r.state === 'ok') continue
      counters.entrypointMissing++
      v.push({ rule: 'entrypoint-missing', file: POLICY_REL, line: 0, module: m.id, managed: held, soft: !held, msg: `模块 ${m.id} 声明的 public_entrypoints "${ep}" 在取材面里解析不到文件(${r.how})—— D3 深导入判据正对着不存在的出口工作` })
    }
    const art = moduleContractArtifacts(m, ctx, P)
    for (const b of art.bad) {
      counters.contractDeclaredMissing++
      v.push({ rule: 'contract-artifact-missing', file: b.path, line: 0, module: m.id, managed: held, soft: !held, msg: `模块 ${m.id} 在 contract_files 里声明了 ${b.path},但取材面里没有这个文件(契约工件失踪)` })
    }
    if (held && !art.sufficient) {
      counters.contractAbsentModules++
      v.push({
        rule: 'contract-artifact-missing',
        file: POLICY_REL,
        line: 0,
        module: m.id,
        managed: held,
        soft: !strict,
        msg: `模块 ${m.id} 已纳管(managed:true)却没有任何契约工件:既未声明 contract_files,也不命中 contract_file_patterns,模块根下也没有 ${MODULE_DOC_NAMES.join('/')} —— 齐备性按 --strict 档问责,默认只报数`,
      })
    }
  }
  return { violations: v, counters }
}

// ── 核心判定(纯函数:files = Map<相对路径, 文本>) ──────────────────────────────────────
export function analyze(P, files, opts = {}) {
  const trial = new Set(opts.trialModules || [])
  const isManaged = (m) => !!m && (m.managed || trial.has(m.id))
  const excluded = mkMatcher(P.scanExcludes)
  const isContract = mkMatcher(P.contractPatterns)
  const testExempt = mkMatcher(P.testExempts)
  const byPkg = new Map([...P.modules.values()].filter((m) => m.pkg).map((m) => [m.pkg, m]))
  const rootList = [...P.modules.values()].flatMap((m) => m.roots.map((r) => [r, m])).sort((a, b) => b[0].length - a[0].length)
  const ownerOf = (p) => {
    for (const [r, m] of rootList) if (p === r || p.startsWith(r + '/')) return m
    return null
  }
  const V = []
  const edges = new Map()
  const stats = { scanned: 0, unowned: new Set(), unknownPkg: new Set(), exempted: 0, invalidExempt: 0, policyExceptions: 0, exceptionIds: new Set(), foreign: 0 }
  const add = (rule, path, line, mod, msg) => V.push({ rule, file: path, line, module: mod ? mod.id : null, managed: isManaged(mod), msg })
  /** 表级例外:放过**并计数**,并记下命中的 id —— 一条都不命中的例外就是清单腐烂 */
  const exPass = (rule, path) => {
    const hit = exHit(P, rule, path)
    if (!hit) return false
    stats.policyExceptions++
    if (hit.id) stats.exceptionIds.add(hit.id)
    return true
  }

  for (const [path, text] of files) {
    if (excluded(path)) continue
    stats.scanned++
    const mod = ownerOf(path)
    if (!mod) stats.unowned.add(path.split('/').slice(0, /^(apps|packages)\//.test(path) ? 2 : 1).join('/'))
    const lines = text.split('\n').length
    if (lines > P.maxFileLines) add('file-lines', path, 0, mod, `${lines} 行 > 上限 ${P.maxFileLines}`)
    if (isContract(path) && lines > P.maxContractLines && !exPass('contract-file-lines', path))
      add('contract-file-lines', path, 0, mod, `契约文件 ${lines} 行 > 上限 ${P.maxContractLines}`)
    for (const { spec, line } of extractSpecs(text)) {
      if (/[${}]/.test(spec)) continue // 生成器拼出来的占位说明符不是真导入
      let target = null
      let sub = null
      let viaRelative = false
      if (spec.startsWith('@ihui/')) {
        const seg = spec.split('/')
        const top = seg.slice(0, 2).join('/')
        target = byPkg.get(top) || null
        if (!target) {
          stats.unknownPkg.add(top)
          continue
        }
        if (seg.length > 2) sub = '/' + seg.slice(2).join('/')
        if (target === mod) continue // 包内自引用不参与跨模块契约
      } else if (spec.startsWith('.')) {
        const rel = relFrom(relDir(path), spec)
        target = ownerOf(rel)
        if (!target || target === mod) continue
        viaRelative = true
        sub = '/' + rel.slice(target.roots[0].length + 1)
      } else {
        if (/^(https?:|node:|data:)/.test(spec)) continue
        stats.foreign++ // 第三方包名:不在本表射程
        continue
      }
      if (!mod) continue
      const key = `${mod.id}→${target.id}`
      edges.set(key, (edges.get(key) || 0) + 1)
      const blame = (rule, msg) => {
        const src = text.split('\n')
        // 行内豁免只在**导入行本身**或**紧邻上一行**生效;缺原因即不放行(只记数)
        for (const cand of [src[line - 1], src[line - 2]]) {
          if (cand === undefined) continue
          const m = /arch-exempt:\s*(.*)$/.exec(cand)
          if (!m) continue
          if (!m[1].trim()) {
            stats.invalidExempt++
            continue
          }
          stats.exempted++
          return
        }
        if (exPass(rule, path)) return
        add(rule, path, line, mod, msg)
      }
      if (!mod.requires.has(target.id)) blame('undeclared-dependency', `${mod.id} 依赖了未在 requires 里声明的 ${target.id}(${spec})`)
      if (mod.rank !== null && target.rank !== null && target.rank > mod.rank) blame('layer-direction', `${mod.id}(rank ${mod.rank}) 反向依赖更上层的 ${target.id}(rank ${target.rank})`)
      if (!P.forbidDeep) continue
      if (testExempt(path)) continue
      if (viaRelative) blame('deep-import', `相对路径穿透到 ${target.id} 的实现细节:${relFrom(relDir(path), spec)}`)
      else if (target.exported === false) blame('deep-import', `${spec} 指向 ${target.id},但它声明 exported:false(不对外提供)` )
      else if (sub && !matchEntrypoint(target, sub)) blame('deep-import', `${spec} 没命中 ${target.id} 声明的任何 public_entrypoints`)
    }
  }

  // C3:按模块主入口(取 package.json 的 exports['.'] 或 main)统计对外出口数
  for (const m of P.modules.values()) {
    if (!m.pkg) continue
    let pj = null
    for (const r of m.roots) {
      const t = files.get(`${r}/package.json`)
      if (typeof t === 'string') {
        pj = t
        break
      }
    }
    if (!pj) continue
    let entry
    try {
      const j = JSON.parse(pj)
      const e = j.exports && typeof j.exports === 'object' ? j.exports['.'] : null
      entry = (e && (typeof e === 'string' ? e : e.import || e.default)) || j.main
    } catch {
      continue
    }
    if (!entry || String(entry).includes('*')) continue
    const ep = `${m.roots[0]}/${String(entry).replace(/^\.\//, '')}`
    const txt = files.get(ep)
    if (typeof txt !== 'string') continue
    const n = txt.split('\n').filter((l) => /^export\b/.test(l)).length
    if (n > P.maxPublicExports && !exPass('public-exports', ep)) add('public-exports', ep, 0, m, `主入口对外 ${n} 项 > 上限 ${P.maxPublicExports}`)
  }

  // D4:现实 import 边是否成环(声明表已由 T1 保证无环 ⇒ 成环即"表与现实脱节")
  if (P.forbidCycles) {
    const g = new Map()
    for (const k of edges.keys()) {
      const [a, b] = k.split('→')
      if (!g.has(a)) g.set(a, new Set())
      g.get(a).add(b)
    }
    const reported = new Set()
    const walk = (n, stack) => {
      const at = stack.indexOf(n)
      if (at >= 0) {
        const ring = stack.slice(at)
        const id = [...ring].sort().join('|')
        if (!reported.has(id)) {
          reported.add(id)
          add('module-cycle', POLICY_REL, 0, P.modules.get(ring[0]), `现实 import 成环:${[...ring, n].join(' → ')} —— 声明表说它是 DAG,故表与现实脱节`)
        }
        return
      }
      for (const nxt of g.get(n) || []) walk(nxt, [...stack, n])
    }
    for (const n of g.keys()) walk(n, [])
  }

  const red = V.filter((x) => !x.soft && (ALWAYS_RED.has(x.rule) || x.managed))
  return { violations: V, red, stats, edges }
}

// ── 取材 ───────────────────────────────────────────────────────────────────────────────
function readFace(rev, paths) {
  const map = new Map()
  if (!paths.length) return map
  // 层的 catBatch 对每个 rev 都给一项(missing ⇒ null);本门的判据把"没这项"与"这项是空文件"
  // 分得很清 —— `files.size` 会直接打进结论行(`HEAD blob(N 个源文件)`),把 null 也塞进去就等于
  // 凭空把 N 涨成"所有请求数"。所以这里只做形状适配:**只收命中的**,missing 继续不占位。
  const specs = paths.map((p) => `${rev}:${p}`)
  const got = catBatch(ROOT, specs, { maxBuffer: 1 << 29, timeout: GIT_TIMEOUT })
  for (let i = 0; i < paths.length; i++) {
    const text = got.get(specs[i])
    if (typeof text === 'string') map.set(paths[i], text)
  }
  return map
}
const treePaths = (rev) => (rev === '' ? git(['ls-files', '-z']).split('\0').filter(Boolean) : git(['ls-tree', '-r', '--name-only', rev, '-z']).split('\0').filter(Boolean))

/**
 * E1/E2 判据的取材上下文:路径清单 + 包清单读取器,**全部来自同一个面**。
 *
 * 做成注入式有两个理由:① 判据与本门的阅读包出口 `scripts/module-context.mjs` 必须共用
 * 同一份解析实现(两处算同一件事不得各写一遍),而两侧取的可以不是同一个面;
 * ② `--self-test` 与镜像测试要能**构造面**来证明判据有牙(本仓教训:证明取材面行为
 * 只能用纯函数 + 构造面,不得依赖仓库瞬时状态)。
 * 坏清单不静默 —— 记进 `unparsed` 由调用方喊出来:JSON.parse 失败会伪装成"入口解析不到",
 * 一个解析错误冒充业务结论正是本门注释里写过的那一型。
 */
export function declarationContext(P, facePaths, rev) {
  const tracked = new Set(facePaths)
  const want = [...new Set([...P.modules.values()].map((m) => (m.pkg && m.roots.length ? `${m.roots[0]}/package.json` : null)).filter(Boolean))].filter((p) => tracked.has(p))
  const byPath = new Map()
  const unparsed = []
  for (const [p, text] of readFace(rev, want)) {
    try {
      byPath.set(p, JSON.parse(text))
    } catch {
      unparsed.push(p)
    }
  }
  return {
    tracked,
    allPaths: facePaths,
    unparsed,
    manifestOf(id) {
      const m = P.modules.get(id)
      const pj = m && m.roots.length ? `${m.roots[0]}/package.json` : null
      return pj && byPath.has(pj) ? byPath.get(pj) : null
    },
  }
}

/** 策略表自身的取材:按 `policyFaceOrder(isStaged)` 给定的顺序,取第一个读得到的。
 *  三档降级(而非 exit 2)的理由仍然成立:新落表的那一枚提交之前,若坚持只认 HEAD
 *  就会在"表还没入库"时把整条提交链打死(= 恒红机器)。
 *  但"表只是输入、不是被审对象"这半句**不成立**(2026-09-25 实测推翻,见
 *  `policyFaceOrder` 的注释):改表恰好是某些提交的唯一内容,故 `--staged` 档必须
 *  索引优先 —— 否则本门对"把 managed 翻错/把 requires 写歪"这类改动全程盲视。
 *  退到工作树仍须**大声说明**,镜像测试钉的是"每个面各自的档位顺序不得回退"。 */
export function pickPolicySource(cands) {
  for (const [label, text] of cands) if (typeof text === 'string' && text.trim()) return { label, text }
  return null
}

/**
 * 策略表的取材面顺序 —— 与源码内容同向:全量档判 HEAD,`--staged` 档判**索引**。
 *
 * 单独抽成函数是为了让镜像测试能钉住**行为**而不是注释。它曾经两种情况都 HEAD 优先,
 * 后果不是"少读一份表"而是**改表的那枚提交完全脱离本门审查**:2026-09-25 实测往索引版
 * `apps/cli.requires` 注入一条 `apps/api`(端应用 `exported:false`,T1 必判红),
 * 全量与 `--staged` 双双 exit 0,且 `--staged` 的输出照旧打印旧表的那一行
 * (`managed:true packages/api-client`)。而本文件头"改这张表的规矩 2"恰恰要求
 * "翻 managed:true 之前先试跑" —— 提交链上是唯一无验的一环。
 * 判据存在而永不调用 = 没有。
 */
export function policyFaceOrder(isStaged) {
  return isStaged ? ['索引', 'HEAD', '工作树'] : ['HEAD', '索引', '工作树']
}

/**
 * `--staged` 档**内容**的取材范围决策(纯函数,抽出来是为了让 `--self-test` 与镜像测试能证明它)。
 *
 * 2026-09-25 独立复核实测的缺陷:暂存区里没有源文件时,本门打出
 * `扫描 0 文件 … ✅ 架构契约门通过` —— 依赖面(D1/D2/D3/D4/C2/C3)审了空集却记绿。
 * 本仓同型教训已由守门 70 / 81 收口过一次:**暂存集为空时必须回退全量**,不得静默绿。
 * 刻意不 exit 2:pre-commit 会为任何一次提交跑本门,把提交链打死与静默绿同样错。
 *
 * @param {string[]} srcPathsInFace 当前档(索引)全部源文件路径,已由 SRC_RE 筛过
 * @param {Set<string>} stagedSet   暂存区里 ACMR 形态的路径清单
 * @param {{headSrcPaths?:string[], deletedSet?:Set<string>}} [opts]
 *        headSrcPaths = HEAD 面全部源文件(回退档的候选);deletedSet = 暂存区 **D 形态**清单
 * @returns {{mode:'staged'|'full', paths:string[], keep:string[], droppedDeleted:string[]}}
 *   keep 是回退档**该读的路径集** —— 由本函数算,调用方不得再自己求一次差集
 *   (两处算同一个集合必然漂移:第一版把剔除清单建在索引面上,而 D 形态的路径根本不在索引面里,
 *    于是真实场景下"剔除了什么"永远打印为空,等于静默排除)。
 *
 * 2026-09-25 同日补的第二条缺陷(由本门**自己的修复提交被自己钉红**暴露):回退全量时若不排除
 * "本次提交正删除的路径",则**纯删除型修复永远落不了地** —— 删掉违规文件的那枚提交,暂存集里没有
 * 源文件 ⇒ 回退 HEAD ⇒ HEAD 里那个文件还在 ⇒ 判红 ⇒ 跳门。本门要拦的是"提交后仓库仍违规",
 * 而删除恰恰是修复动作,对着修复前的快照问责等于惩罚修复。排除只认 D 清单(不认任何宽泛条件),
 * 且**必须打印排除了哪些**(静默排除 = 判据失效)。
 */
export function planStagedScope(srcPathsInFace, stagedSet, opts = {}) {
  const { headSrcPaths = [], deletedSet = new Set() } = opts
  const picked = srcPathsInFace.filter((p) => stagedSet.has(p))
  if (picked.length) return { mode: 'staged', paths: picked, keep: picked, droppedDeleted: [] }
  const droppedDeleted = headSrcPaths.filter((p) => deletedSet.has(p))
  const dropped = new Set(droppedDeleted)
  return { mode: 'full', paths: [], keep: headSrcPaths.filter((p) => !dropped.has(p)), droppedDeleted }
}

/**
 * 策略表取材面的提示语 —— **只在真的错位时喊**(2026-09-25 修第二处缺陷)。
 *
 * 旧写法是 `if (policyFace !== 'HEAD')`,于是"索引与 HEAD 逐字节同一版"时(实测
 * `git rev-parse :表` == `git rev-parse HEAD:表`)也照样打印"尚未入库",把人支去找一个
 * 根本不存在的错位;而 `--staged` 档读索引本就是 `policyFaceOrder` 规定的**正常行为**
 * (它正是上一轮为"改表那枚提交不被审"而定的)。现按 oid 比对分四档:
 *   HEAD                ⇒ 安静(与全量口径同向)
 *   索引 且 oid==HEAD   ⇒ 安静(读的就是那份已入库的表)
 *   索引 且 oid!=HEAD   ⇒ info:本次提交正在改这张表,审将要落地的那份
 *   索引 而 HEAD 无此表 ⇒ warn:表尚未入库,落表提交必须与本门注册同批
 *   工作树              ⇒ warn:HEAD 与索引都取不到,既没入库也没暂存
 *
 * @param {string} pickedLabel pickPolicySource 选中的面名
 * @param {{HEAD?:string|null, 索引?:string|null}} oids 各面 blob oid(取不到给 null)
 * @returns {null|{level:'info'|'warn', msg:string}}
 */
export function policyFaceNotice(pickedLabel, oids = {}) {
  const head = oids.HEAD ?? null
  const index = oids['索引'] ?? null
  if (pickedLabel === 'HEAD') return null
  if (pickedLabel === '索引') {
    if (head === null) return { level: 'warn', msg: `策略表只在索引里(HEAD 还没有它)—— 落表提交必须与本门的注册同批,否则审的不是那份已生效的表` }
    if (index !== null && index === head) return null
    return { level: 'info', msg: `策略表取自索引且与 HEAD 不同版(${String(index).slice(0, 8)} ≠ ${String(head).slice(0, 8)})—— 本次提交正在改这张表,审的是将要落地的那份,属正常形态` }
  }
  if (pickedLabel === '工作树') return { level: 'warn', msg: `策略表退到工作树副本 —— HEAD 与索引都取不到它,这张表既没入库也没暂存` }
  return { level: 'warn', msg: `策略表取自「${pickedLabel}」而非 HEAD,请核对取材面` }
}

/** 各面策略表的 blob oid(取不到给 null)。
 *  为什么问 oid 而不是"读没读到内容":缺陷 2 的误报形态正是"读了索引就喊表没入库",
 *  而索引与 HEAD 常常是同一版 —— 只有 oid 能区分"同版(安静)"与"HEAD 没有这张表(该喊)"。 */
function readPolicyOids() {
  const oid = (spec) => {
    try {
      return git(['rev-parse', '--verify', '-q', spec]).trim() || null
    } catch {
      return null
    }
  }
  return { HEAD: oid(`HEAD:${POLICY_REL}`), 索引: oid(`:${POLICY_REL}`) }
}

function main(argv) {
  const isStaged = argv.includes('--staged')
  const json = argv.includes('--json')
  const strict = argv.includes('--strict')
  const ti = argv.indexOf('--managed-trial')
  const trialModules = ti >= 0 ? argv.slice(ti + 1).filter((a) => !a.startsWith('--')) : []
  const rev = isStaged ? '' : 'HEAD'
  let policyText
  let policyFace = 'HEAD'
  let policyOids = { HEAD: null, 索引: null }
  try {
    let worktreeText = null
    try {
      worktreeText = readFileSync(pResolve(ROOT, POLICY_REL), 'utf8')
    } catch {
      /* 工作树取不到就留 null,由 pickPolicySource 继续降级 */
    }
    const texts = {
      索引: readFace('', [POLICY_REL]).get(POLICY_REL),
      HEAD: readFace('HEAD', [POLICY_REL]).get(POLICY_REL),
      工作树: worktreeText,
    }
    const picked = pickPolicySource(policyFaceOrder(isStaged).map((label) => [label, texts[label]]))
    if (!picked) {
      console.error(`❌ 无法判定:HEAD / 索引 / 工作树三处都取不到 ${POLICY_REL}`)
      return 2
    }
    policyFace = picked.label
    policyText = picked.text
    policyOids = readPolicyOids()
  } catch (e) {
    console.error(`❌ 无法判定:取策略表时 git 派生失败 —— ${e.message}`)
    return 2
  }
  let P
  try {
    P = loadPolicy(parseYaml(policyText, POLICY_REL))
  } catch (e) {
    console.error(`❌ 无法判定:策略表解析失败 —— ${e.message}`)
    return 2
  }
  let files
  let existing
  let faceDesc
  let scopeMode = 'full'
  try {
    existing = treePaths(rev)
    const srcAll = existing.filter((p) => SRC_RE.test(p))
    if (isStaged) {
      scopeMode = 'staged'
      const staged = new Set(git(['diff', '--cached', '--name-only', '--diff-filter=ACMR']).split('\n').filter(Boolean))
      // D 形态单独取:回退全量时要把"本次提交正删掉的路径"剔出去(否则纯删除型修复永远落不了地)
      const deleted = new Set(git(['diff', '--cached', '--name-only', '--diff-filter=D']).split('\n').filter(Boolean))
      // 回退档的候选面 = HEAD 全部源文件;一次算清"该读哪些 / 剔除了哪些"(单一真相源,拆两处必漂移)
      const headSrcAll = treePaths('HEAD').filter((p) => SRC_RE.test(p))
      const scope = planStagedScope(srcAll, staged, { headSrcPaths: headSrcAll, deletedSet: deleted })
      if (scope.mode === 'staged') {
        files = readFace('', scope.paths)
        faceDesc = `索引 blob(暂存源文件 ${files.size} 个;表自洽性按全索引面判)`
      } else {
        // 暂存集为空 ⇒ 回退全量(HEAD blob)。不回退就等于"审 0 个文件却记绿"(守门 70 同型)。
        // 策略表本身**仍按 --staged 档的索引优先**取材(见 policyFaceOrder)—— 内容面与表面
        // 各自的方向是两件事,顺手把表面也换成 HEAD 就会让"改表那枚提交"重新脱离审查。
        files = readFace('HEAD', scope.keep)
        scopeMode = 'staged-empty-fallback-full'
        const dropNote = scope.droppedDeleted.length
          ? `;已剔除本次提交删除的 ${scope.droppedDeleted.length} 个源文件(${scope.droppedDeleted.slice(0, 5).join(' ')})`
          : ''
        faceDesc = `暂存集为空 ⇒ 回退全量(HEAD blob,${files.size} 个源文件;防"空暂存恒绿",守门 70 同型${dropNote})`
        if (files.size === 0) {
          console.error('❌ 无法判定:暂存集为空且全量面(HEAD)也取不到任何源文件 —— 回退后仍审 0 个文件,不得记为通过')
          return 2
        }
      }
    } else {
      files = readFace('HEAD', srcAll)
      faceDesc = `HEAD blob(${files.size} 个源文件)`
    }
  } catch (e) {
    console.error(`❌ 无法判定:git 取材失败 —— ${e.message}`)
    return 2
  }
  const declCtx = declarationContext(P, existing, rev)
  const decl = auditDeclarations(P, declCtx, { trialModules, strict })
  const policyTable = auditPolicy(P, existing)
  const table = [...policyTable, ...decl.violations]
  // 表自洽性的提交链棘轮(见 filterNewTableDefining 的注释):HEAD 那份表**已有**的缺陷
  // 不得转嫁给本次提交;HEAD 那份读不出/解不开时不设基线(宁可多报,绝不静默放过)。
  let baselineMsgs = new Set()
  if (isStaged) {
    try {
      const headText = readFace('HEAD', [POLICY_REL]).get(POLICY_REL)
      if (typeof headText === 'string') {
        const PH = loadPolicy(parseYaml(headText, `${POLICY_REL}@HEAD`))
        const headPaths = treePaths('HEAD')
        for (const v of auditPolicy(PH, headPaths)) if (!v.soft) baselineMsgs.add(v.msg)
        // 齐备性(E1/E2)同样走棘轮:HEAD 那份表本来就解析不到的入口,不得转嫁给本次提交
        for (const v of auditDeclarations(PH, declarationContext(PH, headPaths, 'HEAD'), { trialModules, strict }).violations) if (!v.soft) baselineMsgs.add(v.msg)
      }
    } catch {
      baselineMsgs = new Set()
    }
  }
  const hardTable = isStaged ? filterNewTableDefects(table, baselineMsgs) : table.filter((x) => !x.soft)
  const res = analyze(P, files, { trialModules })
  const hard = [...hardTable, ...res.red]
  // 被棘轮放过的那几条表缺陷也必须出现在报数面里,不得静默
  const softTable = [...table.filter((x) => x.soft), ...table.filter((x) => !x.soft && !hardTable.includes(x))]
  const soft = res.violations.filter((x) => !hard.includes(x))
  const tally = (arr) => arr.reduce((o, x) => ((o[x.rule] = (o[x.rule] || 0) + 1), o), {})
  const managedIds = [...P.modules.values()].filter((m) => m.managed).map((m) => m.id)
  if (strict && (res.stats.unowned.size || res.stats.unknownPkg.size)) hard.push({ rule: 'table-integrity', file: POLICY_REL, line: 0, msg: '--strict:存在含源文件却未登记的模块' })

  const fellBack = scopeMode === 'staged-empty-fallback-full'
  if (json) {
    console.log(JSON.stringify({ face: isStaged ? (fellBack ? 'index-fallback-head' : 'index') : 'HEAD', stagedFallback: fellBack, policyFace, modules: P.modules.size, managed: managedIds, scanned: res.stats.scanned, edges: res.edges.size, byRule: tally(res.violations), redByRule: tally(hard), hard: hard.slice(0, 80), softTotal: soft.length, unowned: [...res.stats.unowned], unknownPkg: [...res.stats.unknownPkg], exempted: res.stats.exempted, policyExceptions: res.stats.policyExceptions, invalidExempt: res.stats.invalidExempt, staleExceptions: softTable.length, declarations: decl.counters, unparsedManifests: declCtx.unparsed }, null, 2))
    return hard.length ? 1 : 0
  }
  console.log(`[arch-policy] 内容取材口径:${faceDesc}`)
  const notice = policyFaceNotice(policyFace, policyOids)
  if (notice) console.log(`[arch-policy] ${notice.level === 'warn' ? '⚠️' : 'ℹ️'} ${notice.msg}`)
  console.log(`[arch-policy] 模块 ${P.modules.size} 个 | managed:true ${managedIds.length ? managedIds.join(', ') : '0 个(存量一律只报数)'} | 扫描 ${res.stats.scanned} 文件 | 跨模块边 ${res.edges.size} 条 | 非本表射程的说明符 ${res.stats.foreign} 处(第三方/别名,不判但如实计数)`)
  console.log(`[arch-policy] 违规合计 ${res.violations.length + table.length} 处:` + Object.entries({ ...tally(res.violations), ...tally(table) }).map(([k, n]) => ` ${(RULES[k] || k).split(' ')[0]}=${n}`).join(''))
  console.log(`[arch-policy] 齐备性对账:E1 公开入口 ${decl.counters.entrypointsChecked} 条已核 → 解析不到 ${decl.counters.entrypointMissing} 条 | E2 契约工件:声明失踪 ${decl.counters.contractDeclaredMissing} 处、未齐备模块 ${decl.counters.contractAbsentModules} 块(未齐备这一档默认只报数 —— HEAD 实测存量十几块,即时判红就是恒红门;要按它问责跑 --strict)`)
  if (declCtx.unparsed.length) console.log(`[arch-policy] ⚠️ ${declCtx.unparsed.length} 份包清单 JSON.parse 失败(会被算成"入口解析不到",先修清单再看 E1):${declCtx.unparsed.join(', ')}`)
  const staleExc = softTable.filter((x) => x.rule === 'table-integrity').length
  console.log(`[arch-policy] 判红 ${hard.length} 处(C1/T1 全仓即时 + 已收口模块的契约违规;E1/E2 的红只按 managed:true 问责)| 报数 ${soft.length} 处(managed:false 存量,不判红)` + (res.stats.exempted ? ` | 行内 arch-exempt 放过 ${res.stats.exempted} 处` : '') + (res.stats.policyExceptions ? ` | 策略表 exceptions 放过 ${res.stats.policyExceptions} 处` : '') + (res.stats.invalidExempt ? ` | arch-exempt 缺原因(不生效)${res.stats.invalidExempt} 处` : '') + (staleExc ? ` | 待清理的失效例外 ${staleExc} 条` : '') + (decl.counters.contractAbsentModules ? ` | E2 未齐备模块 ${decl.counters.contractAbsentModules} 块(默认只报数)` : ''))
  if (res.stats.unowned.size) console.log(`[arch-policy] ⚠️ 含源文件却未登记进表的目录 ${res.stats.unowned.size} 个(只报数):${[...res.stats.unowned].slice(0, 12).join(', ')}${res.stats.unowned.size > 12 ? ' …' : ''}`)
  const staleIds = unusedExceptions(P, res.stats.exceptionIds, isStaged ? 'index' : 'HEAD')
  if (staleIds.length) console.log(`[arch-policy] ⚠️ 本轮一条都没命中的例外 ${staleIds.length} 条(清单腐烂候补,确认后可删):${staleIds.join(', ')}`)
  if (res.stats.unknownPkg.size) console.log(`[arch-policy] ⚠️ 被 import 但未登记的 @ihui 包 ${res.stats.unknownPkg.size} 个(只报数):${[...res.stats.unknownPkg].join(', ')}`)
  if (hard.length) {
    console.log(`❌ 架构契约判红 ${hard.length} 处:`)
    for (const v of hard.slice(0, 60)) console.log(`   ${v.file}${v.line ? ':' + v.line : ''} [${(RULES[v.rule] || v.rule).split(' ')[0]}] ${v.msg}`)
    if (hard.length > 60) console.log(`   …另 ${hard.length - 60} 处,用 --json 看全量`)
    console.log(`   策略表:${POLICY_REL}(翻 managed:true 之前先 --managed-trial <id> 试跑)`)
    console.log(`   单独复现:node scripts/check-architecture-policy.mjs${isStaged ? ' --staged' : ''}`)
    console.log(`   紧急跳过:${SELF_SKIP}=1 git commit ...`)
    return 1
  }
  console.log(`✅ 架构契约门通过(managed:false 的存量违规以报数形式留痕,不判红)`)
  for (const s of [...softTable, ...soft].slice(0, 24)) console.log(`   · 报数 ${s.file}${s.line ? ':' + s.line : ''} [${(RULES[s.rule] || s.rule).split(' ')[0]}] ${s.msg}`)
  if (soft.length + softTable.length > 24) console.log(`   · …另 ${soft.length + softTable.length - 24} 条,用 --json 看全量`)
  return 0
}

/** 从 guardian-runner 的注册表里按**结构位**取出某道门的注册块。
 *  镜像测试要钉的是"凡登记的都必须被判定成立"这类不变量,而不是"第 N 行有这句话" ——
 *  整块文本搜、相邻文本搜都会在合规代码上恒红(本仓踩过),故这里按数组元素边界切块。 */
export function registrationOf(runnerText, scriptName) {
  const lines = runnerText.split('\n')
  const hits = []
  for (let i = 0; i < lines.length; i++) {
    if (!new RegExp(`^\\s*script:\\s*'${scriptName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'\\s*,?$`).test(lines[i])) continue
    let start = i
    while (start > 0 && !/^\s*\{\s*$/.test(lines[start])) start--
    let end = i
    while (end < lines.length - 1 && !/^\s*\},?\s*$/.test(lines[end])) end++
    const block = lines.slice(start, end + 1)
    const key = (k) => {
      const m = block.map((l) => new RegExp(`^\\s*${k}:\\s*(.*)$`).exec(l)).find(Boolean)
      return m ? m[1].replace(/,\s*$/, '').trim() : null
    }
    hits.push({ id: key('id'), mode: key('mode'), skipEnv: key('skipEnv'), label: key('label'), script: key('script'), block: block.join('\n') })
  }
  return hits
}

/** 提交链上的表自洽性棘轮:只拦"这次暂存的表**新增**的缺陷"。
 *  为什么必须有这一层:T1 判的是策略表这份文件,而 pre-commit 会为**任何**一次提交跑它。
 *  若某人上一枚提交把表改坏了却没人再碰它,此后每一枚无关提交都会被这道门拦红 ——
 *  与本仓"存量红不得转嫁给无关提交"的同一条铁律(守门 77/83/98 的锚点都是 HEAD 自身)。
 *  全量档不套这层:它跑在 check:all / CI,正是"表又坏了"的哨兵。 */
export function filterNewTableDefects(violations, baselineMessages) {
  return violations.filter((v) => !v.soft && !baselineMessages.has(v.msg))
}

// ── 自检:成对正反例 ────────────────────────────────────────────────────────────────────
function selfTest() {
  const yamlFor = (managed) => `
version: 1
constraints:
  max_file_lines: 100
  max_contract_file_lines: 40
  max_public_exports: 5
  contract_file_patterns:
    - 'packages/schema/src/**'
  scan_excludes:
    - '**/*.config.js'
    - '**/dist/**'
  deep_import_test_exempts:
    - '**/tests/**'
layers:
  - id: 'contract'
    rank: 10
  - id: 'composite'
    rank: 30
  - id: 'product'
    rank: 40
modules:
  - id: 'packages/schema'
    package: '@ihui/schema'
    layer: 'contract'
    exported: true
    managed: ${managed}
    roots:
      - 'packages/schema'
    requires: []
    public_entrypoints:
      - '.'
      - './chat/*'
  - id: 'packages/kit'
    package: '@ihui/kit'
    layer: 'composite'
    exported: true
    managed: ${managed}
    roots:
      - 'packages/kit'
    requires:
      - 'packages/schema'
    public_entrypoints:
      - '.'
  - id: 'apps/demo'
    package: '@ihui/demo'
    layer: 'product'
    exported: false
    managed: ${managed}
    roots:
      - 'apps/demo'
    requires:
      - 'packages/kit'
    public_entrypoints: []
exceptions:
  - id: 'EX-STALE-1'
    rule: 'deep-import'
    module: 'apps/demo'
    file: 'apps/demo/tests/gone.ts'
    status: 'debt'
    reason: '自检夹具:指向已不存在的文件,用来验"清单腐烂"只报数不判红'
  - id: 'EX-DEBT-1'
    rule: 'undeclared-dependency'
    module: 'apps/demo'
    file: 'apps/demo/src/debt.ts'
    status: 'debt'
    reason: '自检夹具:已登记的现实债,用来验"放过必须计数",不得静默'
`
  const ON = loadPolicy(parseYaml(yamlFor(true), 'ON'))
  const OFF = loadPolicy(parseYaml(yamlFor(false), 'OFF'))
  const F = (o) => new Map(Object.entries(o))
  const imp = (spec, extra = '') => `import { x } from '${spec}'${extra}\nexport const a = x`
  const cases = [
    { n: '合法跨模块导入必须放过(沿 requires 声明 + 裸包名走主入口)', p: ON, f: F({ 'apps/demo/src/a.ts': imp('@ihui/kit') }), red: 0, all: 0 },
    { n: 'D1 未声明依赖必判红(demo 没声明 schema 却 import 了它)', p: ON, f: F({ 'apps/demo/src/a.ts': imp('@ihui/schema') }), red: 1, all: 1 },
    { n: '与上条成对:同一份 import 放在声明了的 kit 里不违规', p: ON, f: F({ 'packages/kit/src/a.ts': imp('@ihui/schema') }), red: 0, all: 0 },
    { n: 'D2 依赖方向(层序倒挂)必判红:contract 层 import composite 层', p: ON, f: F({ 'packages/schema/src/a.ts': imp('@ihui/kit') }), red: 2, all: 2 },
    { n: 'D3 深导入必判红(子路径没命中 public_entrypoints)', p: ON, f: F({ 'packages/kit/src/a.ts': imp('@ihui/schema/internal/thing') }), red: 1, all: 1 },
    { n: '与上条成对:命中 ./chat/* 的写法放行', p: ON, f: F({ 'packages/kit/src/a.ts': imp('@ihui/schema/chat/message') }), red: 0, all: 0 },
    { n: 'D3 相对路径穿透别的模块实现细节必判红', p: ON, f: F({ 'apps/demo/src/a.ts': imp('../../../packages/kit/src/deep/helper') }), red: 1, all: 1 },
    { n: '与上条成对:同一形态落在 tests/ 下按 D3 豁免(且 D1/D2 都不成立)', p: ON, f: F({ 'apps/demo/tests/a.test.ts': imp('../../../packages/kit/src/deep/helper') }), red: 0, all: 0 },
    { n: 'D3 端应用不对外:按包名 import 一个 exported:false 的模块必判红(D1+D2+D3 三条)', p: ON, f: F({ 'packages/kit/src/a.ts': imp('@ihui/demo') }), red: 3, all: 3 },
    { n: 'C1 单文件行上限对 managed:false 也判红(全仓即时)', p: OFF, f: F({ 'packages/kit/src/big.ts': 'const x = 1\n'.repeat(120) }), red: 1, all: 1 },
    { n: 'C2 契约行上限:managed:false 只报数不判红', p: OFF, f: F({ 'packages/schema/src/wide.ts': 'const y = 1\n'.repeat(45) }), red: 0, all: 1 },
    { n: '与上条成对:同一份文件在 managed:true 下判红', p: ON, f: F({ 'packages/schema/src/wide.ts': 'const y = 1\n'.repeat(45) }), red: 1, all: 1 },
    { n: 'managed:false 整模块只报数:同样的 D1 违规不判红', p: OFF, f: F({ 'apps/demo/src/a.ts': imp('@ihui/schema') }), red: 0, all: 1 },
    { n: 'C3 主入口对外出口数超上限:managed:true 判红', p: ON, f: F({ 'packages/kit/package.json': JSON.stringify({ exports: { '.': './src/index.ts' } }), 'packages/kit/src/index.ts': 'export const a=1\nexport const b=2\nexport const c=3\nexport const d=4\nexport const e=5\nexport const f=6\n' }), red: 1, all: 1 },
    { n: '与上条成对:同样内容在 managed:false 下只报数', p: OFF, f: F({ 'packages/kit/package.json': JSON.stringify({ exports: { '.': './src/index.ts' } }), 'packages/kit/src/index.ts': 'export const a=1\nexport const b=2\nexport const c=3\nexport const d=4\nexport const e=5\nexport const f=6\n' }), red: 0, all: 1 },
    { n: '行内 arch-exempt 带原因才生效(放过)', p: ON, f: F({ 'apps/demo/src/a.ts': imp('@ihui/schema', " // arch-exempt: 自检夹具,原因写在同一行") }), red: 0, all: 0 },
    { n: '与上条成对:arch-exempt 缺原因 ⇒ 不生效,违规照计', p: ON, f: F({ 'apps/demo/src/a.ts': imp('@ihui/schema', ' // arch-exempt:') }), red: 1, all: 1 },
    { n: '模板字符串里拼出来的 import 不算边(防假边的关键一条)', p: ON, f: F({ 'apps/demo/src/gen.ts': "export const out = `\nimport { x } from '@ihui/schema'\n`\nexport const a = out" }), red: 0, all: 0 },
    { n: '注释里的示例 import 不算边', p: ON, f: F({ 'apps/demo/src/doc.ts': "/**\n * import { x } from '@ihui/schema'\n */\nexport const a = 1" }), red: 0, all: 0 },
    { n: 'scan_excludes 命中的装配文件不入依赖图(*.config.js)', p: ON, f: F({ 'apps/demo/eslint.config.js': "import base from '@ihui/schema'\nexport default [base]" }), red: 0, all: 0 },
    { n: 'D4 现实 import 成环必判红(managed 侧:3 条边违规 + 1 条环)', p: ON, f: F({ 'packages/kit/src/a.ts': imp('@ihui/demo'), 'apps/demo/src/b.ts': imp('@ihui/kit') }), red: 4, all: 4 },
    { n: '与上条成对:同一环在 managed:false 下只报数(全仓即时判红只剩 C1/T1)', p: OFF, f: F({ 'packages/kit/src/a.ts': imp('@ihui/demo'), 'apps/demo/src/b.ts': imp('@ihui/kit') }), red: 0, all: 4 },
  ]
  let fail = 0
  let ran = 0
  const eq = (name, got, want, detail) => {
    ran++
    const ok = got === want
    if (!ok) {
      fail++
      console.log(`❌ ${name}(实得 ${got},期望 ${want})${ok ? '' : '\n   ' + detail}`)
    } else console.log(`✅ ${name}`)
  }
  for (const c of cases) {
    const r = analyze(c.p, c.f, {})
    eq(c.n, r.red.length, c.red, JSON.stringify(r.red.map((x) => `${x.rule} ${x.file} ${x.msg}`), null, 0))
    if (r.violations.length !== c.all) {
      fail++
      console.log(`   ↳ 违规总数 ${r.violations.length} ≠ 期望 ${c.all}:${JSON.stringify(r.violations.map((x) => x.rule))}`)
    }
  }
  // 行内豁免的三条边界:缺原因记数、上一行生效、都不静默
  eq('arch-exempt 缺原因必须被记数(不得静默当成没有豁免标记)', analyze(ON, F({ 'apps/demo/src/a.ts': imp('@ihui/schema', ' // arch-exempt:') }), {}).stats.invalidExempt, 1)
  eq('豁免标记写在紧邻上一行同样生效', analyze(ON, F({ 'apps/demo/src/a.ts': "// arch-exempt: 自检夹具,写在上一行\n" + imp('@ihui/schema') }), {}).violations.length, 0)
  eq('与上条成对:写在上一行**再上一行**就不生效(豁免面不得无限扩张)', analyze(ON, F({ 'apps/demo/src/a.ts': "// arch-exempt: 离得太远\n\n" + imp('@ihui/schema') }), {}).violations.length, 1)
  // 表级 exceptions:放过必须留痕,且只对登记的那一条生效
  eq('已登记 exceptions 放过时必须计数(不得静默)', analyze(ON, F({ 'apps/demo/src/debt.ts': imp('@ihui/schema') }), {}).stats.policyExceptions, 1)
  eq('与上条成对:登记之外的那条 import 照判红(例外不得扩散)', analyze(ON, F({ 'apps/demo/src/other.ts': imp('@ihui/schema') }), {}).red.length, 1)
  // 清单腐烂的两面:一条没命中的例外必须被点名;命中了就不该点名
  const hitOnce = analyze(ON, F({ 'apps/demo/src/debt.ts': imp('@ihui/schema') }), {})
  eq('unusedExceptions:本轮没命中的例外必须点名(EX-STALE-1 永不命中)', unusedExceptions(ON, hitOnce.stats.exceptionIds, 'HEAD').join(','), 'EX-STALE-1')
  eq('与上条成对:命中的那条不再被点名', unusedExceptions(ON, analyze(ON, F({ 'apps/demo/src/debt.ts': imp('@ihui/schema'), 'apps/demo/tests/gone.ts': imp('@ihui/kit') }), {}).stats.exceptionIds, 'HEAD').includes('EX-DEBT-1') ? 1 : 0, 0)
  eq('暂存面不得报清单腐烂(绝大多数例外天然不命中)', unusedExceptions(ON, new Set(), 'index').length, 0)
  // --managed-trial 的试跑语义:翻 true 前就能看见有几条会红
  const trialFiles = F({ 'apps/demo/src/a.ts': imp('@ihui/schema') })
  eq('--managed-trial 让未收口模块照判红(试跑)', analyze(OFF, trialFiles, { trialModules: ['apps/demo'] }).red.length, 1)
  eq('与上条成对:不试跑时只报数', analyze(OFF, trialFiles, {}).red.length, 0)
  // 两面取材口径不同形:同一策略,暂存面只见 1 个文件、全量面见 2 个 ⇒ 结论必须不同
  const stagedFace = F({ 'apps/demo/src/a.ts': imp('@ihui/schema') })
  const fullFace = F({ 'apps/demo/src/a.ts': imp('@ihui/schema'), 'packages/kit/src/b.ts': imp('@ihui/demo') })
  eq('--staged 面与全量面必须不同形(取材面决定结论)', analyze(ON, fullFace, {}).red.length > analyze(ON, stagedFace, {}).red.length ? 1 : 0, 1)
  // 空暂存回退(2026-09-25 缺陷 1):暂存集为空时必须回退全量,不得"审 0 个文件却记绿"
  eq('planStagedScope:暂存面有源文件 ⇒ 只咬暂存集(窄口径,不回退)', JSON.stringify(planStagedScope(['apps/web/src/a.ts', 'packages/x/index.ts'], new Set(['packages/x/index.ts']))), JSON.stringify({ mode: 'staged', paths: ['packages/x/index.ts'], keep: ['packages/x/index.ts'], droppedDeleted: [] }))
  eq('planStagedScope:与上条成对,暂存集为空 ⇒ 回退全量', planStagedScope(['apps/web/src/a.ts'], new Set()).mode, 'full')
  eq('planStagedScope:暂存集里只有非源文件 ⇒ 同样算空、同样回退(守门 70 同型)', planStagedScope(['apps/web/src/a.ts'], new Set(['README.md'])).mode, 'full')
  eq('planStagedScope:回退态不得把空 paths 当结果交出去(否则 analyze 照跑 ⇒ 又是一次"扫 0 记绿")', planStagedScope(['a.ts'], new Set()).paths.length, 0)
  // 「纯删除型修复不得被自己钉红」两条成对(2026-09-25,由本门的修复提交被本门拦下这一现场暴露)
  eq(
    '回退全量必须剔掉本次提交删除的路径(否则删除违规文件的那枚提交永远落不了地)',
    JSON.stringify(planStagedScope(['a.ts'], new Set(), { headSrcPaths: ['a.ts', 'bad.ts'], deletedSet: new Set(['bad.ts']) }).keep),
    JSON.stringify(['a.ts']),
  )
  eq(
    '与上条成对:剔除动作必须**可见**(静默排除 = 判据失效,清单要交出来给 faceDesc 打印)',
    JSON.stringify(planStagedScope(['a.ts'], new Set(), { headSrcPaths: ['a.ts', 'bad.ts'], deletedSet: new Set(['bad.ts']) }).droppedDeleted),
    JSON.stringify(['bad.ts']),
  )
  eq(
    '剔除清单必须算在 **HEAD 面**上而不是索引面(D 形态的路径根本不在索引源文件清单里 —— 第一版就错在此处,导致真实场景永远打印"剔除了 0 个")',
    planStagedScope([], new Set(), { headSrcPaths: ['bad.ts'], deletedSet: new Set(['bad.ts']) }).droppedDeleted.length,
    1,
  )
  eq(
    '与上三条成对:没有删除时不得凭空剔除(剔除面只认 D 清单,不接受任何宽泛条件)',
    planStagedScope(['a.ts'], new Set(), { headSrcPaths: ['a.ts', 'b.ts'], deletedSet: new Set() }).keep.length,
    2,
  )
  // 取材面提示语(2026-09-25 缺陷 2):只有 oid 真的不等才喊,"读了索引"不等于"表没入库"
  eq('policyFaceNotice:索引==HEAD ⇒ 安静(旧写法 `!== HEAD` 在这里误报)', policyFaceNotice('索引', { HEAD: 'aaaa', 索引: 'aaaa' }), null)
  eq('policyFaceNotice:与上条成对,索引≠HEAD ⇒ 提示,且是 info 不是 warn(--staged 读索引属正常行为)', policyFaceNotice('索引', { HEAD: 'aaaa', 索引: 'bbbb' }).level, 'info')
  eq('policyFaceNotice:HEAD 根本没有这张表 ⇒ warn(只有这一型才允许说"尚未入库")', policyFaceNotice('索引', { HEAD: null, 索引: 'bbbb' }).level, 'warn')
  eq('policyFaceNotice:退到工作树 ⇒ warn(既没入库也没暂存)', policyFaceNotice('工作树', { HEAD: null, 索引: null }).level, 'warn')
  eq('policyFaceNotice:全量档取 HEAD ⇒ 完全安静', policyFaceNotice('HEAD', { HEAD: 'aaaa', 索引: 'bbbb' }), null)
  // T1:表与现实脱节的四种形态(变异锚点必须唯一命中,否则本自检就是在测空气)
  const existing = ['packages/schema/src/a.ts', 'packages/kit/src/a.ts', 'apps/demo/src/a.ts', 'apps/demo/src/debt.ts', 'apps/demo/package.json']
  const mutate = (yaml, from, to, name) => {
    const hits = yaml.split(from).length - 1
    if (hits !== 1) {
      fail++
      console.log(`❌ 自检锚点失效:${name} 的锚点命中 ${hits} 次(要求恰好 1 次)—— 变异根本没作用到被测实现`)
      return yaml
    }
    return yaml.replace(from, to)
  }
  const T = (yaml) => auditPolicy(loadPolicy(parseYaml(yaml, 'T1')), existing).filter((x) => !x.soft)
  const KIT_ROOTS = "    roots:\n      - 'packages/kit'\n    requires:\n      - 'packages/schema'\n"
  const DEMO_REQ = "    requires:\n      - 'packages/kit'\n    public_entrypoints: []\n"
  const SCHEMA_REQ = '    requires: []\n'
  eq('T1 roots 指向不存在的路径必拦', T(mutate(yamlFor(false), KIT_ROOTS, "    roots:\n      - 'packages/nope'\n    requires:\n      - 'packages/schema'\n", 'roots')).length, 1)
  eq('T1 requires 未登记模块必拦', T(mutate(yamlFor(false), DEMO_REQ, "    requires:\n      - 'packages/kit'\n      - 'packages/ghost'\n    public_entrypoints: []\n", 'ghost')).length, 1)
  eq('T1 requires 声明成环必拦(环 + 层序倒挂各 1 条)', T(mutate(yamlFor(false), SCHEMA_REQ, "    requires:\n      - 'packages/kit'\n", 'cycle')).length, 2)
  eq('T1 与上条成对:原表不报 T1', T(yamlFor(false)).length, 0)
  eq('T1 例外清单腐烂(指向已不存在的文件)只报数不判红', auditPolicy(ON, existing).filter((x) => x.soft).length, 1)
  // 解析器必须**大声失败**:静默跳行等于造一台扫到 0 条却报绿的机器
  const throws = (yaml, label) => {
    try {
      parseYaml(yaml, label)
      return false
    } catch {
      return true
    }
  }
  eq('解析器:Tab 缩进必抛', throws('version: 1\n\tfoo: bar', 'x'), true)
  eq('解析器:无缩进标量含 ": " 必抛(要求加引号)', throws('version: 1\nnote: a: b', 'x'), true)
  eq('解析器:与上条成对,加引号即通过', throws('version: 1\nnote: "a: b"', 'x'), false)
  eq('解析器:未闭合引号必抛', throws("version: 1\nnote: 'abc", 'x'), true)
  eq('装载器:空模块清单不得记为通过', (() => { try { loadPolicy(parseYaml('version: 1\nlayers:\n  - id: c\n    rank: 1\n', 'x')) ; return 0 } catch { return 1 } })(), 1)
  // glob 语义
  const gm = mkMatcher(['packages/types/src/**', '**/*.test.ts', 'benchmarks/**', 'scripts/**'])
  eq('glob:前缀 ** 命中任意深度子路径', gm('packages/types/src/a/b.ts') ? 1 : 0, 1)
  eq('glob:与上条成对,不吃兄弟目录', gm('packages/types/index.ts') ? 1 : 0, 0)
  eq('glob:中缀 ** 匹配任意目录深度', gm('a/b/c.test.ts') ? 1 : 0, 1)
  eq('glob:与上条成对,段内 * 不跨文件名(错拼不命中)', gm('a/b/cxtest.ts') ? 1 : 0, 0)
  eq('glob:目录前缀式在末段仍要求边界', gm('benchmarks/x/y.mjs') ? 1 : 0, 1)
  eq('glob:与上条成对,同名前缀的文件不误命中', gm('benchmarksx/y.mjs') ? 1 : 0, 0)
  // relFrom
  eq('relFrom:仓库相对路径下的 .. 归一', relFrom('apps/demo/src', '../../../packages/kit/src/x') === 'packages/kit/src/x' ? 1 : 0, 1)
  eq('relFrom:与上条成对,不越界时原地解析', relFrom('packages/kit/src', './a/b') === 'packages/kit/src/a/b' ? 1 : 0, 1)
  // ── E1 / E2 声明齐备性:全部用**构造面**(判据不得依赖仓库瞬时状态) ─────────────────
  const eYaml = (managed) => `
version: 1
constraints:
  max_file_lines: 100
  max_contract_file_lines: 40
  max_public_exports: 5
  contract_file_patterns:
    - 'packages/kinds/src/schema/**'
layers:
  - id: 'contract'
    rank: 10
modules:
  - id: 'packages/kinds'
    package: '@ihui/kinds'
    layer: 'contract'
    exported: true
    managed: ${managed}
    roots:
      - 'packages/kinds'
    requires: []
    public_entrypoints:
      - '.'
      - './alpha'
      - './beta/*'
    contract_files:
      - 'src/schema.ts'
  - id: 'packages/loose'
    package: '@ihui/loose'
    layer: 'contract'
    exported: true
    managed: ${managed}
    roots:
      - 'packages/loose'
    requires: []
    public_entrypoints: []
  - id: 'packages/off'
    package: '@ihui/off'
    layer: 'contract'
    exported: true
    managed: false
    roots:
      - 'packages/off'
    requires: []
    public_entrypoints:
      - './gone'
`
  const EON = loadPolicy(parseYaml(eYaml(true), 'E1-ON'))
  const EOFF = loadPolicy(parseYaml(eYaml(false), 'E1-OFF'))
  const faceOf = (list, manifests = {}) => ({ tracked: new Set(list), allPaths: list, unparsed: [], manifestOf: (id) => manifests[id] || null })
  const GOOD_FACE = ['packages/kinds/src/index.ts', 'packages/kinds/src/alpha.ts', 'packages/kinds/src/beta/one.ts', 'packages/kinds/src/schema.ts', 'packages/loose/src/index.ts']
  const hardOf = (r) => r.violations.filter((x) => !x.soft)
  const declGood = auditDeclarations(EON, faceOf(GOOD_FACE), {})
  eq('E1 齐备面:纳管块 packages/kinds 的 . / ./alpha / ./beta/* 三条入口全部解析得到(0 判红)', hardOf(declGood).filter((x) => x.rule === 'entrypoint-missing' && x.module === 'packages/kinds').length, 0)
  eq('E1 未收口模块的缺失入口只报数:packages/off 的 ./gone 计 1 条 missing、0 条判红', `${declGood.counters.entrypointMissing}/${hardOf(declGood).length}`, '1/0')
  eq('E2 已声明 contract_files 的模块不算"未齐备"(loose 才是)', declGood.counters.contractAbsentModules, 1)
  eq('E2 未齐备档默认只报数(恒红门禁开关)', hardOf(declGood).length, 0)
  eq('与上条成对:--strict 档对同一份面把未齐备升成判红', hardOf(auditDeclarations(EON, faceOf(GOOD_FACE), { strict: true })).length, 1)
  const noAlpha = auditDeclarations(EON, faceOf(GOOD_FACE.filter((p) => p !== 'packages/kinds/src/alpha.ts')), {})
  eq('E1 变异:入口文件从面里消失 ⇒ 判红并点名该模块', `${hardOf(noAlpha).length}:${hardOf(noAlpha)[0] ? hardOf(noAlpha)[0].rule : '-'}`, '1:entrypoint-missing')
  eq('与上条成对:同一份缺面放在 managed:false 表里只报数(渐进收口不得被新判据绕过)', hardOf(auditDeclarations(EOFF, faceOf(GOOD_FACE.filter((p) => p !== 'packages/kinds/src/alpha.ts')), {})).length, 0)
  const noSchema = auditDeclarations(EON, faceOf(GOOD_FACE.filter((p) => p !== 'packages/kinds/src/schema.ts')), {})
  eq('E2 变异:contract_files 声明的文件失踪 ⇒ 判红(这就是"缺工件要进退出码"那一半)', `${noSchema.counters.contractDeclaredMissing}:${hardOf(noSchema).filter((x) => x.rule === 'contract-artifact-missing').length}`, '1:1')
  eq('--managed-trial 让未收口模块的齐备性照样试跑出条数', auditDeclarations(EOFF, faceOf(GOOD_FACE.filter((p) => p !== 'packages/kinds/src/alpha.ts')), { trialModules: ['packages/kinds'] }).violations.filter((x) => x.rule === 'entrypoint-missing' && !x.soft).length, 1)
  // 解析口径的三条独立形态(每条都是"少一条就漏判整类")
  const mKinds = EON.modules.get('packages/kinds')
  eq('E1 约定式解不到时须回落到包清单 exports 映射', resolveEntrypoint(mKinds, './zeta', faceOf(['packages/kinds/lib/zeta.ts'], { 'packages/kinds': { exports: { './zeta': './lib/zeta.ts' } } })).state, 'ok')
  eq('与上条成对:约定式与 exports 都指不到 ⇒ missing(不得当成"判不出"静默放过)', resolveEntrypoint(mKinds, './zeta', faceOf(['packages/kinds/lib/zeta.ts'], { 'packages/kinds': { exports: { './other': './lib/other.ts' } } })).state, 'missing')
  eq('E1 子路径 * 必须按 npm exports 语义跨段(段内 * 会把 messages/api/en.json 判成失踪)', resolveEntrypoint(mKinds, './messages/*', faceOf(['packages/kinds/messages/api/en.json'])).state, 'ok')
  eq('与上条成对:主入口 "." 无清单时按 index 约定命中', resolveEntrypoint(mKinds, '.', faceOf(['packages/kinds/src/index.ts'])).path, 'packages/kinds/src/index.ts')
  eq('E2 模块根下的自述文档(README/AGENTS/CONTEXT)是合法契约工件', moduleContractArtifacts(EON.modules.get('packages/loose'), faceOf(['packages/loose/AGENTS.md']), EON).sufficient ? 1 : 0, 1)
  eq('E1 报账拆分:纳管块的红与未纳管块的报数各归各(不得互相顶替)', `${hardOf(noAlpha).filter((x) => x.module === 'packages/kinds').length}/${noAlpha.violations.filter((x) => x.soft && x.rule === 'entrypoint-missing').length}`, '1/1')
  console.log(fail ? `\n❌ 自检 ${fail} 例失败` : `\n全部 ${ran} 例通过(成对正反例 + T1 表自洽 + E1/E2 声明齐备性 + 两面口径差异 + 空暂存回退 + 取材面提示语 + 解析器大声失败 + glob/relFrom)`)
  process.exit(fail ? 1 : 0)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) {
    selfTest()
  } else if (process.env[SELF_SKIP] === '1') {
    console.log(`⏭️  已跳过(${SELF_SKIP}=1):架构契约门未执行`)
  } else {
    try {
      process.exit(main(argv))
    } catch (e) {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    }
  }
}

export const __test__ = { parseYaml, loadPolicy, analyze, auditPolicy, auditDeclarations, resolveEntrypoint, moduleContractArtifacts, declarationContext, extractSpecs, globToRe, mkMatcher, matchEntrypoint, relFrom, pickPolicySource, policyFaceOrder, planStagedScope, policyFaceNotice, registrationOf, unusedExceptions, RULES, ALWAYS_RED, POLICY_REL }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
