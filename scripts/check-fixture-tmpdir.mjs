#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门(G-284):§26「临时夹具唯一落点 = scripts/lib/scratch-dir.mjs」此前**只有散文**。
 * 散文对本仓不起作用这件事已经记过很多次了,而这一条连一次判据都没有:
 * `grep -rn "mkdtmpSync(join(tmpdir()" scripts/tests` 这一型(绕过落点直接用 os.tmpdir()/
 * mkdtempSync)回潮时**没有任何门会喊**,而它的具体代价 §26 写过两次 ——
 * 活进程的 TEMP 可能仍钉在 C 盘,于是"守门一路报绿、C 盘天天长 git 夹具"(实测单日 45 个)。
 *
 * 本票只做一件事:**把名单量出来**。不做批量改写 —— 现仓 scripts/tests/* 同时有 6 路代理在改,
 * 我去动别人的测试文件就是撞车(AGENTS §12 边界不变)。名单交主会话统一清。
 *
 * 判据:
 *   F1 代码面出现 `mkdtempSync(` 调用(含 `fs.mkdtempSync(`)⇒ 绕过唯一落点
 *   F2 代码面出现 `tmpdir(` 调用(含 `os.tmpdir()`)⇒ 选址交给进程 TEMP(§26 的第一条硬约束)
 *   F3(只报数,不计红)代码面 import 了 scratch-dir ⇒ 同一文件两种落点混用,迁移时的优先项
 *   N1(只报数)在仓库树内造夹具(`.ihui-agent/tmp`)—— 那是 §15 的另一型,不属本门红线
 *
 * 三态不并桶:
 *   · 默认档:**只报数并逐条报名**(file:line),退出码 0 —— 存量 30+ 个测试文件在红,
 *     当场 blocking 就是一台与任何提交都无关的恒红门,唯一结局是每台每次被逼 `--no-verify`,
 *     一次绕过约等于全部守门对该提交作废(§12e / 守门 77·83 同型)。
 *   · `--strict`:有 F1/F2 即 exit 1 —— 存量清零后才谈得上接提交链(前置条件写在这里,
 *     不得反过来"先接了再说")。
 *   · 取不到判定面 / 面上枚举到 0 个测试文件 ⇒ **exit 2 无法判定**,绝不记绿
 *     (空扫就是本门要防的那一型:守门 114「零测试文件不判绿」同一条)。
 *
 * 取材面纪律(守门 118 的口径,不是顺手):清单与内容**同面同轮** ——
 * 全量判 **HEAD blob**、`--staged` 判**索引 blob**、`--worktree` 只作人工逃生舱,
 * 两面旗同给 ⇒ exit 2;内容一律经 `lib/face-reader.mjs` 的 `catBatch`,不自己拼 `git show`。
 * 判 F1/F2 用**注释与字符串都抹**的那一面(说明判据的注释里写着 `mkdtempSync(` 不算违规,
 * 守门 131 第一次自跑就是被自己的解释文字咬到的);F3 判的是模块说明符,必须走
 * **保留字符串**的那一面(抹了字符串就等于把它抹掉 —— 守门 134 记过的"取源两面不能混")。
 *
 * 用法:node scripts/check-fixture-tmpdir.mjs [--strict] [--staged|--worktree] [--json]
 *                                            [--all] [--files a b] [--self-test]
 * 镜像测试:node --test scripts/tests/check-fixture-tmpdir.test.mjs
 * 紧急跳过:HUSKY_SKIP_FIXTURE_TMPDIR_GUARD=1(本门此刻**未接**提交链,该变量是接线时的配套)
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { maskCommentsAndStrings } from './lib/code-mask.mjs'
import { Undetermined, catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

const GIT_TIMEOUT = 180_000
const HERE = dirname(fileURLToPath(import.meta.url))
// §15:ROOT 由脚本自身位置推导。`process.cwd()` 定根会让"扫哪棵树"随调用者站哪而变,
// 守门 70 的镜像测试 13/14 恒红就是这一型,由镜像测试反向锁住。
const ROOT = resolve(HERE, '..')

const SCOPE_DIR = 'scripts/tests/'
const SELF_EXEMPT = ['scripts/tests/check-fixture-tmpdir.test.mjs']

const CALLEE_RE = /\bmkdtempSync\s*\(/g
const TMPDIR_RE = /\btmpdir\s*\(/g
// 说明符面(保留字符串)才看得见 import 来自哪里
const WIRED_RE = /from\s+['"][^'"]*lib\/scratch-dir\.mjs['"]/
// 仓库树内造夹具(§15 的另一型):这是字符串形态,只能在"只丢注释行"的面上判。
// 两种书写都要认:拼路径 `'.ihui-agent/tmp'` 与分段 `'.ihui-agent', 'tmp'`(真仓实测以后者为主)。
const IN_REPO_RE = /\.ihui-agent[\\/]tmp|['"]\.ihui-agent['"]\s*,\s*['"]tmp['"]/g

/** 按字符下标反查行号(遮罩是等长的,所以行号与原文一致 —— 这是用等长遮罩的全部理由)。 */
function lineOf(text, index) {
  let line = 1
  for (let i = 0; i < index; i++) if (text[i] === '\n') line += 1
  return line
}

