#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-retrieval-quality.mjs — 「代码检索召回质量」只读尺子(2026-11-01 立,K 席)
 *
 * 它量什么(四个问题,逐条点名,三态判定):
 *   J1 形态判定  一个检索出口是「双腿并跑+融合」/「单腿」/「串行回落」——从代码锚点现读,不靠猜。
 *   J2 降级信号  回落路径上有没有**显式**降级出口(返回体键 degraded / fallback_reason /
 *                requested_strategy…,或遥测出参被赋一个字面写明降级的值)。都没有 ⇒
 *                `silent-degrade`(本仓 `_tool_search_codebase` 的在册缺陷档)。
 *                只写日志、或"键在但异常分支恒 null"(carrier-only)都算没出声。
 *   J3 融合差异  同一查询的关键词腿 + 向量腿夹具,算「仅关键词 / 仅向量 / RRF / 加权 RRF」
 *                四种排序的结果集与名次差(下一票改完的前后对比凭据)。
 *   J4 对照侧口径 本仓 rrfK / 腿权重 vs 对方 `rrfK:60 / textWeight:2 / vectorWeight:1`,
 *                报 同 / 不同 / 未判定。**不自动改本仓任何参数**(改不改是下一票的事)。
 *
 * 判据单源(AGENTS §0.6 + 门 191「判据复制」反模式):
 *   J3 的融合分数**不在本文件计算**。每轮判定派生一次 `python -c`,import 真函数
 *   `apps/ai-service/app/services/reranker.py::rrf_fuse`(连同它自己的 `_default_key`),
 *   本文件里没有任何 `1/(k+rank)` 形态的算式(镜像测试有自证锁)。
 *   对方 2:1 加权同样不抄公式:把关键词腿**按权重次数重复计入**同一个 `rrf_fuse`,
 *   由它自身的求和性质得到 Σ w_i/(k+rank_i) —— 变换的是入参,不是实现。
 *   解释器取不到 ⇒ 名次维整档 `unjudged` 并点名缺什么,只保留不需要公式的**集合维**(§0.3)。
 *
 * 取材面(§0.4):默认 `git show HEAD:<file>`(工作区常年被别席写脏,共享仓不许当被审面);
 *   `--worktree` 仅人工逃生舱。清单与内容同面同轮。
 *
 * 只读纪律:不写仓库树(自测夹具只落 `scripts/lib/scratch-dir.mjs` 的 scratch 根,§15b)、
 *   不自愈、不改参数、不 spawn 任何服务、**绝不连 PG 8810 / Redis 8811**(§5 测试隔离铁律;
 *   J3 默认走内置离线夹具档)。
 *
 * 刻意不进提交链(§12e 恒红门禁令:判机器态/判历史存量的尺子挂 blocking 就是恒红门);
 *   本文件不在 `scripts/guardian-runner.mjs` 注册,也不在 `.husky/**`、根 `package.json`、
 *   `.github/workflows` 出现 —— 派发腿归主席。
 *
 * 用法:
 *   node scripts/check-retrieval-quality.mjs [--print]            # 现场读数(默认 --print)
 *   node scripts/check-retrieval-quality.mjs --json               # 机读整包
 *   node scripts/check-retrieval-quality.mjs --self-test          # 判据自测(含变异锁)
 *   可选:--face head|worktree  --fixture <file>  --counterpart-live[=<bundle.mjs>]
 *         --python <exe>  --no-python  --top <N>
 *
 * 退出码(优先级 2 > 1 > 0;"没判"绝不压成"判过"):
 *   0 = 四档全部判定完成,且无 silent-degrade
 *   1 = 判出 ≥1 枚 silent-degrade(缺陷档)
 *   2 = 用法错 / 被审面取不到 / 任一维度 unjudged(不冒绿)
 *
 * 人读输出末行带机器可解析协议(形态搬自对方自检器,内容自定):
 *   [WARNING] silent_degrade exits=<n> names=<a,b>
 */

import { spawnSync } from 'node:child_process'
// 取材面纪律(§0.4/门 118):取 blob 正文一律经统一取材层,不在本门内自起 git show。
import { catBatch } from './lib/face-reader.mjs'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'
import { maskCommentsStringsAndRegex } from './lib/code-mask.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const SELF_FILE = path.join(HERE, 'check-retrieval-quality.mjs')
const EVIDENCE_DOC =
  'docs/benchmark-evidence/2026-11/qoder-trae-rea-20261101/T9-qoder-search-engine.md'

/** J2 显式降级键(命中即"出声")。增删键必须同时补镜像测试的正反成对夹具(变异锁依赖它)。 */
const DEGRADE_KEY_SET = [
  'degraded',
  'degrade',
  'degrade_reason',
  'degradation',
  'fallback',
  'fallbacks',
  'fallback_reason',
  'requested_strategy',
  'executed_strategy',
  'requestedStrategy',
  'executedStrategy',
]

/** 遥测出参里"值本身写明降级"的取值形态(rag 侧靠 stats["mode"] 出声,不是靠键名)。 */
const DEGRADE_VALUE_RE = /single-source|fallback|degrad|unavailable|failed|skipped|empty/i

