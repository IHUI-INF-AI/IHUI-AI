// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 压缩分母对账:凡「token 数 ÷ 名为 contextLimit / contextWindow 的分母」都必须经过
// effectiveContextWindow(...) —— provider 的 context window 是 input 与 output **共享**的
// 同一个窗口,不先扣输出预留就等于把阈值算成"占满整个共享窗口的 88%",而同一窗口里模型还要
// 生成回复。故障形态:"压缩判过了还是 400 / context overflow",极难归因到分母。
//
// 口径同守门 70/77/83/91/98/101/103:全量判 **HEAD blob**、--staged 判**索引 blob**、
// --worktree 仅人工逃生舱;取不到内容 ⇒ exit 2「无法判定」(不冒红也不记绿)。
// 存量走 scripts/compaction-denominator-baseline.json 每文件棘轮(只减不增)。
// 紧急跳过 HUSKY_SKIP_COMPACTION_DENOMINATOR=1(本仓尚未接进 guardian-runner,接线由主会话统一做)。
//
// 已知限制(如实登记,不等于"没有违规"):
//   1. 只判**除法**。`Math.floor(contextLimit * triggerRatio)` 这类乘法不在射程内 —— 它是同一个
//      分母的另一种用法,但把乘法纳进来会判红大量合法的 token 预算计算。
//   2. 「分母已消毒」按**文件内是否存在 `X = effectiveContextWindow(`** 判定;把消毒后的分母当
//      参数传进另一个文件再除,本门看不见(跨文件污点追踪)。宁漏不误报。
//   3. 注释与串内的除号一律不判(剥注释多剥一点只会漏判,不会误判)。

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
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

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASELINE_FILE = 'scripts/compaction-denominator-baseline.json'
const SKIP_ENV = 'HUSKY_SKIP_COMPACTION_DENOMINATOR'
/** 本门脚本与测试自带判据字面量,必须自豁免(它们在 scripts/,本就不在扫描面内;仍留一道) */
const SELF_EXEMPT_PREFIX = 'scripts/check-compaction-denominator'

/** 扫描面:各端 src + 共享包自身 */
const SCAN_ROOTS = ['apps/', 'packages/context-compaction/src/']
const SCAN_EXTS = ['.ts', '.tsx', '.js', '.mjs', '.cjs']