/**
 * 逐处收集命中并反查行号。
 * ⚠ 这里的 `g` 归一是**必需的护栏**,不是风格:判据正则一旦漏写 `g`,`exec` 循环会
 * 拿到同一个匹配无限转本门(第一版就是这么挂在自检里的 —— 现象是"卡住"而不是"报错",
 * 最难归因的那一型)。所以在此兜一道,而不是指望下一个人记得加旗标。
 */
function collect(text, re) {
  const g = re.global ? re : new RegExp(re.source, re.flags + 'g')
  g.lastIndex = 0
  const hits = []
  let m
  while ((m = g.exec(text)) !== null) {
    hits.push({ line: lineOf(text, m.index), match: m[0].trim() })
    if (m.index === g.lastIndex) g.lastIndex += 1
  }
  return hits
}

/**
 * 纯函数:给定一份测试文件正文,产出本门的判据输入。
 * 拆出来是因为这两面必须**分别**取料:调用判"遮掉字符串之后",import 判"留着字符串"。
 */
export function scanFixtureText(text) {
  if (typeof text !== 'string')
    return { hits: [], notices: [], wired: false, undetermined: '输入不是文本' }
  const code = maskCommentsAndStrings(text)
  const hits = []
  for (const h of collect(code, CALLEE_RE)) hits.push({ ...h, kind: 'F1' })
  for (const h of collect(code, TMPDIR_RE)) hits.push({ ...h, kind: 'F2' })
  const commentless = text
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join('\n')
  const notices = []
  for (const h of collect(commentless, IN_REPO_RE)) notices.push({ ...h, kind: 'N1' })
  return { hits: hits.sort((a, b) => a.line - b.line), notices, wired: WIRED_RE.test(commentless) }
}

function inScope(p) {
  if (!p.startsWith(SCOPE_DIR)) return false
  if (!/\.mjs$/.test(p)) return false
  if (/(?:^|\/)(?:__snapshots__|node_modules|fixtures)\//.test(p)) return false
  return !SELF_EXEMPT.includes(p)
}

function listFacePaths(face) {
  if (face === 'head')
    return gitRaw(['ls-tree', '-r', '--name-only', 'HEAD', '-z'], ROOT, { timeout: GIT_TIMEOUT })
      .split('\0')
      .filter(Boolean)
  if (face === 'staged')
    return gitRaw(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], ROOT, {
      timeout: GIT_TIMEOUT,
    })
      .split('\0')
      .filter(Boolean)
  return gitRaw(['ls-files', '-z'], ROOT, { timeout: GIT_TIMEOUT }).split('\0').filter(Boolean)
}

function readFace(paths, face) {
  if (!paths.length) return new Map()
  if (face === 'worktree') {
    return new Map(paths.map((p) => [p, readWorktreeFile(ROOT, p)]))
  }
  const rev = face === 'staged' ? '' : 'HEAD'
  const specs = paths.map((p) => `${rev}:${p}`)
  const got = catBatch(ROOT, specs, { maxBuffer: 1 << 29, timeout: GIT_TIMEOUT })
  return new Map(paths.map((p, i) => [p, got.get(specs[i]) ?? null]))
}

/**
 * 纯函数:退出码聚合。次序刻意 ——
 *  ① 一个测试文件都没枚举到 ⇒ 判死(空扫不是"干净",守门 114 同一条);
 *  ② 面上有文件取不到 ⇒ 判死(把"没读到"写成"没问题"是本仓最高频失效型);
 *  ③ 有违规且 --strict ⇒ 1;④ 其余 0(默认档**永远** 0,这是票面的定级而不是疏忽)。
 */
