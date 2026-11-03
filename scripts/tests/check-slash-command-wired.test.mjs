// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像测试:scripts/check-slash-command-wired.mjs(§22c —— 要判据就 import 源脚本导出的实现,
 * **不在这里复制第二份**;本文件只打四类东西:
 *
 *  1. **装车证明**(T1/T2):注册表里必须真有这一条,且 `mode:'blocking'` 与 `skipEnv` 齐备;
 *     反向的那一半(T2)是把那一条摘掉后**同一把定位器**必须报"未装车" —— 缺了它,"找不到条目"
 *     与"找到了但定级不对"在账面上长得一样,而"门存在、判据对、无人调度"是本仓最高频的假绿。
 *  2. **端到端双向锁**(T5):私有索引里注入真代码的缺失分支 ⇒ 必红;把同一形态只写进注释 ⇒
 *     必绿(门不得判自己的散文)。两条同时成立才算"遮噪关掉的是误报、不是判据"。
 *  3. **三面三答 + CLI 契约**(T6/T7/T8):HEAD/索引/磁盘互异时各答各的;两面旗同给 exit 2;
 *     取不到 ⇒ exit 2 而不是记绿;`--json` 必须可 parse。
 *  4. **源码级反向锁**(T3/T4):遮罩只许引 lib/code-mask 那一份、不得自带分词器;定根不得回
 *     到 `process.cwd()`;内容取材不得回到磁盘 `readFileSync`;索引档前导冒号不得丢。
 *     这类失效只有源码锁能防 —— 行为断言会跟着实现一起漂绿(守门 70/103/131 各记过一次)。
 *
 * 判据本体的正反成对用例住在 `--self-test`,这里刻意不重跑一遍(重跑就是把测试变成复读机)。
 * 例数与分档读数一律以命令末行现读为准,本文不钉数字。
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'

const GATE_REL = 'check-slash-command-wired.mjs'
const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPTS_DIR = resolve(HERE, '..')
const REPO = resolve(SCRIPTS_DIR, '..')
const GIT = resolveGitBin() || 'git'
const SRC = readFileSync(join(SCRIPTS_DIR, GATE_REL), 'utf8')
const REGISTRY_REL = 'apps/cli/src/commands/slash-registry.ts'
const REPL_REL = 'apps/cli/src/commands/repl.ts'
const SKIP_ENV = 'HUSKY_SKIP_SLASH_COMMAND_WIRED'

const REGISTRY = `export interface SlashCommandMeta { name: string }\nexport const SLASH_COMMANDS: readonly SlashCommandMeta[] = [\n  { name: 'alpha', usage: '/alpha [a|b]', category: 'basic' },\n  { name: 'beta', aliases: ['gg'], description: 'the name: decoy', usage: '/beta', category: 'basic' },\n];\n`
const REPL_CLEAN = `async function handleSlashCommand(input: string) {\n  const cmd = input.slice(1);\n  switch (cmd) {\n    case 'alpha':\n      runA();\n      break;\n    case 'beta':\n      runB();\n      break;\n    case 'gg':\n      runB();\n      break;\n    default:\n      console.info('未知命令');\n  }\n}\n`

