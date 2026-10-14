#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:守门 47「溯源水印覆盖(自愈式)」+ 换面纪律(门 118 口径,2026-10-15)。
 *
 * 历史:本文件第一版 import 门体会当场对真仓跑整道自愈门(顶层就是 CLI 主流程),于是只能 spawn CLI。
 * 2026-10-15 换面批给门体与 `watermark.mjs` 都补了 §22d 的 `isDirectRun` 守卫并 export `__test__`
 * ⇒ 本文件现在**直接 import 生产判据**(`payloadIntact`/`decodePayload`/`pickFace` 那份实现),
 * 不在测试里复制任何零宽解码或面旗解析(§22c:两处实现必漂移;判据门 check-test-judge-not-replicated)。
 * 端到端判定(rc 语义)仍走真临时 git 仓 + 真 CLI —— 那才是"门"的完整形状。
 *
 * 覆盖:
 *  T1 装车:HEAD 面注册表里确有 id 47 + blocking,且文档承诺的应急变量真被门体读;
 *  T2 装载守卫(§22d):门体与 watermark.mjs 的 isDirectRun 守卫在位,且本文件确实在 import 生产判据(反空转对照);
 *  T4/T5/T6 自愈与纯判定两档 + G-1018220 的收窄有牙(提交档不替别人补,全量档照旧判红);
 *  W9 三面分叉正控:HEAD 缺载荷、index/盘上完好 ⇒ 全量档必须判红并点名该文件;
 *     **变异自证**:把临时仓副本的默认判定面改回读磁盘 ⇒ 同一夹具必须翻回 0(换面改动确有牙);
 *  W10 反控:三面一致且载荷完好 ⇒ exit 0(防恒红门);
 *  W11 未判定:HEAD 面取不到(仓无提交)⇒ 报「无法判定」且 exit 2,不得记绿不得记红。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, cpSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'
// §22c:判据本体从源脚本 import(守卫在位后 import 无副作用),测试不得自带第二台解码器。
import { __test__ as WM } from '../watermark.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const GIT = 'C:/Program Files/Git/cmd/git.exe'
const BANNER = 'Provenance-watermarked.'
const NO_BANNER_SRC = "export const hello = () => 'hi'\n"
// 残迹形态(2026-09-12 五态里的「残迹」):可见横幅文本俱在、零宽载荷整段丢失。
// 这是夹具输入不是判据复制 —— 判"残迹"用 WM.payloadIntact 那份生产实现。
const RESIDUE_SRC = [
  '// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top',
  '// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。',
  '// [IHUI-AI-PROVENANCE]:',
  "export const demo = () => 'x'",
  '',
].join('\n')

const git = (args, cwd) =>
  execFileSync(GIT, ['-c', 'safe.directory=*', ...args], {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    timeout: 60_000,
    encoding: 'utf8',
    maxBuffer: 32 << 20,
  })

