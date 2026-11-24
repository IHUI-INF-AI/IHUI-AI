// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scripts/check-face-spec-hardcode.mjs` 的镜像测试(元门 A)。
 *
 * 阴性对照的构造方式:直接把 2026-11-07 三条真实事故的**原写法**作为夹具喂给识别器。
 * 只有"这些夹具命中、且合规写法不命中"时,这条判据才算成立 —— 否则 0 命中可能只是尺子坏了。
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  baselineKeysFrom,
  fingerprintHits,
  scanFaceSpecText,
  splitByBaseline,
} from '../lib/face-spec-scan.mjs'

/** 事故 1:check-guarded-write-affected.mjs:360-356 —— staged 面映射成 ':' 再拼 rev ⇒ `::path`。 */
const ACCIDENT_1 = ["const FACE_REV = { head: 'HEAD', staged: ':', worktree: null }", "const r = git(['show', `${rev}:${file}`])"].join('\n')

/** 事故 1 的另一种写法:直接拼双冒号。 */
const ACCIDENT_1_CONCAT = "const specs = files.map((p) => '::' + p)"

/** 事故 2:check-generator-resource-release.mjs:702 —— staged 面退化成裸路径。 */
const ACCIDENT_2 = "const specs = paths.map((p) => `${face === 'staged' ? '' : 'HEAD:'}${p}`)"

/** 事故 3:check-readout-no-break.mjs:288/322/414 —— 非法 rev `:!0`。 */
const ACCIDENT_3 = "const faceText = readAt(':!0', p)"
const ACCIDENT_3_REV = "const rev = face === 'staged' ? ':!0' : 'HEAD'"
const ACCIDENT_3_SHOW = "gitShow(':!0', p)"

/** 用户点名的第四类写法:HEAD 前缀硬拼。 */
const ACCIDENT_HEAD_CONCAT = "const specs = files.map((x) => (face === 'staged' ? ':' + x : 'HEAD:' + x))"

function ids(text) {
  return scanFaceSpecText(text).map((h) => h.patternId)
}

test('阴性对照:事故 1 原写法必须命中(staged 映射成裸冒号)', () => {
  assert.ok(ids(ACCIDENT_1).includes('staged-colon-map'), `实际:${ids(ACCIDENT_1).join(',')}`)
})

test('阴性对照:事故 1 的 `::` 拼接必须命中', () => {
  assert.ok(ids(ACCIDENT_1_CONCAT).includes('double-colon-concat'))
})

test('阳性对照:rev 值自带尾冒号的映射不算违规(HEAD 面已有人改成此形态)', () => {
  const ok = ["const FACE_REV = { staged: ':', head: 'HEAD:' }", 'const text = gitRaw([${FACE_REV[face]}${p}], root)']
  assert.deepEqual(ids(ok.join('\n')), [], `正确形态被误报:${ids(ok.join('\n')).join(',')}`)
})

test('阴性对照:事故 2 原写法必须命中(裸路径三元)', () => {
  assert.ok(ids(ACCIDENT_2).includes('bare-path-ternary'), `实际:${ids(ACCIDENT_2).join(',')}`)
})

test('阴性对照:事故 3 原写法必须命中(非法 rev `:!0`)', () => {
  for (const fixture of [ACCIDENT_3, ACCIDENT_3_REV, ACCIDENT_3_SHOW]) {
    assert.ok(ids(fixture).includes('staged-bang-rev'), `夹具未命中:${fixture}`)
  }
})

test('阴性对照:HEAD 前缀硬拼必须命中', () => {
  assert.ok(ids(ACCIDENT_HEAD_CONCAT).includes('head-prefix-concat'))
})

test('阳性对照:走统一 helper 的写法不得命中', () => {
  const ok = [
    'const got = readFaceBatch(root, face, rels)',
    "const text = readFaceOne(root, 'staged', rel)",
    "gitRaw(['show', 'HEAD:README.md'], root)",
  ]
  for (const src of ok) assert.deepEqual(ids(src), [], `合规写法被误报:${src}`)
})

test('注释里的坏写法不得命中', () => {
  const src = ["// 旧写法 readAt(':!0', p) 已废弃", "/* const specs = 'HEAD:' + x */", 'const ok = 1']
  assert.deepEqual(scanFaceSpecText(src.join('\n')).map((h) => h.patternId), [])
})

test('行号必须准(注释不吞换行)', () => {
  const src = ['// 第一行注释', 'const a = 1 // 行尾注释', "const r = readAt(':!0', p)"].join('\n')
  const hit = scanFaceSpecText(src).find((h) => h.patternId === 'staged-bang-rev')
  assert.equal(hit.line, 3)
  assert.match(hit.snippet, /readAt/)
})

test('指纹序号稳定:同文件同 pattern 的第 N 次命中', () => {
  const src = ["readAt(':!0', a)", 'const x = 1', "gitShow(':!0', b)"].join('\n')
  const hits = fingerprintHits(scanFaceSpecText(src, { file: 'f.mjs' }))
  assert.deepEqual(hits.map((h) => h.key), ['f.mjs|staged-bang-rev|1', 'f.mjs|staged-bang-rev|2'])
})

test('棘轮:基线内=存量,基线外=新增', () => {
  const hits = fingerprintHits(scanFaceSpecText(["readAt(':!0', a)", "gitShow(':!0', b)"].join('\n'), { file: 'f.mjs' }))
  const base = baselineKeysFrom([{ key: 'f.mjs|staged-bang-rev|1' }])
  const split = splitByBaseline(hits, base)
  assert.equal(split.stock.length, 1)
  assert.equal(split.fresh.length, 1)
  assert.equal(split.fresh[0].ordinal, 2)
})

test('基线条目形状异常不得把命中藏起来', () => {
  // 空基线 ⇒ 全部是新增;基线不能被"缺字段"静默当成覆盖。
  const hits = fingerprintHits(scanFaceSpecText(ACCIDENT_2, { file: 'f.mjs' }))
  const split = splitByBaseline(hits, baselineKeysFrom([{}]))
  assert.equal(split.fresh.length, hits.length)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