function gitIn(dir, args) {
  return execFileSync(GIT, ['-c', 'safe.directory=*', '-C', dir, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
    maxBuffer: 32 << 20,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function put(dir, rel, text) {
  const abs = join(dir, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, text, 'utf8')
}

/** 造一棵只有这两个被审路径的临时 git 仓(HEAD 面 = 干净合规的那一份)。 */
function writeRepo(dir, { registry = REGISTRY, repl = REPL_CLEAN, commit = true } = {}) {
  gitIn(dir, ['init', '-q', '-b', 'main'])
  gitIn(dir, ['config', 'user.email', 'fixture@example.invalid'])
  gitIn(dir, ['config', 'user.name', 'fixture'])
  put(dir, REGISTRY_REL, registry)
  put(dir, REPL_REL, repl)
  if (commit) {
    gitIn(dir, ['add', '-A'])
    gitIn(dir, ['commit', '-q', '-m', 'fixture'])
  }
}

function run(dir, args) {
  try {
    const out = execFileSync(process.execPath, [join(dir, 'scripts', GATE_REL), ...args], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 180000,
      maxBuffer: 64 << 20,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { code: 0, out }
  } catch (e) {
    return { code: typeof e?.status === 'number' ? e.status : -1, out: `${e?.stdout ?? ''}${e?.stderr ?? ''}` }
  }
}

function parse(r) {
  try {
    return { code: r.code, j: JSON.parse(r.out) }
  } catch {
    throw new Error(`--json 输出不可 parse(exit ${r.code}):${r.out.slice(0, 240)}`)
  }
}

/** 大括号配对从注册表文本里取出 script 为本门的那一条注册项(取"前后 400 字符"会跨进邻门)。 */
function locateEntry(runnerText, script) {
  const at = runnerText.indexOf(`script: '${script}'`)
  if (at < 0) return null
  const open = runnerText.lastIndexOf('{', at)
  let depth = 0
  for (let i = open; i < runnerText.length; i++) {
    if (runnerText[i] === '{') depth += 1
    else if (runnerText[i] === '}') {
      depth -= 1
      if (depth === 0) return runnerText.slice(open, i + 1)
    }
  }
  return null
}

/** 注册表取材面:HEAD 优先,HEAD 里没有再看索引(同枚提交里两者应一致;只在索引时如实报面)。 */
function runnerFaces() {
  const out = []
  for (const [label, spec] of [
    ['HEAD', 'HEAD:scripts/guardian-runner.mjs'],
    ['索引', ':scripts/guardian-runner.mjs'],
  ]) {
    try {
      // 2026-10-04：不吃的子进程必须给 stdio，否则本机报 spawnSync EBUSY
      out.push({ label, text: execFileSync(GIT, ['-c', 'safe.directory=*', '-C', REPO, 'show', spec], { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', windowsHide: true, timeout: 120000, maxBuffer: 64 << 20 }) })
    } catch {
      /* 该面取不到就少一面,由调用方判"两面无条目" */
    }
  }
  return out
}

test('T1 装车证明:注册表里有本门条目且 mode:blocking + skipEnv 齐备', () => {
  const faces = runnerFaces()
  const hits = faces.map((f) => ({ face: f.label, entry: locateEntry(f.text, GATE_REL) })).filter((h) => h.entry)
  if (hits.length === 0)
    throw new Error(
      `本门未接进提交链(在 ${faces.map((f) => f.label).join('/')||'无'} 面上都找不到 script:'${GATE_REL}') —— "门存在、判据对、无人调度"就是没有这道门`,
    )
  const entry = hits[0].entry
  if (!/mode:\s*'blocking'/.test(entry)) throw new Error(`注册条目必须是 blocking,实得:${entry}`)
  if (!entry.includes(`skipEnv: '${SKIP_ENV}'`)) throw new Error(`注册条目必须带 skipEnv=${SKIP_ENV},实得:${entry}`)
  if (!/(^|\n)\s*id:\s*'?\d+'?,/.test(entry)) throw new Error(`条目必须带 id(现读,不硬写编号):${entry.slice(0, 80)}`)
})

test('T2 摘线不得被读成已装车:把条目删掉,同一把定位器必须报未装车', () => {
  const faces = runnerFaces()
  const withEntry = faces.find((f) => locateEntry(f.text, GATE_REL))
  if (!withEntry) return // T1 已经在这台机上判红;这里不能把"未接线"再判成测试失败(那是重复计债)
  const stripped = withEntry.text.replace(locateEntry(withEntry.text, GATE_REL), '{ },')
  if (locateEntry(stripped, GATE_REL) !== null)
    throw new Error('定位器在条目被摘掉后仍命中 ⇒ 它对"摘线"失明,T1 的合格证不作数')
})

test('T3 遮罩只许一份实现:引 lib/code-mask,不得自带分词器', () => {
  if (!SRC.includes("from './lib/code-mask.mjs'"))
    throw new Error('未引 lib/code-mask.mjs ⇒ 门自带遮噪器(24 道门被判 no-content 的那一型)')
  for (const own of ['function scanSpans', 'function maskComments', 'function readStringSpan', 'function blankStrings'])
    if (SRC.includes(own)) throw new Error(`门里出现了第二份遮罩实现:${own}`)
})

test('T4 取材面反向锁:内容走 catBatch、定根不走 cwd、索引档前导冒号在位', () => {
  if (!SRC.includes('catBatch(')) throw new Error('内容未经 face-reader 的 catBatch ⇒ 判定面不可信')
  if (!SRC.includes("def: 'head'")) throw new Error('selectFace 缺省档必须是 HEAD(默认档判磁盘 = 本仓反复登记的恒红/假绿来回跳)')
  if (/process\.cwd\(\)/.test(SRC)) throw new Error('不得用 process.cwd() 定根(守门 70 的 13/14 恒红那一型)')
  if (!SRC.includes(`'staged' ? ':' : 'HEAD:'`)) throw new Error('索引档的前导冒号形态不见了 ⇒ --staged 会恒"取不到"(守门 117)')
  if (/readFileSync\(/.test(SRC)) throw new Error('被审内容不得按磁盘 readFileSync 取(工作树面只许走 readWorktreeFile)')
})

test('T5 端到端双向锁:删真 case 必红、同一形态只写进注释必绿', () => {
  const dir = mkScratch('scw-bi-')
  try {
    writeRepo(dir)
    copyScriptWithClosure(SCRIPTS_DIR, GATE_REL, join(dir, 'scripts'))
    const base = parse(run(dir, ['--root', dir, '--json']))
    if (base.code !== 0 || base.j.counts.names !== 2 || base.j.counts.aliases !== 1)
      throw new Error(`夹具基线应 0 红 / 2 名 / 1 别名,实得 ${base.code} ${JSON.stringify(base.j.counts)}`)

    // A) 索引里删掉 beta 的真 case ⇒ --staged 必须点名 beta(W1)
    const noBeta = REPL_CLEAN.replace("    case 'beta':\n      runB();\n      break;\n", '')
    put(dir, REPL_REL, noBeta)
    gitIn(dir, ['add', REPL_REL])
    const a = parse(run(dir, ['--root', dir, '--staged', '--json']))
    if (a.code !== 1 || !a.j.red.some((f) => f.code === 'W1' && f.name === 'beta'))
      throw new Error(`删一个 case 必须翻红并点名 beta,实得 exit ${a.code} ${JSON.stringify(a.j.red)}`)

    // B) 被删的那条**只写在注释里** ⇒ 仍然红(注释不是活分支,一句注释不得骗过 W1)
    put(dir, REPL_REL, noBeta.replace('    default:', "    // case 'beta': 忘了接线\n    default:"))
    gitIn(dir, ['add', REPL_REL])
    const b = parse(run(dir, ['--root', dir, '--staged', '--json']))
    if (b.code !== 1 || !b.j.red.some((f) => f.name === 'beta'))
      throw new Error(`case 只在注释里不得被读成已接线,实得 exit ${b.code}`)

    // C) 未注册的名字只出现在注释里 ⇒ 必绿(门不判自己的散文;这条与 B 方向相反,缺一不可)
    put(dir, REPL_REL, `${REPL_CLEAN}`.replace('    default:', "    // case 'ghost': 只是说明\n    default:"))
    gitIn(dir, ['add', REPL_REL])
    const c = parse(run(dir, ['--root', dir, '--staged', '--json']))
    if (c.code !== 0 || c.j.notice.length !== 0)
      throw new Error(`散文里的 case 形态不得造出违规(连报数都不该有),实得 exit ${c.code} ${JSON.stringify(c.j.red.concat(c.j.notice))}`)

    // D) 真代码里的漂移分支 ⇒ 默认档只报数、--strict 才判红(存量不得变成恒红门)
    put(dir, REPL_REL, REPL_CLEAN.replace('    default:', "    case 'ghost':\n      runG();\n      break;\n    default:"))
    gitIn(dir, ['add', REPL_REL])
    const d = parse(run(dir, ['--root', dir, '--staged', '--json']))
    const ds = parse(run(dir, ['--root', dir, '--staged', '--strict', '--json']))
    if (d.code !== 0 || d.j.notice.length !== 1)
      throw new Error(`默认档 W3 应只报数,实得 exit ${d.code} ${JSON.stringify(d.j.notice)}`)
    if (ds.code !== 1 || !ds.j.red.some((f) => f.code === 'W3' && f.name === 'ghost'))
      throw new Error(`--strict 应把 W3 升为判红,实得 exit ${ds.code}`)

    // E) 注册表改名 ⇒ 判"未判定"而不是"零命令通过"
    put(dir, REGISTRY_REL, REGISTRY.replace('SLASH_COMMANDS', 'RENAMED_COMMANDS'))
    gitIn(dir, ['add', REGISTRY_REL])
    const e = parse(run(dir, ['--root', dir, '--staged', '--json']))
    if (e.code !== 2 || !e.j.undetermined.some((u) => u.code === 'U1'))
      throw new Error(`结构改名必须落未判定,实得 exit ${e.code}`)
  } finally {
    rmScratch(dir)
  }
})

test('T6 三面三答:HEAD 干净 / 索引脏 / 磁盘第三份,各答各的且不互相回落', () => {
  const dir = mkScratch('scw-face-')
  try {
    writeRepo(dir)
    copyScriptWithClosure(SCRIPTS_DIR, GATE_REL, join(dir, 'scripts'))
    const dirty = REPL_CLEAN.replace("    case 'gg':\n      runB();\n      break;\n", '')
    put(dir, REPL_REL, dirty)
    gitIn(dir, ['add', REPL_REL])
    // 磁盘再改**注册表**(重复登记 alpha)⇒ 只有 --worktree 看得见 W2,索引与 HEAD 都看不见
    put(
      dir,
      REGISTRY_REL,
      REGISTRY.replace("  { name: 'beta',", "  { name: 'alpha', usage: '/alpha two', category: 'basic' },\n  { name: 'beta',"),
    )
    const h = parse(run(dir, ['--root', dir, '--json']))
    const s = parse(run(dir, ['--root', dir, '--staged', '--json']))
    const w = parse(run(dir, ['--root', dir, '--worktree', '--json']))
    if (h.code !== 0) throw new Error(`HEAD 面是合规那份,应 0 红,实得 ${h.code}:${JSON.stringify(h.j.red)}`)
    if (s.code !== 1 || !s.j.red.some((f) => f.code === 'W1' && f.name === 'gg'))
      throw new Error(`--staged 必须判索引里缺 gg 的那份,实得 ${s.code}`)
    if (s.j.red.some((f) => f.code === 'W2'))
      throw new Error('磁盘上才有的重复登记不得算进索引档(那才是"混面取数"的假账)')
    if (w.j.face !== 'worktree' || !w.j.red.some((f) => f.code === 'W2' && f.name === 'alpha'))
      throw new Error(`--worktree 必须答磁盘那份的 W2,实得 ${w.j.face} ${JSON.stringify(w.j.red)}`)
  } finally {
    rmScratch(dir)
  }
})

test('T7 CLI 契约:两面旗同给 exit 2;无提交(取不到面)不得记绿', () => {
  const dir = mkScratch('scw-cli-')
  try {
    writeRepo(dir, { commit: false })
    copyScriptWithClosure(SCRIPTS_DIR, GATE_REL, join(dir, 'scripts'))
    const both = run(dir, ['--root', dir, '--staged', '--worktree', '--json'])
    if (both.code !== 2) throw new Error(`--staged 与 --worktree 同用必须 exit 2,实得 ${both.code}`)
    const noCommit = run(dir, ['--root', dir, '--json'])
    if (noCommit.code !== 2) throw new Error(`没有任何提交 ⇒ 必须"无法判定"exit 2,不得记绿,实得 ${noCommit.code}`)
  } finally {
    rmScratch(dir)
  }
})

test('T8 真仓阳性对照(现读 import 源实现):看不见存量不算通过,HEAD 面必须零红', async () => {
  const mod = await import(pathToFileURL(join(SCRIPTS_DIR, GATE_REL)).href)
  const r = mod.analyze(REPO, 'head', false)
  if (r.exit !== 0) throw new Error(`本门在干净 HEAD 上必须不红(否则就是恒红门),实得 exit ${r.exit}:${JSON.stringify(r.red)}`)
  if (!(r.counts.names >= 30)) throw new Error(`现读注册名应 ≥30(枚举到 0 不是通过),实得 ${r.counts.names}`)
  if (r.red.some((f) => f.code === 'W3')) throw new Error('默认档 W3 不得进红侧')
  if (r.notice.length > 0 && !r.notice.every((n) => n.name && n.line > 0))
    throw new Error('W3 报数必须逐条点名(名字 + 行号),不得只给一个计数')
  const strict = mod.analyze(REPO, 'head', true)
  if (strict.red.length !== r.notice.length)
    throw new Error('--strict 只应把 W3 挪进红侧,其余维不得动')
})

test('T9 W2 棘轮无关:重复注册名当场判红(零容忍,HEAD 面实测 0 ⇒ 不是恒红门)', () => {
  const dir = mkScratch('scw-dup-')
  try {
    const dupReg = REGISTRY.replace("{ name: 'alpha', usage: '/alpha [a|b]', category: 'basic' },", "{ name: 'alpha', usage: '/alpha', category: 'basic' },\n  { name: 'alpha', usage: '/alpha again', category: 'basic' },")
    writeRepo(dir, { registry: dupReg })
    copyScriptWithClosure(SCRIPTS_DIR, GATE_REL, join(dir, 'scripts'))
    const r = parse(run(dir, ['--root', dir, '--json']))
    if (r.code !== 1 || !r.j.red.some((f) => f.code === 'W2' && f.name === 'alpha'))
      throw new Error(`重复注册名必须当场判红,实得 exit ${r.code} ${JSON.stringify(r.j.red)}`)
  } finally {
    rmScratch(dir)
  }
})

test('T10 W4:兜底 default 被摘 ⇒ 判红(未知命令静默吞掉不得放过)', () => {
  const dir = mkScratch('scw-def-')
  try {
    writeRepo(dir, { repl: REPL_CLEAN.replace(/ {4}default:\n {6}console\.info\('未知命令'\);\n/, '') })
    copyScriptWithClosure(SCRIPTS_DIR, GATE_REL, join(dir, 'scripts'))
    const r = parse(run(dir, ['--root', dir, '--json']))
    if (r.code !== 1 || !r.j.red.some((f) => f.code === 'W4')) throw new Error(`缺 default 必须判 W4,实得 exit ${r.code}`)
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
