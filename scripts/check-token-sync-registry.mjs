#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-token-sync-registry.mjs — TOKEN_SYNC_TARGETS 登记表四向自洽对账(守门)。
 *
 * 为什么要有它(2026-09-25 立项,前提为当日实测):
 * `scripts/lib/pre-commit-hook.js` 的 `TOKEN_SYNC_TARGETS` 是本仓把"跨端设计真相"收成派生态的
 * 唯一登记表,每行语义是三段链:① 触发文件变了 ⇒ ② 跑生成器自动写回副本 ⇒ ③ 某道复核门判同不同形。
 * 这三段此前**没有任何一道门在对账**,表挂着腐烂行也无人喊。四种已记录的腐烂形态:
 *   R2 型:触发文件改名/被搬走 ⇒ 那一行**永不触发**而没人喊;
 *   R3 型:cmd 里的生成器被删/改名 ⇒ 提交链跑到那一步才崩;
 *   R4 型:复核门被摘线、改号、或在 guardian-runner 里被降成 warn ⇒ "副本自动写回还在跑,
 *          但再没人判它对不对"(warn = 拦不住任何东西,等于没有门);
 *   R1 型:登记表加一行却忘配复核者 ⇒ 新派生面零覆盖,而表会替人做出"已经收口了"的判断。
 * 判据读**表本身**:`extractTokenSyncTargets(src)` 只是从 pre-commit-hook.js 现读现解析 ——
 * **这是解析,不是第二份登记表**;表本身仍住在 pre-commit-hook.js,本门不落任何行副本。
 * 权威点 = guardian-runner 的 script: 注册块 ∪ scripts/lib/pre-commit-hook.js ∪ .husky/*
 * ∪ 根 package.json ∪ .github/workflows/**。
 *
 * 取材面口径(同守门 70/77/83/98/101/103):默认判 **HEAD blob**、`--staged` 判**索引 blob**、
 * `--worktree` 仅人工逃生舱;两个面旗同给判死;任一侧取不到 ⇒ **exit 2「无法判定」**,
 * 既不冒红也不记绿;枚举到 0 行判死(空扫不报绿是本仓铁律)。表若被改成解析不出的形状 ⇒
 * 判「无法判定」而不是当成 0 行绿。
 *
 * 红/未判定分档:行 failMode:'warn' 的降级本身不判红(第 6 行 ALPHA_USAGE 是有意的,生成器在
 * "表体之外有未提交差异"时按设计拒绝写回);check 指向的脚本在所有权威点零引用 ⇒ 红;而
 * "某道门存在但不在任何表行里"与"hook 引用存在但取不出 !run 肯定式"一律只报数,不冒红也不记绿。
 * R4 在 hook 源里找调用点时**先把表区自身抹掉** —— 表行里的 `check: '...'` 是被审对象,
 * 不能自己给自己当在场证据。
 *
 * 接线:**由主会话统一做**(§12 注册表单写者);本票刻意不改 guardian-runner,
 * 头注亦不作任何"门已挂上某条链"的肯定式声称(守门 89 有反向测试专盯虚假声称)。
 *
 * 用法:
 *   node scripts/check-token-sync-registry.mjs              全量(HEAD 面)
 *   node scripts/check-token-sync-registry.mjs --staged     索引面
 *   node scripts/check-token-sync-registry.mjs --worktree   人工排查逃生舱
 *   node scripts/check-token-sync-registry.mjs --self-test   判据自检(纯函数 + mkScratch 临时仓)
 *   node scripts/check-token-sync-registry.mjs --root <dir>  测试通道:指定仓库根(生产不带)
 * 退出码:0 = 全表自洽;1 = 有判红;2 = 无法判定(取材失败/形状解析不出/空扫/两面旗同给)。
 */
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  FACE_LABEL,
  Undetermined,
  assertRepoRoot,
  catBatch,
  gitRaw,
  readWorktreeFile,
  selectFace,
} from './lib/face-reader.mjs'
import { mkScratch } from './lib/scratch-dir.mjs'

const SELF_PATH = fileURLToPath(import.meta.url)
const DEFAULT_ROOT = path.resolve(path.dirname(SELF_PATH), '..')

const HOOK_REL = 'scripts/lib/pre-commit-hook.js'
const RUNNER_REL = 'scripts/guardian-runner.mjs'
const REQUIRED_FIELDS = ['label', 'file', 'cmd', 'trigger', 'failMode', 'check']
const TRIGGER_VALUES = new Set(['tokens', 'v3-src'])
const FAIL_MODES = new Set(['block', 'warn'])

// ────────────────── 纯函数层(构造面即可证明,不依赖仓库瞬时状态) ──────────────────

/** 把 src 里的行注释/块注释替换为等长空格(保留换行与字符串字面量原文;产物与 src 逐字符等长,所以索引可直接复用)。 */
function maskComments(src) {
  const out = []
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') {
        out.push(' ')
        i++
      }
      continue
    }
    if (c === '/' && src[i + 1] === '*') {
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) {
        out.push(src[i] === '\n' ? '\n' : ' ')
        i++
      }
      i += 2
      out.push('  ')
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      const q = c
      out.push(c)
      i++
      while (i < src.length) {
        const d = src[i]
        if (d === '\\') {
          out.push(d)
          if (i + 1 < src.length) out.push(src[i + 1])
          i += 2
          continue
        }
        out.push(d)
        i++
        if (d === q) break
      }
      continue
    }
    out.push(c)
    i++
  }
  return out.join('')
}

