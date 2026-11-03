// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * managed-env-face 的镜像测试（§22c：判据 import 源模块，本层零复算）。
 *
 * 这层只有一件事不能错：**"面取不到" / "键没设" / "键设成空" 三态必须互不相同**。
 * 把它们压成同一种返回值，调用方就会把"读不到配置"判成"配置没开"—— §0.3 明令禁止的那种假绿。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as F } from '../lib/managed-env-face.mjs'

test('三态互不相同：取不到面 / 键没设 / 键设为空', async () => {
  assert.equal(F.readManagedEnvText('不存在的目录/没有这个文件.env'), null, '取不到面 ⇒ null')
  assert.equal(F.readManagedEnvValue('NO_SUCH_KEY_WHATEVER', '不存在的目录/x.env'), null)

  const dir = await mkScratch('managed-env-face')
  try {
    const abs = path.join(dir, 'a.env')
    writeFileSync(abs, 'FOO=bar\nEMPTY=\n', 'utf8')
    // 绝对路径也允许（本出口的 ROOT 约束只针对相对入参，越界由下面那条测试钉）
    assert.equal(F.readManagedEnvValue('FOO', abs), 'bar')
    assert.equal(F.readManagedEnvValue('EMPTY', abs), '', '设成空 ⇒ 空串，不是 undefined')
    assert.equal(F.readManagedEnvValue('MISSING', abs), undefined, '该面里没有这一行 ⇒ undefined')
  } finally {
    await rmScratch(dir)
  }
})

test('相对入参不得逃逸到仓库根之外', () => {
  const before = F.readManagedEnvText('../../Windows/win.ini')
  assert.equal(before, null, '越界路径必须直接判取不到，不去读盘外文件')
  assert.ok(!existsSync(path.resolve(F.ROOT, '../../Windows/win.ini')) || before === null)
})

test('受管面清单里至少有一个真在本仓（防清单整体腐烂成空气）', () => {
  assert.ok(F.MANAGED_ENV_FACES.length >= 1)
  const anyExists = F.MANAGED_ENV_FACES.some((f) => existsSync(path.join(F.ROOT, f)))
  assert.ok(anyExists, '一个都不在位 ⇒ 本出口的清单已腐烂，调用方会永远落未判定')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
