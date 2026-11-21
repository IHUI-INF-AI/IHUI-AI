#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 第 81 项接线锁:dev 库口令轮换窗口巡检。
 *
 * ① 导出 `sweepDevDbRotationWindow`,main() 与 daemon tick 两处都直调;
 * ② 五态分档:due 出可执行出路;undetermined 与无结论行记未判定(不记绿);ok/deferred/skip 记已判;
 * ③ 6 小时节流 + 尺子缺席不写戳。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync, rmSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GUARDIAN = join(ROOT, 'scripts', 'git-guardian.mjs')
const SRC = readFileSync(GUARDIAN, 'utf8')
const RUN = `${process.pid}-${Date.now()}`
async function load() {
  return import('file://' + GUARDIAN.replace(/\\/g, '/'))
}
function mkTick(name) {
  const dir = mkdtempSync(join(tmpdir(), `ddb-${RUN}-${name}-`))
  return { file: join(dir, 'last.json'), dir }
}
const line = (s, why) => `[dev-db-rotation-window] state=${s} —— ${why}\n`

test('① 导出 + main 与 tick 双挂点', () => {
  assert.match(SRC, /export async function sweepDevDbRotationWindow\(/)
  const mounts = SRC.split(/\r?\n/).filter((l) => /^\s*sweepDevDbRotationWindow\(\)\.catch/.test(l))
  assert.ok(mounts.length >= 2, `挂点只有 ${mounts.length} 处,需 main + daemon tick 两处`)
})

test('② due / undetermined / 无结论行 分档', async () => {
  const m = await load()
  const logs = []
  const logger = (s) => logs.push(String(s))
  const cases = [
    ['due', 'due', '超期 41.0 天'],
    ['undetermined', 'undetermined', '留痕不可判'],
    ['ok', 'ok', '未超期'],
    ['skip', 'skip', '未到窗口'],
  ]
  for (const [st, expect, why] of cases) {
    const t = mkTick(st)
    const r = await m.sweepDevDbRotationWindow({ now: 1_800_000_000_000, tickFile: t.file, logger, runner: () => ({ status: 0, stdout: line(st, why) }) })
    assert.equal(r.state, expect, `${st} 应判 ${expect}`)
    rmSync(t.dir, { recursive: true, force: true })
  }
  const t = mkTick('none')
  const r = await m.sweepDevDbRotationWindow({ now: 1, tickFile: t.file, logger, runner: () => ({ status: 0, stdout: 'noise\n' }) })
  assert.equal(r.state, 'unjudged', '无结论行必须落未判定')
  rmSync(t.dir, { recursive: true, force: true })
})

test('③ 6 小时节流 + 尺子缺席不写戳', async () => {
  const m = await load()
  const t = mkTick('thr')
  let calls = 0
  const runner = () => { calls += 1; return { status: 0, stdout: line('ok', '未超期') } }
  assert.equal((await m.sweepDevDbRotationWindow({ now: 1_800_000_000_000, tickFile: t.file, logger: () => {}, runner })).ran, true)
  assert.equal((await m.sweepDevDbRotationWindow({ now: 1_800_000_000_000 + 60_000, tickFile: t.file, logger: () => {}, runner })).ran, false)
  assert.equal((await m.sweepDevDbRotationWindow({ now: 1_800_000_000_000 + 6 * 3600_000 + 60_000, tickFile: t.file, logger: () => {}, runner })).ran, true)
  assert.equal(calls, 2)
  rmSync(t.dir, { recursive: true, force: true })

  const t2 = mkTick('absent')
  const r = await m.sweepDevDbRotationWindow({ now: 5, tickFile: t2.file, scriptFile: join(t2.dir, 'nope.mjs'), logger: () => {} })
  assert.equal(r.ran, false)
  assert.match(String(r.why), /尺子不在位/)
  assert.equal(existsSync(t2.file), false)
  rmSync(t2.dir, { recursive: true, force: true })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