/**
 * 从 pre-commit-hook.js 源码解析 TOKEN_SYNC_TARGETS 表。
 * @returns {{status:'ok', rows:Array<{fields:Record<string,string>}>, arraySpan:[number,number]|null}
 *          | {status:'unparseable', reason:string}}
 *   形状解析不出(标记不在 / `=` 后不是数组字面量 / 括号不配平)⇒ unparseable;
 *   数组在而零元素 ⇒ rows 为空,由调用方判"空扫不报绿"。arraySpan 是数组字面量在源码里的
 *   [起, 止) 区间 —— R4 拿它把表区从"hook 调用点"扫描里抹掉。
 */
function extractTokenSyncTargets(src) {
  const masked = maskComments(src)
  const m = /const\s+TOKEN_SYNC_TARGETS\s*=/.exec(masked)
  if (!m) return { status: 'unparseable', reason: '找不到 `const TOKEN_SYNC_TARGETS =` 标记' }
  let i = m.index + m[0].length
  while (i < masked.length && /\s/.test(masked[i])) i++
  if (masked[i] !== '[')
    return {
      status: 'unparseable',
      reason: '`TOKEN_SYNC_TARGETS =` 后面不是数组字面量(表被改成运行时计算/别处导入,本门无法从形状判定行内容)',
    }
  const open = i
  const pairs = { '[': ']', '{': '}', '(': ')' }
  const closers = new Set([']', '}', ')'])
  let depth = 0
  let j = i
  let end = -1
  while (j < masked.length) {
    const c = masked[j]
    if (c === "'" || c === '"' || c === '`') {
      const q = c
      j++
      while (j < masked.length) {
        if (masked[j] === '\\') j += 2
        else {
          if (masked[j] === q) {
            j++
            break
          }
          j++
        }
      }
      continue
    }
    if (pairs[c]) depth++
    else if (closers.has(c)) {
      depth--
      if (depth === 0) {
        end = j
        break
      }
    }
    j++
  }
  if (end < 0) return { status: 'unparseable', reason: 'TOKEN_SYNC_TARGETS 数组字面量括号不配平' }
  const inner = masked.slice(open + 1, end)
  const elems = []
  let d = 0
  let start = 0
  for (let k = 0; k < inner.length; k++) {
    const c = inner[k]
    if (c === "'" || c === '"' || c === '`') {
      const q = c
      k++
      while (k < inner.length) {
        if (inner[k] === '\\') k += 2
        else {
          if (inner[k] === q) break
          k++
        }
      }
      continue
    }
    if (pairs[c]) d++
    else if (closers.has(c)) d--
    else if (c === ',' && d === 0) {
      elems.push(inner.slice(start, k))
      start = k + 1
    }
  }
  if (inner.slice(start).trim()) elems.push(inner.slice(start))
  const rows = []
  for (const elem of elems) {
    const body = elem.trim()
    if (!body.startsWith('{') || !body.endsWith('}'))
      return { status: 'unparseable', reason: `表元素不是对象字面量:${body.slice(0, 40)}` }
    rows.push({ fields: parseStringFields(body) })
  }
  return { status: 'ok', rows, arraySpan: [open, end + 1] }
}

