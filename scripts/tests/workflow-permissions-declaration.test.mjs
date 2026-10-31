#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 门 48 规则 B(顶层 permissions 声明)的镜像测试(§22c 房例)。
 *
 * 三条纪律:
 *  1. 判据**从门体 import**,本文件不复制任何"什么算已声明"的正则 —— 复制一份必然漂移,
 *     而且门改了测试还绿,是最贵的一种假绿(见 check-test-judge-not-replicated 那条跨门判据)。
 *  2. 夹具由**本文件自带**,与门体 --self-test 的夹具相互独立:只跑门自己烤的样例,
 *     等于让被审对象自己出题。两档都跑才叫对照。
 *  3. 每条放行都有成对反证:同一份文本,把顶层块删掉/缩进进 jobs 必须翻红。
 */

import { readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { __test__ as gate } from '../check-workflow-step-order.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

test('判据单源:必须用门体导出的实现,不在本文件复算', () => {
  assert.equal(typeof gate.judgePermissionsDeclaration, 'function')
  assert.equal(typeof gate.scan, 'function')
})

test('本文件自带夹具:顶层块在放行、缺失与 write-all 判红', () => {
  const body =
    'on:\n  pull_request:\njobs:\n  x:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@000\n'
  assert.deepEqual(gate.judgePermissionsDeclaration('permissions:\n  contents: read\n' + body), [])
  assert.equal(gate.judgePermissionsDeclaration(body).length, 1, '缺顶层声明必须判红')
  assert.equal(
    gate.judgePermissionsDeclaration('permissions: write-all\n' + body).length,
    1,
    'write-all 必须判红',
  )
})

test('成对反证:同名键缩进进 jobs 就不算顶层地板', () => {
  const indented =
    'on:\n  push:\njobs:\n  x:\n    permissions:\n      contents: read\n    runs-on: ubuntu-latest\n'
  assert.equal(
    gate.judgePermissionsDeclaration(indented).length,
    1,
    'job 级声明救不了"下一个 job 忘了写"那一型,不能顶替顶层地板',
  )
})

test('门体 --self-test 的夹具(含"删掉即翻红"自证)必须全过', () => {
  const failures = gate.selfTest()
  assert.deepEqual(failures, [])
})

test('真实仓面:permissions 维零违规(绝对零容忍档,不是只报数)', () => {
  const permsViolations = gate.scan().filter((v) => v.includes('[permissions]'))
  assert.deepEqual(permsViolations, [])
})

test('覆盖面自证:"0 违规"不得来自"0 文件被扫"', () => {
  const dir = join(ROOT, '.github', 'workflows')
  const files = readdirSync(dir).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
  // 枚举到 0 个候选判死不记绿(§0.3):目录空/路径错时上面那条"零违规"是假的
  assert.ok(files.length >= 40, `workflow 枚数异常少(${files.length})⇒ 这一轮的"绿"没有意义`)
  const scanned = gate.scan()
  assert.ok(Array.isArray(scanned), 'scan 必须返回数组')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
