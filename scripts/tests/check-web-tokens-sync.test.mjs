// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:守门 37 `scripts/check-web-tokens-sync.mjs`
// §22c:判据函数**直接 import 源符号**,不在测试里复制第二份实现(复制的那份最先腐烂)。
//
// 这一票只做一件事:**换取材来源**(磁盘 → 统一取材层),判据语义一个字不许改。
// 所以本文件两类断言必须同时在场,缺一类就等于没测:
//   · **判据不变**(J 组):什么算违规、@media 里的 :root 不算、源头 @theme 空只是 WARN 不判红、
//     退出码 0/1 的含义 —— 这些在收口前后必须逐字同结论;
//   · **取材面**(F 组):默认判 HEAD blob / `--staged` 判索引 blob / `--worktree` 只作人工逃生舱 /
//     两面旗同给判死 / 任一面取不到 ⇒ exit 2 且**不回落** / 枚举到 0 个被审文件 ⇒ 判死不记绿。
//
// ⚠️ 判定面**不能**拿真仓取证:真仓此刻三面同结论(被审的两个文件都没人在飞),
// 在这种状态上写"读的是哪一面"的断言是恒绿的。所以 F2/F3/F4 在 `mkScratch` 临时 git 仓里
// 造「HEAD ≠ 索引 ≠ 磁盘」的现场(演练仓自带 .git,因此它的索引天然私有 —— **共享主索引零触碰**)。
// 而 J 组/T4 的真仓用例刻意只断言"面被写明"和"三面都不判不了",不断言红/绿,免得把别人
// 未提交的在飞内容算成本仓债务。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync, execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'
import { gitBinary, Undetermined } from '../lib/face-reader.mjs'
import { __test__ as gate } from '../check-web-tokens-sync.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const SCRIPTS_DIR = resolve(REPO, 'scripts')

const WEB_REL = 'apps/web/app/globals.css'
const TOKENS_REL = 'packages/design-tokens/src/styles/tokens.css'
const GATE_NAME = 'check-web-tokens-sync.mjs'

// 夹具:源头两档;合规副本 = 两条 @import + 一个 @media 内的 :root(必须放过)。
const TOKENS_FIX = '@theme {\n  --color-alpha: #111111;\n  --color-beta: #222222;\n}\n'
const CLEAN =
  '@import "../../../packages/design-tokens/src/styles/tokens.css";\n' +
  '@import "../../../packages/design-tokens/src/styles/base.css";\n' +
  '@media (prefers-contrast: more) {\n  :root { --color-alpha: #000000; }\n}\n'
// 违规形态 A:顶层 :root 重宣 @theme 档(旧门与新门都必须红)。
const DUP = `${CLEAN}:root {\n  --color-alpha: #ffffff;\n}\n`
// 违规形态 B:整条 @import tokens.css 被摘掉(与 A 是**不同**的点名文案,三面比对时靠它分辨读到了哪一份)。
const NO_IMPORT =
  '/* tokens.css 的 @import 被摘掉了 */\n' +
  '@import "../../../packages/design-tokens/src/styles/base.css";\n'

// ─── 演练仓:将同一套夹具建成一棵**真 git 仓**(自带私有索引,共享主索引零触碰) ───
function gitAt(dir, args) {
  return execFileSync(
    gitBinary(),
    [
      '-c',
      'safe.directory=*',
      '-c',
      'core.quotepath=false',
      '-c',
      'core.autocrlf=false',
      '-c',
      'user.name=gate-fixture',
      '-c',
      'user.email=gate-fixture@invalid',
      '-C',
      dir,
      ...args,
    ],
    { encoding: 'utf8', windowsHide: true, timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'] },
  )
}

/**
 * 建演练仓:把守门脚本**连同 import 闭包**拷进 `<dir>/scripts/`(只拷一个文件必然
 * ERR_MODULE_NOT_FOUND,而"夹具跑不通"会被下游读成"判据通过")。
 * `files` = 相对路径 → 内容;`commit:false` 造"有仓无 HEAD"(默认档必须判死而不是回落磁盘)。
 */
function buildFixture({ files, commit = true } = {}) {
  const dir = mkScratch('web-tokens-sync')
  copyScriptWithClosure(SCRIPTS_DIR, GATE_NAME, join(dir, 'scripts'), [
    'lib/face-reader.mjs',
    'lib/gitdir.mjs',
    'lib/scratch-dir.mjs',
  ])
  for (const [rel, text] of Object.entries(files || {})) {
    const abs = join(dir, rel)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, text, 'utf8')
  }
  gitAt(dir, ['init', '-q', '-b', 'main'])
  gitAt(dir, ['add', '-A'])
  if (commit) gitAt(dir, ['commit', '-q', '-m', 'fixture'])
  return dir
}

