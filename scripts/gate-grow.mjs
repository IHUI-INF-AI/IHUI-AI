#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 本工具是候选生成器,机器读数必须走 stdout */
/**
 * gate-grow — 守门规则自生长的**候选生成器**(不是自动落地器)。
 *
 * 立因(台账 2026-10-25「可守门规则自生长」):新模块(apps/* / packages/*)出现后,
 * 没有人会记得去 guardian-runner 里补一道**模块定向**的守门项。缺口的形态不是报错,
 * 而是"这个模块从没被任何门按名字看过"—— 与 check-gate-rot 的静默失效同族。
 *
 * 本器只做三件事:
 *  1. 读注册表(scripts/guardian-runner.mjs)里已登记的 `{ id, label, script, args, mode, stagedTriggers }`
 *     形状,按 stagedTriggers 的**路径前缀**判定模块归属;
 *  2. 枚举 apps/*、packages/*(只收有 package.json 的真实模块),给每个模块判三态:
 *     `covered`(已有)/ `missing`(缺失)/ `undetermined`(未判定);
 *  3. `--candidates` 只读产出候选守门项 JSON 到 state;`--apply` 才允许写单一真源,
 *     且必须同时具备 --human-approved 与 IHUI_GATE_GROW_APPLY=1 两把钥匙。
 *
 * 归属判据刻意收窄(不做模糊匹配):
 *  - 只有 stagedTriggers 落在模块路径之内(`apps/x` 或 `apps/x/...`)才算**模块定向覆盖**;
 *  - `apps/`、`packages/`、`packages` 下的全仓 ts glob 这类触发面**不算**模块覆盖 ——
 *    把它们算进来会让每个模块都显示"已有",候选清单永远为空,自生长就退化成了摆设;
 *  - 注释、label 散文、脚本名一律不作归属证据(散文不是接线声明)。
 *
 * 结构性边界(必须让读报告的人先看到):
 *  `scripts/lib/judgement-libs.json` 的真实形状是**判据库路径字符串数组**,不是守门项注册表;
 *  守门项的真实注册表是 `scripts/guardian-runner.mjs`(本席无权改)。所以本器产出的候选
 *  `gate` 只能作为"人工去注册表补项"的提案,`--apply` 仅可把候选里显式列出的
 *  `singleSource.libs`(判据库路径)合并进 judgement-libs.json,绝不写注册表。
 *  候选默认 `libs=[]` —— 没有可解释的判据库路径时不硬凑,宁可让 --apply 报"无可写"。
 *
 * 三态口径(§0.3:没判不许写成判过):
 *  - 注册表读不到 / 一枚条目都抽不出 / 有条目形状不可解析 ⇒ 所有模块 `undetermined`;
 *  - 只有可解析且带模块路径触发面的条目 ⇒ `covered`;
 *  - 注册表可解析、但该模块没有任何定向触发面 ⇒ `missing`。
 *
 * 用法:
 *   node scripts/gate-grow.mjs --list
 *   node scripts/gate-grow.mjs --candidates
 *   node scripts/gate-grow.mjs --apply --human-approved=<工单号或人签名>
 *   node scripts/gate-grow.mjs --self-test
 *   (可选 --root <path> 指向夹具仓,只影响读取/写入落点)
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

export const REGISTRY_PATH = 'scripts/guardian-runner.mjs'
export const SINGLE_SOURCE_PATH = 'scripts/lib/judgement-libs.json'
export const APPLY_ENV = 'IHUI_GATE_GROW_APPLY'
export const MODULE_ROOTS = Object.freeze(['apps', 'packages'])
export const MODES = Object.freeze(['blocking', 'warn', 'info'])
export const CANDIDATE_SCHEMA_VERSION = 1

export const candidateFileOf = (root) => join(root, '.ihui-agent', 'state', 'gate-grow-candidates.json')
export const backupFileOf = (root) => join(root, '.ihui-agent', 'state', 'judgement-libs.bak.json')

const KNOWN_FIELDS = new Set([
  'id',
  'label',
  'script',
  'args',
  'mode',
  'skipEnv',
  'onFailHint',
  'stagedTriggers',
])

/** 注册表形状漂了(数组没闭合 / 一枚条目抽不出 / 条目缺关键字段)时抛它。 */
export class RegistryShapeError extends Error {}

