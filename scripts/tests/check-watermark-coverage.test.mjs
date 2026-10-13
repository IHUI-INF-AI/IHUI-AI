#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:守门 47「溯源水印覆盖(自愈式)」。
 *
 * **本文件刻意不 import 门体,而是 spawn 它的 CLI** —— 这不是偷懒,是门 47 今天唯一安全的消费方式:
 * 它没有 §22d 的 `isDirectRun` 守卫,整个命令行主流程就是模块顶层代码,所以
 * `import { decideCoverage } from '../check-watermark-coverage.mjs'` **会当场对真仓跑完整道门**,
 * 而它是自愈式的(检出缺口就 inject 并 git add)—— 本文件第一版就是这么写的,一次 import 直接在
 * `G:\IHUI-AI` 上触发了"自动补齐未能达标"并 `process.exit(1)` 打死测试进程(实测,非推测)。
 * ⇒ 解阻前置 = 给门体补 §22d 四行守卫并把主流程收进 `main()`,那之后才谈"改调门体导出判据"。
 * 这条登记在 G-1058651 那一族(同型:入口守卫缺失使整族镜像结构性不可达)与 G-1018220 名下。
 *
 * 覆盖四件事(全部走真临时 git 仓 + 真 CLI,不靠自造桩):
 *  T1 装车:HEAD 面注册表里确有 id 47 + blocking,且文档承诺的应急变量真被门体读;
 *  T2 装载安全锁:钉住"本文件不得 import 门体"并写明上面那条理由;
 *  T4/T5 自愈与纯判定两档:`--staged` 携带缺口 ⇒ 注入 + 回暂存区 + exit 0;`--no-fix` ⇒ exit 1 且零字节改动;
 *  T6 G-1018220 的收窄有牙:存量欠账不在携带面 ⇒ 提交档放行且**不替别人补**,全量档照旧判红。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, cpSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'
// 判"本文件有没有 import 门体"必须看**代码面**:文件头把那条 import 逐字写进注释里当解阻说明,
// 拿原文匹配就会把"解释自己的散文"判成违规(守门 70/131 同型)。遮罩只引那一份实现,且**只遮注释、
// 保留字符串** —— 模块说明符就住在字符串里,连字符串一起抹会让这条锁变成恒真的空判据。
import { maskComments } from '../lib/code-mask.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const GIT = 'C:/Program Files/Git/mingw64/bin/git.exe'
const BANNER = 'Provenance-watermarked.'
const NO_BANNER_SRC = "export const hello = () => 'hi'\n"

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

/**
 * 造一个最小 git 仓:门体与 watermark.mjs 连闭包拷进去,先落一枚 base 提交再把目标文件 staged
 * (或连提交一起做 = "存量欠账"形态)。base 提交是必须的:提交档问的是"索引相对 HEAD 的差异",
 * 没有 HEAD 就只能是"取不到携带面 ⇒ 未判定",那测的是夹具缺件不是判据。
 */
function makeRepo({ commit = false } = {}) {
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
  git(['add', 'README.md'], dir)
  git(['commit', '-m', 'base', '--no-verify'], dir)
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

test('T2 装载安全锁:门体没有 isDirectRun 守卫 ⇒ 本文件禁止 import 它(import 即对真仓自愈写入)', () => {
  const gate = git(['show', 'HEAD:scripts/check-watermark-coverage.mjs'], ROOT)
  // 前提必须成立:一旦将来有人补了守卫,这条锁就该被**改成** import 生产入口(见文件头解阻前置),
  // 而不是删掉 —— 两种"守门形同虚设"的形态(恒绿与禁止演进)都在这儿被挡住。
  assert.doesNotMatch(gate, /isDirectRun|pathToFileURL\(process\.argv/, '门体已补 §22d 守卫 ⇒ 请改成本文件调用门体导出的 decideCoverage,不得继续走 CLI 兜底')
  const selfCode = maskComments(readFileSync(fileURLToPath(import.meta.url), 'utf8'))
  assert.doesNotMatch(selfCode, /from '\.\.\/check-watermark-coverage\.mjs'/, '本测试不得 import 门体:顶层就是 CLI 主流程,import 会当场对真仓跑整道自愈门')
  // 反空转对照:同一份遮罩面必须仍看得见**别的**真实 import,否则上一条 doesNotMatch 是恒真锁
  // (遮罩把导入整块抹掉时,"没有违规"与"什么都没看见"在账面上完全同形)。
  assert.match(selfCode, /from '\.\.\/lib\/code-mask\.mjs'/, '遮罩面看不见本文件自己的 import ⇒ 这条装载锁在空转,不是通过')
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
    assert.ok(after.includes('[IHUI-AI-PROVENANCE]:'), '注入的必须是载荷标记,不只是可见横幅(§5c 判据)')
    assert.ok(String(indexBlob(dir, 'src/demo.mjs')).includes(BANNER), '自愈必须回暂存区,否则提交里仍是无水印版本')
    assert.match(
      r.out,
      /- src\/demo\.mjs \[self-heal-fixed\]/,
      '自愈清单行必须带结构化豁免键(G-1018220 口径②:归因层只认键豁免"自愈动作点名",报红块不得带键)',
    )
  } finally {
    rmScratch(dir)
  }
})

test('T5 真临时仓反向臂:--no-fix 判红且一个字节都不改(纯判定档不得动手)', () => {
  const dir = makeRepo()
  try {
    const before = readFileSync(join(dir, 'src', 'demo.mjs'), 'utf8')
    const r = runGate(dir, ['--no-fix'])
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