/** 降级分支痕迹(注释或字面量里的"静默/fallback/降级/single-source")。 */
const BRANCH_MARKER_RE = /^\s*(#.*|.*["'].*)$/

/**
 * 被测出口登记表 = 判据唯一清单。
 * legs/fusion 的每条正则是**现读代码的锚点**,命中即留原文行做证据;
 * carrierKeys = 「键在、异常分支不赋值 ⇒ 恒 null」那一型(本仓 semantic_index 实测即此型)。
 */
const EXITS = [
  {
    name: 'rag._retrieve',
    role: 'knowledge-rag',
    file: 'apps/ai-service/app/services/rag.py',
    fn: '_retrieve',
    legs: {
      vector: [/_vector_retrieve\s*\(/, /vec_sources\s*=/, /await vec_task/],
      text: [/_keyword_fallback\s*\(/, /kw_sources\s*=/, /await kw_task/],
    },
    fusion: [/rrf_fuse\s*\(/],
    telemetry: [/stats\s*\[\s*["'](mode|reason|degrade\w*)["']\s*\]\s*=/],
    carrierKeys: [],
  },
  {
    name: 'mcp.search_codebase',
    role: 'code-retrieval',
    file: 'apps/ai-service/app/services/mcp_server.py',
    fn: '_tool_search_codebase',
    legs: {
      vector: [/codebase_indexer\s*\.\s*search\s*\(/, /semantic_results\s*=/],
      text: [
        /os\s*\.\s*walk\s*\(/,
        /_SYMBOL_PATTERNS/,
        /query_lower\s+not\s+in\s+content\s*\.\s*lower\s*\(/,
      ],
    },
    fusion: [/rrf_fuse\s*\(/],
    telemetry: [/stats\s*\[/],
    carrierKeys: [{ key: 'semantic_index', var: 'semantic_index_field' }],
  },
]

/** J3 默认离线夹具(内置,零真库依赖;context_recall 只在关键词腿第 3 名,codebase_indexer 只在向量腿第 1 名)。 */
const DEFAULT_FIXTURE = {
  query: 'rrf_fuse 融合与降级信号',
  topK: 5,
  legs: {
    text: [
      { id: 'apps/ai-service/app/services/rag.py' },
      { id: 'apps/ai-service/app/services/reranker.py' },
      { id: 'apps/ai-service/app/services/context_recall.py' },
      { id: 'apps/ai-service/app/routers/rag.py' },
      { id: 'apps/ai-service/app/services/context_engine.py' },
    ],
    vector: [
      { id: 'apps/ai-service/app/services/codebase_indexer.py' },
      { id: 'apps/ai-service/app/services/rag.py' },
      { id: 'apps/ai-service/app/services/mcp_server.py' },
      { id: 'packages/shared/src/utils/similarity.ts' },
      { id: 'apps/ai-service/app/services/reranker.py' },
    ],
  },
}

// =========================================================================
// 取材面(§0.4)
// =========================================================================

function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

/** 取一份被审面文本:head = `git show HEAD:<rel>`;worktree = 磁盘副本。取不到 ⇒ {ok:false,reason}。 */
function readFileFace(rel, { face = 'head', repoRoot = ROOT } = {}) {
  if (face === 'worktree') {
    try {
      const text = readFileSync(path.resolve(repoRoot, rel), 'utf8')
      return { ok: true, face, rel, text, digest: sha256(text) }
    } catch (e) {
      return { ok: false, face, rel, reason: `工作区副本读不到: ${e.message}` }
    }
  }
  if (face !== 'head') return { ok: false, face, rel, reason: `未知取材面: ${face}` }
  return gitShow(rel, repoRoot)
}

/** 取 HEAD 面字节:经 face-reader 的 catBatch(§0.4 全量档判 HEAD blob;§12g 的 stdio/重试都在那一层)。 */
function gitShow(rel, repoRoot = ROOT) {
  const spec = `HEAD:${rel}`
  let got
  try {
    got = catBatch(repoRoot, [spec])
  } catch (e) {
    return { ok: false, face: 'head', rel, reason: `取材层起不来: ${String(e?.message ?? e).slice(0, 160)}` }
  }
  const text = got?.get(spec)
  if (text === null || text === undefined) {
    return { ok: false, face: 'head', rel, reason: `HEAD 面取不到正文(${rel} 不在 HEAD?)` }
  }
  if (!text) return { ok: false, face: 'head', rel, reason: `HEAD 面拿到空内容(${rel})` }
  return { ok: true, face: 'head', rel, text, digest: sha256(text) }
}

function currentHead(repoRoot = ROOT) {
  const proc = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  return proc.status === 0 ? (proc.stdout || '').trim() || null : null
}

// =========================================================================
// Python 侧真函数(判据单源:只 import,不抄公式)
// =========================================================================

/** PY_BRIDGE 只做三件事:读 stdin JSON → 调 rrf_fuse → 打 stdout JSON。**不含任何融合算式**。 */
const PY_BRIDGE = [
  'import json, sys',
  'sys.path.insert(0, ".")',
  'from app.services.reranker import rrf_fuse, _default_key',
  'payload = json.loads(sys.stdin.buffer.read().decode("utf-8"))',
  'fused = rrf_fuse(payload["rankings"], k=payload["k"], labels=payload["labels"])',
  'out = [{"key": _default_key(f.item), "score": f.score, "fused_from": list(f.fused_from)} for f in fused]',
  'print(json.dumps({"python": sys.version.split()[0], "module": rrf_fuse.__module__,',
  '                 "impl_file": rrf_fuse.__code__.co_filename, "rows": out}))',
].join('\n')

/** 候选解释器:仓内 venv 优先(离线可跑已实测),再退 PATH;全不行 ⇒ 由调用方记 unjudged。 */
function pythonCandidates({ repoRoot = ROOT, override = null } = {}) {
  if (override) return [override]
  const win = path.join(repoRoot, 'apps', 'ai-service', '.venv', 'Scripts', 'python.exe')
  const posix = path.join(repoRoot, 'apps', 'ai-service', '.venv', 'bin', 'python')
  const found = []
  if (existsSync(win)) found.push(win)
  if (existsSync(posix)) found.push(posix)
  found.push(process.platform === 'win32' ? 'python' : 'python3', 'python')
  return [...new Set(found)]
}

/**
 * 派生 python 调真 rrf_fuse。返回 {ok,rows,exe,python,implFile} 或 {ok:false,reason,attempts}。
 * 同一进程内同参数只派生一次(缓存的是"同一次真函数调用的输出",不是本文件自算的分数)。
 * 显式 stdio(['pipe','pipe','pipe'],带 input 必须三 pipe)+ windowsHide(§12g)。
 */
const fuseCache = new Map()
function fuseViaPython(
  rankings,
  { k, labels, repoRoot = ROOT, candidates = null, timeoutMs = 120000, noCache = false } = {},
) {
  const cacheKey = JSON.stringify({ k, labels, rankings, repoRoot })
  if (!noCache && fuseCache.has(cacheKey)) return { ...fuseCache.get(cacheKey), cached: true }
  const exeList = candidates ?? pythonCandidates({ repoRoot })
  const cwd = path.join(repoRoot, 'apps', 'ai-service')
  const input = JSON.stringify({ rankings, k, labels })
  const attempts = []
  for (const exe of exeList) {
    const proc = spawnSync(exe, ['-c', PY_BRIDGE], {
      cwd,
      input,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      timeout: timeoutMs,
      maxBuffer: 32 * 1024 * 1024,
    })
    if (proc.error) {
      attempts.push({
        exe,
        reason: proc.error.code === 'ETIMEDOUT' ? `超时 ${timeoutMs}ms` : proc.error.message,
      })
      continue
    }
    if (proc.status !== 0) {
      attempts.push({
        exe,
        reason: `exit ${proc.status}: ${(proc.stderr || '').trim().split('\n').slice(-2).join(' | ').slice(0, 240)}`,
      })
      continue
    }
    try {
      const parsed = JSON.parse((proc.stdout || '').trim())
      if (!Array.isArray(parsed.rows)) throw new Error('rows 不是数组')
      const res = {
        ok: true,
        exe,
        python: parsed.python,
        module: parsed.module,
        implFile: parsed.impl_file,
        rows: parsed.rows,
        attempts,
      }
      if (!noCache) fuseCache.set(cacheKey, res)
      return res
    } catch (e) {
      attempts.push({ exe, reason: `stdout 非约定 JSON: ${e.message}` })
    }
  }
  return { ok: false, reason: '取不到 python 侧 rrf_fuse(逐个候选已试,见 attempts)', attempts }
}

// =========================================================================
// Python 源码结构小工具(按缩进切块 + 括号配平取 dict 字面量)
// =========================================================================

/**
 * 按 def 名取函数体。
 * 多行签名(如 rag 的 `_retrieve(\n self,\n …\n) -> list[RAGSource]:`)必须整段算进体:
 * 签名尾行与 def 同缩进,若不先找到"头结束行",体就会被截成 1 行 ⇒ J1/J2 全部误判未判定
 * (实测第一版就栽在这里)。结束行判据:相对 def 行的括号深度归 0 且该行以 `:` 收尾。
 */
function extractFunctionBody(source, fnName) {
  const re = new RegExp(`^(\\s*)(?:async\\s+)?def\\s+${fnName}\\s*\\(`, 'm')
  const m = re.exec(source)
  if (!m) return null
  const lines = source.split(/\r?\n/)
  const startLine = source.slice(0, m.index).split('\n').length - 1
  const baseIndent = m[1].length
  let headerEnd = startLine
  let depth = 0
  for (let i = startLine; i < lines.length; i++) {
    for (const c of lines[i]) if (c === '(' || c === '[' || c === '{') depth++
    for (const c of lines[i]) if (c === ')' || c === ']' || c === '}') depth--
    if (depth <= 0 && /:\s*(#.*)?$/.test(lines[i])) {
      headerEnd = i
      break
    }
  }
  let end = lines.length
  for (let i = headerEnd + 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue
    if (line.match(/^\s*/)[0].length <= baseIndent) {
      end = i
      break
    }
  }
  return {
    body: lines.slice(startLine, end).join('\n'),
    startLine: startLine + 1,
    endLine: end,
    headerEndLine: headerEnd + 1,
    baseIndent,
  }
}

/** 取 except 子句的处理块(用于判"吞掉降级只写日志")。 */
function extractExceptBlocks(body) {
  const lines = body.split(/\r?\n/)
  const out = []
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*)except\b.*:\s*$/.exec(lines[i])
    if (!m) continue
    const indent = m[1].length
    let end = i + 1
    while (end < lines.length) {
      const l = lines[end]
      if (!l.trim()) {
        end++
        continue
      }
      if (l.match(/^\s*/)[0].length <= indent) break
      end++
    }
    out.push({ header: lines[i].trim(), text: lines.slice(i + 1, end).join('\n'), line: i + 1 })
  }
  return out
}

/** 字符串感知地剥掉整行/行尾注释(Python `#` 到行尾);不做通用重构,只服务键抽取。 */
function stripLineComments(text) {
  const out = []
  let quote = null
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quote) {
      out.push(c)
      if (c === '\\') {
        out.push(text[++i] ?? '')
      } else if (c === quote) quote = null
      continue
    }
    if (c === '"' || c === "'") {
      quote = c
      out.push(c)
      continue
    }
    if (c === '#') {
      while (i < text.length && text[i] !== '\n') i++
      out.push('\n')
      continue
    }
    out.push(c)
  }
  return out.join('')
}

/** 括号配平 + 字符串感知的顶层逗号切分(不把嵌套 dict 的键算进来)。 */
function splitTopLevel(text) {
  const parts = []
  let depth = 0
  let quote = null
  let cur = ''
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quote) {
      cur += c
      if (c === '\\') {
        cur += text[++i] ?? ''
      } else if (c === quote) quote = null
      continue
    }
    if (c === '"' || c === "'") {
      quote = c
      cur += c
      continue
    }
    if (c === '(' || c === '[' || c === '{') depth++
    else if (c === ')' || c === ']' || c === '}') depth--
    if (c === ',' && depth === 0) {
      parts.push(cur)
      cur = ''
      continue
    }
    cur += c
  }
  if (cur.trim()) parts.push(cur)
  return parts
}

/**
 * 取函数体内每一枚 `return {…}` 字面量的**顶层**键。
 * `**` 展开或解析不出的段 ⇒ opaque=true(键集枚举不全,不许当"已判无降级键")。
 */
function extractReturnDictKeys(body) {
  const out = []
  const re = /\breturn\s*\{/g
  let m
  while ((m = re.exec(body)) !== null) {
    const openIdx = body.indexOf('{', m.index + 6)
    let depth = 0
    let quote = null
    let closeIdx = -1
    for (let i = openIdx; i < body.length; i++) {
      const c = body[i]
      if (quote) {
        if (c === '\\') {
          i++
          continue
        }
        if (c === quote) quote = null
        continue
      }
      if (c === '"' || c === "'") {
        quote = c
        continue
      }
      if (c === '{') depth++
      else if (c === '}') {
        depth--
        if (depth === 0) {
          closeIdx = i
          break
        }
      }
    }
    const line = body.slice(0, m.index).split('\n').length
    if (closeIdx < 0) {
      out.push({ line, keys: [], opaque: true, reason: 'return 字面量括号不配平' })
      continue
    }
    const inner = stripLineComments(
      body.slice(openIdx + 1, closeIdx),
      // 行尾注释先剥掉,免得 `# …` 那一枚段被读成"解析不出"(实测:mcp 回落体的 V3 #75 注释即此型)
    )
    const keys = []
    let opaque = false
    for (const seg of splitTopLevel(inner)) {
      const s = seg.trim()
      if (!s) continue
      if (s.startsWith('**')) {
        opaque = true
        continue
      }
      const km = /^(?:"([A-Za-z_][A-Za-z0-9_]*)"|'([A-Za-z_][A-Za-z0-9_]*)')\s*:/.exec(s)
      if (km) keys.push(km[1] ?? km[2])
      else opaque = true
    }
    out.push({ line, keys, opaque })
    re.lastIndex = closeIdx
  }
  return out
}

function lineAt(text, idx) {
  const s = text.lastIndexOf('\n', idx) + 1
  const e = text.indexOf('\n', idx)
  return text.slice(s, e < 0 ? text.length : e).trim()
}

// =========================================================================
// J1 形态判定
// =========================================================================

function firstMatch(body, patterns) {
  for (const re of patterns) {
    const m = re.exec(body)
    if (!m) continue
    return { pattern: re.source, line: lineAt(body, m.index), index: m.index }
  }
  return null
}

/**
 * J1 判据:dual-leg-fused / serial-fallback / single-leg / undetermined。
 * 证据全来自代码锚点命中(不猜):融合调用 + 两腿命中 + 腿先后次序 + 并发证据。
 */
function classifyShape(body, spec) {
  const legs = {
    vector: firstMatch(body, spec.legs.vector),
    text: firstMatch(body, spec.legs.text),
  }
  const fusion = firstMatch(body, spec.fusion)
  const concurrent = (body.match(/asyncio\s*\.\s*create_task\s*\(/g) || []).length
  const evidence = []
  if (legs.vector) evidence.push(`vector 腿锚点 ${legs.vector.line}`)
  if (legs.text) evidence.push(`text 腿锚点 ${legs.text.line}`)
  if (fusion) evidence.push(`融合调用 ${fusion.line}`)
  const bothLegs = Boolean(legs.vector && legs.text)
  if (!legs.vector && !legs.text) {
    return {
      shape: 'undetermined',
      legs,
      fusion,
      concurrent,
      evidence: [],
      missing: [`出口 ${spec.fn} 里两腿锚点一枚都没命中(锚点清单见 EXITS)`],
    }
  }
  if (fusion && bothLegs)
    return { shape: 'dual-leg-fused', legs, fusion, concurrent, evidence, missing: [] }
  if (fusion && !bothLegs) {
    return {
      shape: 'single-leg',
      legs,
      fusion,
      concurrent,
      evidence,
      missing: ['融合调用在,但只命中一枚腿 ⇒ 谈不上双路'],
    }
  }
  if (!bothLegs) {
    return {
      shape: 'single-leg',
      legs,
      fusion,
      concurrent,
      evidence,
      missing: ['只命中一枚腿,且无融合调用'],
    }
  }
  const order = legs.vector.index <= legs.text.index ? 'vector→text' : 'text→vector'
  return {
    shape: 'serial-fallback',
    legs,
    fusion,
    concurrent,
    evidence: [
      ...evidence,
      `腿次序=${order}:先跑那腿有结果即 return,后跑那腿是回落位(无融合调用把两腿并成一档)`,
    ],
    missing: [],
  }
}

// =========================================================================
// J2 降级信号
// =========================================================================

/**
 * J2 判据(三态):signaled / silent-degrade / unjudged。
 * 出声的合法形态:① 返回体顶层键命中 DEGRADE_KEY_SET;② 遥测出参被赋一个字面写明降级的值;
 * 只写日志、或"键在但异常分支不赋值"(carrier-only)⇒ 都算没出声 ⇒ silent-degrade。
 * 键集枚举不全(无法排除降级键)且没有其它出声证据 ⇒ unjudged,不冒绿也不冒红(§0.3)。
 */
function judgeDegradeSignal(body, spec, opts = {}) {
  const degradeKeys = opts.degradeKeys ?? DEGRADE_KEY_SET
  const carrierKeys = opts.carrierKeys ?? spec.carrierKeys ?? []
  const allowTelemetry = opts.telemetry !== false

  const returns = extractReturnDictKeys(body)
  const keysEnumerable = returns.length > 0 && returns.every((r) => !r.opaque)
  const allKeys = [...new Set(returns.flatMap((r) => r.keys))]
  const signalKeys = allKeys.filter((k) => degradeKeys.includes(k))

  const branchLines = body
    .split(/\r?\n/)
    .map((line, i) => ({ line, no: i + 1 }))
    .filter(
      ({ line }) => /静默|fallback|降级|single-source/.test(line) && BRANCH_MARKER_RE.test(line),
    )
    .map(({ line, no }) => `L${no}: ${line.trim()}`)

  const handlers = extractExceptBlocks(body).map((h) => {
    const assignsCarrier = carrierKeys.some((c) => new RegExp(`\\b${c.var}\\s*=`).test(h.text))
    const assignsSignal = degradeKeys.some((k) =>
      new RegExp(`["'\`]${k}["'\`]\\s*:|\\b${k}\\s*=`).test(h.text),
    )
    const levelM = /\.(debug|info|warning|warn|error)\s*\(/.exec(h.text)
    const surfaces = /\braise\b|\breturn\b/.test(h.text)
    return {
      header: h.header,
      line: h.line,
      logLevel: levelM ? levelM[1] : null,
      assignsCarrier,
      assignsSignal,
      surfaces,
      swallows: !surfaces && !assignsCarrier && !assignsSignal,
    }
  })

  const telemetry = allowTelemetry
    ? (spec.telemetry || [])
        .flatMap((re) => {
          const hits = []
          const g = new RegExp(re.source, 'g')
          let m
          while ((m = g.exec(body)) !== null) hits.push(lineAt(body, m.index))
          return hits
        })
        .filter((line) => DEGRADE_VALUE_RE.test(line))
    : []

  const carriers = carrierKeys.map((c) => {
    const inBody = new RegExp(`\\b${c.var}\\b`).test(body)
    const assignedInSwallow = handlers.some(
      (h) => h.swallows && new RegExp(`\\b${c.var}\\s*=`).test(h.text),
    )
    const responseKeyInBody = new RegExp(`["']${c.key}["']\\s*:`).test(body)
    return {
      key: c.key,
      var: c.var,
      inBody,
      responseKeyInBody,
      assignedInSwallow,
      nullOnFallbackPath: inBody && responseKeyInBody && !assignedInSwallow,
    }
  })

  const base = { signalKeys, carriers, branches: branchLines, telemetry, handlers, missing: [] }
  if (signalKeys.length > 0)
    return { verdict: 'signaled', detail: `explicit-keys:[${signalKeys.join(',')}]`, ...base }
  if (telemetry.length > 0)
    return { verdict: 'signaled', detail: `telemetry:${telemetry[0]}`, ...base }

  const carrierOnly = carriers.filter((c) => c.nullOnFallbackPath)
  const swallowLog = handlers.filter((h) => h.swallows && h.logLevel)
  const detailParts = []
  if (carrierOnly.length > 0) {
    detailParts.push(
      `carrier-only:${carrierOnly.map((c) => `${c.key}(异常分支不赋值 ⇒ 恒 null)`).join(',')}`,
    )
  }
  if (swallowLog.length > 0)
    detailParts.push(`log-only:${[...new Set(swallowLog.map((h) => h.logLevel))].join('/')}`)

  if (branchLines.length === 0 && handlers.length === 0) {
    return {
      verdict: 'unjudged',
      detail:
        '函数体内既无降级痕迹(静默/fallback/降级 注释或取值)也无 except 出口 ⇒ 谈不下降级有没有出声',
      missing: ['降级分支证据(静默/fallback/降级 注释或取值)与异常出口都没命中'],
      ...base,
    }
  }
  // 走到这里 = 一枚出声证据都没有;此时若响应体键集根本枚举不全,就判不出"有没有出声键"
  // ⇒ 只能 unjudged(§0.3):不得用"我看到的那几个键"冒充整份响应体。
  if (!keysEnumerable) {
    const bad = returns.filter((r) => r.opaque).map((r) => r.line)
    return {
      verdict: 'unjudged',
      detail: `return 体顶层键枚举不全(${bad.length > 0 ? `** 展开/解析不出,行 ${bad.join(',')}` : '体内没有字典字面量 return'}),无法排除降级键`,
      missing: ['可枚举的返回体键集'],
      ...base,
    }
  }
  if (detailParts.length === 0) detailParts.push('no-carrier-key(no-telemetry)')
  return { verdict: 'silent-degrade', detail: detailParts.join(' + '), ...base }
}

// =========================================================================
// J3 融合差异(公式在 python 真函数里,这里只做结构量)
// =========================================================================

const idsOf = (leg) => leg.map((it) => (typeof it === 'string' ? it : it.id))
const toItems = (leg) => leg.map((it) => (typeof it === 'string' ? { id: it } : it))
const rankMap = (order) => new Map(order.map((id, i) => [id, i + 1]))
const keyToId = (key) => key.replace(/^id:/, '')

function collectionDims(textIds, vectorIds, topK) {
  const all = [...new Set([...textIds, ...vectorIds])]
  const t = rankMap(textIds)
  const v = rankMap(vectorIds)
  return {
    textOnly: textIds.length,
    vectorOnly: vectorIds.length,
    union: all.length,
    inBoth: all.filter((id) => t.has(id) && v.has(id)).length,
    onlyText: all.filter((id) => t.has(id) && !v.has(id)).length,
    onlyVector: all.filter((id) => !t.has(id) && v.has(id)).length,
    topK,
    overlapTopK: vectorIds.slice(0, topK).filter((id) => new Set(textIds.slice(0, topK)).has(id))
      .length,
  }
}

/**
 * 名次差:对每个片 id 给出四档名次(textOnly / vectorOnly / rrf / wrrf)与位移。
 * rrf/wrrf 名次**由调用方从 python 真函数结果传入**,本函数不产生任何分数。
 */
function fusionDiff({ fixture, k, topK, textWeight, vectorWeight, rrfKeys, wrrfKeys, provenance }) {
  const textIds = idsOf(fixture.legs.text)
  const vectorIds = idsOf(fixture.legs.vector)
  const n = topK ?? fixture.topK ?? 5
  const tRank = rankMap(textIds)
  const vRank = rankMap(vectorIds)
  const rrfRank = rankMap(rrfKeys.map(keyToId))
  const wrrfRank = rankMap(wrrfKeys.map(keyToId))
  const allIds = [...new Set([...textIds, ...vectorIds, ...rrfRank.keys()])]
  const rows = allIds.map((id) => {
    const singles = [tRank.get(id), vRank.get(id)].filter((x) => typeof x === 'number')
    const singleBest = singles.length > 0 ? Math.min(...singles) : null
    return {
      id,
      textRank: tRank.get(id) ?? null,
      vectorRank: vRank.get(id) ?? null,
      rrfRank: rrfRank.get(id) ?? null,
      wrrfRank: wrrfRank.get(id) ?? null,
      dRrfVsBestSingle:
        rrfRank.has(id) && singleBest !== null ? rrfRank.get(id) - singleBest : null,
      dWrrfVsRrf: rrfRank.has(id) && wrrfRank.has(id) ? wrrfRank.get(id) - rrfRank.get(id) : null,
    }
  })
  const textTop = new Set(textIds.slice(0, n))
  const vectorTop = new Set(vectorIds.slice(0, n))
  const rrfOrder = rrfKeys.map(keyToId)
  const wrrfOrder = wrrfKeys.map(keyToId)
  let firstDifference = null
  for (let i = 0; i < Math.max(rrfOrder.length, wrrfOrder.length); i++) {
    if (rrfOrder[i] !== wrrfOrder[i]) {
      firstDifference = { rank: i + 1, rrf: rrfOrder[i] ?? null, wrrf: wrrfOrder[i] ?? null }
      break
    }
  }
  return {
    status: 'judged',
    k,
    textWeight,
    vectorWeight,
    collection: collectionDims(textIds, vectorIds, n),
    rrfOrder,
    wrrfOrder,
    ranks: rows,
    topKSets: {
      rrfTop: rrfOrder.slice(0, n),
      wrrfTop: wrrfOrder.slice(0, n),
      promotedIntoRrfTopByFusion: rrfOrder
        .slice(0, n)
        .filter((id) => !textTop.has(id) && !vectorTop.has(id)),
      rankChangedByWeight: rows.filter((r) => r.dWrrfVsRrf !== null && r.dWrrfVsRrf !== 0).length,
      firstDifference,
    },
    provenance: {
      ...provenance,
      formula: 'rrf_fuse(真函数;本 .mjs 零公式,加权档由同腿重复计入表达)',
    },
    missing: [],
  }
}

const unjudgedDiff = ({ fixture, topK, python }) => ({
  status: 'unjudged',
  reason: python?.reason ?? '未派生 python(--no-python)',
  attempts: python?.attempts ?? [],
  collection: collectionDims(
    idsOf(fixture.legs.text),
    idsOf(fixture.legs.vector),
    topK ?? fixture.topK ?? 5,
  ),
  ranks: null,
  missing: [
    '名次维需要 rrf_fuse 真函数输出;取不到解释器/模块 ⇒ 整档未判定(不在本文件复算公式冒充同源)',
  ],
})

// =========================================================================
// J4 对照侧参数对账
// =========================================================================

function readRepoRrfConfig({ ragFace, rerankerFace, env = process.env }) {
  const out = {
    ragDefaultK: null,
    rerankerDefaultK: null,
    envName: null,
    envValue: null,
    kSourcesAgree: 'unjudged',
    resolveFn: null,
    legWeights: [],
    weightsAbsence: 'unjudged',
  }
  if (ragFace?.ok) {
    const dm = /^\s*DEFAULT_RRF_K\s*=\s*(\d+)/m.exec(ragFace.text)
    const em = /^\s*RRF_K_ENV\s*=\s*["']([^"']+)["']/m.exec(ragFace.text)
    out.ragDefaultK = dm ? Number(dm[1]) : null
    out.envName = em ? em[1] : null
    out.resolveFn = /def\s+resolve_rrf_k\s*\(/.test(ragFace.text) ? 'resolve_rrf_k()' : null
    if (out.envName) out.envValue = env[out.envName] ?? null
  }
  if (rerankerFace?.ok) {
    const sig = /def\s+rrf_fuse\s*\(([\s\S]{0,400}?)\)\s*->/.exec(rerankerFace.text)
    const km = sig ? /k:\s*int\s*=\s*(\d+)/.exec(sig[1]) : null
    out.rerankerDefaultK = km ? Number(km[1]) : null
    out.fuseParams = sig
      ? splitTopLevel(sig[1])
          .map(
            (s) =>
              s
                .trim()
                .replace(/^['"(].*$/, '')
                .split(/[:\s=]/)[0],
          )
          .filter((x) => /^[A-Za-z_]\w*$/.test(x))
      : null
  }
  if (out.ragDefaultK !== null && out.rerankerDefaultK !== null) {
    out.kSourcesAgree = out.ragDefaultK === out.rerankerDefaultK ? 'same' : 'different'
  }
  const weightRe = /\b(?:text|vector|leg|source|腿)_?[wW]eight\b|\bweights?\s*=\s*\{/g
  for (const face of [ragFace, rerankerFace]) {
    if (!face?.ok) continue
    let m
    weightRe.lastIndex = 0
    while ((m = weightRe.exec(face.text)) !== null) {
      out.legWeights.push({
        file: face.rel,
        line: face.text.slice(0, m.index).split('\n').length,
        text: lineAt(face.text, m.index),
      })
    }
  }
  if (ragFace?.ok && rerankerFace?.ok)
    out.weightsAbsence = out.legWeights.length === 0 ? 'absent(等价 1:1)' : 'present'
  return out
}

/** 对方读数:默认取本仓取证册(标注二手);`--counterpart-live` 时直读活引擎字节。 */
function readCounterpartParams({ docFace, livePath = null }) {
  const out = {
    rrfK: null,
    textWeight: null,
    vectorWeight: null,
    face: 'undetermined',
    literal: null,
    bundlePath: null,
    bundleSize: null,
  }
  if (livePath && existsSync(livePath)) {
    try {
      const text = readFileSync(livePath, 'utf8')
      const pick = (name) => {
        const m = new RegExp(
          `${name}:\\s*[A-Za-z0-9_$]+\\s*\\(\\s*this\\.config\\.${name}\\s*,\\s*(\\d+)\\s*\\)`,
        ).exec(text)
        return m ? Number(m[1]) : null
      }
      out.rrfK = pick('rrfK')
      out.textWeight = pick('textWeight')
      out.vectorWeight = pick('vectorWeight')
      out.face = 'live-bundle(回源复验)'
      out.bundlePath = livePath
      out.bundleSize = text.length
      out.literal = `rrfK:${out.rrfK} textWeight:${out.textWeight} vectorWeight:${out.vectorWeight}`
      return out
    } catch (e) {
      out.literal = `活引擎字节读不到(${livePath}): ${e.message}`
      return out
    }
  }
  if (livePath) {
    out.literal = `--counterpart-live 指向的路径不存在:${livePath}`
    return out
  }
  if (!docFace?.ok) {
    out.literal = `取证册取不到: ${docFace?.reason ?? '未知原因'}`
    return out
  }
  const g = (re) => {
    const m = re.exec(docFace.text)
    return m ? Number(m[1]) : null
  }
  out.rrfK = g(/rrfK:\s*D1e\(this\.config\.rrfK,\s*(\d+)\)/)
  out.textWeight = g(/textWeight:\s*D1e\(this\.config\.textWeight,\s*(\d+)\)/)
  out.vectorWeight = g(/vectorWeight:\s*D1e\(this\.config\.vectorWeight,\s*(\d+)\)/)
  const bm = /`([^`]*qoder-search\.bundle\.mjs)`/.exec(docFace.text)
  out.bundlePath = bm ? bm[1] : null
  out.face = 'evidence-doc(二手读数,未回源复验)'
  out.literal = `rrfK:${out.rrfK} textWeight:${out.textWeight} vectorWeight:${out.vectorWeight}`
  return out
}

function compareParams(repo, counterpart) {
  const rows = []
  const cmp = (dim, mine, theirs, note) => {
    const verdict =
      mine === null || mine === undefined || theirs === null || theirs === undefined
        ? 'unjudged'
        : mine === theirs
          ? 'same'
          : 'different'
    rows.push({ dim, repo: mine, counterpart: theirs, verdict, note })
  }
  const repoK =
    repo.kSourcesAgree === 'different' ? null : (repo.ragDefaultK ?? repo.rerankerDefaultK)
  cmp(
    'rrfK',
    repoK,
    counterpart.rrfK,
    `本仓两处默认 rag.DEFAULT_RRF_K=${repo.ragDefaultK} / reranker 默认 k=${repo.rerankerDefaultK} ⇒ ${repo.kSourcesAgree};env ${repo.envName ?? '未解析'}=${repo.envValue ?? '未设置'}`,
  )
  cmp(
    'textWeight',
    repo.legWeights.length > 0 ? '见 legWeights' : 1,
    counterpart.textWeight,
    `本仓权重维:${repo.weightsAbsence}`,
  )
  cmp(
    'vectorWeight',
    repo.legWeights.length > 0 ? '见 legWeights' : 1,
    counterpart.vectorWeight,
    `rrf_fuse 形参(${(repo.fuseParams ?? []).join(',')})里没有权重位 ⇒ 本仓无权 RRF`,
  )
  const different = rows.filter((r) => r.verdict === 'different')
  return {
    rows,
    summary:
      different.length > 0
        ? `差异 ${different.length} 维:${different.map((r) => r.dim).join(',')}(**本尺不改参数,改不改是下一票**)`
        : '全部同档或存在未判定维(见 unjudged)',
    unjudged: rows.filter((r) => r.verdict === 'unjudged').map((r) => r.dim),
  }
}

// =========================================================================
// 组装四个判据
// =========================================================================

function runAll({
  face = 'head',
  fixture = DEFAULT_FIXTURE,
  fixturePath = null,
  counterpartLive = null,
  usePython = true,
  pythonOverride = null,
  topK = null,
  repoRoot = ROOT,
  env = process.env,
} = {}) {
  const head = currentHead(repoRoot)
  const report = {
    tool: 'check-retrieval-quality',
    face,
    head: head ?? null,
    generatedAt: new Date().toISOString(),
    J1: { items: [], unjudged: [] },
    J2: { items: [], defects: [], unjudged: [] },
    J3: {},
    J4: {},
    unjudgedDims: [],
  }
  if (!head) report.unjudgedDims.push('HEAD(commit 取不到)')

  const faces = new Map()
  for (const rel of [
    ...new Set([
      ...EXITS.map((e) => e.file),
      'apps/ai-service/app/services/reranker.py',
      EVIDENCE_DOC,
    ]),
  ]) {
    faces.set(rel, readFileFace(rel, { face, repoRoot }))
  }

  for (const spec of EXITS) {
    const f = faces.get(spec.file)
    if (!f.ok) {
      report.J1.unjudged.push({
        exit: spec.name,
        reason: `被审面取不到(${spec.file}): ${f.reason}`,
      })
      report.J2.unjudged.push({ exit: spec.name, reason: '被审面取不到' })
      continue
    }
    const fn = extractFunctionBody(f.text, spec.fn)
    if (!fn) {
      report.J1.unjudged.push({
        exit: spec.name,
        reason: `函数 ${spec.fn} 在 ${spec.file}(面 ${f.face})里定位不到`,
      })
      report.J2.unjudged.push({ exit: spec.name, reason: '函数体取不到' })
      continue
    }
    const shape = classifyShape(fn.body, spec)
    if (shape.shape === 'undetermined')
      report.J1.unjudged.push({ exit: spec.name, reason: shape.missing.join(';') })
    report.J1.items.push({
      exit: spec.name,
      role: spec.role,
      file: spec.file,
      fn: spec.fn,
      fnLines: [fn.startLine, fn.endLine],
      blob: f.digest.slice(0, 16),
      ...shape,
    })
    const sig = judgeDegradeSignal(fn.body, spec)
    report.J2.items.push({ exit: spec.name, shape: shape.shape, ...sig })
    if (sig.verdict === 'silent-degrade')
      report.J2.defects.push({ exit: spec.name, detail: sig.detail })
    if (sig.verdict === 'unjudged') report.J2.unjudged.push({ exit: spec.name, reason: sig.detail })
  }
  if (report.J1.items.length === 0)
    report.unjudgedDims.push('J1 形态(枚举到 0 枚出口判出,§0.3 不判绿)')
  if (report.J2.items.length === 0) report.unjudgedDims.push('J2 降级信号(枚举到 0 枚出口判出)')
  // 假绿防线:出口清单非空但其中有人被判 undetermined/unjudged 时,同样不得当"已判完"
  for (const u of report.J1.unjudged) report.unjudgedDims.push(`J1 ${u.exit} 未判定:${u.reason}`)
  for (const u of report.J2.unjudged) report.unjudgedDims.push(`J2 ${u.exit} 未判定:${u.reason}`)
  if (report.J1.items.some((i) => i.shape === 'undetermined'))
    report.unjudgedDims.push('J1 有出口判 undetermined')

  const ragFace = faces.get('apps/ai-service/app/services/rag.py')
  const rerankerFace = faces.get('apps/ai-service/app/services/reranker.py')
  const repoCfg = readRepoRrfConfig({ ragFace, rerankerFace, env })
  const kFromEnv =
    repoCfg.envValue !== null && /^\d+$/.test(String(repoCfg.envValue))
      ? Number(repoCfg.envValue)
      : null
  const kForFixture = kFromEnv ?? repoCfg.ragDefaultK ?? repoCfg.rerankerDefaultK ?? null
  const fx = fixturePath ? { ...loadFixture(fixturePath), loadedFrom: fixturePath } : { ...fixture }
  const n = topK ?? fx.topK ?? 5

  if (!usePython) {
    report.J3 = {
      ...unjudgedDiff({
        fixture: fx,
        topK: n,
        python: { reason: '--no-python:名次维拒绝在本文件复算公式(§0.6 单源)' },
      }),
      fixture: { query: fx.query, loadedFrom: fx.loadedFrom ?? 'builtin-fixture' },
    }
    report.unjudgedDims.push('J3 名次维(未派生 python)')
  } else {
    const cands = pythonCandidates({ repoRoot, override: pythonOverride })
    const plain = fuseViaPython([toItems(fx.legs.vector), toItems(fx.legs.text)], {
      k: kForFixture ?? 60,
      labels: ['vector', 'text'],
      repoRoot,
      candidates: cands,
    })
    if (!plain.ok) {
      report.J3 = {
        ...unjudgedDiff({ fixture: fx, topK: n, python: plain }),
        fixture: { query: fx.query, loadedFrom: fx.loadedFrom ?? 'builtin-fixture' },
      }
      report.unjudgedDims.push('J3 名次维(python rrf_fuse 取不到)')
    } else {
      const weighted = fuseViaPython(
        [...Array(2).fill(toItems(fx.legs.text)), ...Array(1).fill(toItems(fx.legs.vector))],
        { k: kForFixture ?? 60, labels: ['text', 'text', 'vector'], repoRoot, candidates: cands },
      )
      if (!weighted.ok) {
        report.J3 = {
          ...unjudgedDiff({
            fixture: fx,
            topK: n,
            python: { reason: '加权投影档的第二次 python 调用失败', attempts: weighted.attempts },
          }),
          fixture: { query: fx.query, loadedFrom: fx.loadedFrom ?? 'builtin-fixture' },
          note: '无权 RRF 已判出,加权投影档未判定 ⇒ 整档不冒绿',
        }
        report.unjudgedDims.push('J3 加权投影档(python 第二次调用失败)')
      } else {
        report.J3 = {
          ...fusionDiff({
            fixture: fx,
            k: kForFixture ?? 60,
            topK: n,
            textWeight: 2,
            vectorWeight: 1,
            rrfKeys: plain.rows.map((r) => r.key),
            wrrfKeys: weighted.rows.map((r) => r.key),
            provenance: {
              exe: plain.exe,
              python: plain.python,
              module: plain.module,
              implFile: plain.implFile,
            },
          }),
          fixture: { query: fx.query, loadedFrom: fx.loadedFrom ?? 'builtin-fixture' },
        }
      }
    }
  }

  const livePath =
    counterpartLive === 'auto'
      ? readCounterpartParams({ docFace: faces.get(EVIDENCE_DOC) }).bundlePath
      : counterpartLive
  const cp = readCounterpartParams({ docFace: faces.get(EVIDENCE_DOC), livePath })
  report.J4 = { repo: repoCfg, counterpart: cp, ...compareParams(repoCfg, cp) }
  if (report.J4.unjudged.length > 0)
    report.unjudgedDims.push(`J4 ${report.J4.unjudged.join(',')} 未判定`)

  report.exitCode = decideExit(report)
  return report
}

function decideExit(report) {
  if (report.unjudgedDims.length > 0) return 2
  if ((report.J2?.defects?.length ?? 0) > 0) return 1
  if ((report.J1?.items?.length ?? 0) === 0 || (report.J2?.items?.length ?? 0) === 0) return 2
  return 0
}

// =========================================================================
// 人读渲染
// =========================================================================

function render(report) {
  const L = []
  L.push(`检索召回质量尺(read-only)· face=${report.face} · HEAD=${report.head ?? '未判定'}`)
  L.push('J1 形态判定:')
  for (const it of report.J1.items) {
    L.push(
      `  - ${it.exit} [${it.role}] shape=${it.shape} legs={vector:${it.legs.vector ? 'y' : 'n'},text:${it.legs.text ? 'y' : 'n'}} fusion=${it.fusion ? 'y' : 'n'} 并发 create_task=${it.concurrent} 体=${it.fnLines[0]}..${it.fnLines[1]} blob=${it.blob}`,
    )
    for (const e of it.evidence) L.push(`      · ${e}`)
  }
  for (const u of report.J1.unjudged) L.push(`  - ${u.exit} shape=undetermined 原因=${u.reason}`)

  L.push('J2 降级信号:')
  for (const it of report.J2.items) {
    L.push(`  - ${it.exit} shape=${it.shape} verdict=${it.verdict} detail=${it.detail}`)
    for (const b of it.branches ?? []) L.push(`      · 降级痕迹 ${b}`)
    for (const h of it.handlers ?? [])
      L.push(`      · except ${h.header} logLevel=${h.logLevel ?? '-'} swallows=${h.swallows}`)
    if (it.telemetry?.length) L.push(`      · 遥测出声位 ${it.telemetry.join(' | ')}`)
  }
  for (const u of report.J2.unjudged) L.push(`  - ${u.exit} verdict=unjudged 原因=${u.reason}`)

  L.push('J3 融合差异(夹具前后对比凭据):')
  const j3 = report.J3
  if (j3.collection) {
    const c = j3.collection
    L.push(
      `  - 夹具 ${j3.fixture?.loadedFrom ?? 'builtin-fixture'} "${j3.fixture?.query ?? '-'}" · 集合维: text腿=${c.textOnly} vector腿=${c.vectorOnly} 并集=${c.union} 双腿都命中=${c.inBoth} 仅关键词=${c.onlyText} 仅向量=${c.onlyVector} top${c.topK} 交集=${c.overlapTopK}`,
    )
  }
  if (j3.status === 'judged') {
    L.push(
      `  - 公式来源: ${j3.provenance.formula} via ${j3.provenance.exe}(${j3.provenance.python}) impl=${j3.provenance.implFile}`,
    )
    L.push(`  - 无权 RRF(k=${j3.k})名次: ${j3.rrfOrder.join(' > ')}`)
    L.push(
      `  - 加权投影(关键词腿 ×${j3.textWeight} / 向量腿 ×${j3.vectorWeight})名次: ${j3.wrrfOrder.join(' > ')}`,
    )
    if (j3.topKSets.firstDifference) {
      L.push(
        `  - 加权与无权首个分歧: 第 ${j3.topKSets.firstDifference.rank} 位 无权=${j3.topKSets.firstDifference.rrf} vs 加权=${j3.topKSets.firstDifference.wrrf}`,
      )
    }
    L.push(`  - 名次差表(Δ 相对该片的单腿最好名次 / 加权相对无权):`)
    for (const r of j3.ranks) {
      L.push(
        `      ${r.id} text=${r.textRank ?? '-'} vector=${r.vectorRank ?? '-'} rrf=${r.rrfRank ?? '-'} wrrf=${r.wrrfRank ?? '-'} Δ(rrf-单腿)=${r.dRrfVsBestSingle ?? '-'} Δ(加权-无权)=${r.dWrrfVsRrf ?? '-'}`,
      )
    }
    L.push(
      `  - 靠融合才进 top${j3.collection.topK} 的片: ${j3.topKSets.promotedIntoRrfTopByFusion.join(', ') || '(无)'}`,
    )
  } else {
    L.push(`  - 名次维=${j3.status ?? 'unjudged'} 原因=${j3.reason ?? j3.note ?? '未判定'}`)
    for (const a of j3.attempts ?? []) L.push(`      · 试过的解释器 ${a.exe}: ${a.reason}`)
    for (const m of j3.missing ?? []) L.push(`      · 缺: ${m}`)
  }

  L.push('J4 对照侧口径(现读,不改参数):')
  L.push(
    `  - 本仓 rrfK: rag.DEFAULT_RRF_K=${report.J4.repo.ragDefaultK} / reranker 默认=${report.J4.repo.rerankerDefaultK}(${report.J4.repo.kSourcesAgree}) env ${report.J4.repo.envName ?? '?'}=${report.J4.repo.envValue ?? '未设置'} · 腿权重命中 ${report.J4.repo.legWeights.length} 处(${report.J4.repo.weightsAbsence})`,
  )
  for (const w of report.J4.repo.legWeights) L.push(`      · ${w.file}:${w.line} ${w.text}`)
  L.push(
    `  - 对方: ${report.J4.counterpart.literal} 口径=${report.J4.counterpart.face}${report.J4.counterpart.bundlePath ? ` 靶=${report.J4.counterpart.bundlePath}` : ''}`,
  )
  for (const r of report.J4.rows)
    L.push(`      ${r.dim}: 本仓=${r.repo} 对方=${r.counterpart} ⇒ ${r.verdict}(${r.note})`)
  L.push(`  - ${report.J4.summary}`)

  if (report.unjudgedDims.length > 0)
    L.push(`unjudged=${report.unjudgedDims.length} ${report.unjudgedDims.join(' | ')}`)
  L.push(
    `[WARNING] silent_degrade exits=${report.J2.defects.length} names=${report.J2.defects.map((d) => d.exit).join(',') || '-'}`,
  )
  return L.join('\n')
}

// =========================================================================
// 自测:判据 + 变异锁(临时夹具只落 scratch 根,§15b)
// =========================================================================

const RAG_SAMPLE = `
    async def _retrieve(self, query, top_k=5, stats=None):
        # 向量不可用 → 关键词单路降级,这条降级**必须**在 stats 里留原因
        vec_task = asyncio.create_task(self._vector_retrieve(query, stats=stats))
        kw_task = asyncio.create_task(self._keyword_fallback(query, stats=stats))
        vec_sources = await vec_task
        kw_sources = await kw_task
        if not vec_sources:
            stats["mode"] = "single-source:keyword" if kw_sources else "empty"
            return kw_sources[:top_k]
        rankings = [vec_sources]
        labels = ["vector"]
        if kw_sources:
            rankings.append(kw_sources)
            labels.append("keyword")
        fused = reranker.rrf_fuse(rankings, k=rrf_k, labels=labels)
        return [f.item for f in fused]
`

const MCP_SAMPLE = `
async def _tool_search_codebase(arguments):
    use_semantic = arguments.get("use_semantic", True)
    semantic_index_field = None
    if use_semantic:
        try:
            semantic_results = await codebase_indexer.search(query)
            if not semantic_results:
                lazy = await _lazy_index_and_research()
                semantic_index_field = lazy.as_response_field()
            if semantic_results:
                return {"tool": "search_codebase", "matches": [], "ok": True}
        except Exception as e:
            _logging.getLogger(__name__).debug("semantic search failed, fallback to regex: %s", e)
    for dirpath, dirnames, filenames in os.walk(root):
        if query_lower not in content.lower():
            continue
    return {
        "tool": "search_codebase",
        "query": query,
        "matches": matches,
        "total": len(matches),
        "semantic_index": semantic_index_field,
        "message": f"找到 {len(matches)} 个匹配",
        "ok": True,
    }
`

/** 变异夹具:只在回落返回体里补上显式降级键 —— 判据若真有牙,verdict 必须翻档。 */
const MCP_SAMPLE_WITH_KEY = MCP_SAMPLE.replace(
  '"semantic_index": semantic_index_field,',
  '"semantic_index": semantic_index_field,\n        "degraded": True,\n        "fallback_reason": "semantic-raised",',
)

const SPEC_RAG = EXITS[0]
const SPEC_MCP = EXITS[1]

/**
 * 零公式复制自证:遮罩(注释/字符串/正则)后扫本文件代码面,出现 `1/(k+rank)` 形态即不干净。
 * 遮罩必须走本仓唯一源 `scripts/lib/code-mask.mjs`;不遮 ⇒ 门读到自己(本检查自身的正则与
 * 用例名里就写着那串字符,第一版实测翻红过一次)。
 */
function selfCheckNoFormula(file = SELF_FILE) {
  const masked = maskCommentsStringsAndRegex(readFileSync(file, 'utf8'))
  const hit = /1(\.0)?\s*\/\s*\(\s*k\s*\+|1\s*\/\s*\(\s*60\s*\+|\s*\/\s*\(\s*k\s*\+\s*rank/m.exec(
    masked,
  )
  return { clean: !hit, hit: hit ? hit[0] : null, maskedLength: masked.length }
}

/** python 桥只许"import + 调用":认得真函数名,且桥体里没有任何除法算式。 */
function pyBridgeIsCallOnly(bridge = PY_BRIDGE) {
  return /from app\.services\.reranker import rrf_fuse/.test(bridge) && !/\d\s*\/\s*\(/.test(bridge)
}

async function selfTest({ repoRoot = ROOT, usePython = true }) {
  const checks = []
  const ok = (name, cond, info = '') => checks.push({ name, pass: Boolean(cond), info })

  // 1. 形态判据:同一把尺必须把两枚出口判成两档(判据被反转 ⇒ 这两条必红)
  const ragShape = classifyShape(RAG_SAMPLE, SPEC_RAG)
  const mcpShape = classifyShape(MCP_SAMPLE, SPEC_MCP)
  ok('J1 rag 夹具 ⇒ dual-leg-fused', ragShape.shape === 'dual-leg-fused', ragShape.shape)
  ok('J1 mcp 夹具 ⇒ serial-fallback', mcpShape.shape === 'serial-fallback', mcpShape.shape)
  ok(
    'J1 无腿锚点可命中 ⇒ undetermined(不猜)',
    classifyShape('def x():\n    return 1\n', SPEC_RAG).shape === 'undetermined',
  )

  // 2. 变异锁(成对夹具 + 补键翻档 + 掏空判据翻档)
  const ragSig = judgeDegradeSignal(RAG_SAMPLE, SPEC_RAG)
  const mcpSig = judgeDegradeSignal(MCP_SAMPLE, SPEC_MCP)
  ok('J2 rag ⇒ signaled(via stats["mode"])', ragSig.verdict === 'signaled', ragSig.detail)
  ok(
    'J2 mcp ⇒ silent-degrade(carrier-only + log-only:debug)',
    mcpSig.verdict === 'silent-degrade',
    mcpSig.detail,
  )
  ok(
    'J2 变异:回落体补上显式 degraded 键必须翻成 signaled',
    judgeDegradeSignal(MCP_SAMPLE_WITH_KEY, SPEC_MCP).verdict === 'signaled',
    judgeDegradeSignal(MCP_SAMPLE_WITH_KEY, SPEC_MCP).detail,
  )
  const emptied = judgeDegradeSignal(RAG_SAMPLE, SPEC_RAG, { telemetry: false, carrierKeys: [] })
  ok(
    'J2 变异:掏空遥测判据后 rag 不得仍报 signaled',
    emptied.verdict !== 'signaled',
    emptied.verdict,
  )
  ok(
    'J2 变异:键集换成含 message 的坏判据 ⇒ mcp 必须翻档(证明判据吃键集)',
    judgeDegradeSignal(MCP_SAMPLE, SPEC_MCP, { degradeKeys: ['message'] }).verdict !==
      'silent-degrade',
  )

  // 3. 真实现场(默认 HEAD 面):必须判出 mcp 那一枚 silent-degrade,或如实报未判定 —— 不许冒绿
  const live = runAll({ repoRoot, usePython })
  const liveMcpJ1 = live.J1.items.find((i) => i.exit === 'mcp.search_codebase')
  const liveMcpJ2 = live.J2.items.find((i) => i.exit === 'mcp.search_codebase')
  const liveRagJ1 = live.J1.items.find((i) => i.exit === 'rag._retrieve')
  ok(
    '现场 J1 rag ⇒ dual-leg-fused(HEAD 面)',
    liveRagJ1?.shape === 'dual-leg-fused',
    liveRagJ1?.shape ?? 'undetermined',
  )
  ok(
    '现场 J1 mcp ⇒ serial-fallback(HEAD 面)',
    liveMcpJ1?.shape === 'serial-fallback',
    liveMcpJ1?.shape ?? 'undetermined',
  )
  ok(
    '现场 J2 mcp ⇒ silent-degrade 或未判定(两档之外即判据失灵)',
    liveMcpJ2 ? liveMcpJ2.verdict === 'silent-degrade' || liveMcpJ2.verdict === 'unjudged' : false,
    liveMcpJ2?.verdict ??
      live.J2.unjudged.find((u) => u.exit === 'mcp.search_codebase')?.reason ??
      'n/a',
  )

  // 4. 判据零复制锁:本文件代码面(注释/字符串/正则遮罩后)不得出现 RRF 公式形态
  const noFormula = selfCheckNoFormula()
  ok(
    '零公式复制:遮罩后的判据代码内无 1/(k+rank) 形态',
    noFormula.clean,
    noFormula.hit ? `命中 ${noFormula.hit}` : 'clean',
  )
  ok('python 桥只做 import+call(桥体内无算式)', pyBridgeIsCallOnly())
  ok(
    '加权档不引入第二套算式(用同腿重复计入表达权重)',
    /Array\(2\)\.fill\(toItems\(fx\.legs\.text\)\)/.test(runAll.toString()) &&
      /labels:\s*\['text',\s*'text',\s*'vector'\]/.test(runAll.toString()),
  )

  // 5. 融合差异:python 可用 ⇒ 判出且加权确有分歧;不可用 ⇒ 整档未判定(不许假绿)
  const scratch = mkScratch('retrieval-ruler-')
  try {
    const fixtureFile = path.join(scratch, 'fixture.json')
    writeFileSync(fixtureFile, JSON.stringify(DEFAULT_FIXTURE), 'utf8')
    const viaFile = runAll({
      fixture: loadFixture(fixtureFile),
      fixturePath: fixtureFile,
      repoRoot,
      usePython,
    })
    ok(
      'J3 --fixture 夹具读得进',
      viaFile.J3.fixture?.loadedFrom === fixtureFile,
      String(viaFile.J3.fixture?.loadedFrom),
    )
    ok(
      'J3 集合维不需 python 也必量到双腿都命中 = 2',
      viaFile.J3.collection?.inBoth === 2,
      String(viaFile.J3.collection?.inBoth),
    )
    if (viaFile.J3.status === 'judged') {
      const z = viaFile.J3.ranks.find(
        (r) => r.id === 'apps/ai-service/app/services/codebase_indexer.py',
      )
      ok(
        'J3 加权投影改变名次(仅向量第 1 名被关键词腿权重挤后)',
        (z?.rrfRank ?? 0) < (z?.wrrfRank ?? 0),
        `rrf=${z?.rrfRank} wrrf=${z?.wrrfRank}`,
      )
      ok(
        'J3 首个分歧位存在',
        viaFile.J3.topKSets.firstDifference !== null,
        JSON.stringify(viaFile.J3.topKSets.firstDifference),
      )
      ok(
        'J3 名次来源标记 = 真函数',
        /rrf_fuse\(真函数/.test(viaFile.J3.provenance.formula),
        viaFile.J3.provenance.implFile,
      )
    } else {
      ok(
        'J3 未判定时必须点名缺什么 + 退出码不得为 0',
        (viaFile.J3.missing?.length ?? 0) > 0 && viaFile.exitCode === 2,
        viaFile.J3.reason ?? '-',
      )
    }
    const noPy = runAll({ repoRoot, usePython: false })
    ok(
      'J3 --no-python ⇒ 名次维 unjudged 且 exit 2(不冒绿)',
      noPy.J3.status === 'unjudged' && noPy.exitCode === 2,
      noPy.J3.reason,
    )
  } finally {
    rmScratch(scratch, { bestEffort: true })
  }

  // 6. 对照侧:取证册读数解析 + 缺册时未判定(不许把数字硬编进判据)
  const cpDoc = readCounterpartParams({ docFace: readFileFace(EVIDENCE_DOC, { repoRoot }) })
  ok(
    'J4 对方读数 rrfK=60 / textWeight=2 / vectorWeight=1',
    cpDoc.rrfK === 60 && cpDoc.textWeight === 2 && cpDoc.vectorWeight === 1,
    cpDoc.literal,
  )
  ok(
    'J4 缺取证册 ⇒ face=undetermined(不硬编)',
    readCounterpartParams({ docFace: { ok: false, reason: 'no doc' } }).face === 'undetermined',
  )
  const cmpRows = compareParams(
    {
      ragDefaultK: 60,
      rerankerDefaultK: 60,
      kSourcesAgree: 'same',
      envName: 'RAG_RRF_K',
      envValue: null,
      legWeights: [],
      weightsAbsence: 'absent(等价 1:1)',
      fuseParams: ['rankings', 'k', 'labels', 'key_fn'],
    },
    cpDoc,
  )
  ok(
    'J4 腿权重维判 different、rrfK 维判 same',
    cmpRows.rows.find((r) => r.dim === 'textWeight')?.verdict === 'different' &&
      cmpRows.rows.find((r) => r.dim === 'rrfK')?.verdict === 'same',
    JSON.stringify(cmpRows.rows.map((r) => [r.dim, r.verdict])),
  )
  ok(
    'J4 对方 rrfK 缺失 ⇒ 该维 unjudged',
    compareParams(
      {
        ragDefaultK: 60,
        kSourcesAgree: 'same',
        legWeights: [],
        weightsAbsence: 'absent(等价 1:1)',
        envName: null,
        envValue: null,
      },
      { rrfK: null, textWeight: 2, vectorWeight: 1 },
    ).rows.find((r) => r.dim === 'rrfK')?.verdict === 'unjudged',
  )

  // 7. 退出码三态优先级:未判定 > 缺陷 > 绿;枚举 0 枚 ⇒ 未判定
  ok(
    'exit 优先级:有 unjudged 维 ⇒ 2',
    decideExit({ unjudgedDims: ['x'], J2: { defects: [{ exit: 'a' }] }, J1: { items: [{}] } }) ===
      2,
  )
  ok(
    'exit 优先级:无 unjudged 有缺陷 ⇒ 1',
    decideExit({ unjudgedDims: [], J2: { defects: [{ exit: 'a' }] }, J1: { items: [{}] } }) === 1,
  )
  ok(
    'exit 优先级:枚举 0 枚出口 ⇒ 2',
    decideExit({ unjudgedDims: [], J2: { defects: [] }, J1: { items: [] } }) === 2,
  )

  // 8. 只读自证:默认档不得写仓库树(本尺没有任何 writeFileSync 在 runAll 路径上)
  ok(
    'runAll 路径零写盘(写盘只在自测 scratch 内)',
    !/writeFileSync/.test(runAll.toString()),
    'clean',
  )

  let failed = 0
  for (const c of checks) {
    if (!c.pass) failed++
    process.stdout.write(`${c.pass ? '✓' : '✗'} ${c.name}${c.info ? `  — ${c.info}` : ''}\n`)
  }
  process.stdout.write(
    `self-test ${checks.length - failed}/${checks.length} 通过(现读;夹具全在 scratch 根,未碰真库)\n`,
  )
  return failed === 0
}

// =========================================================================
// CLI
// =========================================================================

function parseArgv(argv) {
  const opts = {
    mode: 'print',
    face: 'head',
    fixturePath: null,
    counterpartLive: null,
    usePython: true,
    pythonOverride: null,
    topK: null,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`${a} 缺参数值`)
      return argv[++i]
    }
    if (a === '--self-test') opts.mode = 'self-test'
    else if (a === '--json') opts.mode = 'json'
    else if (a === '--print') opts.mode = 'print'
    else if (a === '--face') opts.face = next()
    else if (a === '--worktree') opts.face = 'worktree'
    else if (a === '--fixture') opts.fixturePath = next()
    else if (a === '--counterpart-live')
      opts.counterpartLive = argv[i + 1] && !argv[i + 1].startsWith('--') ? next() : 'auto'
    else if (a === '--python') opts.pythonOverride = next()
    else if (a === '--no-python') opts.usePython = false
    else if (a === '--top') opts.topK = Number(next())
    else if (a === '--help' || a === '-h') opts.mode = 'help'
    else throw new Error(`未知参数: ${a}`)
  }
  if (opts.fixturePath) {
    try {
      opts.fixture = loadFixture(opts.fixturePath)
    } catch (e) {
      throw new Error(`夹具取不到: ${e.message}`)
    }
  }
  return opts
}

function loadFixture(p) {
  const j = JSON.parse(readFileSync(p, 'utf8'))
  if (!j.legs || !Array.isArray(j.legs.text) || !Array.isArray(j.legs.vector)) {
    throw new Error(
      '夹具必须形如 {"query":str,"topK":int,"legs":{"text":[{id}…],"vector":[{id}…]}}',
    )
  }
  return j
}

async function main() {
  const opts = parseArgv(process.argv.slice(2))
  if (opts.mode === 'help') {
    process.stdout.write(
      [
        '用法: node scripts/check-retrieval-quality.mjs [--print|--json|--self-test]',
        '可选: --face head|worktree  --fixture <file>  --counterpart-live[=<bundle.mjs>]',
        '      --python <exe>  --no-python  --top <N>',
        '只读尺:不写仓库树 / 不改参数 / 不连真库(PG 8810·Redis 8811)/ 不进提交链。',
        '退出码:0 判定完成且无 silent-degrade · 1 判出 silent-degrade · 2 未判定或用法错。',
      ].join('\n') + '\n',
    )
    return 0
  }
  if (opts.mode === 'self-test') return (await selfTest({ repoRoot: ROOT })) ? 0 : 1
  let report
  try {
    report = runAll(opts)
  } catch (e) {
    process.stderr.write(
      `❌ 尺子自身异常(记未判定,不冒绿): ${e?.message ?? e}\n${e?.stack ?? ''}\n`,
    )
    return 2
  }
  if (opts.mode === 'json') process.stdout.write(JSON.stringify(report, null, 2) + '\n')
  else process.stdout.write(render(report) + '\n')
  return report.exitCode
}

export const __test__ = {
  EXITS,
  DEGRADE_KEY_SET,
  DEFAULT_FIXTURE,
  EVIDENCE_DOC,
  PY_BRIDGE,
  RAG_SAMPLE,
  MCP_SAMPLE,
  MCP_SAMPLE_WITH_KEY,
  SPEC_RAG,
  SPEC_MCP,
  readFileFace,
  gitShow,
  pythonCandidates,
  fuseViaPython,
  extractFunctionBody,
  extractExceptBlocks,
  extractReturnDictKeys,
  splitTopLevel,
  classifyShape,
  judgeDegradeSignal,
  collectionDims,
  fusionDiff,
  readRepoRrfConfig,
  readCounterpartParams,
  compareParams,
  runAll,
  decideExit,
  render,
  parseArgv,
  loadFixture,
  selfCheckNoFormula,
  pyBridgeIsCallOnly,
  selfTest,
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main()
    .then((code) => process.exit(code))
    .catch((e) => {
      process.stderr.write(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}\n`)
      process.exit(2)
    })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
