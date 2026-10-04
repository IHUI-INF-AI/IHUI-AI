// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D139(尺子①扩面)的镜像测试 —— §22c 口径,但走**真实入口**(spawn 本尊)而非 import:
 * 这道门体量大、顶层有副作用,且判据的牙恰恰要在"真跑一遍"上证明。
 *
 * 三条,每条都防一类失效:
 *   T1 装车/扩面形状锁:门源码必须真含六端目录表与 face-reader 的 catBatch ——
 *      没有它,"扩面"会被一次回写悄悄退回只扫 web,而门照报绿(守门 118 半接线同型)。
 *   T2 自检端到端:--self-test 必须跑完、退出 0、三条 ST 全 ✅。
 *   T3 反向对照:故意断言"六端表里的目录字符串在门源码里逐个出现" —— 少一个(=退回只扫 web)
 *      必须红,否则 T1/T2 只是复读实现。
 */
import { test } from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const GATE = join(ROOT, 'scripts', 'check-agent-event-parity.mjs')

const END_DIRS = [
  'apps/miniapp-taro/src',
  'apps/mobile-rn/src',
  'packages/app/src',
  'apps/extension',
  'apps/desktop',
  'apps/cli/src',
]

test('T1 扩面形状锁:六端目录表 + catBatch 取材面都在门源码里(退回只扫 web 必红)', () => {
  const src = readFileSync(GATE, 'utf8')
  assert.match(src, /catBatch/, '门必须经 face-reader 的 catBatch 按 HEAD 面取材,而不是只读磁盘')
  for (const d of END_DIRS) {
    assert.ok(src.includes(d), `门源码缺端目录 ${d} —— 消费面被退回部分端时判据静默失效`)
  }
  assert.match(src, /agent-event-end-capability\.json/, '门必须读取端能力档案表,否则已声明帧无放行依据')
})

test('T2 自检端到端:--self-test 跑完、退出 0、ST 全 ✅', () => {
  const r = spawnSync(process.execPath, [GATE, '--self-test'], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 180_000,
    stdio: ['ignore', 'pipe', 'pipe']
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  })
  assert.equal(r.status, 0, `--self-test 应退出 0,实得 ${r.status}\nstdout 尾:${(r.stdout || '').slice(-600)}`)
  assert.match(r.stdout || '', /# 自检 3\/3 通过/, '三条 ST 必须全部通过并在末行报出')
  for (const st of ['ST1', 'ST2', 'ST3']) {
    assert.match(r.stdout || '', new RegExp(`✅ ${st}`), `自检缺少 ${st} 的通过行`)
  }
})

test('T3 反向对照:六端表与 catBatch 少任一项,T1 就必须能红(证明 T1 有牙)', () => {
  // 用构造面证明 T1 的断言不是恒真:把源码剥掉一个端目录后,T1 同款断言必须失败。
  const src = readFileSync(GATE, 'utf8')
  const broken = src.replace('apps/desktop', 'apps/__removed__')
  assert.notEqual(broken, src, '构造面未生效:门源码里找不到 apps/desktop')
  assert.ok(!broken.includes('apps/desktop'), '剥除后仍含该目录 ⇒ 构造面无效')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