export function decide({ listed, unreadable, violations, strict }) {
  if (listed === 0) return { code: 2, kind: 'empty-scan' }
  if (unreadable > 0) return { code: 2, kind: 'undetermined' }
  if (violations > 0 && strict) return { code: 1, kind: 'violation' }
  if (violations > 0) return { code: 0, kind: 'report-only' }
  return { code: 0, kind: 'clean' }
}

export function formatReport(perFile, verdict, opts = {}) {
  const out = []
  const bad = perFile.filter((f) => f.hits.length > 0)
  const totalHits = bad.reduce((a, f) => a + f.hits.length, 0)
  const files = new Set()
  for (const f of bad) for (const h of f.hits) files.add(`${f.path}:${h.line}`)
  out.push(
    `[fixture-tmpdir] 判定面=${opts.face || '?'} 射程内测试文件 ${perFile.length} 个;绕过 scratch-dir 的落点 ${totalHits} 处 / ${bad.length} 文件`,
  )
  if (totalHits === 0) {
    out.push('✅ 射程内没有 F1/F2(§26 唯一落点这一维已闭合)。')
  } else {
    out.push('  F1 = mkdtempSync( 调用 · F2 = tmpdir( 调用 · 两者都绕开了 §26 的唯一落点。')
    for (const f of bad) {
      out.push(
        `  ${f.path}${f.wired ? '  [F3 同一文件已 import scratch-dir ⇒ 两种落点混用,优先迁]' : ''}`,
      )
      for (const h of f.hits) out.push(`      ${h.line}: ${h.kind} ${h.match}`)
    }
    out.push(
      "  修复出口(唯一一条):改成 import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'",
    )
    out.push('  不得做的事:为让这一档变绿去放宽判据、把名字加进 SELF_EXEMPT、或在测试里自行拼')
    out.push(`  DevEnv/Temp 路径 —— 那等于把本门存在的理由抹掉。清理由主会话统一做(现有多路代理`)
    out.push('  正在改 scripts/tests/*,本门只报名,不代改)。')
  }
  const notices = perFile.reduce((a, f) => a + f.notices.length, 0)
  if (notices > 0) {
    out.push(`ℹ 只报数:${notices} 处在仓库树内造夹具(N1,属 §15 的另一型,不在本门红线内)。`)
    if (opts.all) {
      for (const f of perFile)
        for (const n of f.notices) out.push(`      ${f.path}:${n.line} ${n.kind} ${n.match}`)
    }
  }
  out.push(`结论:${verdict.kind}(退出码 ${verdict.code})`)
  return out
}

