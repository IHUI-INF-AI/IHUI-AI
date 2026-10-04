// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch } from '../lib/scratch-dir.mjs'
import { keyOfRow, parseTaskRows } from '../lib/plan-task-index.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const TOOL = resolve(HERE, '../plan-copy-fold.mjs')
const TICK = String.fromCodePoint(0x2705)

function mkRepo(rows) {
  const dir = mkScratch('pcf-')
  // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  const g = (a) => execFileSync('git', ['-c', 'safe.directory=*', '-c', 'user.email=t@t', '-c', 'user.name=t', '-C', dir, ...a], { stdio: ['ignore', 'pipe', 'pipe'] }).toString()
  g(['init', '-q'])
  writeFileSync(join(dir, 'PROJECT_PLAN.md'), rows.join('\n') + '\n', 'utf8')
  g(['add', 'PROJECT_PLAN.md'])
  g(['commit', '-q', '-m', 'fixture'])
  return dir
}
const run = (dir, extra) => {
  const r = execFileSync(process.execPath, [TOOL, `--root=${dir}`, ...extra], {
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return r
}
/** 夹具前提自查:两条行的复合主键必须逐字相等(不等就说明夹具写错了,而不是判据错了)。 */
function assertSameKey(a, b) {
  const ka = keyOfRow(a)
  const kb = keyOfRow(b)
  assert.ok(ka, '主件必须有复合主键')
  assert.equal(ka, kb, '夹具前提:两条同主键')
  return ka
}

const OPEN = '- [ ] D9 夹具标题的正文片段'
const DONE = `- [x] ${TICK}(2026-09-01) D9 夹具标题的正文片段`
const LEASED = '- [ ] （进行中@2026-09-29/holder） D9 夹具标题的正文片段'

test('T1 f1 档:与已勾行同主键的未勾行被翻勾,正文逐字保留、行数不变', () => {
  const key = assertSameKey(DONE, OPEN)
  const dir = mkRepo(['# 夹具', DONE, OPEN, LEASED, '- [ ] Z9 另一件无关的事'])
  const out = run(dir, ['--mode=f1', '--out=cand.md'])
  assert.match(out, /归并 1 行/)
  const cand = readFileSync(join(dir, 'cand.md'), 'utf8').split('\n')
  assert.equal(cand.length, 6, '不删行')
  assert.ok(cand[2].startsWith(`- [x] ${TICK}`), '副本被翻勾')
  assert.ok(cand[2].includes(OPEN.slice('- [ ] '.length)), '正文一字未改(原正文是新行前缀)')
  assert.ok(cand[2].includes(key), '注记点名归并到哪个主键')
})

test('T2 带租约牌的认领行一条都不动(§16 越权边界)', () => {
  const dir = mkRepo(['# 夹具', DONE, OPEN, LEASED])
  run(dir, ['--mode=f1', '--out=cand.md'])
  const cand = readFileSync(join(dir, 'cand.md'), 'utf8').split('\n')
  assert.equal(cand[3], LEASED, '租约行必须逐字原样')
  assert.match(run(dir, ['--mode=f1']), /跳过带租约 1/)
})

test('T3 declared 档比 f1 保守:没有自述声明就不动 ⇒ 拒绝产出空候选', () => {
  const dir = mkRepo(['# 夹具', DONE, OPEN])
  let rc = 0
  let err = ''
  try {
    execFileSync(process.execPath, [TOOL, `--root=${dir}`, '--mode=declared', '--out=cand.md'], {
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (e) {
    rc = e.status
    err = String(e.stderr || '') + String(e.stdout || '')
  }
  assert.notEqual(rc, 0, 'declared 档必须拒绝(它只收自述副本)')
  assert.match(err, /无事可做或判据失效/, '拒绝时要说是哪一种,不得静默')
})

test('T4 declared 档收得到自述副本(与 T3 成对 ⇒ 两档确实不同判)', () => {
  const declared = '- [ ] D9 夹具标题的正文片段 〔【归并】重复登记副本(2026-09-29):派单以那条为准〕'
  const dir = mkRepo(['# 夹具', DONE, declared])
  const out = run(dir, ['--mode=declared', '--out=cand.md'])
  assert.match(out, /归并 1 行/)
})

test('T5 形状锁:判据只能逐行替换,且只能写候选/清单文件(绝不写回真台账)', () => {
  const src = readFileSync(TOOL, 'utf8')
  assert.doesNotMatch(src, /\.splice\(/, '删行形态不得回来')
  assert.doesNotMatch(src, /writeFileSync\([^)]*PROJECT_PLAN/, '不得直接写回台账')
  assert.match(src, /lines\[i\] = /, '按行索引替换是唯一写形')
  assert.match(src, /CLAIM\.test\(line\)/, '主循环必须先挡租约行')
  assert.match(src, /CLAIM\.test\(orig\[i\]\)/, '自证里必须再挡一次(两道闸不得只留一道)')
  assert.match(src, /from '\.\/lib\/plan-task-index\.mjs'/, '主键判据只许有一份实现')
})

test('T6 --root 缺省时按脚本自身位置定根(生产语义不变)', () => {
  const src = readFileSync(TOOL, 'utf8')
  assert.match(src, /process\.argv\.find\(\(a2\) => a2\.startsWith\('--root='\)\)/)
  assert.match(src, /resolve\(dirname\(fileURLToPath\(import\.meta\.url\)\)/)
  const rows = parseTaskRows(`# x\n${DONE}\n${OPEN}\n`)
  assert.equal(rows.filter((r) => r.state === 'done').length, 1, '夹具经真解析器读得出一勾一未勾')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