/** 跑门体 CLI。env 里显式清空应急跳过变量 —— 否则本机一旦带着它跑测试,门整道静默 exit 0。 */
const runGate = (cwd, args) => {
  try {
    const out = execFileSync(process.execPath, [join(cwd, 'scripts', 'check-watermark-coverage.mjs'), ...args], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      timeout: 180_000,
      encoding: 'utf8',
      maxBuffer: 32 << 20,
      env: { ...process.env, HUSKY_SKIP_WATERMARK_GUARD: '' },
    })
    return { rc: 0, out }
  } catch (e) {
    return { rc: typeof e.status === 'number' ? e.status : 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` }
  }
}

const runWatermark = (cwd, args) =>
  execFileSync(process.execPath, [join(cwd, 'scripts', 'watermark.mjs'), ...args], {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    timeout: 180_000,
    encoding: 'utf8',
  })

/**
 * 造一个最小 git 仓:门体与 watermark.mjs 连闭包拷进去,先落一枚 base 提交再把目标文件 staged
 * (或连提交一起做 = "存量欠账"形态)。base 提交是必须的:提交档问的是"索引相对 HEAD 的差异",
 * 没有 HEAD 就只能是"取不到携带面 ⇒ 未判定",那测的是夹具缺件不是判据。
 * README 必须先经**真 inject** 再提交:换面后全量档判 HEAD 面,一枚无横幅的 README 会自己
 * 构成缺口,把"目标文件才有牙"的对照搅浑 —— 夹具的其余面必须干净。
 */
function makeRepo({ commit = false, residueAndFix = false } = {}) {
  const dir = mkScratch('wm47-')
  copyScriptWithClosure(join(ROOT, 'scripts'), 'check-watermark-coverage.mjs', join(dir, 'scripts'))
  copyScriptWithClosure(join(ROOT, 'scripts'), 'watermark.mjs', join(dir, 'scripts'))
  const conf = join(ROOT, 'config', 'third-party-provenance')
  if (existsSync(conf)) {
    mkdirSync(join(dir, 'config'), { recursive: true })
    cpSync(conf, join(dir, 'config', 'third-party-provenance'), { recursive: true })
  }
  mkdirSync(join(dir, 'src'), { recursive: true })
  writeFileSync(join(dir, 'README.md'), '# fixture\n', 'utf8')
  git(['init', '-b', 'main'], dir)
  git(['config', 'core.hooksPath', join(dir, '.no-hooks')], dir)
  runWatermark(dir, ['inject', 'README.md'])
  git(['add', 'README.md'], dir)
  git(['commit', '-m', 'base', '--no-verify'], dir)
  if (residueAndFix) {
    // W9 三面分叉:HEAD=residue(缺载荷),随后只把**已注入版**写到盘并 add ⇒ index 与盘完好、HEAD 欠账。
    writeFileSync(join(dir, 'src', 'demo.mjs'), RESIDUE_SRC, 'utf8')
    git(['add', 'src/demo.mjs'], dir)
    git(['commit', '-m', 'residue-in-head', '--no-verify'], dir)
    runWatermark(dir, ['inject', 'src/demo.mjs'])
    git(['add', 'src/demo.mjs'], dir)
    return dir
  }
  writeFileSync(join(dir, 'src', 'demo.mjs'), NO_BANNER_SRC, 'utf8')
  git(['add', 'src/demo.mjs'], dir)
  if (commit) git(['commit', '-m', 'gap', '--no-verify'], dir)
  return dir
}

const indexBlob = (dir, file) => {
  try {
    return git(['show', `:${file}`], dir)
  } catch {
    return null
  }
}
const headBlob = (dir, file) => {
  try {
    return git(['show', `HEAD:${file}`], dir)
  } catch {
    return null
  }
}

test('T1 装车证明(读 HEAD 面注册表与门体):id 47 确在提交链且 blocking,应急跳过变量真有人读', () => {
  const runner = git(['show', 'HEAD:scripts/guardian-runner.mjs'], ROOT)
  const i = runner.indexOf("script: 'check-watermark-coverage.mjs'")
  assert.ok(i > 0, 'HEAD 面注册表里没有门 47 的 script 行 ⇒ 门被摘线或注册块被回写')
  const block = runner.slice(Math.max(0, i - 700), i + 700)
  assert.match(block, /id: '47'/, 'script 行附近必须有 id 47')
  assert.match(block, /mode: 'blocking'/, '门 47 必须是 blocking:降级成 warn 就等于允许无水印文件进提交')
  const gate = git(['show', 'HEAD:scripts/check-watermark-coverage.mjs'], ROOT)
  assert.match(gate, /process\.env\.HUSKY_SKIP_WATERMARK_GUARD/, '文档承诺的应急变量必须在门体被读(假逃生舱禁令)')
})

test('T2 装载守卫(§22d):两脚本守卫在位 ⇒ 本文件必须 import 生产判据(正/反空转对照都在)', () => {
  // 守卫读**工作树面**:测试与代码同批落地;HEAD 面等下一枚提交自然追平(装车检由 T1 的 runner 面负责)。
  for (const name of ['check-watermark-coverage.mjs', 'watermark.mjs']) {
    const src = readFileSync(join(ROOT, 'scripts', name), 'utf8')
    assert.match(
      src,
      /isDirectRun = process\.argv\[1\] && (import\.meta\.url === pathToFileURL\(process\.argv\[1\]\)\.href|pathToFileURL\(process\.argv\[1\]\)\.href === import\.meta\.url)/,
      `${name} 缺 §22d 守卫 ⇒ import 即触发 CLI,本文件的 §22c import 通道会被打死`,
    )
    assert.match(src, /export const __test__ = \{/, `${name} 必须 export __test__(§22c 镜像可达的前置)`)
  }
  // 生产判据确实被 import 且在用(不是装饰):WM 的三个出口都要真实出现在本文件代码面。
  const selfCode = readFileSync(fileURLToPath(import.meta.url), 'utf8')
  assert.match(selfCode, /from '\.\.\/watermark\.mjs'/, '本文件必须 import 生产判据,不得只 spawn CLI 兜底')
  assert.match(selfCode, /WM\.payloadIntact/, '载荷判定必须用源脚本那一份,不得在测试里另写解码')
  // 反空转对照:守卫正则本身对**旧**写法(顶层裸 main)不会误判成有守卫 —— 用一条不含守卫的构造面证明正则可假。
  assert.ok(
    !/isDirectRun = process\.argv\[1\]/.test("async function main() {}\nmain().catch(() => {})"),
    '守卫正则恒真的话这条锁就是空转',
  )
})

test('T2b 面旗选择判据住源脚本:__test__.pickFace 的三面与冲突档逐条对账(生产判据,零复制)', () => {
  assert.equal(WM.pickFace([]).face, 'head', '全量档默认必须判 HEAD 面')
  assert.equal(WM.pickFace(['--staged']).face, 'staged')
  assert.equal(WM.pickFace(['--worktree']).face, 'worktree')
  assert.equal(WM.pickFace(['x.ts']).face, 'worktree', '显式点名文件判盘上那份')
  assert.match(WM.pickFace(['--staged', '--worktree']).error || '', /不得同用|互斥/, '两面旗同给 ⇒ 矛盾')
  assert.ok(WM.pickFace(['--staged', 'x.ts']).error, '--staged + 显式点名 = 面冲突,必须报错而不是任选一面')
})

test('T4 真临时仓:本次携带的缺口 ⇒ 自愈注入 + 载荷可解码 + 回暂存区,exit 0', () => {
  const dir = makeRepo()
  try {
    const before = readFileSync(join(dir, 'src', 'demo.mjs'), 'utf8')
    assert.ok(!before.includes(BANNER), '夹具前提:目标文件确实没有横幅')
    const r = runGate(dir, ['--staged'])
    assert.equal(r.rc, 0, `携带缺口经自愈后应 exit 0,实得 ${r.rc}:${r.out}`)
    const after = readFileSync(join(dir, 'src', 'demo.mjs'), 'utf8')
    assert.ok(after.includes(BANNER), `自愈必须真的写进文件:\n${after}`)
    // 载荷判定用生产那一份(§5c:必须"可解码且等于 WATERMARK_TEXT",不是"有标记就行")
    assert.ok(WM.payloadIntact(after), '注入的必须是生产判据认的可解码载荷')
    const idx = String(indexBlob(dir, 'src/demo.mjs'))
    assert.ok(idx.includes(BANNER) && WM.payloadIntact(idx), '自愈必须回暂存区,否则提交里仍是无水印版本')
    assert.match(
      r.out,
      /- src\/demo\.mjs \[self-heal-fixed\]/,
      '自愈清单行必须带结构化豁免键(G-1018220 口径②:归因层只认键豁免"自愈动作点名",报红块不得带键)',
    )
  } finally {
    rmScratch(dir)
  }
})

test('T5 真临时仓反向臂:提交档 --no-fix 判红且一个字节都不改(纯判定档不得动手)', () => {
  const dir = makeRepo()
  try {
    const before = readFileSync(join(dir, 'src', 'demo.mjs'), 'utf8')
    // 换面后目标缺口住在索引面(尚未提交)⇒ 纯判定打在 --staged 面才对着本次要带走的那份
    const r = runGate(dir, ['--no-fix', '--staged'])
    assert.equal(r.rc, 1, `无水印缺口必须判红,实得 ${r.rc}:${r.out}`)
    assert.equal(readFileSync(join(dir, 'src', 'demo.mjs'), 'utf8'), before, '--no-fix 不得改文件')
    assert.ok(!String(indexBlob(dir, 'src/demo.mjs')).includes(BANNER), '--no-fix 不得回暂存区')
  } finally {
    rmScratch(dir)
  }
})

test('T6 收窄有牙(G-1018220):存量欠账不在携带面 ⇒ 提交档放行且不替别人补,全量档照旧判红', () => {
  const dir = makeRepo({ commit: true })
  try {
    const before = readFileSync(join(dir, 'src', 'demo.mjs'), 'utf8')
    const staged = runGate(dir, ['--staged'])
    assert.equal(staged.rc, 0, `索引==HEAD 的存量欠账不该算在本次提交头上:${staged.out}`)
    assert.equal(readFileSync(join(dir, 'src', 'demo.mjs'), 'utf8'), before, '门不得替别人已入库的副本注入(污染 + 越权两型)')
    assert.ok(!String(indexBlob(dir, 'src/demo.mjs')).includes(BANNER), '不携带 ⇒ 不注入')
    assert.match(staged.out, /demo\.mjs/, '不判红也必须点名那一格,否则"放过"与"没看见"在账面上同形')
    const full = runGate(dir, ['--no-fix'])
    assert.equal(full.rc, 1, `全量档必须继续判存量红,否则收窄等于把红洗成绿:${full.out}`)
  } finally {
    rmScratch(dir)
  }
})

test('T7 乙档(全量/push-gate)自愈只写工作区、绝不碰索引(2026-10-14 悬留成因的结构性锁)', () => {
  const dir = makeRepo({ commit: true }) // HEAD 与索引都是无水印存量,盘上同
  try {
    const before = readFileSync(join(dir, 'src', 'demo.mjs'), 'utf8')
    const idxBefore = String(indexBlob(dir, 'src/demo.mjs'))
    const r = runGate(dir, [])
    assert.equal(r.rc, 1, `HEAD 面欠账不因写盘而销,必须仍判红,实得 ${r.rc}:${r.out}`)
    assert.match(r.out, /已 inject 到工作区,请随下一次提交带上/, '必须点名"写了盘"这件事与出路')
    assert.match(r.out, /本档刻意不动索引/, '必须写明本档不碰索引(工作区可回滚,索引不可)')
    const after = readFileSync(join(dir, 'src', 'demo.mjs'), 'utf8')
    assert.notEqual(after, before, '自愈确实写到了工作区')
    assert.ok(WM.payloadIntact(after), '写进工作区的水印必须经生产判据认可')
    assert.equal(String(indexBlob(dir, 'src/demo.mjs')), idxBefore, '全量档自愈后索引必须逐字节原样(add-without-commit 就是本次要修的缺陷)')
  } finally {
    rmScratch(dir)
  }
})

test('W9 三面分叉正控(换面的牙):HEAD 缺载荷而 index/盘完好 ⇒ 全量档必须判红点名;把副本默认面改回读盘 ⇒ 必须翻回 0(变异自证)', () => {
  const dir = makeRepo({ residueAndFix: true })
  try {
    // 夹具三面自证:HEAD=residue(payloadIntact=false),index 与盘=完好
    const head = String(headBlob(dir, 'src/demo.mjs'))
    const idx = String(indexBlob(dir, 'src/demo.mjs'))
    const disk = readFileSync(join(dir, 'src', 'demo.mjs'), 'utf8')
    assert.ok(head.includes('[IHUI-AI-PROVENANCE]') && !WM.payloadIntact(head), '夹具前提:HEAD blob 必须是残迹态(有横幅文本、无可解码载荷)')
    assert.ok(WM.payloadIntact(idx) && WM.payloadIntact(disk), '夹具前提:索引与盘上副本必须已补齐(悬留形态)')
    // 正判:全量档判 HEAD 面 ⇒ 红且点名
    const r = runGate(dir, ['--no-fix'])
    assert.equal(r.rc, 1, `HEAD 面缺载荷必须判红,实得 ${r.rc}:${r.out}`)
    assert.match(r.out, /src\/demo\.mjs/, '必须点名悬留的那枚文件')
    // 同码三面探针:逃生舱读盘 ⇒ 同一份代码在该面就是绿(证明红的来源是 HEAD,不是别的)
    const wt = runGate(dir, ['--no-fix', '--worktree'])
    assert.equal(wt.rc, 0, `盘上完好,--worktree 逃生舱应 0,实得 ${wt.rc}:${wt.out}`)
    // 变异自证:把临时仓副本的默认判定面改回读磁盘(= 换面前行为),同一夹具必须翻回 0。
    const wmPath = join(dir, 'scripts', 'watermark.mjs')
    const wmSrc = readFileSync(wmPath, 'utf8')
    const MUT = "const DEFAULT_BATCH_FACE = 'head'"
    assert.ok(wmSrc.includes(MUT), '变异锚点必须存在(默认面常量被改名时先修这条锁,不得静默跳过变异)')
    writeFileSync(wmPath, wmSrc.replace(MUT, "const DEFAULT_BATCH_FACE = 'worktree'"), 'utf8')
    const mutated = runGate(dir, ['--no-fix'])
    assert.equal(mutated.rc, 0, `摘掉换面(读盘)后该例必须翻回 0 —— 翻不回 0 说明红不是换面带来的,判据没装在位:${mutated.out}`)
    writeFileSync(wmPath, wmSrc, 'utf8')
    const restored = runGate(dir, ['--no-fix'])
    assert.equal(restored.rc, 1, '还原副本后必须重新判红(证明上面那次 0 是变异造成的,不是环境漂移)')
  } finally {
    rmScratch(dir)
  }
})

test('W10 反控:三面一致且载荷完好 ⇒ 三档全部 exit 0(防恒红门)', () => {
  const dir = makeRepo({ residueAndFix: true })
  try {
    git(['commit', '-m', 'seat-the-fix', '--no-verify'], dir) // 把补齐版提交进 HEAD ⇒ 三面一致
    assert.ok(WM.payloadIntact(String(headBlob(dir, 'src/demo.mjs'))), '夹具前提:提交后 HEAD 面载荷完好')
    for (const args of [['--no-fix'], ['--no-fix', '--staged'], ['--no-fix', '--worktree']]) {
      const r = runGate(dir, args)
      assert.equal(r.rc, 0, `${args.join(' ')} 应判绿,实得 ${r.rc}:${r.out}`)
    }
  } finally {
    rmScratch(dir)
  }
})

test('W11 未判定:HEAD 面取不到(仓无任何提交)⇒ 报「无法判定」且 exit 2,不得记绿不得记红', () => {
  const dir = mkScratch('wm47-w11-')
  try {
    copyScriptWithClosure(join(ROOT, 'scripts'), 'check-watermark-coverage.mjs', join(dir, 'scripts'))
    copyScriptWithClosure(join(ROOT, 'scripts'), 'watermark.mjs', join(dir, 'scripts'))
    const conf = join(ROOT, 'config', 'third-party-provenance')
    if (existsSync(conf)) {
      mkdirSync(join(dir, 'config'), { recursive: true })
      cpSync(conf, join(dir, 'config', 'third-party-provenance'), { recursive: true })
    }
    mkdirSync(join(dir, 'src'), { recursive: true })
    writeFileSync(join(dir, 'src', 'demo.mjs'), NO_BANNER_SRC, 'utf8')
    git(['init', '-b', 'main'], dir)
    git(['config', 'core.hooksPath', join(dir, '.no-hooks')], dir)
    git(['add', '.'], dir) // 有索引、无 HEAD:全量档的判定面根本不存在
    const r = runGate(dir, ['--no-fix'])
    assert.equal(r.rc, 2, `面取不到必须是 exit 2(未判定),实得 ${r.rc}:${r.out}`)
    assert.match(r.out, /无法判定/, '必须显式喊「无法判定」,不得静默')
    assert.ok(!/✅/.test(r.out), '未判定绝不得同时写出通过样子的结论(把"没判"写成"判过"是本仓最高频失效型)')
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