/** 从对象字面量文本里抽 REQUIRED_FIELDS 的 `key: 'string'` 对(非字符串值一律视为缺该字段)。 */
function parseStringFields(objSrc) {
  const fields = {}
  const re = /([A-Za-z_$][\w$]*)\s*:\s*(['"`])((?:\\.|(?!\2)[^\\])*)\2/g
  let m
  while ((m = re.exec(objSrc))) {
    if (REQUIRED_FIELDS.includes(m[1])) fields[m[1]] = m[3]
  }
  return fields
}

/** 把 [start,end) 区间的字符替换为空格(保留换行)—— 抹掉表区用。 */
function blankRange(src, start, end) {
  return src
    .split('')
    .map((c, i) => (i >= start && i < end && c !== '\n' ? ' ' : c))
    .join('')
}

/**
 * 分类写回命令。
 * @param {string} cmd
 * @returns {{kind:'node-script',path:string}|{kind:'pnpm-script',pkg:string,script:string}|{kind:'unknown',cmd:string}}
 */
function classifyCmd(cmd) {
  const tokens = String(cmd ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (tokens[0] === 'node' && tokens[1]) return { kind: 'node-script', path: tokens[1] }
  if (tokens[0] === 'pnpm' && tokens[1] === '--filter' && tokens[2]) {
    let rest = tokens.slice(3)
    if (rest[0] === 'run') rest = rest.slice(1)
    if (rest[0])
      return { kind: 'pnpm-script', pkg: tokens[2].replace(/^['"]|['"]$/g, ''), script: rest[0] }
  }
  return { kind: 'unknown', cmd: String(cmd ?? '') }
}

function basenameOf(p) {
  return String(p ?? '')
    .replace(/\\/g, '/')
    .split('/')
    .pop()
}

function isCommentLine(line) {
  const t = line.trim()
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('#')
}

/**
 * 解析 guardian-runner.mjs 的注册块:位于 `  {` 与 `  },` 边界内、含 `script:` 的对象,
 * 抽 {id, script, mode};mode 取不出 → null(调用方判"判不出",不猜)。
 * @param {string|null} runnerSrc
 */
function parseGuardianRegistrations(runnerSrc) {
  const regs = []
  if (typeof runnerSrc !== 'string') return regs
  const lines = runnerSrc.split(/\r?\n/)
  let cur = null
  for (const line of lines) {
    if (/^\s{2}\{$/.test(line)) {
      cur = []
      continue
    }
    if (cur && /^\s{2}\},?\s*$/.test(line)) {
      const body = cur.join('\n')
      const s = /^\s*script:\s*(['"])(.*?)\1\s*,?\s*$/m.exec(body)
      if (s) {
        const id = /^\s*id:\s*(['"])(.*?)\1\s*,?\s*$/m.exec(body)
        const mode = /^\s*mode:\s*(['"])(.*?)\1\s*,?\s*$/m.exec(body)
        regs.push({ id: id ? id[2] : null, script: s[2], mode: mode ? mode[2] : null })
      }
      cur = null
      continue
    }
    if (cur) cur.push(line)
  }
  return regs
}

/** 在面上按包名找 package.json 并核对 scripts 里的脚本名。 */
function lookupPnpmScript(pkg, script, pathArr, readText) {
  const manifestPaths = pathArr.filter(
    (p) => /(^|\/)package\.json$/.test(p) && !p.includes('node_modules/'),
  )
  let unreadable = 0
  for (const mp of manifestPaths) {
    let text = null
    try {
      text = readText(mp)
    } catch {
      text = null
    }
    if (text === null) {
      unreadable++
      continue
    }
    let json
    try {
      json = JSON.parse(text)
    } catch {
      unreadable++
      continue
    }
    if (json && json.name === pkg) {
      const scripts = json.scripts ?? {}
      if (typeof scripts[script] === 'string' && scripts[script]) return { kind: 'ok' }
      return {
        kind: 'red',
        detail: `包 ${pkg}(${mp})的 scripts 里没有脚本名 \`${script}\`,cmd 跑到即失败`,
      }
    }
  }
  if (unreadable > 0)
    return {
      kind: 'undetermined',
      detail: `面上有 ${unreadable} 份 package.json 取不到/解析不出,无法断定包 ${pkg} 是否存在(不记绿)`,
    }
  return { kind: 'red', detail: `被审面上找不到名为 ${pkg} 的 workspace 包(scripts 里的 ${script} 无从核对)` }
}

/**
 * 核心判据(纯函数):对已取好的表宿主源码 + 权威点源码 + 面上下文跑 R1–R4。
 * @param {{hookSrc:string, runnerSrc:string|null, otherRefsText:string,
 *           paths:Iterable<string>, hasPath:(rel:string)=>boolean,
 *           readText:(rel:string)=>string|null}} input
 * @returns {{status:'ok'|'red'|'undetermined', reason?:string, violations:string[],
 *             undetermined:string[], counts:Record<string,number>}}
 */
function evaluateRegistry({ hookSrc, runnerSrc, otherRefsText, paths, hasPath, readText }) {
  const ext = extractTokenSyncTargets(hookSrc)
  if (ext.status === 'unparseable')
    return {
      status: 'undetermined',
      reason: `表形状解析不出:${ext.reason}`,
      violations: [],
      undetermined: [],
      counts: {},
    }
  if (ext.rows.length === 0)
    return {
      status: 'undetermined',
      reason: 'TOKEN_SYNC_TARGETS 枚举到 0 行 ⇒ 判死,不记绿(空扫正是本门要防的故障形态)',
      violations: [],
      undetermined: [],
      counts: {},
    }
  const rows = ext.rows
  const regs = parseGuardianRegistrations(runnerSrc)
  // R4 找 hook 调用点前先把表区抹掉:表行里的 `check:` 是被审对象,不能自己给自己当在场证据。
  const hookCallSites = ext.arraySpan ? blankRange(hookSrc, ext.arraySpan[0], ext.arraySpan[1]) : hookSrc
  const hookLines = hookCallSites.split(/\r?\n/)
  const pathArr = [...paths]
  const violations = []
  const undetermined = []
  let warnRows = 0
  const covered = new Set()

  rows.forEach((row, idx) => {
    const f = row.fields
    const tag = `行#${idx + 1}[${f.label ?? '(无 label)'}]`
    // R1 行结构合法
    for (const key of REQUIRED_FIELDS) {
      if (typeof f[key] !== 'string' || f[key].trim() === '')
        violations.push(
          `R1 ${tag} 缺字段 \`${key}\`(六字段 label/file/cmd/trigger/failMode/check 必须齐备)`,
        )
    }
    if (typeof f.trigger === 'string' && f.trigger && !TRIGGER_VALUES.has(f.trigger))
      violations.push(`R1 ${tag} trigger='${f.trigger}' 不在 {tokens, v3-src}`)
    if (typeof f.failMode === 'string' && f.failMode && !FAIL_MODES.has(f.failMode))
      violations.push(`R1 ${tag} failMode='${f.failMode}' 不在 {block, warn}`)
    if (f.failMode === 'warn') warnRows++ // 降级本身合法,不判红(第 6 行 ALPHA_USAGE 是有意的)

    // R2 触发文件在被审面上存在(空格分隔多路径逐条判)
    if (typeof f.file === 'string') {
      const trigPaths = f.file.trim().split(/\s+/).filter(Boolean)
      if (trigPaths.length === 0) violations.push(`R2 ${tag} file 为空,该行永不触发`)
      for (const p of trigPaths)
        if (!hasPath(p)) violations.push(`R2 ${tag} 触发文件不在被审面上:${p}(该行永不触发)`)
    }

    // R3 写回出口可解析
    if (typeof f.cmd === 'string' && f.cmd.trim()) {
      const k = classifyCmd(f.cmd)
      if (k.kind === 'node-script') {
        if (!hasPath(k.path)) violations.push(`R3 ${tag} cmd 的脚本不在被审面上:${k.path}`)
      } else if (k.kind === 'pnpm-script') {
        const r = lookupPnpmScript(k.pkg, k.script, pathArr, readText)
        if (r.kind === 'red') violations.push(`R3 ${tag} ${r.detail}`)
        else if (r.kind === 'undetermined') undetermined.push(`R3 ${tag} ${r.detail}`)
      } else {
        undetermined.push(`R3 ${tag} cmd 形态认不出(不判红也不记为已核):${k.cmd}`)
      }
    }

    // R4 复核者在权威点上在场
    if (typeof f.check === 'string' && f.check.trim()) {
      const base = basenameOf(f.check.trim())
      covered.add(base)
      if (!pathArr.some((p) => basenameOf(p) === base)) {
        violations.push(`R4 ${tag} 复核脚本 ${base} 不在被审面上(复核者不存在,派生面无人判形)`)
        return
      }
      const reg = regs.find((r) => basenameOf(r.script) === base)
      if (reg) {
        if (reg.mode === 'blocking') return
        if (reg.mode === 'warn')
          violations.push(
            `R4 ${tag} 复核脚本 ${base} 在 guardian-runner(id ${reg.id})注册为 mode:'warn' —— 自动写回照跑、判定却不拦,等于没有门`,
          )
        else
          undetermined.push(
            `R4 ${tag} ${base} 在 guardian-runner(id ${reg.id})有注册块但取不出 mode,判不出(不记绿)`,
          )
        return
      }
      const hookHits = hookLines.filter((l) => l.includes(base))
      if (hookHits.some((l) => l.includes('!run(') && !isCommentLine(l))) return // 行 418 那种肯定式 = 合法在场
      const nonCommentHit = hookHits.some((l) => !isCommentLine(l))
      if (!nonCommentHit && otherRefsText.includes(base)) return // .husky/* / 根 package.json / workflows 点名
      if (nonCommentHit)
        undetermined.push(
          `R4 ${tag} ${base} 在 pre-commit-hook.js 被引用,但取不出 \`if (!run(...))\` 失败即拦的肯定式,判不出(不记绿)`,
        )
      else
        violations.push(
          `R4 ${tag} 复核脚本 ${base} 在五处权威点零引用 —— 该派生面无人复核(登记表在替它说谎"已收口")`,
        )
    }
  })

  // 反向只报数:scripts/check-*.mjs 存在却不在任何表行里(大量门与派生面无关,不判红)
  const unlisted = pathArr.filter(
    (p) => /^scripts\/check-.*\.mjs$/.test(p) && !covered.has(basenameOf(p)),
  ).length
  return {
    status: violations.length ? 'red' : 'ok',
    violations,
    undetermined,
    counts: {
      rows: rows.length,
      warnRows,
      registrations: regs.length,
      unlistedCheckScripts: unlisted,
      runnerUnreadable: runnerSrc === null ? 1 : 0,
    },
  }
}

// ────────────────── 取材层(面纪律:清单与内容同面同轮) ──────────────────

/**
 * 按被审面搭出判据上下文(路径清单 + 内容读 + 表宿主源码)。
 * @param {string} root @param {'head'|'staged'|'worktree'} face
 */
function buildFaceContext(root, face) {
  const listed =
    face === 'head' ? gitRaw(['ls-tree', '-r', '--name-only', 'HEAD'], root) : gitRaw(['ls-files'], root)
  const paths = new Set(
    String(listed)
      .split(/\r?\n/)
      .map((p) => p.replace(/\\/g, '/'))
      .filter(Boolean),
  )
  if (paths.size === 0) throw new Undetermined(`面 ${FACE_LABEL[face]} 枚举到 0 个路径 ⇒ 判死`)
  const hasPath = face === 'worktree' ? (rel) => existsSync(path.join(root, rel)) : (rel) => paths.has(rel)
  // 一次性预读全部要用的 blob(head/staged 各只派生一次 cat-file --batch,§5b fork 风暴同型)
  const need = [HOOK_REL, RUNNER_REL].concat(
    [...paths].filter(
      (p) =>
        /(^|\/)package\.json$/.test(p) || p.startsWith('.husky/') || p.startsWith('.github/workflows/'),
    ),
  )
  const cache = new Map()
  if (face === 'worktree') {
    for (const rel of need) cache.set(rel, paths.has(rel) ? readWorktreeFile(root, rel) : null)
  } else {
    const want = need.filter((p) => paths.has(p))
    const specs = want.map((rel) => (face === 'head' ? `HEAD:${rel}` : `:${rel}`))
    const batch = catBatch(root, specs)
    want.forEach((rel, k) => cache.set(rel, batch.get(specs[k]) ?? null))
  }
  const readText = (rel) => (cache.has(rel) ? cache.get(rel) : null)
  const otherRefsText = ['.husky/', '.github/workflows/']
    .flatMap((pre) => [...paths].filter((p) => p.startsWith(pre)))
    .concat([...paths].includes('package.json') ? ['package.json'] : [])
    .map((p) => {
      const t = readText(p)
      if (t === null || t === undefined) return ''
      return t
        .split(/\r?\n/)
        .filter((l) => !isCommentLine(l))
        .join('\n')
    })
    .join('\n')
  return {
    hasPath,
    readText,
    paths,
    hookSrc: cache.get(HOOK_REL) ?? null,
    runnerSrc: cache.get(RUNNER_REL) ?? null,
    otherRefsText,
  }
}

// ────────────────── CLI ──────────────────

function usage() {
  console.log(
    [
      '用法: node scripts/check-token-sync-registry.mjs [--staged|--worktree|--root <dir>] [--self-test]',
      '默认判 HEAD blob;--staged 判索引 blob;--worktree 仅人工逃生舱;两面旗同给 ⇒ exit 2。',
      '接线由主会话统一做;本门头注不声称已注册进 guardian-runner。',
    ].join('\n'),
  )
}

/** 汇总输出 + 退出码映射(纯映射,CLI 与自检共用)。 */
function report(face, verdict) {
  console.log(`🧭 TOKEN_SYNC_TARGETS 登记表四向对账 — 取材面:${FACE_LABEL[face]}`)
  if (verdict.status === 'undetermined') {
    console.error(`⚠️ 无法判定(exit 2):${verdict.reason}`)
    return 2
  }
  const c = verdict.counts
  console.log(
    `   表行 ${c.rows}(failMode=warn 行 ${c.warnRows} 个,合法)/ guardian 注册块解析到 ${c.registrations} 道` +
      (c.runnerUnreadable ? '(⚠️ guardian-runner 取不到,R4 的注册面缺位,只据其余权威点)' : ''),
  )
  for (const v of verdict.violations) console.error(`❌ ${v}`)
  for (const u of verdict.undetermined) console.warn(`❔ 未判定(不记绿):${u}`)
  console.log(
    `   只报数:与派生面无关的 scripts/check-*.mjs ${c.unlistedCheckScripts} 道` +
      (verdict.undetermined.length ? ` / 未判定 ${verdict.undetermined.length} 处` : ''),
  )
  if (verdict.status === 'red') {
    console.error(
      `❌ 共 ${verdict.violations.length} 枚判红。修复口径:改**表本身**(pre-commit-hook.js 的 TOKEN_SYNC_TARGETS)与对应门/脚本,不得为消红放宽本门判据。`,
    )
    return 1
  }
  console.log(`✅ 表与写回出口、复核者三方自洽(${c.rows} 行全绿)`)
  return 0
}

function main(argv) {
  const args = argv.slice(2)
  if (args.includes('--help') || args.includes('-h')) {
    usage()
    return 0
  }
  if (args.includes('--self-test')) return runSelfTest()
  let root = DEFAULT_ROOT
  const ri = args.indexOf('--root')
  if (ri >= 0) {
    const v = args[ri + 1]
    if (!v) {
      console.error('❌ --root 需要一个目录参数')
      return 2
    }
    root = path.resolve(v)
  }
  const { face, error } = selectFace({
    staged: args.includes('--staged'),
    worktree: args.includes('--worktree'),
  })
  if (error) {
    console.error(`❌ 无法判定(exit 2):${error}`)
    return 2
  }
  try {
    assertRepoRoot(root, 'check-token-sync-registry')
    const ctx = buildFaceContext(root, face)
    if (ctx.hookSrc === null) {
      console.error(
        `❌ 无法判定(exit 2):${FACE_LABEL[face]} 取不到登记表宿主文件 ${HOOK_REL}("取不到"不等于"没有派生面",不冒红也不记绿)`,
      )
      return 2
    }
    return report(
      face,
      evaluateRegistry({
        hookSrc: ctx.hookSrc,
        runnerSrc: ctx.runnerSrc,
        otherRefsText: ctx.otherRefsText,
        paths: ctx.paths,
        hasPath: ctx.hasPath,
        readText: ctx.readText,
      }),
    )
  } catch (e) {
    if (e instanceof Undetermined) {
      console.error(`❌ 无法判定(exit 2):${e.message}`)
      return 2
    }
    throw e
  }
}

// ────────────────── 自检(≥18 例,成对;面纪律用例经 mkScratch 真造两面对照) ──────────────────

function assert(cond, msg) {
  if (!cond) throw new Error(`自检失败:${msg}`)
}
function hasViolation(v, re, msg) {
  assert(v.some((s) => re.test(s)), `${msg}(实得:${JSON.stringify(v)})`)
}
function noViolation(v, re, msg) {
  assert(!v.some((s) => re.test(s)), msg)
}

/** 由行对象数组序列化出一份表源码(测试构造面专用的序列化器,不是登记表)。 */
function buildTableSrc(rows) {
  const objs = rows
    .map((r) => {
      const entries = Object.entries(r)
        .filter(([, val]) => val !== undefined)
        .map(([k, val]) => `    ${k}: '${String(val).replace(/'/g, "\\'")}',`)
      return `  {\n${entries.join('\n')}\n  },`
    })
    .join('\n')
  return `const TOKEN_SYNC_TARGETS = [\n${objs}\n]\n`
}

function goodRow(i) {
  return {
    label: `row${i}`,
    file: `trig${i}.css`,
    cmd: `node scripts/sync-row${i}.mjs --quiet`,
    trigger: 'tokens',
    failMode: 'block',
    check: `check-row${i}.mjs`,
  }
}

/** 把注册块序列化成 guardian-runner 的形状(2 空格缩进的 `  {` / `  },` 边界,与真仓同形)。 */
function regRunner(entries) {
  const blocks = entries
    .map(
      (e) =>
        `  {\n    id: '${e.id}',\n    label: 'x',\n    script: '${e.script}',\n    args: [],\n    mode: '${e.mode}',\n  },`,
    )
    .join('\n')
  return `export const CHECKS = [\n${blocks}\n]\n`
}

function mkCtx(files) {
  const paths = new Set(Object.keys(files))
  return {
    paths,
    hasPath: (p) => paths.has(p),
    readText: (p) => (Object.prototype.hasOwnProperty.call(files, p) ? files[p] : null),
  }
}

function evalPure(files, tableSrc, runnerSrc = 'export const CHECKS = []\n') {
  const ctx = mkCtx(files)
  return evaluateRegistry({
    hookSrc: tableSrc,
    runnerSrc,
    otherRefsText: '',
    paths: ctx.paths,
    hasPath: ctx.hasPath,
    readText: ctx.readText,
  })
}

function gitIn(dir, args) {
  return gitRaw(['-c', 'user.email=self@test', '-c', 'user.name=selftest', ...args], dir, {
    timeout: 30000,
  })
}

function fixtureRepo(tableSrc, files, runnerSrc = 'export const CHECKS = []\n') {
  const dir = mkScratch('token-reg-face-')
  const put = (rel, content) => {
    mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true })
    writeFileSync(path.join(dir, rel), content, 'utf8')
  }
  put(HOOK_REL, tableSrc)
  put(RUNNER_REL, runnerSrc)
  for (const [k, v] of Object.entries(files)) put(k, v)
  gitIn(dir, ['init', '-b', 'main'])
  gitIn(dir, ['add', '-A'])
  gitIn(dir, ['commit', '-m', 'fixture'])
  return dir
}

function cliGate(repoArgs) {
  const r = spawnSync(process.execPath, [SELF_PATH, ...repoArgs], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
  })
  if (r.error) throw r.error
  return { code: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` }
}

function runSelfTest() {
  const cases = []
  const step = (name, fn) => cases.push({ name, fn })

  const rowFiles = {
    'trig1.css': 'x',
    'scripts/sync-row1.mjs': '// stub',
    'scripts/check-row1.mjs': '// stub',
  }

  // 1/2 成对:形状锁 —— 缺 check 必红,补上即绿
  step('01 表缺 check 字段 ⇒ R1 判红并点名行(形状锁)', () => {
    const noCheck = { ...goodRow(1) }
    delete noCheck.check
    const v = evalPure(rowFiles, buildTableSrc([noCheck]))
    assert(v.status === 'red', '缺 check 必红')
    hasViolation(v.violations, /R1 .*缺字段 `check`/, 'R1 缺 check')
  })
  step('02 反向对照:同表补 check + guardian blocking 在场 ⇒ 全绿', () => {
    const v = evalPure(
      rowFiles,
      buildTableSrc([goodRow(1)]),
      regRunner([{ id: '9', script: 'check-row1.mjs', mode: 'blocking' }]),
    )
    assert(v.status === 'ok', `应绿,实得 ${JSON.stringify(v.violations)}`)
  })
  // 3/4 trigger 枚举成对
  step('03 trigger 值非法 ⇒ R1 红', () => {
    const v = evalPure(rowFiles, buildTableSrc([{ ...goodRow(1), trigger: 'design' }]))
    hasViolation(v.violations, /R1 .*trigger/, 'trigger 非法未判红')
  })
  step('04 反向对照:trigger=v3-src 合法 ⇒ 不因 trigger 红', () => {
    const v = evalPure(rowFiles, buildTableSrc([{ ...goodRow(1), trigger: 'v3-src' }]))
    noViolation(v.violations, /trigger/, 'v3-src 应合法')
  })
  // 5/6 failMode 枚举 + warn 行不判红
  step('05 failMode 值非法 ⇒ R1 红', () => {
    const v = evalPure(rowFiles, buildTableSrc([{ ...goodRow(1), failMode: 'soft' }]))
    hasViolation(v.violations, /R1 .*failMode/, 'failMode 非法未判红')
  })
  step('06 反向对照:failMode=warn(ALPHA_USAGE 型有意降级)不判红且被计数', () => {
    const v = evalPure(
      rowFiles,
      buildTableSrc([{ ...goodRow(1), failMode: 'warn' }]),
      regRunner([{ id: '9', script: 'check-row1.mjs', mode: 'blocking' }]),
    )
    assert(v.status === 'ok' && v.counts.warnRows === 1, `warn 行应合法且被计数:${JSON.stringify(v)}`)
  })
  // 7/8 R2 成对
  step('07 R2:file 两个空格分隔路径、其一不在面 ⇒ 红且点名缺的那个', () => {
    const r = { ...goodRow(1), file: 'trig1.css gone/missing.css' }
    const v = evalPure(rowFiles, buildTableSrc([r]))
    hasViolation(v.violations, /R2 .*gone\/missing\.css/, '缺路径未点名')
  })
  step('08 反向对照:两路径都在面 ⇒ 不因 R2 红', () => {
    const r = { ...goodRow(1), file: 'trig1.css trig2.css' }
    const v = evalPure({ ...rowFiles, 'trig2.css': 'y' }, buildTableSrc([r]))
    noViolation(v.violations, /R2/, 'R2 应无罪')
  })
  // 9/10 R3 node cmd 与未知形态
  step('09 R3:node cmd 的脚本不在面 ⇒ 红点名脚本', () => {
    const r = { ...goodRow(1), cmd: 'node scripts/deleted-sync.mjs --quiet' }
    const v = evalPure(rowFiles, buildTableSrc([r]))
    hasViolation(v.violations, /R3 .*scripts\/deleted-sync\.mjs/, 'R3 未点名')
  })
  step('10 R3:未知形态 cmd ⇒ 未判定,不判红也不记为已核', () => {
    const r = { ...goodRow(1), cmd: 'bash -c ./gen.sh' }
    const v = evalPure(
      rowFiles,
      buildTableSrc([r]),
      regRunner([{ id: '9', script: 'check-row1.mjs', mode: 'blocking' }]),
    )
    assert(v.status === 'ok' && v.undetermined.length === 1 && /R3/.test(v.undetermined[0]), `应恰 1 条未判定:${JSON.stringify(v)}`)
  })
  // 11/12 R3 pnpm 形态
  step('11 R3:pnpm --filter 形态,包在而脚本名没了 ⇒ 红并点名包与脚本', () => {
    const files = {
      ...rowFiles,
      'apps/demo/package.json': JSON.stringify({ name: '@ihui/demo', scripts: {} }),
    }
    const r = { ...goodRow(1), cmd: 'pnpm --filter @ihui/demo sync-tokens' }
    const v = evalPure(files, buildTableSrc([r]))
    hasViolation(v.violations, /@ihui\/demo.*sync-tokens/, 'pnpm 红未点名包与脚本')
  })
  step('12 反向对照:scripts 里有该脚本 ⇒ 绿', () => {
    const files = {
      ...rowFiles,
      'apps/demo/package.json': JSON.stringify({
        name: '@ihui/demo',
        scripts: { 'sync-tokens': 'node x.mjs' },
      }),
    }
    const r = { ...goodRow(1), cmd: 'pnpm --filter @ihui/demo sync-tokens' }
    const v = evalPure(
      files,
      buildTableSrc([r]),
      regRunner([{ id: '9', script: 'check-row1.mjs', mode: 'blocking' }]),
    )
    assert(v.status === 'ok', `应绿,实得 ${JSON.stringify(v.violations)}`)
  })
  step('12b R3:pnpm 形态找不到该包 ⇒ 红点名包', () => {
    const r = { ...goodRow(1), cmd: 'pnpm --filter @nope/pkg thing' }
    const v = evalPure(rowFiles, buildTableSrc([r]))
    hasViolation(v.violations, /@nope\/pkg/, '未点名缺失的包')
  })
  // 13/14/15 R4 在场三态 + 表区自证反向锁
  step('13 R4:复核脚本在面上但五处权威点零引用 ⇒ 红(表行自己的 check: 不算在场证据)', () => {
    const v = evalPure(rowFiles, buildTableSrc([goodRow(1)]))
    hasViolation(v.violations, /R4 .*零引用/, '摘线未判红')
    assert(!v.undetermined.some((s) => /R4/.test(s)), '表区在场证据未被抹掉(自证漏洞回来了)')
  })
  step('14 反向对照:guardian 注册 blocking ⇒ 绿', () => {
    const v = evalPure(
      rowFiles,
      buildTableSrc([goodRow(1)]),
      regRunner([{ id: '9', script: 'check-row1.mjs', mode: 'blocking' }]),
    )
    assert(v.status === 'ok', `blocking 在场应绿,实得 ${JSON.stringify(v.violations)}`)
  })
  step('15 R4:guardian 注册成 warn ⇒ 红(自动写回照跑、判定不拦 = 没有门)', () => {
    const v = evalPure(
      rowFiles,
      buildTableSrc([goodRow(1)]),
      regRunner([{ id: '9', script: 'check-row1.mjs', mode: 'warn' }]),
    )
    hasViolation(v.violations, /mode:'warn'/, 'warn 注册未判红')
  })
  // 16/17 hook 内联两态
  step('16 R4:仅被 hook 内联且是 if (!run( 失败即拦 ⇒ 合法在场', () => {
    const hook =
      buildTableSrc([goodRow(1)]) +
      `\nif (!run('x...', 'node scripts/check-row1.mjs')) {\n  process.exit(1)\n}\n`
    const v = evalPure(rowFiles, hook)
    assert(v.status === 'ok', `应绿,实得 ${JSON.stringify(v.violations)}`)
  })
  step('17 R4:hook 引用存在但取不出 !run 肯定式 ⇒ 未判定(不记绿也不冒红)', () => {
    const hook = buildTableSrc([goodRow(1)]) + `\nexecSync('node scripts/check-row1.mjs')\n`
    const v = evalPure(rowFiles, hook)
    assert(v.status === 'ok' && v.undetermined.some((s) => /R4/.test(s)), `应计入未判定:${JSON.stringify(v)}`)
  })
  // 18/19 空扫与形状漂 ⇒ 无法判定而非绿
  step('18 表为空数组 ⇒ 无法判定(空扫不报绿)', () => {
    const v = evalPure({}, 'const TOKEN_SYNC_TARGETS = []\n')
    assert(v.status === 'undetermined', '空表必须判死而非 ok')
  })
  step('19 表被改成解不出的形状 ⇒ 无法判定而非 0 行绿', () => {
    const v = evalPure({}, 'const TOKEN_SYNC_TARGETS = computeTargets(process.env)\n')
    assert(v.status === 'undetermined' && /形状|数组/.test(v.reason ?? ''), `要喊无法判定,实得 ${JSON.stringify(v)}`)
  })
  // 20 反向报数
  step('20 存在但不属于表行的 scripts/check-*.mjs ⇒ 只报数不判红', () => {
    const files = { ...rowFiles, 'scripts/check-unrelated.mjs': '' }
    const v = evalPure(
      files,
      buildTableSrc([goodRow(1)]),
      regRunner([{ id: '9', script: 'check-row1.mjs', mode: 'blocking' }]),
    )
    assert(v.status === 'ok' && v.counts.unlistedCheckScripts === 1, `unlisted 应为 1 且不计红:${JSON.stringify(v)}`)
  })
  // 21-24 CLI 级面纪律:mkScratch 真仓,构造"索引 ≠ HEAD"
  step('21 面纪律:HEAD 表好、索引表指向缺失路径 ⇒ 默认档 exit 0、--staged exit 1', () => {
    const regRunnerSrc = regRunner([{ id: '9', script: 'check-row1.mjs', mode: 'blocking' }])
    const dir = fixtureRepo(buildTableSrc([goodRow(1)]), rowFiles, regRunnerSrc)
    const head = cliGate(['--root', dir])
    assert(head.code === 0, `HEAD 面应绿,实得 ${head.code}:${head.out}`)
    const bad = buildTableSrc([{ ...goodRow(1), file: 'gone-in-index.css' }])
    writeFileSync(path.join(dir, HOOK_REL), bad, 'utf8')
    gitIn(dir, ['add', '--', HOOK_REL])
    const headAgain = cliGate(['--root', dir])
    assert(headAgain.code === 0, `默认档判 HEAD,不该被索引的坏行顶红:${headAgain.out}`)
    const staged = cliGate(['--root', dir, '--staged'])
    assert(staged.code === 1 && /R2 .*gone-in-index\.css/.test(staged.out), `--staged 应红在索引行上:${staged.out}`)
  })
  step('22 两面旗同给 ⇒ exit 2 判死', () => {
    const dir = fixtureRepo(buildTableSrc([goodRow(1)]), rowFiles)
    const r = cliGate(['--root', dir, '--staged', '--worktree'])
    assert(r.code === 2, `应 exit 2,实得 ${r.code}:${r.out}`)
  })
  step('23 被审面上没有 hook 文件 ⇒ exit 2(取不到 ≠ 没有派生面)', () => {
    const dir = mkScratch('token-reg-nohook-')
    writeFileSync(path.join(dir, 'README.md'), 'empty repo without hook file\n', 'utf8')
    gitIn(dir, ['init', '-b', 'main'])
    gitIn(dir, ['add', '-A'])
    gitIn(dir, ['commit', '-m', 'fixture'])
    const r = cliGate(['--root', dir])
    assert(r.code === 2 && /无法判定/.test(r.out), `应 exit 2,得 ${r.code}:${r.out}`)
  })
  step('24 CLI 级形状锁:HEAD 表缺 check ⇒ exit 1 且点名 check 字段', () => {
    const noCheck = { ...goodRow(1) }
    delete noCheck.check
    const dir = fixtureRepo(buildTableSrc([noCheck]), rowFiles)
    const r = cliGate(['--root', dir])
    assert(r.code === 1 && /缺字段 `check`/.test(r.out), `应 exit 1 点名 check:${r.out}`)
  })

  let pass = 0
  let failed = null
  for (const c of cases) {
    try {
      c.fn()
      pass++
      console.log(`  ✅ ${c.name}`)
    } catch (e) {
      console.error(`  ❌ ${c.name}\n     ${e && e.message ? e.message : e}`)
      failed = true
    }
  }
  if (failed) {
    console.error(`❌ --self-test 未通过(${pass}/${cases.length})`)
    return 1
  }
  console.log(`✅ --self-test 通过 ${pass}/${cases.length} 例`)
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exit(main(process.argv))
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

export const __test__ = {
  extractTokenSyncTargets,
  classifyCmd,
  parseGuardianRegistrations,
  evaluateRegistry,
  basenameOf,
  buildTableSrc,
  regRunner,
  goodRow,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