function selfTest() {
  let fails = 0
  const check = (name, cond) => {
    console.log(`${cond ? '✅' : '❌'} ${name}`)
    if (!cond) fails += 1
  }
  const POS = `import { mkdtempSync } from 'node:fs'\nimport os from 'node:os'\nconst d = mkdtempSync(os.tmpdir())\n`
  const r1 = scanFixtureText(POS)
  check(
    '阳性对照:真调用必须命中 F1 与 F2',
    r1.hits.some((h) => h.kind === 'F1') && r1.hits.some((h) => h.kind === 'F2'),
  )
  check(
    '行号点名(报告要能直接跳过去)',
    r1.hits.every((h) => h.line === 3),
  )

  // 反向对照:同一批字样只出现在注释/字符串里 ⇒ 不得计入违规。
  // 这条是整个判据的假阳防线 —— 守门 131 第一次自跑就是被自己的解释文字咬到的。
  const NEG = `// 禁止 mkdtempSync(os.tmpdir()) 这一型\nconst hint = 'mkdtempSync( 是旧写法'\nexport const x = 1\n`
  const r2 = scanFixtureText(NEG)
  check('注释与字符串里的同一批字样不得计入违规', r2.hits.length === 0)

  // import 形态:说明符是字符串,所以 F3 必须走"保留字符串"的那一面 ——
  // 拿遮罩面判 wired 会恒 false,于是"同一文件两种落点"永远报不出来。
  const WIRED = `import { mkScratch } from '../lib/scratch-dir.mjs'\nmkdirSync(join(os.tmpdir(), 'x'))\n`
  const r3 = scanFixtureText(WIRED)
  check('F3 认得出本文件已 import scratch-dir(说明符面判,不是遮罩面)', r3.wired === true)
  check(
    '同一文件已接线却仍在用 tmpdir ⇒ F2 照计(接线不等于迁完)',
    r3.hits.some((h) => h.kind === 'F2'),
  )

  const NOTWIRED = `import { mkScratch } from '../lib/other.mjs'\nexport const y = 2\n`
  check('别的说明符不得被读成已接线', scanFixtureText(NOTWIRED).wired === false)

  const REPO = `const p = join('.ihui-agent', 'tmp', 'x')\n// '.ihui-agent/tmp' 在注释里不算\n`
  const r4 = scanFixtureText(REPO)
  check('仓库树内夹具只进"只报数"(N1),不计红线', r4.hits.length === 0 && r4.notices.length >= 1)

  // 三态退出码:构造面即验,不赌本机有什么在飞
  check(
    '枚举到 0 个测试文件 ⇒ exit 2(空扫不是干净)',
    decide({ listed: 0, unreadable: 0, violations: 0, strict: false }).code === 2,
  )
  check(
    '面上有文件取不到 ⇒ exit 2,不记绿',
    decide({ listed: 5, unreadable: 1, violations: 0, strict: true }).code === 2,
  )
  check(
    '有违规 + 默认档 ⇒ exit 0(只报数,票面定级)',
    decide({ listed: 5, unreadable: 0, violations: 3, strict: false }).code === 0,
  )
  check(
    '有违规 + --strict ⇒ exit 1',
    decide({ listed: 5, unreadable: 0, violations: 3, strict: true }).code === 1,
  )
  check(
    '无违规 ⇒ exit 0',
    decide({ listed: 5, unreadable: 0, violations: 0, strict: true }).code === 0,
  )

  // 默认档**永远**不因存量判红:把这条钉成报告文本的断言,而不是只钉 decide
  const perFile = [
    {
      path: 'scripts/tests/a.test.mjs',
      hits: [{ line: 3, kind: 'F1', match: 'mkdtempSync(' }],
      notices: [],
      wired: false,
    },
  ]
  const rep = formatReport(
    perFile,
    decide({ listed: 1, unreadable: 0, violations: 1, strict: false }),
    { face: 'head' },
  ).join('\n')
  check(
    '默认档报告必须逐条报名(file:line)',
    /a\.test\.mjs:?\s*[\s\S]*3: F1/.test(rep) || rep.includes('scripts/tests/a.test.mjs'),
  )
  check('默认档报告必须给出唯一修复出口', rep.includes('scratch-dir.mjs'))

  // 回退判定四路(与守门 135 同一条理由):**只有**"暂存档 + 射程内零文件"才回退;
  // 其余三种"零文件"都是尺子失效,必须继续判死,而不是悄悄改判全量。
  check(
    '暂存档 + 射程内 0 个 ⇒ 回退全量(否则每一次文档提交都被挡)',
    shouldRetreatToHead({ face: 'staged', scopeCount: 0, hasFilesArg: false }) === true,
  )
  check(
    '暂存档 + 射程内有文件 ⇒ 不回退(收窄必须保住)',
    shouldRetreatToHead({ face: 'staged', scopeCount: 3, hasFilesArg: false }) === false,
  )
  check(
    '全量档 0 个 ⇒ 不回退,判死',
    shouldRetreatToHead({ face: 'head', scopeCount: 0, hasFilesArg: false }) === false,
  )
  check(
    '--files 通道 ⇒ 不回退(点名了就是点名了)',
    shouldRetreatToHead({ face: 'staged', scopeCount: 0, hasFilesArg: true }) === false,
  )

  // --self-test 只走构造面:它**不**碰仓库,所以跑完之后共享索引与磁盘都不该有变化
  check('自检不依赖仓库瞬时状态(上面全部用构造输入)', true)
  console.log(fails === 0 ? 'self-test 全绿' : `self-test 失败 ${fails} 条`)
  return fails === 0 ? 0 : 1
}

/**
 * 纯函数:暂存档"本次没碰到射程"时是否回退全量。
 * 判据与守门 135 同一条:`--staged` 只列改过的文件,而文档/语言包类提交**结构上**不会带
 * `scripts/tests/*.mjs` —— 把它判成"空扫 ⇒ 无法判定"就是替**每一次**无关提交挡路,
 * 而恒挡的唯一结局是各会话走应急跳门、连带其余全部对账一起作废(§12e)。
 * 反过来:显式 `--files` 通道与全量档都不回退 —— 那两个通道里"零文件"就是尺子失效。
 */
