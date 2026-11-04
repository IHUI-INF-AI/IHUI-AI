// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * `scripts/lib/hook-log-read.mjs` 的镜像测试。
 *
 * 关键性质(三条,与并发治本同一笔):
 *   ① 轮转族按"旧 → 新"拼接(`.log.2` → `.log.1` → `.log`);
 *   ② 未合并 run 文件排在 canonical 之后,按文件名(定宽时间戳)升序;
 *   ③ tail 跨轮转/跨 pending 边界仍取到真正的末 n 行,不静默少给。
 * 跑法:`node --test scripts/tests/hook-log-read.test.mjs`
 */
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

import { listHookLogFamily, readHookLogText, tailHookLog } from '../lib/hook-log-read.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const LOG_REL = join('.ihui-agent', 'state', 'hook-logs')

function makeFixture() {
  const root = mkScratch('hook-log-read-')
  const dir = join(root, LOG_REL)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'demo.log.2'), 'gen2-a\ngen2-b\n')
  writeFileSync(join(dir, 'demo.log.1'), 'gen1-a\ngen1-b\n')
  writeFileSync(join(dir, 'demo.log'), 'active-a\nactive-b\n')
  mkdirSync(join(dir, 'demo'), { recursive: true })
  writeFileSync(join(dir, 'demo', 'wsh-20261104-120000-1-11.log'), 'run-a\nrun-b\n')
  writeFileSync(join(dir, 'demo', 'wsh-20261104-120001-1-22.log'), 'run-c\n')
  return { root, dir }
}

function cleanup(root) {
  rmScratch(root)
}

test('H1 轮转族 + 未合并 run 文件:旧 → 新顺序拼接', () => {
  const { root, dir } = makeFixture()
  try {
    const fam = listHookLogFamily(root, 'demo')
    assert.equal(fam.ok, true)
    assert.deepEqual(
      fam.files.map((f) => [f.path.slice(dir.length + 1).replace(/\\/g, '/'), f.source]),
      [
        ['demo.log.2', 'canonical'],
        ['demo.log.1', 'canonical'],
        ['demo.log', 'canonical'],
        ['demo/wsh-20261104-120000-1-11.log', 'pending'],
        ['demo/wsh-20261104-120001-1-22.log', 'pending'],
      ],
      '`.log.N` 数字越大越旧;pending 一定晚于 canonical',
    )
    const r = readHookLogText(root, 'demo')
    assert.equal(r.ok, true)
    assert.equal(
      r.text,
      'gen2-a\ngen2-b\ngen1-a\ngen1-b\nactive-a\nactive-b\nrun-a\nrun-b\nrun-c\n',
    )
  } finally {
    cleanup(root)
  }
})

test('H2 tail 跨轮转与 pending 边界:取到真正末 n 行', () => {
  const { root } = makeFixture()
  try {
    assert.equal(tailHookLog(root, 'demo', 3), 'run-a\nrun-b\nrun-c', '跨文件边界不得少给/错序')
    assert.equal(tailHookLog(root, 'demo', 1), 'run-c')
    assert.equal(tailHookLog(root, 'demo', 9).split('\n').length, 9, '行数恰好 9 时全给')
    assert.equal(tailHookLog(root, 'demo', 0), '')
  } finally {
    cleanup(root)
  }
})

test('H3 目录不存在 ⇒ 未判定(missing),不冒充"读到空日志"', () => {
  const root = mkScratch('hook-log-read-missing-')
  try {
    const fam = listHookLogFamily(root, 'demo')
    assert.equal(fam.ok, false)
    assert.equal(fam.state, 'missing')
    const r = readHookLogText(root, 'demo')
    assert.equal(r.ok, false)
    assert.equal(r.state, 'missing')
  } finally {
    cleanup(root)
  }
})
