// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:门 253(scripts/check-mjs-export-resolution.mjs)的 D4「模块对象属性取用」维 + 存量点名。
//
// 立因(2026-10-30 实测):15:41 那笔 258 文件合车把 scripts/gen-miniapp-mirror.mjs 的 4 枚具名出口与
// __test__ 同名键一起洗掉,消费方走 `import { __test__ as G }` + `G.buildShellPage(...)` /
// `import * as gen` + `gen.buildShellPage(...)` ⇒ D1(import 说明符)与 D2(具名出口)双盲,
// 5 件器物在 HEAD 上 ESM 链接期即抛,跨端对账尺与三条自愈腿停摆约 1.5 小时。
//
// 成对纪律:每一型都有正控(必须点名)+ 反向对照(摘掉缺陷/换成合法形态必须归零)。
// 判据一律 import 源脚本 __test__(§22c:测试里不复制第二份判据)。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as T } from '../check-mjs-export-resolution.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const GATE = resolve(ROOT, 'scripts/check-mjs-export-resolution.mjs')

const mk = (obj) => new Map(Object.entries(obj))
const d4 = (obj, onlyPaths = null) =>
  T.propertyAccessFindings(mk(obj), { onlyPaths: onlyPaths ? new Set(onlyPaths) : null })

test('D4-1 正控:__test__ 别名取了已被削掉的键 ⇒ 点名(文件:行 + 接收者.属性 + 目标)', () => {
  const r = d4({
    'scripts/a.mjs': `import { __test__ as G } from './b.mjs'\nexport const y = G.buildShellPage({})\n`,
    'scripts/b.mjs': `export const __test__ = { buildPage: 1 }\n`,
  })
  assert.equal(r.findings.length, 1, JSON.stringify(r))
  assert.equal(r.findings[0].path, 'scripts/a.mjs')
  assert.equal(r.findings[0].at, 2)
  assert.equal(r.findings[0].name, 'buildShellPage')
  assert.equal(r.findings[0].kind, 'tester')
})

test('D4-2 反向对照:同一份消费方,键还在 ⇒ 0 条(不是"用了模块对象就红")', () => {
  const r = d4({
    'scripts/a.mjs': `import { __test__ as G } from './b.mjs'\nexport const y = G.buildShellPage({})\n`,
    'scripts/b.mjs': `export const __test__ = { buildShellPage: 1, buildPage: 1 }\n`,
  })
  assert.deepEqual(r.findings, [])
})

test('D4-3 命名空间导入同判:Ns.foo 而目标无 foo ⇒ 1 条;shadow 掉接收者 ⇒ 跳过(fail-open)', () => {
  const star = d4({
    'scripts/a.mjs': `import * as Ns from './b.mjs'\nexport const y = Ns.nope()\n`,
    'scripts/b.mjs': `export const ok = 1\n`,
  })
  assert.equal(star.findings.length, 1, JSON.stringify(star))
  const shadowed = d4({
    'scripts/a.mjs': `import * as Ns from './b.mjs'\nexport const f = (Ns) => Ns.nope()\n`,
    'scripts/b.mjs': `export const ok = 1\n`,
  })
  assert.deepEqual(shadowed.findings, [], '无法证明访问的是模块对象时必须跳过,宁可少报')
})

test('D4-4 判不了就不判且要留痕:export * / __test__ 展开 / 目标面缺失 ⇒ skipped 非空、findings 为空', () => {
  const star = d4({
    'scripts/a.mjs': `import * as Ns from './b.mjs'\nexport const y = Ns.maybe()\n`,
    'scripts/b.mjs': `export * from './c.mjs'\n`,
    'scripts/c.mjs': `export const maybe = 1\n`,
  })
  assert.deepEqual(star.findings, [])
  assert.equal(star.skipped.length, 1)
  const spread = d4({
    'scripts/a.mjs': `import { __test__ as G } from './b.mjs'\nexport const y = G.k()\n`,
    'scripts/b.mjs': `export const other = 1\nexport const __test__ = { ...other }\n`,
  })
  assert.deepEqual(spread.findings, [])
  assert.equal(spread.skipped.length, 1)
})

test('D4-5 射程锁:onlyPaths 之外的文件一条也不点名(blocking 只收本枚改动集,§12e)', () => {
  const r = d4(
    {
      'scripts/a.mjs': `import { __test__ as G } from './b.mjs'\nexport const y = G.gone()\n`,
      'scripts/b.mjs': `export const __test__ = { buildPage: 1 }\n`,
    },
    ['scripts/b.mjs'],
  )
  assert.deepEqual(r.findings, [])
})

test('D4-6 真实文件端到端:把 gen-miniapp-mirror 的 __test__ 键按事故形态削掉,gates 点名 848 行', () => {
  const consumerRel = 'scripts/plan-hand-mirror-conversion.mjs'
  const producerRel = 'scripts/gen-miniapp-mirror.mjs'
  const cText = readFileSync(resolve(ROOT, consumerRel), 'utf8')
  const pText = readFileSync(resolve(ROOT, producerRel), 'utf8')
  const broken = pText.replace(/(export const __test__ = \{[\s\S]*?)\n  buildShellPage,/, '$1')
  assert.notEqual(broken, pText, '夹具没改到 ⇒ 本用例失去意义,应翻红')
  const hit = d4({ [consumerRel]: cText, [producerRel]: broken }, [consumerRel])
  assert.ok(
    hit.findings.some((f) => f.path === consumerRel && f.name === 'buildShellPage'),
    `事故形态没被点名:${JSON.stringify(hit.findings)}`,
  )
  const healthy = d4({ [consumerRel]: cText, [producerRel]: pText }, [consumerRel])
  assert.deepEqual(healthy.findings, [], '健康形态必须 0 条(否则是假阳)')
})

test('D4-7 CLI 锁:--self-test 全绿 + 全数档把存量逐条点名(不是匿名数字)+ 退出码 0', () => {
  const self = execFileSync(process.execPath, [GATE, '--self-test'], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  assert.match(self, /自检 \d+\/\d+ 通过/)
  const full = execFileSync(process.execPath, [GATE, '--stock'], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    maxBuffer: 1 << 26,
  })
  assert.match(full, /D1\/D2\/D3\/D4/, '末行必须报四维读数')
  assert.match(full, /存量已点名见上/, '存量段必须存在(有则逐条,无则零条也说明白)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