/** 在演练仓里跑一次 CLI(不碰真仓、不碰共享索引)。 */
function runCli(dir, args = []) {
  const r = spawnSync(process.execPath, [join(dir, 'scripts', GATE_NAME), ...args], {
    cwd: dir,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return { code: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` }
}

function lastLine(out) {
  return out.trim().split(/\r?\n/).pop()
}

// ══════════════════════════════════════════════════════════════════
// J 组:判据语义未变(纯判据,三面共用同一条 —— 换锚不可能顺手改红)
// ══════════════════════════════════════════════════════════════════

test('J1 合规副本判绿且退出码 0 —— 本门不是恒红门(恒红的唯一结局是逼人 --no-verify 连带废掉全部守门)', () => {
  const r = gate.judge({ webCss: CLEAN, tokensCss: TOKENS_FIX })
  assert.equal(r.exitCode, 0, JSON.stringify(r))
  assert.deepEqual(r.errors, [], `不该出声却出了声:${JSON.stringify(r.errors)}`)
})

test('J2 顶层 :root 重宣 @theme 档 ⇒ 判红并点名该档(阳性对照:看不见存量就不算判据)', () => {
  const r = gate.judge({ webCss: DUP, tokensCss: TOKENS_FIX })
  assert.equal(r.exitCode, 1, JSON.stringify(r))
  assert.match(r.errors.join('\n'), /hand-copies tokens\.css @theme vars/)
  assert.match(r.errors.join('\n'), /--color-alpha/)
})

test('J3 两条 @import 各判一条,红只来自被摘的那一条(门 89 台账引用的正是"@import 存在性")', () => {
  const noTokens = gate.judge({ webCss: NO_IMPORT, tokensCss: TOKENS_FIX })
  assert.equal(noTokens.exitCode, 1, JSON.stringify(noTokens))
  assert.match(noTokens.errors.join('\n'), /missing @import tokens\.css/)
  assert.doesNotMatch(
    noTokens.errors.join('\n'),
    /missing @import base\.css/,
    'base 还在,不得连带点名',
  )

  const noBase = gate.judge({
    webCss: CLEAN.replace(/@import[^;]*base\.css";\n/, ''),
    tokensCss: TOKENS_FIX,
  })
  assert.equal(noBase.exitCode, 1, JSON.stringify(noBase))
  assert.match(noBase.errors.join('\n'), /missing @import base\.css/)
  assert.doesNotMatch(noBase.errors.join('\n'), /missing @import tokens\.css/)
})

test('J4 源头 @theme 为空只出 WARN 且退出码仍 0(收口前的退出码语义保持,没被顺手改成判红)', () => {
  const r = gate.judge({ webCss: CLEAN, tokensCss: ':root { --color-nothing: red; }\n' })
  assert.equal(r.exitCode, 0, JSON.stringify(r))
  assert.deepEqual(r.errors, ['[check-web-tokens-sync] WARN: tokens.css @theme has no vars'])
})

test('J5 @media / @layer 内的 :root 不进射程(高对比覆盖是有意设计,不得被当重宣)', () => {
  const inAtRule = CLEAN + '@layer components {\n  :root { --color-beta: #eeeeee; }\n}\n'
  const r = gate.judge({ webCss: inAtRule, tokensCss: TOKENS_FIX })
  assert.equal(r.exitCode, 0, JSON.stringify(r))
})

// ══════════════════════════════════════════════════════════════════
// F 组:取材面 —— 默认 HEAD / --staged 索引 / --worktree 逃生舱 / 取不到不回落 / 空枚举判死
// ══════════════════════════════════════════════════════════════════

test('F1 faceFromArgv 四态:默认必须是 head(把默认退回磁盘的那一刻本条必红)', () => {
  assert.equal(gate.faceFromArgv([]).face, 'head')
  assert.equal(gate.faceFromArgv(['--quiet']).face, 'head', '--quiet 不得改变判定面')
  assert.equal(gate.faceFromArgv(['--staged']).face, 'staged')
  assert.equal(gate.faceFromArgv(['--worktree']).face, 'worktree')
  const both = gate.faceFromArgv(['--staged', '--worktree'])
  assert.equal(both.face, null)
  assert.match(String(both.error), /不得同用/)
  assert.ok(
    gate.FACE_TXT.head && gate.FACE_TXT.staged && gate.FACE_TXT.worktree,
    '结论行要能写明是哪一面',
  )
})

test('F2 readFaceInputs 三面各读各的内容(同一条判据,三种答案,这才叫按面取材)', () => {
  const dir = buildFixture({ files: { [WEB_REL]: CLEAN, [TOKENS_REL]: TOKENS_FIX } })
  try {
    // 索引塞违规 A,再把磁盘改成违规 B ⇒ 三面互异:head=CLEAN / index=DUP / worktree=NO_IMPORT
    writeFileSync(join(dir, WEB_REL), DUP, 'utf8')
    gitAt(dir, ['add', '--', WEB_REL])
    writeFileSync(join(dir, WEB_REL), NO_IMPORT, 'utf8')

    assert.equal(gate.readFaceInputs(dir, 'head')[WEB_REL], CLEAN, 'head 面必须是已入库那一份')
    assert.equal(
      gate.readFaceInputs(dir, 'staged')[WEB_REL],
      DUP,
      'staged 面必须是索引那一份(盘上随后改成什么样都不算)',
    )
    assert.equal(
      gate.readFaceInputs(dir, 'worktree')[WEB_REL],
      NO_IMPORT,
      'worktree 面才是磁盘那一份',
    )
    // 清单与内容同面同轮:源头 tokens 也必须从**同一面**来,不得一份来自索引一份来自盘
    assert.equal(gate.readFaceInputs(dir, 'staged')[TOKENS_REL], TOKENS_FIX)
  } finally {
    rmScratch(dir)
  }
})

test('F3 CLI 三面三答:默认绿 / --staged 红在重宣档 / --worktree 红在 missing @import / 两面旗同给 exit 2', () => {
  const dir = buildFixture({ files: { [WEB_REL]: CLEAN, [TOKENS_REL]: TOKENS_FIX } })
  try {
    writeFileSync(join(dir, WEB_REL), DUP, 'utf8')
    gitAt(dir, ['add', '--', WEB_REL])
    writeFileSync(join(dir, WEB_REL), NO_IMPORT, 'utf8')

    const head = runCli(dir)
    assert.equal(head.code, 0, `HEAD 是合规的,默认档必须判绿:\n${head.out}`)
    assert.match(
      lastLine(head.out),
      /取材面:HEAD blob/,
      `末行必须写明是哪一面:\n${lastLine(head.out)}`,
    )

    const staged = runCli(dir, ['--staged'])
    assert.equal(
      staged.code,
      1,
      '索引里躺着一次重宣,@import 之后又被改回磁盘也不算修好:\n' + staged.out,
    )
    assert.match(staged.out, /hand-copies tokens\.css @theme vars/)
    assert.doesNotMatch(staged.out, /missing @import tokens\.css/, 'staged 面读到磁盘那份 = 混面')
    assert.match(lastLine(staged.out), /取材面:索引 blob/)

    const wt = runCli(dir, ['--worktree'])
    assert.equal(wt.code, 1, `逃生舱必须看到磁盘那一份:\n${wt.out}`)
    assert.match(wt.out, /missing @import tokens\.css/)
    assert.doesNotMatch(
      wt.out,
      /hand-copies tokens\.css @theme vars/,
      'worktree 面读到索引那份 = 混面',
    )
    assert.match(lastLine(wt.out), /取材面:工作树/)

    const both = runCli(dir, ['--staged', '--worktree'])
    assert.equal(both.code, 2, '两面旗同给必须判死(选哪一面都是给另一面发假绿):\n' + both.out)
    assert.match(both.out, /无法判定/)
  } finally {
    rmScratch(dir)
  }
})

test('F4 该面取不到 ⇒ exit 2「无法判定」且不回落到另一个面(回落就是把"没判"写成"判过了")', () => {
  const dir = buildFixture({ files: { [WEB_REL]: CLEAN, [TOKENS_REL]: TOKENS_FIX } })
  try {
    // 索引里摘掉副本(盘上还留着、HEAD 也留着)
    gitAt(dir, ['rm', '--cached', '-q', '-f', '--', WEB_REL])
    assert.throws(
      () => gate.readFaceInputs(dir, 'staged'),
      (e) => e instanceof Undetermined && /取不到|枚举到 0/.test(e.message),
      '索引没有这一份 ⇒ 必须抛,不许悄悄去读 HEAD 或磁盘',
    )
    const staged = runCli(dir, ['--staged'])
    assert.equal(staged.code, 2, `索引面取不到却出了红/绿结论:\n${staged.out}`)
    assert.match(staged.out, /无法判定/)
    // 同一瞬间默认档(HEAD 面)照判 —— 证明它没有整机罢工,只是那一面判不了
    assert.equal(runCli(dir).code, 0, 'HEAD 面完好,默认档不该被索引面的缺失带崩')
  } finally {
    rmScratch(dir)
  }
})

test('F5 枚举到 0 个被审文件 ⇒ 判死,不记绿(空扫与"扫过且干净"在账面上必须异形)', () => {
  const dir = buildFixture({ files: { 'README.md': '空仓夹具,没有那两个被审文件\n' } })
  try {
    assert.throws(
      () => gate.listAuditedFiles(dir, 'head'),
      (e) => e instanceof Undetermined && /枚举到 0 个被审文件/.test(e.message),
      '清单为空必须抛,返回 [] 会被下游读成"没有违规"',
    )
    const r = runCli(dir)
    assert.equal(r.code, 2, `空气扫描必须判死,实得 ${r.code}:\n${r.out}`)
    assert.match(r.out, /无法判定/)
    // 反向对照:把那两个被审文件写进**索引**(不提交)⇒ 索引面可判,而 HEAD 面依旧空气。
    // 少了这一条,F5 的红可能来自"夹具根本跑不通"而不是"该面枚举为空"。
    for (const [rel, text] of Object.entries({ [WEB_REL]: CLEAN, [TOKENS_REL]: TOKENS_FIX })) {
      const abs = join(dir, rel)
      mkdirSync(dirname(abs), { recursive: true })
      writeFileSync(abs, text, 'utf8')
    }
    gitAt(dir, ['add', '--', WEB_REL, TOKENS_REL])
    const staged = runCli(dir, ['--staged'])
    assert.equal(staged.code, 0, `索引面应当可判且内容合规,实得:\n${staged.out}`)
    assert.match(lastLine(staged.out), /取材面:索引 blob/)
    // 同一瞬间 HEAD 面仍是空气 ⇒ 换面即换结论,证明上一句红来自"面"而不是夹具坏
    assert.equal(runCli(dir).code, 2, 'HEAD 面没有这两个文件,默认档必须依旧判死')
  } finally {
    rmScratch(dir)
  }
})

test('F6 有仓无 HEAD ⇒ 默认档 exit 2(不许悄悄退成索引/磁盘那一份)', () => {
  const dir = buildFixture({ files: { [WEB_REL]: DUP, [TOKENS_REL]: TOKENS_FIX }, commit: false })
  try {
    const r = runCli(dir)
    assert.equal(r.code, 2, `没有 HEAD 时默认档必须判死,实得 ${r.code}:\n${r.out}`)
    assert.match(r.out, /无法判定/)
    // 对照:同一夹具的 --staged 面可判(索引里有内容),且它看到的是违规那份
    const staged = runCli(dir, ['--staged'])
    assert.equal(staged.code, 1, `索引面可判却判不了:\n${staged.out}`)
    assert.match(staged.out, /hand-copies tokens\.css @theme vars/)
  } finally {
    rmScratch(dir)
  }
})

test('F7 形状锁:被审内容与清单都不得再摸盘,清单出口只能是层的 ls-tree/ls-files', () => {
  const src = readFileSync(join(SCRIPTS_DIR, GATE_NAME), 'utf8')
  assert.doesNotMatch(src, /readFileSync\s*\(/, '门体又出现磁盘读 ⇒ 默认按磁盘判')
  assert.doesNotMatch(src, /existsSync\s*\(/, '存在性判据又摸盘了(清单与内容会分属两个面)')
  assert.doesNotMatch(src, /readdirSync\s*\(/, '枚举又摸盘了(应走层的 ls-files / ls-tree)')
  assert.doesNotMatch(src, /from 'node:fs'/, '门体不该自带 fs —— 磁盘面只走层的 readWorktreeFile')
  // 票 G-391① 要求的第三格反向锁:**问 git 只能走层**。门体自己派生进程 / 自己 `git show`,
  // 就退回"引了层却各读各的面"那一型(守门 118 的 half-wired:管子共用不等于面共用),
  // 并且绕掉层收口的那批易错点(绝对路径 git、safe.directory、timeout、maxBuffer、windowsHide)。
  assert.doesNotMatch(src, /child_process/, '门体自己派生进程问 git ⇒ 层的取材纪律全部旁路')
  assert.doesNotMatch(src, /['"]show['"]/, '取内容不得用 git show —— 必须走层的 catBatch(逐文件派生即 fork 风暴)')
  assert.match(src, /from '\.\/lib\/face-reader\.mjs'/, '取材必须走统一层')
  assert.match(src, /gitRaw\s*\(/, '枚举只能走层的 gitRaw,不是自己的 git 派生')
  assert.match(
    src,
    /catBatch\s*\(/,
    '内容必须走层的读取入口(守门 118 只认 catBatch / readWorktreeFile)',
  )
  assert.match(src, /def: 'head'/, '默认面必须钉在 head')
  assert.match(src, /ls-tree/, 'head 面的清单出口必须是 ls-tree')
  assert.match(src, /ls-files/, '索引/工作树面的清单出口必须是 ls-files')
  // 枚举与内容必须在同一个出口函数里(拆成两处就会有一处悄悄换面)
  const body = src.slice(src.indexOf('export function readFaceInputs'))
  assert.match(
    body.slice(0, 600),
    /listAuditedFiles\s*\(/,
    'readFaceInputs 必须先在同面上枚举再读内容',
  )

  // **有牙证明**:上面四条 doesNotMatch 若写成恒真式(正则漂一个字符就永远不命中),
  // 这条锁就只是装饰 —— 拿一段"坏门体"样本喂同一批正则,四条必须全部命中。
  // 样本刻意只用 import 形态与裸字符串,不写成 `execFile*Sync('git', …)` 的调用形状,
  // 免得本夹具源码被守门 52(派生控制台程序必须带 windowsHide)当成真调用判红。
  const BAD_GATE = [
    "import { readFileSync } from 'node:fs'",
    "import { execFileSync } from 'node:child_process'",
    "const text = readFileSync(p, 'utf8')",
    "const spec = 'show'",
  ].join('\n')
  for (const re of [/readFileSync\s*\(/, /from 'node:fs'/, /child_process/, /['"]show['"]/]) {
    assert.match(BAD_GATE, re, `反向锁 ${re} 对"坏门体"不命中 = 恒真装饰,本条必须红`)
  }
})

test('F8 装车证明:守门 37 在 runner 里仍是 blocking + args 为空(提交链由 runner 下发 --staged,门体不得自写)', () => {
  const runner = readFileSync(join(SCRIPTS_DIR, 'guardian-runner.mjs'), 'utf8')
  const at = runner.indexOf(`script: '${GATE_NAME}'`)
  assert.ok(at > 0, 'runner 里没有本门 ⇒ 判据存在而无人调度(等于没有)')
  const entry = runner.slice(Math.max(0, at - 400), at + 400)
  assert.match(entry, /id: '37'/, '本门条目必须还是 37')
  assert.match(entry, /mode: 'blocking'/, '定级不得被顺手降级')
  assert.match(entry, /args: \[\]/, 'runner 给的旗标未变:全量不带旗标,--staged 由 passStaged 下发')
})

test('J6 真仓三面都**可判**(exit 0/1,不得 2),且每一面的结论行都写明自己是哪一面', () => {
  // 真仓此刻三面同内容,所以三面都只断"判得了 + 写明面",不断红绿 ——
  // 拿真仓断红绿会把别人在飞的改动算成本仓债务(文件头已记)。
  for (const flag of [[], ['--staged'], ['--worktree']]) {
    const r = spawnSync(process.execPath, [join(SCRIPTS_DIR, GATE_NAME), ...flag], {
      cwd: REPO,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
    assert.ok(
      r.status === 0 || r.status === 1,
      `${flag.join(' ') || '(默认)'} ⇒ exit ${r.status},2 = 该面判不了(真仓三面都不该判不了):\n${out}`,
    )
    const lines = out.trim().split(/\r?\n/)
    assert.match(lines[0] + lines[lines.length - 1], /取材面:/, `结论必须写明是哪一面:\n${out}`)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
