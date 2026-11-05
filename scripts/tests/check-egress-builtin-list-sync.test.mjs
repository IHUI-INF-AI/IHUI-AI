// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像用例:scripts/check-egress-builtin-list-sync.mjs 的三格对账尺(goal-b49 Z26)。
// 纪律(§0.6 / §22c):本文件**不复制任何判据** —— 三格的实现全部 import 门体的 __test__,
// 名单/行/向量全部 import 生成器的 __test__.buildManifest 现算,写死的只有夹具形状。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { __test__ as GATE } from '../check-egress-builtin-list-sync.mjs'
import { __test__ as GEN } from '../generate-egress-builtin-list.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..', '..')

const GOOD_INCLUDE = `include_str!("../../../../${GEN.ARTIFACT_REL}")`
const fixtureManifest = (over = {}) => ({
  schema: 'ihui-egress-builtin-list/v1',
  hostNames: ['localhost'],
  hostSuffixes: ['.local'],
  deniedCidrs: ['127.0.0.0/8'],
  ipv6EmbeddedV4Prefixes: [],
  rows: [{ id: 'builtin:host:localhost', domain: 'localhost', effect: 'deny', enforcement: 'advisory', why: 'x' }],
  vectors: [{ target: 'localhost', decision: 'deny', layer: 'rule', reason: 'rule-deny', ruleId: 'builtin:host:localhost' }],
  ...over,
})

test('牙 1:L2 无 include / include 指歪 / 门体抄名单 ⇒ 红;指对且零字面量 ⇒ 绿', () => {
  assert.equal(GATE.checkRustConsumes('fn a() {}', fixtureManifest()).ok, false, '没有 include_str! 必须红')
  assert.equal(GATE.checkRustConsumes('include_str!("../../elsewhere/x.json")', fixtureManifest()).ok, false, '指向别处的 include 必须红')
  assert.equal(GATE.checkRustConsumes(GOOD_INCLUDE, fixtureManifest()).ok, true, '指对且零字面量必须绿')
  assert.equal(GATE.checkRustConsumes(`${GOOD_INCLUDE}\nconst X: &str = "localhost";`, fixtureManifest()).ok, false, '名单字面量被抄进门体必须红(§0.6 第二把尺)')
  assert.equal(GATE.checkRustConsumes(`${GOOD_INCLUDE}\n// "localhost" 只在头注里点名`, fixtureManifest()).ok, true, '注释里的点名不算抄')
})

test('牙 2:L3 向量 0 枚 / 件里有向量但 Rust 没跑 ⇒ 红;逐值跑过 ⇒ 绿', () => {
  assert.equal(GATE.checkVectors('vectors.iter()', fixtureManifest({ vectors: [] })).ok, false, '枚举到 0 判死,不记绿(§0.3)')
  assert.equal(GATE.checkVectors('fn nothing() {}', fixtureManifest()).ok, false, '件吃到了但没人对账 ⇒ 红(§0.9)')
  assert.equal(GATE.checkVectors('for v in manifest().vectors {', fixtureManifest()).ok, true)
})

test('牙 3:L1 产物与源重算差一个字节就红;两面旗同给 ⇒ 未判定', async () => {
  const m = fixtureManifest()
  const text = GEN.serialize(m)
  assert.equal((await GATE.checkArtifactVsSource('worktree', { artifactText: text, recomputed: text })).ok, true)
  assert.equal((await GATE.checkArtifactVsSource('worktree', { artifactText: `${text}\n`, recomputed: text })).ok, false, '手改派生件必须红')
  assert.throws(() => GATE.faceFlags(['--staged', '--worktree']), GATE.Undetermined, '两面旗同给 ⇒ 未判定')
})

test('现面三格全绿(件 ⇄ 源 ⇄ Rust include 逐字节同源)', async () => {
  const engines = await GEN.loadTsEngines()
  const manifest = GEN.buildManifest(engines)
  const recomputed = GEN.serialize(manifest)
  const artifactText = GATE.readFace('worktree', GEN.ARTIFACT_REL)
  const rustText = GATE.readFace('worktree', GATE.RUST_GATE_REL)
  assert.equal((await GATE.checkArtifactVsSource('worktree', { artifactText, recomputed })).ok, true, '产物 == 源重算(否则跑生成器 --write)')
  assert.equal(GATE.checkRustConsumes(rustText, manifest).ok, true)
  assert.equal(GATE.checkVectors(rustText, manifest).ok, true)
  assert.ok(manifest.vectors.length >= 40, `行为向量现读 ${manifest.vectors.length} 枚,少于 40 ⇒ 语料退化`)
})

test('反向锁:生成器与门体都不许把名单当数据抄第二份', () => {
  const genText = readFileSync(join(repoRoot, 'scripts/generate-egress-builtin-list.mjs'), 'utf8')
  const gateText = readFileSync(join(repoRoot, 'scripts/check-egress-builtin-list-sync.mjs'), 'utf8')
  const cidrs = JSON.parse(artifactJson()).deniedCidrs
  const inGen = cidrs.filter((c) => genText.includes(`'${c}'`))
  assert.ok(inGen.length <= 1, `生成器内联了 ${inGen.length} 条网段字面量(只允许 --self-test 的一枚探针): ${JSON.stringify(inGen)}`)
  const inGate = cidrs.filter((c) => gateText.includes(`'${c}'`))
  assert.deepEqual(inGate, [], '对账尺不得内联网段名单')
})

function artifactJson () {
  return readFileSync(join(repoRoot, GEN.ARTIFACT_REL), 'utf8')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