/** 去掉行注释,但保留字符串里的 `//`(URL、提示文案里的斜杠)。扫描器按引号状态分段。 */
export function stripLineComments(text) {
  return String(text ?? '')
    .split(/\r?\n/)
    .map((line) => {
      let quote = ''
      for (let i = 0; i < line.length; i += 1) {
        const ch = line[i]
        if (quote) {
          if (ch === '\\') i += 1
          else if (ch === quote) quote = ''
          continue
        }
        if (ch === "'" || ch === '"' || ch === '`') {
          quote = ch
          continue
        }
        if (ch === '/' && line[i + 1] === '/') return line.slice(0, i)
      }
      return line
    })
    .join('\n')
}

/**
 * 把一个对象字面量的字段切成 Map。
 * 只按**顶层逗号**切,并跳过引号、方括号/花括号/圆括号内部 ——
 * 这样 label 里的逗号、onFailHint 数组里的逗号都不会把字段切断。
 */
export function splitFields(text) {
  const src = stripLineComments(text)
  const fields = new Map()
  const cuts = []
  let quote = ''
  let depth = 0
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i]
    if (quote) {
      if (ch === '\\') i += 1
      else if (ch === quote) quote = ''
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch
      continue
    }
    if (ch === '[' || ch === '{' || ch === '(') depth += 1
    else if (ch === ']' || ch === '}' || ch === ')') depth -= 1
    else if (ch === ',' && depth === 0) cuts.push(i)
  }
  const pieces = []
  let prev = 0
  for (const cut of cuts) {
    pieces.push(src.slice(prev, cut))
    prev = cut + 1
  }
  pieces.push(src.slice(prev))
  for (const piece of pieces) {
    const m = piece.match(/^\s*(?:\.\.\.\s*)?([A-Za-z_$][\w$]*)\s*:/)
    if (!m || !KNOWN_FIELDS.has(m[1])) continue
    fields.set(m[1], piece.slice(m[0].length))
  }
  return fields
}

