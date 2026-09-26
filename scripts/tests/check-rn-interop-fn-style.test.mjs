// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门 131(check-rn-interop-fn-style.mjs)的 §22c 镜像测试。
// 为什么每例都存在:本门的判据输入是**从 node_modules 现读的一张注册表**,而它管的是
// "整份内联 style 静默消失"这种没有任何编译期症状的缺陷 —— 门被摘线、注册表被换成手写清单、
// 或预筛面被收窄,表现都同样是"一路报绿"。所以这里既有行为对照,也有源码形状锁。
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import { __test__ as gate } from '../check-rn-interop-fn-style.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const RUNNER = join(REPO, 'scripts', 'guardian-runner.mjs')
const SRC = join(REPO, 'scripts', 'check-rn-interop-fn-style.mjs')
const EXPIRY = join(REPO, 'scripts', 'check-exemption-expiry.mjs')

function runNode(args) {
  return execFileSync(process.execPath, args, {
    cwd: REPO,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    windowsHide: true,
    timeout: 600000,
  })
}

test('T1 装车证明:runner 里必须有 id 131,且 blocking + skipEnv + stagedTriggers 齐备', () => {
  const src = readFileSync(RUNNER, 'utf8')
  const at = src.indexOf("id: '131'")
  assert.ok(at >= 0, '守门 131 不在 runner 里 —— 门存在但没人调度 = 没有(§22c 反复记过)')
  const block = src.slice(at, at + 2600)
  assert.ok(block.includes("script: 'check-rn-interop-fn-style.mjs'"), 'id 131 指向的不是本门')
  assert.match(block, /mode:\s*'blocking'/, '本门必须是 blocking(存量已有棘轮兜住,不会恒红)')
  assert.ok(block.includes('HUSKY_SKIP_RN_INTEROP_FN_STYLE'), '缺应急出口 = 出事时只能改判据')
  assert.ok(
    block.includes("stagedTriggers: ['apps/mobile-rn/', 'packages/app/']"),
    '触发面必须覆盖两个 RN 源',
  )
})

test('T2 反向对照:runner 里没有本门时,T1 那种"已装车"结论不得成立', () => {
  // 与 114/117/127 的门同一条方向性规矩:未注册时**不得被判定为已装车**。
  // 做法是把注册块整段删掉再跑同一条查找 —— 若判据写成"文件里提到过脚本名就算",这里会假绿。
  const src = readFileSync(RUNNER, 'utf8')
  const stripped = src.replace(/id: '131'[\s\S]*?\n  \},\n/, '')
  assert.notEqual(stripped, src, '夹具没能剥掉注册块(正则失效,本例就失去意义)')
  assert.ok(!/id: '131'/.test(stripped))
  assert.ok(
    !stripped
      .slice(stripped.indexOf("id: '130'"), stripped.indexOf("id: '132'"))
      .includes('check-rn-interop-fn-style'),
  )
})

test('T3 豁免族必须登记进守门 108 的存活期表(否则豁免只有出生没有死亡)', () => {
  const src = readFileSync(EXPIRY, 'utf8')
  assert.ok(
    /'interop-style-exempt':\s*30/.test(src),
    'interop-style-exempt 未进 FAMILY_LIFETIME_DAYS',
  )
  assert.ok(
    gate.EXEMPT.test('x // interop-style-exempt: 原因'),
    '豁免标记形态与门 108 登记的不是同一条',
  )
})

test('T4 形状锁:取材必须经 face-reader,不得回磁盘直读内容(门 118 那一型)', () => {
  const src = readFileSync(SRC, 'utf8')
  assert.ok(src.includes("from './lib/face-reader.mjs'"), '没引取材层')
  assert.ok(/catBatch\(/.test(src), '内容必须经 catBatch 按面读(引了层却自己 git show = 半接线)')
  assert.ok(!/readFileSync\(\s*join\(\s*ROOT/.test(src), '不得用 ROOT 拼磁盘路径读被审内容')
})

test('T5 真仓阳性对照:全量面必须看得见存量(看不见=判据对该形态全盲,不是"已清完")', () => {
  const r = gate.analyze('head')
  assert.equal(
    r.exit,
    0,
    `全量面应绿(锚点=该文件 HEAD 自身存量);实得 ${JSON.stringify(r.red).slice(0, 200)}`,
  )
  assert.ok(r.total > 50, `真仓存量读出来只有 ${r.total} 处 —— 判据或射程被改窄了,这不算通过`)
  assert.ok(r.filesWithHits > 20, `命中文件数 ${r.filesWithHits} 异常偏低`)
  assert.ok(r.scannedFiles > 300, `扫描文件数 ${r.scannedFiles} 异常偏低(枚举面失效)`)
})

test('T6 注册表必须现读,且内置兜底清单是它的子集(清单腐烂即红)', () => {
  const derived = gate.deriveInteropRegistry(gate.readInteropSource(REPO))
  assert.ok(derived, '现读注册表为空/读不到 —— 本门正在用内置清单冒充,必须装依赖后再判')
  assert.ok(derived.has('Pressable'), '现读结果里没有 Pressable,正则或包路径漂了')
  assert.ok(
    gate.FALLBACK_REGISTRY.every((n) => derived.has(n)),
    `内置清单有现读注册表不存在的名字:${gate.FALLBACK_REGISTRY.filter((n) => !derived.has(n)).join(' , ')}`,
  )
  // Modal 刻意**不在**注册表里 —— 这条断言防的是有人"顺手把 Modal 加进兜底表"造成误判
  assert.ok(!derived.has('Modal'), '现读注册表里出现了 Modal:包已改版,兜底表与判据都要跟着重导')
})

test('T7 双向对照:注册组件命中、自定义组件放过,无原因豁免不生效', () => {
  const REG = new Set(['Pressable'])
  const hit = `  <Pressable\n    style={({ pressed }) => [a, pressed && b]}\n  />`
  assert.equal(gate.findFnStyleHits(hit, REG).hits.length, 1)
  const own = hit.replace('<Pressable', '<MyCard')
  assert.equal(gate.findFnStyleHits(own, REG).hits.length, 0, '自定义组件收函数形态是它自己的契约')
  const bare = `  <Pressable\n    // interop-style-exempt:\n    style={({ pressed }) => [a, pressed && b]}\n  />`
  assert.equal(gate.findFnStyleHits(bare, REG).hits.length, 1, '裸标记(不带原因)不得放行')
  const arr = '  <Pressable style={[a, b]} />'
  assert.equal(gate.findFnStyleHits(arr, REG).hits.length, 0, '数组形态放过')
})

test('T8 回溯不到开标签必须计"未判定"并报告,绝不静默丢命中', () => {
  const orphan = '  style={({ pressed }) => [a, pressed && b]}'
  const r = gate.findFnStyleHits(orphan, new Set(['Pressable']))
  assert.equal(r.hits.length, 0)
  assert.equal(r.undetermined.length, 1, '看不见归属却一声不吭 = 把"没判"写成"判过了"')
})

test('T9 --self-test 端到端 exit 0', () => {
  const out = runNode([join(REPO, 'scripts', 'check-rn-interop-fn-style.mjs'), '--self-test'])
  assert.match(out, /--self-test: 全部通过/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
