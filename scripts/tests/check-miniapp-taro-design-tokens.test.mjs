#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 测试脚本需要打印诊断信息 */
/**
 * check-miniapp-taro-design-tokens.test.mjs — miniapp-taro design-token 同步守门的镜像测试。
 *
 * §22c 纪律(本文件存在的全部理由):**判据一律从源脚本 import**,
 *   `import { __test__ as G } from '../check-miniapp-taro-design-tokens.mjs'` ——
 *   测试里不得出现第二份取块/取值/选面实现(`check-test-judge-not-replicated.mjs` 191 拦这一族)。
 *   源脚本已有 §22d 的 `isDirectRun` 守卫,import 它不触发主流程(否则 import 即对真仓跑一道门)。
 *
 * 钉死五格:
 *   A 判据同源 + 反空转对照(成对的"会红"与"不该红时不红";只有前者的判据等于没有);
 *   B 三面分叉正控(临时真 git 仓 + 真 CLI:HEAD 漂而索引/盘已修好 ⇒ 只有默认档翻红),
 *     并附**变异自证** —— 把临时仓副本的默认面改回读磁盘,同一夹具必须翻回绿(证明换面确有牙);
 *   C 三面一致 ⇒ 全量/`--staged`/`--worktree` 三档全绿(§12e 恒红门反证);
 *   D 取不到被审面 / 枚举到 0 个候选 ⇒ exit 2 且话术含「未判定」(§0.3,不记绿也不冒红);
 *   E 真仓 HEAD 面存量读数(判绿必须"量到了 N>0 档"),并拿真仓数据喂一组故意做错的同值对做阳性对照;
 *   F 取材层与装载守卫(face-reader / isDirectRun / __test__ 出口)+ 接线诚实性(**未注册时头注不得自称已接线**;
 *     注册后必须 blocking+skipEnv 成套、编号反查且全 runner 唯一)。定级由接线者按现读存量落,本文件不代拍。
 *
 * 夹具落点:`scripts/lib/scratch-dir.mjs`(§15b,工作树同盘的批准临时区);
 *   **严禁在仓库树内 git init**(守门 208 的成因就是无人清理的嵌套演练仓)。
 *   根路径由本文件自身位置推导(`import.meta.url`),不用 `process.cwd()`(守门 70)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { rmScratch } from '../lib/scratch-dir.mjs'
// §22c:生产判据本体。守卫在位 ⇒ import 无副作用;判据不得在本文件里再写一遍。
import { __test__ as G } from '../check-miniapp-taro-design-tokens.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const TOOL = join(ROOT, 'scripts', `${G.NAME}.mjs`)
const RUNNER = join(ROOT, 'scripts', 'guardian-runner.mjs')

const spawnOpts = {
  stdio: ['ignore', 'pipe', 'pipe'],
  encoding: 'utf8',
  windowsHide: true,
  timeout: 300_000,
  maxBuffer: 64 << 20,
}

/** 跑真仓门体(只读档,不落任何工件)。放行变量显式清空:本机带着它跑 = 整道门静默 exit 0 假绿。 */
function runRealGate(args) {
  const r = spawnSync(process.execPath, [TOOL, ...args], {
    ...spawnOpts,
    cwd: ROOT,
    env: { ...process.env, [G.SKIP_ENV]: '' },
  })
  return {
    code: r.status,
    out: `${r.stdout ?? ''}${r.stderr ?? ''}`,
    last: `${r.stdout ?? ''}`.trim().split(/\r?\n/).pop() ?? '',
  }
}

/** 夹具登记 + 收尾清理:断言抛错也要删(§15c 的 52 个残留演练仓就是这么来的)。 */
const made = []
function fixture(build) {
  const one = build()
  made.push(typeof one === 'string' ? one : one.dir)
  return one
}
function dirOf(one) {
  return typeof one === 'string' ? one : one.dir
}

test.after(() => {
  for (const d of made) {
    try {
      rmScratch(d, { bestEffort: true })
    } catch {
      console.log(`  ⚠ 夹具清理失败(不影响判定):${d}`)
    }
  }
})

// ───────────────────────── A 判据同源 + 成对对照 ─────────────────────────

