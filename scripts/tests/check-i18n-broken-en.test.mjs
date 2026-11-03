#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `check-i18n-broken-en.mjs --target` fail-closed 的判据测试。
 *
 * ## 这个门原本的缺陷（为什么值得有测试）
 * 修前: `--target=api` / `--target=zzz` / 不带参数 三种跑法**输出逐字相同**、都报
 * `✅ 通过`。因为 target 只用来算isExtension / isShared 两个布尔，剩下的全落进
 * 无条件 `else` 分支去扫 web。后果:给一个不存在的 target,门会回"通过" ⇒ **假绿**。
 * 守门脚本的假绿比不判更糟:它会把"这个面没人管"伪装成"这个面没问题"。
 *
 * ## 测在哪一层:CLI 黑盒 + 判据单点导出(两条腿各司其职)
 * 本门真实的风险面是"命令行跑起来会不会说假话",所以退出码 + 首行输出这一层必须用真子进程测。
 * 但**只**有这一层是不够的:2026-10-08 前门体在模块顶层裸调 `main()`、零导出,测试想拿判据
 * 就只能自己抄一份(§22c 禁止的两套真相)。门体现已按 §22d 加 `isDirectRun` 守卫、经
 * `export const __test__` 单点导出判据 —— 本文件因此**不再自带 target 清单**,受支持面
 * 直接取 `gate.SUPPORTED_TARGETS`(同一份材料只有一个出处)。
 *
 * ## 判据两条腿
 *   - 反向防线:未知 target ⇒ 非零退出 **且** 输出里不含"通过"(防回落假绿复发)
 *   - 防锁死:三个合法 target + 默认行为仍能正常跑(防把门焊死成"永远报错")
 *   - 入口面(§22d):裸 `import` 门体必须零输出、退出码 0 —— 否则测试一 import 就跑扫描,
 *     守门脚本把自己宿主(测试运行器)的进程状态也改了
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
// §26:临时夹具唯一落点(不得用 os.tmpdir()/mkdtempSync,check-fixture-tmpdir 会判红)。
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
// §22c:判据从门体取,绝不在本文件重述一份。
import { __test__ as gate } from '../check-i18n-broken-en.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const SCRIPT = path.join(ROOT, 'scripts', 'check-i18n-broken-en.mjs')

/** 跑一次本门，返回 { code, first, all } —— first 只取首行,避免多行错误信息干扰断言。 */
function runGate(args, opts = {}) {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: opts.cwd || ROOT,
    encoding: 'utf8',
    windowsHide: true,
    // 这个门不吃 stdin —— 不显式 ignore 会在 Windows 上偶发 EBUSY(仓库已知病症)。
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const all = `${r.stdout || ''}${r.stderr || ''}`
  return { code: r.status, first: (all.split('\n')[0] || '').trim(), all, stdout: r.stdout || '', stderr: r.stderr || '' }
}

// 受支持清单只有一个出处 = 门体导出的那一份(旧写法在这里手抄 ['web','extension','shared'])。
const SUPPORTED = gate.SUPPORTED_TARGETS

// ---- 反向防线:未知 target 必须拒绝,绝不静默回落 ----

test('未知 target 非零退出(修前此处是假绿)', () => {
  const r = runGate(['--target=zzz'])
  assert.notEqual(r.code, 0, '未知 target 必须非零退出')
})

test('未知 target 的输出不得出现"通过"(这条直接钉住假绿)', () => {
  const r = runGate(['--target=zzz'])
  assert.ok(
    !r.all.includes('通过'),
    `未知 target 的输出里出现"通过" = 假绿回来了。实际输出:\n${r.all}`,
  )
})

test('未知 target 的输出必须点明它被拒绝、且列出受支持清单', () => {
  const r = runGate(['--target=zzz'])
  assert.match(r.all, /未知/, '应说明这是未知 target')
  assert.match(r.all, /web/, '应列出受支持的 target,便于调用方自查')
})

test('真实存在但本门未覆盖的 target 同样必须被拒(不得回落)', () => {
  // api / cli / miniapp-taro / mobile-rn 在 packages/i18n/messages/ 下确实有 en.json,
  // 但本脚本没接这4 面。落进"静默扫 web"是最坏结果:它会替这4 个面背书"没问题"。
  for (const t of ['api', 'cli', 'miniapp-taro', 'mobile-rn']) {
    const r = runGate([`--target=${t}`])
    assert.notEqual(r.code, 0, `--target=${t} 必须非零退出`)
    assert.ok(!r.all.includes('通过'), `--target=${t} 回落假绿`)
  }
})

test('空 target(--target=)不得被当成 web 放行', () => {
  const r = runGate(['--target='])
  assert.notEqual(r.code, 0, '空 target 必须拒绝,不能回落成默认 web')
})

test('带多余后缀的 target(--target=web=extra)必须拒绝,不得截断成 web', () => {
  // 这条是**解析层**的牙,不是白名单的牙 —— 白名单本身对 `'web=extra'` 就会拒绝,
  // 所以它抓不到解析退化。真正能区分两种解析写法的是这个形状:
  //   targetArg.split('=')[1]→ 'web'      (截断后**放行**)
  //   targetArg.slice(9)              → 'web=extra' (完整取值后拒绝)
  // 变异实测:把解析改回 split('=')[1] 时,本条会红;只动白名单不动解析时,本条仍绿。
  const r = runGate(['--target=web=extra'])
  assert.notEqual(r.code, 0, '--target=web=extra 必须被拒绝,不得截断成 web 放行')
  assert.ok(!r.all.includes('通过'), '--target=web=extra 不得回出"通过"')
})