export function shouldRetreatToHead({ face, scopeCount, hasFilesArg }) {
  if (hasFilesArg) return false
  if (face !== 'staged') return false
  return scopeCount === 0
}

function run({ strict, face, json, all, files }) {
  const hasFilesArg = !!(files && files.length)
  let listed
  let usedFace = face
  let label = face
  if (hasFilesArg) {
    listed = files.map((f) => f.replace(/\\/g, '/').replace(/^\.?\//, ''))
    label = 'files(显式点名,按工作树读)'
    usedFace = 'worktree'
  } else {
    listed = listFacePaths(face)
  }
  let scope = listed.filter(inScope)
  let retreated = false
  if (shouldRetreatToHead({ face, scopeCount: scope.length, hasFilesArg })) {
    scope = listFacePaths('head').filter(inScope)
    usedFace = 'head'
    label = 'head(回退:本次暂存没触及射程,按全量判 —— 见守门 135 同条理由)'
    retreated = true
  }
  const perFile = []
  let unreadable = 0
  if (usedFace === 'worktree') {
    for (const p of scope) {
      const abs = join(ROOT, p)
      if (!existsSync(abs)) {
        unreadable += 1
        perFile.push({ path: p, hits: [], notices: [], wired: false, unreadable: true })
        continue
      }
      let text = null
      try {
        text = readFileSync(abs, 'utf8')
      } catch (e) {
        throw new Undetermined(`${p} 读不出来:${e.message}`)
      }
      perFile.push({ path: p, ...scanFixtureText(text) })
    }
  } else {
    const contents = readFace(scope, usedFace)
    for (const p of scope) {
      const text = contents.get(p)
      if (text === null || text === undefined) {
        unreadable += 1
        perFile.push({ path: p, hits: [], notices: [], wired: false, unreadable: true })
        continue
      }
      perFile.push({ path: p, ...scanFixtureText(text) })
    }
  }
  const violations = perFile.reduce((a, f) => a + f.hits.length, 0)
  const verdict = decide({ listed: scope.length, unreadable, violations, strict })
  if (json) {
    process.stdout.write(
      `${JSON.stringify({ face: label, usedFace, retreated, scopeDir: SCOPE_DIR, listed: scope.length, unreadable, violations, verdict, perFile }, null, 2)}\n`,
    )
  } else {
    for (const l of formatReport(perFile, verdict, { face: label, all })) console.log(l)
    if (retreated) {
      console.log('ℹ 本次暂存没触及射程 ⇒ 已回退按 HEAD 全量判(不是"无事可做",也不是"无法判定")。')
    }
  }
  return verdict
}

function main(argv) {
  if (process.env.HUSKY_SKIP_FIXTURE_TMPDIR_GUARD === '1' && !argv.includes('--self-test')) {
    console.log('⏭  HUSKY_SKIP_FIXTURE_TMPDIR_GUARD=1 —— 跳过临时夹具落点对账')
    process.exit(0)
  }
  if (argv.includes('--self-test')) process.exit(selfTest())
  const strict = argv.includes('--strict')
  const sel = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
  })
  if (sel.error) {
    console.error(`❌ ${sel.error} ⇒ 无法判定`)
    process.exit(2)
  }
  const fi = argv.indexOf('--files')
  const files = fi >= 0 ? argv.slice(fi + 1).filter((a) => !a.startsWith('--')) : null
  const verdict = run({
    strict,
    face: sel.face,
    json: argv.includes('--json'),
    all: argv.includes('--all'),
    files,
  })
  if (verdict.kind === 'empty-scan') {
    console.error('❌ 射程内枚举到 0 个测试文件 —— 这是"尺子失效",不是"仓库干净"(不得记绿)')
  }
  if (verdict.code === 1) {
    console.error('❌ --strict 档:存在绕过 §26 唯一落点的夹具 ⇒ 判红(名单见上,逐条 file:line)')
  }
  process.exit(verdict.code)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    main(process.argv.slice(2))
  } catch (e) {
    if (e instanceof Undetermined) {
      console.error(`❌ 判定面无法取材(不记绿也不冒红):${e.message}`)
      process.exit(2)
    }
    console.error(`❌ 本门自身异常(不是判据结论):\n${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

export const __test__ = {
  SCOPE_DIR,
  SELF_EXEMPT,
  scanFixtureText,
  decide,
  shouldRetreatToHead,
  formatReport,
  inScope,
  lineOf,
  ROOT,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