/** 分子:名字里含 token(单/复数、任意前后缀),与"上下文窗口分母"配对才判 */
const NUMERATOR_RE = /token/i
/** 分母:上下文窗口语义的名字(contextLimit / contextWindow / contextBudget 及大小写变体) */
const DENOMINATOR_NAME_RE = /^context(?:limit|window|budget)/i
/** 分母被"消毒":文件内把它从唯一出口赋过值 */
const SANITIZED_RE = /\b([A-Za-z_$][\w$]*)\s*=\s*effectiveContextWindow\s*\(/g

const EXEMPT_MARK = 'compaction-denominator-exempt'

/**
 * 剥块注释 + 剥行尾 // 注释 + **剥单/双引号字符串的 contents**。
 *
 * 为什么要剥字符串(2026-09-25 由镜像测试 M3 抓到才补):本门判的是"标识符 ÷ 标识符"这种形状,
 * 而帮助文本、报错文案里完全可能出现 `"tokens / contextLimit"` 这样的**叙述**——它不是代码,
 * 判红就是"门在自己的说明里红"(守门 70/77 记过的同族:串内 `/*` 骗过状态机、注释里的示例被当债务)。
 * 只剥 `'...'` 与 `"..."` 的**内容**(保留引号与行结构),**不剥模板字符串** —— 反引号里可以真放代码
 * (`${tokens / contextLimit}` 是我们真的要抓的形态),剥掉就会漏判;这一条取舍写在头部限制里。
 */
export function markHidden(src) {
  const out = []
  let inBlock = false
  for (const rawLine of src.split(/\r?\n/)) {
    // 第一步:把 '...' / "..." 的**内容**换成空格(引号本身留着,免得下一行的状态被带跑)。
    // 只做单行字符串 —— 跨行拼接在本仓的除法形态里不存在,而模板串**故意不剥**(见函数头注)。
    let line = ''
    for (let k = 0; k < rawLine.length; k++) {
      const c = rawLine[k]
      if (c === "'" || c === '"') {
        const quote = c
        let j = k + 1
        while (j < rawLine.length && rawLine[j] !== quote) {
          if (rawLine[j] === '\\') j++ // 跳过转义字符本身
          j++
        }
        line += quote + ' '.repeat(Math.max(0, j - k - 1)) + (j < rawLine.length ? quote : '')
        k = j
        continue
      }
      line += c
    }
    let cur = ''
    let i = 0
    while (i < line.length) {
      if (inBlock) {
        const end = line.indexOf('*/', i)
        if (end < 0) i = line.length
        else {
          inBlock = false
          i = end + 2
        }
        continue
      }
      if (line.startsWith('/*', i)) {
        inBlock = true
        i += 2
        continue
      }
      if (line.startsWith('//', i)) break
      cur += line[i]
      i += 1
    }
    out.push(cur)
  }
  return out
}

/**
 * 纯判据:给定文件内容,返回违规行列表(1-based)。跨文件不追踪(见文件头限制 2)。
 * @param {string} relPath 仅用于自豁免
 */
export function scanContent(relPath, text) {
  if (typeof text !== 'string') return []
  if (relPath.replace(/\\/g, '/').startsWith(SELF_EXEMPT_PREFIX)) return []
  const lines = markHidden(text)
  const rawLines = text.split(/\r?\n/)
  const sanitized = new Set()
  for (const m of text.matchAll(SANITIZED_RE)) sanitized.add(m[1])
  const hits = []
  lines.forEach((line, idx) => {
    if (!line.trim()) return
    // 豁免标记必须按**原始行**判:markHidden 会把行尾 // 注释整段剥掉,
    // 判在剥皮后的行上等于豁免永远不生效(本门第一版就死在这一条)。
    if ((rawLines[idx] ?? '').includes(EXEMPT_MARK)) return
    let from = 0
    while (from < line.length) {
      const slash = line.indexOf('/', from)
      if (slash < 0) break
      if (line[slash + 1] === '/') {
        // 行注释已在 markHidden 剥掉;走到这里说明是串内 `http://`,整行不再判
        break
      }
      const left = line.slice(from, slash)
      const right = line.slice(slash + 1)
      const lm = /([A-Za-z_$][\w$.]*)\s*$/.exec(left)
      const rm = /^\s*(?:Math\.floor\(\s*)?([A-Za-z_$][\w$.]*)/.exec(right)
      if (lm && rm) {
        const numTail = (lm[1].split('.').pop() ?? '').replace(/^\w+\?\.?/, '')
        const denTail = rm[1].split('.').pop() ?? ''
        const viaExit =
          left.includes('effectiveContextWindow(') || right.includes('effectiveContextWindow(')
        if (
          NUMERATOR_RE.test(numTail) &&
          DENOMINATOR_NAME_RE.test(denTail) &&
          !viaExit &&
          !sanitized.has(denTail)
        ) {
          hits.push({ line: idx + 1, text: line.trim().slice(0, 120) })
        }
      }
      from = slash + 1
    }
  })
  return hits
}

export function inScanScope(rel) {
  const norm = rel.replace(/\\/g, '/')
  if (!SCAN_ROOTS.some((p) => norm.startsWith(p))) return false
  if (!SCAN_EXTS.includes(path.extname(norm).toLowerCase())) return false
  if (norm.includes('/node_modules/')) return false
  if (/(^|\/)(generated|dist|\.next)\//.test(norm)) return false
  return true
}

/**
 * 反假绿护栏:枚举到 0 个候选文件 = 判据没跑起来,**不是**"仓库干净"。
 * 抽成纯函数,这样这条分支能被构造出来证明(靠真仓瞬时状态证不了)。
 */
export function assertNonEmptyScan(files, face) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Undetermined(
      `${FACE_LABEL[face] ?? face} 面在扫描面内枚举到 0 个源文件 ⇒ 无法判定(不是没有违规)`,
    )
  }
  return files.length
}

/**
 * 候选清单靠一次 `git grep` 预筛,而不是"枚举全部跟踪文件再逐个 cat-file"。
 * 两个理由:① 真仓 apps/** 的 HEAD blob 一次读完会打爆 maxBuffer(实测整批取不到 ⇒
 *    本门会恒常判"无法判定");② 判据要求的分母名一律以 `context` + limit/window/budget 开头,
 *    所以这三个字面量是判据的**严格超集**,预筛不可能筛掉一个真违规(口径同守门 97)。
 */
function listCandidates(root, face) {
  const scope = ['--', 'apps', 'packages/context-compaction/src']
  const pat = ['-e', 'contextlimit', '-e', 'contextwindow', '-e', 'contextbudget']
  const args =
    face === 'head'
      ? ['grep', '-I', '-l', '-i', ...pat, 'HEAD', ...scope]
      : face === 'staged'
        ? ['grep', '-I', '-l', '-i', '--cached', ...pat, ...scope]
        : ['grep', '-I', '-l', '-i', ...pat, ...scope]
  let out
  try {
    out = gitRaw(args, root)
  } catch (e) {
    // status 1 = git 说"一个都没匹配到"(不是没跑成)⇒ 交回空清单,由 assertNonEmptyScan 判死
    if (e instanceof Undetermined && e.status === 1) return []
    throw e
  }
  return String(out)
    .split(/\r?\n/)
    .map((s) => (face === 'head' ? s.replace(/^HEAD:/, '') : s).trim())
    .filter((s) => s.length > 0)
    .filter(inScanScope)
}

function readFace(root, face, files) {
  if (face === 'worktree') {
    const m = new Map()
    for (const f of files) m.set(f, readWorktreeFile(root, f))
    return m
  }
  const prefix = face === 'head' ? 'HEAD:' : ':'
  const revs = files.map((f) => `${prefix}${f}`)
  const batch = catBatch(root, revs)
  const m = new Map()
  files.forEach((f, i) => m.set(f, batch.get(revs[i]) ?? null))
  return m
}

export function loadBaseline(root) {
  const p = path.join(root, BASELINE_FILE)
  if (!existsSync(p)) return {}
  let parsed
  try {
    parsed = JSON.parse(readFileSync(p, 'utf8'))
  } catch (e) {
    throw new Undetermined(`${BASELINE_FILE} 不是合法 JSON,无法判棘轮: ${e.message}`)
  }
  if (!parsed || typeof parsed !== 'object' || !parsed.counts || typeof parsed.counts !== 'object') {
    throw new Undetermined(`${BASELINE_FILE} 缺 counts 字段,无法判棘轮`)
  }
  return parsed.counts
}

export function runScan(root, face) {
  const files = listCandidates(root, face)
  assertNonEmptyScan(files, face)
  const contents = readFace(root, face, files)
  const baseline = loadBaseline(root)
  const findings = []
  const undetermined = []
  const ratcheted = []
  for (const rel of files) {
    const text = contents.get(rel)
    if (typeof text !== 'string') {
      undetermined.push(rel)
      continue
    }
    const hits = scanContent(rel, text)
    if (hits.length === 0) continue
    const allowed = Number.isInteger(baseline[rel]) ? baseline[rel] : 0
    if (hits.length > allowed) findings.push({ rel, hits, allowed })
    else ratcheted.push({ rel, n: hits.length, allowed })
  }
  return { face, scanned: files.length, findings, undetermined, ratcheted }
}

function writeBaseline(root, res) {
  const counts = {}
  for (const r of res.ratcheted) counts[r.rel] = r.n
  for (const f of res.findings) counts[f.rel] = f.hits.length
  writeFileSync(
    path.join(root, BASELINE_FILE),
    JSON.stringify(
      {
        _readme:
          '每文件「token 数 ÷ contextLimit/contextWindow 且分母未经 effectiveContextWindow」的存量,只减不增。清理后跑 --update-baseline 下调额度,禁止为过门而调高。',
        counts,
      },
      null,
      2,
    ) + '\n',
    'utf8',
  )
  return Object.keys(counts).length
}

function report(res) {
  console.log(
    `压缩分母对账 · 判定面=${FACE_LABEL[res.face]} · 扫描 ${res.scanned} 个源文件 · 越线 ${res.findings.length} 个 · 基线内 ${res.ratcheted.length} 个/${res.ratcheted.reduce((a, b) => a + b.n, 0)} 处`,
  )
  for (const f of res.findings) {
    console.error(
      `❌ ${f.rel} 有 ${f.hits.length} 处除法分母未经 effectiveContextWindow(基线额度 ${f.allowed}):`,
    )
    for (const h of f.hits.slice(0, 8)) console.error(`   ${f.rel}:${h.line}  ${h.text}`)
    if (f.hits.length > 8) console.error(`   …另 ${f.hits.length - 8} 处`)
  }
  if (res.undetermined.length) {
    console.error(`⚠️  ${res.undetermined.length} 个文件在判定面取不到内容(不计通过):`)
    for (const r of res.undetermined.slice(0, 10)) console.error(`   ${r}`)
  }
}

function main(argv) {
  if (process.env[SKIP_ENV] === '1') {
    console.log(`⏭️  ${SKIP_ENV}=1 ⇒ 跳过压缩分母对账(应急,须在提交说明写明原因)`)
    return 0
  }
  const picked = selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree') })
  if (picked.error) {
    console.error(`❌ ${picked.error}`)
    return 2
  }
  try {
    assertRepoRoot(ROOT, '压缩分母对账')
    const res = runScan(ROOT, picked.face)
    if (argv.includes('--update-baseline')) {
      console.log(`✅ 已写 ${BASELINE_FILE}:${writeBaseline(ROOT, res)} 个文件登记存量`)
      return 0
    }
    report(res)
    if (res.findings.length) {
      console.error(
        '   出路:分母改走 @ihui/context-compaction 的 effectiveContextWindow({contextWindow, maxOutputTokens, buffer}),' +
          `或在 ${BASELINE_FILE} 如实登记存量(只允许下调)。`,
      )
      return 1
    }
    if (res.undetermined.length) {
      console.error('❌ 有文件取不到内容 ⇒ 无法判定(既不冒红也不记绿)')
      return 2
    }
    console.log('✅ 压缩分母全部经唯一出口 effectiveContextWindow')
    return 0
  } catch (e) {
    if (e instanceof Undetermined) {
      console.error(`❓ 无法判定:${e.message}`)
      return 2
    }
    throw e
  }
}

const CASES = [
  { name: 'V1 直接除 contextLimit ⇒ 红', src: 'const percent = lastPromptTokens / contextLimit;\n', expect: 1 },
  {
    name: 'V2 同一行,分母取自唯一出口 ⇒ 绿(与 V1 成对)',
    src:
      'const contextLimit = effectiveContextWindow({ contextWindow: opts.contextLimit });\n' +
      'const percent = lastPromptTokens / contextLimit;\n',
    expect: 0,
  },
  { name: 'V3 分母不是上下文语义 ⇒ 绿', src: 'const ratio = totalTokens / width;\n', expect: 0 },
  { name: 'V4 分子不是 token ⇒ 绿', src: 'const pct = width / contextWindow;\n', expect: 0 },
  {
    name: 'V5 同行直接调出口 ⇒ 绿',
    src: 'const pct = totalTokens / effectiveContextWindow({ contextWindow: raw });\n',
    expect: 0,
  },
  { name: 'V6 opts.contextLimit 形态 ⇒ 红(末段命中,成员访问不豁免)', src: 'const r = tokensBefore / opts.contextLimit;\n', expect: 1 },
  { name: 'V7 Math.floor 包裹的分母 ⇒ 红', src: 'const over = currentTokens / Math.floor(contextWindow * 0.88);\n', expect: 1 },
  {
    name: 'V8 行内豁免 ⇒ 绿',
    src: `const pct = lastPromptTokens / contextLimit; // ${EXEMPT_MARK}: 仅展示用占比\n`,
    expect: 0,
  },
  { name: 'V9 注释里的除号 ⇒ 绿(判据不得把叙述当代码)', src: '// lastPromptTokens / contextLimit > 0.88\nconst a = 1;\n', expect: 0 },
  {
    name: 'V9b 字符串里的除号是**报错文案**不是代码 ⇒ 绿(2026-09-25 由镜像测试 M3 抓到才补 —— 原本只剥注释不剥串)',
    src: 'console.error("溢出比率 = tokens / contextLimit,请重试")\n',
    expect: 0,
  },
  {
    name: 'V9c 与 V9b 成对:同一文件里真代码那一行照判红(补剥串不得顺手把判据剥钝)',
    src: 'console.error("溢出比率 = tokens / contextLimit,请重试")\nconst ratio = tokens / contextLimit\n',
    expect: 1,
  },
  {
    name: 'V9d 模板字符串里的除法**仍判**(反引号里可以真放代码,剥它会漏判 —— 取舍见 markHidden 头注)',
    src: 'const msg = `当前 ${tokens / contextLimit} 已超`\n',
    expect: 1,
  },
  {
    name: 'V10 消毒在另一行 ⇒ 绿(文件级判定)',
    src:
      'export function f(tokens: number, contextLimit: number) {\n  return tokens / contextLimit\n}\n' +
      'const contextLimit = effectiveContextWindow({ contextWindow: 1 });\n',
    expect: 0,
  },
  { name: 'V11 串内 http:// 不得把整行判成除法 ⇒ 绿', src: 'const u = "https://a/b" + totalTokens;\n', expect: 0 },
  { name: 'V12 自豁免:门自己的脚本路径 ⇒ 绿', src: 'const x = totalTokens / contextLimit;\n', expect: 0, rel: 'scripts/check-compaction-denominator.mjs' },
]

function selfTest() {
  let pass = 0
  let fail = 0
  const check = (name, ok, extra = '') => {
    if (ok) pass += 1
    else {
      fail += 1
      console.error(`❌ ${name}${extra ? `:${extra}` : ''}`)
    }
  }
  for (const c of CASES) {
    const got = scanContent(c.rel ?? 'apps/cli/src/__fixture.ts', c.src).length
    check(`${c.name}`, got === c.expect, `期望 ${c.expect} 处,实得 ${got} 处`)
  }
  // 反假绿对照:枚举到 0 个文件必须"无法判定",绝不得走到"绿"这条分支
  let threw = false
  try {
    assertNonEmptyScan([], 'head')
  } catch (e) {
    threw = e instanceof Undetermined
  }
  check('R1 空枚举必须判"无法判定"而非绿', threw)
  let passed = true
  try {
    assertNonEmptyScan(['apps/cli/src/x.ts'], 'head')
  } catch {
    passed = false
  }
  check('R2 非空枚举不得误杀', passed)
  // 棘轮方向:基线内的存量不判红,超出即红 —— 用纯函数面证(不依赖真仓瞬时状态)
  const src = 'const a = usedTokens / contextLimit;\nconst b = promptTokens / contextLimit;\n'
  check('R3 无基线时 2 处全计', scanContent('apps/cli/src/y.ts', src).length === 2)
  console.log(`压缩分母对账 --self-test:${pass} 通过 / ${fail} 失败(共 ${pass + fail} 条)`)
  return fail ? 1 : 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argv = process.argv.slice(2)
  try {
    process.exit(argv.includes('--self-test') ? selfTest() : main(argv))
  } catch (e) {
    console.error(`❌ ${e?.stack ?? e}`)
    process.exit(2)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