// ---- 防锁死:合法路径必须仍然能跑 ----

test('三个受支持 target 仍能正常跑(防把门焊死)', () => {
  for (const t of SUPPORTED) {
    const r = runGate([`--target=${t}`])
    assert.equal(r.code, 0, `--target=${t} 应正常退出,实际:\n${r.all}`)
    assert.match(r.all, /通过/, `--target=${t} 应给出结论`)
  }
})

test('不带 --target 的默认行为仍是 web(行为不得被本次修复改变)', () => {
  const bare = runGate([])
  const web = runGate(['--target=web'])
  assert.equal(bare.code, 0)
  assert.equal(
    bare.first,
    web.first,
    '默认跑法与 --target=web 的首行输出必须一致,否则说明默认值被改动过',
  )
})

test('受支持清单与文件头文档声明一致(防文档漂移成第二判据源)', () => {
  // 直接读源文件文本:本测试文件是 ESM,不能用 require(实测 require 在 -e 里拿不到 exports)。
  const src = readFileSync(SCRIPT, 'utf8')
  for (const t of SUPPORTED) {
    assert.ok(src.includes(t), `文件头文档未提及受支持 target: ${t}`)
  }
})

// ---- §22d 入口面:门体被 import 时只能"交出判据",不得执行扫描 ----

test('裸 import 门体零副作用:stdout 无输出、宿主进程 rc=0、且拿得到 __test__', () => {
  // 这一条钉的是本票的成因本身:门体原先在模块顶层裸调 main(),于是"想复用判据"就必须
  // 先替它跑一遍扫描(输出 + 可能的 process.exit)—— 测试拿不到干净的判据面,只能自抄。
  // 变异对照:把守卫摘掉(改回裸 main())时,本条必红(stdout 非空 / rc 非 0)。
  const probe =
    `import(${JSON.stringify(pathToFileURL(SCRIPT).href)}).then(` +
    `(m) => process.stderr.write('KEYS=' + Object.keys(m).sort().join(',')), () => process.stderr.write('IMPORT-THREW'))`
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', probe], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert.equal(r.status, 0, `import 门体把宿主进程的退出码带走了(rc=${r.status}):\n${r.stderr}`)
  assert.equal(r.stdout, '', `import 门体就跑了一遍扫描(§22d 守卫失效):\n${r.stdout}`)
  assert.match(r.stderr, /^KEYS=.*__test__/, `门体未导出 __test__:${r.stderr}`)
})

test('§22d 形状锁:守卫在位、__test__ 排在守卫之后、不得再出现行首裸 main()', () => {
  const gateSrc = readFileSync(SCRIPT, 'utf8')
  assert.match(gateSrc, /const isDirectRun = process\.argv\[1\] && import\.meta\.url === pathToFileURL\(process\.argv\[1\]\)\.href/)
  assert.match(gateSrc, /if \(isDirectRun\) \{/)
  assert.match(gateSrc, /export const __test__ = \{/)
  // 行首(零缩进)裸调 main() = 一 import 就扫仓;守卫内的缩进调用形态是合规的
  assert.doesNotMatch(gateSrc, /^main\(\)\s*$/m)
  assert.ok(
    gateSrc.indexOf('if (isDirectRun) {') < gateSrc.indexOf('export const __test__ = {'),
    '__test__ 必须排在 if (isDirectRun) 之后(§22d 规定的文件末尾形态)',
  )
})

test('判据取自门体本体:gate.detectBroken 正反都有料(本文件不再写第二条检测规则)', () => {
  assert.equal(typeof gate.detectBroken, 'function', '门体必须把检测判据本身导出')
  assert.ok(Array.isArray(gate.SUPPORTED_TARGETS) && gate.SUPPORTED_TARGETS.length >= 3, '受支持清单必须来自门体且非空')
  assert.equal(gate.detectBroken('AgentDevPlatform'), 'no-space-concat', '三段无空格拼接必须判破(正向)')
  assert.equal(gate.detectBroken('这里是中文残留'), 'zh-residue', '中文残留兜底必须仍在')
  assert.equal(gate.detectBroken('Data Pipeline'), null, '正常英文不得判破(反向)')
  assert.equal(gate.detectBroken('IHUI AI (智汇 AI)'), null, '括号内中文品牌标注必须豁免')
})

test('--readme 档退出码契约:违规⇒ rc=1、干净⇒ rc=0(main() 改返回值后仍要成立)', () => {
  const dir = mkScratch('ibe-readme-')
  try {
    writeFileSync(path.join(dir, 'README.en.md'), 'See AgentDevPlatform for details.\n')
    const bad = runGate(['--readme'], { cwd: dir })
    assert.equal(bad.code, 1, `README 里有破碎机翻却 rc=${bad.code}(退出码契约断了):\n${bad.all}`)
    assert.match(bad.all, /发现 1 处/)
    writeFileSync(path.join(dir, 'README.en.md'), 'This pipeline is well written.\n')
    const clean = runGate(['--readme'], { cwd: dir })
    assert.equal(clean.code, 0, `干净 README 应 rc=0,实得 ${clean.code}:\n${clean.all}`)
    assert.match(clean.all, /通过/)
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