test('A1 §22c 反空转:本文件确实 import 了生产判据,且没有把判据再抄一遍', () => {
  for (const key of ['compare', 'collectTokenVars', 'faceFromArgv', 'readFaceInputs', 'extractHardcodedColors']) {
    assert.equal(typeof G[key], 'function', `源脚本的 __test__ 必须导出 ${key}(判据取不到 = 本文件无从镜像)`)
  }
  const self = readFileSync(join(HERE, 'check-miniapp-taro-design-tokens.test.mjs'), 'utf8')
  for (const bad of [
    /function\s+compare\s*\(/,
    /function\s+collectTokenVars\s*\(/,
    /function\s+faceFromArgv\s*\(/,
    /function\s+extractHardcodedColors\s*\(/,
    /function\s+extractAllBlocks\s*\(/,
  ]) {
    assert.ok(!bad.test(self), `测试里不得出现第二份判据实现:${bad}`)
  }
})

test('A2 反控(防恒红):同形夹具 ⇒ 0 漂移,且判据真的吃到档(checked>0)', () => {
  const base = G.compare({ tokensCss: G.FIX_TOKENS, appCss: G.FIX_APP })
  assert.equal(base.diffs.length, 0, `同形夹具不该红:${JSON.stringify(base.diffs)}`)
  assert.ok(base.checked > 0 && base.source > 0, `checked=${base.checked} source=${base.source}(空转的判据什么也判不了)`)
})

test('A3 阳性对照::root 与 .dark 各改一条都必须被抓到且点名两侧读数', () => {
  const d1 = G.compare({ tokensCss: G.FIX_TOKENS, appCss: G.driftFirstRoot(G.FIX_APP, '--color-bg', '#eee') })
  assert.equal(d1.diffs.length, 1, JSON.stringify(d1.diffs))
  assert.equal(d1.diffs[0].name, '--color-bg')
  assert.equal(d1.diffs[0].block, ':root')
  assert.equal(d1.diffs[0].app, '#eee')
  assert.equal(d1.diffs[0].tok, 'white')

  const d2 = G.compare({ tokensCss: G.FIX_TOKENS, appCss: G.driftInBlock(G.FIX_APP, '.dark', '--radius', '2px') })
  assert.equal(d2.diffs.length, 1, JSON.stringify(d2.diffs))
  assert.equal(d2.diffs[0].block, '.dark', '.dark 面的漂移必须点名 .dark')
})

test('A4 子集语义 + 首块语义:源头独有档与端内第二块都不归本门判', () => {
  const subset = G.compare({ tokensCss: G.FIX_TOKENS, appCss: G.driftFirstRoot(G.FIX_APP, '--chart-1', '#eeeeee') })
  assert.equal(subset.diffs.length, 1)
  assert.ok(!subset.diffs.some((d) => d.name === '--color-primary'), '源头 @theme 独有档不得算成本门的红(缺档归守门 36)')

  const secondBlock = G.compare({ tokensCss: G.FIX_TOKENS, appCss: `${G.FIX_APP}\n:root {\n  --color-bg: #111111;\n}\n` })
  assert.equal(secondBlock.diffs.length, 0, '端内第二块的漂移不归本门判(合并进来就是假红)')
})

test('A5 选面口径:默认 HEAD、--staged 索引、--worktree 逃生舱、两面旗同给判死', () => {
  assert.equal(G.faceFromArgv([]).face, 'head', '默认档必须是 HEAD(旧默认读磁盘 = 他人半编辑态顶红)')
  assert.equal(G.faceFromArgv(['--staged']).face, 'staged')
  assert.equal(G.faceFromArgv(['--worktree']).face, 'worktree')
  const both = G.faceFromArgv(['--staged', '--worktree'])
  assert.equal(both.face, null)
  assert.match(both.error, /不得同用|互斥/, '两面同给必须给出点名原因')
})

// ───────────────────────── B 三面分叉正控(临时真 git 仓 + 真 CLI) ─────────────────────────

test('B1 HEAD 漂而索引/盘已修好 ⇒ 只有默认档翻红并点名(换面正控:摘掉换面即翻绿)', () => {
  const drifted = G.driftFirstRoot(G.FIX_APP, '--color-bg', '#123456')
  const fx = fixture(() => G.buildFaceFixture({ appCssHead: drifted, appCssIndex: G.FIX_APP, appCssWorktree: G.FIX_APP }))
  const head = G.runCli(dirOf(fx), [])
  const staged = G.runCli(dirOf(fx), ['--staged'])
  const wt = G.runCli(dirOf(fx), ['--worktree'])
  assert.equal(head.code, 1, `默认档必须红,实得 ${head.code}\n${head.out}`)
  assert.match(head.out, /值漂移/)
  assert.match(head.out, /--color-bg/, '必须点名漂的是哪一档')
  assert.match(head.last, /取材面:HEAD blob/, '结论行必须落在末行并写明取材面')
  assert.equal(staged.code, 0, `索引面已修好必须绿,实得 ${staged.code}\n${staged.out}`)
  assert.equal(wt.code, 0, `盘上已修好必须绿,实得 ${wt.code}\n${wt.out}`)
})

test('B2 反向分叉:索引里躺着漂移(盘上随后改对)⇒ 只有 --staged 红', () => {
  const drifted = G.driftFirstRoot(G.FIX_APP, '--color-bg', '#123456')
  const fx = fixture(() => G.buildFaceFixture({ appCssHead: G.FIX_APP, appCssIndex: drifted, appCssWorktree: G.FIX_APP }))
  const staged = G.runCli(dirOf(fx), ['--staged'])
  const head = G.runCli(dirOf(fx), [])
  assert.equal(staged.code, 1, `--staged 必须红,实得 ${staged.code}\n${staged.out}`)
  assert.match(staged.last, /取材面:索引 blob/)
  assert.equal(head.code, 0, `默认档读的是 HEAD 不是索引,实得 ${head.code}\n${head.out}`)
})

test('B3 变异自证:把临时仓副本的默认面改回读磁盘 ⇒ 同一夹具必须翻回绿(证明换面确有牙)', () => {
  const drifted = G.driftFirstRoot(G.FIX_APP, '--color-bg', '#123456')
  const fx = fixture(() => G.buildFaceFixture({ appCssHead: drifted, appCssIndex: G.FIX_APP, appCssWorktree: G.FIX_APP }))
  const copied = G.runCli(dirOf(fx), [])
  assert.equal(copied.code, 1, `改动前必须是红(否则变异后翻绿不代表任何事):${copied.out}`)
  // 只改判定面(不碰取值/判死逻辑):默认档从 HEAD 退回磁盘 —— 正是改造前本门体的行为。
  const abs = join(dirOf(fx), 'scripts', `${G.NAME}.mjs`)
  const src = readFileSync(abs, 'utf8')
  const mutated = src.replace("def: 'head'", "def: 'worktree'")
  assert.notEqual(mutated, src, '变异点没落地(源脚本来历变了,本用例需要跟着改)')
  writeFileSync(abs, mutated, 'utf8')
  const back = G.runCli(dirOf(fx), [])
  assert.equal(back.code, 0, `摘掉换面必须翻绿(仍为 1 ⇒ 默认面其实没在读 HEAD):${back.out}`)
})

// ───────────────────────── C 三面一致 ⇒ 三档全绿(§12e 反证) ─────────────────────────

test('C1 三面一致(同步夹具)⇒ 全量/--staged/--worktree 三档全部 exit 0', () => {
  const fx = fixture(() => G.buildFixture({}))
  const a = G.runCli(dirOf(fx), [])
  const b = G.runCli(dirOf(fx), ['--staged'])
  const c = G.runCli(dirOf(fx), ['--worktree'])
  assert.deepEqual([a.code, b.code, c.code], [0, 0, 0], `head=${a.code} staged=${b.code} worktree=${c.code}\n${a.out}`)
  assert.match(a.last, /取材面:HEAD blob/)
  assert.match(b.last, /取材面:索引 blob/)
  assert.match(c.last, /取材面:工作树/)
})

test('C2 warn 维度不改退出码:app.config.ts 有硬编码色而门体仍 0', () => {
  assert.ok(G.extractHardcodedColors(G.FIX_CONFIG).length === 2, '夹具得有硬编码色(否则本条是空转)')
  const fx = fixture(() => G.buildFixture({}))
  assert.equal(G.runCli(dirOf(fx), []).code, 0)
})

test('C3 源脚本 --self-test 全绿(把门体自己的 36+ 例一起纳入本入口)', () => {
  const r = spawnSync(process.execPath, [TOOL, '--self-test'], { ...spawnOpts, cwd: ROOT })
  assert.equal(r.status, 0, `--self-test 必须 exit 0,实得 ${r.status}\n${r.stdout}\n${r.stderr}`)
  const m = /self-test 全通过\((\d+) 例/.exec(String(r.stdout))
  assert.ok(m && Number(m[1]) >= 30, `自检例数必须现读且不为个位数,实得:${m ? m[1] : '读数缺失'}`)
})

// ───────────────────────── D 未判定:取不到面 / 空扫 / 两面旗同给 ─────────────────────────

test('D1 取不到被审面 ⇒ exit 2 且输出含「未判定」(既不记绿也不冒红)', () => {
  assert.ok(G.UNDET_TXT.includes('未判定'), `判死话术必须含「未判定」,实得:${G.UNDET_TXT}`)
  const noGit = fixture(() => G.buildFixture({ git: false }))
  const head = G.runCli(dirOf(noGit), [])
  const staged = G.runCli(dirOf(noGit), ['--staged'])
  const wt = G.runCli(dirOf(noGit), ['--worktree'])
  assert.equal(head.code, 2, `非 git 目录 + 盘上正确 ⇒ 默认档不得冒绿,实得 ${head.code}\n${head.out}`)
  assert.equal(staged.code, 2, `索引面取不到不得回落到磁盘,实得 ${staged.code}\n${staged.out}`)
  assert.ok(head.out.includes(G.UNDET_TXT) && staged.out.includes(G.UNDET_TXT), `话术必须同出一源:\n${head.out}`)
  assert.match(head.out, /无法判定/, '族内既有锚点(守门 36/218 同词)不得被换掉')
  assert.equal(wt.code, 0, `逃生舱不依赖 git:同一夹具必须能判(反证上面两条是面取不到,不是判据坏)`)

  const noHead = fixture(() => G.buildFixture({ commit: false }))
  const nh = G.runCli(dirOf(noHead), [])
  assert.equal(nh.code, 2, `有仓无提交 ⇒ HEAD 面取不到 exit 2,实得 ${nh.code}\n${nh.out}`)
  assert.ok(nh.out.includes(G.UNDET_TXT))
})

test('D2 两个面旗同给 ⇒ 当场 exit 2 并点名互斥(不得任选一面冒充判定)', () => {
  const fx = fixture(() => G.buildFixture({}))
  const r = G.runCli(dirOf(fx), ['--staged', '--worktree'])
  assert.equal(r.code, 2, `实得 ${r.code}\n${r.out}`)
  assert.ok(r.out.includes(G.UNDET_TXT))
  assert.match(r.out, /不得同用|互斥/)
})

test('D3 枚举到 0 个候选 ⇒ exit 2「未判定」,不得打印 [PASS] 0 variables', () => {
  const emptyApp = fixture(() => G.buildFixture({ appCss: '/* 端内一个 design-token 档都没有 */' }))
  const a = G.runCli(dirOf(emptyApp), [])
  assert.equal(a.code, 2, `副本空扫必须判死,实得 ${a.code}\n${a.out}`)
  assert.ok(a.out.includes(G.UNDET_TXT))
  assert.doesNotMatch(a.out, /\[PASS\]/, '空扫绝不能被读成通过')

  const emptySource = fixture(() => G.buildFixture({ tokensCss: ':root {\n  --spacing-1: 4px;\n}\n' }))
  const b = G.runCli(dirOf(emptySource), [])
  assert.equal(b.code, 2, `源头无 token 档 = 判据无输入 ⇒ 判死,实得 ${b.code}\n${b.out}`)
  assert.ok(b.out.includes(G.UNDET_TXT))
})

test('D4 声明过的输入在面上缺件 ⇒ exit 2 并点名是哪一份(不得当成"没有硬编码色")', () => {
  const fx = fixture(() => {
    const one = G.buildFixture({})
    one.run('rm', '--cached', '--', G.APP_CONFIG_REL)
    one.run('commit', '-qm', 'drop app.config.ts')
    return one
  })
  const r = G.runCli(dirOf(fx), [])
  assert.equal(r.code, 2, `实得 ${r.code}\n${r.out}`)
  assert.match(r.out, /app\.config\.ts/, '必须点名缺的是哪一份输入')
  assert.ok(r.out.includes(G.UNDET_TXT))
})

// ───────────────────────── E 真仓读数:存量与阳性对照 ─────────────────────────

test('E1 真仓 HEAD 面:全量档 exit 0 且"量到了"N>0(判绿必须给证据)', () => {
  const r = runRealGate([])
  assert.equal(r.code, 0, `真仓 HEAD 面必须绿(非零即本门对现状有假),实得 ${r.code}\n${r.out}`)
  const m = /首块 (\d+) 个 design-token 档.*?源头并集 (\d+) 档/.exec(r.out)
  assert.ok(m, `结论行必须报出两侧读数,实得末行:${r.last}`)
  assert.ok(Number(m[1]) > 0 && Number(m[2]) > 0, `读数不得为 0(空扫判绿):app=${m[1]} source=${m[2]}`)
  assert.match(r.last, /取材面:HEAD blob/)
})

test('E2 真仓数据的阳性对照:拿真档改一个值喂进生产判据 ⇒ 必须被抓到', () => {
  const inputs = G.readFaceInputs(ROOT, 'head')
  const real = G.compare({ tokensCss: inputs[G.FACE_RELS[0]], appCss: inputs[G.FACE_RELS[1]] })
  assert.equal(real.diffs.length, 0, `真仓现状必须 0 漂移(存量),实得:${JSON.stringify(real.diffs.slice(0, 3))}`)
  const appVars = G.collectTokenVars(inputs[G.FACE_RELS[1]], [':root'], { firstOnly: true })
  const keys = Object.keys(appVars)
  assert.ok(keys.length > 0, '首块取不到档 ⇒ 本条空转')
  const rebuild = (flip) =>
    `:root {\n${keys.map((n) => `  ${n}: ${flip === n ? `${appVars[n]}-drifted` : appVars[n]};`).join('\n')}\n}\n`
  assert.equal(G.compare({ tokensCss: inputs[G.FACE_RELS[0]], appCss: rebuild(null) }).diffs.length, 0, '原样重建不该红(反证重建本身没引入噪声)')
  const bad = G.compare({ tokensCss: inputs[G.FACE_RELS[0]], appCss: rebuild(keys[0]) })
  assert.equal(bad.diffs.length, 1, `故意做错的同值对必须被抓到,实得:${JSON.stringify(bad.diffs)}`)
  assert.equal(bad.diffs[0].name, keys[0])
})

test('E3 索引面同样取得到(提交链那一份能被独立判定)', () => {
  const staged = G.readFaceInputs(ROOT, 'staged')
  for (const rel of G.FACE_RELS) assert.equal(typeof staged[rel], 'string', `索引面取不到 ${rel}`)
  const r = runRealGate(['--staged'])
  assert.equal(r.code, 0, `--staged 档必须绿,实得 ${r.code}\n${r.out}`)
})

// ───────────────────────── F 取材层 / 装载守卫 / 接线诚实性 ─────────────────────────

test('F1 取材层纪律:正文只经 face-reader 取被审内容,不得 readFileSync 被审文件(守门 118)', () => {
  const src = readFileSync(TOOL, 'utf8')
  assert.match(src, /from '\.\/lib\/face-reader\.mjs'/)
  assert.match(src, /\bcatBatch\(/, '三份输入必须一次 cat-file --batch 同面同轮读完')
  assert.match(src, /readWorktreeFile\(/, '逃生舱必须走层的磁盘面出口')
  assert.match(src, /selectFace\(/, '面旗互斥必须走 selectFace(不许自己解析后放行两面同给)')
  assert.match(src, /new Undetermined|Undetermined\b/, '取不到 ⇒ Undetermined ⇒ exit 2 必须由层给出')
  assert.match(src, /FACE_RELS/, '清单与内容必须同源一份常量')
  assert.doesNotMatch(src, /readFileSync\((?:[^\n]*)APP_CSS|readFileSync\((?:[^\n]*)TOKENS_SOURCE/, '被审内容按磁盘读 = 两头都错')
})

test('F2 §22d 装载守卫与 __test__ 出口在位(import 无副作用)', () => {
  const src = readFileSync(TOOL, 'utf8')
  assert.match(src, /pathToFileURL\(process\.argv\[1\]\)/, 'Windows 上禁手拼 file:///(反斜杠永不匹配)')
  assert.match(src, /if \(isDirectRun\)/, '主流程必须由 isDirectRun 守卫包住')
  assert.match(src, /export const __test__ = \{/, '判据必须有 __test__ 出口(否则镜像测试只能复制判据)')
  assert.equal(typeof G.NAME, 'string')
})

test('F3 接线诚实性:未注册时头注不得自称已接线;注册后必须成套且编号唯一(定级不代拍)', () => {
  const src = readFileSync(TOOL, 'utf8')
  const runner = readFileSync(RUNNER, 'utf8')
  const lines = runner.split('\n')
  const hits = lines.map((l, i) => ({ l, i })).filter((x) => x.l.includes(`script: '${G.NAME}.mjs'`))
  if (hits.length === 0) {
    assert.doesNotMatch(src, /已在\s*pre-commit|本门已接线|已接入提交链/, '未注册却自称已接线 = 守门 89 R1/R2 拦的那一句')
    return
  }
  assert.equal(hits.length, 1, `同一 script 必须恰好注册一次,实得 ${hits.length} 次`)
  // 2026-10-21:原先用 `hits[0].i ± 16/24` 行的固定窗口取注册块 —— 相邻门(226 hook-form)
  // 的 id 与 skipEnv 正好落进这个窗口,于是本门读到的是**别人那条**登记,判成撞号/串名。
  // 改成按对象边界取:向上找到条目起始的 `  {`,向下找到配平的 `  },`。
  const objStart = (() => {
    for (let j = hits[0].i; j >= 0; j--) if (/^\s{2}\{\s*$/.test(lines[j])) return j
    return Math.max(0, hits[0].i - 16)
  })()
  const objEnd = (() => {
    for (let j = hits[0].i; j < lines.length; j++) if (/^\s{2}\},?\s*$/.test(lines[j])) return j
    return Math.min(lines.length - 1, hits[0].i + 24)
  })()
  const block = lines.slice(objStart, objEnd + 1).join('\n')
  const idMatch = block.match(/id:\s*'(\d+)'/)
  assert.ok(idMatch, '注册块里找不到 id —— 条目形状被改坏')
  const ids = [...runner.matchAll(/id:\s*'(\d+)'/g)].map((m) => m[1])
  assert.equal(ids.filter((x) => x === idMatch[1]).length, 1, `id ${idMatch[1]} 在 runner 里撞号 ⇒ 两道门的结论互相冒名`)
  const mode = block.match(/mode:\s*'(blocking|warn|info)'/)
  assert.ok(mode, '注册条目必须显式定级(blocking 的前置 = 本文件 HEAD 面存量归零,§12e)')
  const skip = block.match(/skipEnv:\s*'([A-Z0-9_]+)'/)
  if (mode[1] === 'blocking') assert.ok(skip, 'blocking 条目必须配应急放行变量(§22c 形态锁:成套)')
  if (skip)
    assert.equal(
      skip[1],
      G.SKIP_ENV,
      `runner 登记的 skipEnv 必须与脚本里的 SKIP_ENV 逐字相同(实登:${skip[1]} / 脚本:${G.SKIP_ENV}) —— 不同名 = 应急那一刻静默无效(§0.8)`,
    )
})

test('F4 应急放行变量"验过才免":设了它必须真的放行且如实写"未判定"(§0.7)', () => {
  assert.equal(typeof G.SKIP_ENV, 'string', '__test__ 必须导出 SKIP_ENV(否则本条只能硬写名字 = 第二份常量)')
  const r = spawnSync(process.execPath, [TOOL], {
    ...spawnOpts,
    cwd: ROOT,
    env: { ...process.env, [G.SKIP_ENV]: '1' },
  })
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
  assert.equal(r.status, 0, `放行档必须 exit 0,实得 ${r.status}\n${out}`)
  assert.match(out, /人工放行/, '放行必须留一行可见痕迹,静默 exit 0 会把"没判"渲染成"判过"')
  assert.doesNotMatch(out, /\[PASS\]/, '放行档不得打印通过结论')
  // 阳性对照:同一个变量清空后门照常判定(证明上面那条绿是"放行生效",不是"门失明")。
  const back = runRealGate([])
  assert.equal(back.code, 0, `常规档必须回到真判定,实得 ${back.code}\n${back.out}`)
  assert.match(back.out, /\[PASS\]/)
})

test('F5 三面取材的输入清单与门体常量同源(不许在测试里另抄路径)', () => {
  assert.deepEqual(G.FACE_RELS, [
    'packages/design-tokens/src/styles/tokens.css',
    'apps/miniapp-taro/src/app.css',
    'apps/miniapp-taro/src/app.config.ts',
  ])
  assert.equal(G.APP_CONFIG_REL, 'apps/miniapp-taro/src/app.config.ts', '路径常量必须由 app.css 派生(正斜杠,喂 git show 才取到)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