function quotedStrings(block) {
  const out = []
  const re = /'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)"/g
  let m
  while ((m = re.exec(String(block ?? ''))) !== null) {
    out.push((m[1] ?? m[2] ?? '').replace(/\\(['"\\])/g, '$1'))
  }
  return out
}

function firstString(block) {
  return quotedStrings(block)[0] ?? ''
}

/** 解析单个守门项。`malformed` 非空 ⇒ 整份注册表判未判定(不猜)。 */
export function parseEntry(text, line = 0, extraProblem = '') {
  const fields = splitFields(text)
  const id = firstString(fields.get('id'))
  const label = quotedStrings(fields.get('label')).join('')
  const script = firstString(fields.get('script'))
  const mode = firstString(fields.get('mode'))
  const args = quotedStrings(fields.get('args'))
  const stagedTriggers = quotedStrings(fields.get('stagedTriggers'))
  const problems = []
  if (extraProblem) problems.push(extraProblem)
  if (!id.trim()) problems.push('缺 id')
  if (!script.trim()) problems.push('缺 script')
  if (!MODES.includes(mode)) problems.push(`mode 非法(${mode || '空'})`)
  return { id, label, script, mode, args, stagedTriggers, line, malformed: problems }
}

/**
 * 从 `const checks = [` / `const pushGateChecks = [` 两个数组体里切条目。
 * 条目既有两行式(常见),也有单行式(注册表里真实存在 3 条),两种都必须认。
 */
export function parseEntryBlocks(bodyLines) {
  const entries = []
  let buf = null
  bodyLines.forEach((line, idx) => {
    if (!buf) {
      const m = line.match(/^  \{(.*)$/)
      if (!m) return
      const rest = m[1]
      const close = rest.lastIndexOf('}')
      if (close >= 0 && /^\s*,?\s*(?:\/\/.*)?$/.test(rest.slice(close + 1))) {
        entries.push(parseEntry(rest.slice(0, close), idx + 1))
        return
      }
      buf = { lines: rest.trim() ? [rest] : [], line: idx + 1 }
      return
    }
    if (/^  \},?\s*(?:\/\/.*)?$/.test(line)) {
      entries.push(parseEntry(buf.lines.join('\n'), buf.line))
      buf = null
      return
    }
    buf.lines.push(line)
  })
  if (buf) entries.push(parseEntry(buf.lines.join('\n'), buf.line, '条目未闭合'))
  return entries
}

/** 抽出注册表两个数组里的全部守门项;零条目 / 数组未闭合 ⇒ throw。 */
export function parseRegistrySource(src) {
  const lines = String(src ?? '').split(/\r?\n/)
  const arrays = []
  const entries = []
  let i = 0
  while (i < lines.length) {
    const m = lines[i].match(/^const\s+(checks|pushGateChecks)\s*=\s*\[\s*$/)
    if (!m) {
      i += 1
      continue
    }
    const name = m[1]
    const body = []
    let closed = false
    for (i += 1; i < lines.length; i += 1) {
      // 外层数组的闭合只认**列 0** 的 `]`;条目内 onFailHint 的 `    ]` 缩进闭合不是边界。
      if (/^\]\s*$/.test(lines[i])) {
        closed = true
        break
      }
      body.push(lines[i])
    }
    if (!closed) throw new RegistryShapeError(`注册表数组 ${name} 未闭合(格式已漂,不猜)`)
    const parsed = parseEntryBlocks(body)
    arrays.push({ name, count: parsed.length })
    for (const entry of parsed) entries.push({ ...entry, array: name })
  }
  if (entries.length === 0) throw new RegistryShapeError('注册表一枚守门项都抽不出(格式已漂,不猜)')
  return { entries, arrays }
}

/** 读 + 解析注册表。任何一步失败都记 `undetermined`,绝不回落成"无条目 ⇒ 全缺失/全覆盖"。 */
export function readRegistry(root = ROOT, readFile = (p) => readFileSync(p, 'utf8')) {
  let text
  try {
    text = readFile(join(root, REGISTRY_PATH))
  } catch (e) {
    return { status: 'undetermined', why: `注册表读不到(${REGISTRY_PATH}):${e?.message ?? e}`, entries: [] }
  }
  let parsed
  try {
    parsed = parseRegistrySource(text)
  } catch (e) {
    return { status: 'undetermined', why: e?.message ?? String(e), entries: [] }
  }
  const broken = parsed.entries.filter((e) => e.malformed.length > 0)
  if (broken.length) {
    const detail = broken
      .slice(0, 3)
      .map((e) => `#${e.id || '?'}@${e.line}:${e.malformed.join('/')}`)
      .join(' ; ')
    return {
      status: 'undetermined',
      why: `注册表 ${broken.length} 项形状不可解析(${detail})`,
      entries: parsed.entries,
      arrays: parsed.arrays,
    }
  }
  return { status: 'ok', entries: parsed.entries, arrays: parsed.arrays, why: null }
}

/**
 * 触发面归一化。只去尾部通配符与斜杠,不做任何"看起来像"的推断:
 *  `apps/mobile-rn/**` → `apps/mobile-rn`(模块定向)
 *  `apps/` → `apps`(全仓,不覆盖任何具体模块)
 *  `packages/**\/*.ts` → 保持原样(不以任何模块路径为前缀)
 */
export function normalizeTrigger(trigger) {
  let t = String(trigger ?? '')
    .trim()
    .replace(/\\/g, '/')
  if (!t) return ''
  t = t.replace(/\/*$/, '')
  t = t.replace(/\/\*+$/, '')
  return t
}

/** 枚举真实模块根(只收有 package.json 的目录;点目录不算模块)。 */
export function listModules(root = ROOT, io = {}) {
  const readdir = io.readdir ?? readdirSync
  const exists = io.exists ?? existsSync
  const modules = []
  for (const scope of MODULE_ROOTS) {
    let dirs
    try {
      dirs = readdir(join(root, scope), { withFileTypes: true })
    } catch (e) {
      return { status: 'undetermined', modules, why: `模块根读不到(${scope}/):${e?.message ?? e}` }
    }
    for (const dir of dirs) {
      const isDir = typeof dir.isDirectory === 'function' ? dir.isDirectory() : Boolean(dir.isDirectory)
      if (!isDir || String(dir.name).startsWith('.')) continue
      const rel = `${scope}/${dir.name}`
      if (!exists(join(root, rel, 'package.json'))) continue
      modules.push({ path: rel, name: dir.name, kind: scope === 'apps' ? 'app' : 'package' })
    }
  }
  modules.sort((a, b) => a.path.localeCompare(b.path))
  return { status: 'ok', modules, why: null }
}

/** 三态判定内核:只有注册表可解析 + 有模块路径触发面才算 covered。 */
export function judgeModules(modules, registry) {
  const list = Array.isArray(modules) ? modules : []
  if (!registry || registry.status !== 'ok') {
    const why = registry?.why ?? '注册表形状不可解析'
    return list.map((m) => ({ ...m, status: 'undetermined', evidence: [], why }))
  }
  return list.map((m) => {
    const evidence = []
    for (const entry of registry.entries) {
      for (const trigger of entry.stagedTriggers) {
        const normalized = normalizeTrigger(trigger)
        if (!normalized) continue
        if (normalized === m.path || normalized.startsWith(`${m.path}/`)) {
          evidence.push({ id: entry.id, script: entry.script, trigger })
        }
      }
    }
    return {
      ...m,
      status: evidence.length ? 'covered' : 'missing',
      evidence,
      why: evidence.length
        ? `命中 ${evidence.length} 条模块定向触发面`
        : '注册表无任何以该模块路径为前缀的 stagedTriggers(全仓 apps/、packages/ 触发面不计入模块覆盖)',
    }
  })
}

export function emptyCounts() {
  return { total: 0, covered: 0, missing: 0, undetermined: 0 }
}

export function countModules(modules) {
  const counts = emptyCounts()
  counts.total = modules.length
  for (const m of modules) {
    if (m.status === 'covered') counts.covered += 1
    else if (m.status === 'missing') counts.missing += 1
    else counts.undetermined += 1
  }
  return counts
}

/** 全量读数:模块枚举 + 注册表解析 + 三态判定。任一环节判不了 ⇒ 整体 undetermined。 */
export function audit(root = ROOT, io = {}) {
  const readFile = io.readFile ?? ((p) => readFileSync(p, 'utf8'))
  const modulesRes = listModules(root, io)
  const registry = readRegistry(root, readFile)
  if (modulesRes.status !== 'ok') {
    return {
      status: 'undetermined',
      modules: [],
      counts: emptyCounts(),
      registry: { status: registry.status, entries: registry.entries.length, why: registry.why ?? null },
      why: modulesRes.why,
    }
  }
  const modules = judgeModules(modulesRes.modules, registry)
  return {
    status: modules.some((m) => m.status === 'undetermined') ? 'undetermined' : 'ok',
    modules,
    counts: countModules(modules),
    registry: {
      status: registry.status,
      entries: registry.entries.length,
      arrays: registry.arrays ?? [],
      why: registry.why ?? null,
    },
    why: null,
  }
}

/** 候选守门项:字段形状逐字照注册表真实条目;`singleSource.libs` 默认空,拒绝硬凑。 */
export function candidateFor(module, root = ROOT, exists = existsSync) {
  const slug = String(module.name).replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase()
  const gate = {
    id: `cand-${slug}-module-scope`,
    label: `🧱 [${module.name}] 模块定向守门(候选,待人工登记)`,
    script: `check-module-${slug}.mjs`,
    args: [],
    mode: 'warn',
    stagedTriggers: [`${module.path}/`],
  }
  return {
    module: module.path,
    moduleKind: module.kind,
    status: 'missing',
    why: module.why ?? '无模块定向触发面',
    gate,
    scriptExists: exists(join(root, 'scripts', gate.script)),
    singleSource: {
      file: SINGLE_SOURCE_PATH,
      libs: [],
      why: '候选是守门注册表项;judgement-libs.json 只承接判据库路径,不承接注册表项(结构性边界,需人工另开注册表改动)',
    },
  }
}

export function buildCandidates(result, root = ROOT, exists = existsSync) {
  return (result.modules ?? [])
    .filter((m) => m.status === 'missing')
    .map((m) => candidateFor(m, root, exists))
}

/** 候选形状校验:缺字段/字段类型错/触发面不在模块内/判据库路径非法 都逐条点名。 */
export function validateCandidate(candidate) {
  const problems = []
  if (!candidate || typeof candidate !== 'object') return ['候选不是对象']
  const modulePath = String(candidate.module ?? '')
  if (!/^(apps|packages)\/[^/]+$/.test(modulePath)) problems.push(`module 非法:${modulePath || '空'}`)
  const gate = candidate.gate
  if (!gate || typeof gate !== 'object') {
    problems.push('缺 gate 对象')
  } else {
    if (typeof gate.id !== 'string' || !gate.id.trim()) problems.push('gate.id 为空')
    if (typeof gate.label !== 'string' || !gate.label.trim()) problems.push('gate.label 为空')
    if (typeof gate.script !== 'string' || !gate.script.endsWith('.mjs')) problems.push('gate.script 非 .mjs')
    if (!Array.isArray(gate.args) || gate.args.some((x) => typeof x !== 'string')) {
      problems.push('gate.args 必须是字符串数组')
    }
    if (!MODES.includes(gate.mode)) problems.push(`gate.mode 非法:${String(gate.mode)}`)
    if (!Array.isArray(gate.stagedTriggers) || gate.stagedTriggers.length === 0) {
      problems.push('gate.stagedTriggers 必须是非空数组')
    } else if (
      !gate.stagedTriggers.every(
        (t) =>
          typeof t === 'string' &&
          (normalizeTrigger(t) === modulePath || normalizeTrigger(t).startsWith(`${modulePath}/`)),
      )
    ) {
      problems.push('gate.stagedTriggers 未落在 module 路径内')
    }
  }
  const source = candidate.singleSource
  if (!source || source.file !== SINGLE_SOURCE_PATH || !Array.isArray(source.libs)) {
    problems.push('singleSource 必须指向 judgement-libs.json 且含 libs 数组')
  } else if (
    source.libs.some(
      (lib) => typeof lib !== 'string' || !lib.startsWith('scripts/lib/') || !lib.endsWith('.mjs'),
    )
  ) {
    problems.push('singleSource.libs 含非 scripts/lib/*.mjs 路径')
  }
  return problems
}

/** 人工阀双开关:缺任一侧都不放行。 */
export function humanValve({ approved, env } = {}) {
  const reasons = []
  if (typeof approved !== 'string' || !approved.trim()) reasons.push('缺 --human-approved=<工单号或人签名>')
  if (String(env ?? '') !== '1') reasons.push(`环境变量 ${APPLY_ENV} 未设为 1`)
  return {
    ok: reasons.length === 0,
    reasons,
    message: [
      '⛔ 人工阀未开:--apply 会写 scripts/lib/judgement-libs.json(单一真源,在根护栏清单内)。',
      '   必须同时满足:',
      '   ① --human-approved=<工单号或人签名>',
      `   ② 环境变量 ${APPLY_ENV}=1`,
      '   缺任一侧即拒绝;通过后写前会备份到 .ihui-agent/state/judgement-libs.bak.json。',
    ].join('\n'),
  }
}

/**
 * 只把候选显式列出的判据库路径合并进单一真源。
 * 先读后写;任何 lib 不在盘上 ⇒ throw(拒绝往清单里塞一条必然腐烂的路径);
 * 实际有新增时才备份,备份是**字节拷贝**(与 git 面同值)。
 */
export function applyLibs({ root = ROOT, libs, io = {} }) {
  const readFile = io.readFile ?? ((p) => readFileSync(p, 'utf8'))
  const writeFile = io.writeFile ?? ((p, data) => writeFileSync(p, data, 'utf8'))
  const copyFile = io.copyFile ?? copyFileSync
  const exists = io.exists ?? existsSync
  const file = join(root, SINGLE_SOURCE_PATH)
  const backupFile = backupFileOf(root)
  const before = readFile(file)
  let doc
  try {
    doc = JSON.parse(before)
  } catch (e) {
    throw new Error(`judgement-libs JSON 解析失败:${e?.message ?? e}`)
  }
  if (!Array.isArray(doc) || doc.length === 0) throw new Error('judgement-libs 必须是非空数组')
  const clean = [...new Set((libs ?? []).map((x) => String(x).trim()).filter(Boolean))]
  const missing = clean.filter((lib) => !exists(join(root, lib)))
  if (missing.length) throw new Error(`判据库路径不在盘上(拒绝写入腐烂引用):${missing.join(' , ')}`)
  const added = clean.filter((lib) => !doc.includes(lib))
  if (!added.length) return { changed: false, added: [], file, backupFile }
  mkdirSync(dirname(backupFile), { recursive: true })
  copyFile(file, backupFile)
  writeFile(file, `${JSON.stringify([...doc, ...added], null, 2)}\n`)
  return { changed: true, added, file, backupFile }
}

export function parseArgs(argv) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (!a.startsWith('--')) {
      out._.push(a)
      continue
    }
    const key = a.slice(2)
    const eq = key.indexOf('=')
    if (eq >= 0) {
      out[key.slice(0, eq)] = key.slice(eq + 1)
      continue
    }
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) {
      out[key] = true
      continue
    }
    out[key] = next
    i += 1
  }
  return out
}

const STATUS_LABEL = { covered: '已有', missing: '缺失', undetermined: '未判定' }
const STATUS_ICON = { covered: '✅', missing: '⚠️', undetermined: '❓' }

function cmdList(root) {
  const result = audit(root)
  console.log(
    `模块三态:共 ${result.counts.total} / ${STATUS_LABEL.covered} ${result.counts.covered} / ` +
      `${STATUS_LABEL.missing} ${result.counts.missing} / ${STATUS_LABEL.undetermined} ${result.counts.undetermined}`,
  )
  console.log(`注册表:${result.registry.status}(条目 ${result.registry.entries})`)
  if (result.why) console.log(`❓ 未判定:${result.why}`)
  for (const m of result.modules) {
    const icon = STATUS_ICON[m.status] ?? '❓'
    const label = STATUS_LABEL[m.status] ?? m.status
    const detail =
      m.status === 'covered'
        ? ` ← ${m.evidence.map((e) => `#${e.id}:${e.trigger}`).join(' , ')}`
        : m.status === 'missing'
          ? ''
          : ` ← ${m.why}`
    console.log(`${icon} ${label} ${m.path}${detail}`)
  }
  if (result.status === 'undetermined') console.log('❓ 有模块判不了,不记绿')
  return result.status === 'undetermined' ? 2 : 0
}

function cmdCandidates(root) {
  const result = audit(root)
  if (result.status === 'undetermined') {
    console.log(`❓ 未判定:${result.why ?? result.modules.find((m) => m.status === 'undetermined')?.why}`)
    console.log('   注册表判不了 ⇒ 拒绝产出候选(判不了的面不得被当成"缺门"或"已有")')
    return 2
  }
  const candidates = buildCandidates(result, root)
  const problems = candidates.flatMap((c, i) =>
    validateCandidate(c).map((p) => `[${i}] ${c.module}:${p}`),
  )
  if (problems.length) {
    console.log(`❌ 候选形状自检失败 ${problems.length} 条`)
    for (const p of problems) console.log(`  - ${p}`)
    return 1
  }
  const payload = {
    v: CANDIDATE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    registry: { path: REGISTRY_PATH, ...result.registry },
    counts: result.counts,
    candidates,
  }
  const file = candidateFileOf(root)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  console.log(`候选 ${candidates.length} 条 ⇒ ${file}`)
  console.log('前 3 条:')
  console.log(JSON.stringify(candidates.slice(0, 3), null, 2))
  console.log('ℹ 本命令只写候选文件,不碰 scripts/lib/judgement-libs.json、不碰注册表。')
  return 0
}

function cmdApply(root, args) {
  const valve = humanValve({ approved: args['human-approved'], env: process.env[APPLY_ENV] })
  if (!valve.ok) {
    console.log(valve.message)
    for (const r of valve.reasons) console.log(`   - ${r}`)
    return 2
  }
  const result = audit(root)
  if (result.status === 'undetermined') {
    console.log(`❓ 未判定:${result.why ?? '注册表形状不可解析'} ⇒ 拒绝写单一真源`)
    return 2
  }
  const file = typeof args.candidates === 'string' ? args.candidates : candidateFileOf(root)
  let payload
  try {
    payload = JSON.parse(readFileSync(file, 'utf8'))
  } catch (e) {
    console.log(`❌ 读不到候选清单(${file}):${e?.message ?? e}`)
    console.log('   先跑 node scripts/gate-grow.mjs --candidates')
    return 2
  }
  const candidates = Array.isArray(payload?.candidates) ? payload.candidates : []
  if (!candidates.length) {
    console.log('❌ 候选清单为空,拒绝推进(没有可人工复核的扩展面)')
    return 2
  }
  const problems = candidates.flatMap((c, i) =>
    validateCandidate(c).map((p) => `[${i}] ${c.module ?? '?'}:${p}`),
  )
  if (problems.length) {
    console.log(`❌ 候选形状校验失败 ${problems.length} 条`)
    for (const p of problems) console.log(`  - ${p}`)
    return 2
  }
  const libs = [...new Set(candidates.flatMap((c) => c.singleSource.libs))]
  if (!libs.length) {
    console.log('✅ 人工阀已过;但候选均未给出判据库路径(singleSource.libs 为空)。')
    console.log('   结构性边界:候选是守门注册表项,judgement-libs.json 只承接判据库路径。')
    console.log('   ⇒ 本次未改动 scripts/lib/judgement-libs.json,请人工到注册表补项。')
    return 0
  }
  try {
    const res = applyLibs({ root, libs })
    if (!res.changed) {
      console.log(`ℹ 判据库已覆盖 ${libs.length} 条路径,无新增 ⇒ 未改动单一真源`)
    } else {
      console.log(`✅ 已写单一真源:新增 ${res.added.length} 条(${res.added.join(' , ')})`)
      console.log(`   备份:${res.backupFile}`)
    }
  } catch (e) {
    console.log(`❌ 写单一真源失败:${e?.message ?? e}`)
    return 2
  }
  return 0
}

function printHelp() {
  console.log(
    [
      'gate-grow — 守门规则自生长候选生成器',
      '',
      '  --list                  模块清单 + 三态(已有/缺失/未判定)',
      '  --candidates            只读产出候选 JSON → .ihui-agent/state/gate-grow-candidates.json',
      '  --apply                 写单一真源(需 --human-approved 且 IHUI_GATE_GROW_APPLY=1)',
      '  --self-test             判据内核自检',
      '  --root <path>           夹具仓根(可选)',
    ].join('\n'),
  )
}

function selfTest() {
  const checks = []
  const t = (name, fn) => {
    try {
      fn()
      checks.push({ name, ok: true })
    } catch (e) {
      checks.push({ name, ok: false, why: e?.message ?? String(e) })
    }
  }

  t('注册表解析:两个数组 + 多行/单行条目都能抽', () => {
    const src = [
      'const checks = [',
      '  {',
      "    id: '1',",
      "    label: 'x',",
      "    script: 'check-a.mjs',",
      "    args: [],",
      "    mode: 'blocking',",
      "    stagedTriggers: ['apps/a/src/'],",
      '    onFailHint: [',
      "      '',",
      '    ]',
      '  },',
      "  { id: '2', label: 'y,z', script: 'check-b.mjs', args: ['--target=a'], mode: 'warn', stagedTriggers: ['apps/b/**'] },",
      ']',
      'const pushGateChecks = [',
      '  {',
      "    id: 'T1',",
      "    label: 't',",
      "    script: 'check-t.mjs',",
      "    args: [],",
      "    mode: 'blocking',",
      '  },',
      ']',
    ].join('\n')
    const parsed = parseRegistrySource(src)
    if (parsed.entries.length !== 3) throw new Error(`抽到 ${parsed.entries.length} 条`)
    const a = parsed.entries.find((e) => e.id === '1')
    if (!a || a.stagedTriggers[0] !== 'apps/a/src/' || a.args.length !== 0) throw new Error('多行条目解析错')
    const b = parsed.entries.find((e) => e.id === '2')
    if (!b || b.label !== 'y,z' || b.args[0] !== '--target=a') throw new Error('单行条目解析错')
    if (parsed.arrays.length !== 2) throw new Error('数组计数错')
  })
  t('注册表解析:零条目/未闭合 ⇒ RegistryShapeError', () => {
    for (const bad of ['const checks = []', 'const checks = [\n  {\n    id: \'1\',']) {
      let hit = false
      try {
        parseRegistrySource(bad)
      } catch (e) {
        hit = e instanceof RegistryShapeError
      }
      if (!hit) throw new Error('未拒绝坏注册表')
    }
  })
  t('触发面归一化:模块定向 vs 全仓不混算', () => {
    if (normalizeTrigger('apps/mobile-rn/**') !== 'apps/mobile-rn') throw new Error('通配未归一')
    if (normalizeTrigger('apps/ai-service/') !== 'apps/ai-service') throw new Error('尾斜杠未归一')
    if (normalizeTrigger('apps/') !== 'apps') throw new Error('全仓面归一错')
    if (normalizeTrigger('packages/**/*.ts') !== 'packages/**/*.ts') throw new Error('glob 面被误改')
  })
  t('三态判定:定向触发面=已有;无定向=缺失;注册表坏=全未判定', () => {
    const modules = [
      { path: 'apps/a', name: 'a', kind: 'app' },
      { path: 'packages/b', name: 'b', kind: 'package' },
    ]
    const ok = {
      status: 'ok',
      entries: [{ id: '1', script: 'check-a.mjs', stagedTriggers: ['apps/a/src/'] }],
    }
    const judged = judgeModules(modules, ok)
    if (judged[0].status !== 'covered') throw new Error(`a=${judged[0].status}`)
    if (judged[1].status !== 'missing') throw new Error(`b=${judged[1].status}`)
    const broad = judgeModules(modules, {
      status: 'ok',
      entries: [{ id: '2', script: 'check-all.mjs', stagedTriggers: ['apps/', 'packages/**/*.ts'] }],
    })
    if (broad.some((m) => m.status !== 'missing')) throw new Error('全仓触发面被算成模块覆盖')
    const bad = judgeModules(modules, { status: 'undetermined', why: 'x' })
    if (bad.some((m) => m.status !== 'undetermined')) throw new Error('坏注册表未判未判定')
  })
  t('候选形状:合法候选通过;改 mode/触发面/判据库路径都点名', () => {
    const c = candidateFor({ path: 'apps/a', name: 'a', kind: 'app' })
    if (validateCandidate(c).length !== 0) throw new Error(validateCandidate(c).join(';'))
    const badMode = JSON.parse(JSON.stringify(c))
    badMode.gate.mode = 'always'
    if (!validateCandidate(badMode).some((p) => p.includes('mode'))) throw new Error('未拦非法 mode')
    const badTrigger = JSON.parse(JSON.stringify(c))
    badTrigger.gate.stagedTriggers = ['apps/other/']
    if (!validateCandidate(badTrigger).some((p) => p.includes('未落在 module'))) throw new Error('未拦越界触发面')
    const badLib = JSON.parse(JSON.stringify(c))
    badLib.singleSource.libs = ['scripts/not-lib.mjs']
    if (!validateCandidate(badLib).some((p) => p.includes('scripts/lib'))) throw new Error('未拦非法判据库路径')
  })
  t('人工阀:双开关四格里只有全开才 ok', () => {
    const cases = [
      [{ approved: '', env: '1' }, false],
      [{ approved: '工单-1', env: '' }, false],
      [{ approved: '', env: '' }, false],
      [{ approved: '工单-1', env: '1' }, true],
    ]
    for (const [input, expected] of cases) {
      if (humanValve(input).ok !== expected) throw new Error(`阀判定错:${JSON.stringify(input)}`)
    }
  })
  t('写单一真源:有新增才备份;备份与写前字节同值;重复写不二次备份', () => {
    const base = join(ROOT, '.ihui-agent', 'tmp', 'gate-grow-seat')
    mkdirSync(base, { recursive: true })
    const dir = mkdtempSync(join(base, 'selftest-'))
    try {
      mkdirSync(join(dir, 'scripts', 'lib'), { recursive: true })
      const before = '[\n  "scripts/lib/a.mjs"\n]\n'
      writeFileSync(join(dir, SINGLE_SOURCE_PATH), before, 'utf8')
      writeFileSync(join(dir, 'scripts', 'lib', 'a.mjs'), '// a\n', 'utf8')
      writeFileSync(join(dir, 'scripts', 'lib', 'b.mjs'), '// b\n', 'utf8')
      const res = applyLibs({ root: dir, libs: ['scripts/lib/b.mjs'] })
      if (!res.changed || res.added.length !== 1) throw new Error('未写入新增')
      const backup = readFileSync(backupFileOf(dir), 'utf8')
      if (backup !== before) throw new Error('备份与写前字节不一致')
      const after = JSON.parse(readFileSync(join(dir, SINGLE_SOURCE_PATH), 'utf8'))
      if (!after.includes('scripts/lib/b.mjs') || !after.includes('scripts/lib/a.mjs')) throw new Error('合并结果错')
      const again = applyLibs({ root: dir, libs: ['scripts/lib/b.mjs'] })
      if (again.changed) throw new Error('重复写仍报新增')
      writeFileSync(join(dir, 'scripts', 'lib', 'gone.mjs'), '// x\n', 'utf8')
      let threw = false
      try {
        applyLibs({ root: dir, libs: ['scripts/lib/nope.mjs'] })
      } catch {
        threw = true
      }
      if (!threw) throw new Error('不存在的判据库路径未被拒绝')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
  t('全量读数:注册表读不到 ⇒ 模块仍枚举,但三态全未判定', () => {
    const nd = (p) => String(p).replace(/\\/g, '/')
    const io = {
      readdir: (p) => (nd(p).endsWith('/apps') ? [{ name: 'a', isDirectory: () => true }] : []),
      exists: (p) => nd(p).endsWith('/apps/a/package.json'),
      readFile: () => {
        throw new Error('ENOENT')
      },
    }
    const r = audit('/fixture', io)
    if (r.counts.total !== 1) throw new Error(`total=${r.counts.total}`)
    if (r.counts.undetermined !== 1) throw new Error(`undetermined=${r.counts.undetermined}`)
    if (r.status !== 'undetermined') throw new Error(`status=${r.status}`)
  })

  for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.ok ? '' : ` — ${c.why}`}`)
  const bad = checks.filter((c) => !c.ok)
  console.log(`# self-test ${checks.length - bad.length}/${checks.length}`)
  return bad.length === 0 ? 0 : 1
}

function main(argv) {
  const args = parseArgs(argv)
  const root = typeof args.root === 'string' ? args.root : ROOT
  if (args['self-test']) return selfTest()
  if (args.list) return cmdList(root)
  if (args.candidates) return cmdCandidates(root)
  if (args.apply) return cmdApply(root, args)
  printHelp()
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  process.exit(main(process.argv.slice(2)))
}

export const __test__ = {
  stripLineComments,
  splitFields,
  parseEntry,
  parseEntryBlocks,
  parseRegistrySource,
  readRegistry,
  normalizeTrigger,
  listModules,
  judgeModules,
  countModules,
  audit,
  candidateFor,
  buildCandidates,
  validateCandidate,
  humanValve,
  applyLibs,
  parseArgs,
  candidateFileOf,
  backupFileOf,
  RegistryShapeError,
  MODES,
  REGISTRY_PATH,
  SINGLE_SOURCE_PATH,
  APPLY_ENV,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
